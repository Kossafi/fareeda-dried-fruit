import DatabaseConnection from '../database/connection';
import PurchaseOrder from '../models/PurchaseOrder';
import Supplier from '../models/Supplier';
import GoodsReceipt from '../models/GoodsReceipt';
import StockAlert from '../models/StockAlert';
import { 
  PurchaseOrderStatus, 
  UrgencyLevel,
  CreatePurchaseOrderRequest,
  AutoPurchaseOrderRequest,
  SupplierRecommendation,
  ProcurementDashboard,
  PurchaseOrderFilters,
  SupplierPerformanceReport
} from '@dried-fruits/types';
import logger from '../utils/logger';

export class ProcurementManagementService {
  private purchaseOrder: PurchaseOrder;
  private supplier: Supplier;
  private goodsReceipt: GoodsReceipt;
  private stockAlert: StockAlert;

  constructor() {
    this.purchaseOrder = new PurchaseOrder();
    this.supplier = new Supplier();
    this.goodsReceipt = new GoodsReceipt();
    this.stockAlert = new StockAlert();
  }

  // Create purchase order from low stock alert
  async createOrderFromAlert(
    alertId: string,
    requestedBy: string,
    requestData?: Partial<AutoPurchaseOrderRequest>
  ): Promise<{ order: PurchaseOrder; items: any[] }> {
    try {
      logger.info('Creating purchase order from alert', { alertId, requestedBy });

      // Get alert details
      const alert = await this.stockAlert.getById(alertId);
      if (!alert) {
        throw new Error('Stock alert not found');
      }

      if (alert.status !== 'active') {
        throw new Error('Alert is not active');
      }

      // Calculate order quantity based on reorder point and max stock
      const orderQuantity = Math.max(
        alert.suggestedReorderQuantity || alert.reorderPoint * 2,
        alert.reorderPoint
      );

      // Get best supplier for the product
      let supplierId = requestData?.supplierId;
      if (!supplierId) {
        const suppliers = await this.supplier.getBestSuppliersForProduct(
          alert.productId, 
          orderQuantity
        );
        
        if (suppliers.length === 0) {
          throw new Error('No suitable suppliers found for this product');
        }
        
        supplierId = suppliers[0].supplier.id;
      }

      // Create purchase order
      const orderData: CreatePurchaseOrderRequest = {
        supplierId: supplierId!,
        branchId: alert.branchId,
        urgency: requestData?.urgency || UrgencyLevel.NORMAL,
        sourceAlertId: alertId,
        notes: requestData?.notes || `Auto-generated from low stock alert: ${alert.id}`,
        items: [{
          productId: alert.productId,
          quantity: orderQuantity,
          notes: `Reorder for product: ${alert.productId}, current stock: ${alert.currentStock}`
        }]
      };

      const result = await this.createPurchaseOrder(orderData, requestedBy);

      // Update alert status
      await this.stockAlert.markAsProcessed(alertId, {
        actionTaken: 'purchase_order_created',
        actionBy: requestedBy,
        actionNotes: `Purchase order ${result.order.poNumber} created`,
        purchaseOrderId: result.order.id
      });

      logger.info('Purchase order created from alert', {
        alertId,
        poId: result.order.id,
        poNumber: result.order.poNumber,
        quantity: orderQuantity
      });

      return result;

    } catch (error) {
      logger.error('Error creating purchase order from alert:', error);
      throw error;
    }
  }

  // Create manual purchase order
  async createPurchaseOrder(
    orderData: CreatePurchaseOrderRequest,
    requestedBy: string
  ): Promise<{ order: PurchaseOrder; items: any[] }> {
    try {
      logger.info('Creating purchase order', {
        supplierId: orderData.supplierId,
        branchId: orderData.branchId,
        itemCount: orderData.items.length
      });

      // Validate supplier
      const supplier = await this.supplier.getById(orderData.supplierId);
      if (!supplier || !supplier.isActive) {
        throw new Error('Supplier not found or inactive');
      }

      // Enrich items with supplier product data
      const enrichedItems = [];
      for (const item of orderData.items) {
        const supplierProducts = await this.supplier.getSupplierProducts(orderData.supplierId);
        const supplierProduct = supplierProducts.find(sp => sp.productId === item.productId);
        
        enrichedItems.push({
          ...item,
          unitCost: item.unitCost || supplierProduct?.unitCost,
          supplierProductId: supplierProduct?.id
        });
      }

      const result = await this.purchaseOrder.create({
        supplierId: orderData.supplierId,
        branchId: orderData.branchId,
        requestedBy,
        urgency: orderData.urgency,
        requiredDate: orderData.requiredDate,
        notes: orderData.notes,
        sourceAlertId: orderData.sourceAlertId,
        items: enrichedItems
      });

      return result;

    } catch (error) {
      logger.error('Error creating purchase order:', error);
      throw error;
    }
  }

  // Get supplier recommendations for product
  async getSupplierRecommendations(
    productId: string,
    quantity: number = 1,
    branchId?: string
  ): Promise<SupplierRecommendation[]> {
    try {
      const suppliers = await this.supplier.getBestSuppliersForProduct(productId, quantity);
      
      return suppliers.map(item => ({
        supplierId: item.supplier.id!,
        supplierName: item.supplier.companyName,
        unitCost: item.supplierProduct.unitCost,
        leadTimeDays: item.supplierProduct.leadTimeDays,
        qualityGrade: item.supplierProduct.qualityGrade,
        overallScore: item.score,
        isPreferred: item.supplierProduct.isPreferred,
        reasons: item.reasons
      }));

    } catch (error) {
      logger.error('Error getting supplier recommendations:', error);
      throw error;
    }
  }

  // Submit purchase order for approval
  async submitForApproval(poId: string, submittedBy: string): Promise<PurchaseOrder> {
    try {
      const order = await this.purchaseOrder.submitForApproval(poId);
      
      logger.info('Purchase order submitted for approval', {
        poId,
        poNumber: order.poNumber,
        submittedBy
      });

      return order;

    } catch (error) {
      logger.error('Error submitting purchase order for approval:', error);
      throw error;
    }
  }

  // Process approval workflow
  async processApproval(
    poId: string,
    approverId: string,
    userRole: string,
    action: 'approve' | 'reject',
    comments?: string,
    approvedAmount?: number
  ): Promise<PurchaseOrder> {
    try {
      const db = DatabaseConnection.getInstance();

      // Get current approval level for this role
      const levelQuery = `
        SELECT approval_level 
        FROM purchase_approvals 
        WHERE purchase_order_id = $1 
        AND required_role = $2 
        AND action IS NULL
        ORDER BY approval_level ASC 
        LIMIT 1
      `;

      const levelResult = await db.query(levelQuery, [poId, userRole]);
      
      if (levelResult.rows.length === 0) {
        throw new Error('No pending approval found for this role');
      }

      const approvalLevel = levelResult.rows[0].approval_level;

      let result;
      if (action === 'approve') {
        result = await this.purchaseOrder.approve(
          poId, 
          approverId, 
          approvalLevel, 
          comments, 
          approvedAmount
        );
      } else {
        result = await this.purchaseOrder.reject(
          poId, 
          approverId, 
          approvalLevel, 
          comments || 'No reason provided'
        );
      }

      return result;

    } catch (error) {
      logger.error('Error processing approval:', error);
      throw error;
    }
  }

  // Receive goods and update inventory
  async receiveGoods(
    receiptData: {
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
    }
  ): Promise<{ receipt: GoodsReceipt; items: any[] }> {
    try {
      logger.info('Receiving goods', {
        purchaseOrderId: receiptData.purchaseOrderId,
        receivedBy: receiptData.receivedBy,
        itemCount: receiptData.items.length
      });

      const result = await this.goodsReceipt.create(receiptData);

      // Update supplier ratings based on delivery performance
      await this.updateSupplierPerformance(receiptData.purchaseOrderId);

      return result;

    } catch (error) {
      logger.error('Error receiving goods:', error);
      throw error;
    }
  }

  // Update supplier performance after delivery
  private async updateSupplierPerformance(purchaseOrderId: string): Promise<void> {
    try {
      const db = DatabaseConnection.getInstance();

      const query = `
        SELECT 
          po.supplier_id,
          po.expected_delivery_date,
          po.actual_delivery_date,
          gr.quality_check_status
        FROM purchase_orders po
        LEFT JOIN goods_receipts gr ON po.id = gr.purchase_order_id
        WHERE po.id = $1
      `;

      const result = await db.query(query, [purchaseOrderId]);
      
      if (result.rows.length === 0) {
        return;
      }

      const data = result.rows[0];
      const deliveryScore = this.calculateDeliveryScore(
        data.expected_delivery_date,
        data.actual_delivery_date
      );

      const qualityScore = this.calculateQualityScore(data.quality_check_status);

      await this.supplier.updateRating(data.supplier_id, {
        deliveryRating: deliveryScore,
        qualityRating: qualityScore
      });

    } catch (error) {
      logger.error('Error updating supplier performance:', error);
    }
  }

  // Calculate delivery performance score
  private calculateDeliveryScore(expectedDate?: Date, actualDate?: Date): number {
    if (!expectedDate || !actualDate) {
      return 3; // neutral score
    }

    const expectedTime = expectedDate.getTime();
    const actualTime = actualDate.getTime();
    const diffDays = (actualTime - expectedTime) / (1000 * 60 * 60 * 24);

    if (diffDays <= -1) return 5; // Early delivery
    if (diffDays <= 0) return 4.5; // On time
    if (diffDays <= 2) return 4; // Slightly late
    if (diffDays <= 5) return 3; // Moderately late
    if (diffDays <= 10) return 2; // Late
    return 1; // Very late
  }

  // Calculate quality performance score
  private calculateQualityScore(qualityStatus?: string): number {
    switch (qualityStatus) {
      case 'passed': return 5;
      case 'partial': return 3;
      case 'failed': return 1;
      default: return 3; // pending or unknown
    }
  }

  // Get procurement dashboard data
  async getProcurementDashboard(
    branchId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<ProcurementDashboard> {
    try {
      const db = DatabaseConnection.getInstance();

      let whereClause = 'WHERE 1=1';
      const values = [];
      let paramCount = 1;

      if (branchId) {
        whereClause += ` AND po.branch_id = $${paramCount}`;
        values.push(branchId);
        paramCount++;
      }

      if (dateFrom) {
        whereClause += ` AND po.order_date >= $${paramCount}`;
        values.push(dateFrom);
        paramCount++;
      }

      if (dateTo) {
        whereClause += ` AND po.order_date <= $${paramCount}`;
        values.push(dateTo);
        paramCount++;
      }

      const query = `
        WITH dashboard_stats AS (
          SELECT 
            COUNT(*) FILTER (WHERE po.status = 'pending_approval') as pending_approvals,
            COUNT(*) FILTER (WHERE po.status IN ('in_transit', 'confirmed_by_supplier')) as orders_in_transit,
            COUNT(*) FILTER (WHERE po.status NOT IN ('completed', 'cancelled') 
              AND po.expected_delivery_date < CURRENT_DATE) as overdue_deliveries,
            COALESCE(SUM(po.total_amount) FILTER (WHERE 
              po.order_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) as monthly_spend
          FROM purchase_orders po
          ${whereClause}
        ),
        top_suppliers AS (
          SELECT 
            s.id as supplier_id,
            s.company_name as supplier_name,
            COALESCE(SUM(po.total_amount) FILTER (WHERE 
              po.order_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) as monthly_value,
            COUNT(po.id) FILTER (WHERE 
              po.order_date >= DATE_TRUNC('month', CURRENT_DATE)) as order_count,
            COALESCE(AVG(se.overall_rating), s.quality_rating) as rating
          FROM suppliers s
          LEFT JOIN purchase_orders po ON s.id = po.supplier_id ${whereClause.replace('WHERE 1=1', '')}
          LEFT JOIN supplier_evaluations se ON s.id = se.supplier_id
          GROUP BY s.id, s.company_name, s.quality_rating
          ORDER BY monthly_value DESC
          LIMIT 5
        ),
        recent_orders AS (
          SELECT 
            po.po_number,
            s.company_name as supplier_name,
            po.total_amount,
            po.status,
            po.order_date
          FROM purchase_orders po
          JOIN suppliers s ON po.supplier_id = s.id
          ${whereClause}
          ORDER BY po.order_date DESC
          LIMIT 10
        ),
        urgent_orders AS (
          SELECT 
            po.po_number,
            s.company_name as supplier_name,
            po.required_date,
            po.status
          FROM purchase_orders po
          JOIN suppliers s ON po.supplier_id = s.id
          WHERE po.urgency IN ('high', 'urgent')
          AND po.status NOT IN ('completed', 'cancelled')
          ${whereClause.replace('WHERE 1=1', 'AND 1=1')}
          ORDER BY po.required_date ASC
          LIMIT 10
        )
        SELECT 
          ds.*,
          (SELECT json_agg(ts.*) FROM top_suppliers ts) as top_suppliers,
          (SELECT json_agg(ro.*) FROM recent_orders ro) as recent_orders,
          (SELECT json_agg(uo.*) FROM urgent_orders uo) as urgent_orders
        FROM dashboard_stats ds
      `;

      const result = await db.query(query, values);
      const data = result.rows[0] || {};

      return {
        pendingApprovals: parseInt(data.pending_approvals) || 0,
        ordersInTransit: parseInt(data.orders_in_transit) || 0,
        overdueDeliveries: parseInt(data.overdue_deliveries) || 0,
        monthlySpend: parseFloat(data.monthly_spend) || 0,
        topSuppliers: data.top_suppliers || [],
        recentOrders: data.recent_orders || [],
        urgentOrders: data.urgent_orders || []
      };

    } catch (error) {
      logger.error('Error getting procurement dashboard:', error);
      throw error;
    }
  }

  // Get supplier performance report
  async getSupplierPerformanceReport(
    supplierId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<SupplierPerformanceReport> {
    try {
      const supplier = await this.supplier.getById(supplierId);
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const stats = await this.supplier.getPerformanceStats(
        supplierId,
        dateFrom,
        dateTo
      );

      // Get monthly trends
      const db = DatabaseConnection.getInstance();
      const trendsQuery = `
        SELECT 
          TO_CHAR(po.order_date, 'YYYY-MM') as month,
          COUNT(po.id) as orders,
          COALESCE(SUM(po.total_amount), 0) as value,
          (COUNT(*) FILTER (WHERE po.actual_delivery_date <= po.expected_delivery_date)::DECIMAL /
           NULLIF(COUNT(*) FILTER (WHERE po.actual_delivery_date IS NOT NULL), 0) * 100) as on_time_rate,
          COALESCE(AVG(CASE gr.quality_check_status 
            WHEN 'passed' THEN 5 
            WHEN 'partial' THEN 3 
            WHEN 'failed' THEN 1 
            ELSE 3 END), 3) as quality_score
        FROM purchase_orders po
        LEFT JOIN goods_receipts gr ON po.id = gr.purchase_order_id
        WHERE po.supplier_id = $1
        AND po.status = 'completed'
        AND ($2 IS NULL OR po.order_date >= $2)
        AND ($3 IS NULL OR po.order_date <= $3)
        GROUP BY TO_CHAR(po.order_date, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `;

      const trendsResult = await db.query(trendsQuery, [supplierId, dateFrom, dateTo]);

      return {
        supplierId,
        supplierName: supplier.companyName,
        totalOrders: stats.totalOrders,
        totalValue: stats.totalValue,
        averageLeadTime: stats.averageLeadTime,
        onTimeDeliveryRate: stats.onTimeDeliveryRate,
        qualityScore: supplier.qualityRating,
        priceCompetitiveness: supplier.priceCompetitiveness,
        overallRating: (supplier.qualityRating + supplier.deliveryRating + supplier.priceCompetitiveness) / 3,
        lastEvaluationDate: stats.lastOrderDate,
        trends: trendsResult.rows.map(row => ({
          month: row.month,
          orders: parseInt(row.orders),
          value: parseFloat(row.value),
          onTimeRate: parseFloat(row.on_time_rate) || 0,
          qualityScore: parseFloat(row.quality_score) || 3
        }))
      };

    } catch (error) {
      logger.error('Error getting supplier performance report:', error);
      throw error;
    }
  }

  // Get purchase orders with filters
  async getPurchaseOrders(
    filters: PurchaseOrderFilters
  ): Promise<{ orders: any[]; total: number }> {
    try {
      const db = DatabaseConnection.getInstance();

      let whereClause = 'WHERE 1=1';
      const values = [];
      let paramCount = 1;

      if (filters.status && filters.status.length > 0) {
        whereClause += ` AND po.status = ANY($${paramCount})`;
        values.push(filters.status);
        paramCount++;
      }

      if (filters.supplierId) {
        whereClause += ` AND po.supplier_id = $${paramCount}`;
        values.push(filters.supplierId);
        paramCount++;
      }

      if (filters.branchId) {
        whereClause += ` AND po.branch_id = $${paramCount}`;
        values.push(filters.branchId);
        paramCount++;
      }

      if (filters.dateFrom) {
        whereClause += ` AND po.order_date >= $${paramCount}`;
        values.push(filters.dateFrom);
        paramCount++;
      }

      if (filters.dateTo) {
        whereClause += ` AND po.order_date <= $${paramCount}`;
        values.push(filters.dateTo);
        paramCount++;
      }

      if (filters.urgency && filters.urgency.length > 0) {
        whereClause += ` AND po.urgency = ANY($${paramCount})`;
        values.push(filters.urgency);
        paramCount++;
      }

      if (filters.amountMin !== undefined) {
        whereClause += ` AND po.total_amount >= $${paramCount}`;
        values.push(filters.amountMin);
        paramCount++;
      }

      if (filters.amountMax !== undefined) {
        whereClause += ` AND po.total_amount <= $${paramCount}`;
        values.push(filters.amountMax);
        paramCount++;
      }

      if (filters.requestedBy) {
        whereClause += ` AND po.requested_by = $${paramCount}`;
        values.push(filters.requestedBy);
        paramCount++;
      }

      if (filters.search) {
        whereClause += ` AND (
          po.po_number ILIKE $${paramCount} OR
          s.company_name ILIKE $${paramCount} OR
          po.notes ILIKE $${paramCount}
        )`;
        values.push(`%${filters.search}%`);
        paramCount++;
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        ${whereClause}
      `;

      const countResult = await db.query(countQuery, values);
      const total = parseInt(countResult.rows[0].total);

      // Get orders
      const query = `
        SELECT 
          po.*,
          s.company_name as supplier_name,
          b.name as branch_name,
          u.username as requested_by_name
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        JOIN branches b ON po.branch_id = b.id
        JOIN users u ON po.requested_by = u.id
        ${whereClause}
        ORDER BY po.order_date DESC, po.created_at DESC
      `;

      const result = await db.query(query, values);

      return {
        orders: result.rows,
        total
      };

    } catch (error) {
      logger.error('Error getting purchase orders:', error);
      throw error;
    }
  }
}

export default ProcurementManagementService;