import { Request, Response } from 'express';
import { ShippingService } from '../services/ShippingService';
import {
  CreateDeliveryOrderRequest,
  AssignDriverRequest,
  UpdateDeliveryStatusRequest,
  ConfirmDeliveryRequest,
  TrackingUpdateRequest,
  DeliveryType,
  DeliveryStatus,
} from '@dried-fruits/types';
import Joi from 'joi';
import logger from '../utils/logger';

export class ShippingController {
  private shippingService = new ShippingService();

  // Validation schemas
  private readonly createDeliveryOrderSchema = Joi.object({
    fromBranchId: Joi.string().uuid().required(),
    toBranchId: Joi.string().uuid().required(),
    deliveryType: Joi.string().valid(...Object.values(DeliveryType)).required(),
    scheduledPickupDate: Joi.date().iso().min('now').required(),
    scheduledDeliveryDate: Joi.date().iso().greater(Joi.ref('scheduledPickupDate')).required(),
    items: Joi.array().items(
      Joi.object({
        inventoryItemId: Joi.string().uuid().required(),
        quantity: Joi.number().positive().required(),
      })
    ).min(1).required(),
    specialInstructions: Joi.string().max(500).optional(),
    requiresSignature: Joi.boolean().optional(),
    requiresRefrigeration: Joi.boolean().optional(),
    contactPersonName: Joi.string().max(100).optional(),
    contactPhone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
  });

  private readonly assignDriverSchema = Joi.object({
    driverId: Joi.string().uuid().required(),
    vehicleId: Joi.string().uuid().optional(),
    notes: Joi.string().max(300).optional(),
  });

  private readonly updateStatusSchema = Joi.object({
    status: Joi.string().valid(...Object.values(DeliveryStatus)).required(),
    location: Joi.string().max(200).optional(),
    coordinates: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
    }).optional(),
    notes: Joi.string().max(500).optional(),
    actualTime: Joi.date().iso().optional(),
  });

  private readonly confirmDeliverySchema = Joi.object({
    items: Joi.array().items(
      Joi.object({
        deliveryOrderItemId: Joi.string().uuid().required(),
        actualQuantity: Joi.number().min(0).required(),
        barcodeScanned: Joi.boolean().optional(),
        notes: Joi.string().max(200).optional(),
      })
    ).min(1).required(),
    receivedBy: Joi.string().max(100).required(),
    signatureData: Joi.string().optional(),
    photoProof: Joi.string().optional(),
    notes: Joi.string().max(500).optional(),
  });

  private readonly trackingUpdateSchema = Joi.object({
    eventType: Joi.string().required(),
    location: Joi.string().max(200).optional(),
    coordinates: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
    }).optional(),
    description: Joi.string().max(500).required(),
    metadata: Joi.object().optional(),
  });

  /**
   * Create delivery order
   */
  createDeliveryOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = this.createDeliveryOrderSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
        return;
      }

      const userId = req.headers['user-id'] as string;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
        return;
      }

      const result = await this.shippingService.createDeliveryOrder(value, userId);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Delivery order created successfully',
      });
    } catch (error) {
      logger.error('Error creating delivery order:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  /**
   * Get delivery order details
   */
  getDeliveryOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Delivery order ID is required',
        });
        return;
      }

      const result = await this.shippingService.getDeliveryOrderDetails(id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error getting delivery order:', error);
      res.status(404).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  /**
   * Assign driver to delivery order
   */
  assignDriver = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { error, value } = this.assignDriverSchema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
        return;
      }

      const userId = req.headers['user-id'] as string;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
        return;
      }

      const result = await this.shippingService.assignDriver(id, value, userId);

      res.json({
        success: true,
        data: result,
        message: 'Driver assigned successfully',
      });
    } catch (error) {
      logger.error('Error assigning driver:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  /**
   * Update delivery status
   */
  updateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { error, value } = this.updateStatusSchema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
        return;
      }

      const userId = req.headers['user-id'] as string;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
        return;
      }

      const result = await this.shippingService.updateDeliveryStatus(id, value, userId);

      res.json({
        success: true,
        data: result,
        message: 'Delivery status updated successfully',
      });
    } catch (error) {
      logger.error('Error updating delivery status:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  /**
   * Confirm delivery
   */
  confirmDelivery = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { error, value } = this.confirmDeliverySchema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
        return;
      }

      const userId = req.headers['user-id'] as string;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
        return;
      }

      const result = await this.shippingService.confirmDelivery(id, value, userId);

      res.json({
        success: true,
        data: result,
        message: 'Delivery confirmed successfully',
      });
    } catch (error) {
      logger.error('Error confirming delivery:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  /**
   * Add tracking update
   */
  addTrackingUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { error, value } = this.trackingUpdateSchema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
        return;
      }

      const userId = req.headers['user-id'] as string;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
        return;
      }

      const result = await this.shippingService.addTrackingUpdate(id, value, userId);

      res.json({
        success: true,
        data: result,
        message: 'Tracking update added successfully',
      });
    } catch (error) {
      logger.error('Error adding tracking update:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  /**
   * Get driver orders
   */
  getDriverOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const { driverId } = req.params;

      if (!driverId) {
        res.status(400).json({
          success: false,
          error: 'Driver ID is required',
        });
        return;
      }

      const result = await this.shippingService.getDriverOrders(driverId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error getting driver orders:', error);
      res.status(404).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  /**
   * Get branch incoming orders
   */
  getBranchIncomingOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.params;

      if (!branchId) {
        res.status(400).json({
          success: false,
          error: 'Branch ID is required',
        });
        return;
      }

      const result = await this.shippingService.getBranchIncomingOrders(branchId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error getting branch incoming orders:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  /**
   * Get delivery analytics
   */
  getDeliveryAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, branchId } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Start date and end date are required',
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format',
        });
        return;
      }

      // This would be implemented in the service
      // const result = await this.shippingService.getDeliveryAnalytics(start, end, branchId as string);

      res.json({
        success: true,
        data: {
          message: 'Analytics endpoint to be implemented',
        },
      });
    } catch (error) {
      logger.error('Error getting delivery analytics:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  /**
   * Get delivery orders by status
   */
  getOrdersByStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.params;
      const { limit } = req.query;

      if (!Object.values(DeliveryStatus).includes(status as DeliveryStatus)) {
        res.status(400).json({
          success: false,
          error: 'Invalid delivery status',
        });
        return;
      }

      // This would call the delivery order model directly
      // const result = await this.deliveryOrderModel.findByStatus(status as DeliveryStatus, limit ? parseInt(limit as string) : undefined);

      res.json({
        success: true,
        data: {
          message: 'Orders by status endpoint to be implemented',
        },
      });
    } catch (error) {
      logger.error('Error getting orders by status:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  /**
   * Get delivery timeline
   */
  getDeliveryTimeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Delivery order ID is required',
        });
        return;
      }

      // This would be implemented in the tracking model
      // const result = await this.deliveryTrackingModel.getDeliveryTimeline(id);

      res.json({
        success: true,
        data: {
          message: 'Delivery timeline endpoint to be implemented',
        },
      });
    } catch (error) {
      logger.error('Error getting delivery timeline:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };

  /**
   * Health check
   */
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    res.json({
      success: true,
      message: 'Shipping service is healthy',
      timestamp: new Date().toISOString(),
    });
  };
}

export default ShippingController;