import DatabaseConnection from '../database/connection';
import DeliveryOrderModel from '../models/DeliveryOrder';
import DeliveryOrderItemModel from '../models/DeliveryOrderItem';
import DriverModel from '../models/Driver';
import { 
  DeliveryOrder, 
  DeliveryOrderItem, 
  DeliveryStatus, 
  DeliveryType,
  DriverStatus,
  UnitType 
} from '@dried-fruits/types';
import logger from '../utils/logger';
import axios from 'axios';
import { config } from '../config';

interface CreateDeliveryOrderRequest {
  fromBranchId: string;
  toBranchId: string;
  deliveryType: DeliveryType;
  scheduledPickupDate: Date;
  scheduledDeliveryDate: Date;
  items: Array<{
    inventoryItemId: string;
    productId: string;
    productName: string;
    quantity: number;
    unit: UnitType;
    batchNumber?: string;
    expirationDate?: Date;
    barcodeId?: string;
  }>;
  specialInstructions?: string;
  requiresSignature?: boolean;
  requiresRefrigeration?: boolean;
  contactPersonName?: string;
  contactPhone?: string;
  createdBy: string;
}

interface InventoryReservation {
  inventoryItemId: string;
  quantity: number;
  unit: UnitType;
  reservationId?: string;
}

export class DeliveryOrderService {
  private db = DatabaseConnection.getInstance();
  private deliveryOrderModel = new DeliveryOrderModel();
  private deliveryOrderItemModel = new DeliveryOrderItemModel();
  private driverModel = new DriverModel();

  async createDeliveryOrder(orderData: CreateDeliveryOrderRequest): Promise<DeliveryOrder> {
    return this.db.transaction(async (client) => {
      try {
        // Validate inventory availability and reserve stock
        const reservations = await this.reserveInventory(orderData.items);

        // Calculate totals from items
        const { totalWeight, totalValue } = await this.calculateOrderTotals(orderData.items);

        // Create delivery order
        const deliveryOrder = await this.deliveryOrderModel.create({
          fromBranchId: orderData.fromBranchId,
          toBranchId: orderData.toBranchId,
          deliveryType: orderData.deliveryType,
          scheduledPickupDate: orderData.scheduledPickupDate,
          scheduledDeliveryDate: orderData.scheduledDeliveryDate,
          specialInstructions: orderData.specialInstructions,
          requiresSignature: orderData.requiresSignature,
          requiresRefrigeration: orderData.requiresRefrigeration,
          contactPersonName: orderData.contactPersonName,
          contactPhone: orderData.contactPhone,
          createdBy: orderData.createdBy,
        });

        // Create delivery order items with reservation IDs
        const enrichedItems = orderData.items.map((item, index) => ({
          ...item,
          deliveryOrderId: deliveryOrder.id,
          weight: this.calculateItemWeight(item.quantity, item.unit),
          value: 0, // Would be calculated from inventory service
          reservationId: reservations[index]?.reservationId,
        }));

        const items = await this.deliveryOrderItemModel.bulkCreate(enrichedItems);

        // Update delivery order with calculated totals
        await this.updateDeliveryOrderTotals(deliveryOrder.id, items.length, totalWeight, totalValue);

        // Publish event
        await this.publishDeliveryEvent('delivery.order.created', {
          orderId: deliveryOrder.id,
          orderNumber: deliveryOrder.orderNumber,
          fromBranchId: orderData.fromBranchId,
          toBranchId: orderData.toBranchId,
          itemCount: items.length,
        });

        logger.info('Delivery order created successfully', {
          orderId: deliveryOrder.id,
          orderNumber: deliveryOrder.orderNumber,
          itemCount: items.length,
          totalWeight,
        });

        return {
          ...deliveryOrder,
          items,
          totalItems: items.length,
          totalWeight,
          totalValue,
        };

      } catch (error) {
        logger.error('Failed to create delivery order', { error: error.message, orderData });
        
        // Rollback inventory reservations if order creation fails
        if (error.reservations) {
          await this.rollbackInventoryReservations(error.reservations);
        }
        
        throw error;
      }
    });
  }

  async getDeliveryOrder(id: string): Promise<DeliveryOrder | null> {
    const order = await this.deliveryOrderModel.findById(id);
    if (!order) return null;

    const items = await this.deliveryOrderItemModel.findByDeliveryOrder(id);
    
    return {
      ...order,
      items,
    };
  }

  async updateDeliveryStatus(
    id: string,
    status: DeliveryStatus,
    updates?: {
      actualPickupTime?: Date;
      actualDeliveryTime?: Date;
      receivedBy?: string;
      signatureData?: string;
      photoProof?: string;
      deliveryNotes?: string;
    }
  ): Promise<DeliveryOrder> {
    const currentOrder = await this.deliveryOrderModel.findById(id);
    if (!currentOrder) {
      throw new Error('Delivery order not found');
    }

    // Validate status transition
    this.validateStatusTransition(currentOrder.status, status);

    // Update order status
    const updatedOrder = await this.deliveryOrderModel.updateStatus(id, status, updates);

    // Handle status-specific actions
    switch (status) {
      case DeliveryStatus.IN_TRANSIT:
        await this.handlePickupConfirmation(updatedOrder);
        break;
      
      case DeliveryStatus.DELIVERED:
        await this.handleDeliveryConfirmation(updatedOrder);
        break;
      
      case DeliveryStatus.CANCELLED:
        await this.handleOrderCancellation(updatedOrder);
        break;
    }

    // Publish status update event
    await this.publishDeliveryEvent('delivery.status.updated', {
      orderId: id,
      orderNumber: updatedOrder.orderNumber,
      oldStatus: currentOrder.status,
      newStatus: status,
    });

    return updatedOrder;
  }

  async assignDriverToOrder(
    orderId: string,
    driverId: string,
    vehicleId?: string,
    assignedBy?: string
  ): Promise<DeliveryOrder> {
    // Validate driver availability
    const driver = await this.driverModel.findById(driverId);
    if (!driver) {
      throw new Error('Driver not found');
    }

    if (driver.status !== DriverStatus.AVAILABLE && driver.status !== DriverStatus.IDLE) {
      throw new Error(`Driver is not available. Current status: ${driver.status}`);
    }

    // Check driver's current workload
    const activeOrders = await this.deliveryOrderModel.findByDriver(driverId, true);
    if (activeOrders.length >= config.delivery.maxOrdersPerDriver) {
      throw new Error(`Driver already has maximum number of active orders (${activeOrders.length})`);
    }

    // Assign driver to order
    const updatedOrder = await this.deliveryOrderModel.assignDriver(
      orderId,
      driverId,
      vehicleId,
      assignedBy
    );

    // Update driver status
    await this.driverModel.updateStatus(driverId, DriverStatus.ASSIGNED);

    // Send notification to driver
    await this.notifyDriver(driverId, {
      type: 'new_assignment',
      orderId,
      orderNumber: updatedOrder.orderNumber,
      pickupLocation: updatedOrder.fromBranchId,
      deliveryLocation: updatedOrder.toBranchId,
      scheduledPickupTime: updatedOrder.scheduledPickupDate,
    });

    // Publish assignment event
    await this.publishDeliveryEvent('delivery.driver.assigned', {
      orderId,
      driverId,
      vehicleId,
      assignedBy,
    });

    logger.info('Driver assigned to delivery order', {
      orderId,
      driverId,
      vehicleId,
    });

    return updatedOrder;
  }

  async getOrdersByBranch(
    branchId: string,
    direction: 'from' | 'to' | 'both' = 'both',
    includeItems: boolean = false
  ): Promise<DeliveryOrder[]> {
    const orders = await this.deliveryOrderModel.findByBranch(branchId, direction);

    if (includeItems) {
      // Fetch items for each order
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await this.deliveryOrderItemModel.findByDeliveryOrder(order.id);
          return { ...order, items };
        })
      );
      return ordersWithItems;
    }

    return orders;
  }

  async getOrdersByDriver(
    driverId: string,
    activeOnly: boolean = false
  ): Promise<DeliveryOrder[]> {
    return this.deliveryOrderModel.findByDriver(driverId, activeOnly);
  }

  async getOrdersRequiringAttention(): Promise<{
    overdue: DeliveryOrder[];
    delayed: DeliveryOrder[];
    unassigned: DeliveryOrder[];
  }> {
    return this.deliveryOrderModel.getOrdersRequiringAttention();
  }

  async confirmDeliveryItems(
    orderId: string,
    confirmations: Array<{
      itemId: string;
      actualQuantity: number;
      notes?: string;
    }>
  ): Promise<DeliveryOrderItem[]> {
    // Validate order exists and is in correct status
    const order = await this.deliveryOrderModel.findById(orderId);
    if (!order) {
      throw new Error('Delivery order not found');
    }

    if (order.status !== DeliveryStatus.DELIVERED) {
      throw new Error('Can only confirm items for delivered orders');
    }

    // Confirm items
    const confirmedItems = await this.deliveryOrderItemModel.confirmMultipleItems(
      confirmations.map(c => ({
        id: c.itemId,
        actualQuantity: c.actualQuantity,
        notes: c.notes,
      }))
    );

    // Check if all items are confirmed
    const remainingItems = await this.deliveryOrderItemModel.findItemsRequiringConfirmation(orderId);
    
    if (remainingItems.length === 0) {
      // Transfer inventory to destination branch
      await this.transferInventoryToBranch(order, confirmedItems);
      
      // Publish completion event
      await this.publishDeliveryEvent('delivery.completed', {
        orderId,
        orderNumber: order.orderNumber,
        confirmedItems: confirmedItems.length,
      });
    }

    return confirmedItems;
  }

  async getDeliveryAnalytics(
    startDate: Date,
    endDate: Date,
    branchId?: string
  ) {
    return this.deliveryOrderModel.getDeliveryAnalytics(startDate, endDate, branchId);
  }

  async optimizeDriverAssignments(unassignedOrders: DeliveryOrder[]): Promise<Array<{
    orderId: string;
    suggestedDriverId: string;
    reason: string;
    score: number;
  }>> {
    // Get available drivers
    const availableDrivers = await this.driverModel.findAvailableDrivers();
    
    const suggestions: Array<{
      orderId: string;
      suggestedDriverId: string;
      reason: string;
      score: number;
    }> = [];

    for (const order of unassignedOrders) {
      // Find best driver for this order
      let bestDriver = null;
      let bestScore = -1;
      let bestReason = '';

      for (const driver of availableDrivers) {
        // Calculate assignment score based on various factors
        const score = await this.calculateDriverAssignmentScore(driver, order);
        
        if (score.total > bestScore) {
          bestScore = score.total;
          bestDriver = driver;
          bestReason = score.reason;
        }
      }

      if (bestDriver) {
        suggestions.push({
          orderId: order.id,
          suggestedDriverId: bestDriver.id,
          reason: bestReason,
          score: bestScore,
        });
      }
    }

    // Sort by score (highest first)
    return suggestions.sort((a, b) => b.score - a.score);
  }

  private async reserveInventory(items: Array<{
    inventoryItemId: string;
    quantity: number;
    unit: UnitType;
  }>): Promise<InventoryReservation[]> {
    try {
      const inventoryService = axios.create({
        baseURL: config.services.inventoryService.url,
        timeout: config.services.inventoryService.timeout,
      });

      const response = await inventoryService.post('/api/inventory/reserve', {
        items: items.map(item => ({
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          unit: item.unit,
          reason: 'delivery_order',
        })),
      });

      if (!response.data.success) {
        throw new Error(`Inventory reservation failed: ${response.data.message}`);
      }

      return response.data.reservations;

    } catch (error) {
      if (error.response) {
        throw new Error(`Inventory service error: ${error.response.data.message}`);
      }
      throw new Error(`Failed to reserve inventory: ${error.message}`);
    }
  }

  private async rollbackInventoryReservations(reservations: InventoryReservation[]): Promise<void> {
    try {
      const inventoryService = axios.create({
        baseURL: config.services.inventoryService.url,
        timeout: config.services.inventoryService.timeout,
      });

      await inventoryService.post('/api/inventory/cancel-reservations', {
        reservationIds: reservations.map(r => r.reservationId).filter(id => id),
      });

    } catch (error) {
      logger.error('Failed to rollback inventory reservations', { error: error.message, reservations });
    }
  }

  private async calculateOrderTotals(items: Array<{
    quantity: number;
    unit: UnitType;
  }>): Promise<{ totalWeight: number; totalValue: number }> {
    // This would normally fetch actual weights and values from inventory service
    let totalWeight = 0;
    let totalValue = 0;

    for (const item of items) {
      totalWeight += this.calculateItemWeight(item.quantity, item.unit);
      // Value would be calculated from inventory data
    }

    return { totalWeight, totalValue };
  }

  private calculateItemWeight(quantity: number, unit: UnitType): number {
    // Convert quantity to kilograms based on unit
    switch (unit) {
      case UnitType.GRAM:
        return quantity / 1000;
      case UnitType.KEED:
        return quantity * 0.6; // 1 keed ≈ 600 grams
      case UnitType.KILOGRAM:
        return quantity;
      case UnitType.PIECE:
        return quantity * 0.1; // Estimate 100g per piece
      case UnitType.PACK:
        return quantity * 0.5; // Estimate 500g per pack
      default:
        return quantity;
    }
  }

  private async updateDeliveryOrderTotals(
    orderId: string,
    totalItems: number,
    totalWeight: number,
    totalValue: number
  ): Promise<void> {
    const query = `
      UPDATE shipping.delivery_orders 
      SET 
        total_items = $2,
        total_weight_kg = $3,
        total_value = $4,
        updated_at = NOW()
      WHERE id = $1
    `;

    await this.db.query(query, [orderId, totalItems, totalWeight, totalValue]);
  }

  private validateStatusTransition(currentStatus: DeliveryStatus, newStatus: DeliveryStatus): void {
    const validTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
      [DeliveryStatus.PENDING]: [DeliveryStatus.ASSIGNED, DeliveryStatus.CANCELLED],
      [DeliveryStatus.ASSIGNED]: [DeliveryStatus.IN_TRANSIT, DeliveryStatus.CANCELLED],
      [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
      [DeliveryStatus.DELIVERED]: [],
      [DeliveryStatus.CANCELLED]: [],
      [DeliveryStatus.FAILED]: [DeliveryStatus.ASSIGNED], // Can retry
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  private async handlePickupConfirmation(order: DeliveryOrder): Promise<void> {
    // Update driver location tracking
    await this.publishDeliveryEvent('delivery.pickup.confirmed', {
      orderId: order.id,
      driverId: order.driverId,
      pickupTime: new Date(),
    });
  }

  private async handleDeliveryConfirmation(order: DeliveryOrder): Promise<void> {
    // Update driver status
    if (order.driverId) {
      const remainingOrders = await this.deliveryOrderModel.findByDriver(order.driverId, true);
      if (remainingOrders.filter(o => o.id !== order.id).length === 0) {
        await this.driverModel.updateStatus(order.driverId, DriverStatus.AVAILABLE);
      }
    }
  }

  private async handleOrderCancellation(order: DeliveryOrder): Promise<void> {
    // Release inventory reservations
    const items = await this.deliveryOrderItemModel.findByDeliveryOrder(order.id);
    
    try {
      const inventoryService = axios.create({
        baseURL: config.services.inventoryService.url,
        timeout: config.services.inventoryService.timeout,
      });

      await inventoryService.post('/api/inventory/release-reservations', {
        orderId: order.id,
        items: items.map(item => ({
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          unit: item.unit,
        })),
      });

    } catch (error) {
      logger.error('Failed to release inventory reservations', { error: error.message, orderId: order.id });
    }

    // Update driver status if assigned
    if (order.driverId) {
      const remainingOrders = await this.deliveryOrderModel.findByDriver(order.driverId, true);
      if (remainingOrders.filter(o => o.id !== order.id).length === 0) {
        await this.driverModel.updateStatus(order.driverId, DriverStatus.AVAILABLE);
      }
    }
  }

  private async transferInventoryToBranch(
    order: DeliveryOrder,
    confirmedItems: DeliveryOrderItem[]
  ): Promise<void> {
    try {
      const inventoryService = axios.create({
        baseURL: config.services.inventoryService.url,
        timeout: config.services.inventoryService.timeout,
      });

      await inventoryService.post('/api/inventory/transfer', {
        fromBranchId: order.fromBranchId,
        toBranchId: order.toBranchId,
        items: confirmedItems.map(item => ({
          inventoryItemId: item.inventoryItemId,
          quantity: item.actualQuantity || item.quantity,
          unit: item.unit,
        })),
        referenceType: 'delivery_order',
        referenceId: order.id,
      });

    } catch (error) {
      logger.error('Failed to transfer inventory', { error: error.message, orderId: order.id });
      throw new Error(`Inventory transfer failed: ${error.message}`);
    }
  }

  private async calculateDriverAssignmentScore(
    driver: any,
    order: DeliveryOrder
  ): Promise<{ total: number; reason: string }> {
    let score = 0;
    const factors: string[] = [];

    // Factor 1: Current location proximity (if available)
    // This would use real GPS data in production
    const locationScore = 50; // Base score
    score += locationScore;
    factors.push('location proximity');

    // Factor 2: Driver's delivery history to the destination
    const deliveryHistory = await this.db.query(
      `SELECT COUNT(*) as count 
       FROM shipping.delivery_orders 
       WHERE driver_id = $1 AND to_branch_id = $2 AND status = 'delivered'`,
      [driver.id, order.toBranchId]
    );
    
    const historyCount = parseInt(deliveryHistory.rows[0].count) || 0;
    if (historyCount > 0) {
      score += Math.min(historyCount * 5, 25);
      factors.push(`${historyCount} previous deliveries to destination`);
    }

    // Factor 3: Current workload
    const activeOrders = await this.deliveryOrderModel.findByDriver(driver.id, true);
    const workloadScore = Math.max(0, 25 - (activeOrders.length * 10));
    score += workloadScore;
    factors.push(`${activeOrders.length} active orders`);

    // Factor 4: Special requirements match
    if (order.requiresRefrigeration && driver.hasRefrigeratedVehicle) {
      score += 20;
      factors.push('refrigerated vehicle available');
    }

    return {
      total: score,
      reason: factors.join(', '),
    };
  }

  private async notifyDriver(driverId: string, notification: any): Promise<void> {
    try {
      await this.publishDeliveryEvent('driver.notification', {
        driverId,
        ...notification,
      });
    } catch (error) {
      logger.error('Failed to notify driver', { error: error.message, driverId, notification });
    }
  }

  private async publishDeliveryEvent(eventType: string, data: any): Promise<void> {
    try {
      await this.db.publishEvent('delivery', eventType, data);
    } catch (error) {
      logger.error('Failed to publish delivery event', { eventType, data, error: error.message });
    }
  }
}

export default DeliveryOrderService;