import { Router } from 'express';
import { body } from 'express-validator';
import { 
  getAllBranches,
  getUserAvailableBranches,
  selectDailyBranch,
  getCurrentSession,
  endDailySession,
  requestBranchTransfer
} from '@controllers/branchController';
import { authenticate, authorize } from '@middleware/auth';
import { UserRole } from '@types/index';

const router = Router();

// Get all branches (admin only)
router.get('/all', authenticate, authorize(UserRole.ADMIN), getAllBranches);

// Get user's available branches
router.get('/available', authenticate, getUserAvailableBranches);

// Get current daily session
router.get('/session', authenticate, getCurrentSession);

// Select daily branch
router.post('/session/select', [
  authenticate,
  body('branchId')
    .trim()
    .notEmpty().withMessage('กรุณาเลือกสาขา')
], selectDailyBranch);

// End daily session
router.post('/session/end', authenticate, endDailySession);

// Request branch transfer
router.post('/transfer/request', [
  authenticate,
  body('toBranchId')
    .trim()
    .notEmpty().withMessage('กรุณาเลือกสาขาที่ต้องการย้ายไป'),
  body('reason')
    .trim()
    .notEmpty().withMessage('กรุณาระบุเหตุผลในการย้าย')
    .isLength({ min: 10 }).withMessage('เหตุผลต้องมีอย่างน้อย 10 ตัวอักษร')
], requestBranchTransfer);

export default router;