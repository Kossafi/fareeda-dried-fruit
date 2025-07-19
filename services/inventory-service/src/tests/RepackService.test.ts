import { RepackService } from '../services/RepackService';
import { RepackOrderModel } from '../models/RepackOrder';
import { InventoryItemModel } from '../models/InventoryItem';
import { UnitType, RepackOrderStatus } from '@dried-fruits/types';

// Mock the database connection
jest.mock('../database/connection');

describe('RepackService', () => {
  let repackService: RepackService;
  let mockRepackModel: jest.Mocked<RepackOrderModel>;
  let mockInventoryModel: jest.Mocked<InventoryItemModel>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create service instance
    repackService = new RepackService();
    
    // Mock the models
    mockRepackModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findByBranch: jest.fn(),
      updateStatus: jest.fn(),
      updateSourceItemActual: jest.fn(),
      validateRepackFeasibility: jest.fn(),
      getReadyForProcessing: jest.fn(),
    } as any;

    mockInventoryModel = {
      findById: jest.fn(),
      findByProductAndBranch: jest.fn(),
      create: jest.fn(),
      updateStock: jest.fn(),
      adjustStock: jest.fn(),
    } as any;

    // Replace the models in the service
    (repackService as any).repackModel = mockRepackModel;
    (repackService as any).inventoryModel = mockInventoryModel;
  });

  describe('createRepackOrder', () => {
    const validOrderData = {
      branchId: 'branch-123',
      targetProductId: 'target-product-123',
      expectedQuantity: 50,
      targetUnit: UnitType.KILOGRAM,
      sourceItems: [
        {
          inventoryItemId: 'item-1',
          requiredQuantity: 20,
          unit: UnitType.KILOGRAM,
        },
        {
          inventoryItemId: 'item-2',
          requiredQuantity: 30,
          unit: UnitType.KILOGRAM,
        },
      ],
      scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      notes: 'Test repack order',
    };

    const mockInventoryItems = [
      {
        id: 'item-1',
        productId: 'source-product-1',
        branchId: 'branch-123',
        availableStock: 100,
        reservedStock: 0,
      },
      {
        id: 'item-2',
        productId: 'source-product-2',
        branchId: 'branch-123',
        availableStock: 80,
        reservedStock: 0,
      },
    ];

    it('should create repack order successfully', async () => {
      const expectedOrder = {
        id: 'repack-123',
        repackNumber: 'RPK-001',
        branchId: 'branch-123',
        status: RepackOrderStatus.PLANNED,
        targetProduct: {
          productId: 'target-product-123',
          expectedQuantity: 50,
          unit: UnitType.KILOGRAM,
        },
        sourceItems: validOrderData.sourceItems,
        scheduledDate: validOrderData.scheduledDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock inventory item lookups
      mockInventoryModel.findById
        .mockResolvedValueOnce(mockInventoryItems[0] as any)
        .mockResolvedValueOnce(mockInventoryItems[1] as any);

      // Mock target product lookup
      mockInventoryModel.findByProductAndBranch.mockResolvedValue([]);
      
      // Mock product query
      const mockDb = require('../database/connection').default.getInstance();
      mockDb.query = jest.fn().mockResolvedValue({
        rows: [{ id: 'target-product-123', name: 'Target Product' }],
      });

      mockInventoryModel.create.mockResolvedValue({} as any);
      mockRepackModel.create.mockResolvedValue(expectedOrder as any);
      mockInventoryModel.updateStock.mockResolvedValue({} as any);

      const result = await repackService.createRepackOrder(validOrderData, 'user-123');

      expect(mockRepackModel.create).toHaveBeenCalledWith({
        ...validOrderData,
        requestedBy: 'user-123',
      });
      expect(result).toEqual(expectedOrder);
    });

    it('should throw error for negative expected quantity', async () => {
      const invalidData = { ...validOrderData, expectedQuantity: -10 };

      await expect(repackService.createRepackOrder(invalidData, 'user-123'))
        .rejects.toThrow('Expected quantity must be positive');
    });

    it('should throw error for empty source items', async () => {
      const invalidData = { ...validOrderData, sourceItems: [] };

      await expect(repackService.createRepackOrder(invalidData, 'user-123'))
        .rejects.toThrow('At least one source item is required');
    });

    it('should throw error for past scheduled date', async () => {
      const invalidData = { 
        ...validOrderData, 
        scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      };

      await expect(repackService.createRepackOrder(invalidData, 'user-123'))
        .rejects.toThrow('Scheduled date cannot be in the past');
    });

    it('should throw error for insufficient stock', async () => {
      const insufficientStockItem = {
        ...mockInventoryItems[0],
        availableStock: 10, // Less than required 20
      };

      mockInventoryModel.findById
        .mockResolvedValueOnce(insufficientStockItem as any)
        .mockResolvedValueOnce(mockInventoryItems[1] as any);

      await expect(repackService.createRepackOrder(validOrderData, 'user-123'))
        .rejects.toThrow('Insufficient stock for item');
    });

    it('should throw error for cross-branch source items', async () => {
      const crossBranchItem = {
        ...mockInventoryItems[0],
        branchId: 'different-branch',
      };

      mockInventoryModel.findById
        .mockResolvedValueOnce(crossBranchItem as any)
        .mockResolvedValueOnce(mockInventoryItems[1] as any);

      await expect(repackService.createRepackOrder(validOrderData, 'user-123'))
        .rejects.toThrow('All source items must be from the same branch');
    });
  });

  describe('startRepackOrder', () => {
    const mockOrder = {
      id: 'repack-123',
      status: RepackOrderStatus.PLANNED,
      sourceItems: [
        { inventoryItemId: 'item-1', requiredQuantity: 20 },
        { inventoryItemId: 'item-2', requiredQuantity: 30 },
      ],
    };

    it('should start repack order successfully', async () => {
      const updatedOrder = {
        ...mockOrder,
        status: RepackOrderStatus.IN_PROGRESS,
        startedAt: new Date(),
      };

      mockRepackModel.findById.mockResolvedValue(mockOrder as any);
      mockRepackModel.validateRepackFeasibility.mockResolvedValue({
        isValid: true,
        validationResults: [],
      });
      mockRepackModel.updateStatus.mockResolvedValue(updatedOrder as any);

      const result = await repackService.startRepackOrder('repack-123', 'user-123', 'supervisor-123');

      expect(mockRepackModel.updateStatus).toHaveBeenCalledWith('repack-123', RepackOrderStatus.IN_PROGRESS, {
        startedAt: expect.any(Date),
        performedBy: 'user-123',
        supervisedBy: 'supervisor-123',
      });
      expect(result).toEqual(updatedOrder);
    });

    it('should throw error for non-existent order', async () => {
      mockRepackModel.findById.mockResolvedValue(null);

      await expect(repackService.startRepackOrder('non-existent', 'user-123'))
        .rejects.toThrow('Repack order not found');
    });

    it('should throw error for invalid status', async () => {
      const inProgressOrder = { ...mockOrder, status: RepackOrderStatus.IN_PROGRESS };
      mockRepackModel.findById.mockResolvedValue(inProgressOrder as any);

      await expect(repackService.startRepackOrder('repack-123', 'user-123'))
        .rejects.toThrow('Cannot start repack order with status: in_progress');
    });

    it('should throw error for infeasible repack', async () => {
      mockRepackModel.findById.mockResolvedValue(mockOrder as any);
      mockRepackModel.validateRepackFeasibility.mockResolvedValue({
        isValid: false,
        validationResults: [
          {
            inventoryItemId: 'item-1',
            isValid: false,
            availableStock: 10,
            requiredQuantity: 20,
            productName: 'Product 1',
            message: 'Insufficient stock',
          },
        ],
      });

      await expect(repackService.startRepackOrder('repack-123', 'user-123'))
        .rejects.toThrow('Insufficient stock for repack operation');
    });
  });

  describe('completeRepackOrder', () => {
    const mockOrder = {
      id: 'repack-123',
      repackNumber: 'RPK-001',
      branchId: 'branch-123',
      status: RepackOrderStatus.IN_PROGRESS,
      targetProduct: {
        productId: 'target-product-123',
        productName: 'Target Product',
        expectedQuantity: 50,
        unit: UnitType.KILOGRAM,
      },
      sourceItems: [
        { inventoryItemId: 'item-1', requiredQuantity: 20 },
        { inventoryItemId: 'item-2', requiredQuantity: 30 },
      ],
    };

    const actualResults = {
      actualQuantity: 45,
      sourceItemActuals: [
        { inventoryItemId: 'item-1', actualQuantity: 18 },
        { inventoryItemId: 'item-2', actualQuantity: 27 },
      ],
      notes: 'Completed successfully',
    };

    it('should complete repack order successfully', async () => {
      const updatedOrder = {
        ...mockOrder,
        status: RepackOrderStatus.COMPLETED,
        completedAt: new Date(),
      };

      const mockInventoryItems = [
        { id: 'item-1', currentStock: 100, averageCost: 10, reservedStock: 20 },
        { id: 'item-2', currentStock: 80, averageCost: 15, reservedStock: 30 },
      ];

      const mockTargetInventoryItem = {
        id: 'target-item-123',
        productId: 'target-product-123',
        branchId: 'branch-123',
      };

      mockRepackModel.findById.mockResolvedValue(mockOrder as any);
      
      // Mock database transaction
      const mockDb = require('../database/connection').default.getInstance();
      mockDb.transaction = jest.fn().mockImplementation(async (callback) => {
        return callback({});
      });

      mockRepackModel.updateSourceItemActual.mockResolvedValue(undefined);
      mockInventoryModel.findById
        .mockResolvedValueOnce(mockInventoryItems[0] as any)
        .mockResolvedValueOnce(mockInventoryItems[1] as any);
      
      mockInventoryModel.adjustStock.mockResolvedValue({ item: {}, movementId: 'movement-123' });
      mockInventoryModel.updateStock.mockResolvedValue({} as any);
      mockInventoryModel.findByProductAndBranch.mockResolvedValue([mockTargetInventoryItem] as any);
      mockRepackModel.updateStatus.mockResolvedValue(updatedOrder as any);

      const result = await repackService.completeRepackOrder('repack-123', actualResults, 'user-123');

      expect(mockRepackModel.updateStatus).toHaveBeenCalledWith('repack-123', RepackOrderStatus.COMPLETED, {
        completedAt: expect.any(Date),
        actualQuantity: 45,
        notes: 'Completed successfully',
      });
      expect(result).toEqual(updatedOrder);
    });

    it('should throw error for non-existent order', async () => {
      mockRepackModel.findById.mockResolvedValue(null);

      await expect(repackService.completeRepackOrder('non-existent', actualResults, 'user-123'))
        .rejects.toThrow('Repack order not found');
    });

    it('should throw error for invalid status', async () => {
      const completedOrder = { ...mockOrder, status: RepackOrderStatus.COMPLETED };
      mockRepackModel.findById.mockResolvedValue(completedOrder as any);

      await expect(repackService.completeRepackOrder('repack-123', actualResults, 'user-123'))
        .rejects.toThrow('Cannot complete repack order with status: completed');
    });
  });

  describe('cancelRepackOrder', () => {
    const mockOrder = {
      id: 'repack-123',
      status: RepackOrderStatus.PLANNED,
      branchId: 'branch-123',
      sourceItems: [
        { inventoryItemId: 'item-1', requiredQuantity: 20 },
        { inventoryItemId: 'item-2', requiredQuantity: 30 },
      ],
    };

    it('should cancel repack order successfully', async () => {
      const cancelledOrder = {
        ...mockOrder,
        status: RepackOrderStatus.CANCELLED,
      };

      const mockInventoryItems = [
        { id: 'item-1', reservedStock: 20 },
        { id: 'item-2', reservedStock: 30 },
      ];

      mockRepackModel.findById.mockResolvedValue(mockOrder as any);
      mockInventoryModel.findById
        .mockResolvedValueOnce(mockInventoryItems[0] as any)
        .mockResolvedValueOnce(mockInventoryItems[1] as any);
      mockInventoryModel.updateStock.mockResolvedValue({} as any);
      mockRepackModel.updateStatus.mockResolvedValue(cancelledOrder as any);

      const result = await repackService.cancelRepackOrder('repack-123', 'Not needed anymore', 'user-123');

      expect(mockRepackModel.updateStatus).toHaveBeenCalledWith('repack-123', RepackOrderStatus.CANCELLED, {
        notes: 'Cancelled: Not needed anymore',
      });
      expect(result).toEqual(cancelledOrder);
    });

    it('should throw error for completed order', async () => {
      const completedOrder = { ...mockOrder, status: RepackOrderStatus.COMPLETED };
      mockRepackModel.findById.mockResolvedValue(completedOrder as any);

      await expect(repackService.cancelRepackOrder('repack-123', 'reason', 'user-123'))
        .rejects.toThrow('Cannot cancel repack order with status: completed');
    });
  });
});