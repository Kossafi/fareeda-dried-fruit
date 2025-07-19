import { Router } from 'express';
import { RepackController } from '../controllers/RepackController';
import { authenticateToken, requirePermission, requireBranchAccess } from '../middleware/auth';
import {
  validate,
  validateQuery,
  createRepackOrderSchema,
  startRepackOrderSchema,
  completeRepackOrderSchema,
  cancelRepackOrderSchema,
  repackQueryFiltersSchema,
} from '../middleware/repackValidation';

const router = Router();
const repackController = new RepackController();

// All routes require authentication
router.use(authenticateToken);

// Repack order management
router.post(
  '/orders',
  requirePermission('inventory:create_repack'),
  validate(createRepackOrderSchema),
  repackController.createRepackOrder
);

router.get(
  '/orders/:id',
  requirePermission('inventory:read'),
  repackController.getRepackOrder
);

// Repack order operations
router.post(
  '/orders/:id/start',
  requirePermission('inventory:update'),
  validate(startRepackOrderSchema),
  repackController.startRepackOrder
);

router.post(
  '/orders/:id/complete',
  requirePermission('inventory:update'),
  validate(completeRepackOrderSchema),
  repackController.completeRepackOrder
);

router.post(
  '/orders/:id/cancel',
  requirePermission('inventory:update'),
  validate(cancelRepackOrderSchema),
  repackController.cancelRepackOrder
);

router.get(
  '/orders/:id/validate',
  requirePermission('inventory:read'),
  repackController.validateRepackFeasibility
);

// Branch-specific operations
router.get(
  '/branches/:branchId/orders',
  requireBranchAccess,
  requirePermission('inventory:read'),
  validateQuery(repackQueryFiltersSchema),
  repackController.getBranchRepackOrders
);

router.get(
  '/branches/:branchId/efficiency-report',
  requireBranchAccess,
  requirePermission('reports:read'),
  repackController.getEfficiencyReport
);

router.get(
  '/branches/:branchId/suggestions',
  requireBranchAccess,
  requirePermission('inventory:read'),
  repackController.getSuggestedOpportunities
);

// Global operations
router.get(
  '/ready-for-processing',
  requirePermission('inventory:read'),
  repackController.getReadyForProcessing
);

export default router;