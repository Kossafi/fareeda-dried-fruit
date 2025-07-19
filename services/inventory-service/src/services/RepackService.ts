import { RepackOrderModel } from '../models/RepackOrder';
import { InventoryItemModel } from '../models/InventoryItem';
import DatabaseConnection from '../database/connection';
import { 
  RepackOrder, 
  RepackOrderStatus, 
  UnitType,
  StockMovementType 
} from '@dried-fruits/types';
import { convertUnits } from '@dried-fruits/utils';
import logger from '../utils/logger';

export class RepackService {
  private repackModel = new RepackOrderModel();
  private inventoryModel = new InventoryItemModel();
  private db = DatabaseConnection.getInstance();

  async createRepackOrder(orderData: {
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
  }, requestedBy: string): Promise<RepackOrder> {
    // Validate input
    if (orderData.expectedQuantity <= 0) {
      throw new Error('Expected quantity must be positive');
    }

    if (orderData.sourceItems.length === 0) {
      throw new Error('At least one source item is required');
    }

    if (orderData.scheduledDate < new Date()) {
      throw new Error('Scheduled date cannot be in the past');
    }

    // Validate source items exist and have sufficient stock
    for (const sourceItem of orderData.sourceItems) {
      if (sourceItem.requiredQuantity <= 0) {
        throw new Error('Required quantity for source items must be positive');
      }

      const inventoryItem = await this.inventoryModel.findById(sourceItem.inventoryItemId);
      if (!inventoryItem) {
        throw new Error(`Inventory item ${sourceItem.inventoryItemId} not found`);
      }

      if (inventoryItem.branchId !== orderData.branchId) {
        throw new Error('All source items must be from the same branch as the repack order');
      }

      if (inventoryItem.availableStock < sourceItem.requiredQuantity) {
        throw new Error(`Insufficient stock for item ${inventoryItem.productId}. Available: ${inventoryItem.availableStock}, Required: ${sourceItem.requiredQuantity}`);
      }
    }

    // Check if target product exists and can be repacked
    const targetInventoryItems = await this.inventoryModel.findByProductAndBranch(
      orderData.targetProductId,
      orderData.branchId
    );

    // Create inventory item for target product if it doesn't exist
    if (targetInventoryItems.length === 0) {
      // Get target product details from database
      const productQuery = 'SELECT * FROM public.products WHERE id = $1';
      const productResult = await this.db.query(productQuery, [orderData.targetProductId]);
      
      if (productResult.rows.length === 0) {
        throw new Error('Target product not found');
      }

      const product = productResult.rows[0];
      
      // Create new inventory item for the target product
      await this.inventoryModel.create({
        productId: orderData.targetProductId,
        branchId: orderData.branchId,
        currentStock: 0,
        unit: orderData.targetUnit,
        minStockLevel: 0,
        reorderPoint: 0,
        reorderQuantity: 0,
        cost: 0, // Will be calculated during repack
      });
    }

    const order = await this.repackModel.create({
      ...orderData,
      requestedBy,
    });

    // Reserve source items stock
    for (const sourceItem of orderData.sourceItems) {
      await this.inventoryModel.updateStock(sourceItem.inventoryItemId, {
        reservedStock: (await this.inventoryModel.findById(sourceItem.inventoryItemId))!.reservedStock + sourceItem.requiredQuantity,
      });
    }

    logger.info('Repack order created and stock reserved', {
      repackOrderId: order.id,
      branchId: orderData.branchId,
      sourceItemsCount: orderData.sourceItems.length,
      requestedBy,
    });

    return order;
  }

  async getRepackOrder(id: string): Promise<RepackOrder | null> {
    return this.repackModel.findById(id);
  }

  async getBranchRepackOrders(branchId: string, filters?: {
    status?: RepackOrderStatus;
    targetProductId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ orders: RepackOrder[]; total: number }> {
    return this.repackModel.findByBranch(branchId, filters);
  }

  async startRepackOrder(id: string, performedBy: string, supervisedBy?: string): Promise<RepackOrder> {
    const order = await this.repackModel.findById(id);
    if (!order) {
      throw new Error('Repack order not found');
    }

    if (order.status !== RepackOrderStatus.PLANNED) {
      throw new Error(`Cannot start repack order with status: ${order.status}`);
    }

    // Validate stock availability again
    const validation = await this.repackModel.validateRepackFeasibility(id);
    if (!validation.isValid) {
      const invalidItems = validation.validationResults
        .filter(result => !result.isValid)
        .map(result => `${result.productName}: available ${result.availableStock}, required ${result.requiredQuantity}`)
        .join(', ');
      
      throw new Error(`Insufficient stock for repack operation: ${invalidItems}`);
    }

    const updatedOrder = await this.repackModel.updateStatus(id, RepackOrderStatus.IN_PROGRESS, {
      startedAt: new Date(),
      performedBy,
      supervisedBy,
    });

    if (!updatedOrder) {
      throw new Error('Failed to update repack order status');
    }

    logger.info('Repack order started', {
      repackOrderId: id,
      performedBy,
      supervisedBy,
    });

    return updatedOrder;
  }

  async completeRepackOrder(id: string, actualResults: {
    actualQuantity: number;
    sourceItemActuals: Array<{
      inventoryItemId: string;
      actualQuantity: number;
    }>;
    notes?: string;
  }, performedBy: string): Promise<RepackOrder> {
    const order = await this.repackModel.findById(id);
    if (!order) {
      throw new Error('Repack order not found');
    }

    if (order.status !== RepackOrderStatus.IN_PROGRESS) {
      throw new Error(`Cannot complete repack order with status: ${order.status}`);
    }

    return this.db.transaction(async (client) => {
      // Update source item actual quantities
      for (const sourceActual of actualResults.sourceItemActuals) {
        await this.repackModel.updateSourceItemActual(
          id,
          sourceActual.inventoryItemId,
          sourceActual.actualQuantity
        );
      }

      // Process stock movements for source items (outgoing)
      let totalCost = 0;
      let totalCostWeight = 0;

      for (const sourceItem of order.sourceItems) {
        const actualUsed = actualResults.sourceItemActuals.find(
          a => a.inventoryItemId === sourceItem.inventoryItemId
        );

        if (!actualUsed || actualUsed.actualQuantity === 0) {
          continue;
        }

        const inventoryItem = await this.inventoryModel.findById(sourceItem.inventoryItemId);
        if (!inventoryItem) {
          throw new Error(`Source inventory item ${sourceItem.inventoryItemId} not found`);
        }

        // Calculate cost contribution
        const costContribution = (actualUsed.actualQuantity / inventoryItem.currentStock) * inventoryItem.averageCost * actualUsed.actualQuantity;
        totalCost += costContribution;
        totalCostWeight += actualUsed.actualQuantity;

        // Create outgoing stock movement
        await this.inventoryModel.adjustStock(sourceItem.inventoryItemId, {
          quantity: actualUsed.actualQuantity,
          type: StockMovementType.REPACK,
          reason: `Repack operation: ${order.repackNumber}`,
          referenceId: id,
          referenceType: 'repack_order',
          notes: `Used in repack to create ${order.targetProduct.productName}`,
        }, performedBy);

        // Release reserved stock (remaining reservation)
        const remainingReservation = sourceItem.requiredQuantity - actualUsed.actualQuantity;
        if (remainingReservation > 0) {
          await this.inventoryModel.updateStock(sourceItem.inventoryItemId, {
            reservedStock: inventoryItem.reservedStock - remainingReservation,
          });
        }
      }

      // Calculate average cost per unit for target product
      const avgCostPerUnit = totalCostWeight > 0 ? totalCost / totalCostWeight : 0;

      // Find or create target inventory item
      let targetInventoryItems = await this.inventoryModel.findByProductAndBranch(
        order.targetProduct.productId,
        order.branchId
      );

      let targetInventoryItem = targetInventoryItems[0];

      if (!targetInventoryItem) {
        // This shouldn't happen as we create it during order creation, but just in case
        targetInventoryItem = await this.inventoryModel.create({
          productId: order.targetProduct.productId,
          branchId: order.branchId,
          currentStock: 0,
          unit: order.targetProduct.unit,
          minStockLevel: 0,
          reorderPoint: 0,
          reorderQuantity: 0,
          cost: avgCostPerUnit,
        });
      }

      // Create incoming stock movement for target product
      await this.inventoryModel.adjustStock(targetInventoryItem.id, {
        quantity: actualResults.actualQuantity,
        type: StockMovementType.REPACK,
        reason: `Repack operation: ${order.repackNumber}`,
        referenceId: id,
        referenceType: 'repack_order',
        notes: `Created from repack of ${order.sourceItems.length} source items`,
      }, performedBy);

      // Update target inventory item cost
      await this.inventoryModel.updateStock(targetInventoryItem.id, {
        cost: avgCostPerUnit,
      });

      // Update repack order status
      const updatedOrder = await this.repackModel.updateStatus(id, RepackOrderStatus.COMPLETED, {
        completedAt: new Date(),
        actualQuantity: actualResults.actualQuantity,
        notes: actualResults.notes,
      });

      if (!updatedOrder) {
        throw new Error('Failed to update repack order status');
      }

      // Publish completion event
      await this.db.publishEvent('repack.orders', 'completed', {
        repackOrderId: id,
        repackNumber: order.repackNumber,
        branchId: order.branchId,
        targetProductId: order.targetProduct.productId,
        expectedQuantity: order.targetProduct.expectedQuantity,
        actualQuantity: actualResults.actualQuantity,
        efficiency: (actualResults.actualQuantity / order.targetProduct.expectedQuantity) * 100,
        totalCost,
        avgCostPerUnit,
        performedBy,
      });

      logger.info('Repack order completed', {
        repackOrderId: id,
        expectedQuantity: order.targetProduct.expectedQuantity,
        actualQuantity: actualResults.actualQuantity,
        efficiency: (actualResults.actualQuantity / order.targetProduct.expectedQuantity) * 100,
        totalCost,
        performedBy,
      });

      return updatedOrder;
    });
  }

  async cancelRepackOrder(id: string, reason: string, cancelledBy: string): Promise<RepackOrder> {
    const order = await this.repackModel.findById(id);
    if (!order) {
      throw new Error('Repack order not found');
    }

    if (![RepackOrderStatus.PLANNED, RepackOrderStatus.IN_PROGRESS].includes(order.status)) {
      throw new Error(`Cannot cancel repack order with status: ${order.status}`);
    }

    // Release reserved stock for source items
    for (const sourceItem of order.sourceItems) {
      const inventoryItem = await this.inventoryModel.findById(sourceItem.inventoryItemId);
      if (inventoryItem) {
        await this.inventoryModel.updateStock(sourceItem.inventoryItemId, {
          reservedStock: Math.max(0, inventoryItem.reservedStock - sourceItem.requiredQuantity),
        });
      }
    }

    const updatedOrder = await this.repackModel.updateStatus(id, RepackOrderStatus.CANCELLED, {
      notes: `Cancelled: ${reason}`,
    });

    if (!updatedOrder) {
      throw new Error('Failed to cancel repack order');
    }

    // Publish cancellation event
    await this.db.publishEvent('repack.orders', 'cancelled', {
      repackOrderId: id,
      reason,
      cancelledBy,
      branchId: order.branchId,
    });

    logger.info('Repack order cancelled', {
      repackOrderId: id,
      reason,
      cancelledBy,
    });

    return updatedOrder;
  }

  async validateRepackFeasibility(id: string): Promise<{
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
    return this.repackModel.validateRepackFeasibility(id);
  }

  async getReadyForProcessing(branchId?: string): Promise<RepackOrder[]> {
    return this.repackModel.getReadyForProcessing(branchId);
  }

  async getRepackEfficiencyReport(branchId: string, period?: { startDate: Date; endDate: Date }): Promise<{
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    averageEfficiency: number;
    totalCostSaved: number;
    mostEfficientRepacks: Array<{
      repackNumber: string;
      targetProductName: string;
      efficiency: number;
      costSaved: number;
    }>;
  }> {
    let whereConditions = ['ro.branch_id = $1'];
    let params: any[] = [branchId];
    let paramIndex = 2;

    if (period?.startDate) {
      whereConditions.push(`ro.completed_at >= $${paramIndex}`);
      params.push(period.startDate);
      paramIndex++;
    }

    if (period?.endDate) {
      whereConditions.push(`ro.completed_at <= $${paramIndex}`);
      params.push(period.endDate);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get overall statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        AVG(CASE WHEN status = 'completed' AND actual_quantity > 0 AND expected_quantity > 0 
            THEN (actual_quantity / expected_quantity) * 100 
            END) as average_efficiency
      FROM inventory.repack_orders ro
      WHERE ${whereClause}
    `;

    const statsResult = await this.db.query(statsQuery, params);
    const stats = statsResult.rows[0];

    // Get most efficient repacks
    const efficientQuery = `
      SELECT ro.repack_number, tp.name as target_product_name,
             (ro.actual_quantity / ro.expected_quantity) * 100 as efficiency,
             0 as cost_saved  -- Would need cost calculation logic
      FROM inventory.repack_orders ro
      JOIN public.products tp ON ro.target_product_id = tp.id
      WHERE ${whereClause} AND ro.status = 'completed' 
        AND ro.actual_quantity > 0 AND ro.expected_quantity > 0
      ORDER BY efficiency DESC
      LIMIT 10
    `;

    const efficientResult = await this.db.query(efficientQuery, params);

    return {
      totalOrders: parseInt(stats.total_orders),
      completedOrders: parseInt(stats.completed_orders),
      cancelledOrders: parseInt(stats.cancelled_orders),
      averageEfficiency: parseFloat(stats.average_efficiency) || 0,
      totalCostSaved: 0, // Would need more complex calculation
      mostEfficientRepacks: efficientResult.rows.map(row => ({
        repackNumber: row.repack_number,
        targetProductName: row.target_product_name,
        efficiency: parseFloat(row.efficiency),
        costSaved: parseFloat(row.cost_saved),
      })),
    };
  }

  async suggestRepackOpportunities(branchId: string): Promise<Array<{
    targetProductId: string;
    targetProductName: string;
    suggestedQuantity: number;
    estimatedCostSaving: number;
    sourceItems: Array<{
      inventoryItemId: string;
      productName: string;
      availableStock: number;
      suggestedQuantity: number;
    }>;
  }>> {
    // This is a simplified suggestion algorithm
    // In practice, this would be more sophisticated based on:
    // - Historical repack patterns
    // - Demand forecasting
    // - Cost optimization
    // - Expiration dates

    const query = `
      SELECT p.id as product_id, p.name as product_name, p.is_repackaged,
             SUM(ii.available_stock) as total_available,
             AVG(ii.average_cost) as avg_cost
      FROM inventory.inventory_items ii
      JOIN public.products p ON ii.product_id = p.id
      WHERE ii.branch_id = $1 
        AND ii.available_stock > ii.reorder_point * 2  -- Excess stock
        AND p.is_repackaged = false  -- Can be used as source
      GROUP BY p.id, p.name, p.is_repackaged
      HAVING SUM(ii.available_stock) > 10  -- Minimum threshold
      ORDER BY total_available DESC
      LIMIT 10
    `;

    const result = await this.db.query(query, [branchId]);

    // This is a placeholder implementation
    // Real implementation would use ML/AI for better suggestions
    return result.rows.map(row => ({
      targetProductId: row.product_id,
      targetProductName: `${row.product_name} Mix`,
      suggestedQuantity: Math.floor(parseFloat(row.total_available) * 0.3),
      estimatedCostSaving: parseFloat(row.avg_cost) * 0.1,
      sourceItems: [{
        inventoryItemId: row.product_id, // This would be actual inventory item IDs
        productName: row.product_name,
        availableStock: parseFloat(row.total_available),
        suggestedQuantity: Math.floor(parseFloat(row.total_available) * 0.3),
      }],
    }));
  }
}