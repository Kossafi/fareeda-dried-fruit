import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { 
  createStockReceiving,
  getStockReceivings,
  getStockReceiving,
  getPendingDeliveries
} from '../controllers/receivingController';
import { requireBranch, requireSameBranch } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

/**
 * POST /api/receiving
 * Create stock receiving record (เน้นการรับสินค้าตามจำนวน)
 */
router.post('/',
  requireBranch,
  [
    body('purchaseOrderId')
      .isUUID()
      .withMessage('รหัสใบสั่งซื้อไม่ถูกต้อง'),
    body('items')
      .isArray({ min: 1 })
      .withMessage('ต้องมีสินค้าอย่างน้อย 1 รายการ'),
    body('items.*.productId')
      .isUUID()
      .withMessage('รหัสสินค้าไม่ถูกต้อง'),
    body('items.*.receivedQuantity')
      .isInt({ min: 0 })
      .withMessage('จำนวนที่ได้รับต้องเป็นจำนวนเต็มไม่ติดลบ'),
    body('items.*.notes')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('หมายเหตุต้องไม่เกิน 200 ตัวอักษร'),
    body('notes')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('หมายเหตุต้องไม่เกิน 500 ตัวอักษร')
  ],
  validate,
  createStockReceiving
);

/**
 * GET /api/receiving
 * Get stock receiving records
 */
router.get('/',
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
    query('hasDiscrepancies')
      .optional()
      .isBoolean()
      .withMessage('hasDiscrepancies ต้องเป็น boolean'),
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
  getStockReceivings
);

/**
 * GET /api/receiving/pending-deliveries
 * Get pending delivery orders (ready to receive)
 */
router.get('/pending-deliveries',
  [
    query('branchId')
      .optional()
      .isUUID()
      .withMessage('รหัสสาขาไม่ถูกต้อง')
  ],
  validate,
  requireSameBranch,
  getPendingDeliveries
);

/**
 * GET /api/receiving/:id
 * Get specific stock receiving record
 */
router.get('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('รหัสการรับสินค้าไม่ถูกต้อง')
  ],
  validate,
  requireSameBranch,
  getStockReceiving
);

export default router;