import express from 'express';
import * as alertController from '../controllers/alertController';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = express.Router();

// Apply middleware
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// Alert management routes
router.get('/low-stock', alertController.getLowStockAlerts);
router.post('/create', alertController.createAlert);
router.put('/:id/acknowledge', alertController.acknowledgeAlert);
router.put('/:id/resolve', alertController.resolveAlert);
router.put('/:id/dismiss', alertController.dismissAlert);
router.get('/:id', alertController.getAlertById);

// User-specific routes
router.get('/user/:userId', alertController.getUserAlerts);
router.post('/subscribe', alertController.subscribeToAlerts);
router.get('/subscription/me', alertController.getUserSubscription);

// Threshold management
router.put('/thresholds/:branchId', alertController.updateThresholds);

// Analytics and reporting
router.get('/analytics/alerts', alertController.getAlertAnalytics);
router.get('/analytics/monitoring', alertController.getMonitoringReport);
router.get('/analytics/notifications', alertController.getNotificationStats);

// Management operations
router.post('/check-stock', alertController.triggerStockCheck);
router.post('/test-notification', alertController.testNotification);

export default router;