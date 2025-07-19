import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { 
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrder,
  updateOrderStatus,
  cancelPurchaseOrder,
  getPurchaseOrderSummary
} from '../controllers/purchaseController';
import { requireBranch, requireSameBranch, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

/**
 * POST /api/purchase/orders
 * Create purchase order (เน้นการสั่งซื้อตามจำนวน)
 */
router.post('/orders',
  requireBranch,
  [
    body('items')
      .isArray({ min: 1 })
      .withMessage('ต้องมีสินค้าอย่างน้อย 1 รายการ'),
    body('items.*.productId')
      .isUUID()
      .withMessage('รหัสสินค้าไม่ถูกต้อง'),
    body('items.*.requestedQuantity')
      .isInt({ min: 1 })
      .withMessage('จำนวนที่สั่งต้องเป็นจำนวนเต็มบวก'),
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
  createPurchaseOrder
);

/**
 * GET /api/purchase/orders
 * Get purchase orders with filtering
 */
router.get('/orders',
  [
    query('branchId')
      .optional()
      .isUUID()
      .withMessage('รหัสสาขาไม่ถูกต้อง'),
    query('status')
      .optional()
      .isIn(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
      .withMessage('สถานะไม่ถูกต้อง'),
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
  getPurchaseOrders
);

/**
 * GET /api/purchase/orders/summary
 * Get purchase order summary
 */
router.get('/orders/summary',
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
  getPurchaseOrderSummary
);

/**
 * GET /api/purchase/orders/:id
 * Get specific purchase order
 */
router.get('/orders/:id',
  [
    param('id')
      .isUUID()
      .withMessage('รหัสใบสั่งซื้อไม่ถูกต้อง')
  ],
  validate,
  requireSameBranch,
  getPurchaseOrder
);

/**
 * PUT /api/purchase/orders/:id/status
 * Update purchase order status (for warehouse staff)
 */
router.put('/orders/:id/status',
  requireRole('ADMIN', 'WAREHOUSE', 'MANAGER'),
  [
    param('id')
      .isUUID()
      .withMessage('รหัสใบสั่งซื้อไม่ถูกต้อง'),
    body('status')
      .isIn(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
      .withMessage('สถานะไม่ถูกต้อง'),
    body('notes')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('หมายเหตุต้องไม่เกิน 500 ตัวอักษร')
  ],
  validate,
  updateOrderStatus
);

/**
 * POST /api/purchase/orders/:id/cancel
 * Cancel purchase order
 */
router.post('/orders/:id/cancel',
  requireBranch,
  [
    param('id')
      .isUUID()
      .withMessage('รหัสใบสั่งซื้อไม่ถูกต้อง'),
    body('reason')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('เหตุผลต้องไม่เกิน 200 ตัวอักษร')
  ],
  validate,
  cancelPurchaseOrder
);

export default router;