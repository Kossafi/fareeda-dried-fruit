import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authenticateToken, requireRole } from '../middleware/auth';
import {
  validate,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  updateProfileSchema,
  assignBranchSchema,
  grantPermissionsSchema,
} from '../middleware/validation';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

// Protected routes
router.use(authenticateToken);

router.post('/logout', validate(refreshTokenSchema), authController.logout);
router.post('/logout-all', authController.logoutAll);
router.get('/profile', authController.getProfile);
router.put('/profile', validate(updateProfileSchema), authController.updateProfile);
router.post('/change-password', validate(changePasswordSchema), authController.changePassword);

// Admin only routes
router.post(
  '/assign-branches',
  requireRole(['super_admin', 'admin']),
  validate(assignBranchSchema),
  authController.assignBranches
);

router.post(
  '/grant-permissions',
  requireRole(['super_admin', 'admin']),
  validate(grantPermissionsSchema),
  authController.grantPermissions
);

router.post(
  '/revoke-permissions',
  requireRole(['super_admin', 'admin']),
  validate(grantPermissionsSchema),
  authController.revokePermissions
);

export default router;