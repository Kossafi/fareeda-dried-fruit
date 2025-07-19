import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { logger } from '../config/database';

/**
 * Validation middleware to handle express-validator errors
 */
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined
    }));

    logger.warn('Validation failed:', {
      path: req.path,
      method: req.method,
      errors: errorMessages,
      body: req.body
    });

    res.status(400).json({
      success: false,
      error: 'ข้อมูลไม่ถูกต้อง',
      validationErrors: errorMessages
    });
    return;
  }

  next();
};