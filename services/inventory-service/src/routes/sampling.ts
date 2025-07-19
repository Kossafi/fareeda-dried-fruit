import { Router } from 'express';
import {
  recordSampling,
  getDailyReport,
  getCostReport,
  approveExcess,
  getEffectiveness,
  completeSession,
  getPendingApprovals,
  rejectExcess,
  getUserApprovals,
  createOrUpdatePolicy,
  getBranchPolicies,
  getActiveSessions,
  updateCustomerResponse,
  getSamplingStatistics,
  checkSamplingLimits
} from '../controllers/samplingController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBranchAccess } from '../middleware/branchValidation';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Sampling recording and session management
router.post('/record', validateBranchAccess, recordSampling);
router.put('/complete/:sessionId', validateBranchAccess, completeSession);
router.put('/update-response/:recordId', validateBranchAccess, updateCustomerResponse);

// Daily operations and reporting
router.get('/daily/:branchId', validateBranchAccess, getDailyReport);
router.get('/active-sessions', validateBranchAccess, getActiveSessions);
router.post('/check-limits', validateBranchAccess, checkSamplingLimits);

// Cost reporting and analysis
router.get('/cost-report/:period', getCostReport);
router.get('/effectiveness/:branchId', validateBranchAccess, getEffectiveness);
router.get('/statistics', getSamplingStatistics);

// Approval workflow (requires supervisor/manager role)
router.get('/pending-approvals', authorize(['manager', 'supervisor', 'admin']), getPendingApprovals);
router.put('/approve-excess', authorize(['manager', 'supervisor', 'admin']), approveExcess);
router.put('/reject-excess/:approvalId', authorize(['manager', 'supervisor', 'admin']), rejectExcess);
router.get('/user-approvals', getUserApprovals);

// Policy management (requires manager/admin role)
router.post('/policies', authorize(['manager', 'admin']), createOrUpdatePolicy);
router.get('/policies/:branchId', validateBranchAccess, getBranchPolicies);

export default router;