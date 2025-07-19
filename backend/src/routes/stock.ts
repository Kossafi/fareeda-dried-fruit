import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { 
  getStockLevels,
  getProductStock,
  getStockMovements,
  updateStockThreshold,
  adjustStock,
  getLowStockAlerts,
  getStockSummary
} from '../controllers/stockController';
import { requireBranch, requireSameBranch, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

/**
 * GET /api/stock/levels
 * Get stock levels for branch (เน้นจำนวนคงเหลือ)
 */
router.get('/levels',
  [
    query('branchId')
      .optional()
      .isUUID()
      .withMessage('รหัสสาขาไม่ถูกต้อง'),
    query('productName')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('ชื่อสินค้าต้องมีความยาว 1-100 ตัวอักษร'),
    query('category')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('หมวดหมู่ต้องมีความยาว 1-50 ตัวอักษร'),
    query('lowStockOnly')
      .optional()
      .isBoolean()
      .withMessage('lowStockOnly ต้องเป็น boolean'),
    query('unit')
      .optional()
      .isIn(['GRAM', 'PIECE', 'KILOGRAM', 'PACKAGE'])
      .withMessage('หน่วยไม่ถูกต้อง'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('หน้าต้องเป็นจำนวนเต็มบวก'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('จำนวนรายการต่อหน้าต้องอยู่ระหว่าง 1-100')
  ],
  validate,
  requireSameBranch,
  getStockLevels
);

/**
 * GET /api/stock/product/:productId
 * Get stock level for specific product
 */
router.get('/product/:productId',
  [
    param('productId')
      .isUUID()
      .withMessage('รหัสสินค้าไม่ถูกต้อง'),
    query('branchId')
      .optional()
      .isUUID()
      .withMessage('รหัสสาขาไม่ถูกต้อง')
  ],
  validate,
  requireSameBranch,
  getProductStock
);

/**
 * GET /api/stock/movements
 * Get stock movement history (ติดตามการเคลื่อนไหวสต๊อค)
 */
router.get('/movements',
  [
    query('branchId')
      .optional()
      .isUUID()
      .withMessage('รหัสสาขาไม่ถูกต้อง'),
    query('productId')
      .optional()
      .isUUID()
      .withMessage('รหัสสินค้าไม่ถูกต้อง'),
    query('type')
      .optional()
      .isIn(['SALE', 'RECEIVE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'DAMAGED', 'EXPIRED'])
      .withMessage('ประเภทการเคลื่อนไหวไม่ถูกต้อง'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('วันที่เริ่มต้นไม่ถูกต้อง'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('วันที่สิ้นสุดไม่ถูกต้อง'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('หน้าต้องเป็นจำนวนเต็มบวก'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('จำนวนรายการต่อหน้าต้องอยู่ระหว่าง 1-100')
  ],
  validate,
  requireSameBranch,
  getStockMovements
);

/**
 * PUT /api/stock/product/:productId/threshold
 * Update stock threshold for low stock alerts
 */
router.put('/product/:productId/threshold',
  requireBranch,
  [
    param('productId')
      .isUUID()
      .withMessage('รหัสสินค้าไม่ถูกต้อง'),
    body('threshold')
      .optional()
      .isInt({ min: 0 })
      .withMessage('จำนวนขั้นต่ำต้องเป็นจำนวนเต็มไม่ติดลบ'),
    body('maxLevel')
      .optional()
      .isInt({ min: 1 })
      .withMessage('จำนวนสูงสุดต้องเป็นจำนวนเต็มบวก')
  ],
  validate,
  updateStockThreshold
);

/**
 * POST /api/stock/product/:productId/adjust
 * Manual stock adjustment (การปรับปรุงสต๊อคด้วยตนเอง)
 */
router.post('/product/:productId/adjust',
  requireBranch,
  requireRole('ADMIN', 'MANAGER'),
  [
    param('productId')
      .isUUID()
      .withMessage('รหัสสินค้าไม่ถูกต้อง'),
    body('adjustment')
      .isInt()
      .withMessage('จำนวนที่ปรับต้องเป็นจำนวนเต็ม'),
    body('reason')
      .isString()
      .isLength({ min: 1, max: 200 })
      .withMessage('เหตุผลต้องมีความยาว 1-200 ตัวอักษร')
  ],
  validate,
  adjustStock
);

/**
 * GET /api/stock/alerts/low-stock
 * Get low stock alerts (การแจ้งเตือนสินค้าใกล้หมด)
 */
router.get('/alerts/low-stock',
  [
    query('branchId')
      .optional()
      .isUUID()
      .withMessage('รหัสสาขาไม่ถูกต้อง')
  ],
  validate,
  requireSameBranch,
  getLowStockAlerts
);

/**
 * GET /api/stock/summary
 * Get stock summary for dashboard
 */
router.get('/summary',
  [
    query('branchId')
      .optional()
      .isUUID()
      .withMessage('รหัสสาขาไม่ถูกต้อง')
  ],
  validate,
  requireSameBranch,
  getStockSummary
);

export default router;