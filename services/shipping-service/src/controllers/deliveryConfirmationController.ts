import { Request, Response } from 'express';
import Joi from 'joi';
import DeliveryConfirmationService from '../services/DeliveryConfirmationService';
import { ConfirmationMethod, ConditionStatus, DiscrepancyType, DiscrepancySeverity, UnitType } from '@dried-fruits/types';
import logger from '../utils/logger';

const deliveryConfirmationService = new DeliveryConfirmationService();

// Validation schemas
const confirmDeliverySchema = Joi.object({
  deliveryOrderId: Joi.string().uuid().required(),
  confirmedBy: Joi.string().uuid().required(),
  branchId: Joi.string().uuid().required(),
  confirmationMethod: Joi.string().valid(...Object.values(ConfirmationMethod)).required(),
  items: Joi.array().items(
    Joi.object({
      deliveryOrderItemId: Joi.string().uuid().required(),
      expectedQuantity: Joi.number().positive().required(),
      receivedQuantity: Joi.number().min(0).required(),
      unit: Joi.string().valid(...Object.values(UnitType)).required(),
      conditionStatus: Joi.string().valid(...Object.values(ConditionStatus)).optional(),
      barcodeScanned: Joi.boolean().optional(),
      batchNumber: Joi.string().max(100).optional(),
      expirationDate: Joi.date().optional(),
      damageDescription: Joi.string().max(500).optional(),
      photoEvidence: Joi.array().items(Joi.string().uri()).optional(),
    })
  ).min(1).required(),
  notes: Joi.string().max(1000).optional(),
  signatureData: Joi.string().optional(),
  photoEvidence: Joi.array().items(Joi.string().uri()).optional(),
  locationCoordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }).optional(),
  deviceInfo: Joi.object().optional(),
});

const scanConfirmSchema = Joi.object({
  deliveryOrderId: Joi.string().uuid().required(),
  confirmedBy: Joi.string().uuid().required(),
  branchId: Joi.string().uuid().required(),
  scannedBarcodes: Joi.array().items(
    Joi.object({
      barcode: Joi.string().required(),
      quantity: Joi.number().positive().required(),
      unit: Joi.string().valid(...Object.values(UnitType)).required(),
      batchNumber: Joi.string().max(100).optional(),
      expirationDate: Joi.date().optional(),
    })
  ).min(1).required(),
  deviceInfo: Joi.object().optional(),
  locationCoordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }).optional(),
});

const reportDiscrepancySchema = Joi.object({
  deliveryOrderId: Joi.string().uuid().required(),
  reportedBy: Joi.string().uuid().required(),
  discrepancyType: Joi.string().valid(...Object.values(DiscrepancyType)).required(),
  severity: Joi.string().valid(...Object.values(DiscrepancySeverity)).required(),
  items: Joi.array().items(
    Joi.object({
      deliveryOrderItemId: Joi.string().uuid().required(),
      expectedQuantity: Joi.number().positive().required(),
      receivedQuantity: Joi.number().min(0).required(),
      unit: Joi.string().valid(...Object.values(UnitType)).required(),
      discrepancyReason: Joi.string().max(200).optional(),
      photoEvidence: Joi.array().items(Joi.string().uri()).optional(),
      estimatedValueImpact: Joi.number().min(0).optional(),
    })
  ).min(1).required(),
  notes: Joi.string().max(1000).optional(),
});

export const confirmDelivery = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = confirmDeliverySchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    const confirmation = await deliveryConfirmationService.confirmDelivery(value);

    logger.info('Delivery confirmed via API', {
      confirmationId: confirmation.id,
      deliveryOrderId: value.deliveryOrderId,
      confirmedBy: value.confirmedBy,
      itemCount: value.items.length,
      userId: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: 'Delivery confirmed successfully',
      data: confirmation,
    });

  } catch (error) {
    logger.error('Confirm delivery API error', {
      error: error.message,
      body: req.body,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm delivery',
    });
  }
};

export const scanConfirmDelivery = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = scanConfirmSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    const confirmation = await deliveryConfirmationService.confirmWithBarcodeScan(value);

    logger.info('Delivery confirmed via barcode scan', {
      confirmationId: confirmation.id,
      deliveryOrderId: value.deliveryOrderId,
      confirmedBy: value.confirmedBy,
      barcodeCount: value.scannedBarcodes.length,
      userId: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: 'Delivery confirmed via barcode scan successfully',
      data: confirmation,
    });

  } catch (error) {
    logger.error('Scan confirm delivery API error', {
      error: error.message,
      body: req.body,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm delivery with barcode scan',
    });
  }
};

export const reportDiscrepancy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = reportDiscrepancySchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
      return;
    }

    await deliveryConfirmationService.reportDiscrepancy(
      value.deliveryOrderId,
      value.reportedBy,
      value
    );

    logger.info('Discrepancy reported via API', {
      deliveryOrderId: value.deliveryOrderId,
      reportedBy: value.reportedBy,
      discrepancyType: value.discrepancyType,
      severity: value.severity,
      itemCount: value.items.length,
      userId: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: 'Discrepancy reported successfully',
    });

  } catch (error) {
    logger.error('Report discrepancy API error', {
      error: error.message,
      body: req.body,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to report discrepancy',
    });
  }
};

export const getDeliveryHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
      return;
    }

    const history = await deliveryConfirmationService.getDeliveryHistory(orderId);

    res.json({
      success: true,
      data: history,
    });

  } catch (error) {
    logger.error('Get delivery history API error', {
      error: error.message,
      orderId: req.params.orderId,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve delivery history',
    });
  }
};

export const getPendingConfirmations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;

    const pendingConfirmations = await deliveryConfirmationService.getPendingConfirmations(
      branchId || undefined
    );

    res.json({
      success: true,
      data: pendingConfirmations,
      meta: {
        count: pendingConfirmations.length,
        branchId: branchId || 'all',
      },
    });

  } catch (error) {
    logger.error('Get pending confirmations API error', {
      error: error.message,
      branchId: req.params.branchId,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending confirmations',
    });
  }
};

export const getConfirmationAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Start date and end date are required',
      });
      return;
    }

    const analytics = await deliveryConfirmationService.getConfirmationAnalytics(
      branchId || undefined,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: analytics,
      meta: {
        branchId: branchId || 'all',
        dateRange: {
          startDate,
          endDate,
        },
      },
    });

  } catch (error) {
    logger.error('Get confirmation analytics API error', {
      error: error.message,
      branchId: req.params.branchId,
      query: req.query,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve confirmation analytics',
    });
  }
};

export const getAllPendingConfirmations = async (req: Request, res: Response): Promise<void> => {
  try {
    const pendingConfirmations = await deliveryConfirmationService.getPendingConfirmations();

    res.json({
      success: true,
      data: pendingConfirmations,
      meta: {
        count: pendingConfirmations.length,
        branchId: 'all',
      },
    });

  } catch (error) {
    logger.error('Get all pending confirmations API error', {
      error: error.message,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending confirmations',
    });
  }
};

export const validateBarcodesForOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { barcodes } = req.body;

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
      return;
    }

    if (!barcodes || !Array.isArray(barcodes) || barcodes.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Barcodes array is required',
      });
      return;
    }

    // This would validate barcodes against the delivery order items
    // For now, return a placeholder response
    res.json({
      success: true,
      data: {
        validBarcodes: barcodes.map(barcode => ({
          barcode,
          valid: true,
          productId: 'placeholder-product-id',
          productName: 'Placeholder Product',
          expectedQuantity: 1,
        })),
        invalidBarcodes: [],
      },
      meta: {
        orderId,
        totalScanned: barcodes.length,
        validCount: barcodes.length,
        invalidCount: 0,
      },
    });

  } catch (error) {
    logger.error('Validate barcodes API error', {
      error: error.message,
      orderId: req.params.orderId,
      body: req.body,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to validate barcodes',
    });
  }
};