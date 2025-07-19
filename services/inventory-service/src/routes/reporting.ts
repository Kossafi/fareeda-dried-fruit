import { Router } from 'express';
import {
  getSalesAnalytics,
  getInventoryMovement,
  getBranchPerformance,
  getProductRanking,
  getSamplingROI,
  getProcurementAnalysis,
  getRealTimeDashboard,
  getFinancialSummary,
  generateReport,
  exportReport,
  getChartData,
  getCacheStatistics,
  invalidateCache,
  cleanExpiredCache,
  refreshMaterializedViews
} from '../controllers/reportingController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBranchAccess, requireMultiBranchAccess } from '../middleware/branchValidation';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Analytics Reports - Branch-specific access
router.get('/sales-analytics', validateBranchAccess, getSalesAnalytics);
router.get('/inventory-movement', validateBranchAccess, getInventoryMovement);
router.get('/branch-performance', requireMultiBranchAccess, getBranchPerformance);
router.get('/product-ranking', validateBranchAccess, getProductRanking);
router.get('/sampling-roi', validateBranchAccess, getSamplingROI);
router.get('/procurement-analysis', authorize(['manager', 'admin']), getProcurementAnalysis);

// Executive Reports - Admin access only
router.get('/financial-summary', authorize(['admin', 'executive']), getFinancialSummary);
router.get('/real-time-dashboard', getRealTimeDashboard);

// Generic Report Generation
router.post('/generate', generateReport);
router.post('/export', exportReport);

// Data Visualization
router.get('/chart-data', getChartData);

// Cache Management - Admin only
router.get('/cache/statistics', authorize(['admin']), getCacheStatistics);
router.post('/cache/invalidate', authorize(['admin']), invalidateCache);
router.post('/cache/clean', authorize(['admin']), cleanExpiredCache);
router.post('/cache/refresh-views', authorize(['admin']), refreshMaterializedViews);

export default router;