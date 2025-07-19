import { InventoryItemModel } from '../models/InventoryItem';
import { StockMovementModel } from '../models/StockMovement';
import { 
  InventoryItem,
  StockMovement,
  StockMovementType,
  UnitType 
} from '@dried-fruits/types';
import { config } from '../config';
import logger from '../utils/logger';

export class InventoryService {
  private inventoryModel = new InventoryItemModel();
  private stockMovementModel = new StockMovementModel();

  async createInventoryItem(itemData: {
    productId: string;
    branchId: string;
    currentStock: number;
    unit: UnitType;
    minStockLevel: number;
    maxStockLevel?: number;
    reorderPoint: number;
    reorderQuantity: number;
    cost: number;
    batchNumber?: string;
    supplierLotNumber?: string;
    expirationDate?: Date;
    location?: {
      section?: string;
      aisle?: string;
      shelf?: string;
      bin?: string;
    };
  }, createdBy: string): Promise<InventoryItem> {
    // Validate input
    if (itemData.currentStock < 0) {
      throw new Error('Current stock cannot be negative');
    }

    if (itemData.minStockLevel < 0) {
      throw new Error('Minimum stock level cannot be negative');
    }

    if (itemData.reorderPoint < 0) {
      throw new Error('Reorder point cannot be negative');
    }

    if (itemData.cost < 0) {
      throw new Error('Cost cannot be negative');
    }

    if (itemData.maxStockLevel && itemData.maxStockLevel < itemData.minStockLevel) {
      throw new Error('Maximum stock level cannot be less than minimum stock level');
    }

    // Check if inventory item already exists for this product-branch combination
    const existingItems = await this.inventoryModel.findByProductAndBranch(
      itemData.productId,
      itemData.branchId,
      itemData.batchNumber
    );

    if (existingItems.length > 0) {
      throw new Error('Inventory item already exists for this product-branch-batch combination');
    }

    const item = await this.inventoryModel.create(itemData);

    // Create initial stock movement
    if (itemData.currentStock > 0) {
      await this.inventoryModel.adjustStock(item.id, {
        quantity: itemData.currentStock,
        type: StockMovementType.INCOMING,
        reason: 'Initial stock',
        performedBy: createdBy,
        notes: 'Initial inventory setup',
      });
    }

    logger.info('Inventory item created', {
      inventoryItemId: item.id,
      productId: itemData.productId,
      branchId: itemData.branchId,
      createdBy,
    });

    return item;
  }

  async getInventoryItem(id: string): Promise<InventoryItem | null> {
    return this.inventoryModel.findById(id);
  }

  async getInventoryByBranch(branchId: string, filters?: {
    lowStock?: boolean;
    expiringSoon?: boolean;
    searchTerm?: string;
    categoryId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: InventoryItem[]; total: number; summary: any }> {
    const result = await this.inventoryModel.findByBranch(branchId, filters);

    // Calculate summary statistics
    const summary = {
      totalItems: result.total,
      lowStockItems: 0,
      outOfStockItems: 0,
      expiringSoonItems: 0,
      totalValue: 0,
    };

    // If we're not filtering, get additional stats
    if (!filters?.lowStock && !filters?.expiringSoon && !filters?.searchTerm && !filters?.categoryId) {
      const allItems = await this.inventoryModel.findByBranch(branchId, { limit: 1000 });
      
      allItems.items.forEach(item => {
        if (item.availableStock <= 0) {
          summary.outOfStockItems++;
        } else if (item.availableStock <= item.reorderPoint) {
          summary.lowStockItems++;
        }

        if (item.expirationDate && item.expirationDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
          summary.expiringSoonItems++;
        }

        summary.totalValue += item.availableStock * item.averageCost;
      });
    }

    return { ...result, summary };
  }

  async updateInventoryItem(id: string, updates: {
    minStockLevel?: number;
    maxStockLevel?: number;
    reorderPoint?: number;
    reorderQuantity?: number;
    cost?: number;
    batchNumber?: string;
    expirationDate?: Date;
    location?: {
      section?: string;
      aisle?: string;
      shelf?: string;
      bin?: string;
    };
  }, updatedBy: string): Promise<InventoryItem | null> {
    // Validate updates
    if (updates.minStockLevel !== undefined && updates.minStockLevel < 0) {
      throw new Error('Minimum stock level cannot be negative');
    }

    if (updates.reorderPoint !== undefined && updates.reorderPoint < 0) {
      throw new Error('Reorder point cannot be negative');
    }

    if (updates.cost !== undefined && updates.cost < 0) {
      throw new Error('Cost cannot be negative');
    }

    if (updates.maxStockLevel !== undefined && updates.minStockLevel !== undefined) {
      if (updates.maxStockLevel < updates.minStockLevel) {
        throw new Error('Maximum stock level cannot be less than minimum stock level');
      }
    }

    const item = await this.inventoryModel.updateStock(id, updates);
    
    if (item) {
      logger.info('Inventory item updated', {
        inventoryItemId: id,
        updates,
        updatedBy,
      });
    }

    return item;
  }

  async adjustStock(id: string, adjustment: {
    quantity: number;
    type: StockMovementType;
    reason: string;
    referenceId?: string;
    referenceType?: string;
    notes?: string;
  }, performedBy: string): Promise<{ item: InventoryItem; movement: StockMovement }> {
    // Validate adjustment
    if (adjustment.quantity === 0) {
      throw new Error('Adjustment quantity cannot be zero');
    }

    if (!adjustment.reason.trim()) {
      throw new Error('Reason is required for stock adjustment');
    }

    // Perform the adjustment
    const { item, movementId } = await this.inventoryModel.adjustStock(id, {
      ...adjustment,
      performedBy,
    });

    // Get the movement record
    const movement = await this.stockMovementModel.findById(movementId);
    if (!movement) {
      throw new Error('Failed to retrieve stock movement record');
    }

    logger.info('Stock adjusted successfully', {
      inventoryItemId: id,
      movementId,
      adjustment,
      performedBy,
    });

    return { item, movement };
  }

  async reserveStock(inventoryItemId: string, quantity: number, reservedBy: string, referenceId?: string): Promise<InventoryItem> {
    const item = await this.inventoryModel.findById(inventoryItemId);
    if (!item) {
      throw new Error('Inventory item not found');
    }

    if (quantity <= 0) {
      throw new Error('Reserve quantity must be positive');
    }

    if (item.availableStock < quantity) {
      throw new Error('Insufficient available stock for reservation');
    }

    const updatedItem = await this.inventoryModel.updateStock(inventoryItemId, {
      reservedStock: item.reservedStock + quantity,
    });

    if (!updatedItem) {
      throw new Error('Failed to reserve stock');
    }

    logger.info('Stock reserved', {
      inventoryItemId,
      quantity,
      reservedBy,
      referenceId,
    });

    return updatedItem;
  }

  async releaseReservedStock(inventoryItemId: string, quantity: number, releasedBy: string, referenceId?: string): Promise<InventoryItem> {
    const item = await this.inventoryModel.findById(inventoryItemId);
    if (!item) {
      throw new Error('Inventory item not found');
    }

    if (quantity <= 0) {
      throw new Error('Release quantity must be positive');
    }

    if (item.reservedStock < quantity) {
      throw new Error('Cannot release more stock than is currently reserved');
    }

    const updatedItem = await this.inventoryModel.updateStock(inventoryItemId, {
      reservedStock: item.reservedStock - quantity,
    });

    if (!updatedItem) {
      throw new Error('Failed to release reserved stock');
    }

    logger.info('Reserved stock released', {
      inventoryItemId,
      quantity,
      releasedBy,
      referenceId,
    });

    return updatedItem;
  }

  async getStockMovements(inventoryItemId: string, filters?: {
    type?: StockMovementType;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ movements: StockMovement[]; total: number }> {
    return this.stockMovementModel.findByInventoryItem(inventoryItemId, filters);
  }

  async getBranchStockMovements(branchId: string, filters?: {
    type?: StockMovementType;
    productId?: string;
    performedBy?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ movements: StockMovement[]; total: number }> {
    return this.stockMovementModel.findByBranch(branchId, filters);
  }

  async getStockSummary(branchId: string, period?: { startDate: Date; endDate: Date }): Promise<any> {
    return this.stockMovementModel.getStockSummary(branchId, period);
  }

  async getLowStockItems(branchId: string): Promise<InventoryItem[]> {
    const { items } = await this.inventoryModel.findByBranch(branchId, { lowStock: true, limit: 1000 });
    return items;
  }

  async getExpiringSoonItems(branchId: string, days: number = 30): Promise<InventoryItem[]> {
    const { items } = await this.inventoryModel.findByBranch(branchId, { expiringSoon: true, limit: 1000 });
    return items.filter(item => {
      if (!item.expirationDate) return false;
      const daysUntilExpiry = Math.ceil((item.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= days;
    });
  }

  async validateStockAvailability(requests: Array<{ inventoryItemId: string; quantity: number }>): Promise<{
    isValid: boolean;
    validationResults: Array<{
      inventoryItemId: string;
      isValid: boolean;
      availableStock: number;
      requestedQuantity: number;
      message?: string;
    }>;
  }> {
    const validationResults = [];
    let overallValid = true;

    for (const request of requests) {
      const item = await this.inventoryModel.findById(request.inventoryItemId);
      
      if (!item) {
        validationResults.push({
          inventoryItemId: request.inventoryItemId,
          isValid: false,
          availableStock: 0,
          requestedQuantity: request.quantity,
          message: 'Inventory item not found',
        });
        overallValid = false;
        continue;
      }

      const isValid = item.availableStock >= request.quantity;
      if (!isValid) {
        overallValid = false;
      }

      validationResults.push({
        inventoryItemId: request.inventoryItemId,
        isValid,
        availableStock: item.availableStock,
        requestedQuantity: request.quantity,
        message: isValid ? undefined : 'Insufficient stock',
      });
    }

    return {
      isValid: overallValid,
      validationResults,
    };
  }
}