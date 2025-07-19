import crypto from 'crypto';
import { BarcodeType, UnitType } from '@dried-fruits/types';

export interface BarcodeData {
  id: string;
  type: BarcodeType;
  data: any;
  checksum: string;
  createdAt: Date;
}

export interface ProductBarcodeData {
  productId: string;
  branchId: string;
  batchNumber?: string;
  expirationDate?: Date;
  unit: UnitType;
  quantity?: number;
}

export interface InventoryBarcodeData {
  inventoryItemId: string;
  productId: string;
  branchId: string;
  locationCode?: string;
  batchNumber?: string;
}

export interface RepackBarcodeData {
  repackOrderId: string;
  targetProductId: string;
  branchId: string;
  expectedQuantity: number;
  unit: UnitType;
}

export class BarcodeGenerator {
  private static readonly PREFIX_PRODUCT = 'PRD';
  private static readonly PREFIX_INVENTORY = 'INV';
  private static readonly PREFIX_REPACK = 'RPK';
  private static readonly PREFIX_BATCH = 'BCH';
  
  /**
   * Generate barcode for product
   */
  static generateProductBarcode(data: ProductBarcodeData): BarcodeData {
    const payload = {
      productId: data.productId,
      branchId: data.branchId,
      batchNumber: data.batchNumber,
      expirationDate: data.expirationDate?.toISOString(),
      unit: data.unit,
      quantity: data.quantity,
    };

    const barcodeId = this.generateBarcodeId(this.PREFIX_PRODUCT, data.productId, data.branchId);
    const checksum = this.calculateChecksum(JSON.stringify(payload));

    return {
      id: barcodeId,
      type: BarcodeType.PRODUCT,
      data: payload,
      checksum,
      createdAt: new Date(),
    };
  }

  /**
   * Generate barcode for inventory item
   */
  static generateInventoryBarcode(data: InventoryBarcodeData): BarcodeData {
    const payload = {
      inventoryItemId: data.inventoryItemId,
      productId: data.productId,
      branchId: data.branchId,
      locationCode: data.locationCode,
      batchNumber: data.batchNumber,
    };

    const barcodeId = this.generateBarcodeId(this.PREFIX_INVENTORY, data.inventoryItemId, data.branchId);
    const checksum = this.calculateChecksum(JSON.stringify(payload));

    return {
      id: barcodeId,
      type: BarcodeType.INVENTORY_ITEM,
      data: payload,
      checksum,
      createdAt: new Date(),
    };
  }

  /**
   * Generate barcode for repack order
   */
  static generateRepackBarcode(data: RepackBarcodeData): BarcodeData {
    const payload = {
      repackOrderId: data.repackOrderId,
      targetProductId: data.targetProductId,
      branchId: data.branchId,
      expectedQuantity: data.expectedQuantity,
      unit: data.unit,
    };

    const barcodeId = this.generateBarcodeId(this.PREFIX_REPACK, data.repackOrderId, data.branchId);
    const checksum = this.calculateChecksum(JSON.stringify(payload));

    return {
      id: barcodeId,
      type: BarcodeType.REPACK_ORDER,
      data: payload,
      checksum,
      createdAt: new Date(),
    };
  }

  /**
   * Generate batch tracking barcode
   */
  static generateBatchBarcode(productId: string, batchNumber: string, branchId: string): BarcodeData {
    const payload = {
      productId,
      batchNumber,
      branchId,
      type: 'batch_tracking',
    };

    const barcodeId = this.generateBarcodeId(this.PREFIX_BATCH, batchNumber, branchId);
    const checksum = this.calculateChecksum(JSON.stringify(payload));

    return {
      id: barcodeId,
      type: BarcodeType.BATCH,
      data: payload,
      checksum,
      createdAt: new Date(),
    };
  }

  /**
   * Generate Code 128 barcode string
   */
  static generateCode128(data: string): string {
    // Simplified Code 128 generation - in production use a proper library
    const sanitized = data.replace(/[^A-Za-z0-9\-_]/g, '').toUpperCase();
    return sanitized.substring(0, 20); // Limit length for practicality
  }

  /**
   * Generate EAN-13 barcode for products
   */
  static generateEAN13(productId: string, branchId: string): string {
    // Create a 12-digit number from productId and branchId
    const productHash = this.hashToNumber(productId, 6);
    const branchHash = this.hashToNumber(branchId, 5);
    
    const code12 = `${productHash}${branchHash}`;
    const checkDigit = this.calculateEAN13CheckDigit(code12);
    
    return `${code12}${checkDigit}`;
  }

  /**
   * Generate QR code data string
   */
  static generateQRCodeData(barcodeData: BarcodeData): string {
    return JSON.stringify({
      id: barcodeData.id,
      type: barcodeData.type,
      data: barcodeData.data,
      checksum: barcodeData.checksum,
      timestamp: barcodeData.createdAt.getTime(),
    });
  }

  /**
   * Validate barcode data integrity
   */
  static validateBarcode(barcodeData: BarcodeData): boolean {
    const expectedChecksum = this.calculateChecksum(JSON.stringify(barcodeData.data));
    return expectedChecksum === barcodeData.checksum;
  }

  /**
   * Parse barcode ID to extract components
   */
  static parseBarcodeId(barcodeId: string): {
    prefix: string;
    entityId: string;
    branchId: string;
    timestamp: string;
  } | null {
    const parts = barcodeId.split('-');
    if (parts.length !== 4) {
      return null;
    }

    return {
      prefix: parts[0],
      entityId: parts[1],
      branchId: parts[2],
      timestamp: parts[3],
    };
  }

  /**
   * Generate unique barcode ID
   */
  private static generateBarcodeId(prefix: string, entityId: string, branchId: string): string {
    const timestamp = Date.now().toString(36);
    const entityHash = crypto.createHash('md5').update(entityId).digest('hex').substring(0, 8);
    const branchHash = crypto.createHash('md5').update(branchId).digest('hex').substring(0, 6);
    
    return `${prefix}-${entityHash}-${branchHash}-${timestamp}`;
  }

  /**
   * Calculate checksum for data integrity
   */
  private static calculateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Hash string to fixed-length number
   */
  private static hashToNumber(input: string, length: number): string {
    const hash = crypto.createHash('md5').update(input).digest('hex');
    const number = parseInt(hash.substring(0, 8), 16);
    return number.toString().substring(0, length).padStart(length, '0');
  }

  /**
   * Calculate EAN-13 check digit
   */
  private static calculateEAN13CheckDigit(code12: string): string {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code12[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit.toString();
  }
}

export default BarcodeGenerator;