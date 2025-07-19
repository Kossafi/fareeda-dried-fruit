import admin from 'firebase-admin';
import { config } from '../../config';
import logger from '../../utils/logger';

interface PushNotificationData {
  deviceTokens: string[];
  title: string;
  body: string;
  data?: { [key: string]: string };
  imageUrl?: string;
  clickAction?: string;
}

interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
  successCount?: number;
  failureCount?: number;
  failedTokens?: string[];
}

export class PushNotificationService {
  private app: admin.app.App | null = null;

  constructor() {
    this.initializeFirebase();
  }

  // Initialize Firebase Admin SDK
  private initializeFirebase(): void {
    try {
      if (!config.firebase.serviceAccountKey) {
        logger.warn('Firebase service account key not configured - push notifications disabled');
        return;
      }

      // Initialize Firebase Admin
      this.app = admin.initializeApp({
        credential: admin.credential.cert(config.firebase.serviceAccountKey),
        projectId: config.firebase.projectId
      }, 'stock-alerts');

      logger.info('Firebase Admin SDK initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Firebase Admin SDK:', error);
    }
  }

  // Send push notification to multiple devices
  async sendPushNotification(notificationData: PushNotificationData): Promise<PushResult> {
    try {
      if (!this.app) {
        throw new Error('Firebase not initialized');
      }

      if (!notificationData.deviceTokens || notificationData.deviceTokens.length === 0) {
        throw new Error('No device tokens provided');
      }

      // Filter out invalid tokens
      const validTokens = notificationData.deviceTokens.filter(token => 
        token && token.length > 0 && this.isValidFCMToken(token)
      );

      if (validTokens.length === 0) {
        throw new Error('No valid device tokens provided');
      }

      // Prepare message
      const message = this.prepareMessage(notificationData, validTokens);

      // Send notification
      const response = await admin.messaging(this.app).sendMulticast(message);

      // Process response
      const result = this.processMulticastResponse(response, validTokens);

      logger.info(`Push notification sent to ${result.successCount}/${validTokens.length} devices`, {
        title: notificationData.title,
        successCount: result.successCount,
        failureCount: result.failureCount
      });

      return result;

    } catch (error) {
      logger.error('Push notification sending error:', error);

      return {
        success: false,
        error: error.message || 'Unknown push notification error'
      };
    }
  }

  // Send push notification to a single device
  async sendSinglePushNotification(
    deviceToken: string,
    title: string,
    body: string,
    data?: { [key: string]: string }
  ): Promise<PushResult> {
    return await this.sendPushNotification({
      deviceTokens: [deviceToken],
      title,
      body,
      data
    });
  }

  // Send push notification to topic
  async sendTopicNotification(
    topic: string,
    title: string,
    body: string,
    data?: { [key: string]: string }
  ): Promise<PushResult> {
    try {
      if (!this.app) {
        throw new Error('Firebase not initialized');
      }

      const message = {
        notification: {
          title,
          body
        },
        data: data || {},
        topic: topic,
        android: {
          notification: {
            sound: 'default',
            priority: 'high' as 'high',
            defaultSound: true
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await admin.messaging(this.app).send(message);

      logger.info(`Topic notification sent successfully to topic '${topic}'`, {
        messageId: response,
        title
      });

      return {
        success: true,
        messageId: response
      };

    } catch (error) {
      logger.error(`Topic notification error for topic '${topic}':`, error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Subscribe device to topic
  async subscribeToTopic(deviceTokens: string[], topic: string): Promise<PushResult> {
    try {
      if (!this.app) {
        throw new Error('Firebase not initialized');
      }

      const response = await admin.messaging(this.app).subscribeToTopic(deviceTokens, topic);

      logger.info(`Subscribed ${response.successCount} devices to topic '${topic}'`, {
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return {
        success: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount
      };

    } catch (error) {
      logger.error(`Topic subscription error for topic '${topic}':`, error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Unsubscribe device from topic
  async unsubscribeFromTopic(deviceTokens: string[], topic: string): Promise<PushResult> {
    try {
      if (!this.app) {
        throw new Error('Firebase not initialized');
      }

      const response = await admin.messaging(this.app).unsubscribeFromTopic(deviceTokens, topic);

      logger.info(`Unsubscribed ${response.successCount} devices from topic '${topic}'`, {
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return {
        success: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount
      };

    } catch (error) {
      logger.error(`Topic unsubscription error for topic '${topic}':`, error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Prepare FCM message
  private prepareMessage(
    notificationData: PushNotificationData,
    deviceTokens: string[]
  ): admin.messaging.MulticastMessage {
    return {
      tokens: deviceTokens,
      notification: {
        title: notificationData.title,
        body: notificationData.body,
        imageUrl: notificationData.imageUrl
      },
      data: notificationData.data || {},
      android: {
        notification: {
          sound: 'default',
          priority: 'high',
          defaultSound: true,
          channelId: 'stock_alerts',
          color: '#FF6B35',
          icon: 'stock_alert_icon',
          clickAction: notificationData.clickAction || 'FLUTTER_NOTIFICATION_CLICK'
        },
        priority: 'high'
      },
      apns: {
        headers: {
          'apns-priority': '10'
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            alert: {
              title: notificationData.title,
              body: notificationData.body
            },
            'content-available': 1
          }
        }
      },
      webpush: {
        notification: {
          title: notificationData.title,
          body: notificationData.body,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          requireInteraction: true,
          actions: [
            {
              action: 'view',
              title: 'ดูรายละเอียด'
            },
            {
              action: 'dismiss',
              title: 'ปิด'
            }
          ]
        },
        fcmOptions: {
          link: notificationData.clickAction || '/'
        }
      }
    };
  }

  // Process multicast response
  private processMulticastResponse(
    response: admin.messaging.BatchResponse,
    deviceTokens: string[]
  ): PushResult {
    const failedTokens: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    response.responses.forEach((resp, idx) => {
      if (resp.success) {
        successCount++;
      } else {
        failureCount++;
        failedTokens.push(deviceTokens[idx]);
        
        // Log specific error for debugging
        logger.warn(`Failed to send push notification to token ${deviceTokens[idx]}:`, {
          error: resp.error?.message,
          code: resp.error?.code
        });
      }
    });

    return {
      success: successCount > 0,
      successCount,
      failureCount,
      failedTokens,
      messageId: response.responses[0]?.messageId
    };
  }

  // Validate FCM token format
  private isValidFCMToken(token: string): boolean {
    // Basic FCM token validation
    // FCM tokens are usually 152+ characters long and contain alphanumeric characters, underscores, hyphens, and colons
    const fcmTokenPattern = /^[A-Za-z0-9_:-]{140,}$/;
    return fcmTokenPattern.test(token);
  }

  // Send templated push notification
  async sendTemplatedPushNotification(
    deviceTokens: string[],
    templateName: string,
    templateData: any
  ): Promise<PushResult> {
    try {
      const template = this.getPushTemplate(templateName);
      
      if (!template) {
        throw new Error(`Push notification template '${templateName}' not found`);
      }

      // Replace template variables
      const title = this.replaceTemplateVariables(template.title, templateData);
      const body = this.replaceTemplateVariables(template.body, templateData);

      return await this.sendPushNotification({
        deviceTokens,
        title,
        body,
        data: {
          ...template.data,
          ...templateData
        },
        imageUrl: template.imageUrl,
        clickAction: template.clickAction
      });

    } catch (error) {
      logger.error(`Failed to send templated push notification:`, error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get push notification template
  private getPushTemplate(templateName: string): {
    title: string;
    body: string;
    data?: { [key: string]: string };
    imageUrl?: string;
    clickAction?: string;
  } | null {
    const templates: { [key: string]: any } = {
      'low_stock': {
        title: 'แจ้งเตือนสต๊อคต่ำ',
        body: '{{product_name}} ที่ {{branch_name}} เหลือ {{current_stock}} {{unit}}',
        data: {
          type: 'low_stock',
          alert_id: '{{alert_id}}',
          product_id: '{{product_id}}',
          branch_id: '{{branch_id}}'
        },
        clickAction: '/alerts/{{alert_id}}'
      },
      'out_of_stock': {
        title: 'สินค้าหมดสต๊อค!',
        body: '{{product_name}} ที่ {{branch_name}} หมดสต๊อคแล้ว',
        data: {
          type: 'out_of_stock',
          alert_id: '{{alert_id}}',
          product_id: '{{product_id}}',
          branch_id: '{{branch_id}}'
        },
        clickAction: '/alerts/{{alert_id}}'
      },
      'approaching_expiry': {
        title: 'สินค้าใกล้หมดอายุ',
        body: '{{product_name}} ที่ {{branch_name}} ใกล้หมดอายุ ({{days_to_expiry}} วัน)',
        data: {
          type: 'approaching_expiry',
          alert_id: '{{alert_id}}',
          product_id: '{{product_id}}',
          branch_id: '{{branch_id}}'
        },
        clickAction: '/alerts/{{alert_id}}'
      },
      'test': {
        title: 'ทดสอบระบบแจ้งเตือน',
        body: 'ระบบ Push Notification ทำงานปกติ เวลา {{time}}',
        data: {
          type: 'test'
        }
      }
    };

    return templates[templateName] || null;
  }

  // Replace template variables
  private replaceTemplateVariables(template: string, data: any): string {
    let result = template;
    
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(placeholder, String(value || ''));
    }
    
    return result;
  }

  // Test push notification configuration
  async testPushNotification(deviceToken: string): Promise<PushResult> {
    try {
      const testResult = await this.sendTemplatedPushNotification(
        [deviceToken],
        'test',
        {
          time: new Date().toLocaleString('th-TH')
        }
      );

      return testResult;

    } catch (error) {
      logger.error('Push notification configuration test failed:', error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get push notification service status
  getStatus(): {
    configured: boolean;
    firebaseInitialized: boolean;
    projectId: string;
  } {
    return {
      configured: !!config.firebase.serviceAccountKey,
      firebaseInitialized: !!this.app,
      projectId: config.firebase.projectId || 'not_configured'
    };
  }

  // Clean up invalid device tokens
  async cleanupInvalidTokens(deviceTokens: string[]): Promise<string[]> {
    const validTokens: string[] = [];

    for (const token of deviceTokens) {
      if (this.isValidFCMToken(token)) {
        try {
          // Test if token is still valid by sending a dry run
          if (this.app) {
            await admin.messaging(this.app).send({
              token: token,
              notification: {
                title: 'Test',
                body: 'Test'
              }
            }, true); // dry run
            
            validTokens.push(token);
          }
        } catch (error) {
          logger.warn(`Invalid FCM token removed: ${token.substring(0, 10)}...`);
        }
      }
    }

    return validTokens;
  }
}

export default PushNotificationService;