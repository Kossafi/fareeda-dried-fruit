import { BarcodeModel, BarcodeRecord, ScanRecord } from '../models/Barcode';
import { InventoryItemModel } from '../models/InventoryItem';
import { RepackOrderModel } from '../models/RepackOrder';
import BarcodeGenerator, { 
  BarcodeData, 
  ProductBarcodeData, 
  InventoryBarcodeData, 
  RepackBarcodeData 
} from '../utils/barcodeGenerator';
import { BarcodeType } from '@dried-fruits/types';
import DatabaseConnection from '../database/connection';
import logger from '../utils/logger';

export interface ScanResult {
  success: boolean;
  barcodeData?: BarcodeData;
  entityData?: any;
  message: string;
  scanRecord?: ScanRecord;
}

export interface BarcodeGenerationRequest {
  type: BarcodeType;
  entityId: string;
  branchId: string;
  additionalData?: any;
}

export class BarcodeService {
  private barcodeModel = new BarcodeModel();
  private inventoryModel = new InventoryItemModel();
  private repackModel = new RepackOrderModel();
  private db = DatabaseConnection.getInstance();

  /**
   * Generate barcode for product
   */
  async generateProductBarcode(data: ProductBarcodeData): Promise<BarcodeRecord> {
    try {
      // Validate product exists
      const productQuery = `
        SELECT id, name FROM public.products 
        WHERE id = $1
      `;
      const productResult = await this.db.query(productQuery, [data.productId]);
      
      if (productResult.rows.length === 0) {
        throw new Error(`Product not found: ${data.productId}`);
      }

      // Generate barcode data
      const barcodeData = BarcodeGenerator.generateProductBarcode(data);
      const code128 = BarcodeGenerator.generateCode128(barcodeData.id);
      const ean13 = BarcodeGenerator.generateEAN13(data.productId, data.branchId);
      const qrData = BarcodeGenerator.generateQRCodeData(barcodeData);

      // Save to database
      const record = await this.barcodeModel.create(barcodeData, {
        code128,
        ean13,
        qrData,
        entityType: 'product',
        entityId: data.productId,
      });

      // Publish event
      await this.db.publishEvent('barcode', 'generated', {
        barcodeId: barcodeData.id,
        type: BarcodeType.PRODUCT,
        entityId: data.productId,
        branchId: data.branchId,
        code128,
        ean13,
      });

      logger.info('Product barcode generated', {
        barcodeId: barcodeData.id,
        productId: data.productId,
        branchId: data.branchId,
      });

      return record;
    } catch (error) {
      logger.error('Error generating product barcode:', error);
      throw error;
    }
  }

  /**
   * Generate barcode for inventory item
   */
  async generateInventoryBarcode(data: InventoryBarcodeData): Promise<BarcodeRecord> {
    try {
      // Validate inventory item exists
      const inventoryItem = await this.inventoryModel.findById(data.inventoryItemId);
      if (!inventoryItem) {
        throw new Error(`Inventory item not found: ${data.inventoryItemId}`);
      }

      // Generate barcode data
      const barcodeData = BarcodeGenerator.generateInventoryBarcode(data);
      const code128 = BarcodeGenerator.generateCode128(barcodeData.id);
      const qrData = BarcodeGenerator.generateQRCodeData(barcodeData);

      // Save to database
      const record = await this.barcodeModel.create(barcodeData, {
        code128,
        qrData,
        entityType: 'inventory_item',
        entityId: data.inventoryItemId,
      });

      // Publish event
      await this.db.publishEvent('barcode', 'generated', {
        barcodeId: barcodeData.id,
        type: BarcodeType.INVENTORY_ITEM,
        entityId: data.inventoryItemId,
        branchId: data.branchId,
        code128,
      });

      logger.info('Inventory barcode generated', {
        barcodeId: barcodeData.id,
        inventoryItemId: data.inventoryItemId,
        branchId: data.branchId,
      });

      return record;
    } catch (error) {
      logger.error('Error generating inventory barcode:', error);
      throw error;
    }
  }

  /**
   * Generate barcode for repack order
   */
  async generateRepackBarcode(data: RepackBarcodeData): Promise<BarcodeRecord> {
    try {
      // Validate repack order exists
      const repackOrder = await this.repackModel.findById(data.repackOrderId);
      if (!repackOrder) {
        throw new Error(`Repack order not found: ${data.repackOrderId}`);
      }

      // Generate barcode data
      const barcodeData = BarcodeGenerator.generateRepackBarcode(data);
      const code128 = BarcodeGenerator.generateCode128(barcodeData.id);
      const qrData = BarcodeGenerator.generateQRCodeData(barcodeData);

      // Save to database
      const record = await this.barcodeModel.create(barcodeData, {
        code128,
        qrData,
        entityType: 'repack_order',
        entityId: data.repackOrderId,
      });

      // Publish event
      await this.db.publishEvent('barcode', 'generated', {
        barcodeId: barcodeData.id,
        type: BarcodeType.REPACK_ORDER,
        entityId: data.repackOrderId,
        branchId: data.branchId,
        code128,
      });

      logger.info('Repack barcode generated', {
        barcodeId: barcodeData.id,
        repackOrderId: data.repackOrderId,
        branchId: data.branchId,
      });

      return record;
    } catch (error) {
      logger.error('Error generating repack barcode:', error);
      throw error;
    }
  }

  /**
   * Scan barcode and return entity data
   */
  async scanBarcode(
    barcodeIdentifier: string, 
    scannedBy: string,
    scanLocation?: string,
    scanDevice?: string
  ): Promise<ScanResult> {
    try {
      // Try to find barcode by different identifiers
      let barcodeRecord = await this.barcodeModel.findById(barcodeIdentifier);
      
      if (!barcodeRecord) {
        barcodeRecord = await this.barcodeModel.findByCode128(barcodeIdentifier);
      }
      
      if (!barcodeRecord) {
        barcodeRecord = await this.barcodeModel.findByEAN13(barcodeIdentifier);
      }

      if (!barcodeRecord) {
        // Record failed scan
        await this.barcodeModel.recordScan({
          barcodeId: barcodeIdentifier,
          scannedBy,
          scanLocation,
          scanDevice,
          scanResult: 'invalid',
          scanData: { reason: 'Barcode not found' },
        });

        return {
          success: false,
          message: 'Barcode not found',
        };
      }

      // Validate barcode integrity
      const barcodeData: BarcodeData = {
        id: barcodeRecord.barcode_id,
        type: barcodeRecord.type,
        data: barcodeRecord.data,
        checksum: barcodeRecord.checksum,
        createdAt: barcodeRecord.created_at,
      };

      if (!BarcodeGenerator.validateBarcode(barcodeData)) {
        await this.barcodeModel.recordScan({
          barcodeId: barcodeRecord.barcode_id,
          scannedBy,
          scanLocation,
          scanDevice,
          scanResult: 'invalid',
          scanData: { reason: 'Checksum validation failed' },
        });

        return {
          success: false,
          message: 'Invalid barcode - data integrity check failed',
        };
      }

      // Get entity data based on barcode type
      const entityData = await this.getEntityData(barcodeRecord);

      // Record successful scan
      const scanRecord = await this.barcodeModel.recordScan({
        barcodeId: barcodeRecord.barcode_id,
        scannedBy,
        scanLocation,
        scanDevice,
        scanResult: 'success',
        scanData: { entityType: barcodeRecord.entity_type },
      });

      // Publish scan event
      await this.db.publishEvent('barcode', 'scanned', {
        barcodeId: barcodeRecord.barcode_id,
        type: barcodeRecord.type,
        entityId: barcodeRecord.entity_id,
        branchId: barcodeRecord.branch_id,
        scannedBy,
        scanLocation,
        scanDevice,
      });

      logger.info('Barcode scanned successfully', {
        barcodeId: barcodeRecord.barcode_id,
        type: barcodeRecord.type,
        scannedBy,
        scanLocation,
      });

      return {
        success: true,
        barcodeData,
        entityData,
        message: 'Barcode scanned successfully',
        scanRecord,
      };

    } catch (error) {
      logger.error('Error scanning barcode:', error);
      return {
        success: false,
        message: 'Error processing barcode scan',
      };
    }
  }

  /**
   * Get barcode by entity
   */
  async getBarcodesByEntity(entityId: string, entityType: string): Promise<BarcodeRecord[]> {
    return this.barcodeModel.findByEntityId(entityId, entityType);
  }

  /**
   * Get branch barcodes
   */
  async getBranchBarcodes(branchId: string, type?: BarcodeType): Promise<BarcodeRecord[]> {
    return this.barcodeModel.findByBranch(branchId, type);
  }

  /**
   * Record barcode print
   */
  async recordPrint(barcodeId: string): Promise<void> {
    await this.barcodeModel.recordPrint(barcodeId);
    
    await this.db.publishEvent('barcode', 'printed', {
      barcodeId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Deactivate barcode
   */
  async deactivateBarcode(barcodeId: string): Promise<void> {
    await this.barcodeModel.deactivate(barcodeId);
    
    await this.db.publishEvent('barcode', 'deactivated', {
      barcodeId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get scan history
   */
  async getScanHistory(barcodeId: string, limit?: number): Promise<ScanRecord[]> {
    return this.barcodeModel.getScanHistory(barcodeId, limit);
  }

  /**
   * Get branch scan activity report
   */
  async getBranchScanActivity(branchId: string, startDate: Date, endDate: Date) {
    return this.barcodeModel.getBranchScanActivity(branchId, startDate, endDate);
  }

  /**
   * Get most scanned products
   */
  async getMostScannedProducts(branchId: string, limit?: number) {
    return this.barcodeModel.getMostScannedProducts(branchId, limit);
  }

  /**
   * Bulk generate barcodes for inventory items
   */
  async bulkGenerateInventoryBarcodes(branchId: string): Promise<{
    generated: number;
    errors: string[];
  }> {
    try {
      const inventoryItems = await this.inventoryModel.findByBranch(branchId);
      let generated = 0;
      const errors: string[] = [];

      for (const item of inventoryItems) {
        try {
          // Check if barcode already exists
          const existingBarcodes = await this.barcodeModel.findByEntityId(item.id, 'inventory_item');
          if (existingBarcodes.length > 0) {
            continue; // Skip if barcode already exists
          }

          await this.generateInventoryBarcode({
            inventoryItemId: item.id,
            productId: item.productId,
            branchId: item.branchId,
            locationCode: item.locationCode,
            batchNumber: item.batchNumber,
          });

          generated++;
        } catch (error) {
          errors.push(`Item ${item.id}: ${(error as Error).message}`);
        }
      }

      logger.info('Bulk barcode generation completed', {
        branchId,
        generated,
        errors: errors.length,
      });

      return { generated, errors };
    } catch (error) {
      logger.error('Error in bulk barcode generation:', error);
      throw error;
    }
  }

  /**
   * Get entity data based on barcode type
   */
  private async getEntityData(barcodeRecord: BarcodeRecord): Promise<any> {
    switch (barcodeRecord.type) {
      case BarcodeType.PRODUCT:
        return this.getProductData(barcodeRecord.data.productId);
      
      case BarcodeType.INVENTORY_ITEM:
        return this.getInventoryItemData(barcodeRecord.data.inventoryItemId);
      
      case BarcodeType.REPACK_ORDER:
        return this.getRepackOrderData(barcodeRecord.data.repackOrderId);
      
      case BarcodeType.BATCH:
        return this.getBatchData(barcodeRecord.data.productId, barcodeRecord.data.batchNumber);
      
      default:
        return barcodeRecord.data;
    }
  }

  private async getProductData(productId: string) {
    const query = `
      SELECT * FROM public.products 
      WHERE id = $1
    `;
    
    const result = await this.db.query(query, [productId]);
    return result.rows[0] || null;
  }

  private async getInventoryItemData(inventoryItemId: string) {
    return this.inventoryModel.findById(inventoryItemId);
  }

  private async getRepackOrderData(repackOrderId: string) {
    return this.repackModel.findById(repackOrderId);
  }

  private async getBatchData(productId: string, batchNumber: string) {
    const query = `
      SELECT 
        ii.*,
        p.name as product_name,
        p.category,
        COUNT(*) OVER() as total_items
      FROM inventory.inventory_items ii
      JOIN public.products p ON ii.product_id = p.id
      WHERE ii.product_id = $1 AND ii.batch_number = $2
    `;
    
    const result = await this.db.query(query, [productId, batchNumber]);
    return result.rows;
  }
}

export default BarcodeService;