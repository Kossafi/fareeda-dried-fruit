import express from 'express';
import * as deliveryOrderController from '../controllers/deliveryOrderController';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = express.Router();

// Apply middleware
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// Delivery order routes
router.post('/create', deliveryOrderController.createDeliveryOrder);
router.get('/attention', deliveryOrderController.getOrdersRequiringAttention);
router.get('/analytics', deliveryOrderController.getDeliveryAnalytics);
router.get('/optimize-assignments', deliveryOrderController.optimizeDriverAssignments);
router.get('/branch/:branchId', deliveryOrderController.getOrdersByBranch);
router.get('/driver/:driverId', deliveryOrderController.getOrdersByDriver);
router.get('/:id', deliveryOrderController.getDeliveryOrder);
router.put('/:id/status', deliveryOrderController.updateDeliveryStatus);
router.put('/:id/assign-driver', deliveryOrderController.assignDriver);
router.post('/:id/confirm-items', deliveryOrderController.confirmDeliveryItems);

export default router;