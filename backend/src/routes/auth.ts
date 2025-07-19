import { Router } from 'express';
import { body } from 'express-validator';
import { login, register, refreshToken, logout, getProfile } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'มีการพยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ในภายหลัง'
  }
});

/**
 * POST /api/auth/login
 * User authentication
 */
router.post('/login',
  authLimiter,
  [
    body('username')
      .isString()
      .isLength({ min: 3, max: 50 })
      .withMessage('ชื่อผู้ใช้ต้องมีความยาว 3-50 ตัวอักษร'),
    body('password')
      .isString()
      .isLength({ min: 6 })
      .withMessage('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
  ],
  validate,
  login
);

/**
 * POST /api/auth/register
 * User registration (Admin only)
 */
router.post('/register',
  [
    body('username')
      .isString()
      .isLength({ min: 3, max: 50 })
      .withMessage('ชื่อผู้ใช้ต้องมีความยาว 3-50 ตัวอักษร'),
    body('email')
      .isEmail()
      .withMessage('อีเมลไม่ถูกต้อง'),
    body('password')
      .isString()
      .isLength({ min: 6 })
      .withMessage('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร'),
    body('fullName')
      .isString()
      .isLength({ min: 2, max: 100 })
      .withMessage('ชื่อเต็มต้องมีความยาว 2-100 ตัวอักษร'),
    body('role')
      .isIn(['ADMIN', 'MANAGER', 'STAFF', 'WAREHOUSE'])
      .withMessage('บทบาทไม่ถูกต้อง'),
    body('branchId')
      .optional()
      .isUUID()
      .withMessage('รหัสสาขาไม่ถูกต้อง')
  ],
  validate,
  register
);

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh',
  [
    body('token')
      .isString()
      .withMessage('ต้องระบุ refresh token')
  ],
  validate,
  refreshToken
);

/**
 * POST /api/auth/logout
 * User logout
 */
router.post('/logout',
  authenticateToken,
  logout
);

/**
 * GET /api/auth/profile
 * Get user profile
 */
router.get('/profile',
  authenticateToken,
  getProfile
);

export default router;