import { Request, Response } from 'express';
import Joi from 'joi';
import StockAlert from '../models/StockAlert';
import AlertThreshold from '../models/AlertThreshold';
import AlertSubscription from '../models/AlertSubscription';
import StockMonitoringService from '../services/StockMonitoringService';
import NotificationService from '../services/NotificationService';
import { AlertType, AlertSeverity, AlertStatus, UnitType, NotificationChannel, DigestFrequency } from '@dried-fruits/types';
import logger from '../utils/logger';

const stockAlert = new StockAlert();
const alertThreshold = new AlertThreshold();
const alertSubscription = new AlertSubscription();
const stockMonitoringService = new StockMonitoringService();
const notificationService = new NotificationService();

// Validation schemas
const createThresholdSchema = Joi.object({
  branchId: Joi.string().uuid().required(),
  productId: Joi.string().uuid().required(),
  categoryId: Joi.string().uuid().optional(),
  minimumStockLevel: Joi.number().min(0).required(),
  reorderPoint: Joi.number().min(0).required(),
  maximumStockLevel: Joi.number().min(0).optional(),
  unit: Joi.string().valid(...Object.values(UnitType)).required(),
  useAutoCalculation: Joi.boolean().optional(),
  autoCalculationDays: Joi.number().min(1).max(365).optional(),
  safetyStockMultiplier: Joi.number().min(1).max(5).optional()
});

const updateSubscriptionSchema = Joi.object({
  alertTypes: Joi.array().items(Joi.string().valid(...Object.values(AlertType))).optional(),
  severityLevels: Joi.array().items(Joi.string().valid(...Object.values(AlertSeverity))).optional(),
  branchIds: Joi.array().items(Joi.string().uuid()).optional(),
  categoryIds: Joi.array().items(Joi.string().uuid()).optional(),
  emailEnabled: Joi.boolean().optional(),
  inAppEnabled: Joi.boolean().optional(),
  smsEnabled: Joi.boolean().optional(),
  pushEnabled: Joi.boolean().optional(),
  immediateDelivery: Joi.boolean().optional(),
  digestFrequency: Joi.string().valid(...Object.values(DigestFrequency)).optional(),
  quietHoursStart: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  quietHoursEnd: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  timezone: Joi.string().optional()
});

// Get all low stock alerts
export const getLowStockAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId, severity, status, limit = 50, offset = 0 } = req.query;

    const filters: any = {};
    if (branchId) filters.branchId = branchId as string;
    if (severity) filters.severity = severity as AlertSeverity;
    if (status) filters.status = status as AlertStatus;
    filters.limit = parseInt(limit as string);
    filters.offset = parseInt(offset as string);

    const result = await stockAlert.getActiveAlerts(filters);

    res.json({
      success: true,
      data: result.alerts,
      meta: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        filters: { branchId, severity, status }
      }
    });

  } catch (error) {
    logger.error('Get low stock alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve low stock alerts'
    });
  }
};

// Create manual alert
export const createAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const createAlertSchema = Joi.object({
      alertType: Joi.string().valid(...Object.values(AlertType)).required(),
      severity: Joi.string().valid(...Object.values(AlertSeverity)).required(),
      branchId: Joi.string().uuid().required(),
      productId: Joi.string().uuid().required(),
      inventoryItemId: Joi.string().uuid().optional(),
      currentStockLevel: Joi.number().min(0).required(),
      thresholdLevel: Joi.number().min(0).required(),
      unit: Joi.string().valid(...Object.values(UnitType)).required(),
      title: Joi.string().max(200).required(),
      message: Joi.string().max(1000).required(),
      additionalData: Joi.object().optional()
    });

    const { error, value } = createAlertSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const alert = await stockAlert.create(value);

    logger.info('Manual alert created', {
      alertId: alert.id,
      alertNumber: alert.alertNumber,
      alertType: value.alertType,
      createdBy: req.user?.id
    });

    res.status(201).json({
      success: true,
      message: 'Alert created successfully',
      data: alert
    });

  } catch (error) {
    logger.error('Create alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create alert'
    });
  }
};

// Acknowledge alert
export const acknowledgeAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Alert ID is required'
      });
      return;
    }

    const alert = await stockAlert.acknowledge(id, req.user?.id || 'system');

    logger.info('Alert acknowledged', {
      alertId: id,
      alertNumber: alert.alertNumber,
      acknowledgedBy: req.user?.id
    });

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: alert
    });

  } catch (error) {
    logger.error('Acknowledge alert error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to acknowledge alert'
    });
  }
};

// Get alerts for current user
export const getUserAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
      return;
    }

    const filters: any = {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    if (status) {
      const statusArray = (status as string).split(',') as AlertStatus[];
      filters.status = statusArray;
    }

    const result = await stockAlert.getAlertsForUser(userId, filters);

    res.json({
      success: true,
      data: result.alerts,
      meta: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        userId: userId
      }
    });

  } catch (error) {
    logger.error('Get user alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user alerts'
    });
  }
};

// Subscribe to alert notifications
export const subscribeToAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = updateSubscriptionSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
      return;
    }

    const subscription = await alertSubscription.upsert({
      userId,
      ...value
    });

    logger.info('Alert subscription updated', {
      userId,
      alertTypes: value.alertTypes,
      channels: {
        email: value.emailEnabled,
        sms: value.smsEnabled,
        push: value.pushEnabled
      }
    });

    res.json({
      success: true,
      message: 'Alert subscription updated successfully',
      data: subscription
    });

  } catch (error) {
    logger.error('Subscribe to alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update alert subscription'
    });
  }
};

// Update alert thresholds for branch
export const updateThresholds = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { thresholds } = req.body;

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
      return;
    }

    if (!thresholds || !Array.isArray(thresholds)) {
      res.status(400).json({
        success: false,
        message: 'Thresholds array is required'
      });
      return;
    }

    // Validate each threshold
    const thresholdSchema = Joi.array().items(createThresholdSchema);
    const { error } = thresholdSchema.validate(thresholds);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const createdBy = req.user?.id || 'system';
    const updatedThresholds = await alertThreshold.bulkCreateForBranch(
      branchId,
      thresholds,
      createdBy
    );

    logger.info('Alert thresholds updated', {
      branchId,
      thresholdCount: updatedThresholds.length,
      updatedBy: createdBy
    });

    res.json({
      success: true,
      message: 'Alert thresholds updated successfully',
      data: updatedThresholds
    });

  } catch (error) {
    logger.error('Update thresholds error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update alert thresholds'
    });
  }
};

// Get alert analytics
export const getAlertAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId, startDate, endDate } = req.query;

    let dateRange;
    if (startDate && endDate) {
      dateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };
    }

    const analytics = await stockAlert.getAlertStatistics(
      branchId as string,
      dateRange
    );

    res.json({
      success: true,
      data: analytics,
      meta: {
        branchId: branchId || 'all',
        dateRange: dateRange ? {
          startDate: startDate,
          endDate: endDate
        } : 'all_time'
      }
    });

  } catch (error) {
    logger.error('Get alert analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alert analytics'
    });
  }
};

// Get monitoring report
export const getMonitoringReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.query;

    const report = await stockMonitoringService.generateMonitoringReport(
      branchId as string
    );

    res.json({
      success: true,
      data: report,
      meta: {
        branchId: branchId || 'all',
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Get monitoring report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate monitoring report'
    });
  }
};

// Trigger manual stock check
export const triggerStockCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId, productId, full } = req.body;

    if (full === true) {
      // Full system check
      await stockMonitoringService.checkAllStockLevels();
      logger.info('Manual full stock check triggered', { triggeredBy: req.user?.id });
    } else if (branchId && productId) {
      // Specific product check
      await stockMonitoringService.checkProductStock(branchId, productId);
      logger.info('Manual product stock check triggered', {
        branchId,
        productId,
        triggeredBy: req.user?.id
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Either set full=true for full check or provide branchId and productId for specific check'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Stock check triggered successfully'
    });

  } catch (error) {
    logger.error('Trigger stock check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger stock check'
    });
  }
};

// Test notification
export const testNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const testNotificationSchema = Joi.object({
      channel: Joi.string().valid(...Object.values(NotificationChannel)).required(),
      recipient: Joi.string().required()
    });

    const { error, value } = testNotificationSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
      return;
    }

    const result = await notificationService.sendTestNotification(
      userId,
      value.channel,
      value.recipient
    );

    logger.info('Test notification sent', {
      channel: value.channel,
      recipient: value.recipient.substring(0, 10) + '...',
      success: result.success,
      sentBy: userId
    });

    res.json({
      success: true,
      message: result.message,
      data: { sent: result.success }
    });

  } catch (error) {
    logger.error('Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification'
    });
  }
};

// Get notification statistics
export const getNotificationStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    let dateRange;
    if (startDate && endDate) {
      dateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };
    }

    const stats = await notificationService.getNotificationStatistics(dateRange);

    res.json({
      success: true,
      data: stats,
      meta: {
        dateRange: dateRange ? {
          startDate: startDate,
          endDate: endDate
        } : 'all_time'
      }
    });

  } catch (error) {
    logger.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notification statistics'
    });
  }
};

// Get alert by ID
export const getAlertById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Alert ID is required'
      });
      return;
    }

    const alert = await stockAlert.getById(id);

    if (!alert) {
      res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
      return;
    }

    res.json({
      success: true,
      data: alert
    });

  } catch (error) {
    logger.error('Get alert by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alert'
    });
  }
};

// Resolve alert
export const resolveAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Alert ID is required'
      });
      return;
    }

    const alert = await stockAlert.resolve(id, req.user?.id || 'system');

    logger.info('Alert resolved', {
      alertId: id,
      alertNumber: alert.alertNumber,
      resolvedBy: req.user?.id
    });

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      data: alert
    });

  } catch (error) {
    logger.error('Resolve alert error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to resolve alert'
    });
  }
};

// Dismiss alert
export const dismissAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Alert ID is required'
      });
      return;
    }

    const alert = await stockAlert.dismiss(id, req.user?.id || 'system');

    logger.info('Alert dismissed', {
      alertId: id,
      alertNumber: alert.alertNumber,
      dismissedBy: req.user?.id
    });

    res.json({
      success: true,
      message: 'Alert dismissed successfully',
      data: alert
    });

  } catch (error) {
    logger.error('Dismiss alert error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to dismiss alert'
    });
  }
};

// Get user subscription
export const getUserSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
      return;
    }

    const subscription = await alertSubscription.getByUserId(userId);

    res.json({
      success: true,
      data: subscription || {
        userId,
        alertTypes: ['low_stock', 'out_of_stock'],
        severityLevels: ['medium', 'high', 'critical'],
        emailEnabled: true,
        inAppEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        isActive: false
      }
    });

  } catch (error) {
    logger.error('Get user subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription'
    });
  }
};