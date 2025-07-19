import { BaseModel } from './BaseModel';
import DatabaseConnection from '../database/connection';
import { StockAlert as IStockAlert, AlertType, AlertSeverity, AlertStatus, UnitType } from '@dried-fruits/types';

export class StockAlert extends BaseModel implements IStockAlert {
  public alertNumber!: string;
  public alertType!: AlertType;
  public severity!: AlertSeverity;
  public status!: AlertStatus;
  public branchId!: string;
  public productId!: string;
  public inventoryItemId?: string;
  public currentStockLevel!: number;
  public thresholdLevel!: number;
  public suggestedReorderQuantity?: number;
  public unit!: UnitType;
  public title!: string;
  public message!: string;
  public additionalData?: any;
  public triggeredAt!: Date;
  public acknowledgedAt?: Date;
  public acknowledgedBy?: string;
  public resolvedAt?: Date;
  public resolvedBy?: string;
  public expiresAt?: Date;

  protected tableName = 'stock_alerts';

  constructor(data?: Partial<IStockAlert>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  // Create new stock alert
  async create(alertData: {
    alertType: AlertType;
    severity: AlertSeverity;
    branchId: string;
    productId: string;
    inventoryItemId?: string;
    currentStockLevel: number;
    thresholdLevel: number;
    suggestedReorderQuantity?: number;
    unit: UnitType;
    title: string;
    message: string;
    additionalData?: any;
    expiresAt?: Date;
  }): Promise<StockAlert> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      INSERT INTO stock_alerts (
        alert_type, severity, branch_id, product_id, inventory_item_id,
        current_stock_level, threshold_level, suggested_reorder_quantity,
        unit, title, message, additional_data, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      alertData.alertType,
      alertData.severity,
      alertData.branchId,
      alertData.productId,
      alertData.inventoryItemId || null,
      alertData.currentStockLevel,
      alertData.thresholdLevel,
      alertData.suggestedReorderQuantity || null,
      alertData.unit,
      alertData.title,
      alertData.message,
      alertData.additionalData ? JSON.stringify(alertData.additionalData) : null,
      alertData.expiresAt || null
    ];

    const result = await db.query(query, values);
    const alert = new StockAlert(result.rows[0]);
    
    // Publish alert event for real-time notifications
    await this.publishAlertEvent('alert_created', alert);
    
    console.log(`Stock alert created: ${alert.alertNumber} for ${alertData.alertType}`);
    
    return alert;
  }

  // Acknowledge alert
  async acknowledge(id: string, acknowledgedBy: string): Promise<StockAlert> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      UPDATE stock_alerts 
      SET 
        status = 'acknowledged',
        acknowledged_at = CURRENT_TIMESTAMP,
        acknowledged_by = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND status = 'active'
      RETURNING *
    `;

    const result = await db.query(query, [acknowledgedBy, id]);
    
    if (result.rows.length === 0) {
      throw new Error('Alert not found or already acknowledged');
    }

    const alert = new StockAlert(result.rows[0]);
    
    // Publish alert update event
    await this.publishAlertEvent('alert_acknowledged', alert);
    
    return alert;
  }

  // Resolve alert
  async resolve(id: string, resolvedBy: string): Promise<StockAlert> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      UPDATE stock_alerts 
      SET 
        status = 'resolved',
        resolved_at = CURRENT_TIMESTAMP,
        resolved_by = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND status IN ('active', 'acknowledged')
      RETURNING *
    `;

    const result = await db.query(query, [resolvedBy, id]);
    
    if (result.rows.length === 0) {
      throw new Error('Alert not found or already resolved');
    }

    const alert = new StockAlert(result.rows[0]);
    
    // Publish alert update event
    await this.publishAlertEvent('alert_resolved', alert);
    
    return alert;
  }

  // Dismiss alert
  async dismiss(id: string, dismissedBy: string): Promise<StockAlert> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      UPDATE stock_alerts 
      SET 
        status = 'dismissed',
        resolved_at = CURRENT_TIMESTAMP,
        resolved_by = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND status IN ('active', 'acknowledged')
      RETURNING *
    `;

    const result = await db.query(query, [dismissedBy, id]);
    
    if (result.rows.length === 0) {
      throw new Error('Alert not found or already resolved');
    }

    const alert = new StockAlert(result.rows[0]);
    
    // Publish alert update event
    await this.publishAlertEvent('alert_dismissed', alert);
    
    return alert;
  }

  // Get active alerts
  async getActiveAlerts(filters?: {
    branchId?: string;
    productId?: string;
    alertType?: AlertType;
    severity?: AlertSeverity;
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: StockAlert[]; total: number }> {
    const db = DatabaseConnection.getInstance();
    
    let whereClause = "WHERE sa.status IN ('active', 'acknowledged')";
    const values = [];
    let paramCount = 1;

    if (filters?.branchId) {
      whereClause += ` AND sa.branch_id = $${paramCount}`;
      values.push(filters.branchId);
      paramCount++;
    }

    if (filters?.productId) {
      whereClause += ` AND sa.product_id = $${paramCount}`;
      values.push(filters.productId);
      paramCount++;
    }

    if (filters?.alertType) {
      whereClause += ` AND sa.alert_type = $${paramCount}`;
      values.push(filters.alertType);
      paramCount++;
    }

    if (filters?.severity) {
      whereClause += ` AND sa.severity = $${paramCount}`;
      values.push(filters.severity);
      paramCount++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM stock_alerts sa
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Get alerts with pagination
    let limitClause = '';
    if (filters?.limit) {
      limitClause += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
      paramCount++;
      
      if (filters?.offset) {
        limitClause += ` OFFSET $${paramCount}`;
        values.push(filters.offset);
        paramCount++;
      }
    }

    const query = `
      SELECT 
        sa.*,
        b.name as branch_name,
        b.address as branch_address,
        p.name as product_name,
        p.sku as product_sku,
        c.name as category_name,
        ii.batch_number,
        ii.expiration_date,
        u_ack.username as acknowledged_by_username,
        u_res.username as resolved_by_username
      FROM stock_alerts sa
      JOIN branches b ON sa.branch_id = b.id
      JOIN products p ON sa.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory_items ii ON sa.inventory_item_id = ii.id
      LEFT JOIN users u_ack ON sa.acknowledged_by = u_ack.id
      LEFT JOIN users u_res ON sa.resolved_by = u_res.id
      ${whereClause}
      ORDER BY 
        CASE sa.severity 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        sa.triggered_at DESC
      ${limitClause}
    `;

    const result = await db.query(query, values);
    const alerts = result.rows.map(row => new StockAlert(row));

    return { alerts, total };
  }

  // Get alerts for a specific user based on subscriptions
  async getAlertsForUser(userId: string, filters?: {
    status?: AlertStatus[];
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: StockAlert[]; total: number }> {
    const db = DatabaseConnection.getInstance();
    
    let statusFilter = "sa.status IN ('active', 'acknowledged')";
    const values = [userId];
    let paramCount = 2;

    if (filters?.status && filters.status.length > 0) {
      const statusPlaceholders = filters.status.map((_, index) => `$${paramCount + index}`).join(', ');
      statusFilter = `sa.status IN (${statusPlaceholders})`;
      values.push(...filters.status);
      paramCount += filters.status.length;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT sa.id) as total
      FROM stock_alerts sa
      JOIN alert_subscriptions asub ON asub.user_id = $1
      WHERE ${statusFilter}
      AND sa.alert_type = ANY(asub.alert_types)
      AND sa.severity = ANY(asub.severity_levels)
      AND (asub.branch_ids IS NULL OR sa.branch_id = ANY(asub.branch_ids))
      AND asub.is_active = true
    `;

    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Get alerts with pagination
    let limitClause = '';
    if (filters?.limit) {
      limitClause += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
      paramCount++;
      
      if (filters?.offset) {
        limitClause += ` OFFSET $${paramCount}`;
        values.push(filters.offset);
        paramCount++;
      }
    }

    const query = `
      SELECT DISTINCT
        sa.*,
        b.name as branch_name,
        b.address as branch_address,
        p.name as product_name,
        p.sku as product_sku,
        c.name as category_name
      FROM stock_alerts sa
      JOIN alert_subscriptions asub ON asub.user_id = $1
      JOIN branches b ON sa.branch_id = b.id
      JOIN products p ON sa.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${statusFilter}
      AND sa.alert_type = ANY(asub.alert_types)
      AND sa.severity = ANY(asub.severity_levels)
      AND (asub.branch_ids IS NULL OR sa.branch_id = ANY(asub.branch_ids))
      AND asub.is_active = true
      ORDER BY 
        CASE sa.severity 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        sa.triggered_at DESC
      ${limitClause}
    `;

    const result = await db.query(query, values);
    const alerts = result.rows.map(row => new StockAlert(row));

    return { alerts, total };
  }

  // Get alert by ID with full details
  async getById(id: string): Promise<StockAlert | null> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      SELECT 
        sa.*,
        b.name as branch_name,
        b.address as branch_address,
        p.name as product_name,
        p.sku as product_sku,
        c.name as category_name,
        ii.batch_number,
        ii.expiration_date,
        u_ack.username as acknowledged_by_username,
        u_res.username as resolved_by_username
      FROM stock_alerts sa
      JOIN branches b ON sa.branch_id = b.id
      JOIN products p ON sa.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory_items ii ON sa.inventory_item_id = ii.id
      LEFT JOIN users u_ack ON sa.acknowledged_by = u_ack.id
      LEFT JOIN users u_res ON sa.resolved_by = u_res.id
      WHERE sa.id = $1
    `;

    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return new StockAlert(result.rows[0]);
  }

  // Check if similar alert already exists
  async checkExistingAlert(branchId: string, productId: string, alertType: AlertType): Promise<StockAlert | null> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      SELECT * FROM stock_alerts
      WHERE branch_id = $1 
      AND product_id = $2 
      AND alert_type = $3 
      AND status IN ('active', 'acknowledged')
      ORDER BY triggered_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [branchId, productId, alertType]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return new StockAlert(result.rows[0]);
  }

  // Auto-resolve expired alerts
  async autoResolveExpiredAlerts(): Promise<number> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      UPDATE stock_alerts 
      SET 
        status = 'resolved',
        resolved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('active', 'acknowledged')
      AND expires_at IS NOT NULL
      AND expires_at < CURRENT_TIMESTAMP
      RETURNING id
    `;

    const result = await db.query(query);
    
    console.log(`Auto-resolved ${result.rowCount} expired alerts`);
    
    return result.rowCount;
  }

  // Get alert statistics
  async getAlertStatistics(branchId?: string, dateRange?: { startDate: Date; endDate: Date }): Promise<{
    totalAlerts: number;
    activeAlerts: number;
    criticalAlerts: number;
    alertsByType: Array<{ alertType: string; count: number }>;
    alertsBySeverity: Array<{ severity: string; count: number }>;
    topAlertedProducts: Array<{ productName: string; productSku: string; alertCount: number }>;
    resolutionTime: {
      average: number;
      median: number;
    };
  }> {
    const db = DatabaseConnection.getInstance();
    
    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (branchId) {
      whereClause += ` AND sa.branch_id = $${paramCount}`;
      values.push(branchId);
      paramCount++;
    }

    if (dateRange) {
      whereClause += ` AND sa.triggered_at BETWEEN $${paramCount} AND $${paramCount + 1}`;
      values.push(dateRange.startDate, dateRange.endDate);
      paramCount += 2;
    }

    const query = `
      WITH alert_stats AS (
        SELECT 
          COUNT(*) as total_alerts,
          COUNT(*) FILTER (WHERE sa.status IN ('active', 'acknowledged')) as active_alerts,
          COUNT(*) FILTER (WHERE sa.severity = 'critical') as critical_alerts,
          json_agg(
            DISTINCT jsonb_build_object('alert_type', sa.alert_type, 'count', type_counts.count)
          ) as alerts_by_type,
          json_agg(
            DISTINCT jsonb_build_object('severity', sa.severity, 'count', severity_counts.count)
          ) as alerts_by_severity,
          AVG(
            CASE WHEN sa.resolved_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (sa.resolved_at - sa.triggered_at))/3600 
            END
          ) as avg_resolution_hours,
          PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY CASE WHEN sa.resolved_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (sa.resolved_at - sa.triggered_at))/3600 
            END
          ) as median_resolution_hours
        FROM stock_alerts sa
        LEFT JOIN (
          SELECT alert_type, COUNT(*) as count
          FROM stock_alerts sa2
          ${whereClause}
          GROUP BY alert_type
        ) type_counts ON sa.alert_type = type_counts.alert_type
        LEFT JOIN (
          SELECT severity, COUNT(*) as count
          FROM stock_alerts sa3
          ${whereClause}
          GROUP BY severity
        ) severity_counts ON sa.severity = severity_counts.severity
        ${whereClause}
      ),
      top_products AS (
        SELECT 
          p.name as product_name,
          p.sku as product_sku,
          COUNT(*) as alert_count
        FROM stock_alerts sa
        JOIN products p ON sa.product_id = p.id
        ${whereClause}
        GROUP BY p.id, p.name, p.sku
        ORDER BY COUNT(*) DESC
        LIMIT 10
      )
      SELECT 
        ast.*,
        json_agg(
          json_build_object(
            'product_name', tp.product_name,
            'product_sku', tp.product_sku,
            'alert_count', tp.alert_count
          ) ORDER BY tp.alert_count DESC
        ) as top_alerted_products
      FROM alert_stats ast
      CROSS JOIN top_products tp
      GROUP BY ast.total_alerts, ast.active_alerts, ast.critical_alerts, 
               ast.alerts_by_type, ast.alerts_by_severity, 
               ast.avg_resolution_hours, ast.median_resolution_hours
    `;

    const result = await db.query(query, values);
    const row = result.rows[0] || {};
    
    return {
      totalAlerts: parseInt(row.total_alerts) || 0,
      activeAlerts: parseInt(row.active_alerts) || 0,
      criticalAlerts: parseInt(row.critical_alerts) || 0,
      alertsByType: row.alerts_by_type || [],
      alertsBySeverity: row.alerts_by_severity || [],
      topAlertedProducts: row.top_alerted_products || [],
      resolutionTime: {
        average: parseFloat(row.avg_resolution_hours) || 0,
        median: parseFloat(row.median_resolution_hours) || 0
      }
    };
  }

  // Publish alert event for real-time notifications
  private async publishAlertEvent(eventType: string, alert: StockAlert): Promise<void> {
    try {
      const db = DatabaseConnection.getInstance();
      
      const eventData = {
        eventType,
        alert: {
          id: alert.id,
          alertNumber: alert.alertNumber,
          alertType: alert.alertType,
          severity: alert.severity,
          status: alert.status,
          branchId: alert.branchId,
          productId: alert.productId,
          currentStockLevel: alert.currentStockLevel,
          thresholdLevel: alert.thresholdLevel,
          title: alert.title,
          message: alert.message
        },
        timestamp: new Date().toISOString()
      };

      // Publish to Redis/RabbitMQ for real-time notifications
      await db.publishEvent(`alerts.${eventType}`, eventData);
      
    } catch (error) {
      console.error('Failed to publish alert event:', error);
    }
  }
}

export default StockAlert;