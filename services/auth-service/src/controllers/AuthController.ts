import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { UserModel } from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  ChangePasswordRequest,
} from '@dried-fruits/types';
import logger from '../utils/logger';

export class AuthController {
  private authService = new AuthService();
  private userModel = new UserModel();

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const registerData: RegisterRequest = req.body;
      const registeredBy = (req as AuthenticatedRequest).user?.sub;

      const user = await this.authService.register(registerData, registeredBy);

      res.status(201).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
        },
        message: 'User registered successfully',
      });
    } catch (error) {
      logger.error('Registration failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const loginData: LoginRequest = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const result = await this.authService.login(loginData, ipAddress, userAgent);

      res.json({
        success: true,
        data: result,
        message: 'Login successful',
      });
    } catch (error) {
      logger.error('Login failed:', error);
      res.status(401).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      const result = await this.authService.refreshToken(refreshToken, ipAddress);

      res.json({
        success: true,
        data: result,
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      logger.error('Token refresh failed:', error);
      res.status(401).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;

      await this.authService.logout(refreshToken);

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      logger.error('Logout failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  logoutAll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      await this.authService.logoutAll(req.user.sub);

      res.json({
        success: true,
        message: 'All sessions terminated successfully',
      });
    } catch (error) {
      logger.error('Logout all failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const user = await this.userModel.findById(req.user.sub);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Remove sensitive information
      const { ...userProfile } = user;

      res.json({
        success: true,
        data: userProfile,
      });
    } catch (error) {
      logger.error('Get profile failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };

  updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const updates = req.body;
      const user = await this.userModel.update(req.user.sub, updates);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      res.json({
        success: true,
        data: user,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      logger.error('Update profile failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const changePasswordData: ChangePasswordRequest = req.body;
      await this.authService.changePassword(req.user.sub, changePasswordData);

      res.json({
        success: true,
        message: 'Password changed successfully. Please login again.',
      });
    } catch (error) {
      logger.error('Change password failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  assignBranches = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { userId, branchIds } = req.body;
      await this.authService.assignBranches(userId, branchIds, req.user.sub);

      res.json({
        success: true,
        message: 'Branches assigned successfully',
      });
    } catch (error) {
      logger.error('Assign branches failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  grantPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { userId, permissionIds } = req.body;
      await this.userModel.grantPermissions(userId, permissionIds, req.user.sub);

      res.json({
        success: true,
        message: 'Permissions granted successfully',
      });
    } catch (error) {
      logger.error('Grant permissions failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  revokePermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { userId, permissionIds } = req.body;
      await this.userModel.revokePermissions(userId, permissionIds);

      res.json({
        success: true,
        message: 'Permissions revoked successfully',
      });
    } catch (error) {
      logger.error('Revoke permissions failed:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };
}