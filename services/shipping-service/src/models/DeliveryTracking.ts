import DatabaseConnection from '../database/connection';
import { DeliveryTracking, TrackingEventType, DeliveryStatus } from '@dried-fruits/types';

export class DeliveryTrackingModel {
  private db = DatabaseConnection.getInstance();

  async create(trackingData: {
    deliveryOrderId: string;
    eventType: TrackingEventType;
    status: DeliveryStatus;
    location?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    description: string;
    performedBy?: string;
    deviceInfo?: string;
    metadata?: any;
    timestamp?: Date;
  }): Promise<DeliveryTracking> {
    const query = `
      INSERT INTO shipping.delivery_tracking (
        delivery_order_id, event_type, status, location, latitude, longitude,
        description, performed_by, device_info, metadata, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      trackingData.deliveryOrderId,
      trackingData.eventType,
      trackingData.status,
      trackingData.location,
      trackingData.coordinates?.latitude,
      trackingData.coordinates?.longitude,
      trackingData.description,
      trackingData.performedBy,
      trackingData.deviceInfo,
      trackingData.metadata ? JSON.stringify(trackingData.metadata) : null,
      trackingData.timestamp || new Date(),
    ];

    const result = await this.db.query(query, values);
    return this.mapToDeliveryTracking(result.rows[0]);
  }

  async findByDeliveryOrder(deliveryOrderId: string): Promise<DeliveryTracking[]> {
    const query = `
      SELECT * FROM shipping.delivery_tracking 
      WHERE delivery_order_id = $1 
      ORDER BY timestamp ASC
    `;

    const result = await this.db.query(query, [deliveryOrderId]);
    return result.rows.map(row => this.mapToDeliveryTracking(row));
  }

  async findLatestByDeliveryOrder(deliveryOrderId: string): Promise<DeliveryTracking | null> {
    const query = `
      SELECT * FROM shipping.delivery_tracking 
      WHERE delivery_order_id = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;

    const result = await this.db.query(query, [deliveryOrderId]);
    return result.rows[0] ? this.mapToDeliveryTracking(result.rows[0]) : null;
  }

  async findByEventType(
    eventType: TrackingEventType,
    startDate?: Date,
    endDate?: Date
  ): Promise<DeliveryTracking[]> {
    let query = `
      SELECT * FROM shipping.delivery_tracking 
      WHERE event_type = $1
    `;

    const params = [eventType];

    if (startDate && endDate) {
      query += ` AND timestamp >= $2 AND timestamp <= $3`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY timestamp DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToDeliveryTracking(row));
  }

  async findByDriver(driverId: string, limit?: number): Promise<DeliveryTracking[]> {
    let query = `
      SELECT dt.* FROM shipping.delivery_tracking dt
      JOIN shipping.delivery_orders do ON dt.delivery_order_id = do.id
      WHERE do.driver_id = $1
      ORDER BY dt.timestamp DESC
    `;

    const params = [driverId];

    if (limit) {
      query += ` LIMIT $2`;
      params.push(limit.toString());
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToDeliveryTracking(row));
  }

  async getDeliveryTimeline(deliveryOrderId: string): Promise<{
    events: DeliveryTracking[];
    estimatedDelivery?: Date;
    actualDelivery?: Date;
    isDelayed: boolean;
    delayMinutes?: number;
  }> {
    const events = await this.findByDeliveryOrder(deliveryOrderId);

    // Get delivery order details for comparison
    const orderQuery = `
      SELECT scheduled_delivery_date, actual_delivery_time 
      FROM shipping.delivery_orders 
      WHERE id = $1
    `;

    const orderResult = await this.db.query(orderQuery, [deliveryOrderId]);
    const order = orderResult.rows[0];

    if (!order) {
      throw new Error(`Delivery order not found: ${deliveryOrderId}`);
    }

    const estimatedDelivery = order.scheduled_delivery_date;
    const actualDelivery = order.actual_delivery_time;
    const now = new Date();

    let isDelayed = false;
    let delayMinutes: number | undefined;

    if (actualDelivery) {
      // Calculate actual delay
      const delayMs = new Date(actualDelivery).getTime() - new Date(estimatedDelivery).getTime();
      delayMinutes = Math.max(0, Math.round(delayMs / 60000));
      isDelayed = delayMinutes > 0;
    } else if (now > new Date(estimatedDelivery)) {
      // Calculate current delay for in-progress deliveries
      const delayMs = now.getTime() - new Date(estimatedDelivery).getTime();
      delayMinutes = Math.round(delayMs / 60000);
      isDelayed = delayMinutes > 0;
    }

    return {
      events,
      estimatedDelivery,
      actualDelivery,
      isDelayed,
      delayMinutes,
    };
  }

  async bulkCreate(trackingEvents: Array<{
    deliveryOrderId: string;
    eventType: TrackingEventType;
    status: DeliveryStatus;
    location?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    description: string;
    performedBy?: string;
    deviceInfo?: string;
    metadata?: any;
    timestamp?: Date;
  }>): Promise<DeliveryTracking[]> {
    if (trackingEvents.length === 0) {
      return [];
    }

    return this.db.transaction(async (client) => {
      const results: DeliveryTracking[] = [];

      for (const event of trackingEvents) {
        const query = `
          INSERT INTO shipping.delivery_tracking (
            delivery_order_id, event_type, status, location, latitude, longitude,
            description, performed_by, device_info, metadata, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;

        const values = [
          event.deliveryOrderId,
          event.eventType,
          event.status,
          event.location,
          event.coordinates?.latitude,
          event.coordinates?.longitude,
          event.description,
          event.performedBy,
          event.deviceInfo,
          event.metadata ? JSON.stringify(event.metadata) : null,
          event.timestamp || new Date(),
        ];

        const result = await client.query(query, values);
        results.push(this.mapToDeliveryTracking(result.rows[0]));
      }

      return results;
    });
  }

  async getLocationHistory(
    deliveryOrderId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{
    timestamp: Date;
    latitude: number;
    longitude: number;
    location?: string;
    eventType: TrackingEventType;
  }>> {
    let query = `
      SELECT timestamp, latitude, longitude, location, event_type
      FROM shipping.delivery_tracking 
      WHERE delivery_order_id = $1 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
    `;

    const params = [deliveryOrderId];

    if (startDate && endDate) {
      query += ` AND timestamp >= $2 AND timestamp <= $3`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY timestamp ASC`;

    const result = await this.db.query(query, params);
    
    return result.rows.map(row => ({
      timestamp: row.timestamp,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      location: row.location,
      eventType: row.event_type,
    }));
  }

  async getEventStatistics(
    startDate: Date,
    endDate: Date,
    branchId?: string
  ): Promise<Array<{
    eventType: TrackingEventType;
    count: number;
    averageTimeBetweenEvents?: number;
  }>> {
    let query = `
      SELECT 
        dt.event_type,
        COUNT(*) as event_count
      FROM shipping.delivery_tracking dt
      JOIN shipping.delivery_orders do ON dt.delivery_order_id = do.id
      WHERE dt.timestamp >= $1 AND dt.timestamp <= $2
    `;

    const params = [startDate, endDate];

    if (branchId) {
      query += ` AND (do.from_branch_id = $3 OR do.to_branch_id = $3)`;
      params.push(branchId);
    }

    query += `
      GROUP BY dt.event_type
      ORDER BY event_count DESC
    `;

    const result = await this.db.query(query, params);
    
    return result.rows.map(row => ({
      eventType: row.event_type,
      count: parseInt(row.event_count),
    }));
  }

  async findRecentActivity(limit: number = 50): Promise<Array<{
    tracking: DeliveryTracking;
    orderNumber: string;
    fromBranchName: string;
    toBranchName: string;
  }>> {
    const query = `
      SELECT 
        dt.*,
        do.order_number,
        fb.name as from_branch_name,
        tb.name as to_branch_name
      FROM shipping.delivery_tracking dt
      JOIN shipping.delivery_orders do ON dt.delivery_order_id = do.id
      JOIN public.branches fb ON do.from_branch_id = fb.id
      JOIN public.branches tb ON do.to_branch_id = tb.id
      ORDER BY dt.timestamp DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    
    return result.rows.map(row => ({
      tracking: this.mapToDeliveryTracking(row),
      orderNumber: row.order_number,
      fromBranchName: row.from_branch_name,
      toBranchName: row.to_branch_name,
    }));
  }

  private mapToDeliveryTracking(row: any): DeliveryTracking {
    return {
      id: row.id,
      deliveryOrderId: row.delivery_order_id,
      eventType: row.event_type,
      status: row.status,
      location: row.location,
      coordinates: row.latitude && row.longitude ? {
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
      } : undefined,
      description: row.description,
      performedBy: row.performed_by,
      deviceInfo: row.device_info,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.timestamp, // timestamp is the main field
      updatedAt: row.timestamp,
    };
  }
}

export default DeliveryTrackingModel;