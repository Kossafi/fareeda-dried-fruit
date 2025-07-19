import { Router } from 'express';
import { query } from 'express-validator';
import { 
  getSalesAnalytics,
  getHourlySalesPattern,
  getDailySalesTrend,
  getProductRanking
} from '../controllers/analyticsController';
import { requireSameBranch } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

/**
 * GET /api/analytics/sales
 * Get sales analytics (เน้นจำนวนสินค้า)
 */
router.get('/sales',
  [
    query('branchId')
      .optional()
      .isUUID()
      .withMessage('รหัสสาขาไม่ถูกต้อง'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('วันที่เริ่มต้นไม่ถูกต้อง'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('วันที่สิ้นสุดไม่ถูกต้อง')
  ],
  validate,
  requireSameBranch,
  getSalesAnalytics
);

/**
 * GET /api/analytics/hourly-pattern
 * Get hourly sales pattern (เน้นจำนวนสินค้าตามช่วงเวลา)
 */
router.get('/hourly-pattern',
  [
    query('branchId')
      .optional()
      .isUUID()
      .withMessage('รหัสสาขาไม่ถูกต้อง'),
    query('date')
      .optional()
      .isISO8601()
      .withMessage('วันที่ไม่ถูกต้อง'),
    query('days')
      .optional()
      .isInt({ min: 1, max: 30 })
      .withMessage('จำนวนวันต้องอยู่ระหว่าง 1-30')
  ],
  validate,
  requireSameBranch,
  getHourlySalesPattern
);

/**
 * GET /api/analytics/daily-trend
 * Get daily sales trend (เน้นจำนวนสินค้ารายวัน)
 */
router.get('/daily-trend',
  [
    query('branchId')
      .optional()
      .isUUID()
      .withMessage('รหัสสาขาไม่ถูกต้อง'),
    query('days')
      .optional()
      .isInt({ min: 1, max: 90 })
      .withMessage('จำนวนวันต้องอยู่ระหว่าง 1-90')
  ],
  validate,
  requireSameBranch,
  getDailySalesTrend
);

/**
 * GET /api/analytics/product-ranking
 * Get product ranking by quantity sold
 */
router.get('/product-ranking',
  [
    query('branchId')
      .optional()
      .isUUID()
      .withMessage('รหัสสาขาไม่ถูกต้อง'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('วันที่เริ่มต้นไม่ถูกต้อง'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('วันที่สิ้นสุดไม่ถูกต้อง'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('จำนวนรายการต้องอยู่ระหว่าง 1-50')
  ],
  validate,
  requireSameBranch,
  getProductRanking
);

export default router;