import { Request, Response } from 'express';
import Joi from 'joi';
import SalesService from '../services/SalesService';
import { SaleType, PaymentMethod, UnitType } from '@dried-fruits/types';
import logger from '../utils/logger';

const salesService = new SalesService();

// Validation schemas
const createSaleSchema = Joi.object({
  branchId: Joi.string().uuid().required(),
  customerId: Joi.string().uuid().optional(),
  customerData: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).min(10).max(20).optional(),
    email: Joi.string().email().optional(),
  }).optional(),
  saleType: Joi.string().valid(...Object.values(SaleType)).required(),
  items: Joi.array().items(
    Joi.object({
      inventoryItemId: Joi.string().uuid().required(),
      productId: Joi.string().uuid().required(),
      quantity: Joi.number().positive().required(),
      unit: Joi.string().valid(...Object.values(UnitType)).required(),
      unitPrice: Joi.number().positive().required(),
      discountAmount: Joi.number().min(0).optional(),
      discountPercentage: Joi.number().min(0).max(100).optional(),
      barcodeScanned: Joi.boolean().required(),
      actualWeight: Joi.number().positive().optional(),
      tareWeight: Joi.number().min(0).optional(),
    })
  ).min(1).required(),
  payments: Joi.array().items(
    Joi.object({
      paymentMethod: Joi.string().valid(...Object.values(PaymentMethod)).required(),
      amount: Joi.number().positive().required(),
      referenceNumber: Joi.string().max(100).optional(),
      receivedAmount: Joi.number().positive().optional(),
      cardLast4: Joi.string().length(4).pattern(/^[0-9]+$/).optional(),
      cardType: Joi.string().max(20).optional(),
      bankName: Joi.string().max(50).optional(),
      approvalCode: Joi.string().max(50).optional(),
      terminalId: Joi.string().max(50).optional(),
    })
  ).min(1).required(),
  discountAmount: Joi.number().min(0).optional(),
  taxAmount: Joi.number().min(0).optional(),
  soldBy: Joi.string().uuid().required(),
  cashierId: Joi.string().uuid().optional(),
  mallLocation: Joi.string().max(100).optional(),
  posTerminalId: Joi.string().max(50).optional(),
  notes: Joi.string().max(500).optional(),
});

const voidSaleSchema = Joi.object({
  reason: Joi.string().min(5).max(200).required(),
  voidedBy: Joi.string().uuid().required(),
});

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

export const createSale = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = createSaleSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    const sale = await salesService.createSale(value);

    logger.info('Sale created via API', {
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      totalAmount: sale.totalAmount,
      branchId: value.branchId,
      userId: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: sale,
    });

  } catch (error) {
    logger.error('Create sale API error', {
      error: error.message,
      body: req.body,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create sale',
    });
  }
};

export const getSale = async (req: Request, res: Response): Promise<void> => {
  try {
    const { saleId } = req.params;

    if (!saleId) {
      res.status(400).json({
        success: false,
        message: 'Sale ID is required',
      });
      return;
    }

    const sale = await salesService.getSaleWithDetails(saleId);

    if (!sale) {
      res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
      return;
    }

    res.json({
      success: true,
      data: sale,
    });

  } catch (error) {
    logger.error('Get sale API error', {
      error: error.message,
      saleId: req.params.saleId,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sale',
    });
  }
};

export const getSalesByBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { error, value } = dateRangeSchema.validate(req.query);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required',
      });
      return;
    }

    const sales = await salesService.getSalesByBranch(
      branchId,
      value.startDate,
      value.endDate,
      value.limit
    );

    res.json({
      success: true,
      data: sales,
      meta: {
        count: sales.length,
        branchId,
        dateRange: {
          startDate: value.startDate,
          endDate: value.endDate,
        },
      },
    });

  } catch (error) {
    logger.error('Get sales by branch API error', {
      error: error.message,
      branchId: req.params.branchId,
      query: req.query,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sales',
    });
  }
};

export const voidSale = async (req: Request, res: Response): Promise<void> => {
  try {
    const { saleId } = req.params;
    const { error, value } = voidSaleSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    if (!saleId) {
      res.status(400).json({
        success: false,
        message: 'Sale ID is required',
      });
      return;
    }

    const voidedSale = await salesService.voidSale(saleId, value.reason, value.voidedBy);

    logger.info('Sale voided via API', {
      saleId,
      reason: value.reason,
      voidedBy: value.voidedBy,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Sale voided successfully',
      data: voidedSale,
    });

  } catch (error) {
    logger.error('Void sale API error', {
      error: error.message,
      saleId: req.params.saleId,
      body: req.body,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to void sale',
    });
  }
};

export const getSalesAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required',
      });
      return;
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      res.status(400).json({
        success: false,
        message: 'Valid start date and end date are required',
      });
      return;
    }

    if (startDate > endDate) {
      res.status(400).json({
        success: false,
        message: 'Start date must be before end date',
      });
      return;
    }

    const analytics = await salesService.getSalesAnalytics(branchId, startDate, endDate);

    res.json({
      success: true,
      data: analytics,
      meta: {
        branchId,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    });

  } catch (error) {
    logger.error('Get sales analytics API error', {
      error: error.message,
      branchId: req.params.branchId,
      query: req.query,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sales analytics',
    });
  }
};

export const getRealtimeDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required',
      });
      return;
    }

    const dashboard = await salesService.getRealtimeDashboard(branchId);

    res.json({
      success: true,
      data: dashboard,
      meta: {
        branchId,
        isRealtime: dashboard.isLive,
        lastUpdated: dashboard.lastUpdated,
      },
    });

  } catch (error) {
    logger.error('Get realtime dashboard API error', {
      error: error.message,
      branchId: req.params.branchId,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve realtime dashboard',
    });
  }
};

export const searchSales = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { 
      saleNumber, 
      customerPhone, 
      customerName,
      startDate,
      endDate,
      status,
      limit = 20,
      offset = 0
    } = req.query;

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required',
      });
      return;
    }

    // Build search criteria
    const searchCriteria: any = { branchId };
    
    if (saleNumber) searchCriteria.saleNumber = saleNumber;
    if (customerPhone) searchCriteria.customerPhone = customerPhone;
    if (customerName) searchCriteria.customerName = customerName;
    if (startDate) searchCriteria.startDate = new Date(startDate as string);
    if (endDate) searchCriteria.endDate = new Date(endDate as string);
    if (status) searchCriteria.status = status;

    // Note: This would require implementing a search method in SalesService
    // For now, returning a basic response structure
    res.json({
      success: true,
      message: 'Search functionality not yet implemented',
      data: [],
      meta: {
        searchCriteria,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: 0,
      },
    });

  } catch (error) {
    logger.error('Search sales API error', {
      error: error.message,
      branchId: req.params.branchId,
      query: req.query,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to search sales',
    });
  }
};

export const getTodaysSales = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required',
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sales = await salesService.getSalesByBranch(branchId, today, tomorrow);

    res.json({
      success: true,
      data: sales,
      meta: {
        branchId,
        date: today.toISOString().split('T')[0],
        count: sales.length,
      },
    });

  } catch (error) {
    logger.error('Get todays sales API error', {
      error: error.message,
      branchId: req.params.branchId,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve today\'s sales',
    });
  }
};