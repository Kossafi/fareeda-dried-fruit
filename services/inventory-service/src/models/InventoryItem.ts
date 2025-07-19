import { v4 as uuidv4 } from 'uuid';
import DatabaseConnection from '../database/connection';
import { InventoryItem, UnitType, StockMovementType } from '@dried-fruits/types';
import { config } from '../config';
import logger from '../utils/logger';

export class InventoryItemModel {
  private db = DatabaseConnection.getInstance();
  private redis = this.db.getRedisClient();

  async create(itemData: {
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
  }): Promise<InventoryItem> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO inventory.inventory_items (
        id, product_id, branch_id, current_stock, reserved_stock, unit,
        min_stock_level, max_stock_level, reorder_point, reorder_quantity,
        cost, average_cost, batch_number, supplier_lot_number, expiration_date,
        location_section, location_aisle, location_shelf, location_bin,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `;

    const values = [
      id,
      itemData.productId,
      itemData.branchId,
      itemData.currentStock,
      0, // reserved_stock
      itemData.unit,
      itemData.minStockLevel,
      itemData.maxStockLevel || null,
      itemData.reorderPoint,
      itemData.reorderQuantity,
      itemData.cost,
      itemData.cost, // initial average_cost
      itemData.batchNumber || null,
      itemData.supplierLotNumber || null,
      itemData.expirationDate || null,
      itemData.location?.section || null,
      itemData.location?.aisle || null,
      itemData.location?.shelf || null,
      itemData.location?.bin || null,
      now,
      now,
    ];

    try {
      const result = await this.db.query(query, values);
      const item = this.mapRowToInventoryItem(result.rows[0]);
      
      // Clear cache for this product-branch combination
      await this.clearCache(itemData.productId, itemData.branchId);
      
      // Publish inventory event
      await this.db.publishEvent('inventory.events', 'inventory.created', {
        inventoryItemId: id,
        productId: itemData.productId,
        branchId: itemData.branchId,
        currentStock: itemData.currentStock,
        unit: itemData.unit,
      });

      logger.info('Inventory item created', { 
        inventoryItemId: id, 
        productId: itemData.productId,
        branchId: itemData.branchId 
      });
      
      return item;
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Inventory item already exists for this product-branch-batch combination');
      }
      logger.error('Failed to create inventory item:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<InventoryItem | null> {
    // Try cache first
    const cacheKey = `inventory:item:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const query = `
      SELECT ii.*, p.name as product_name, p.sku as product_sku, b.name as branch_name
      FROM inventory.inventory_items ii
      JOIN public.products p ON ii.product_id = p.id
      JOIN public.branches b ON ii.branch_id = b.id
      WHERE ii.id = $1
    `;

    const result = await this.db.query(query, [id]);
    if (result.rows.length === 0) {
      return null;
    }

    const item = this.mapRowToInventoryItem(result.rows[0]);
    
    // Cache for 5 minutes
    await this.redis.setEx(cacheKey, 300, JSON.stringify(item));
    
    return item;
  }

  async findByProductAndBranch(productId: string, branchId: string, batchNumber?: string): Promise<InventoryItem[]> {
    const cacheKey = `inventory:product:${productId}:branch:${branchId}${batchNumber ? `:batch:${batchNumber}` : ''}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    let query = `
      SELECT ii.*, p.name as product_name, p.sku as product_sku, b.name as branch_name
      FROM inventory.inventory_items ii
      JOIN public.products p ON ii.product_id = p.id
      JOIN public.branches b ON ii.branch_id = b.id
      WHERE ii.product_id = $1 AND ii.branch_id = $2
    `;
    
    const params = [productId, branchId];
    
    if (batchNumber) {
      query += ' AND ii.batch_number = $3';
      params.push(batchNumber);
    }
    
    query += ' ORDER BY ii.expiration_date ASC NULLS LAST, ii.created_at ASC';

    const result = await this.db.query(query, params);
    const items = result.rows.map(row => this.mapRowToInventoryItem(row));
    
    // Cache for 2 minutes
    await this.redis.setEx(cacheKey, 120, JSON.stringify(items));
    
    return items;
  }

  async findByBranch(branchId: string, filters?: {
    lowStock?: boolean;
    expiringSoon?: boolean;
    searchTerm?: string;
    categoryId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: InventoryItem[]; total: number }> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || config.pagination.defaultLimit, config.pagination.maxLimit);
    const offset = (page - 1) * limit;

    let whereConditions = ['ii.branch_id = $1'];
    let params: any[] = [branchId];
    let paramIndex = 2;

    if (filters?.lowStock) {
      whereConditions.push(`ii.current_stock <= ii.reorder_point`);
    }

    if (filters?.expiringSoon) {
      whereConditions.push(`ii.expiration_date <= $${paramIndex}`);
      params.push(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 days
      paramIndex++;
    }

    if (filters?.searchTerm) {
      whereConditions.push(`(p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`);
      params.push(`%${filters.searchTerm}%`);
      paramIndex++;
    }

    if (filters?.categoryId) {
      whereConditions.push(`p.category_id = $${paramIndex}`);
      params.push(filters.categoryId);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM inventory.inventory_items ii
      JOIN public.products p ON ii.product_id = p.id
      WHERE ${whereClause}
    `;
    
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get items
    const query = `
      SELECT ii.*, p.name as product_name, p.sku as product_sku, 
             p.category_id, pc.name as category_name, b.name as branch_name
      FROM inventory.inventory_items ii
      JOIN public.products p ON ii.product_id = p.id
      JOIN public.product_categories pc ON p.category_id = pc.id
      JOIN public.branches b ON ii.branch_id = b.id
      WHERE ${whereClause}
      ORDER BY ii.updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    
    const result = await this.db.query(query, params);
    const items = result.rows.map(row => this.mapRowToInventoryItem(row));

    return { items, total };
  }

  async updateStock(id: string, updates: {
    currentStock?: number;
    reservedStock?: number;
    cost?: number;
    lastRestockDate?: Date;
    batchNumber?: string;
    expirationDate?: Date;
    location?: {
      section?: string;
      aisle?: string;
      shelf?: string;
      bin?: string;
    };
  }): Promise<InventoryItem | null> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.currentStock !== undefined) {
      setClause.push(`current_stock = $${paramIndex}`);
      values.push(updates.currentStock);
      paramIndex++;
    }

    if (updates.reservedStock !== undefined) {
      setClause.push(`reserved_stock = $${paramIndex}`);
      values.push(updates.reservedStock);
      paramIndex++;
    }

    if (updates.cost !== undefined) {
      setClause.push(`cost = $${paramIndex}`, `average_cost = (average_cost + $${paramIndex}) / 2`);
      values.push(updates.cost);
      paramIndex++;
    }

    if (updates.lastRestockDate !== undefined) {
      setClause.push(`last_restock_date = $${paramIndex}`);
      values.push(updates.lastRestockDate);
      paramIndex++;
    }

    if (updates.batchNumber !== undefined) {
      setClause.push(`batch_number = $${paramIndex}`);
      values.push(updates.batchNumber);
      paramIndex++;
    }

    if (updates.expirationDate !== undefined) {
      setClause.push(`expiration_date = $${paramIndex}`);
      values.push(updates.expirationDate);
      paramIndex++;
    }

    if (updates.location) {
      if (updates.location.section !== undefined) {
        setClause.push(`location_section = $${paramIndex}`);
        values.push(updates.location.section);
        paramIndex++;
      }
      if (updates.location.aisle !== undefined) {
        setClause.push(`location_aisle = $${paramIndex}`);
        values.push(updates.location.aisle);
        paramIndex++;
      }
      if (updates.location.shelf !== undefined) {
        setClause.push(`location_shelf = $${paramIndex}`);
        values.push(updates.location.shelf);
        paramIndex++;
      }
      if (updates.location.bin !== undefined) {
        setClause.push(`location_bin = $${paramIndex}`);
        values.push(updates.location.bin);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      return this.findById(id);
    }

    setClause.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE inventory.inventory_items 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    if (result.rows.length === 0) {
      return null;
    }

    const item = this.mapRowToInventoryItem(result.rows[0]);
    
    // Clear cache
    await this.clearCache(item.productId, item.branchId);
    await this.redis.del(`inventory:item:${id}`);

    // Check for low stock alerts
    await this.checkLowStockAlert(item);

    logger.info('Inventory item updated', { inventoryItemId: id, updates });
    
    return item;
  }

  async adjustStock(id: string, adjustment: {
    quantity: number;
    type: StockMovementType;
    reason: string;
    performedBy: string;
    referenceId?: string;
    referenceType?: string;
    notes?: string;
  }): Promise<{ item: InventoryItem; movementId: string }> {
    return this.db.transaction(async (client) => {
      // Get current item
      const itemQuery = 'SELECT * FROM inventory.inventory_items WHERE id = $1 FOR UPDATE';
      const itemResult = await client.query(itemQuery, [id]);
      
      if (itemResult.rows.length === 0) {
        throw new Error('Inventory item not found');
      }

      const currentItem = itemResult.rows[0];
      const previousStock = currentItem.current_stock;
      let newStock = previousStock;

      // Calculate new stock based on movement type
      switch (adjustment.type) {
        case StockMovementType.INCOMING:
          newStock = previousStock + adjustment.quantity;
          break;
        case StockMovementType.OUTGOING:
          newStock = previousStock - adjustment.quantity;
          break;
        case StockMovementType.ADJUSTMENT:
          newStock = adjustment.quantity; // Direct adjustment to specific quantity
          break;
        default:
          newStock = previousStock + adjustment.quantity;
      }

      // Validate stock levels
      if (newStock < 0) {
        throw new Error('Insufficient stock for this operation');
      }

      // Update inventory item
      const updateQuery = `
        UPDATE inventory.inventory_items 
        SET current_stock = $1, updated_at = $2
        WHERE id = $3
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [newStock, new Date(), id]);
      const updatedItem = this.mapRowToInventoryItem(updateResult.rows[0]);

      // Create stock movement record
      const movementId = uuidv4();
      const movementQuery = `
        INSERT INTO inventory.stock_movements (
          id, inventory_item_id, type, quantity, unit, previous_stock, new_stock,
          reason, reference_id, reference_type, performed_by, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `;

      await client.query(movementQuery, [
        movementId,
        id,
        adjustment.type,
        Math.abs(adjustment.quantity),
        currentItem.unit,
        previousStock,
        newStock,
        adjustment.reason,
        adjustment.referenceId || null,
        adjustment.referenceType || null,
        adjustment.performedBy,
        adjustment.notes || null,
        new Date(),
      ]);

      // Clear cache
      await this.clearCache(updatedItem.productId, updatedItem.branchId);
      await this.redis.del(`inventory:item:${id}`);

      // Publish stock movement event
      await this.db.publishEvent('inventory.events', `stock.movement.${adjustment.type}`, {
        inventoryItemId: id,
        productId: updatedItem.productId,
        branchId: updatedItem.branchId,
        movementId,
        previousStock,
        newStock,
        quantity: adjustment.quantity,
        type: adjustment.type,
        performedBy: adjustment.performedBy,
      });

      // Check for low stock alerts
      await this.checkLowStockAlert(updatedItem);

      logger.info('Stock adjusted', {
        inventoryItemId: id,
        movementId,
        type: adjustment.type,
        quantity: adjustment.quantity,
        previousStock,
        newStock,
        performedBy: adjustment.performedBy,
      });

      return { item: updatedItem, movementId };
    });
  }

  private async checkLowStockAlert(item: InventoryItem): Promise<void> {
    if (item.availableStock <= item.reorderPoint) {
      const alertLevel = item.availableStock <= (item.minStockLevel * config.inventory.criticalStockThreshold) 
        ? 'critical' 
        : 'warning';

      // Publish low stock alert
      await this.db.publishEvent('stock.alerts', '', {
        inventoryItemId: item.id,
        productId: item.productId,
        branchId: item.branchId,
        alertLevel,
        currentStock: item.currentStock,
        availableStock: item.availableStock,
        minStockLevel: item.minStockLevel,
        reorderPoint: item.reorderPoint,
      });

      logger.warn('Low stock alert triggered', {
        inventoryItemId: item.id,
        productId: item.productId,
        branchId: item.branchId,
        alertLevel,
        availableStock: item.availableStock,
        reorderPoint: item.reorderPoint,
      });
    }
  }

  private async clearCache(productId: string, branchId: string): Promise<void> {
    const pattern = `inventory:product:${productId}:branch:${branchId}*`;
    // Note: In production, use Redis SCAN instead of KEYS for better performance
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }

  private mapRowToInventoryItem(row: any): InventoryItem {
    return {
      id: row.id,
      productId: row.product_id,
      branchId: row.branch_id,
      currentStock: parseFloat(row.current_stock),
      reservedStock: parseFloat(row.reserved_stock),
      availableStock: parseFloat(row.available_stock),
      unit: row.unit,
      minStockLevel: parseFloat(row.min_stock_level),
      maxStockLevel: row.max_stock_level ? parseFloat(row.max_stock_level) : undefined,
      reorderPoint: parseFloat(row.reorder_point),
      reorderQuantity: parseFloat(row.reorder_quantity),
      lastRestockDate: row.last_restock_date,
      expirationDate: row.expiration_date,
      batchNumber: row.batch_number,
      supplierLotNumber: row.supplier_lot_number,
      location: {
        section: row.location_section,
        aisle: row.location_aisle,
        shelf: row.location_shelf,
        bin: row.location_bin,
      },
      cost: parseFloat(row.cost),
      averageCost: parseFloat(row.average_cost),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}