import { Router } from 'express';
import { ShippingController } from '../controllers/ShippingController';
import { authMiddleware, requireRole } from '@dried-fruits/auth-middleware';
import { UserRole } from '@dried-fruits/types';

const router = Router();
const shippingController = new ShippingController();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Health check (no authentication required)
router.get('/health', shippingController.healthCheck);

// Delivery Order Management
router.post('/orders/delivery', 
  requireRole([UserRole.WAREHOUSE_STAFF, UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  shippingController.createDeliveryOrder
);

router.get('/orders/delivery/:id', 
  shippingController.getDeliveryOrder
);

router.put('/orders/delivery/:id/assign-driver', 
  requireRole([UserRole.WAREHOUSE_STAFF, UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  shippingController.assignDriver
);

router.put('/orders/delivery/:id/status', 
  requireRole([UserRole.DRIVER, UserRole.WAREHOUSE_STAFF, UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  shippingController.updateStatus
);

router.post('/orders/delivery/:id/confirm', 
  requireRole([UserRole.WAREHOUSE_STAFF, UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  shippingController.confirmDelivery
);

router.post('/orders/delivery/:id/tracking', 
  requireRole([UserRole.DRIVER, UserRole.WAREHOUSE_STAFF, UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  shippingController.addTrackingUpdate
);

router.get('/orders/delivery/:id/timeline', 
  shippingController.getDeliveryTimeline
);

// Driver Management
router.get('/drivers/:driverId/orders', 
  requireRole([UserRole.DRIVER, UserRole.WAREHOUSE_STAFF, UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  shippingController.getDriverOrders
);

// Branch Management
router.get('/branches/:branchId/incoming', 
  requireRole([UserRole.WAREHOUSE_STAFF, UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  shippingController.getBranchIncomingOrders
);

// Analytics and Reporting
router.get('/analytics/delivery', 
  requireRole([UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  shippingController.getDeliveryAnalytics
);

router.get('/orders/status/:status', 
  requireRole([UserRole.WAREHOUSE_STAFF, UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  shippingController.getOrdersByStatus
);

export default router;