import { DeliveryOrderModel } from '../models/DeliveryOrder';
import { DeliveryOrderItemModel } from '../models/DeliveryOrderItem';
import { DeliveryTrackingModel } from '../models/DeliveryTracking';
import { DriverModel } from '../models/Driver';
import DatabaseConnection from '../database/connection';
import {
  DeliveryOrder,
  DeliveryOrderItem,
  DeliveryTracking,
  CreateDeliveryOrderRequest,
  AssignDriverRequest,
  UpdateDeliveryStatusRequest,
  ConfirmDeliveryRequest,
  TrackingUpdateRequest,
  DeliveryStatus,
  TrackingEventType,
  DeliveryType,
  DriverStatus,
} from '@dried-fruits/types';
import logger from '../utils/logger';

export class ShippingService {
  private deliveryOrderModel = new DeliveryOrderModel();
  private deliveryOrderItemModel = new DeliveryOrderItemModel();
  private deliveryTrackingModel = new DeliveryTrackingModel();
  private driverModel = new DriverModel();
  private db = DatabaseConnection.getInstance();

  /**
   * Create a new delivery order
   */
  async createDeliveryOrder(
    orderData: CreateDeliveryOrderRequest,
    createdBy: string
  ): Promise<{
    deliveryOrder: DeliveryOrder;
    items: DeliveryOrderItem[];
  }> {
    // Validate input
    if (orderData.fromBranchId === orderData.toBranchId) {
      throw new Error('Source and destination branches cannot be the same');
    }

    if (orderData.items.length === 0) {
      throw new Error('At least one item is required');
    }

    const scheduledPickupDate = new Date(orderData.scheduledPickupDate);
    const scheduledDeliveryDate = new Date(orderData.scheduledDeliveryDate);

    if (scheduledPickupDate <= new Date()) {
      throw new Error('Pickup date must be in the future');
    }

    if (scheduledDeliveryDate <= scheduledPickupDate) {
      throw new Error('Delivery date must be after pickup date');
    }

    try {
      return await this.db.transaction(async (client) => {
        // Create delivery order
        const deliveryOrder = await this.deliveryOrderModel.create({
          fromBranchId: orderData.fromBranchId,
          toBranchId: orderData.toBranchId,
          deliveryType: orderData.deliveryType,
          scheduledPickupDate,
          scheduledDeliveryDate,
          specialInstructions: orderData.specialInstructions,
          requiresSignature: orderData.requiresSignature || false,
          requiresRefrigeration: orderData.requiresRefrigeration || false,
          contactPersonName: orderData.contactPersonName,
          contactPhone: orderData.contactPhone,
          createdBy,
        });

        // Validate and prepare inventory items
        const itemsToCreate = await this.validateAndPrepareItems(
          deliveryOrder.id,
          orderData.items
        );

        // Create delivery order items
        const deliveryOrderItems = await this.deliveryOrderItemModel.bulkCreate(itemsToCreate);

        // Create initial tracking event
        await this.deliveryTrackingModel.create({
          deliveryOrderId: deliveryOrder.id,
          eventType: TrackingEventType.ORDER_CREATED,
          status: DeliveryStatus.PENDING,
          description: 'Delivery order created and pending driver assignment',
          performedBy: createdBy,
        });

        // Reserve inventory items
        await this.reserveInventoryItems(orderData.items);

        // Publish event
        await this.db.publishEvent('delivery', 'order_created', {
          deliveryOrderId: deliveryOrder.id,
          orderNumber: deliveryOrder.orderNumber,
          fromBranchId: deliveryOrder.fromBranchId,
          toBranchId: deliveryOrder.toBranchId,
          itemCount: deliveryOrderItems.length,
          totalWeight: deliveryOrderItems.reduce((sum, item) => sum + item.weight, 0),
          scheduledPickupDate: deliveryOrder.scheduledPickupDate,
          scheduledDeliveryDate: deliveryOrder.scheduledDeliveryDate,
        });

        logger.info('Delivery order created successfully', {
          deliveryOrderId: deliveryOrder.id,
          orderNumber: deliveryOrder.orderNumber,
          itemCount: deliveryOrderItems.length,
        });

        return {
          deliveryOrder,
          items: deliveryOrderItems,
        };
      });
    } catch (error) {
      logger.error('Error creating delivery order:', error);
      throw error;
    }
  }

  /**
   * Assign driver to delivery order
   */
  async assignDriver(
    deliveryOrderId: string,
    assignmentData: AssignDriverRequest,
    assignedBy: string
  ): Promise<DeliveryOrder> {
    // Validate driver availability
    const driver = await this.driverModel.findById(assignmentData.driverId);
    if (!driver) {
      throw new Error('Driver not found');
    }

    if (!driver.isActive) {
      throw new Error('Driver is not active');
    }

    if (driver.status !== DriverStatus.AVAILABLE) {
      throw new Error('Driver is not available');
    }

    // Check license expiration
    if (driver.licenseExpirationDate <= new Date()) {
      throw new Error('Driver license has expired');
    }

    // Validate vehicle if provided
    if (assignmentData.vehicleId) {
      await this.validateVehicleAvailability(assignmentData.vehicleId);
    }

    try {
      // Assign driver
      const updatedOrder = await this.deliveryOrderModel.assignDriver(
        deliveryOrderId,
        assignmentData.driverId,
        assignmentData.vehicleId,
        assignedBy
      );

      // Create tracking event
      await this.deliveryTrackingModel.create({
        deliveryOrderId,
        eventType: TrackingEventType.DRIVER_ASSIGNED,
        status: DeliveryStatus.ASSIGNED,
        description: `Driver ${driver.employeeId} assigned to delivery`,
        performedBy: assignedBy,
        metadata: {
          driverId: assignmentData.driverId,
          vehicleId: assignmentData.vehicleId,
          notes: assignmentData.notes,
        },
      });

      // Publish event
      await this.db.publishEvent('delivery', 'driver_assigned', {
        deliveryOrderId,
        orderNumber: updatedOrder.orderNumber,
        driverId: assignmentData.driverId,
        driverEmployeeId: driver.employeeId,
        vehicleId: assignmentData.vehicleId,
        assignedBy,
      });

      logger.info('Driver assigned to delivery order', {
        deliveryOrderId,
        driverId: assignmentData.driverId,
        vehicleId: assignmentData.vehicleId,
      });

      return updatedOrder;
    } catch (error) {
      logger.error('Error assigning driver:', error);
      throw error;
    }
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(
    deliveryOrderId: string,
    statusUpdate: UpdateDeliveryStatusRequest,
    updatedBy: string
  ): Promise<{
    deliveryOrder: DeliveryOrder;
    tracking: DeliveryTracking;
  }> {
    const deliveryOrder = await this.deliveryOrderModel.findById(deliveryOrderId);
    if (!deliveryOrder) {
      throw new Error('Delivery order not found');
    }

    // Validate status transition
    this.validateStatusTransition(deliveryOrder.status, statusUpdate.status);

    try {
      return await this.db.transaction(async (client) => {
        // Prepare status update data
        const updateData: any = {};

        if (statusUpdate.status === DeliveryStatus.IN_TRANSIT && statusUpdate.actualTime) {
          updateData.actualPickupTime = new Date(statusUpdate.actualTime);
        }

        if (statusUpdate.status === DeliveryStatus.DELIVERED && statusUpdate.actualTime) {
          updateData.actualDeliveryTime = new Date(statusUpdate.actualTime);
        }

        // Update delivery order status
        const updatedOrder = await this.deliveryOrderModel.updateStatus(
          deliveryOrderId,
          statusUpdate.status,
          updateData
        );

        // Determine tracking event type
        const eventType = this.getTrackingEventType(statusUpdate.status);

        // Create tracking event
        const trackingEvent = await this.deliveryTrackingModel.create({
          deliveryOrderId,
          eventType,
          status: statusUpdate.status,
          location: statusUpdate.location,
          coordinates: statusUpdate.coordinates,
          description: statusUpdate.notes || this.getDefaultStatusDescription(statusUpdate.status),
          performedBy: updatedBy,
          timestamp: statusUpdate.actualTime ? new Date(statusUpdate.actualTime) : new Date(),
        });

        // Update driver status if needed
        if (deliveryOrder.driverId) {
          await this.updateDriverStatusBasedOnDelivery(deliveryOrder.driverId, statusUpdate.status);
        }

        // Handle special status updates
        if (statusUpdate.status === DeliveryStatus.DELIVERED) {
          await this.handleDeliveryCompletion(deliveryOrderId);
        } else if (statusUpdate.status === DeliveryStatus.CANCELLED) {
          await this.handleDeliveryCancellation(deliveryOrderId);
        }

        // Publish event
        await this.db.publishEvent('delivery', 'status_updated', {
          deliveryOrderId,
          orderNumber: updatedOrder.orderNumber,
          oldStatus: deliveryOrder.status,
          newStatus: statusUpdate.status,
          location: statusUpdate.location,
          coordinates: statusUpdate.coordinates,
          updatedBy,
        });

        logger.info('Delivery status updated', {
          deliveryOrderId,
          oldStatus: deliveryOrder.status,
          newStatus: statusUpdate.status,
          updatedBy,
        });

        return {
          deliveryOrder: updatedOrder,
          tracking: trackingEvent,
        };
      });
    } catch (error) {
      logger.error('Error updating delivery status:', error);
      throw error;
    }
  }

  /**
   * Confirm delivery and transfer inventory
   */
  async confirmDelivery(
    deliveryOrderId: string,
    confirmationData: ConfirmDeliveryRequest,
    confirmedBy: string
  ): Promise<{
    deliveryOrder: DeliveryOrder;
    confirmedItems: DeliveryOrderItem[];
  }> {
    const deliveryOrder = await this.deliveryOrderModel.findById(deliveryOrderId);
    if (!deliveryOrder) {
      throw new Error('Delivery order not found');
    }

    if (deliveryOrder.status !== DeliveryStatus.DELIVERED) {
      throw new Error('Delivery order must be in delivered status to confirm');
    }

    try {
      return await this.db.transaction(async (client) => {
        // Confirm individual items
        const confirmedItems = await this.deliveryOrderItemModel.confirmMultipleItems(
          confirmationData.items
        );

        // Update delivery order with confirmation details
        const updatedOrder = await this.deliveryOrderModel.updateStatus(
          deliveryOrderId,
          DeliveryStatus.DELIVERED,
          {
            receivedBy: confirmationData.receivedBy,
            signatureData: confirmationData.signatureData,
            photoProof: confirmationData.photoProof,
            deliveryNotes: confirmationData.notes,
          }
        );

        // Transfer inventory to destination branch
        await this.transferInventoryToBranch(deliveryOrderId, confirmedItems);

        // Create tracking event
        await this.deliveryTrackingModel.create({
          deliveryOrderId,
          eventType: TrackingEventType.DELIVERY_COMPLETED,
          status: DeliveryStatus.DELIVERED,
          description: `Delivery confirmed by ${confirmationData.receivedBy}`,
          performedBy: confirmedBy,
          metadata: {
            receivedBy: confirmationData.receivedBy,
            hasSignature: !!confirmationData.signatureData,
            hasPhoto: !!confirmationData.photoProof,
            confirmedItemsCount: confirmedItems.length,
          },
        });

        // Update driver status
        if (deliveryOrder.driverId) {
          await this.driverModel.updateStatus(deliveryOrder.driverId, DriverStatus.AVAILABLE);
        }

        // Publish event
        await this.db.publishEvent('delivery', 'delivery_confirmed', {
          deliveryOrderId,
          orderNumber: updatedOrder.orderNumber,
          receivedBy: confirmationData.receivedBy,
          confirmedItems: confirmedItems.length,
          toBranchId: deliveryOrder.toBranchId,
          confirmedBy,
        });

        logger.info('Delivery confirmed successfully', {
          deliveryOrderId,
          receivedBy: confirmationData.receivedBy,
          confirmedItems: confirmedItems.length,
        });

        return {
          deliveryOrder: updatedOrder,
          confirmedItems,
        };
      });
    } catch (error) {
      logger.error('Error confirming delivery:', error);
      throw error;
    }
  }

  /**
   * Add tracking update
   */
  async addTrackingUpdate(
    deliveryOrderId: string,
    trackingData: TrackingUpdateRequest,
    updatedBy: string
  ): Promise<DeliveryTracking> {
    const deliveryOrder = await this.deliveryOrderModel.findById(deliveryOrderId);
    if (!deliveryOrder) {
      throw new Error('Delivery order not found');
    }

    try {
      const trackingEvent = await this.deliveryTrackingModel.create({
        deliveryOrderId,
        eventType: trackingData.eventType,
        status: deliveryOrder.status,
        location: trackingData.location,
        coordinates: trackingData.coordinates,
        description: trackingData.description,
        performedBy: updatedBy,
        metadata: trackingData.metadata,
      });

      // Update driver location if coordinates provided
      if (deliveryOrder.driverId && trackingData.coordinates) {
        await this.driverModel.updateLocation(
          deliveryOrder.driverId,
          trackingData.coordinates.latitude,
          trackingData.coordinates.longitude
        );
      }

      // Publish event
      await this.db.publishEvent('delivery', 'tracking_updated', {
        deliveryOrderId,
        orderNumber: deliveryOrder.orderNumber,
        eventType: trackingData.eventType,
        location: trackingData.location,
        coordinates: trackingData.coordinates,
        updatedBy,
      });

      logger.info('Tracking update added', {
        deliveryOrderId,
        eventType: trackingData.eventType,
        location: trackingData.location,
      });

      return trackingEvent;
    } catch (error) {
      logger.error('Error adding tracking update:', error);
      throw error;
    }
  }

  /**
   * Get delivery order with full details
   */
  async getDeliveryOrderDetails(deliveryOrderId: string): Promise<{
    deliveryOrder: DeliveryOrder;
    items: DeliveryOrderItem[];
    tracking: DeliveryTracking[];
    driver?: any;
    vehicle?: any;
    fromBranch: any;
    toBranch: any;
  }> {
    const deliveryOrder = await this.deliveryOrderModel.findById(deliveryOrderId);
    if (!deliveryOrder) {
      throw new Error('Delivery order not found');
    }

    // Get items and tracking
    const [items, tracking] = await Promise.all([
      this.deliveryOrderItemModel.findByDeliveryOrder(deliveryOrderId),
      this.deliveryTrackingModel.findByDeliveryOrder(deliveryOrderId),
    ]);

    // Get driver and vehicle info
    let driver, vehicle;
    if (deliveryOrder.driverId) {
      driver = await this.driverModel.findById(deliveryOrder.driverId);
    }

    if (deliveryOrder.vehicleId) {
      vehicle = await this.getVehicleById(deliveryOrder.vehicleId);
    }

    // Get branch information
    const [fromBranch, toBranch] = await Promise.all([
      this.getBranchById(deliveryOrder.fromBranchId),
      this.getBranchById(deliveryOrder.toBranchId),
    ]);

    return {
      deliveryOrder,
      items,
      tracking,
      driver,
      vehicle,
      fromBranch,
      toBranch,
    };
  }

  /**
   * Get driver's assigned orders
   */
  async getDriverOrders(driverId: string): Promise<{
    activeOrders: any[];
    completedOrders: any[];
    driverInfo: any;
  }> {
    const driver = await this.driverModel.findById(driverId);
    if (!driver) {
      throw new Error('Driver not found');
    }

    const allOrders = await this.deliveryOrderModel.findByDriver(driverId);
    
    const activeOrders = allOrders.filter(order => 
      ['assigned', 'in_transit'].includes(order.status)
    );
    
    const completedOrders = allOrders.filter(order => 
      ['delivered', 'cancelled', 'failed'].includes(order.status)
    );

    return {
      activeOrders,
      completedOrders,
      driverInfo: driver,
    };
  }

  /**
   * Get incoming orders for a branch
   */
  async getBranchIncomingOrders(branchId: string): Promise<any[]> {
    const orders = await this.deliveryOrderModel.findByBranch(branchId, 'to');
    
    // Filter for incoming orders that aren't delivered yet
    const incomingOrders = orders.filter(order => 
      !['delivered', 'cancelled', 'failed'].includes(order.status)
    );

    // Enrich with additional details
    const enrichedOrders = await Promise.all(
      incomingOrders.map(async (order) => {
        const [fromBranch, driver, vehicle, items] = await Promise.all([
          this.getBranchById(order.fromBranchId),
          order.driverId ? this.driverModel.findById(order.driverId) : null,
          order.vehicleId ? this.getVehicleById(order.vehicleId) : null,
          this.deliveryOrderItemModel.findByDeliveryOrder(order.id),
        ]);

        return {
          ...order,
          fromBranch,
          driver,
          vehicle,
          itemCount: items.length,
          estimatedArrival: order.scheduledDeliveryDate,
        };
      })
    );

    return enrichedOrders;
  }

  // Private helper methods

  private async validateAndPrepareItems(
    deliveryOrderId: string,
    items: Array<{ inventoryItemId: string; quantity: number }>
  ): Promise<any[]> {
    const itemsToCreate = [];

    for (const item of items) {
      // Get inventory item details
      const inventoryItem = await this.getInventoryItemById(item.inventoryItemId);
      if (!inventoryItem) {
        throw new Error(`Inventory item not found: ${item.inventoryItemId}`);
      }

      if (inventoryItem.availableStock < item.quantity) {
        throw new Error(`Insufficient stock for item ${item.inventoryItemId}`);
      }

      // Get product details
      const product = await this.getProductById(inventoryItem.productId);
      if (!product) {
        throw new Error(`Product not found: ${inventoryItem.productId}`);
      }

      itemsToCreate.push({
        deliveryOrderId,
        inventoryItemId: item.inventoryItemId,
        productId: inventoryItem.productId,
        productName: product.name,
        quantity: item.quantity,
        unit: inventoryItem.unit,
        weight: item.quantity * (inventoryItem.unitWeight || 1),
        value: item.quantity * inventoryItem.unitCost,
        batchNumber: inventoryItem.batchNumber,
        expirationDate: inventoryItem.expirationDate,
        barcodeId: inventoryItem.barcodeId,
      });
    }

    return itemsToCreate;
  }

  private validateStatusTransition(currentStatus: DeliveryStatus, newStatus: DeliveryStatus): void {
    const validTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
      [DeliveryStatus.PENDING]: [DeliveryStatus.ASSIGNED, DeliveryStatus.CANCELLED],
      [DeliveryStatus.ASSIGNED]: [DeliveryStatus.IN_TRANSIT, DeliveryStatus.CANCELLED],
      [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED, DeliveryStatus.CANCELLED],
      [DeliveryStatus.DELIVERED]: [], // Final state
      [DeliveryStatus.CANCELLED]: [], // Final state
      [DeliveryStatus.FAILED]: [DeliveryStatus.ASSIGNED], // Can reassign
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  private getTrackingEventType(status: DeliveryStatus): TrackingEventType {
    const eventMap: Record<DeliveryStatus, TrackingEventType> = {
      [DeliveryStatus.PENDING]: TrackingEventType.ORDER_CREATED,
      [DeliveryStatus.ASSIGNED]: TrackingEventType.DRIVER_ASSIGNED,
      [DeliveryStatus.IN_TRANSIT]: TrackingEventType.IN_TRANSIT,
      [DeliveryStatus.DELIVERED]: TrackingEventType.DELIVERY_COMPLETED,
      [DeliveryStatus.CANCELLED]: TrackingEventType.CANCELLED,
      [DeliveryStatus.FAILED]: TrackingEventType.DELIVERY_FAILED,
    };

    return eventMap[status];
  }

  private getDefaultStatusDescription(status: DeliveryStatus): string {
    const descriptions: Record<DeliveryStatus, string> = {
      [DeliveryStatus.PENDING]: 'Delivery order created and pending assignment',
      [DeliveryStatus.ASSIGNED]: 'Driver assigned and ready for pickup',
      [DeliveryStatus.IN_TRANSIT]: 'Package in transit to destination',
      [DeliveryStatus.DELIVERED]: 'Package delivered successfully',
      [DeliveryStatus.CANCELLED]: 'Delivery cancelled',
      [DeliveryStatus.FAILED]: 'Delivery failed',
    };

    return descriptions[status];
  }

  private async updateDriverStatusBasedOnDelivery(driverId: string, deliveryStatus: DeliveryStatus): Promise<void> {
    let driverStatus: DriverStatus;

    switch (deliveryStatus) {
      case DeliveryStatus.IN_TRANSIT:
        driverStatus = DriverStatus.IN_TRANSIT;
        break;
      case DeliveryStatus.DELIVERED:
      case DeliveryStatus.CANCELLED:
      case DeliveryStatus.FAILED:
        driverStatus = DriverStatus.AVAILABLE;
        break;
      default:
        return; // No status change needed
    }

    await this.driverModel.updateStatus(driverId, driverStatus);
  }

  // Integration methods (these would call external services)
  private async reserveInventoryItems(items: Array<{ inventoryItemId: string; quantity: number }>): Promise<void> {
    // Call inventory service to reserve items
    // Implementation would depend on inventory service API
  }

  private async transferInventoryToBranch(deliveryOrderId: string, items: DeliveryOrderItem[]): Promise<void> {
    // Call inventory service to transfer items to destination branch
    // Implementation would depend on inventory service API
  }

  private async handleDeliveryCompletion(deliveryOrderId: string): Promise<void> {
    // Handle post-delivery tasks
    // Update performance metrics, send notifications, etc.
  }

  private async handleDeliveryCancellation(deliveryOrderId: string): Promise<void> {
    // Release reserved inventory
    // Update driver availability
    // Send notifications
  }

  private async validateVehicleAvailability(vehicleId: string): Promise<void> {
    // Check if vehicle is available and properly maintained
    // Implementation would check vehicle status
  }

  private async getInventoryItemById(id: string): Promise<any> {
    // Call inventory service
    // Mock implementation
    return null;
  }

  private async getProductById(id: string): Promise<any> {
    // Call product service or database
    // Mock implementation
    return null;
  }

  private async getBranchById(id: string): Promise<any> {
    // Get branch information
    // Mock implementation
    return null;
  }

  private async getVehicleById(id: string): Promise<any> {
    // Get vehicle information
    // Mock implementation
    return null;
  }
}

export default ShippingService;