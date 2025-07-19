import express from 'express';
import * as salesController from '../controllers/salesController';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = express.Router();

// Apply middleware
router.use(authMiddleware);
router.use(rateLimitMiddleware);

// Sales routes
router.post('/', salesController.createSale);
router.get('/search/:branchId', salesController.searchSales);
router.get('/analytics/:branchId', salesController.getSalesAnalytics);
router.get('/dashboard/:branchId', salesController.getRealtimeDashboard);
router.get('/today/:branchId', salesController.getTodaysSales);
router.get('/branch/:branchId', salesController.getSalesByBranch);
router.get('/:saleId', salesController.getSale);
router.post('/:saleId/void', salesController.voidSale);

export default router;