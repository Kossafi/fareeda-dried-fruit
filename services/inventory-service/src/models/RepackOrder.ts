import { v4 as uuidv4 } from 'uuid';
import DatabaseConnection from '../database/connection';
import { 
  RepackOrder, 
  RepackOrderStatus, 
  RepackSourceItem, 
  RepackTargetProduct,
  UnitType 
} from '@dried-fruits/types';
import { generateOrderNumber } from '@dried-fruits/utils';
import logger from '../utils/logger';

export class RepackOrderModel {
  private db = DatabaseConnection.getInstance();
  private redis = this.db.getRedisClient();

  async create(orderData: {
    branchId: string;
    targetProductId: string;
    expectedQuantity: number;
    targetUnit: UnitType;
    sourceItems: Array<{
      inventoryItemId: string;
      requiredQuantity: number;
      unit: UnitType;
    }>;
    scheduledDate: Date;
    notes?: string;
    requestedBy: string;
  }): Promise<RepackOrder> {
    const id = uuidv4();
    const repackNumber = generateOrderNumber('RPK');
    const now = new Date();

    return this.db.transaction(async (client) => {
      // Create repack order
      const orderQuery = `
        INSERT INTO inventory.repack_orders (
          id, repack_number, branch_id, status, target_product_id,
          expected_quantity, target_unit, scheduled_date, notes,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const orderValues = [
        id,
        repackNumber,
        orderData.branchId,
        RepackOrderStatus.PLANNED,
        orderData.targetProductId,
        orderData.expectedQuantity,
        orderData.targetUnit,
        orderData.scheduledDate,
        orderData.notes || null,
        now,
        now,
      ];

      const orderResult = await client.query(orderQuery, orderValues);

      // Create source items
      for (const sourceItem of orderData.sourceItems) {
        const sourceItemQuery = `
          INSERT INTO inventory.repack_source_items (
            id, repack_order_id, inventory_item_id, required_quantity, unit, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `;

        await client.query(sourceItemQuery, [
          uuidv4(),
          id,
          sourceItem.inventoryItemId,
          sourceItem.requiredQuantity,
          sourceItem.unit,
          now,
        ]);
      }

      const order = this.mapRowToRepackOrder(orderResult.rows[0]);

      // Publish repack order created event
      await this.db.publishEvent('repack.orders', 'created', {
        repackOrderId: id,
        repackNumber,
        branchId: orderData.branchId,
        targetProductId: orderData.targetProductId,
        expectedQuantity: orderData.expectedQuantity,
        sourceItemsCount: orderData.sourceItems.length,
        requestedBy: orderData.requestedBy,
      });

      logger.info('Repack order created', {
        repackOrderId: id,
        repackNumber,
        branchId: orderData.branchId,
        requestedBy: orderData.requestedBy,
      });

      return order;
    });
  }

  async findById(id: string): Promise<RepackOrder | null> {
    // Try cache first
    const cacheKey = `repack:order:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const query = `
      SELECT ro.*, tp.name as target_product_name, tp.sku as target_product_sku,
             b.name as branch_name,
             u_performed.first_name || ' ' || u_performed.last_name as performed_by_name,
             u_supervised.first_name || ' ' || u_supervised.last_name as supervised_by_name
      FROM inventory.repack_orders ro
      JOIN public.products tp ON ro.target_product_id = tp.id
      JOIN public.branches b ON ro.branch_id = b.id
      LEFT JOIN auth.users u_performed ON ro.performed_by::uuid = u_performed.id
      LEFT JOIN auth.users u_supervised ON ro.supervised_by::uuid = u_supervised.id
      WHERE ro.id = $1
    `;

    const result = await this.db.query(query, [id]);
    if (result.rows.length === 0) {
      return null;
    }

    const order = this.mapRowToRepackOrder(result.rows[0]);

    // Get source items
    order.sourceItems = await this.getSourceItems(id);

    // Cache for 5 minutes
    await this.redis.setEx(cacheKey, 300, JSON.stringify(order));

    return order;
  }

  async findByBranch(branchId: string, filters?: {
    status?: RepackOrderStatus;
    targetProductId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ orders: RepackOrder[]; total: number }> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereConditions = ['ro.branch_id = $1'];
    let params: any[] = [branchId];
    let paramIndex = 2;

    if (filters?.status) {
      whereConditions.push(`ro.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.targetProductId) {
      whereConditions.push(`ro.target_product_id = $${paramIndex}`);
      params.push(filters.targetProductId);
      paramIndex++;
    }

    if (filters?.startDate) {
      whereConditions.push(`ro.scheduled_date >= $${paramIndex}`);
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters?.endDate) {
      whereConditions.push(`ro.scheduled_date <= $${paramIndex}`);
      params.push(filters.endDate);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM inventory.repack_orders ro
      WHERE ${whereClause}
    `;

    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get orders
    const query = `
      SELECT ro.*, tp.name as target_product_name, tp.sku as target_product_sku,
             b.name as branch_name
      FROM inventory.repack_orders ro
      JOIN public.products tp ON ro.target_product_id = tp.id
      JOIN public.branches b ON ro.branch_id = b.id
      WHERE ${whereClause}
      ORDER BY ro.scheduled_date DESC, ro.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const orders = await Promise.all(
      result.rows.map(async (row) => {
        const order = this.mapRowToRepackOrder(row);
        order.sourceItems = await this.getSourceItems(order.id);
        return order;
      })
    );

    return { orders, total };
  }

  async updateStatus(id: string, status: RepackOrderStatus, updates?: {
    startedAt?: Date;
    completedAt?: Date;
    performedBy?: string;
    supervisedBy?: string;
    actualQuantity?: number;
    notes?: string;
  }): Promise<RepackOrder | null> {
    const setClause: string[] = ['status = $2', 'updated_at = $3'];
    const values: any[] = [id, status, new Date()];
    let paramIndex = 4;

    if (updates?.startedAt) {
      setClause.push(`started_at = $${paramIndex}`);
      values.push(updates.startedAt);
      paramIndex++;
    }

    if (updates?.completedAt) {
      setClause.push(`completed_at = $${paramIndex}`);
      values.push(updates.completedAt);
      paramIndex++;
    }

    if (updates?.performedBy) {
      setClause.push(`performed_by = $${paramIndex}`);
      values.push(updates.performedBy);
      paramIndex++;
    }

    if (updates?.supervisedBy) {
      setClause.push(`supervised_by = $${paramIndex}`);
      values.push(updates.supervisedBy);
      paramIndex++;
    }

    if (updates?.actualQuantity !== undefined) {
      setClause.push(`actual_quantity = $${paramIndex}`);
      values.push(updates.actualQuantity);
      paramIndex++;
    }

    if (updates?.notes) {
      setClause.push(`notes = $${paramIndex}`);
      values.push(updates.notes);
      paramIndex++;
    }

    const query = `
      UPDATE inventory.repack_orders 
      SET ${setClause.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    if (result.rows.length === 0) {
      return null;
    }

    // Clear cache
    await this.redis.del(`repack:order:${id}`);

    // Publish status update event
    await this.db.publishEvent('repack.orders', status, {
      repackOrderId: id,
      previousStatus: 'unknown', // Would need to track this
      newStatus: status,
      updates,
    });

    logger.info('Repack order status updated', {
      repackOrderId: id,
      status,
      updates,
    });

    return this.findById(id);
  }

  async updateSourceItemActual(repackOrderId: string, inventoryItemId: string, actualQuantity: number): Promise<void> {
    const query = `
      UPDATE inventory.repack_source_items 
      SET actual_quantity = $1
      WHERE repack_order_id = $2 AND inventory_item_id = $3
    `;

    await this.db.query(query, [actualQuantity, repackOrderId, inventoryItemId]);

    // Clear cache
    await this.redis.del(`repack:order:${repackOrderId}`);

    logger.debug('Repack source item actual quantity updated', {
      repackOrderId,
      inventoryItemId,
      actualQuantity,
    });
  }

  async getReadyForProcessing(branchId?: string): Promise<RepackOrder[]> {
    let query = `
      SELECT ro.*, tp.name as target_product_name, tp.sku as target_product_sku,
             b.name as branch_name
      FROM inventory.repack_orders ro
      JOIN public.products tp ON ro.target_product_id = tp.id
      JOIN public.branches b ON ro.branch_id = b.id
      WHERE ro.status = $1 AND ro.scheduled_date <= NOW()
    `;

    const params: any[] = [RepackOrderStatus.PLANNED];

    if (branchId) {
      query += ' AND ro.branch_id = $2';
      params.push(branchId);
    }

    query += ' ORDER BY ro.scheduled_date ASC';

    const result = await this.db.query(query, params);
    
    return Promise.all(
      result.rows.map(async (row) => {
        const order = this.mapRowToRepackOrder(row);
        order.sourceItems = await this.getSourceItems(order.id);
        return order;
      })
    );
  }

  async validateRepackFeasibility(repackOrderId: string): Promise<{
    isValid: boolean;
    validationResults: Array<{
      inventoryItemId: string;
      isValid: boolean;
      availableStock: number;
      requiredQuantity: number;
      productName: string;
      message?: string;
    }>;
  }> {
    const sourceItemsQuery = `
      SELECT rsi.*, ii.current_stock, ii.reserved_stock, ii.available_stock,
             p.name as product_name, p.sku as product_sku
      FROM inventory.repack_source_items rsi
      JOIN inventory.inventory_items ii ON rsi.inventory_item_id = ii.id
      JOIN public.products p ON ii.product_id = p.id
      WHERE rsi.repack_order_id = $1
    `;

    const result = await this.db.query(sourceItemsQuery, [repackOrderId]);
    const validationResults = [];
    let overallValid = true;

    for (const row of result.rows) {
      const isValid = row.available_stock >= row.required_quantity;
      if (!isValid) {
        overallValid = false;
      }

      validationResults.push({
        inventoryItemId: row.inventory_item_id,
        isValid,
        availableStock: parseFloat(row.available_stock),
        requiredQuantity: parseFloat(row.required_quantity),
        productName: row.product_name,
        message: isValid ? undefined : 'Insufficient stock for repack operation',
      });
    }

    return {
      isValid: overallValid,
      validationResults,
    };
  }

  private async getSourceItems(repackOrderId: string): Promise<RepackSourceItem[]> {
    const query = `
      SELECT rsi.*, ii.product_id, p.name as product_name, p.sku as product_sku,
             ii.current_stock, ii.available_stock
      FROM inventory.repack_source_items rsi
      JOIN inventory.inventory_items ii ON rsi.inventory_item_id = ii.id
      JOIN public.products p ON ii.product_id = p.id
      WHERE rsi.repack_order_id = $1
      ORDER BY rsi.created_at ASC
    `;

    const result = await this.db.query(query, [repackOrderId]);
    
    return result.rows.map(row => ({
      id: row.id,
      repackOrderId: row.repack_order_id,
      inventoryItemId: row.inventory_item_id,
      productId: row.product_id,
      productName: row.product_name,
      productSku: row.product_sku,
      requiredQuantity: parseFloat(row.required_quantity),
      actualQuantity: row.actual_quantity ? parseFloat(row.actual_quantity) : undefined,
      unit: row.unit,
      availableStock: parseFloat(row.available_stock),
      createdAt: row.created_at,
    }));
  }

  private mapRowToRepackOrder(row: any): RepackOrder {
    return {
      id: row.id,
      repackNumber: row.repack_number,
      branchId: row.branch_id,
      branchName: row.branch_name,
      status: row.status,
      targetProduct: {
        productId: row.target_product_id,
        productName: row.target_product_name,
        productSku: row.target_product_sku,
        expectedQuantity: parseFloat(row.expected_quantity),
        actualQuantity: row.actual_quantity ? parseFloat(row.actual_quantity) : undefined,
        unit: row.target_unit,
      },
      sourceItems: [], // Will be populated by caller
      scheduledDate: row.scheduled_date,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      performedBy: row.performed_by,
      performedByName: row.performed_by_name,
      supervisedBy: row.supervised_by,
      supervisedByName: row.supervised_by_name,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}