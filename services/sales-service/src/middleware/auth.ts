import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import logger from '../utils/logger';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  branchId?: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access token is required',
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      req.user = decoded;
      next();
    } catch (jwtError) {
      logger.warn('Invalid JWT token', { 
        token: token.substring(0, 20) + '...', 
        error: jwtError.message 
      });
      
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
      return;
    }

  } catch (error) {
    logger.error('Auth middleware error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!req.user.permissions.includes(permission) && !req.user.permissions.includes('*')) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required: permission,
      });
      return;
    }

    next();
  };
};

export const requireRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient role permissions',
        required: allowedRoles,
        current: req.user.role,
      });
      return;
    }

    next();
  };
};

export const requireBranchAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  const requestedBranchId = req.params.branchId || req.body.branchId;

  // Super admin can access all branches
  if (req.user.role === 'super_admin') {
    next();
    return;
  }

  // Check if user has access to the requested branch
  if (req.user.branchId && req.user.branchId !== requestedBranchId) {
    res.status(403).json({
      success: false,
      message: 'Access denied to this branch',
      userBranch: req.user.branchId,
      requestedBranch: requestedBranchId,
    });
    return;
  }

  next();
};