import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import logger from '../utils/logger';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      
      logger.warn('Validation failed', { 
        path: req.path,
        errors: error.details,
        body: req.body 
      });

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorMessage,
      });
      return;
    }

    req.body = value;
    next();
  };
};

// Validation schemas
export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required'
    }),
  firstName: Joi.string().min(1).max(100).required().messages({
    'string.min': 'First name is required',
    'string.max': 'First name must not exceed 100 characters',
    'any.required': 'First name is required'
  }),
  lastName: Joi.string().min(1).max(100).required().messages({
    'string.min': 'Last name is required',
    'string.max': 'Last name must not exceed 100 characters',
    'any.required': 'Last name is required'
  }),
  phoneNumber: Joi.string().pattern(/^[+]?[1-9]\d{1,14}$/).optional().messages({
    'string.pattern.base': 'Please provide a valid phone number'
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  }),
  branchId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Branch ID must be a valid UUID'
  }),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required'
  }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required'
  }),
  newPassword: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters long',
      'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'New password is required'
    }),
});

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(1).max(100).optional().messages({
    'string.min': 'First name cannot be empty',
    'string.max': 'First name must not exceed 100 characters'
  }),
  lastName: Joi.string().min(1).max(100).optional().messages({
    'string.min': 'Last name cannot be empty',
    'string.max': 'Last name must not exceed 100 characters'
  }),
  phoneNumber: Joi.string().pattern(/^[+]?[1-9]\d{1,14}$/).optional().allow('').messages({
    'string.pattern.base': 'Please provide a valid phone number'
  }),
  profileImage: Joi.string().uri().optional().allow('').messages({
    'string.uri': 'Profile image must be a valid URL'
  }),
});

export const assignBranchSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.uuid': 'User ID must be a valid UUID',
    'any.required': 'User ID is required'
  }),
  branchIds: Joi.array().items(Joi.string().uuid()).min(1).required().messages({
    'array.min': 'At least one branch ID is required',
    'any.required': 'Branch IDs are required'
  }),
});

export const grantPermissionsSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.uuid': 'User ID must be a valid UUID',
    'any.required': 'User ID is required'
  }),
  permissionIds: Joi.array().items(Joi.string().uuid()).min(1).required().messages({
    'array.min': 'At least one permission ID is required',
    'any.required': 'Permission IDs are required'
  }),
});