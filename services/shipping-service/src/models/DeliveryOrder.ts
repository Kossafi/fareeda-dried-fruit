import DatabaseConnection from '../database/connection';
import { DeliveryOrder, DeliveryOrderItem, DeliveryStatus, DeliveryType } from '@dried-fruits/types';
import logger from '../utils/logger';

export class DeliveryOrderModel {
  private db = DatabaseConnection.getInstance();

  async create(orderData: {
    fromBranchId: string;
    toBranchId: string;
    deliveryType: DeliveryType;
    scheduledPickupDate: Date;
    scheduledDeliveryDate: Date;
    specialInstructions?: string;
    requiresSignature?: boolean;
    requiresRefrigeration?: boolean;
    contactPersonName?: string;
    contactPhone?: string;
    createdBy: string;
  }): Promise<DeliveryOrder> {
    return this.db.transaction(async (client) => {
      // Generate order number
      const orderNumberResult = await client.query('SELECT generate_delivery_order_number() as order_number');
      const orderNumber = orderNumberResult.rows[0].order_number;

      // Create delivery order
      const insertQuery = `
        INSERT INTO shipping.delivery_orders (
          order_number, from_branch_id, to_branch_id, delivery_type,
          scheduled_pickup_date, scheduled_delivery_date, special_instructions,
          requires_signature, requires_refrigeration, contact_person_name,
          contact_phone, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const values = [
        orderNumber,
        orderData.fromBranchId,
        orderData.toBranchId,
        orderData.deliveryType,
        orderData.scheduledPickupDate,
        orderData.scheduledDeliveryDate,
        orderData.specialInstructions,
        orderData.requiresSignature || false,
        orderData.requiresRefrigeration || false,
        orderData.contactPersonName,
        orderData.contactPhone,
        orderData.createdBy,
      ];

      const result = await client.query(insertQuery, values);
      const deliveryOrder = result.rows[0];

      logger.info('Delivery order created', {
        deliveryOrderId: deliveryOrder.id,
        orderNumber: deliveryOrder.order_number,
        fromBranchId: orderData.fromBranchId,
        toBranchId: orderData.toBranchId,
      });

      return this.mapToDeliveryOrder(deliveryOrder);
    });
  }

  async findById(id: string): Promise<DeliveryOrder | null> {
    const query = `
      SELECT * FROM shipping.delivery_orders 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapToDeliveryOrder(result.rows[0]) : null;
  }

  async findByOrderNumber(orderNumber: string): Promise<DeliveryOrder | null> {
    const query = `
      SELECT * FROM shipping.delivery_orders 
      WHERE order_number = $1
    `;

    const result = await this.db.query(query, [orderNumber]);
    return result.rows[0] ? this.mapToDeliveryOrder(result.rows[0]) : null;
  }

  async findByStatus(status: DeliveryStatus, limit?: number): Promise<DeliveryOrder[]> {
    let query = `
      SELECT * FROM shipping.delivery_orders 
      WHERE status = $1 
      ORDER BY created_at DESC
    `;

    const params = [status];

    if (limit) {
      query += ` LIMIT $2`;
      params.push(limit.toString());
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToDeliveryOrder(row));
  }

  async findByBranch(branchId: string, direction: 'from' | 'to' | 'both' = 'both'): Promise<DeliveryOrder[]> {
    let whereClause = '';
    const params = [branchId];

    switch (direction) {
      case 'from':
        whereClause = 'WHERE from_branch_id = $1';
        break;
      case 'to':
        whereClause = 'WHERE to_branch_id = $1';
        break;
      case 'both':
        whereClause = 'WHERE from_branch_id = $1 OR to_branch_id = $1';
        break;
    }

    const query = `
      SELECT * FROM shipping.delivery_orders 
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToDeliveryOrder(row));
  }

  async findByDriver(driverId: string, activeOnly: boolean = false): Promise<DeliveryOrder[]> {
    let query = `
      SELECT * FROM shipping.delivery_orders 
      WHERE driver_id = $1
    `;

    if (activeOnly) {
      query += ` AND status IN ('assigned', 'in_transit')`;
    }

    query += ` ORDER BY scheduled_pickup_date ASC`;

    const result = await this.db.query(query, [driverId]);
    return result.rows.map(row => this.mapToDeliveryOrder(row));
  }

  async updateStatus(
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
    const setClause = ['status = $2', 'updated_at = NOW()'];
    const params = [id, status];
    let paramIndex = 3;

    if (updates?.actualPickupTime) {
      setClause.push(`actual_pickup_time = $${paramIndex++}`);
      params.push(updates.actualPickupTime);
    }

    if (updates?.actualDeliveryTime) {
      setClause.push(`actual_delivery_time = $${paramIndex++}`);
      params.push(updates.actualDeliveryTime);
    }

    if (updates?.receivedBy) {
      setClause.push(`received_by = $${paramIndex++}`);
      params.push(updates.receivedBy);
    }

    if (updates?.signatureData) {
      setClause.push(`signature_data = $${paramIndex++}`);
      params.push(updates.signatureData);
    }

    if (updates?.photoProof) {
      setClause.push(`photo_proof = $${paramIndex++}`);
      params.push(updates.photoProof);
    }

    if (updates?.deliveryNotes) {
      setClause.push(`delivery_notes = $${paramIndex++}`);
      params.push(updates.deliveryNotes);
    }

    const query = `
      UPDATE shipping.delivery_orders 
      SET ${setClause.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, params);
    
    if (result.rows.length === 0) {
      throw new Error(`Delivery order not found: ${id}`);
    }

    const updatedOrder = this.mapToDeliveryOrder(result.rows[0]);

    // Invalidate cache
    await this.db.invalidateDeliveryOrderCache(id);

    logger.info('Delivery order status updated', {
      deliveryOrderId: id,
      oldStatus: status,
      newStatus: updatedOrder.status,
    });

    return updatedOrder;
  }

  async assignDriver(
    id: string, 
    driverId: string, 
    vehicleId?: string,
    assignedBy?: string
  ): Promise<DeliveryOrder> {
    return this.db.transaction(async (client) => {
      // Update delivery order
      const updateOrderQuery = `
        UPDATE shipping.delivery_orders 
        SET driver_id = $2, vehicle_id = $3, status = 'assigned', updated_at = NOW()
        WHERE id = $1 AND status = 'pending'
        RETURNING *
      `;

      const orderResult = await client.query(updateOrderQuery, [id, driverId, vehicleId]);
      
      if (orderResult.rows.length === 0) {
        throw new Error('Delivery order not found or cannot be assigned');
      }

      // Create driver assignment record
      const assignmentQuery = `
        INSERT INTO shipping.driver_assignments (
          driver_id, delivery_order_id, vehicle_id, assigned_by
        ) VALUES ($1, $2, $3, $4)
      `;

      await client.query(assignmentQuery, [driverId, id, vehicleId, assignedBy]);

      // Update driver status
      await client.query(
        'UPDATE shipping.drivers SET status = $1 WHERE id = $2',
        ['assigned', driverId]
      );

      // Update vehicle assignment if provided
      if (vehicleId) {
        await client.query(
          'UPDATE shipping.vehicles SET current_driver_id = $1 WHERE id = $2',
          [driverId, vehicleId]
        );
      }

      const deliveryOrder = this.mapToDeliveryOrder(orderResult.rows[0]);

      // Invalidate cache
      await this.db.invalidateDeliveryOrderCache(id);

      logger.info('Driver assigned to delivery order', {
        deliveryOrderId: id,
        driverId,
        vehicleId,
        assignedBy,
      });

      return deliveryOrder;
    });
  }

  async getOrdersRequiringAttention(): Promise<{
    overdue: DeliveryOrder[];
    delayed: DeliveryOrder[];
    unassigned: DeliveryOrder[];
  }> {
    const overdueQuery = `
      SELECT * FROM shipping.delivery_orders 
      WHERE status IN ('assigned', 'in_transit') 
        AND scheduled_delivery_date < NOW()
      ORDER BY scheduled_delivery_date ASC
    `;

    const delayedQuery = `
      SELECT * FROM shipping.delivery_orders 
      WHERE status = 'in_transit' 
        AND scheduled_delivery_date < NOW() + INTERVAL '2 hours'
        AND scheduled_delivery_date > NOW()
      ORDER BY scheduled_delivery_date ASC
    `;

    const unassignedQuery = `
      SELECT * FROM shipping.delivery_orders 
      WHERE status = 'pending' 
        AND scheduled_pickup_date <= NOW() + INTERVAL '24 hours'
      ORDER BY scheduled_pickup_date ASC
    `;

    const [overdueResult, delayedResult, unassignedResult] = await Promise.all([
      this.db.query(overdueQuery),
      this.db.query(delayedQuery),
      this.db.query(unassignedQuery),
    ]);

    return {
      overdue: overdueResult.rows.map(row => this.mapToDeliveryOrder(row)),
      delayed: delayedResult.rows.map(row => this.mapToDeliveryOrder(row)),
      unassigned: unassignedResult.rows.map(row => this.mapToDeliveryOrder(row)),
    };
  }

  async getDeliveryAnalytics(
    startDate: Date,
    endDate: Date,
    branchId?: string
  ): Promise<{
    totalDeliveries: number;
    completedDeliveries: number;
    onTimeDeliveries: number;
    averageDeliveryTime: number;
    successRate: number;
  }> {
    let whereClause = 'WHERE created_at >= $1 AND created_at <= $2';
    const params = [startDate, endDate];

    if (branchId) {
      whereClause += ' AND (from_branch_id = $3 OR to_branch_id = $3)';
      params.push(branchId);
    }

    const query = `
      SELECT 
        COUNT(*) as total_deliveries,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed_deliveries,
        COUNT(CASE WHEN status = 'delivered' AND actual_delivery_time <= scheduled_delivery_date THEN 1 END) as on_time_deliveries,
        AVG(CASE WHEN actual_delivery_time IS NOT NULL AND actual_pickup_time IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (actual_delivery_time - actual_pickup_time))/60 END) as avg_delivery_time_minutes
      FROM shipping.delivery_orders 
      ${whereClause}
    `;

    const result = await this.db.query(query, params);
    const row = result.rows[0];

    const totalDeliveries = parseInt(row.total_deliveries) || 0;
    const completedDeliveries = parseInt(row.completed_deliveries) || 0;
    const onTimeDeliveries = parseInt(row.on_time_deliveries) || 0;
    const averageDeliveryTime = parseFloat(row.avg_delivery_time_minutes) || 0;
    const successRate = totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;

    return {
      totalDeliveries,
      completedDeliveries,
      onTimeDeliveries,
      averageDeliveryTime,
      successRate,
    };
  }

  private mapToDeliveryOrder(row: any): DeliveryOrder {
    return {
      id: row.id,
      orderNumber: row.order_number,
      fromBranchId: row.from_branch_id,
      toBranchId: row.to_branch_id,
      status: row.status,
      deliveryType: row.delivery_type,
      driverId: row.driver_id,
      vehicleId: row.vehicle_id,
      scheduledPickupDate: row.scheduled_pickup_date,
      scheduledDeliveryDate: row.scheduled_delivery_date,
      estimatedDeliveryTime: row.estimated_delivery_time_minutes,
      actualPickupTime: row.actual_pickup_time,
      actualDeliveryTime: row.actual_delivery_time,
      totalItems: parseInt(row.total_items) || 0,
      totalWeight: parseFloat(row.total_weight_kg) || 0,
      totalValue: parseFloat(row.total_value) || 0,
      specialInstructions: row.special_instructions,
      requiresSignature: row.requires_signature,
      requiresRefrigeration: row.requires_refrigeration,
      contactPersonName: row.contact_person_name,
      contactPhone: row.contact_phone,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      // Calculate derived fields
      deliveryDuration: row.actual_delivery_time && row.actual_pickup_time
        ? Math.round((new Date(row.actual_delivery_time).getTime() - new Date(row.actual_pickup_time).getTime()) / 60000)
        : undefined,
      delayMinutes: row.actual_delivery_time && row.scheduled_delivery_date
        ? Math.max(0, Math.round((new Date(row.actual_delivery_time).getTime() - new Date(row.scheduled_delivery_date).getTime()) / 60000))
        : undefined,
    };
  }
}

export default DeliveryOrderModel;