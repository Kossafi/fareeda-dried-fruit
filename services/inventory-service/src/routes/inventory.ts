import { Router } from 'express';
import { InventoryController } from '../controllers/InventoryController';
import { authenticateToken, requirePermission, requireBranchAccess } from '../middleware/auth';
import {
  validate,
  validateQuery,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  stockAdjustmentSchema,
  reserveStockSchema,
  validateStockSchema,
  queryFiltersSchema,
} from '../middleware/validation';

const router = Router();
const inventoryController = new InventoryController();

// All routes require authentication
router.use(authenticateToken);

// Inventory item management
router.post(
  '/items',
  requirePermission('inventory:create'),
  validate(createInventoryItemSchema),
  inventoryController.createInventoryItem
);

router.get(
  '/items/:id',
  requirePermission('inventory:read'),
  inventoryController.getInventoryItem
);

router.put(
  '/items/:id',
  requirePermission('inventory:update'),
  validate(updateInventoryItemSchema),
  inventoryController.updateInventoryItem
);

// Stock operations
router.post(
  '/items/:id/adjust',
  requirePermission('inventory:update'),
  validate(stockAdjustmentSchema),
  inventoryController.adjustStock
);

router.post(
  '/items/:id/reserve',
  requirePermission('inventory:reserve'),
  validate(reserveStockSchema),
  inventoryController.reserveStock
);

router.post(
  '/items/:id/release',
  requirePermission('inventory:reserve'),
  validate(reserveStockSchema),
  inventoryController.releaseReservedStock
);

// Stock movements
router.get(
  '/items/:id/movements',
  requirePermission('inventory:read'),
  validateQuery(queryFiltersSchema),
  inventoryController.getStockMovements
);

// Branch-specific operations
router.get(
  '/branches/:branchId/items',
  requireBranchAccess,
  requirePermission('inventory:read'),
  validateQuery(queryFiltersSchema),
  inventoryController.getBranchInventory
);

router.get(
  '/branches/:branchId/movements',
  requireBranchAccess,
  requirePermission('inventory:read'),
  validateQuery(queryFiltersSchema),
  inventoryController.getBranchStockMovements
);

router.get(
  '/branches/:branchId/summary',
  requireBranchAccess,
  requirePermission('inventory:read'),
  validateQuery(queryFiltersSchema),
  inventoryController.getStockSummary
);

router.get(
  '/branches/:branchId/low-stock',
  requireBranchAccess,
  requirePermission('inventory:read'),
  inventoryController.getLowStockItems
);

router.get(
  '/branches/:branchId/expiring-soon',
  requireBranchAccess,
  requirePermission('inventory:read'),
  inventoryController.getExpiringSoonItems
);

// Stock validation
router.post(
  '/validate-stock',
  requirePermission('inventory:read'),
  validate(validateStockSchema),
  inventoryController.validateStockAvailability
);

export default router;