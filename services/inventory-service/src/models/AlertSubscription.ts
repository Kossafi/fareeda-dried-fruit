import { BaseModel } from './BaseModel';
import DatabaseConnection from '../database/connection';
import { AlertSubscription as IAlertSubscription, AlertType, AlertSeverity, NotificationChannel, DigestFrequency } from '@dried-fruits/types';

export class AlertSubscription extends BaseModel implements IAlertSubscription {
  public userId!: string;
  public alertTypes!: AlertType[];
  public severityLevels!: AlertSeverity[];
  public branchIds?: string[];
  public categoryIds?: string[];
  public emailEnabled!: boolean;
  public inAppEnabled!: boolean;
  public smsEnabled!: boolean;
  public pushEnabled!: boolean;
  public immediateDelivery!: boolean;
  public digestFrequency!: DigestFrequency;
  public quietHoursStart?: string;
  public quietHoursEnd?: string;
  public timezone!: string;
  public isActive!: boolean;

  protected tableName = 'alert_subscriptions';

  constructor(data?: Partial<IAlertSubscription>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  // Create or update user subscription
  async upsert(subscriptionData: {
    userId: string;
    alertTypes?: AlertType[];
    severityLevels?: AlertSeverity[];
    branchIds?: string[];
    categoryIds?: string[];
    emailEnabled?: boolean;
    inAppEnabled?: boolean;
    smsEnabled?: boolean;
    pushEnabled?: boolean;
    immediateDelivery?: boolean;
    digestFrequency?: DigestFrequency;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    timezone?: string;
  }): Promise<AlertSubscription> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      INSERT INTO alert_subscriptions (
        user_id, alert_types, severity_levels, branch_ids, category_ids,
        email_enabled, in_app_enabled, sms_enabled, push_enabled,
        immediate_delivery, digest_frequency, quiet_hours_start, 
        quiet_hours_end, timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (user_id) 
      DO UPDATE SET
        alert_types = EXCLUDED.alert_types,
        severity_levels = EXCLUDED.severity_levels,
        branch_ids = EXCLUDED.branch_ids,
        category_ids = EXCLUDED.category_ids,
        email_enabled = EXCLUDED.email_enabled,
        in_app_enabled = EXCLUDED.in_app_enabled,
        sms_enabled = EXCLUDED.sms_enabled,
        push_enabled = EXCLUDED.push_enabled,
        immediate_delivery = EXCLUDED.immediate_delivery,
        digest_frequency = EXCLUDED.digest_frequency,
        quiet_hours_start = EXCLUDED.quiet_hours_start,
        quiet_hours_end = EXCLUDED.quiet_hours_end,
        timezone = EXCLUDED.timezone,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      subscriptionData.userId,
      subscriptionData.alertTypes || ['low_stock', 'out_of_stock'],
      subscriptionData.severityLevels || ['medium', 'high', 'critical'],
      subscriptionData.branchIds || null,
      subscriptionData.categoryIds || null,
      subscriptionData.emailEnabled ?? true,
      subscriptionData.inAppEnabled ?? true,
      subscriptionData.smsEnabled ?? false,
      subscriptionData.pushEnabled ?? true,
      subscriptionData.immediateDelivery ?? true,
      subscriptionData.digestFrequency || 'immediate',
      subscriptionData.quietHoursStart || null,
      subscriptionData.quietHoursEnd || null,
      subscriptionData.timezone || 'Asia/Bangkok'
    ];

    const result = await db.query(query, values);
    const subscription = new AlertSubscription(result.rows[0]);
    
    console.log(`Alert subscription updated for user ${subscriptionData.userId}`);
    
    return subscription;
  }

  // Get subscription by user ID
  async getByUserId(userId: string): Promise<AlertSubscription | null> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      SELECT * FROM alert_subscriptions
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return new AlertSubscription(result.rows[0]);
  }

  // Get all active subscriptions
  async getActiveSubscriptions(): Promise<AlertSubscription[]> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      SELECT asub.*, u.username, u.email, u.phone
      FROM alert_subscriptions asub
      JOIN users u ON asub.user_id = u.id
      WHERE asub.is_active = true
      ORDER BY asub.updated_at DESC
    `;

    const result = await db.query(query);
    
    return result.rows.map(row => new AlertSubscription(row));
  }

  // Get subscriptions that match alert criteria
  async getMatchingSubscriptions(alert: {
    alertType: AlertType;
    severity: AlertSeverity;
    branchId: string;
    categoryId?: string;
  }): Promise<Array<AlertSubscription & { userEmail: string; userPhone?: string; username: string }>> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      SELECT 
        asub.*,
        u.username,
        u.email as user_email,
        u.phone as user_phone
      FROM alert_subscriptions asub
      JOIN users u ON asub.user_id = u.id
      WHERE asub.is_active = true
      AND $1 = ANY(asub.alert_types)
      AND $2 = ANY(asub.severity_levels)
      AND (asub.branch_ids IS NULL OR $3 = ANY(asub.branch_ids))
      AND (asub.category_ids IS NULL OR $4 = ANY(asub.category_ids) OR $4 IS NULL)
    `;

    const result = await db.query(query, [
      alert.alertType,
      alert.severity,
      alert.branchId,
      alert.categoryId || null
    ]);
    
    return result.rows.map(row => new AlertSubscription(row) as AlertSubscription & { 
      userEmail: string; 
      userPhone?: string; 
      username: string;
    });
  }

  // Get users who should receive notifications for a specific channel
  async getUsersForChannel(
    channel: NotificationChannel,
    alert: {
      alertType: AlertType;
      severity: AlertSeverity;
      branchId: string;
      categoryId?: string;
    }
  ): Promise<Array<{
    userId: string;
    username: string;
    email?: string;
    phone?: string;
    digestFrequency: DigestFrequency;
    timezone: string;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  }>> {
    const db = DatabaseConnection.getInstance();
    
    const channelColumn = this.getChannelColumn(channel);
    
    const query = `
      SELECT 
        asub.user_id,
        u.username,
        u.email,
        u.phone,
        asub.digest_frequency,
        asub.timezone,
        asub.quiet_hours_start,
        asub.quiet_hours_end
      FROM alert_subscriptions asub
      JOIN users u ON asub.user_id = u.id
      WHERE asub.is_active = true
      AND asub.${channelColumn} = true
      AND $1 = ANY(asub.alert_types)
      AND $2 = ANY(asub.severity_levels)
      AND (asub.branch_ids IS NULL OR $3 = ANY(asub.branch_ids))
      AND (asub.category_ids IS NULL OR $4 = ANY(asub.category_ids) OR $4 IS NULL)
    `;

    const result = await db.query(query, [
      alert.alertType,
      alert.severity,
      alert.branchId,
      alert.categoryId || null
    ]);
    
    return result.rows;
  }

  // Subscribe user to specific alert types
  async subscribeToAlertTypes(userId: string, alertTypes: AlertType[]): Promise<AlertSubscription> {
    const existing = await this.getByUserId(userId);
    
    if (existing) {
      // Merge with existing alert types
      const mergedTypes = [...new Set([...existing.alertTypes, ...alertTypes])];
      return await this.upsert({
        userId,
        alertTypes: mergedTypes
      });
    } else {
      // Create new subscription
      return await this.upsert({
        userId,
        alertTypes
      });
    }
  }

  // Unsubscribe user from specific alert types
  async unsubscribeFromAlertTypes(userId: string, alertTypes: AlertType[]): Promise<AlertSubscription> {
    const existing = await this.getByUserId(userId);
    
    if (!existing) {
      throw new Error('User subscription not found');
    }

    const filteredTypes = existing.alertTypes.filter(type => !alertTypes.includes(type));
    
    return await this.upsert({
      userId,
      alertTypes: filteredTypes
    });
  }

  // Update channel preferences
  async updateChannelPreferences(userId: string, preferences: {
    emailEnabled?: boolean;
    inAppEnabled?: boolean;
    smsEnabled?: boolean;
    pushEnabled?: boolean;
    digestFrequency?: DigestFrequency;
  }): Promise<AlertSubscription> {
    const existing = await this.getByUserId(userId);
    
    if (!existing) {
      throw new Error('User subscription not found');
    }

    return await this.upsert({
      userId,
      ...preferences
    });
  }

  // Set quiet hours
  async setQuietHours(userId: string, startTime: string, endTime: string, timezone?: string): Promise<AlertSubscription> {
    const existing = await this.getByUserId(userId);
    
    if (!existing) {
      throw new Error('User subscription not found');
    }

    return await this.upsert({
      userId,
      quietHoursStart: startTime,
      quietHoursEnd: endTime,
      timezone: timezone || existing.timezone
    });
  }

  // Check if user is in quiet hours
  async isInQuietHours(userId: string): Promise<boolean> {
    const subscription = await this.getByUserId(userId);
    
    if (!subscription || !subscription.quietHoursStart || !subscription.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const userTimezone = subscription.timezone || 'Asia/Bangkok';
    
    // Convert current time to user's timezone
    const userTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: userTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    const currentTime = userTime.replace(':', '');
    const quietStart = subscription.quietHoursStart.replace(':', '');
    const quietEnd = subscription.quietHoursEnd.replace(':', '');

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (quietStart > quietEnd) {
      return currentTime >= quietStart || currentTime <= quietEnd;
    } else {
      return currentTime >= quietStart && currentTime <= quietEnd;
    }
  }

  // Deactivate subscription
  async deactivate(userId: string): Promise<AlertSubscription> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      UPDATE alert_subscriptions 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `;

    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User subscription not found');
    }

    return new AlertSubscription(result.rows[0]);
  }

  // Reactivate subscription
  async activate(userId: string): Promise<AlertSubscription> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      UPDATE alert_subscriptions 
      SET is_active = true, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `;

    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User subscription not found');
    }

    return new AlertSubscription(result.rows[0]);
  }

  // Get subscription statistics
  async getSubscriptionStatistics(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    channelStats: {
      email: number;
      inApp: number;
      sms: number;
      push: number;
    };
    frequencyStats: Array<{
      frequency: DigestFrequency;
      count: number;
    }>;
  }> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      SELECT 
        COUNT(*) as total_subscriptions,
        COUNT(*) FILTER (WHERE is_active = true) as active_subscriptions,
        COUNT(*) FILTER (WHERE email_enabled = true AND is_active = true) as email_enabled,
        COUNT(*) FILTER (WHERE in_app_enabled = true AND is_active = true) as in_app_enabled,
        COUNT(*) FILTER (WHERE sms_enabled = true AND is_active = true) as sms_enabled,
        COUNT(*) FILTER (WHERE push_enabled = true AND is_active = true) as push_enabled,
        json_agg(
          DISTINCT jsonb_build_object(
            'frequency', freq_stats.digest_frequency,
            'count', freq_stats.count
          )
        ) as frequency_stats
      FROM alert_subscriptions asub
      LEFT JOIN (
        SELECT digest_frequency, COUNT(*) as count
        FROM alert_subscriptions
        WHERE is_active = true
        GROUP BY digest_frequency
      ) freq_stats ON asub.digest_frequency = freq_stats.digest_frequency
    `;

    const result = await db.query(query);
    const row = result.rows[0] || {};
    
    return {
      totalSubscriptions: parseInt(row.total_subscriptions) || 0,
      activeSubscriptions: parseInt(row.active_subscriptions) || 0,
      channelStats: {
        email: parseInt(row.email_enabled) || 0,
        inApp: parseInt(row.in_app_enabled) || 0,
        sms: parseInt(row.sms_enabled) || 0,
        push: parseInt(row.push_enabled) || 0
      },
      frequencyStats: row.frequency_stats || []
    };
  }

  // Helper method to get database column name for notification channel
  private getChannelColumn(channel: NotificationChannel): string {
    switch (channel) {
      case 'email':
        return 'email_enabled';
      case 'sms':
        return 'sms_enabled';
      case 'push':
        return 'push_enabled';
      case 'in_app':
        return 'in_app_enabled';
      default:
        throw new Error(`Unknown notification channel: ${channel}`);
    }
  }
}

export default AlertSubscription;