import { Router } from 'express';
import { BarcodeController } from '../controllers/BarcodeController';
import { authMiddleware, requireRole } from '@dried-fruits/auth-middleware';
import { UserRole } from '@dried-fruits/types';

const router = Router();
const barcodeController = new BarcodeController();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Generate barcodes (require staff or higher access)
router.post('/generate/product', 
  requireRole([UserRole.WAREHOUSE_STAFF, UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  barcodeController.generateProductBarcode
);

router.post('/generate/inventory', 
  requireRole([UserRole.WAREHOUSE_STAFF, UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  barcodeController.generateInventoryBarcode
);

router.post('/generate/repack', 
  requireRole([UserRole.WAREHOUSE_STAFF, UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  barcodeController.generateRepackBarcode
);

// Bulk generate inventory barcodes for branch
router.post('/generate/bulk/:branchId', 
  requireRole([UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  barcodeController.bulkGenerateInventoryBarcodes
);

// Scan barcode (all authenticated users can scan)
router.post('/scan', barcodeController.scanBarcode);

// Get barcodes
router.get('/entity/:entityType/:entityId', barcodeController.getEntityBarcodes);
router.get('/branch/:branchId', barcodeController.getBranchBarcodes);

// Record barcode operations
router.post('/:barcodeId/print', 
  requireRole([UserRole.WAREHOUSE_STAFF, UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  barcodeController.recordPrint
);

router.delete('/:barcodeId', 
  requireRole([UserRole.BRANCH_MANAGER, UserRole.ADMIN]),
  barcodeController.deactivateBarcode
);

// Analytics and reporting
router.get('/:barcodeId/scan-history', barcodeController.getScanHistory);
router.get('/analytics/:branchId/scan-activity', barcodeController.getBranchScanActivity);
router.get('/analytics/:branchId/most-scanned', barcodeController.getMostScannedProducts);

export default router;