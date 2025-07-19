import { Request, Response } from 'express';
import Joi from 'joi';
import DeliveryOrderService from '../services/DeliveryOrderService';
import { DeliveryType, DeliveryStatus, UnitType } from '@dried-fruits/types';
import logger from '../utils/logger';

const deliveryOrderService = new DeliveryOrderService();

// Validation schemas
const createDeliveryOrderSchema = Joi.object({
  fromBranchId: Joi.string().uuid().required(),
  toBranchId: Joi.string().uuid().required(),
  deliveryType: Joi.string().valid(...Object.values(DeliveryType)).required(),
  scheduledPickupDate: Joi.date().min('now').required(),
  scheduledDeliveryDate: Joi.date().min(Joi.ref('scheduledPickupDate')).required(),
  items: Joi.array().items(
    Joi.object({
      inventoryItemId: Joi.string().uuid().required(),
      productId: Joi.string().uuid().required(),
      productName: Joi.string().required(),
      quantity: Joi.number().positive().required(),
      unit: Joi.string().valid(...Object.values(UnitType)).required(),
      batchNumber: Joi.string().optional(),
      expirationDate: Joi.date().optional(),
      barcodeId: Joi.string().uuid().optional(),
    })
  ).min(1).required(),
  specialInstructions: Joi.string().max(500).optional(),
  requiresSignature: Joi.boolean().optional(),
  requiresRefrigeration: Joi.boolean().optional(),
  contactPersonName: Joi.string().max(100).optional(),
  contactPhone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional(),
  createdBy: Joi.string().uuid().required(),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid(...Object.values(DeliveryStatus)).required(),
  actualPickupTime: Joi.date().optional(),
  actualDeliveryTime: Joi.date().optional(),
  receivedBy: Joi.string().max(100).optional(),
  signatureData: Joi.string().optional(),
  photoProof: Joi.string().optional(),
  deliveryNotes: Joi.string().max(500).optional(),
});

const assignDriverSchema = Joi.object({
  driverId: Joi.string().uuid().required(),
  vehicleId: Joi.string().uuid().optional(),
  assignedBy: Joi.string().uuid().required(),
});

const confirmItemsSchema = Joi.object({
  confirmations: Joi.array().items(
    Joi.object({
      itemId: Joi.string().uuid().required(),
      actualQuantity: Joi.number().positive().required(),
      notes: Joi.string().max(200).optional(),
    })
  ).min(1).required(),
});

export const createDeliveryOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = createDeliveryOrderSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    const deliveryOrder = await deliveryOrderService.createDeliveryOrder(value);

    logger.info('Delivery order created via API', {
      orderId: deliveryOrder.id,
      orderNumber: deliveryOrder.orderNumber,
      fromBranchId: value.fromBranchId,
      toBranchId: value.toBranchId,
      userId: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: 'Delivery order created successfully',
      data: deliveryOrder,
    });

  } catch (error) {
    logger.error('Create delivery order API error', {
      error: error.message,
      body: req.body,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create delivery order',
    });
  }
};

export const getDeliveryOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Delivery order ID is required',
      });
      return;
    }

    const deliveryOrder = await deliveryOrderService.getDeliveryOrder(id);

    if (!deliveryOrder) {
      res.status(404).json({
        success: false,
        message: 'Delivery order not found',
      });
      return;
    }

    res.json({
      success: true,
      data: deliveryOrder,
    });

  } catch (error) {
    logger.error('Get delivery order API error', {
      error: error.message,
      orderId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve delivery order',
    });
  }
};

export const updateDeliveryStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { error, value } = updateStatusSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Delivery order ID is required',
      });
      return;
    }

    const { status, ...updates } = value;
    const updatedOrder = await deliveryOrderService.updateDeliveryStatus(id, status, updates);

    logger.info('Delivery order status updated via API', {
      orderId: id,
      newStatus: status,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Delivery order status updated successfully',
      data: updatedOrder,
    });

  } catch (error) {
    logger.error('Update delivery status API error', {
      error: error.message,
      orderId: req.params.id,
      body: req.body,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update delivery order status',
    });
  }
};

export const assignDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { error, value } = assignDriverSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Delivery order ID is required',
      });
      return;
    }

    const updatedOrder = await deliveryOrderService.assignDriverToOrder(
      id,
      value.driverId,
      value.vehicleId,
      value.assignedBy
    );

    logger.info('Driver assigned to delivery order via API', {
      orderId: id,
      driverId: value.driverId,
      vehicleId: value.vehicleId,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Driver assigned successfully',
      data: updatedOrder,
    });

  } catch (error) {
    logger.error('Assign driver API error', {
      error: error.message,
      orderId: req.params.id,
      body: req.body,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to assign driver',
    });
  }
};

export const getOrdersByBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { direction = 'both', includeItems = false } = req.query;

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required',
      });
      return;
    }

    const orders = await deliveryOrderService.getOrdersByBranch(
      branchId,
      direction as 'from' | 'to' | 'both',
      includeItems === 'true'
    );

    res.json({
      success: true,
      data: orders,
      meta: {
        count: orders.length,
        branchId,
        direction,
        includeItems,
      },
    });

  } catch (error) {
    logger.error('Get orders by branch API error', {
      error: error.message,
      branchId: req.params.branchId,
      query: req.query,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders',
    });
  }
};

export const getOrdersByDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const { activeOnly = false } = req.query;

    if (!driverId) {
      res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
      return;
    }

    const orders = await deliveryOrderService.getOrdersByDriver(
      driverId,
      activeOnly === 'true'
    );

    res.json({
      success: true,
      data: orders,
      meta: {
        count: orders.length,
        driverId,
        activeOnly,
      },
    });

  } catch (error) {
    logger.error('Get orders by driver API error', {
      error: error.message,
      driverId: req.params.driverId,
      query: req.query,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve driver orders',
    });
  }
};

export const confirmDeliveryItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { error, value } = confirmItemsSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Delivery order ID is required',
      });
      return;
    }

    const confirmedItems = await deliveryOrderService.confirmDeliveryItems(
      id,
      value.confirmations
    );

    logger.info('Delivery items confirmed via API', {
      orderId: id,
      confirmedCount: confirmedItems.length,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Delivery items confirmed successfully',
      data: confirmedItems,
    });

  } catch (error) {
    logger.error('Confirm delivery items API error', {
      error: error.message,
      orderId: req.params.id,
      body: req.body,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm delivery items',
    });
  }
};

export const getOrdersRequiringAttention = async (req: Request, res: Response): Promise<void> => {
  try {
    const ordersNeedingAttention = await deliveryOrderService.getOrdersRequiringAttention();

    res.json({
      success: true,
      data: ordersNeedingAttention,
      meta: {
        totalOverdue: ordersNeedingAttention.overdue.length,
        totalDelayed: ordersNeedingAttention.delayed.length,
        totalUnassigned: ordersNeedingAttention.unassigned.length,
      },
    });

  } catch (error) {
    logger.error('Get orders requiring attention API error', {
      error: error.message,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders requiring attention',
    });
  }
};

export const getDeliveryAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, branchId } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Start date and end date are required',
      });
      return;
    }

    const analytics = await deliveryOrderService.getDeliveryAnalytics(
      new Date(startDate as string),
      new Date(endDate as string),
      branchId as string
    );

    res.json({
      success: true,
      data: analytics,
      meta: {
        dateRange: {
          startDate,
          endDate,
        },
        branchId,
      },
    });

  } catch (error) {
    logger.error('Get delivery analytics API error', {
      error: error.message,
      query: req.query,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve delivery analytics',
    });
  }
};

export const optimizeDriverAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const ordersNeedingAttention = await deliveryOrderService.getOrdersRequiringAttention();
    const suggestions = await deliveryOrderService.optimizeDriverAssignments(
      ordersNeedingAttention.unassigned
    );

    res.json({
      success: true,
      data: suggestions,
      meta: {
        totalUnassignedOrders: ordersNeedingAttention.unassigned.length,
        totalSuggestions: suggestions.length,
      },
    });

  } catch (error) {
    logger.error('Optimize driver assignments API error', {
      error: error.message,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to optimize driver assignments',
    });
  }
};