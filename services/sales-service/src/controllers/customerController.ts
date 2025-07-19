import { Request, Response } from 'express';
import Joi from 'joi';
import CustomerModel from '../models/Customer';
import logger from '../utils/logger';

const customerModel = new CustomerModel();

// Validation schemas
const createCustomerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).min(10).max(20).optional(),
  email: Joi.string().email().optional(),
  address: Joi.string().max(200).optional(),
  city: Joi.string().max(50).optional(),
  province: Joi.string().max(50).optional(),
  postalCode: Joi.string().max(10).optional(),
  dateOfBirth: Joi.date().max('now').optional(),
  gender: Joi.string().valid('male', 'female', 'other').optional(),
  preferredLanguage: Joi.string().valid('th', 'en').optional(),
  notes: Joi.string().max(500).optional(),
});

const updateCustomerSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).min(10).max(20).optional(),
  email: Joi.string().email().optional(),
  address: Joi.string().max(200).optional(),
  city: Joi.string().max(50).optional(),
  province: Joi.string().max(50).optional(),
  postalCode: Joi.string().max(10).optional(),
  dateOfBirth: Joi.date().max('now').optional(),
  gender: Joi.string().valid('male', 'female', 'other').optional(),
  preferredLanguage: Joi.string().valid('th', 'en').optional(),
  notes: Joi.string().max(500).optional(),
});

const searchSchema = Joi.object({
  q: Joi.string().min(2).max(100).required(),
  limit: Joi.number().integer().min(1).max(50).optional(),
  offset: Joi.number().integer().min(0).optional(),
});

export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = createCustomerSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    // Check if phone number already exists
    if (value.phone) {
      const existingCustomer = await customerModel.findByPhone(value.phone);
      if (existingCustomer) {
        res.status(409).json({
          success: false,
          message: 'Customer with this phone number already exists',
          data: { existingCustomerId: existingCustomer.id },
        });
        return;
      }
    }

    // Check if email already exists
    if (value.email) {
      const existingCustomer = await customerModel.findByEmail(value.email);
      if (existingCustomer) {
        res.status(409).json({
          success: false,
          message: 'Customer with this email already exists',
          data: { existingCustomerId: existingCustomer.id },
        });
        return;
      }
    }

    const customer = await customerModel.create(value);

    logger.info('Customer created via API', {
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      userId: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer,
    });

  } catch (error) {
    logger.error('Create customer API error', {
      error: error.message,
      body: req.body,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create customer',
    });
  }
};

export const getCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      res.status(400).json({
        success: false,
        message: 'Customer ID is required',
      });
      return;
    }

    const customer = await customerModel.findById(customerId);

    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    res.json({
      success: true,
      data: customer,
    });

  } catch (error) {
    logger.error('Get customer API error', {
      error: error.message,
      customerId: req.params.customerId,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer',
    });
  }
};

export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId } = req.params;
    const { error, value } = updateCustomerSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    if (!customerId) {
      res.status(400).json({
        success: false,
        message: 'Customer ID is required',
      });
      return;
    }

    // Check if phone number already exists (if updating phone)
    if (value.phone) {
      const existingCustomer = await customerModel.findByPhone(value.phone);
      if (existingCustomer && existingCustomer.id !== customerId) {
        res.status(409).json({
          success: false,
          message: 'Another customer with this phone number already exists',
        });
        return;
      }
    }

    // Check if email already exists (if updating email)
    if (value.email) {
      const existingCustomer = await customerModel.findByEmail(value.email);
      if (existingCustomer && existingCustomer.id !== customerId) {
        res.status(409).json({
          success: false,
          message: 'Another customer with this email already exists',
        });
        return;
      }
    }

    const updatedCustomer = await customerModel.update(customerId, value);

    logger.info('Customer updated via API', {
      customerId,
      updates: Object.keys(value),
      userId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedCustomer,
    });

  } catch (error) {
    logger.error('Update customer API error', {
      error: error.message,
      customerId: req.params.customerId,
      body: req.body,
      userId: req.user?.id,
    });

    if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update customer',
      });
    }
  }
};

export const searchCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = searchSchema.validate(req.query);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    const limit = value.limit || 20;
    const offset = value.offset || 0;

    const result = await customerModel.search(value.q, limit, offset);

    res.json({
      success: true,
      data: result.customers,
      meta: {
        total: result.total,
        limit,
        offset,
        searchTerm: value.q,
      },
    });

  } catch (error) {
    logger.error('Search customers API error', {
      error: error.message,
      query: req.query,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to search customers',
    });
  }
};

export const findCustomerByPhone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.params;

    if (!phone) {
      res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
      return;
    }

    const customer = await customerModel.findByPhone(phone);

    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    res.json({
      success: true,
      data: customer,
    });

  } catch (error) {
    logger.error('Find customer by phone API error', {
      error: error.message,
      phone: req.params.phone,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to find customer',
    });
  }
};

export const getCustomerAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      res.status(400).json({
        success: false,
        message: 'Customer ID is required',
      });
      return;
    }

    const analytics = await customerModel.getCustomerAnalytics(customerId);

    res.json({
      success: true,
      data: analytics,
      meta: {
        customerId,
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('Get customer analytics API error', {
      error: error.message,
      customerId: req.params.customerId,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer analytics',
    });
  }
};

export const getTopCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { 
      startDate, 
      endDate, 
      limit = 20 
    } = req.query;

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required',
      });
      return;
    }

    const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
    const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

    if (parsedStartDate && isNaN(parsedStartDate.getTime())) {
      res.status(400).json({
        success: false,
        message: 'Invalid start date format',
      });
      return;
    }

    if (parsedEndDate && isNaN(parsedEndDate.getTime())) {
      res.status(400).json({
        success: false,
        message: 'Invalid end date format',
      });
      return;
    }

    const topCustomers = await customerModel.findTopCustomers(
      branchId,
      parsedStartDate,
      parsedEndDate,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: topCustomers,
      meta: {
        branchId,
        dateRange: {
          startDate: parsedStartDate?.toISOString(),
          endDate: parsedEndDate?.toISOString(),
        },
        limit: parseInt(limit as string),
        count: topCustomers.length,
      },
    });

  } catch (error) {
    logger.error('Get top customers API error', {
      error: error.message,
      branchId: req.params.branchId,
      query: req.query,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve top customers',
    });
  }
};

export const deactivateCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      res.status(400).json({
        success: false,
        message: 'Customer ID is required',
      });
      return;
    }

    await customerModel.deactivate(customerId);

    logger.info('Customer deactivated via API', {
      customerId,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Customer deactivated successfully',
    });

  } catch (error) {
    logger.error('Deactivate customer API error', {
      error: error.message,
      customerId: req.params.customerId,
      userId: req.user?.id,
    });

    if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate customer',
      });
    }
  }
};