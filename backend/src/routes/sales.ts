import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { 
  recordSale, 
  getSalesRecords, 
  getSaleRecord, 
  getSalesSummary 
} from '../controllers/salesController';
import { requireBranch, requireSameBranch } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

/**
 * POST /api/sales
 * Record a new sale (เน้นจำนวนสินค้า)
 */
router.post('/',
  requireBranch,
  [
    body('items')
      .isArray({ min: 1 })
      .withMessage('ต้องมีสินค้าอย่างน้อย 1 รายการ'),
    body('items.*.productId')
      .isUUID()
      .withMessage('รหัสสินค้าไม่ถูกต้อง'),
    body('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('จำนวนต้องเป็นจำนวนเต็มบวก'),
    body('items.*.unit')
      .isIn(['GRAM', 'PIECE', 'KILOGRAM', 'PACKAGE'])
      .withMessage('หน่วยไม่ถูกต้อง'),
    body('notes')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('หมายเหตุต้องไม่เกิน 500 ตัวอักษร')
  ],
  validate,
  recordSale
);

/**
 * GET /api/sales
 * Get sales records with filtering (เน้นจำนวนสินค้า)
 */
router.get('/',
  [
    query('branchId')
      .optional()
      .isUUID()
      .withMessage('รหัสสาขาไม่ถูกต้อง'),
    query('staffId')
      .optional()
      .isUUID()
      .withMessage('รหัสพนักงานไม่ถูกต้อง'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('วันที่เริ่มต้นไม่ถูกต้อง'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('วันที่สิ้นสุดไม่ถูกต้อง'),
    query('productId')
      .optional()
      .isUUID()
      .withMessage('รหัสสินค้าไม่ถูกต้อง'),
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
  getSalesRecords
);

/**
 * GET /api/sales/summary
 * Get sales summary (เน้นจำนวนสินค้า)
 */
router.get('/summary',
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
  getSalesSummary
);

/**
 * GET /api/sales/:id
 * Get specific sale record
 */
router.get('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('รหัสการขายไม่ถูกต้อง')
  ],
  validate,
  requireSameBranch,
  getSaleRecord
);

export default router;