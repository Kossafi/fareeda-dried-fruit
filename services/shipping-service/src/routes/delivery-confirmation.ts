import express from 'express';
import * as deliveryConfirmationController from '../controllers/deliveryConfirmationController';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = express.Router();

// Apply middleware
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// Delivery confirmation routes
router.post('/confirm', deliveryConfirmationController.confirmDelivery);
router.post('/scan-confirm', deliveryConfirmationController.scanConfirmDelivery);
router.post('/report-discrepancy', deliveryConfirmationController.reportDiscrepancy);
router.get('/history/:orderId', deliveryConfirmationController.getDeliveryHistory);
router.get('/pending', deliveryConfirmationController.getAllPendingConfirmations);
router.get('/pending/:branchId', deliveryConfirmationController.getPendingConfirmations);
router.get('/analytics/:branchId?', deliveryConfirmationController.getConfirmationAnalytics);
router.post('/validate-barcodes/:orderId', deliveryConfirmationController.validateBarcodesForOrder);

export default router;