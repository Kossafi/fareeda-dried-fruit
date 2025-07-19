import { BaseModel } from './BaseModel';
import DatabaseConnection from '../database/connection';
import { 
  PurchaseOrder as IPurchaseOrder, 
  PurchaseOrderStatus, 
  UrgencyLevel,
  PurchaseOrderItem,
  PurchaseApproval,
  ApprovalAction
} from '@dried-fruits/types';
import logger from '../utils/logger';

export class PurchaseOrder extends BaseModel implements IPurchaseOrder {
  public poNumber!: string;
  public supplierId!: string;
  public branchId!: string;
  public requestedBy!: string;
  public status!: PurchaseOrderStatus;
  public urgency!: UrgencyLevel;
  public orderDate!: Date;
  public requiredDate?: Date;
  public expectedDeliveryDate?: Date;
  public actualDeliveryDate?: Date;
  public subtotal!: number;
  public taxAmount!: number;
  public discountAmount!: number;
  public shippingCost!: number;
  public totalAmount!: number;
  public currencyCode!: string;
  public paymentTerms!: number;
  public notes?: string;
  public internalNotes?: string;
  public supplierReference?: string;
  public trackingNumber?: string;
  public isAutomated!: boolean;
  public sourceAlertId?: string;
  public approvedBy?: string;
  public approvedAt?: Date;
  public sentAt?: Date;
  public cancelledReason?: string;
  public cancelledBy?: string;
  public cancelledAt?: Date;

  protected tableName = 'purchase_orders';

  constructor(data?: Partial<IPurchaseOrder>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  // Create new purchase order
  async create(orderData: {
    supplierId: string;
    branchId: string;
    requestedBy: string;
    urgency?: UrgencyLevel;
    requiredDate?: Date;
    notes?: string;
    sourceAlertId?: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitCost?: number;
      supplierProductId?: string;
      notes?: string;
    }>;
  }): Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] }> {
    const db = DatabaseConnection.getInstance();

    try {
      await db.query('BEGIN');

      // Create purchase order
      const orderQuery = `
        INSERT INTO purchase_orders (
          supplier_id, branch_id, requested_by, urgency, required_date,
          notes, source_alert_id, is_automated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const orderValues = [
        orderData.supplierId,
        orderData.branchId,
        orderData.requestedBy,
        orderData.urgency || UrgencyLevel.NORMAL,
        orderData.requiredDate || null,
        orderData.notes || null,
        orderData.sourceAlertId || null,
        !!orderData.sourceAlertId // is_automated if created from alert
      ];

      const orderResult = await db.query(orderQuery, orderValues);
      const order = new PurchaseOrder(orderResult.rows[0]);

      // Create order items
      const items: PurchaseOrderItem[] = [];
      for (const itemData of orderData.items) {
        let unitCost = itemData.unitCost;

        // Get unit cost from supplier product if not provided
        if (!unitCost) {
          const costQuery = `
            SELECT unit_cost FROM supplier_products
            WHERE supplier_id = $1 AND product_id = $2
          `;
          const costResult = await db.query(costQuery, [orderData.supplierId, itemData.productId]);
          
          if (costResult.rows.length > 0) {
            unitCost = parseFloat(costResult.rows[0].unit_cost);
          } else {
            // Fallback to average inventory cost
            const avgCostQuery = `
              SELECT AVG(unit_cost) as avg_cost 
              FROM inventory_items 
              WHERE product_id = $1 AND is_active = true
            `;
            const avgResult = await db.query(avgCostQuery, [itemData.productId]);
            unitCost = avgResult.rows[0]?.avg_cost ? parseFloat(avgResult.rows[0].avg_cost) : 0;
          }
        }

        const itemQuery = `
          INSERT INTO purchase_order_items (
            purchase_order_id, product_id, supplier_product_id,
            quantity_ordered, unit_cost, notes
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;

        const itemValues = [
          order.id,
          itemData.productId,
          itemData.supplierProductId || null,
          itemData.quantity,
          unitCost,
          itemData.notes || null
        ];

        const itemResult = await db.query(itemQuery, itemValues);
        items.push(itemResult.rows[0] as PurchaseOrderItem);
      }

      // Calculate totals (handled by trigger)
      const updatedOrderQuery = `SELECT * FROM purchase_orders WHERE id = $1`;
      const updatedResult = await db.query(updatedOrderQuery, [order.id]);
      const updatedOrder = new PurchaseOrder(updatedResult.rows[0]);

      await db.query('COMMIT');

      logger.info('Purchase order created', {
        poId: updatedOrder.id,
        poNumber: updatedOrder.poNumber,
        supplierId: orderData.supplierId,
        totalAmount: updatedOrder.totalAmount,
        itemCount: items.length
      });

      return { order: updatedOrder, items };

    } catch (error) {
      await db.query('ROLLBACK');
      logger.error('Error creating purchase order:', error);
      throw error;
    }
  }

  // Update purchase order
  async update(id: string, updateData: {
    urgency?: UrgencyLevel;
    requiredDate?: Date;
    expectedDeliveryDate?: Date;
    notes?: string;
    internalNotes?: string;
    supplierReference?: string;
    trackingNumber?: string;
  }): Promise<PurchaseOrder> {
    const db = DatabaseConnection.getInstance();

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        const dbKey = this.camelToSnake(key);
        updateFields.push(`${dbKey} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);

    const query = `
      UPDATE purchase_orders 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount} AND status = 'draft'
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Purchase order not found or cannot be updated (not in draft status)');
    }

    return new PurchaseOrder(result.rows[0]);
  }

  // Submit for approval
  async submitForApproval(id: string): Promise<PurchaseOrder> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE purchase_orders 
      SET status = 'pending_approval', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'draft'
      RETURNING *
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('Purchase order not found or not in draft status');
    }

    const order = new PurchaseOrder(result.rows[0]);

    logger.info('Purchase order submitted for approval', {
      poId: id,
      poNumber: order.poNumber,
      totalAmount: order.totalAmount
    });

    return order;
  }

  // Approve purchase order
  async approve(
    id: string, 
    approverId: string, 
    approvalLevel: number,
    comments?: string,
    approvedAmount?: number
  ): Promise<PurchaseOrder> {
    const db = DatabaseConnection.getInstance();

    try {
      await db.query('BEGIN');

      // Record approval
      const approvalQuery = `
        UPDATE purchase_approvals 
        SET 
          approver_id = $1,
          action = 'approve',
          comments = $2,
          approved_amount = $3,
          action_date = CURRENT_TIMESTAMP
        WHERE purchase_order_id = $4 
        AND approval_level = $5 
        AND action IS NULL
        RETURNING *
      `;

      const approvalResult = await db.query(approvalQuery, [
        approverId,
        comments || null,
        approvedAmount || null,
        id,
        approvalLevel
      ]);

      if (approvalResult.rows.length === 0) {
        throw new Error('Approval record not found or already processed');
      }

      // Check if all required approvals are complete
      const pendingQuery = `
        SELECT COUNT(*) as pending_count
        FROM purchase_approvals
        WHERE purchase_order_id = $1 
        AND is_required = true 
        AND action IS NULL
      `;

      const pendingResult = await db.query(pendingQuery, [id]);
      const pendingCount = parseInt(pendingResult.rows[0].pending_count);

      // Update PO status if fully approved
      let newStatus = PurchaseOrderStatus.PENDING_APPROVAL;
      if (pendingCount === 0) {
        newStatus = PurchaseOrderStatus.APPROVED;
      }

      const updateQuery = `
        UPDATE purchase_orders 
        SET 
          status = $1,
          approved_by = CASE WHEN $1 = 'approved' THEN $2 ELSE approved_by END,
          approved_at = CASE WHEN $1 = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;

      const orderResult = await db.query(updateQuery, [newStatus, approverId, id]);
      const order = new PurchaseOrder(orderResult.rows[0]);

      await db.query('COMMIT');

      logger.info('Purchase order approved', {
        poId: id,
        poNumber: order.poNumber,
        approverLevel: approvalLevel,
        approverId,
        finalStatus: order.status
      });

      return order;

    } catch (error) {
      await db.query('ROLLBACK');
      logger.error('Error approving purchase order:', error);
      throw error;
    }
  }

  // Reject purchase order
  async reject(
    id: string, 
    approverId: string, 
    approvalLevel: number,
    reason: string
  ): Promise<PurchaseOrder> {
    const db = DatabaseConnection.getInstance();

    try {
      await db.query('BEGIN');

      // Record rejection
      const approvalQuery = `
        UPDATE purchase_approvals 
        SET 
          approver_id = $1,
          action = 'reject',
          comments = $2,
          action_date = CURRENT_TIMESTAMP
        WHERE purchase_order_id = $3 
        AND approval_level = $4 
        AND action IS NULL
      `;

      await db.query(approvalQuery, [approverId, reason, id, approvalLevel]);

      // Update PO status to rejected
      const updateQuery = `
        UPDATE purchase_orders 
        SET 
          status = 'rejected',
          cancelled_reason = $1,
          cancelled_by = $2,
          cancelled_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;

      const result = await db.query(updateQuery, [reason, approverId, id]);
      const order = new PurchaseOrder(result.rows[0]);

      await db.query('COMMIT');

      logger.info('Purchase order rejected', {
        poId: id,
        poNumber: order.poNumber,
        approverId,
        reason
      });

      return order;

    } catch (error) {
      await db.query('ROLLBACK');
      logger.error('Error rejecting purchase order:', error);
      throw error;
    }
  }

  // Send to supplier
  async sendToSupplier(id: string, sentBy: string): Promise<PurchaseOrder> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE purchase_orders 
      SET 
        status = 'sent_to_supplier',
        sent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'approved'
      RETURNING *
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('Purchase order not found or not approved');
    }

    const order = new PurchaseOrder(result.rows[0]);

    logger.info('Purchase order sent to supplier', {
      poId: id,
      poNumber: order.poNumber,
      sentBy
    });

    return order;
  }

  // Update status
  async updateStatus(
    id: string, 
    status: PurchaseOrderStatus,
    updatedBy: string,
    notes?: string
  ): Promise<PurchaseOrder> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE purchase_orders 
      SET 
        status = $1,
        internal_notes = CASE 
          WHEN $2 IS NOT NULL THEN 
            COALESCE(internal_notes || '\n', '') || 
            '[' || CURRENT_TIMESTAMP || '] ' || $2
          ELSE internal_notes
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    const result = await db.query(query, [status, notes, id]);

    if (result.rows.length === 0) {
      throw new Error('Purchase order not found');
    }

    const order = new PurchaseOrder(result.rows[0]);

    logger.info('Purchase order status updated', {
      poId: id,
      poNumber: order.poNumber,
      newStatus: status,
      updatedBy
    });

    return order;
  }

  // Get purchase order by ID with details
  async getById(id: string): Promise<PurchaseOrder & {
    supplier?: any;
    branch?: any;
    items?: PurchaseOrderItem[];
    approvals?: PurchaseApproval[];
  } | null> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT 
        po.*,
        s.company_name as supplier_name,
        s.contact_person as supplier_contact,
        s.email as supplier_email,
        s.phone as supplier_phone,
        b.name as branch_name,
        u.username as requested_by_name
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN branches b ON po.branch_id = b.id
      JOIN users u ON po.requested_by = u.id
      WHERE po.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const orderData = result.rows[0];
    const order = new PurchaseOrder(orderData) as any;

    // Add supplier info
    order.supplier = {
      id: orderData.supplier_id,
      companyName: orderData.supplier_name,
      contactPerson: orderData.supplier_contact,
      email: orderData.supplier_email,
      phone: orderData.supplier_phone
    };

    // Add branch info
    order.branch = {
      id: orderData.branch_id,
      name: orderData.branch_name
    };

    // Get items
    const itemsQuery = `
      SELECT 
        poi.*,
        p.name as product_name,
        p.sku as product_sku,
        p.unit_type
      FROM purchase_order_items poi
      JOIN products p ON poi.product_id = p.id
      WHERE poi.purchase_order_id = $1
      ORDER BY poi.created_at
    `;

    const itemsResult = await db.query(itemsQuery, [id]);
    order.items = itemsResult.rows;

    // Get approvals
    const approvalsQuery = `
      SELECT 
        pa.*,
        u.username as approver_name
      FROM purchase_approvals pa
      LEFT JOIN users u ON pa.approver_id = u.id
      WHERE pa.purchase_order_id = $1
      ORDER BY pa.approval_level
    `;

    const approvalsResult = await db.query(approvalsQuery, [id]);
    order.approvals = approvalsResult.rows;

    return order;
  }

  // Get pending approvals for user
  async getPendingApprovalsForUser(
    userId: string,
    userRole: string
  ): Promise<Array<PurchaseOrder & { pendingLevel: number }>> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT 
        po.*,
        pa.approval_level as pending_level,
        s.company_name as supplier_name,
        b.name as branch_name,
        u.username as requested_by_name
      FROM purchase_orders po
      JOIN purchase_approvals pa ON po.id = pa.purchase_order_id
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN branches b ON po.branch_id = b.id
      JOIN users u ON po.requested_by = u.id
      WHERE po.status = 'pending_approval'
      AND pa.required_role = $1
      AND pa.action IS NULL
      AND pa.is_required = true
      ORDER BY po.urgency DESC, po.total_amount DESC, po.created_at ASC
    `;

    const result = await db.query(query, [userRole]);
    return result.rows.map(row => {
      const order = new PurchaseOrder(row) as any;
      order.pendingLevel = row.pending_level;
      order.supplierName = row.supplier_name;
      order.branchName = row.branch_name;
      order.requestedByName = row.requested_by_name;
      return order;
    });
  }

  // Cancel purchase order
  async cancel(id: string, cancelledBy: string, reason: string): Promise<PurchaseOrder> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE purchase_orders 
      SET 
        status = 'cancelled',
        cancelled_reason = $1,
        cancelled_by = $2,
        cancelled_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 
      AND status IN ('draft', 'pending_approval', 'approved', 'sent_to_supplier')
      RETURNING *
    `;

    const result = await db.query(query, [reason, cancelledBy, id]);

    if (result.rows.length === 0) {
      throw new Error('Purchase order not found or cannot be cancelled');
    }

    const order = new PurchaseOrder(result.rows[0]);

    logger.info('Purchase order cancelled', {
      poId: id,
      poNumber: order.poNumber,
      cancelledBy,
      reason
    });

    return order;
  }

  // Helper method to convert camelCase to snake_case
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export default PurchaseOrder;