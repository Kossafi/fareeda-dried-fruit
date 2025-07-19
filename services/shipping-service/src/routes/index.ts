import express from 'express';
import shippingRoutes from './shipping';
import deliveryOrderRoutes from './delivery-orders';
import driverRoutes from './drivers';
import deliveryConfirmationRoutes from './delivery-confirmation';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Shipping service is healthy',
    timestamp: new Date().toISOString(),
    service: 'shipping-service',
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Service status endpoint
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'shipping-service',
      status: 'running',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    },
  });
});

// Mount route modules
router.use('/shipping', shippingRoutes);
router.use('/orders', deliveryOrderRoutes);
router.use('/drivers', driverRoutes);
router.use('/delivery', deliveryConfirmationRoutes);

export default router;