import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { 
  findUserByUsername, 
  validateUserPassword,
  getUserBranches 
} from '@data/demoData';
import { generateToken } from '@utils/jwt';
import logger from '@utils/logger';
import { LoginRequest, ApiResponse, LoginResponse } from '@types/index';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        errors: errors.array()
      });
      return;
    }

    const { username, password }: LoginRequest = req.body;

    // Find user
    const user = findUserByUsername(username);
    if (!user) {
      logger.warn(`Login attempt with non-existent username: ${username}`);
      res.status(401).json({
        success: false,
        error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
      });
      return;
    }

    // Validate password
    const isValidPassword = validateUserPassword(username, password);
    if (!isValidPassword) {
      logger.warn(`Invalid password attempt for username: ${username}`);
      res.status(401).json({
        success: false,
        error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
      });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        error: 'บัญชีผู้ใช้ถูกระงับ'
      });
      return;
    }

    // Generate token
    const token = generateToken(user);

    // Get user branches
    const userBranches = getUserBranches(user.id);
    
    // Check if user needs to select branch
    const needsBranchSelection = userBranches.length > 0 && !user.branchId;

    // Prepare response
    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user: {
          ...user,
          allowedBranches: userBranches.map(b => b.id)
        },
        token,
        needsBranchSelection
      }
    };

    logger.info(`User ${username} logged in successfully`);
    res.json(response);
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const user = findUserByUsername(req.user.username);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    const userBranches = getUserBranches(user.id);

    res.json({
      success: true,
      data: {
        ...user,
        allowedBranches: userBranches.map(b => b.id)
      }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    // In a real application, you might want to blacklist the token
    // For demo purposes, we just return success
    res.json({
      success: true,
      message: 'ออกจากระบบเรียบร้อยแล้ว'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
};