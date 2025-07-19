import express from 'express';
import inventoryRoutes from './inventory';
import barcodeRoutes from './barcode';
import repackRoutes from './repack';
import alertRoutes from './alerts';
import samplingRoutes from './sampling';
import procurementRoutes from './procurement';
import reportingRoutes from './reporting';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Inventory service is healthy',
    timestamp: new Date().toISOString(),
    service: 'inventory-service',
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Service status endpoint
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'inventory-service',
      status: 'running',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    },
  });
});

// Mount route modules
router.use('/inventory', inventoryRoutes);
router.use('/barcode', barcodeRoutes);
router.use('/repack', repackRoutes);
router.use('/alerts', alertRoutes);
router.use('/sampling', samplingRoutes);
router.use('/procurement', procurementRoutes);
router.use('/reports', reportingRoutes);

export default router;