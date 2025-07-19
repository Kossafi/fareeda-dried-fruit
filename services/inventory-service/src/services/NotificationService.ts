import DatabaseConnection from '../database/connection';
import NotificationDelivery from '../models/NotificationDelivery';
import { NotificationChannel, AlertType, AlertSeverity, DeliveryStatus } from '@dried-fruits/types';
import EmailService from './providers/EmailService';
import SMSService from './providers/SMSService';
import PushNotificationService from './providers/PushNotificationService';
import logger from '../utils/logger';

interface NotificationData {
  stockAlertId: string;
  userId: string;
  channel: NotificationChannel;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  recipientEmail?: string;
  recipientPhone?: string;
  deviceTokens?: string[];
}

export class NotificationService {
  private emailService: EmailService;
  private smsService: SMSService;
  private pushService: PushNotificationService;

  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
    this.pushService = new PushNotificationService();
  }

  // Create and queue notification for delivery
  async createNotification(notificationData: NotificationData): Promise<NotificationDelivery> {
    try {
      const delivery = new NotificationDelivery();

      // Get notification template and customize message
      const { subject, customizedMessage } = await this.getCustomizedContent(
        notificationData.alertType,
        notificationData.channel,
        notificationData.title,
        notificationData.message,
        notificationData
      );

      // Determine recipient address based on channel
      let recipientAddress: string | undefined;
      switch (notificationData.channel) {
        case 'email':
          recipientAddress = notificationData.recipientEmail;
          break;
        case 'sms':
          recipientAddress = notificationData.recipientPhone;
          break;
        case 'push':
          recipientAddress = notificationData.deviceTokens?.join(',');
          break;
        case 'in_app':
          recipientAddress = notificationData.userId; // For in-app, use user ID
          break;
      }

      // Create notification delivery record
      const createdDelivery = await delivery.create({
        stockAlertId: notificationData.stockAlertId,
        userId: notificationData.userId,
        channel: notificationData.channel,
        subject: subject,
        message: customizedMessage,
        recipientAddress: recipientAddress,
        provider: this.getProviderName(notificationData.channel)
      });

      // Process immediately for critical alerts, otherwise queue
      if (notificationData.severity === 'critical') {
        await this.processNotification(createdDelivery);
      } else {
        // Queue for batch processing
        await this.queueNotification(createdDelivery);
      }

      return createdDelivery;

    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  // Process individual notification
  async processNotification(delivery: NotificationDelivery): Promise<void> {
    try {
      let success = false;
      let errorMessage = '';
      let providerMessageId = '';

      switch (delivery.channel) {
        case 'email':
          try {
            const result = await this.emailService.sendEmail({
              to: delivery.recipientAddress!,
              subject: delivery.subject!,
              text: delivery.message,
              html: this.generateHTMLMessage(delivery.message)
            });
            success = result.success;
            errorMessage = result.error || '';
            providerMessageId = result.messageId || '';
          } catch (error) {
            errorMessage = error.message;
          }
          break;

        case 'sms':
          try {
            const result = await this.smsService.sendSMS({
              to: delivery.recipientAddress!,
              message: delivery.message
            });
            success = result.success;
            errorMessage = result.error || '';
            providerMessageId = result.messageId || '';
          } catch (error) {
            errorMessage = error.message;
          }
          break;

        case 'push':
          try {
            const deviceTokens = delivery.recipientAddress?.split(',') || [];
            const result = await this.pushService.sendPushNotification({
              deviceTokens,
              title: delivery.subject!,
              body: delivery.message,
              data: {
                alertId: delivery.stockAlertId,
                type: 'stock_alert'
              }
            });
            success = result.success;
            errorMessage = result.error || '';
            providerMessageId = result.messageId || '';
          } catch (error) {
            errorMessage = error.message;
          }
          break;

        case 'in_app':
          // For in-app notifications, we store them and mark as sent
          await this.createInAppNotification(delivery);
          success = true;
          break;

        default:
          errorMessage = `Unsupported notification channel: ${delivery.channel}`;
      }

      // Update delivery status
      if (success) {
        await delivery.markAsSent(delivery.id!, providerMessageId);
        
        // For in-app and some providers, mark as delivered immediately
        if (delivery.channel === 'in_app' || delivery.channel === 'sms') {
          await delivery.markAsDelivered(delivery.id!);
        }
        
        logger.info(`Notification sent successfully: ${delivery.id} via ${delivery.channel}`);
      } else {
        await delivery.markAsFailed(delivery.id!, errorMessage);
        logger.error(`Notification failed: ${delivery.id} via ${delivery.channel} - ${errorMessage}`);
      }

    } catch (error) {
      logger.error(`Error processing notification ${delivery.id}:`, error);
      await delivery.markAsFailed(delivery.id!, error.message);
    }
  }

  // Queue notification for batch processing
  private async queueNotification(delivery: NotificationDelivery): Promise<void> {
    try {
      const db = DatabaseConnection.getInstance();
      
      // Publish to message queue for background processing
      await db.publishEvent('notifications.queue', {
        deliveryId: delivery.id,
        channel: delivery.channel,
        priority: this.getPriority(delivery),
        timestamp: new Date().toISOString()
      });

      logger.info(`Notification queued: ${delivery.id} via ${delivery.channel}`);

    } catch (error) {
      logger.error(`Error queueing notification ${delivery.id}:`, error);
    }
  }

  // Process pending notifications in batch
  async processPendingNotifications(channel?: NotificationChannel, limit: number = 50): Promise<void> {
    try {
      const delivery = new NotificationDelivery();
      const pendingDeliveries = await delivery.getPendingDeliveries(channel, limit);

      logger.info(`Processing ${pendingDeliveries.length} pending notifications`);

      // Process deliveries in parallel with limited concurrency
      const concurrency = 5;
      const chunks = this.chunkArray(pendingDeliveries, concurrency);

      for (const chunk of chunks) {
        await Promise.all(chunk.map(d => this.processNotification(d)));
      }

    } catch (error) {
      logger.error('Error processing pending notifications:', error);
    }
  }

  // Retry failed notifications
  async retryFailedNotifications(channel?: NotificationChannel, limit: number = 20): Promise<void> {
    try {
      const delivery = new NotificationDelivery();
      const retryableDeliveries = await delivery.getRetryableDeliveries(channel, limit);

      logger.info(`Retrying ${retryableDeliveries.length} failed notifications`);

      for (const d of retryableDeliveries) {
        await this.processNotification(d);
      }

    } catch (error) {
      logger.error('Error retrying failed notifications:', error);
    }
  }

  // Get customized notification content using templates
  private async getCustomizedContent(
    alertType: AlertType,
    channel: NotificationChannel,
    defaultTitle: string,
    defaultMessage: string,
    data: NotificationData
  ): Promise<{ subject: string; customizedMessage: string }> {
    try {
      const db = DatabaseConnection.getInstance();
      
      // Get template from database
      const query = `
        SELECT subject_template, message_template, html_template
        FROM notification_templates
        WHERE alert_type = $1 AND channel = $2 AND is_active = true
        ORDER BY is_default DESC, created_at DESC
        LIMIT 1
      `;

      const result = await db.query(query, [alertType, channel]);
      
      if (result.rows.length === 0) {
        // No template found, use defaults
        return {
          subject: defaultTitle,
          customizedMessage: defaultMessage
        };
      }

      const template = result.rows[0];
      
      // Get additional data for template variables
      const templateData = await this.getTemplateData(data.stockAlertId, data.userId);
      
      // Replace template variables
      const subject = this.replaceTemplateVariables(
        template.subject_template || defaultTitle,
        templateData
      );
      
      const customizedMessage = this.replaceTemplateVariables(
        template.message_template || defaultMessage,
        templateData
      );

      return { subject, customizedMessage };

    } catch (error) {
      logger.error('Error getting customized content:', error);
      return {
        subject: defaultTitle,
        customizedMessage: defaultMessage
      };
    }
  }

  // Get data for template variable replacement
  private async getTemplateData(stockAlertId: string, userId: string): Promise<any> {
    try {
      const db = DatabaseConnection.getInstance();
      
      const query = `
        SELECT 
          sa.alert_number,
          sa.alert_type,
          sa.severity,
          sa.current_stock_level,
          sa.threshold_level,
          sa.suggested_reorder_quantity,
          sa.unit,
          sa.title,
          sa.message,
          p.name as product_name,
          p.sku as product_sku,
          b.name as branch_name,
          b.address as branch_address,
          u.username as user_name,
          u.first_name,
          u.last_name
        FROM stock_alerts sa
        JOIN products p ON sa.product_id = p.id
        JOIN branches b ON sa.branch_id = b.id
        JOIN users u ON u.id = $2
        WHERE sa.id = $1
      `;

      const result = await db.query(query, [stockAlertId, userId]);
      
      if (result.rows.length === 0) {
        return {};
      }

      const row = result.rows[0];
      
      return {
        alert_number: row.alert_number,
        alert_type: row.alert_type,
        severity: row.severity,
        current_stock: row.current_stock_level,
        threshold_level: row.threshold_level,
        suggested_quantity: row.suggested_reorder_quantity,
        unit: row.unit,
        product_name: row.product_name,
        product_sku: row.product_sku,
        branch_name: row.branch_name,
        branch_address: row.branch_address,
        user_name: row.user_name || `${row.first_name} ${row.last_name}`.trim(),
        date: new Date().toLocaleDateString('th-TH'),
        time: new Date().toLocaleTimeString('th-TH')
      };

    } catch (error) {
      logger.error('Error getting template data:', error);
      return {};
    }
  }

  // Replace template variables with actual values
  private replaceTemplateVariables(template: string, data: any): string {
    let result = template;
    
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value || ''));
    }
    
    return result;
  }

  // Create in-app notification
  private async createInAppNotification(delivery: NotificationDelivery): Promise<void> {
    try {
      const db = DatabaseConnection.getInstance();
      
      // Store in-app notification in database
      const query = `
        INSERT INTO in_app_notifications (
          user_id, alert_id, title, message, notification_type, is_read, created_at
        ) VALUES ($1, $2, $3, $4, 'stock_alert', false, CURRENT_TIMESTAMP)
      `;

      await db.query(query, [
        delivery.userId,
        delivery.stockAlertId,
        delivery.subject,
        delivery.message
      ]);

      // Send real-time update via WebSocket
      await this.sendRealTimeUpdate(delivery.userId, {
        type: 'stock_alert',
        alertId: delivery.stockAlertId,
        title: delivery.subject,
        message: delivery.message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error creating in-app notification:', error);
      throw error;
    }
  }

  // Send real-time update via WebSocket
  private async sendRealTimeUpdate(userId: string, data: any): Promise<void> {
    try {
      const db = DatabaseConnection.getInstance();
      
      // Publish to WebSocket channel
      await db.publishEvent(`user.${userId}.notifications`, data);

    } catch (error) {
      logger.error('Error sending real-time update:', error);
    }
  }

  // Generate HTML version of message
  private generateHTMLMessage(textMessage: string): string {
    // Convert plain text to basic HTML
    const htmlMessage = textMessage
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
              ${htmlMessage}
            </div>
            <div style="margin-top: 20px; font-size: 12px; color: #666;">
              <p>ระบบจัดการสต๊อคผลไม้อบแห้ง<br>
              อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // Get provider name for channel
  private getProviderName(channel: NotificationChannel): string {
    switch (channel) {
      case 'email': return 'SMTP';
      case 'sms': return 'SMS_PROVIDER';
      case 'push': return 'FCM';
      case 'in_app': return 'WEBSOCKET';
      default: return 'UNKNOWN';
    }
  }

  // Get priority for notification based on severity
  private getPriority(delivery: NotificationDelivery): number {
    // Get severity from alert
    const severity = delivery.message.includes('critical') ? 'critical' :
                    delivery.message.includes('high') ? 'high' :
                    delivery.message.includes('medium') ? 'medium' : 'low';
    
    switch (severity) {
      case 'critical': return 1;
      case 'high': return 2;
      case 'medium': return 3;
      case 'low': return 4;
      default: return 3;
    }
  }

  // Split array into chunks
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Send test notification
  async sendTestNotification(
    userId: string,
    channel: NotificationChannel,
    recipientAddress: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const testNotification: NotificationData = {
        stockAlertId: 'test-alert-id',
        userId: userId,
        channel: channel,
        alertType: 'low_stock',
        severity: 'medium',
        title: 'ทดสอบระบบแจ้งเตือน',
        message: 'นี่คือการทดสอบระบบการแจ้งเตือนสต๊อค กรุณาไม่ต้องดำเนินการใดๆ',
        recipientEmail: channel === 'email' ? recipientAddress : undefined,
        recipientPhone: channel === 'sms' ? recipientAddress : undefined,
        deviceTokens: channel === 'push' ? [recipientAddress] : undefined
      };

      await this.createNotification(testNotification);

      return {
        success: true,
        message: `Test notification sent successfully via ${channel}`
      };

    } catch (error) {
      logger.error('Error sending test notification:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get notification statistics
  async getNotificationStatistics(dateRange?: { startDate: Date; endDate: Date }): Promise<{
    totalNotifications: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    deliveryRate: number;
    channelStats: Array<{ channel: string; sent: number; delivered: number; failed: number }>;
    alertTypeStats: Array<{ alertType: string; count: number }>;
  }> {
    try {
      const delivery = new NotificationDelivery();
      return await delivery.getDeliveryStatistics(dateRange);

    } catch (error) {
      logger.error('Error getting notification statistics:', error);
      throw error;
    }
  }

  // Clean old notifications
  async cleanOldNotifications(daysOld: number = 90): Promise<number> {
    try {
      const delivery = new NotificationDelivery();
      return await delivery.cleanOldDeliveries(daysOld);

    } catch (error) {
      logger.error('Error cleaning old notifications:', error);
      throw error;
    }
  }
}

export default NotificationService;