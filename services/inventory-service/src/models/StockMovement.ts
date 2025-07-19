import { v4 as uuidv4 } from 'uuid';
import DatabaseConnection from '../database/connection';
import { StockMovement, StockMovementType, UnitType } from '@dried-fruits/types';
import logger from '../utils/logger';

export class StockMovementModel {
  private db = DatabaseConnection.getInstance();

  async findById(id: string): Promise<StockMovement | null> {
    const query = `
      SELECT sm.*, ii.product_id, ii.branch_id, p.name as product_name, p.sku as product_sku,
             b.name as branch_name, u.first_name, u.last_name, u.email as performed_by_email
      FROM inventory.stock_movements sm
      JOIN inventory.inventory_items ii ON sm.inventory_item_id = ii.id
      JOIN public.products p ON ii.product_id = p.id
      JOIN public.branches b ON ii.branch_id = b.id
      LEFT JOIN auth.users u ON sm.performed_by::uuid = u.id
      WHERE sm.id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows.length > 0 ? this.mapRowToStockMovement(result.rows[0]) : null;
  }

  async findByInventoryItem(inventoryItemId: string, filters?: {
    type?: StockMovementType;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ movements: StockMovement[]; total: number }> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereConditions = ['sm.inventory_item_id = $1'];
    let params: any[] = [inventoryItemId];
    let paramIndex = 2;

    if (filters?.type) {
      whereConditions.push(`sm.type = $${paramIndex}`);
      params.push(filters.type);
      paramIndex++;
    }

    if (filters?.startDate) {
      whereConditions.push(`sm.created_at >= $${paramIndex}`);
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters?.endDate) {
      whereConditions.push(`sm.created_at <= $${paramIndex}`);
      params.push(filters.endDate);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM inventory.stock_movements sm
      WHERE ${whereClause}
    `;
    
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get movements
    const query = `
      SELECT sm.*, ii.product_id, ii.branch_id, p.name as product_name, p.sku as product_sku,
             b.name as branch_name, u.first_name, u.last_name, u.email as performed_by_email
      FROM inventory.stock_movements sm
      JOIN inventory.inventory_items ii ON sm.inventory_item_id = ii.id
      JOIN public.products p ON ii.product_id = p.id
      JOIN public.branches b ON ii.branch_id = b.id
      LEFT JOIN auth.users u ON sm.performed_by::uuid = u.id
      WHERE ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    
    const result = await this.db.query(query, params);
    const movements = result.rows.map(row => this.mapRowToStockMovement(row));

    return { movements, total };
  }

  async findByBranch(branchId: string, filters?: {
    type?: StockMovementType;
    productId?: string;
    performedBy?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ movements: StockMovement[]; total: number }> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereConditions = ['ii.branch_id = $1'];
    let params: any[] = [branchId];
    let paramIndex = 2;

    if (filters?.type) {
      whereConditions.push(`sm.type = $${paramIndex}`);
      params.push(filters.type);
      paramIndex++;
    }

    if (filters?.productId) {
      whereConditions.push(`ii.product_id = $${paramIndex}`);
      params.push(filters.productId);
      paramIndex++;
    }

    if (filters?.performedBy) {
      whereConditions.push(`sm.performed_by = $${paramIndex}`);
      params.push(filters.performedBy);
      paramIndex++;
    }

    if (filters?.startDate) {
      whereConditions.push(`sm.created_at >= $${paramIndex}`);
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters?.endDate) {
      whereConditions.push(`sm.created_at <= $${paramIndex}`);
      params.push(filters.endDate);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM inventory.stock_movements sm
      JOIN inventory.inventory_items ii ON sm.inventory_item_id = ii.id
      WHERE ${whereClause}
    `;
    
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get movements
    const query = `
      SELECT sm.*, ii.product_id, ii.branch_id, p.name as product_name, p.sku as product_sku,
             b.name as branch_name, u.first_name, u.last_name, u.email as performed_by_email
      FROM inventory.stock_movements sm
      JOIN inventory.inventory_items ii ON sm.inventory_item_id = ii.id
      JOIN public.products p ON ii.product_id = p.id
      JOIN public.branches b ON ii.branch_id = b.id
      LEFT JOIN auth.users u ON sm.performed_by::uuid = u.id
      WHERE ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    
    const result = await this.db.query(query, params);
    const movements = result.rows.map(row => this.mapRowToStockMovement(row));

    return { movements, total };
  }

  async getStockSummary(branchId: string, period?: { startDate: Date; endDate: Date }): Promise<{
    totalMovements: number;
    incomingQuantity: number;
    outgoingQuantity: number;
    adjustmentQuantity: number;
    byType: Record<StockMovementType, number>;
    byProduct: Array<{ productId: string; productName: string; totalQuantity: number; }>;
  }> {
    let whereConditions = ['ii.branch_id = $1'];
    let params: any[] = [branchId];
    let paramIndex = 2;

    if (period?.startDate) {
      whereConditions.push(`sm.created_at >= $${paramIndex}`);
      params.push(period.startDate);
      paramIndex++;
    }

    if (period?.endDate) {
      whereConditions.push(`sm.created_at <= $${paramIndex}`);
      params.push(period.endDate);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_movements,
        SUM(CASE WHEN sm.type = 'incoming' THEN sm.quantity ELSE 0 END) as incoming_quantity,
        SUM(CASE WHEN sm.type = 'outgoing' THEN sm.quantity ELSE 0 END) as outgoing_quantity,
        SUM(CASE WHEN sm.type = 'adjustment' THEN ABS(sm.new_stock - sm.previous_stock) ELSE 0 END) as adjustment_quantity,
        sm.type,
        SUM(sm.quantity) as type_quantity
      FROM inventory.stock_movements sm
      JOIN inventory.inventory_items ii ON sm.inventory_item_id = ii.id
      WHERE ${whereClause}
      GROUP BY sm.type
    `;

    const summaryResult = await this.db.query(summaryQuery, params);

    // Get by product summary
    const productQuery = `
      SELECT 
        ii.product_id,
        p.name as product_name,
        SUM(sm.quantity) as total_quantity
      FROM inventory.stock_movements sm
      JOIN inventory.inventory_items ii ON sm.inventory_item_id = ii.id
      JOIN public.products p ON ii.product_id = p.id
      WHERE ${whereClause}
      GROUP BY ii.product_id, p.name
      ORDER BY total_quantity DESC
      LIMIT 10
    `;

    const productResult = await this.db.query(productQuery, params);

    // Process results
    const byType: Record<string, number> = {};
    let totalMovements = 0;
    let incomingQuantity = 0;
    let outgoingQuantity = 0;
    let adjustmentQuantity = 0;

    summaryResult.rows.forEach(row => {
      totalMovements += parseInt(row.total_movements);
      if (row.type === 'incoming') incomingQuantity = parseFloat(row.incoming_quantity);
      if (row.type === 'outgoing') outgoingQuantity = parseFloat(row.outgoing_quantity);
      if (row.type === 'adjustment') adjustmentQuantity = parseFloat(row.adjustment_quantity);
      byType[row.type] = parseFloat(row.type_quantity);
    });

    const byProduct = productResult.rows.map(row => ({
      productId: row.product_id,
      productName: row.product_name,
      totalQuantity: parseFloat(row.total_quantity),
    }));

    return {
      totalMovements,
      incomingQuantity,
      outgoingQuantity,
      adjustmentQuantity,
      byType: byType as Record<StockMovementType, number>,
      byProduct,
    };
  }

  private mapRowToStockMovement(row: any): StockMovement {
    return {
      id: row.id,
      inventoryItemId: row.inventory_item_id,
      type: row.type,
      quantity: parseFloat(row.quantity),
      unit: row.unit,
      previousStock: parseFloat(row.previous_stock),
      newStock: parseFloat(row.new_stock),
      reason: row.reason,
      referenceId: row.reference_id,
      referenceType: row.reference_type,
      performedBy: row.performed_by,
      approvedBy: row.approved_by,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }
}