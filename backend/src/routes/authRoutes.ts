import { Router } from 'express';
import { body } from 'express-validator';
import { login, getMe, logout } from '@controllers/authController';
import { authenticate } from '@middleware/auth';

const router = Router();

// Login route
router.post('/login', [
  body('username')
    .trim()
    .notEmpty().withMessage('กรุณากรอกชื่อผู้ใช้')
    .isLength({ min: 3 }).withMessage('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร'),
  body('password')
    .notEmpty().withMessage('กรุณากรอกรหัสผ่าน')
    .isLength({ min: 6 }).withMessage('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
], login);

// Get current user
router.get('/me', authenticate, getMe);

// Logout
router.post('/logout', authenticate, logout);

export default router;