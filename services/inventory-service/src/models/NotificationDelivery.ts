import { BaseModel } from './BaseModel';
import DatabaseConnection from '../database/connection';
import { NotificationDelivery as INotificationDelivery, NotificationChannel, DeliveryStatus } from '@dried-fruits/types';

export class NotificationDelivery extends BaseModel implements INotificationDelivery {
  public stockAlertId!: string;
  public userId!: string;
  public channel!: NotificationChannel;
  public status!: DeliveryStatus;
  public subject?: string;
  public message!: string;
  public recipientAddress?: string;
  public sentAt?: Date;
  public deliveredAt?: Date;
  public readAt?: Date;
  public errorMessage?: string;
  public retryCount!: number;
  public maxRetries!: number;
  public provider?: string;
  public providerMessageId?: string;
  public deliveryMetadata?: any;

  protected tableName = 'notification_deliveries';

  constructor(data?: Partial<INotificationDelivery>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  // Create new notification delivery
  async create(deliveryData: {
    stockAlertId: string;
    userId: string;
    channel: NotificationChannel;
    subject?: string;
    message: string;
    recipientAddress?: string;
    provider?: string;
  }): Promise<NotificationDelivery> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      INSERT INTO notification_deliveries (
        stock_alert_id, user_id, channel, subject, message, 
        recipient_address, provider
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      deliveryData.stockAlertId,
      deliveryData.userId,
      deliveryData.channel,
      deliveryData.subject || null,
      deliveryData.message,
      deliveryData.recipientAddress || null,
      deliveryData.provider || null
    ];

    const result = await db.query(query, values);
    const delivery = new NotificationDelivery(result.rows[0]);
    
    console.log(`Notification delivery created: ${delivery.id} via ${deliveryData.channel}`);
    
    return delivery;
  }

  // Mark as sent
  async markAsSent(id: string, providerMessageId?: string): Promise<NotificationDelivery> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      UPDATE notification_deliveries 
      SET 
        status = 'sent',
        sent_at = CURRENT_TIMESTAMP,
        provider_message_id = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id, providerMessageId || null]);
    
    if (result.rows.length === 0) {
      throw new Error('Notification delivery not found');
    }

    return new NotificationDelivery(result.rows[0]);
  }

  // Mark as delivered
  async markAsDelivered(id: string, deliveryMetadata?: any): Promise<NotificationDelivery> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      UPDATE notification_deliveries 
      SET 
        status = 'delivered',
        delivered_at = CURRENT_TIMESTAMP,
        delivery_metadata = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id, deliveryMetadata ? JSON.stringify(deliveryMetadata) : null]);
    
    if (result.rows.length === 0) {
      throw new Error('Notification delivery not found');
    }

    return new NotificationDelivery(result.rows[0]);
  }

  // Mark as read
  async markAsRead(id: string): Promise<NotificationDelivery> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      UPDATE notification_deliveries 
      SET 
        read_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Notification delivery not found');
    }

    return new NotificationDelivery(result.rows[0]);
  }

  // Mark as failed
  async markAsFailed(id: string, errorMessage: string): Promise<NotificationDelivery> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      UPDATE notification_deliveries 
      SET 
        status = 'failed',
        error_message = $2,
        retry_count = retry_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id, errorMessage]);
    
    if (result.rows.length === 0) {
      throw new Error('Notification delivery not found');
    }

    return new NotificationDelivery(result.rows[0]);
  }

  // Get pending deliveries
  async getPendingDeliveries(channel?: NotificationChannel, limit?: number): Promise<NotificationDelivery[]> {
    const db = DatabaseConnection.getInstance();
    
    let whereClause = "WHERE status = 'pending' AND retry_count < max_retries";
    const values = [];
    let paramCount = 1;

    if (channel) {
      whereClause += ` AND channel = $${paramCount}`;
      values.push(channel);
      paramCount++;
    }

    let limitClause = '';
    if (limit) {
      limitClause = ` LIMIT $${paramCount}`;
      values.push(limit);
    }

    const query = `
      SELECT * FROM notification_deliveries
      ${whereClause}
      ORDER BY created_at ASC
      ${limitClause}
    `;

    const result = await db.query(query, values);
    
    return result.rows.map(row => new NotificationDelivery(row));
  }

  // Get failed deliveries that can be retried
  async getRetryableDeliveries(channel?: NotificationChannel, limit?: number): Promise<NotificationDelivery[]> {
    const db = DatabaseConnection.getInstance();
    
    let whereClause = "WHERE status = 'failed' AND retry_count < max_retries";
    const values = [];
    let paramCount = 1;

    if (channel) {
      whereClause += ` AND channel = $${paramCount}`;
      values.push(channel);
      paramCount++;
    }

    let limitClause = '';
    if (limit) {
      limitClause = ` LIMIT $${paramCount}`;
      values.push(limit);
    }

    const query = `
      SELECT * FROM notification_deliveries
      ${whereClause}
      AND updated_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
      ORDER BY retry_count ASC, updated_at ASC
      ${limitClause}
    `;

    const result = await db.query(query, values);
    
    return result.rows.map(row => new NotificationDelivery(row));
  }

  // Get deliveries for a user
  async getByUserId(userId: string, filters?: {
    channel?: NotificationChannel;
    status?: DeliveryStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ deliveries: NotificationDelivery[]; total: number }> {
    const db = DatabaseConnection.getInstance();
    
    let whereClause = 'WHERE nd.user_id = $1';
    const values = [userId];
    let paramCount = 2;

    if (filters?.channel) {
      whereClause += ` AND nd.channel = $${paramCount}`;
      values.push(filters.channel);
      paramCount++;
    }

    if (filters?.status) {
      whereClause += ` AND nd.status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM notification_deliveries nd
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Get deliveries with pagination
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
        nd.*,
        sa.alert_number,
        sa.alert_type,
        sa.severity,
        sa.title as alert_title
      FROM notification_deliveries nd
      JOIN stock_alerts sa ON nd.stock_alert_id = sa.id
      ${whereClause}
      ORDER BY nd.created_at DESC
      ${limitClause}
    `;

    const result = await db.query(query, values);
    const deliveries = result.rows.map(row => new NotificationDelivery(row));

    return { deliveries, total };
  }

  // Get deliveries for an alert
  async getByAlertId(alertId: string): Promise<NotificationDelivery[]> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      SELECT 
        nd.*,
        u.username,
        u.email,
        u.phone
      FROM notification_deliveries nd
      JOIN users u ON nd.user_id = u.id
      WHERE nd.stock_alert_id = $1
      ORDER BY nd.created_at DESC
    `;

    const result = await db.query(query, [alertId]);
    
    return result.rows.map(row => new NotificationDelivery(row));
  }

  // Bulk create deliveries
  async bulkCreate(deliveries: Array<{
    stockAlertId: string;
    userId: string;
    channel: NotificationChannel;
    subject?: string;
    message: string;
    recipientAddress?: string;
    provider?: string;
  }>): Promise<NotificationDelivery[]> {
    const db = DatabaseConnection.getInstance();
    
    const values = [];
    const placeholders = [];
    let paramCount = 1;

    for (let i = 0; i < deliveries.length; i++) {
      const delivery = deliveries[i];
      placeholders.push(`($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6})`);
      values.push(
        delivery.stockAlertId,
        delivery.userId,
        delivery.channel,
        delivery.subject || null,
        delivery.message,
        delivery.recipientAddress || null,
        delivery.provider || null
      );
      paramCount += 7;
    }

    const query = `
      INSERT INTO notification_deliveries (
        stock_alert_id, user_id, channel, subject, message, recipient_address, provider
      ) VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await db.query(query, values);
    
    return result.rows.map(row => new NotificationDelivery(row));
  }

  // Cancel pending deliveries for an alert
  async cancelPendingForAlert(alertId: string): Promise<number> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      UPDATE notification_deliveries 
      SET 
        status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP
      WHERE stock_alert_id = $1 AND status = 'pending'
    `;

    const result = await db.query(query, [alertId]);
    
    return result.rowCount;
  }

  // Get delivery statistics
  async getDeliveryStatistics(dateRange?: { startDate: Date; endDate: Date }): Promise<{
    totalDeliveries: number;
    deliveriesByChannel: Array<{ channel: string; count: number; successRate: number }>;
    deliveriesByStatus: Array<{ status: string; count: number }>;
    averageDeliveryTime: number;
    failureReasons: Array<{ reason: string; count: number }>;
  }> {
    const db = DatabaseConnection.getInstance();
    
    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (dateRange) {
      whereClause += ` AND nd.created_at BETWEEN $${paramCount} AND $${paramCount + 1}`;
      values.push(dateRange.startDate, dateRange.endDate);
      paramCount += 2;
    }

    const query = `
      WITH delivery_stats AS (
        SELECT 
          COUNT(*) as total_deliveries,
          AVG(
            CASE WHEN nd.delivered_at IS NOT NULL AND nd.sent_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (nd.delivered_at - nd.sent_at))/60 
            END
          ) as avg_delivery_minutes
        FROM notification_deliveries nd
        ${whereClause}
      ),
      channel_stats AS (
        SELECT 
          nd.channel,
          COUNT(*) as count,
          ROUND(
            (COUNT(*) FILTER (WHERE nd.status = 'delivered') * 100.0 / COUNT(*)), 2
          ) as success_rate
        FROM notification_deliveries nd
        ${whereClause}
        GROUP BY nd.channel
      ),
      status_stats AS (
        SELECT 
          nd.status,
          COUNT(*) as count
        FROM notification_deliveries nd
        ${whereClause}
        GROUP BY nd.status
      ),
      failure_stats AS (
        SELECT 
          COALESCE(nd.error_message, 'Unknown') as reason,
          COUNT(*) as count
        FROM notification_deliveries nd
        ${whereClause}
        AND nd.status = 'failed'
        GROUP BY nd.error_message
        ORDER BY COUNT(*) DESC
        LIMIT 10
      )
      SELECT 
        ds.total_deliveries,
        ds.avg_delivery_minutes,
        json_agg(
          DISTINCT jsonb_build_object(
            'channel', cs.channel,
            'count', cs.count,
            'success_rate', cs.success_rate
          )
        ) as deliveries_by_channel,
        json_agg(
          DISTINCT jsonb_build_object(
            'status', ss.status,
            'count', ss.count
          )
        ) as deliveries_by_status,
        json_agg(
          DISTINCT jsonb_build_object(
            'reason', fs.reason,
            'count', fs.count
          )
        ) as failure_reasons
      FROM delivery_stats ds
      CROSS JOIN channel_stats cs
      CROSS JOIN status_stats ss
      CROSS JOIN failure_stats fs
      GROUP BY ds.total_deliveries, ds.avg_delivery_minutes
    `;

    const result = await db.query(query, values);
    const row = result.rows[0] || {};
    
    return {
      totalDeliveries: parseInt(row.total_deliveries) || 0,
      deliveriesByChannel: row.deliveries_by_channel || [],
      deliveriesByStatus: row.deliveries_by_status || [],
      averageDeliveryTime: parseFloat(row.avg_delivery_minutes) || 0,
      failureReasons: row.failure_reasons || []
    };
  }

  // Clean old deliveries
  async cleanOldDeliveries(daysOld: number = 90): Promise<number> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      DELETE FROM notification_deliveries
      WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
      AND status IN ('delivered', 'failed', 'cancelled')
    `;

    const result = await db.query(query, [daysOld]);
    
    console.log(`Cleaned ${result.rowCount} old notification deliveries`);
    
    return result.rowCount;
  }
}

export default NotificationDelivery;