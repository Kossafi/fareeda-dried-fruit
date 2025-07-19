import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        branchId?: string;
        role?: string;
        permissions?: string[];
      };
    }
  }
}

/**
 * Middleware to validate branch access for users
 * Ensures users can only access data from their assigned branch (unless they're admin/supervisor)
 */
export const validateBranchAccess = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Admin and supervisor roles have access to all branches
    if (user.role && ['admin', 'supervisor'].includes(user.role)) {
      next();
      return;
    }

    // Extract branch ID from various possible sources
    const requestedBranchId = req.params.branchId || 
                             req.query.branchId || 
                             req.body.branchId;

    // If no branch ID is specified in request, allow (will be handled by controller)
    if (!requestedBranchId) {
      next();
      return;
    }

    // Check if user has access to the requested branch
    if (!user.branchId) {
      logger.warn('User has no branch assignment', { 
        userId: user.id, 
        requestedBranchId 
      });
      res.status(403).json({
        success: false,
        message: 'No branch access assigned'
      });
      return;
    }

    // Validate branch access
    if (user.branchId !== requestedBranchId) {
      logger.warn('Branch access denied', { 
        userId: user.id, 
        userBranchId: user.branchId,
        requestedBranchId 
      });
      res.status(403).json({
        success: false,
        message: 'Access denied: insufficient branch permissions'
      });
      return;
    }

    // Branch access validated
    next();

  } catch (error) {
    logger.error('Branch validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during branch validation'
    });
  }
};

/**
 * Middleware to ensure user has access to multiple branches (for admin functions)
 */
export const requireMultiBranchAccess = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Only admin and supervisor roles can access multi-branch data
    if (!user.role || !['admin', 'supervisor'].includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'Multi-branch access requires supervisor or admin role'
      });
      return;
    }

    next();

  } catch (error) {
    logger.error('Multi-branch access validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during access validation'
    });
  }
};

/**
 * Middleware to add user's branch ID to request if not provided
 */
export const addUserBranchId = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const user = req.user;
    
    if (!user) {
      next();
      return;
    }

    // If no branch ID specified and user has a branch, add it
    if (!req.body.branchId && !req.query.branchId && !req.params.branchId && user.branchId) {
      req.body.branchId = user.branchId;
    }

    next();

  } catch (error) {
    logger.error('Add user branch ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};