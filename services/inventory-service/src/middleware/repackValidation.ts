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
      
      logger.warn('Repack validation failed', { 
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
export const createRepackOrderSchema = Joi.object({
  branchId: Joi.string().uuid().required().messages({
    'string.uuid': 'Branch ID must be a valid UUID',
    'any.required': 'Branch ID is required'
  }),
  targetProductId: Joi.string().uuid().required().messages({
    'string.uuid': 'Target product ID must be a valid UUID',
    'any.required': 'Target product ID is required'
  }),
  expectedQuantity: Joi.number().positive().required().messages({
    'number.positive': 'Expected quantity must be positive',
    'any.required': 'Expected quantity is required'
  }),
  targetUnit: Joi.string().valid('gram', 'kilogram', 'piece', 'box', 'package').required().messages({
    'any.only': 'Target unit must be one of: gram, kilogram, piece, box, package',
    'any.required': 'Target unit is required'
  }),
  sourceItems: Joi.array().items(
    Joi.object({
      inventoryItemId: Joi.string().uuid().required().messages({
        'string.uuid': 'Inventory item ID must be a valid UUID',
        'any.required': 'Inventory item ID is required'
      }),
      requiredQuantity: Joi.number().positive().required().messages({
        'number.positive': 'Required quantity must be positive',
        'any.required': 'Required quantity is required'
      }),
      unit: Joi.string().valid('gram', 'kilogram', 'piece', 'box', 'package').required().messages({
        'any.only': 'Unit must be one of: gram, kilogram, piece, box, package',
        'any.required': 'Unit is required'
      }),
    })
  ).min(1).required().messages({
    'array.min': 'At least one source item is required',
    'any.required': 'Source items are required'
  }),
  scheduledDate: Joi.date().greater('now').required().messages({
    'date.greater': 'Scheduled date must be in the future',
    'any.required': 'Scheduled date is required'
  }),
  notes: Joi.string().max(1000).optional().messages({
    'string.max': 'Notes cannot exceed 1000 characters'
  }),
});

export const startRepackOrderSchema = Joi.object({
  supervisedBy: Joi.string().uuid().optional().messages({
    'string.uuid': 'Supervised by must be a valid UUID'
  }),
});

export const completeRepackOrderSchema = Joi.object({
  actualQuantity: Joi.number().positive().required().messages({
    'number.positive': 'Actual quantity must be positive',
    'any.required': 'Actual quantity is required'
  }),
  sourceItemActuals: Joi.array().items(
    Joi.object({
      inventoryItemId: Joi.string().uuid().required().messages({
        'string.uuid': 'Inventory item ID must be a valid UUID',
        'any.required': 'Inventory item ID is required'
      }),
      actualQuantity: Joi.number().min(0).required().messages({
        'number.min': 'Actual quantity cannot be negative',
        'any.required': 'Actual quantity is required'
      }),
    })
  ).min(1).required().messages({
    'array.min': 'At least one source item actual is required',
    'any.required': 'Source item actuals are required'
  }),
  notes: Joi.string().max(1000).optional().messages({
    'string.max': 'Notes cannot exceed 1000 characters'
  }),
});

export const cancelRepackOrderSchema = Joi.object({
  reason: Joi.string().min(1).max(500).required().messages({
    'string.min': 'Cancellation reason is required',
    'string.max': 'Reason cannot exceed 500 characters',
    'any.required': 'Cancellation reason is required'
  }),
});

export const repackQueryFiltersSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().messages({
    'number.min': 'Page must be at least 1'
  }),
  limit: Joi.number().integer().min(1).max(100).optional().messages({
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100'
  }),
  status: Joi.string().valid('planned', 'in_progress', 'completed', 'cancelled').optional().messages({
    'any.only': 'Status must be one of: planned, in_progress, completed, cancelled'
  }),
  targetProductId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Target product ID must be a valid UUID'
  }),
  startDate: Joi.date().optional().messages({
    'date.base': 'Start date must be a valid date'
  }),
  endDate: Joi.date().min(Joi.ref('startDate')).optional().messages({
    'date.min': 'End date must be after start date'
  }),
});

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      
      logger.warn('Repack query validation failed', { 
        path: req.path,
        errors: error.details,
        query: req.query 
      });

      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: errorMessage,
      });
      return;
    }

    req.query = value;
    next();
  };
};