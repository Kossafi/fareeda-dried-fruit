import { Request, Response } from 'express';
import { BarcodeService } from '../services/BarcodeService';
import { BarcodeType } from '@dried-fruits/types';
import Joi from 'joi';
import logger from '../utils/logger';

export class BarcodeController {
  private barcodeService = new BarcodeService();

  // Validation schemas
  private readonly generateProductBarcodeSchema = Joi.object({
    productId: Joi.string().required(),
    branchId: Joi.string().required(),
    batchNumber: Joi.string().optional(),
    expirationDate: Joi.date().optional(),
    unit: Joi.string().valid('gram', 'kilogram', 'piece', 'box', 'package').required(),
    quantity: Joi.number().positive().optional(),
  });

  private readonly generateInventoryBarcodeSchema = Joi.object({
    inventoryItemId: Joi.string().required(),
    productId: Joi.string().required(),
    branchId: Joi.string().required(),
    locationCode: Joi.string().optional(),
    batchNumber: Joi.string().optional(),
  });

  private readonly generateRepackBarcodeSchema = Joi.object({
    repackOrderId: Joi.string().required(),
    targetProductId: Joi.string().required(),
    branchId: Joi.string().required(),
    expectedQuantity: Joi.number().positive().required(),
    unit: Joi.string().valid('gram', 'kilogram', 'piece', 'box', 'package').required(),
  });

  private readonly scanBarcodeSchema = Joi.object({
    barcodeIdentifier: Joi.string().required(),
    scanLocation: Joi.string().optional(),
    scanDevice: Joi.string().optional(),
  });

  /**
   * Generate product barcode
   */
  generateProductBarcode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = this.generateProductBarcodeSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
        return;
      }

      const barcode = await this.barcodeService.generateProductBarcode(value);

      res.json({
        success: true,
        data: {
          barcodeId: barcode.barcode_id,
          code128: barcode.code128,
          ean13: barcode.ean13,
          qrData: barcode.qr_data,
          type: barcode.type,
          createdAt: barcode.created_at,
        },
      });
    } catch (error) {
      logger.error('Error generating product barcode:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate product barcode',
      });
    }
  };

  /**
   * Generate inventory barcode
   */
  generateInventoryBarcode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = this.generateInventoryBarcodeSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
        return;
      }

      const barcode = await this.barcodeService.generateInventoryBarcode(value);

      res.json({
        success: true,
        data: {
          barcodeId: barcode.barcode_id,
          code128: barcode.code128,
          qrData: barcode.qr_data,
          type: barcode.type,
          createdAt: barcode.created_at,
        },
      });
    } catch (error) {
      logger.error('Error generating inventory barcode:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate inventory barcode',
      });
    }
  };

  /**
   * Generate repack barcode
   */
  generateRepackBarcode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = this.generateRepackBarcodeSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
        return;
      }

      const barcode = await this.barcodeService.generateRepackBarcode(value);

      res.json({
        success: true,
        data: {
          barcodeId: barcode.barcode_id,
          code128: barcode.code128,
          qrData: barcode.qr_data,
          type: barcode.type,
          createdAt: barcode.created_at,
        },
      });
    } catch (error) {
      logger.error('Error generating repack barcode:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate repack barcode',
      });
    }
  };

  /**
   * Scan barcode
   */
  scanBarcode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = this.scanBarcodeSchema.validate(req.body);
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

      const scanResult = await this.barcodeService.scanBarcode(
        value.barcodeIdentifier,
        userId,
        value.scanLocation,
        value.scanDevice
      );

      if (scanResult.success) {
        res.json({
          success: true,
          data: {
            barcodeData: scanResult.barcodeData,
            entityData: scanResult.entityData,
            scanRecord: scanResult.scanRecord,
          },
          message: scanResult.message,
        });
      } else {
        res.status(400).json({
          success: false,
          error: scanResult.message,
        });
      }
    } catch (error) {
      logger.error('Error scanning barcode:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to scan barcode',
      });
    }
  };

  /**
   * Get entity barcodes
   */
  getEntityBarcodes = async (req: Request, res: Response): Promise<void> => {
    try {
      const { entityId, entityType } = req.params;

      if (!entityId || !entityType) {
        res.status(400).json({
          success: false,
          error: 'Entity ID and type are required',
        });
        return;
      }

      const barcodes = await this.barcodeService.getBarcodesByEntity(entityId, entityType);

      res.json({
        success: true,
        data: barcodes.map(barcode => ({
          barcodeId: barcode.barcode_id,
          type: barcode.type,
          code128: barcode.code128,
          ean13: barcode.ean13,
          qrData: barcode.qr_data,
          isActive: barcode.is_active,
          printedCount: barcode.printed_count,
          scannedCount: barcode.scanned_count,
          lastScannedAt: barcode.last_scanned_at,
          createdAt: barcode.created_at,
        })),
      });
    } catch (error) {
      logger.error('Error getting entity barcodes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get entity barcodes',
      });
    }
  };

  /**
   * Get branch barcodes
   */
  getBranchBarcodes = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.params;
      const type = req.query.type as BarcodeType;

      if (!branchId) {
        res.status(400).json({
          success: false,
          error: 'Branch ID is required',
        });
        return;
      }

      const barcodes = await this.barcodeService.getBranchBarcodes(branchId, type);

      res.json({
        success: true,
        data: barcodes.map(barcode => ({
          barcodeId: barcode.barcode_id,
          type: barcode.type,
          entityId: barcode.entity_id,
          entityType: barcode.entity_type,
          code128: barcode.code128,
          ean13: barcode.ean13,
          isActive: barcode.is_active,
          printedCount: barcode.printed_count,
          scannedCount: barcode.scanned_count,
          lastScannedAt: barcode.last_scanned_at,
          createdAt: barcode.created_at,
        })),
      });
    } catch (error) {
      logger.error('Error getting branch barcodes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get branch barcodes',
      });
    }
  };

  /**
   * Record barcode print
   */
  recordPrint = async (req: Request, res: Response): Promise<void> => {
    try {
      const { barcodeId } = req.params;

      if (!barcodeId) {
        res.status(400).json({
          success: false,
          error: 'Barcode ID is required',
        });
        return;
      }

      await this.barcodeService.recordPrint(barcodeId);

      res.json({
        success: true,
        message: 'Print recorded successfully',
      });
    } catch (error) {
      logger.error('Error recording print:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record print',
      });
    }
  };

  /**
   * Deactivate barcode
   */
  deactivateBarcode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { barcodeId } = req.params;

      if (!barcodeId) {
        res.status(400).json({
          success: false,
          error: 'Barcode ID is required',
        });
        return;
      }

      await this.barcodeService.deactivateBarcode(barcodeId);

      res.json({
        success: true,
        message: 'Barcode deactivated successfully',
      });
    } catch (error) {
      logger.error('Error deactivating barcode:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate barcode',
      });
    }
  };

  /**
   * Get scan history
   */
  getScanHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { barcodeId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      if (!barcodeId) {
        res.status(400).json({
          success: false,
          error: 'Barcode ID is required',
        });
        return;
      }

      const history = await this.barcodeService.getScanHistory(barcodeId, limit);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error('Error getting scan history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get scan history',
      });
    }
  };

  /**
   * Get branch scan activity
   */
  getBranchScanActivity = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.params;
      const { startDate, endDate } = req.query;

      if (!branchId || !startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Branch ID, start date, and end date are required',
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

      const activity = await this.barcodeService.getBranchScanActivity(branchId, start, end);

      res.json({
        success: true,
        data: activity,
      });
    } catch (error) {
      logger.error('Error getting branch scan activity:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get branch scan activity',
      });
    }
  };

  /**
   * Get most scanned products
   */
  getMostScannedProducts = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      if (!branchId) {
        res.status(400).json({
          success: false,
          error: 'Branch ID is required',
        });
        return;
      }

      const products = await this.barcodeService.getMostScannedProducts(branchId, limit);

      res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      logger.error('Error getting most scanned products:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get most scanned products',
      });
    }
  };

  /**
   * Bulk generate inventory barcodes
   */
  bulkGenerateInventoryBarcodes = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchId } = req.params;

      if (!branchId) {
        res.status(400).json({
          success: false,
          error: 'Branch ID is required',
        });
        return;
      }

      const result = await this.barcodeService.bulkGenerateInventoryBarcodes(branchId);

      res.json({
        success: true,
        data: result,
        message: `Generated ${result.generated} barcodes with ${result.errors.length} errors`,
      });
    } catch (error) {
      logger.error('Error in bulk barcode generation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate barcodes',
      });
    }
  };
}

export default BarcodeController;