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
export const createInventoryItemSchema = Joi.object({
  productId: Joi.string().uuid().required().messages({
    'string.uuid': 'Product ID must be a valid UUID',
    'any.required': 'Product ID is required'
  }),
  branchId: Joi.string().uuid().required().messages({
    'string.uuid': 'Branch ID must be a valid UUID',
    'any.required': 'Branch ID is required'
  }),
  currentStock: Joi.number().min(0).required().messages({
    'number.min': 'Current stock cannot be negative',
    'any.required': 'Current stock is required'
  }),
  unit: Joi.string().valid('gram', 'kilogram', 'piece', 'box', 'package').required().messages({
    'any.only': 'Unit must be one of: gram, kilogram, piece, box, package',
    'any.required': 'Unit is required'
  }),
  minStockLevel: Joi.number().min(0).required().messages({
    'number.min': 'Minimum stock level cannot be negative',
    'any.required': 'Minimum stock level is required'
  }),
  maxStockLevel: Joi.number().min(Joi.ref('minStockLevel')).optional().messages({
    'number.min': 'Maximum stock level cannot be less than minimum stock level'
  }),
  reorderPoint: Joi.number().min(0).required().messages({
    'number.min': 'Reorder point cannot be negative',
    'any.required': 'Reorder point is required'
  }),
  reorderQuantity: Joi.number().min(0).required().messages({
    'number.min': 'Reorder quantity cannot be negative',
    'any.required': 'Reorder quantity is required'
  }),
  cost: Joi.number().min(0).required().messages({
    'number.min': 'Cost cannot be negative',
    'any.required': 'Cost is required'
  }),
  batchNumber: Joi.string().max(50).optional().messages({
    'string.max': 'Batch number cannot exceed 50 characters'
  }),
  supplierLotNumber: Joi.string().max(50).optional().messages({
    'string.max': 'Supplier lot number cannot exceed 50 characters'
  }),
  expirationDate: Joi.date().greater('now').optional().messages({
    'date.greater': 'Expiration date must be in the future'
  }),
  location: Joi.object({
    section: Joi.string().max(20).optional(),
    aisle: Joi.string().max(20).optional(),
    shelf: Joi.string().max(20).optional(),
    bin: Joi.string().max(20).optional(),
  }).optional(),
});

export const updateInventoryItemSchema = Joi.object({
  minStockLevel: Joi.number().min(0).optional().messages({
    'number.min': 'Minimum stock level cannot be negative'
  }),
  maxStockLevel: Joi.number().min(0).optional().messages({
    'number.min': 'Maximum stock level cannot be negative'
  }),
  reorderPoint: Joi.number().min(0).optional().messages({
    'number.min': 'Reorder point cannot be negative'
  }),
  reorderQuantity: Joi.number().min(0).optional().messages({
    'number.min': 'Reorder quantity cannot be negative'
  }),
  cost: Joi.number().min(0).optional().messages({
    'number.min': 'Cost cannot be negative'
  }),
  batchNumber: Joi.string().max(50).optional().allow('').messages({
    'string.max': 'Batch number cannot exceed 50 characters'
  }),
  expirationDate: Joi.date().optional().allow(null).messages({
    'date.base': 'Expiration date must be a valid date'
  }),
  location: Joi.object({
    section: Joi.string().max(20).optional().allow(''),
    aisle: Joi.string().max(20).optional().allow(''),
    shelf: Joi.string().max(20).optional().allow(''),
    bin: Joi.string().max(20).optional().allow(''),
  }).optional(),
});

export const stockAdjustmentSchema = Joi.object({
  quantity: Joi.number().not(0).required().messages({
    'number.base': 'Quantity must be a number',
    'any.invalid': 'Quantity cannot be zero',
    'any.required': 'Quantity is required'
  }),
  type: Joi.string().valid('incoming', 'outgoing', 'adjustment', 'transfer', 'repack', 'sample', 'waste', 'return').required().messages({
    'any.only': 'Type must be one of: incoming, outgoing, adjustment, transfer, repack, sample, waste, return',
    'any.required': 'Type is required'
  }),
  reason: Joi.string().min(1).max(255).required().messages({
    'string.min': 'Reason is required',
    'string.max': 'Reason cannot exceed 255 characters',
    'any.required': 'Reason is required'
  }),
  referenceId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Reference ID must be a valid UUID'
  }),
  referenceType: Joi.string().max(50).optional().messages({
    'string.max': 'Reference type cannot exceed 50 characters'
  }),
  notes: Joi.string().max(1000).optional().messages({
    'string.max': 'Notes cannot exceed 1000 characters'
  }),
});

export const reserveStockSchema = Joi.object({
  quantity: Joi.number().positive().required().messages({
    'number.positive': 'Quantity must be positive',
    'any.required': 'Quantity is required'
  }),
  referenceId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Reference ID must be a valid UUID'
  }),
});

export const validateStockSchema = Joi.object({
  requests: Joi.array().items(
    Joi.object({
      inventoryItemId: Joi.string().uuid().required().messages({
        'string.uuid': 'Inventory item ID must be a valid UUID',
        'any.required': 'Inventory item ID is required'
      }),
      quantity: Joi.number().positive().required().messages({
        'number.positive': 'Quantity must be positive',
        'any.required': 'Quantity is required'
      }),
    })
  ).min(1).required().messages({
    'array.min': 'At least one stock request is required',
    'any.required': 'Requests array is required'
  }),
});

export const queryFiltersSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().messages({
    'number.min': 'Page must be at least 1'
  }),
  limit: Joi.number().integer().min(1).max(100).optional().messages({
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100'
  }),
  lowStock: Joi.boolean().optional(),
  expiringSoon: Joi.boolean().optional(),
  searchTerm: Joi.string().max(100).optional().messages({
    'string.max': 'Search term cannot exceed 100 characters'
  }),
  categoryId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Category ID must be a valid UUID'
  }),
  type: Joi.string().valid('incoming', 'outgoing', 'adjustment', 'transfer', 'repack', 'sample', 'waste', 'return').optional(),
  productId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Product ID must be a valid UUID'
  }),
  performedBy: Joi.string().uuid().optional().messages({
    'string.uuid': 'Performed by must be a valid UUID'
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
      
      logger.warn('Query validation failed', { 
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