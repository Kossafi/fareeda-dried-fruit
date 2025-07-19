import { BaseModel } from './BaseModel';
import DatabaseConnection from '../database/connection';
import { 
  GoodsReceipt as IGoodsReceipt, 
  GoodsReceiptItem,
  QualityCheckStatus 
} from '@dried-fruits/types';
import logger from '../utils/logger';

export class GoodsReceipt extends BaseModel implements IGoodsReceipt {
  public receiptNumber!: string;
  public purchaseOrderId!: string;
  public receivedBy!: string;
  public receivedDate!: Date;
  public deliveryNoteNumber?: string;
  public invoiceNumber?: string;
  public totalReceivedAmount!: number;
  public qualityCheckStatus!: QualityCheckStatus;
  public qualityCheckedBy?: string;
  public qualityCheckDate?: Date;
  public qualityNotes?: string;
  public discrepancyNotes?: string;
  public isComplete!: boolean;

  protected tableName = 'goods_receipts';

  constructor(data?: Partial<IGoodsReceipt>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  // Create new goods receipt
  async create(receiptData: {
    purchaseOrderId: string;
    receivedBy: string;
    deliveryNoteNumber?: string;
    invoiceNumber?: string;
    qualityNotes?: string;
    items: Array<{
      purchaseOrderItemId: string;
      quantityReceived: number;
      unitCost?: number;
      qualityGrade?: string;
      expirationDate?: Date;
      batchNumber?: string;
      conditionNotes?: string;
      isAccepted?: boolean;
      rejectionReason?: string;
    }>;
  }): Promise<{ receipt: GoodsReceipt; items: GoodsReceiptItem[] }> {
    const db = DatabaseConnection.getInstance();

    try {
      await db.query('BEGIN');

      // Create goods receipt
      const receiptQuery = `
        INSERT INTO goods_receipts (
          purchase_order_id, received_by, delivery_note_number,
          invoice_number, quality_notes
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const receiptValues = [
        receiptData.purchaseOrderId,
        receiptData.receivedBy,
        receiptData.deliveryNoteNumber || null,
        receiptData.invoiceNumber || null,
        receiptData.qualityNotes || null
      ];

      const receiptResult = await db.query(receiptQuery, receiptValues);
      const receipt = new GoodsReceipt(receiptResult.rows[0]);

      // Create receipt items and update inventory
      const items: GoodsReceiptItem[] = [];
      let totalReceived = 0;
      let hasRejections = false;

      for (const itemData of receiptData.items) {
        // Get purchase order item details
        const poItemQuery = `
          SELECT poi.*, po.branch_id, poi.unit_cost as po_unit_cost
          FROM purchase_order_items poi
          JOIN purchase_orders po ON poi.purchase_order_id = po.id
          WHERE poi.id = $1
        `;
        const poItemResult = await db.query(poItemQuery, [itemData.purchaseOrderItemId]);
        
        if (poItemResult.rows.length === 0) {
          throw new Error(`Purchase order item ${itemData.purchaseOrderItemId} not found`);
        }

        const poItem = poItemResult.rows[0];
        const unitCost = itemData.unitCost || parseFloat(poItem.po_unit_cost);
        const isAccepted = itemData.isAccepted !== false; // default to true

        if (!isAccepted) {
          hasRejections = true;
        }

        // Create goods receipt item
        const itemQuery = `
          INSERT INTO goods_receipt_items (
            goods_receipt_id, purchase_order_item_id, product_id,
            quantity_received, unit_cost, quality_grade, expiration_date,
            batch_number, condition_notes, is_accepted, rejection_reason
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;

        const itemValues = [
          receipt.id,
          itemData.purchaseOrderItemId,
          poItem.product_id,
          itemData.quantityReceived,
          unitCost,
          itemData.qualityGrade || 'A',
          itemData.expirationDate || null,
          itemData.batchNumber || null,
          itemData.conditionNotes || null,
          isAccepted,
          itemData.rejectionReason || null
        ];

        const itemResult = await db.query(itemQuery, itemValues);
        const receiptItem = itemResult.rows[0] as GoodsReceiptItem;
        items.push(receiptItem);

        totalReceived += itemData.quantityReceived * unitCost;

        // Create inventory item if accepted
        if (isAccepted) {
          const inventoryQuery = `
            INSERT INTO inventory_items (
              product_id, branch_id, quantity_in_stock, unit_cost,
              expiration_date, batch_number, supplier_reference,
              last_updated_by, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
          `;

          const inventoryValues = [
            poItem.product_id,
            poItem.branch_id,
            itemData.quantityReceived,
            unitCost,
            itemData.expirationDate || null,
            itemData.batchNumber || null,
            receiptData.deliveryNoteNumber || null,
            receiptData.receivedBy,
            `Received via PO: ${poItem.purchase_order_id}, GR: ${receipt.receiptNumber}`
          ];

          const inventoryResult = await db.query(inventoryQuery, inventoryValues);
          const inventoryItemId = inventoryResult.rows[0].id;

          // Update receipt item with inventory reference
          await db.query(`
            UPDATE goods_receipt_items 
            SET inventory_item_id = $1 
            WHERE id = $2
          `, [inventoryItemId, receiptItem.id]);

          receiptItem.inventoryItemId = inventoryItemId;

          // Create stock movement record
          await db.query(`
            INSERT INTO stock_movements (
              inventory_item_id, movement_type, quantity, unit_cost,
              reference_type, reference_id, performed_by, notes
            ) VALUES ($1, 'receipt', $2, $3, 'goods_receipt', $4, $5, $6)
          `, [
            inventoryItemId,
            itemData.quantityReceived,
            unitCost,
            receipt.id,
            receiptData.receivedBy,
            `Goods received from supplier via ${receipt.receiptNumber}`
          ]);
        }
      }

      // Update receipt totals and quality status
      const qualityStatus = hasRejections ? 
        QualityCheckStatus.PARTIAL : QualityCheckStatus.PASSED;

      const updateReceiptQuery = `
        UPDATE goods_receipts 
        SET 
          total_received_amount = $1,
          quality_check_status = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;

      const updatedResult = await db.query(updateReceiptQuery, [
        totalReceived,
        qualityStatus,
        receipt.id
      ]);

      const updatedReceipt = new GoodsReceipt(updatedResult.rows[0]);

      await db.query('COMMIT');

      logger.info('Goods receipt created', {
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber,
        purchaseOrderId: receiptData.purchaseOrderId,
        totalAmount: totalReceived,
        itemCount: items.length,
        hasRejections
      });

      return { receipt: updatedReceipt, items };

    } catch (error) {
      await db.query('ROLLBACK');
      logger.error('Error creating goods receipt:', error);
      throw error;
    }
  }

  // Complete quality check
  async completeQualityCheck(
    id: string,
    qualityCheckedBy: string,
    status: QualityCheckStatus,
    notes?: string
  ): Promise<GoodsReceipt> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE goods_receipts 
      SET 
        quality_check_status = $1,
        quality_checked_by = $2,
        quality_check_date = CURRENT_TIMESTAMP,
        quality_notes = $3,
        is_complete = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;

    const result = await db.query(query, [status, qualityCheckedBy, notes, id]);

    if (result.rows.length === 0) {
      throw new Error('Goods receipt not found');
    }

    const receipt = new GoodsReceipt(result.rows[0]);

    logger.info('Quality check completed', {
      receiptId: id,
      receiptNumber: receipt.receiptNumber,
      status,
      qualityCheckedBy
    });

    return receipt;
  }

  // Get goods receipt by ID with details
  async getById(id: string): Promise<GoodsReceipt & {
    purchaseOrder?: any;
    supplier?: any;
    items?: GoodsReceiptItem[];
  } | null> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT 
        gr.*,
        po.po_number,
        po.supplier_id,
        s.company_name as supplier_name,
        u1.username as received_by_name,
        u2.username as quality_checked_by_name
      FROM goods_receipts gr
      JOIN purchase_orders po ON gr.purchase_order_id = po.id
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN users u1 ON gr.received_by = u1.id
      LEFT JOIN users u2 ON gr.quality_checked_by = u2.id
      WHERE gr.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const receiptData = result.rows[0];
    const receipt = new GoodsReceipt(receiptData) as any;

    // Add purchase order info
    receipt.purchaseOrder = {
      id: receiptData.purchase_order_id,
      poNumber: receiptData.po_number
    };

    // Add supplier info
    receipt.supplier = {
      id: receiptData.supplier_id,
      companyName: receiptData.supplier_name
    };

    // Get receipt items
    const itemsQuery = `
      SELECT 
        gri.*,
        p.name as product_name,
        p.sku as product_sku,
        poi.quantity_ordered,
        poi.unit_cost as ordered_unit_cost
      FROM goods_receipt_items gri
      JOIN products p ON gri.product_id = p.id
      JOIN purchase_order_items poi ON gri.purchase_order_item_id = poi.id
      WHERE gri.goods_receipt_id = $1
      ORDER BY gri.created_at
    `;

    const itemsResult = await db.query(itemsQuery, [id]);
    receipt.items = itemsResult.rows;

    return receipt;
  }

  // Get receipts by purchase order
  async getByPurchaseOrder(purchaseOrderId: string): Promise<GoodsReceipt[]> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT 
        gr.*,
        u1.username as received_by_name,
        u2.username as quality_checked_by_name
      FROM goods_receipts gr
      JOIN users u1 ON gr.received_by = u1.id
      LEFT JOIN users u2 ON gr.quality_checked_by = u2.id
      WHERE gr.purchase_order_id = $1
      ORDER BY gr.received_date DESC
    `;

    const result = await db.query(query, [purchaseOrderId]);
    return result.rows.map(row => new GoodsReceipt(row));
  }

  // Get pending quality checks
  async getPendingQualityChecks(branchId?: string): Promise<GoodsReceipt[]> {
    const db = DatabaseConnection.getInstance();

    let whereClause = "WHERE gr.quality_check_status = 'pending'";
    const values = [];

    if (branchId) {
      whereClause += ' AND po.branch_id = $1';
      values.push(branchId);
    }

    const query = `
      SELECT 
        gr.*,
        po.po_number,
        po.branch_id,
        b.name as branch_name,
        s.company_name as supplier_name,
        u.username as received_by_name
      FROM goods_receipts gr
      JOIN purchase_orders po ON gr.purchase_order_id = po.id
      JOIN branches b ON po.branch_id = b.id
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN users u ON gr.received_by = u.id
      ${whereClause}
      ORDER BY gr.received_date ASC
    `;

    const result = await db.query(query, values);
    return result.rows.map(row => {
      const receipt = new GoodsReceipt(row) as any;
      receipt.poNumber = row.po_number;
      receipt.branchName = row.branch_name;
      receipt.supplierName = row.supplier_name;
      receipt.receivedByName = row.received_by_name;
      return receipt;
    });
  }

  // Update discrepancy notes
  async updateDiscrepancy(
    id: string, 
    discrepancyNotes: string,
    updatedBy: string
  ): Promise<GoodsReceipt> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE goods_receipts 
      SET 
        discrepancy_notes = $1,
        quality_check_status = CASE 
          WHEN quality_check_status = 'pending' THEN 'failed'
          ELSE quality_check_status
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await db.query(query, [discrepancyNotes, id]);

    if (result.rows.length === 0) {
      throw new Error('Goods receipt not found');
    }

    const receipt = new GoodsReceipt(result.rows[0]);

    logger.info('Goods receipt discrepancy updated', {
      receiptId: id,
      receiptNumber: receipt.receiptNumber,
      updatedBy
    });

    return receipt;
  }

  // Get receiving statistics
  async getReceivingStatistics(
    dateFrom?: Date,
    dateTo?: Date,
    branchId?: string
  ): Promise<{
    totalReceipts: number;
    totalValue: number;
    qualityPassRate: number;
    averageProcessingTime: number; // hours
    discrepancyCount: number;
    topSuppliers: Array<{
      supplierId: string;
      supplierName: string;
      receiptCount: number;
      totalValue: number;
      qualityScore: number;
    }>;
  }> {
    const db = DatabaseConnection.getInstance();

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (dateFrom) {
      whereClause += ` AND gr.received_date >= $${paramCount}`;
      values.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      whereClause += ` AND gr.received_date <= $${paramCount}`;
      values.push(dateTo);
      paramCount++;
    }

    if (branchId) {
      whereClause += ` AND po.branch_id = $${paramCount}`;
      values.push(branchId);
      paramCount++;
    }

    const query = `
      WITH receipt_stats AS (
        SELECT 
          gr.*,
          po.supplier_id,
          s.company_name as supplier_name,
          EXTRACT(EPOCH FROM (gr.quality_check_date - gr.received_date))/3600 as processing_hours
        FROM goods_receipts gr
        JOIN purchase_orders po ON gr.purchase_order_id = po.id
        JOIN suppliers s ON po.supplier_id = s.id
        ${whereClause}
      ),
      summary_stats AS (
        SELECT 
          COUNT(*) as total_receipts,
          COALESCE(SUM(total_received_amount), 0) as total_value,
          COUNT(*) FILTER (WHERE quality_check_status = 'passed') as passed_receipts,
          COUNT(*) FILTER (WHERE discrepancy_notes IS NOT NULL) as discrepancy_count,
          COALESCE(AVG(processing_hours), 0) as avg_processing_time
        FROM receipt_stats
      ),
      supplier_stats AS (
        SELECT 
          rs.supplier_id,
          rs.supplier_name,
          COUNT(*) as receipt_count,
          COALESCE(SUM(rs.total_received_amount), 0) as total_value,
          (COUNT(*) FILTER (WHERE rs.quality_check_status = 'passed')::DECIMAL / 
           NULLIF(COUNT(*), 0) * 100) as quality_score
        FROM receipt_stats rs
        GROUP BY rs.supplier_id, rs.supplier_name
        ORDER BY total_value DESC
        LIMIT 5
      )
      SELECT 
        ss.*,
        json_agg(
          json_build_object(
            'supplier_id', sups.supplier_id,
            'supplier_name', sups.supplier_name,
            'receipt_count', sups.receipt_count,
            'total_value', sups.total_value,
            'quality_score', sups.quality_score
          ) ORDER BY sups.total_value DESC
        ) FILTER (WHERE sups.supplier_id IS NOT NULL) as top_suppliers
      FROM summary_stats ss
      LEFT JOIN supplier_stats sups ON true
      GROUP BY ss.total_receipts, ss.total_value, ss.passed_receipts, 
               ss.discrepancy_count, ss.avg_processing_time
    `;

    const result = await db.query(query, values);
    const stats = result.rows[0] || {};

    const totalReceipts = parseInt(stats.total_receipts) || 0;
    const passedReceipts = parseInt(stats.passed_receipts) || 0;

    return {
      totalReceipts,
      totalValue: parseFloat(stats.total_value) || 0,
      qualityPassRate: totalReceipts > 0 ? (passedReceipts / totalReceipts * 100) : 0,
      averageProcessingTime: parseFloat(stats.avg_processing_time) || 0,
      discrepancyCount: parseInt(stats.discrepancy_count) || 0,
      topSuppliers: stats.top_suppliers || []
    };
  }
}

export default GoodsReceipt;