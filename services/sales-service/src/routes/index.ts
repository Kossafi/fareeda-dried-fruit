import express from 'express';
import salesRoutes from './sales';
import customerRoutes from './customers';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Sales service is healthy',
    timestamp: new Date().toISOString(),
    service: 'sales-service',
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Service status endpoint
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'sales-service',
      status: 'running',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    },
  });
});

// Mount route modules
router.use('/sales', salesRoutes);
router.use('/customers', customerRoutes);

export default router;