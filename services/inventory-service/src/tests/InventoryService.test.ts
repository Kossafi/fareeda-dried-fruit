import { InventoryService } from '../services/InventoryService';
import { InventoryItemModel } from '../models/InventoryItem';
import { StockMovementModel } from '../models/StockMovement';
import { UnitType, StockMovementType } from '@dried-fruits/types';

// Mock the database connection
jest.mock('../database/connection');

describe('InventoryService', () => {
  let inventoryService: InventoryService;
  let mockInventoryModel: jest.Mocked<InventoryItemModel>;
  let mockStockMovementModel: jest.Mocked<StockMovementModel>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create service instance
    inventoryService = new InventoryService();
    
    // Mock the models
    mockInventoryModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findByProductAndBranch: jest.fn(),
      findByBranch: jest.fn(),
      updateStock: jest.fn(),
      adjustStock: jest.fn(),
    } as any;

    mockStockMovementModel = {
      findById: jest.fn(),
      findByInventoryItem: jest.fn(),
      findByBranch: jest.fn(),
      getStockSummary: jest.fn(),
    } as any;

    // Replace the models in the service
    (inventoryService as any).inventoryModel = mockInventoryModel;
    (inventoryService as any).stockMovementModel = mockStockMovementModel;
  });

  describe('createInventoryItem', () => {
    const validItemData = {
      productId: 'product-123',
      branchId: 'branch-123',
      currentStock: 100,
      unit: UnitType.KILOGRAM,
      minStockLevel: 10,
      maxStockLevel: 500,
      reorderPoint: 20,
      reorderQuantity: 100,
      cost: 50.00,
      batchNumber: 'BATCH001',
    };

    it('should create inventory item successfully', async () => {
      const expectedItem = {
        id: 'item-123',
        ...validItemData,
        reservedStock: 0,
        availableStock: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInventoryModel.findByProductAndBranch.mockResolvedValue([]);
      mockInventoryModel.create.mockResolvedValue(expectedItem as any);
      mockInventoryModel.adjustStock.mockResolvedValue({
        item: expectedItem as any,
        movementId: 'movement-123',
      });

      const result = await inventoryService.createInventoryItem(validItemData, 'user-123');

      expect(mockInventoryModel.findByProductAndBranch).toHaveBeenCalledWith(
        'product-123',
        'branch-123',
        'BATCH001'
      );
      expect(mockInventoryModel.create).toHaveBeenCalledWith(validItemData);
      expect(result).toEqual(expectedItem);
    });

    it('should throw error if item already exists', async () => {
      mockInventoryModel.findByProductAndBranch.mockResolvedValue([{ id: 'existing-item' }] as any);

      await expect(inventoryService.createInventoryItem(validItemData, 'user-123'))
        .rejects.toThrow('Inventory item already exists for this product-branch-batch combination');
    });

    it('should throw error for negative stock', async () => {
      const invalidData = { ...validItemData, currentStock: -10 };

      await expect(inventoryService.createInventoryItem(invalidData, 'user-123'))
        .rejects.toThrow('Current stock cannot be negative');
    });

    it('should throw error for invalid min/max stock levels', async () => {
      const invalidData = { ...validItemData, maxStockLevel: 5 };

      await expect(inventoryService.createInventoryItem(invalidData, 'user-123'))
        .rejects.toThrow('Maximum stock level cannot be less than minimum stock level');
    });
  });

  describe('adjustStock', () => {
    const mockItem = {
      id: 'item-123',
      productId: 'product-123',
      branchId: 'branch-123',
      currentStock: 100,
      reservedStock: 10,
      availableStock: 90,
      unit: UnitType.KILOGRAM,
    };

    const mockMovement = {
      id: 'movement-123',
      inventoryItemId: 'item-123',
      type: StockMovementType.INCOMING,
      quantity: 50,
      unit: UnitType.KILOGRAM,
      previousStock: 100,
      newStock: 150,
      reason: 'Stock replenishment',
      performedBy: 'user-123',
      createdAt: new Date(),
    };

    it('should adjust stock successfully', async () => {
      const adjustment = {
        quantity: 50,
        type: StockMovementType.INCOMING,
        reason: 'Stock replenishment',
      };

      mockInventoryModel.adjustStock.mockResolvedValue({
        item: mockItem as any,
        movementId: 'movement-123',
      });
      mockStockMovementModel.findById.mockResolvedValue(mockMovement as any);

      const result = await inventoryService.adjustStock('item-123', adjustment, 'user-123');

      expect(mockInventoryModel.adjustStock).toHaveBeenCalledWith('item-123', {
        ...adjustment,
        performedBy: 'user-123',
      });
      expect(result.item).toEqual(mockItem);
      expect(result.movement).toEqual(mockMovement);
    });

    it('should throw error for zero quantity', async () => {
      const adjustment = {
        quantity: 0,
        type: StockMovementType.INCOMING,
        reason: 'Invalid adjustment',
      };

      await expect(inventoryService.adjustStock('item-123', adjustment, 'user-123'))
        .rejects.toThrow('Adjustment quantity cannot be zero');
    });

    it('should throw error for empty reason', async () => {
      const adjustment = {
        quantity: 50,
        type: StockMovementType.INCOMING,
        reason: '',
      };

      await expect(inventoryService.adjustStock('item-123', adjustment, 'user-123'))
        .rejects.toThrow('Reason is required for stock adjustment');
    });
  });

  describe('reserveStock', () => {
    const mockItem = {
      id: 'item-123',
      currentStock: 100,
      reservedStock: 10,
      availableStock: 90,
    };

    it('should reserve stock successfully', async () => {
      const updatedItem = {
        ...mockItem,
        reservedStock: 30,
        availableStock: 70,
      };

      mockInventoryModel.findById.mockResolvedValue(mockItem as any);
      mockInventoryModel.updateStock.mockResolvedValue(updatedItem as any);

      const result = await inventoryService.reserveStock('item-123', 20, 'user-123');

      expect(mockInventoryModel.updateStock).toHaveBeenCalledWith('item-123', {
        reservedStock: 30,
      });
      expect(result).toEqual(updatedItem);
    });

    it('should throw error for insufficient stock', async () => {
      mockInventoryModel.findById.mockResolvedValue(mockItem as any);

      await expect(inventoryService.reserveStock('item-123', 100, 'user-123'))
        .rejects.toThrow('Insufficient available stock for reservation');
    });

    it('should throw error for invalid quantity', async () => {
      await expect(inventoryService.reserveStock('item-123', -10, 'user-123'))
        .rejects.toThrow('Reserve quantity must be positive');
    });
  });

  describe('validateStockAvailability', () => {
    it('should validate stock availability successfully', async () => {
      const requests = [
        { inventoryItemId: 'item-1', quantity: 10 },
        { inventoryItemId: 'item-2', quantity: 20 },
      ];

      mockInventoryModel.findById
        .mockResolvedValueOnce({ availableStock: 50 } as any)
        .mockResolvedValueOnce({ availableStock: 30 } as any);

      const result = await inventoryService.validateStockAvailability(requests);

      expect(result.isValid).toBe(true);
      expect(result.validationResults).toHaveLength(2);
      expect(result.validationResults[0].isValid).toBe(true);
      expect(result.validationResults[1].isValid).toBe(true);
    });

    it('should detect insufficient stock', async () => {
      const requests = [
        { inventoryItemId: 'item-1', quantity: 100 },
      ];

      mockInventoryModel.findById.mockResolvedValue({ availableStock: 50 } as any);

      const result = await inventoryService.validateStockAvailability(requests);

      expect(result.isValid).toBe(false);
      expect(result.validationResults[0].isValid).toBe(false);
      expect(result.validationResults[0].message).toBe('Insufficient stock');
    });

    it('should handle non-existent items', async () => {
      const requests = [
        { inventoryItemId: 'non-existent', quantity: 10 },
      ];

      mockInventoryModel.findById.mockResolvedValue(null);

      const result = await inventoryService.validateStockAvailability(requests);

      expect(result.isValid).toBe(false);
      expect(result.validationResults[0].isValid).toBe(false);
      expect(result.validationResults[0].message).toBe('Inventory item not found');
    });
  });
});