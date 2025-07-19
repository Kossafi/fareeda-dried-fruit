import { BarcodeService } from '../services/BarcodeService';
import { BarcodeModel } from '../models/Barcode';
import { InventoryItemModel } from '../models/InventoryItem';
import { RepackOrderModel } from '../models/RepackOrder';
import { BarcodeType, UnitType } from '@dried-fruits/types';
import BarcodeGenerator from '../utils/barcodeGenerator';

// Mock the database connection and models
jest.mock('../database/connection');
jest.mock('../models/Barcode');
jest.mock('../models/InventoryItem');
jest.mock('../models/RepackOrder');
jest.mock('../utils/barcodeGenerator');

describe('BarcodeService', () => {
  let barcodeService: BarcodeService;
  let mockBarcodeModel: jest.Mocked<BarcodeModel>;
  let mockInventoryModel: jest.Mocked<InventoryItemModel>;
  let mockRepackModel: jest.Mocked<RepackOrderModel>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    barcodeService = new BarcodeService();
    
    mockBarcodeModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEntityId: jest.fn(),
      findByBranch: jest.fn(),
      findByCode128: jest.fn(),
      findByEAN13: jest.fn(),
      recordScan: jest.fn(),
      recordPrint: jest.fn(),
      deactivate: jest.fn(),
      getScanHistory: jest.fn(),
      getBranchScanActivity: jest.fn(),
      getMostScannedProducts: jest.fn(),
    } as any;

    mockInventoryModel = {
      findById: jest.fn(),
      findByBranch: jest.fn(),
    } as any;

    mockRepackModel = {
      findById: jest.fn(),
    } as any;

    // Replace the models in the service
    (barcodeService as any).barcodeModel = mockBarcodeModel;
    (barcodeService as any).inventoryModel = mockInventoryModel;
    (barcodeService as any).repackModel = mockRepackModel;

    // Mock database
    const mockDb = require('../database/connection').default.getInstance();
    mockDb.query = jest.fn();
    mockDb.publishEvent = jest.fn();
  });

  describe('generateProductBarcode', () => {
    const productBarcodeData = {
      productId: 'product-123',
      branchId: 'branch-123',
      batchNumber: 'BATCH001',
      unit: UnitType.KILOGRAM,
      quantity: 10,
    };

    const mockBarcodeData = {
      id: 'PRD-12345678-abc123-xyz',
      type: BarcodeType.PRODUCT,
      data: productBarcodeData,
      checksum: 'abcd1234efgh5678',
      createdAt: new Date(),
    };

    const mockBarcodeRecord = {
      id: 'uuid-123',
      barcode_id: 'PRD-12345678-abc123-xyz',
      type: BarcodeType.PRODUCT,
      entity_id: 'product-123',
      entity_type: 'product',
      branch_id: 'branch-123',
      data: productBarcodeData,
      checksum: 'abcd1234efgh5678',
      code128: 'PRD12345678ABC123XYZ',
      ean13: '1234567890123',
      qr_data: '{"id":"PRD-12345678-abc123-xyz","type":"product"}',
      is_active: true,
      printed_count: 0,
      scanned_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    beforeEach(() => {
      (BarcodeGenerator.generateProductBarcode as jest.Mock).mockReturnValue(mockBarcodeData);
      (BarcodeGenerator.generateCode128 as jest.Mock).mockReturnValue('PRD12345678ABC123XYZ');
      (BarcodeGenerator.generateEAN13 as jest.Mock).mockReturnValue('1234567890123');
      (BarcodeGenerator.generateQRCodeData as jest.Mock).mockReturnValue('{"id":"PRD-12345678-abc123-xyz","type":"product"}');
    });

    it('should generate product barcode successfully', async () => {
      // Mock product exists
      const mockDb = require('../database/connection').default.getInstance();
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'product-123', name: 'Test Product' }],
      });

      mockBarcodeModel.create.mockResolvedValue(mockBarcodeRecord as any);

      const result = await barcodeService.generateProductBarcode(productBarcodeData);

      expect(BarcodeGenerator.generateProductBarcode).toHaveBeenCalledWith(productBarcodeData);
      expect(mockBarcodeModel.create).toHaveBeenCalledWith(
        mockBarcodeData,
        {
          code128: 'PRD12345678ABC123XYZ',
          ean13: '1234567890123',
          qrData: '{"id":"PRD-12345678-abc123-xyz","type":"product"}',
          entityType: 'product',
          entityId: 'product-123',
        }
      );
      expect(mockDb.publishEvent).toHaveBeenCalledWith('barcode', 'generated', expect.any(Object));
      expect(result).toEqual(mockBarcodeRecord);
    });

    it('should throw error for non-existent product', async () => {
      const mockDb = require('../database/connection').default.getInstance();
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(barcodeService.generateProductBarcode(productBarcodeData))
        .rejects.toThrow('Product not found: product-123');
    });
  });

  describe('generateInventoryBarcode', () => {
    const inventoryBarcodeData = {
      inventoryItemId: 'inventory-123',
      productId: 'product-123',
      branchId: 'branch-123',
      locationCode: 'A1-B2-C3',
      batchNumber: 'BATCH001',
    };

    const mockInventoryItem = {
      id: 'inventory-123',
      productId: 'product-123',
      branchId: 'branch-123',
      currentStock: 100,
    };

    it('should generate inventory barcode successfully', async () => {
      mockInventoryModel.findById.mockResolvedValue(mockInventoryItem as any);
      
      const mockBarcodeData = {
        id: 'INV-87654321-def456-abc',
        type: BarcodeType.INVENTORY_ITEM,
        data: inventoryBarcodeData,
        checksum: 'efgh5678ijkl9012',
        createdAt: new Date(),
      };

      (BarcodeGenerator.generateInventoryBarcode as jest.Mock).mockReturnValue(mockBarcodeData);
      (BarcodeGenerator.generateCode128 as jest.Mock).mockReturnValue('INV87654321DEF456ABC');
      (BarcodeGenerator.generateQRCodeData as jest.Mock).mockReturnValue('{"id":"INV-87654321-def456-abc","type":"inventory_item"}');

      const mockBarcodeRecord = {
        barcode_id: 'INV-87654321-def456-abc',
        type: BarcodeType.INVENTORY_ITEM,
        code128: 'INV87654321DEF456ABC',
        created_at: new Date(),
      };

      mockBarcodeModel.create.mockResolvedValue(mockBarcodeRecord as any);

      const result = await barcodeService.generateInventoryBarcode(inventoryBarcodeData);

      expect(mockInventoryModel.findById).toHaveBeenCalledWith('inventory-123');
      expect(BarcodeGenerator.generateInventoryBarcode).toHaveBeenCalledWith(inventoryBarcodeData);
      expect(result).toEqual(mockBarcodeRecord);
    });

    it('should throw error for non-existent inventory item', async () => {
      mockInventoryModel.findById.mockResolvedValue(null);

      await expect(barcodeService.generateInventoryBarcode(inventoryBarcodeData))
        .rejects.toThrow('Inventory item not found: inventory-123');
    });
  });

  describe('scanBarcode', () => {
    const mockBarcodeRecord = {
      id: 'uuid-123',
      barcode_id: 'PRD-12345678-abc123-xyz',
      type: BarcodeType.PRODUCT,
      entity_id: 'product-123',
      entity_type: 'product',
      branch_id: 'branch-123',
      data: { productId: 'product-123', branchId: 'branch-123' },
      checksum: 'abcd1234efgh5678',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should scan barcode successfully', async () => {
      mockBarcodeModel.findById.mockResolvedValue(mockBarcodeRecord as any);
      
      (BarcodeGenerator.validateBarcode as jest.Mock).mockReturnValue(true);

      const mockScanRecord = {
        id: 'scan-123',
        barcode_id: 'PRD-12345678-abc123-xyz',
        scanned_by: 'user-123',
        scan_result: 'success',
        created_at: new Date(),
      };

      mockBarcodeModel.recordScan.mockResolvedValue(mockScanRecord as any);

      // Mock getEntityData
      const mockDb = require('../database/connection').default.getInstance();
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'product-123', name: 'Test Product' }],
      });

      const result = await barcodeService.scanBarcode('PRD-12345678-abc123-xyz', 'user-123', 'warehouse-A');

      expect(result.success).toBe(true);
      expect(result.barcodeData).toBeDefined();
      expect(result.entityData).toBeDefined();
      expect(result.scanRecord).toEqual(mockScanRecord);
      expect(mockBarcodeModel.recordScan).toHaveBeenCalledWith({
        barcodeId: 'PRD-12345678-abc123-xyz',
        scannedBy: 'user-123',
        scanLocation: 'warehouse-A',
        scanDevice: undefined,
        scanResult: 'success',
        scanData: { entityType: 'product' },
      });
    });

    it('should return failure for non-existent barcode', async () => {
      mockBarcodeModel.findById.mockResolvedValue(null);
      mockBarcodeModel.findByCode128.mockResolvedValue(null);
      mockBarcodeModel.findByEAN13.mockResolvedValue(null);
      mockBarcodeModel.recordScan.mockResolvedValue({} as any);

      const result = await barcodeService.scanBarcode('INVALID-BARCODE', 'user-123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Barcode not found');
      expect(mockBarcodeModel.recordScan).toHaveBeenCalledWith({
        barcodeId: 'INVALID-BARCODE',
        scannedBy: 'user-123',
        scanLocation: undefined,
        scanDevice: undefined,
        scanResult: 'invalid',
        scanData: { reason: 'Barcode not found' },
      });
    });

    it('should return failure for invalid checksum', async () => {
      mockBarcodeModel.findById.mockResolvedValue(mockBarcodeRecord as any);
      (BarcodeGenerator.validateBarcode as jest.Mock).mockReturnValue(false);
      mockBarcodeModel.recordScan.mockResolvedValue({} as any);

      const result = await barcodeService.scanBarcode('PRD-12345678-abc123-xyz', 'user-123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid barcode - data integrity check failed');
      expect(mockBarcodeModel.recordScan).toHaveBeenCalledWith({
        barcodeId: 'PRD-12345678-abc123-xyz',
        scannedBy: 'user-123',
        scanLocation: undefined,
        scanDevice: undefined,
        scanResult: 'invalid',
        scanData: { reason: 'Checksum validation failed' },
      });
    });
  });

  describe('bulkGenerateInventoryBarcodes', () => {
    it('should generate barcodes for all inventory items in branch', async () => {
      const mockInventoryItems = [
        {
          id: 'item-1',
          productId: 'product-1',
          branchId: 'branch-123',
          locationCode: 'A1',
          batchNumber: 'BATCH001',
        },
        {
          id: 'item-2',
          productId: 'product-2',
          branchId: 'branch-123',
          locationCode: 'A2',
          batchNumber: 'BATCH002',
        },
      ];

      mockInventoryModel.findByBranch.mockResolvedValue(mockInventoryItems as any);
      mockBarcodeModel.findByEntityId.mockResolvedValue([]); // No existing barcodes

      // Mock successful barcode generation
      (BarcodeGenerator.generateInventoryBarcode as jest.Mock).mockReturnValue({
        id: 'test-barcode',
        type: BarcodeType.INVENTORY_ITEM,
        data: {},
        checksum: 'test',
        createdAt: new Date(),
      });

      mockBarcodeModel.create.mockResolvedValue({} as any);

      const mockDb = require('../database/connection').default.getInstance();
      mockDb.publishEvent.mockResolvedValue(undefined);

      const result = await barcodeService.bulkGenerateInventoryBarcodes('branch-123');

      expect(result.generated).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockInventoryModel.findByBranch).toHaveBeenCalledWith('branch-123');
    });

    it('should skip items that already have barcodes', async () => {
      const mockInventoryItems = [
        {
          id: 'item-1',
          productId: 'product-1',
          branchId: 'branch-123',
        },
      ];

      mockInventoryModel.findByBranch.mockResolvedValue(mockInventoryItems as any);
      
      // Mock existing barcode
      mockBarcodeModel.findByEntityId.mockResolvedValue([
        { barcode_id: 'existing-barcode' }
      ] as any);

      const result = await barcodeService.bulkGenerateInventoryBarcodes('branch-123');

      expect(result.generated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getBarcodesByEntity', () => {
    it('should return barcodes for entity', async () => {
      const mockBarcodes = [
        { barcode_id: 'barcode-1', type: BarcodeType.PRODUCT },
        { barcode_id: 'barcode-2', type: BarcodeType.PRODUCT },
      ];

      mockBarcodeModel.findByEntityId.mockResolvedValue(mockBarcodes as any);

      const result = await barcodeService.getBarcodesByEntity('product-123', 'product');

      expect(mockBarcodeModel.findByEntityId).toHaveBeenCalledWith('product-123', 'product');
      expect(result).toEqual(mockBarcodes);
    });
  });

  describe('recordPrint', () => {
    it('should record barcode print', async () => {
      mockBarcodeModel.recordPrint.mockResolvedValue(undefined);

      const mockDb = require('../database/connection').default.getInstance();
      mockDb.publishEvent.mockResolvedValue(undefined);

      await barcodeService.recordPrint('barcode-123');

      expect(mockBarcodeModel.recordPrint).toHaveBeenCalledWith('barcode-123');
      expect(mockDb.publishEvent).toHaveBeenCalledWith('barcode', 'printed', {
        barcodeId: 'barcode-123',
        timestamp: expect.any(String),
      });
    });
  });

  describe('deactivateBarcode', () => {
    it('should deactivate barcode', async () => {
      mockBarcodeModel.deactivate.mockResolvedValue(undefined);

      const mockDb = require('../database/connection').default.getInstance();
      mockDb.publishEvent.mockResolvedValue(undefined);

      await barcodeService.deactivateBarcode('barcode-123');

      expect(mockBarcodeModel.deactivate).toHaveBeenCalledWith('barcode-123');
      expect(mockDb.publishEvent).toHaveBeenCalledWith('barcode', 'deactivated', {
        barcodeId: 'barcode-123',
        timestamp: expect.any(String),
      });
    });
  });
});