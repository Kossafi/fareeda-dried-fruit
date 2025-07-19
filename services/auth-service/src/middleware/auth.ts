import { Request, Response, NextFunction } from 'express';
import { CryptoUtils } from '../utils/crypto';
import { JWTPayload } from '@dried-fruits/types';
import logger from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ 
      success: false, 
      error: 'Access token required' 
    });
    return;
  }

  try {
    const decoded = CryptoUtils.verifyToken(token);
    req.user = decoded;
    
    logger.debug('Token authenticated', { userId: decoded.sub });
    next();
  } catch (error) {
    logger.warn('Token verification failed:', { error: (error as Error).message });
    res.status(403).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Insufficient role permissions', { 
        userId: req.user.sub, 
        userRole: req.user.role, 
        requiredRoles: roles 
      });
      
      res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions' 
      });
      return;
    }

    next();
  };
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    if (!req.user.permissions.includes(permission)) {
      logger.warn('Insufficient permissions', { 
        userId: req.user.sub, 
        requiredPermission: permission,
        userPermissions: req.user.permissions 
      });
      
      res.status(403).json({ 
        success: false, 
        error: 'Permission denied' 
      });
      return;
    }

    next();
  };
};

export const requireBranchAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
    return;
  }

  const branchId = req.params.branchId || req.body.branchId || req.query.branchId;
  
  if (!branchId) {
    next();
    return;
  }

  // Super admin and admin have access to all branches
  if (['super_admin', 'admin'].includes(req.user.role)) {
    next();
    return;
  }

  if (!req.user.branchIds.includes(branchId)) {
    logger.warn('Branch access denied', { 
      userId: req.user.sub, 
      requestedBranch: branchId,
      userBranches: req.user.branchIds 
    });
    
    res.status(403).json({ 
      success: false, 
      error: 'Access denied to this branch' 
    });
    return;
  }

  next();
};

export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = CryptoUtils.verifyToken(token);
    req.user = decoded;
  } catch (error) {
    // Token is invalid but we continue without authentication
    logger.debug('Optional auth failed, continuing without auth');
  }

  next();
};