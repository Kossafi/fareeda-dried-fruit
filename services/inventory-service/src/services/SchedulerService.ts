import cron from 'node-cron';
import StockMonitoringService from './StockMonitoringService';
import NotificationService from './NotificationService';
import AlertThreshold from '../models/AlertThreshold';
import NotificationDelivery from '../models/NotificationDelivery';
import logger from '../utils/logger';

export class SchedulerService {
  private stockMonitoringService: StockMonitoringService;
  private notificationService: NotificationService;
  private alertThreshold: AlertThreshold;
  private notificationDelivery: NotificationDelivery;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.stockMonitoringService = new StockMonitoringService();
    this.notificationService = new NotificationService();
    this.alertThreshold = new AlertThreshold();
    this.notificationDelivery = new NotificationDelivery();
  }

  // Initialize all scheduled jobs
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing scheduled jobs...');

      // Stock monitoring job - every 5 minutes
      this.scheduleStockMonitoring();

      // Notification processing job - every minute
      this.scheduleNotificationProcessing();

      // Notification retry job - every 10 minutes
      this.scheduleNotificationRetry();

      // Auto-update thresholds job - daily at 2 AM
      this.scheduleThresholdAutoUpdate();

      // Cleanup old notifications job - daily at 3 AM
      this.scheduleNotificationCleanup();

      // Alert escalation job - every 30 minutes
      this.scheduleAlertEscalation();

      // Health check job - every hour
      this.scheduleHealthCheck();

      logger.info(`Initialized ${this.jobs.size} scheduled jobs`);

    } catch (error) {
      logger.error('Failed to initialize scheduled jobs:', error);
      throw error;
    }
  }

  // Schedule stock level monitoring
  private scheduleStockMonitoring(): void {
    const job = cron.schedule('*/5 * * * *', async () => {
      try {
        logger.info('Starting scheduled stock monitoring...');
        await this.stockMonitoringService.checkAllStockLevels();
        logger.info('Completed scheduled stock monitoring');
      } catch (error) {
        logger.error('Stock monitoring job failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Bangkok'
    });

    this.jobs.set('stock-monitoring', job);
    job.start();
    logger.info('Stock monitoring job scheduled (every 5 minutes)');
  }

  // Schedule notification processing
  private scheduleNotificationProcessing(): void {
    const job = cron.schedule('* * * * *', async () => {
      try {
        await this.notificationService.processPendingNotifications();
      } catch (error) {
        logger.error('Notification processing job failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Bangkok'
    });

    this.jobs.set('notification-processing', job);
    job.start();
    logger.info('Notification processing job scheduled (every minute)');
  }

  // Schedule notification retry
  private scheduleNotificationRetry(): void {
    const job = cron.schedule('*/10 * * * *', async () => {
      try {
        await this.notificationService.retryFailedNotifications();
      } catch (error) {
        logger.error('Notification retry job failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Bangkok'
    });

    this.jobs.set('notification-retry', job);
    job.start();
    logger.info('Notification retry job scheduled (every 10 minutes)');
  }

  // Schedule threshold auto-update
  private scheduleThresholdAutoUpdate(): void {
    const job = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('Starting threshold auto-update...');
        await this.alertThreshold.autoUpdateThresholds();
        logger.info('Completed threshold auto-update');
      } catch (error) {
        logger.error('Threshold auto-update job failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Bangkok'
    });

    this.jobs.set('threshold-auto-update', job);
    job.start();
    logger.info('Threshold auto-update job scheduled (daily at 2 AM)');
  }

  // Schedule notification cleanup
  private scheduleNotificationCleanup(): void {
    const job = cron.schedule('0 3 * * *', async () => {
      try {
        logger.info('Starting notification cleanup...');
        const cleanedCount = await this.notificationService.cleanOldNotifications(90);
        logger.info(`Cleaned up ${cleanedCount} old notifications`);
      } catch (error) {
        logger.error('Notification cleanup job failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Bangkok'
    });

    this.jobs.set('notification-cleanup', job);
    job.start();
    logger.info('Notification cleanup job scheduled (daily at 3 AM)');
  }

  // Schedule alert escalation
  private scheduleAlertEscalation(): void {
    const job = cron.schedule('*/30 * * * *', async () => {
      try {
        await this.processAlertEscalation();
      } catch (error) {
        logger.error('Alert escalation job failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Bangkok'
    });

    this.jobs.set('alert-escalation', job);
    job.start();
    logger.info('Alert escalation job scheduled (every 30 minutes)');
  }

  // Schedule health check
  private scheduleHealthCheck(): void {
    const job = cron.schedule('0 * * * *', async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health check job failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Bangkok'
    });

    this.jobs.set('health-check', job);
    job.start();
    logger.info('Health check job scheduled (hourly)');
  }

  // Process alert escalation
  private async processAlertEscalation(): Promise<void> {
    try {
      // Get alerts that need escalation (critical alerts older than 1 hour, high alerts older than 4 hours)
      const escalationCandidates = await this.getAlertsForEscalation();

      for (const alert of escalationCandidates) {
        await this.escalateAlert(alert);
      }

      if (escalationCandidates.length > 0) {
        logger.info(`Escalated ${escalationCandidates.length} alerts`);
      }

    } catch (error) {
      logger.error('Error processing alert escalation:', error);
    }
  }

  // Get alerts that need escalation
  private async getAlertsForEscalation(): Promise<any[]> {
    try {
      const db = require('../database/connection').default.getInstance();
      
      const query = `
        SELECT sa.*, p.name as product_name, b.name as branch_name
        FROM stock_alerts sa
        JOIN products p ON sa.product_id = p.id
        JOIN branches b ON sa.branch_id = b.id
        WHERE sa.status IN ('active', 'acknowledged')
        AND (
          (sa.severity = 'critical' AND sa.triggered_at < CURRENT_TIMESTAMP - INTERVAL '1 hour')
          OR
          (sa.severity = 'high' AND sa.triggered_at < CURRENT_TIMESTAMP - INTERVAL '4 hours')
          OR
          (sa.severity = 'medium' AND sa.triggered_at < CURRENT_TIMESTAMP - INTERVAL '12 hours')
        )
        AND NOT EXISTS (
          SELECT 1 FROM alert_history ah 
          WHERE ah.stock_alert_id = sa.id 
          AND ah.action = 'escalated'
          AND ah.performed_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        )
        ORDER BY sa.severity, sa.triggered_at
        LIMIT 20
      `;

      const result = await db.query(query);
      return result.rows;

    } catch (error) {
      logger.error('Error getting alerts for escalation:', error);
      return [];
    }
  }

  // Escalate alert
  private async escalateAlert(alert: any): Promise<void> {
    try {
      // Create escalation entry in alert history
      const db = require('../database/connection').default.getInstance();
      
      await db.query(`
        INSERT INTO alert_history (
          stock_alert_id, action, performed_at, notes, system_generated
        ) VALUES ($1, 'escalated', CURRENT_TIMESTAMP, $2, true)
      `, [
        alert.id,
        `Alert escalated due to lack of response for ${alert.severity} severity alert`
      ]);

      // Send escalation notifications to management
      await this.sendEscalationNotifications(alert);

      logger.info(`Alert escalated: ${alert.alert_number} - ${alert.product_name} at ${alert.branch_name}`);

    } catch (error) {
      logger.error(`Error escalating alert ${alert.id}:`, error);
    }
  }

  // Send escalation notifications
  private async sendEscalationNotifications(alert: any): Promise<void> {
    try {
      // Get management users (users with 'alerts:escalation' permission)
      const db = require('../database/connection').default.getInstance();
      
      const query = `
        SELECT DISTINCT u.id, u.email, u.phone, u.username
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE p.name = 'alerts:escalation'
        AND u.is_active = true
      `;

      const result = await db.query(query);
      const managementUsers = result.rows;

      // Send escalation notifications
      for (const user of managementUsers) {
        const escalationMessage = this.generateEscalationMessage(alert);
        
        // Send email notification
        if (user.email) {
          await this.notificationService.createNotification({
            stockAlertId: alert.id,
            userId: user.id,
            channel: 'email',
            alertType: alert.alert_type,
            severity: 'critical', // Escalated alerts are always critical
            title: `🚨 ESCALATED ALERT: ${alert.title}`,
            message: escalationMessage,
            recipientEmail: user.email
          });
        }

        // Send SMS for critical escalations
        if (user.phone && alert.severity === 'critical') {
          await this.notificationService.createNotification({
            stockAlertId: alert.id,
            userId: user.id,
            channel: 'sms',
            alertType: alert.alert_type,
            severity: 'critical',
            title: `ESCALATED: ${alert.product_name}`,
            message: `ESCALATED ALERT: ${alert.product_name} at ${alert.branch_name} needs immediate attention. Stock: ${alert.current_stock_level} ${alert.unit}`,
            recipientPhone: user.phone
          });
        }
      }

    } catch (error) {
      logger.error('Error sending escalation notifications:', error);
    }
  }

  // Generate escalation message
  private generateEscalationMessage(alert: any): string {
    const timeElapsed = Math.floor((new Date().getTime() - new Date(alert.triggered_at).getTime()) / (1000 * 60 * 60));
    
    return `🚨 ALERT ESCALATION REQUIRED

This ${alert.severity} priority alert has not been addressed for ${timeElapsed} hours and requires immediate management attention.

Alert Details:
- Product: ${alert.product_name}
- Branch: ${alert.branch_name}
- Current Stock: ${alert.current_stock_level} ${alert.unit}
- Threshold: ${alert.threshold_level} ${alert.unit}
- Alert Type: ${alert.alert_type}
- Triggered: ${new Date(alert.triggered_at).toLocaleString('th-TH')}

Original Message:
${alert.message}

Please take immediate action to resolve this issue or ensure appropriate staff are notified.

Alert Number: ${alert.alert_number}
System: Dried Fruits Inventory Management`;
  }

  // Perform health check
  private async performHealthCheck(): Promise<void> {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        service: 'inventory-service',
        status: 'healthy',
        checks: {
          database: false,
          redis: false,
          jobs: false,
          alerts: false
        },
        metrics: {
          activeAlerts: 0,
          pendingNotifications: 0,
          failedNotifications: 0,
          jobsRunning: this.jobs.size
        }
      };

      // Check database connectivity
      try {
        const db = require('../database/connection').default.getInstance();
        await db.query('SELECT 1');
        health.checks.database = true;
      } catch (error) {
        logger.error('Database health check failed:', error);
      }

      // Check active alerts count
      try {
        const db = require('../database/connection').default.getInstance();
        const alertResult = await db.query(`
          SELECT COUNT(*) as count FROM stock_alerts 
          WHERE status IN ('active', 'acknowledged')
        `);
        health.metrics.activeAlerts = parseInt(alertResult.rows[0].count);
        health.checks.alerts = true;
      } catch (error) {
        logger.error('Alert health check failed:', error);
      }

      // Check pending notifications
      try {
        const pendingCount = await this.notificationDelivery.getPendingDeliveries();
        health.metrics.pendingNotifications = pendingCount.length;

        const failedCount = await this.notificationDelivery.getRetryableDeliveries();
        health.metrics.failedNotifications = failedCount.length;
      } catch (error) {
        logger.error('Notification health check failed:', error);
      }

      // Check if all jobs are running
      health.checks.jobs = Array.from(this.jobs.values()).every(job => job.getStatus() === 'scheduled');

      // Determine overall health status
      const allChecksPass = Object.values(health.checks).every(check => check === true);
      health.status = allChecksPass ? 'healthy' : 'degraded';

      if (health.status === 'degraded') {
        logger.warn('Service health check shows degraded status', health);
      }

      // Log critical metrics
      if (health.metrics.activeAlerts > 50) {
        logger.warn(`High number of active alerts: ${health.metrics.activeAlerts}`);
      }

      if (health.metrics.failedNotifications > 20) {
        logger.warn(`High number of failed notifications: ${health.metrics.failedNotifications}`);
      }

    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  // Schedule custom job
  scheduleCustomJob(
    name: string,
    cronExpression: string,
    jobFunction: () => Promise<void>,
    options?: { timezone?: string; runOnStart?: boolean }
  ): void {
    try {
      const job = cron.schedule(cronExpression, async () => {
        try {
          logger.info(`Starting custom job: ${name}`);
          await jobFunction();
          logger.info(`Completed custom job: ${name}`);
        } catch (error) {
          logger.error(`Custom job failed: ${name}`, error);
        }
      }, {
        scheduled: false,
        timezone: options?.timezone || 'Asia/Bangkok'
      });

      this.jobs.set(name, job);
      job.start();

      if (options?.runOnStart) {
        jobFunction().catch(error => {
          logger.error(`Initial run of custom job failed: ${name}`, error);
        });
      }

      logger.info(`Custom job scheduled: ${name} (${cronExpression})`);

    } catch (error) {
      logger.error(`Failed to schedule custom job: ${name}`, error);
    }
  }

  // Stop specific job
  stopJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      logger.info(`Stopped job: ${name}`);
      return true;
    }
    return false;
  }

  // Stop all jobs
  stopAllJobs(): void {
    for (const [name, job] of this.jobs) {
      job.stop();
      logger.info(`Stopped job: ${name}`);
    }
    this.jobs.clear();
    logger.info('All scheduled jobs stopped');
  }

  // Get job status
  getJobStatus(): Array<{ name: string; status: string; cronExpression?: string }> {
    const status = [];
    for (const [name, job] of this.jobs) {
      status.push({
        name,
        status: job.getStatus(),
        cronExpression: (job as any).cronTime?.source || 'unknown'
      });
    }
    return status;
  }

  // Restart specific job
  restartJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      job.start();
      logger.info(`Restarted job: ${name}`);
      return true;
    }
    return false;
  }

  // Get scheduler statistics
  getStatistics(): {
    totalJobs: number;
    runningJobs: number;
    stoppedJobs: number;
    uptime: number;
  } {
    const runningJobs = Array.from(this.jobs.values()).filter(job => job.getStatus() === 'scheduled').length;
    
    return {
      totalJobs: this.jobs.size,
      runningJobs,
      stoppedJobs: this.jobs.size - runningJobs,
      uptime: process.uptime()
    };
  }
}

export default SchedulerService;