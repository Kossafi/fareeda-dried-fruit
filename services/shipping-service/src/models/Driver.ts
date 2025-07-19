import DatabaseConnection from '../database/connection';
import { Driver, DriverStatus } from '@dried-fruits/types';

export class DriverModel {
  private db = DatabaseConnection.getInstance();

  async create(driverData: {
    userId: string;
    employeeId: string;
    licenseNumber: string;
    licenseExpirationDate: Date;
    phoneNumber: string;
    emergencyContact: {
      name: string;
      phone: string;
      relationship: string;
    };
    createdBy?: string;
  }): Promise<Driver> {
    const query = `
      INSERT INTO shipping.drivers (
        user_id, employee_id, license_number, license_expiration_date,
        phone_number, emergency_contact_name, emergency_contact_phone,
        emergency_contact_relationship, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      driverData.userId,
      driverData.employeeId,
      driverData.licenseNumber,
      driverData.licenseExpirationDate,
      driverData.phoneNumber,
      driverData.emergencyContact.name,
      driverData.emergencyContact.phone,
      driverData.emergencyContact.relationship,
      driverData.createdBy,
    ];

    const result = await this.db.query(query, values);
    return this.mapToDriver(result.rows[0]);
  }

  async findById(id: string): Promise<Driver | null> {
    const query = `
      SELECT d.*, u.full_name, u.email
      FROM shipping.drivers d
      LEFT JOIN auth.users u ON d.user_id = u.id
      WHERE d.id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapToDriver(result.rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Driver | null> {
    const query = `
      SELECT d.*, u.full_name, u.email
      FROM shipping.drivers d
      LEFT JOIN auth.users u ON d.user_id = u.id
      WHERE d.user_id = $1
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows[0] ? this.mapToDriver(result.rows[0]) : null;
  }

  async findByEmployeeId(employeeId: string): Promise<Driver | null> {
    const query = `
      SELECT d.*, u.full_name, u.email
      FROM shipping.drivers d
      LEFT JOIN auth.users u ON d.user_id = u.id
      WHERE d.employee_id = $1
    `;

    const result = await this.db.query(query, [employeeId]);
    return result.rows[0] ? this.mapToDriver(result.rows[0]) : null;
  }

  async findByStatus(status: DriverStatus, isActive: boolean = true): Promise<Driver[]> {
    const query = `
      SELECT d.*, u.full_name, u.email
      FROM shipping.drivers d
      LEFT JOIN auth.users u ON d.user_id = u.id
      WHERE d.status = $1 AND d.is_active = $2
      ORDER BY u.full_name ASC
    `;

    const result = await this.db.query(query, [status, isActive]);
    return result.rows.map(row => this.mapToDriver(row));
  }

  async findAvailableDrivers(): Promise<Driver[]> {
    const query = `
      SELECT d.*, u.full_name, u.email
      FROM shipping.drivers d
      LEFT JOIN auth.users u ON d.user_id = u.id
      WHERE d.status = 'available' 
        AND d.is_active = true
        AND d.license_expiration_date > CURRENT_DATE
      ORDER BY u.full_name ASC
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => this.mapToDriver(row));
  }

  async updateStatus(id: string, status: DriverStatus): Promise<Driver> {
    const query = `
      UPDATE shipping.drivers 
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [id, status]);
    
    if (result.rows.length === 0) {
      throw new Error(`Driver not found: ${id}`);
    }

    return this.mapToDriver(result.rows[0]);
  }

  async updateLocation(
    id: string,
    locationData: {
      latitude: number;
      longitude: number;
      speed?: number;
      heading?: number;
      accuracy?: number;
    }
  ): Promise<void> {
    const query = `
      UPDATE shipping.drivers 
      SET 
        current_latitude = $2,
        current_longitude = $3,
        location_updated_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `;

    await this.db.query(query, [id, locationData.latitude, locationData.longitude]);
    
    // Also update Redis cache
    await this.db.updateDriverLocation(id, locationData.latitude, locationData.longitude);
  }

  async getCurrentLocation(driverId: string): Promise<{
    latitude: number;
    longitude: number;
    updatedAt: Date;
  } | null> {
    const query = `
      SELECT current_latitude, current_longitude, location_updated_at
      FROM shipping.drivers
      WHERE id = $1 AND current_latitude IS NOT NULL AND current_longitude IS NOT NULL
    `;

    const result = await this.db.query(query, [driverId]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      latitude: parseFloat(row.current_latitude),
      longitude: parseFloat(row.current_longitude),
      updatedAt: row.location_updated_at,
    };
  }

  async getDeliveryHistory(
    driverId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 50
  ): Promise<Array<{
    orderId: string;
    orderNumber: string;
    status: string;
    deliveryDate: Date;
    fromBranch: string;
    toBranch: string;
    deliveryTime: number;
    onTime: boolean;
  }>> {
    let query = `
      SELECT 
        do.id as order_id,
        do.order_number,
        do.status,
        do.actual_delivery_time as delivery_date,
        fb.name as from_branch,
        tb.name as to_branch,
        EXTRACT(EPOCH FROM (do.actual_delivery_time - do.actual_pickup_time))/60 as delivery_time_minutes,
        do.actual_delivery_time <= do.scheduled_delivery_date as on_time
      FROM shipping.delivery_orders do
      JOIN public.branches fb ON do.from_branch_id = fb.id
      JOIN public.branches tb ON do.to_branch_id = tb.id
      WHERE do.driver_id = $1
    `;

    const params: any[] = [driverId];
    let paramIndex = 2;

    if (startDate && endDate) {
      query += ` AND do.created_at >= $${paramIndex++} AND do.created_at <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY do.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.db.query(query, params);
    
    return result.rows.map(row => ({
      orderId: row.order_id,
      orderNumber: row.order_number,
      status: row.status,
      deliveryDate: row.delivery_date,
      fromBranch: row.from_branch,
      toBranch: row.to_branch,
      deliveryTime: parseFloat(row.delivery_time_minutes) || 0,
      onTime: row.on_time || false,
    }));
  }

  async getDriverPerformance(driverId: string, startDate: Date, endDate: Date): Promise<{
    totalDeliveries: number;
    completedDeliveries: number;
    onTimeDeliveries: number;
    averageDeliveryTime: number;
    totalDistance: number;
    rating: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_deliveries,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed_deliveries,
        COUNT(CASE WHEN status = 'delivered' AND actual_delivery_time <= scheduled_delivery_date THEN 1 END) as on_time_deliveries,
        AVG(CASE WHEN actual_delivery_time IS NOT NULL AND actual_pickup_time IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (actual_delivery_time - actual_pickup_time))/60 END) as avg_delivery_time_minutes
      FROM shipping.delivery_orders 
      WHERE driver_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
    `;

    const result = await this.db.query(query, [driverId, startDate, endDate]);
    const row = result.rows[0];

    const totalDeliveries = parseInt(row.total_deliveries) || 0;
    const completedDeliveries = parseInt(row.completed_deliveries) || 0;
    const onTimeDeliveries = parseInt(row.on_time_deliveries) || 0;
    const averageDeliveryTime = parseFloat(row.avg_delivery_time_minutes) || 0;

    // Calculate performance rating (0-100)
    const completionRate = totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;
    const onTimeRate = completedDeliveries > 0 ? (onTimeDeliveries / completedDeliveries) * 100 : 0;
    const rating = Math.round((completionRate * 0.6) + (onTimeRate * 0.4));

    return {
      totalDeliveries,
      completedDeliveries,
      onTimeDeliveries,
      averageDeliveryTime,
      totalDistance: 0, // Would need GPS data integration
      rating,
    };
  }

  async getDriverCurrentAssignment(driverId: string): Promise<{
    deliveryOrderId: string;
    orderNumber: string;
    fromBranchName: string;
    toBranchName: string;
    status: string;
    scheduledPickupDate: Date;
    scheduledDeliveryDate: Date;
  } | null> {
    const query = `
      SELECT 
        do.id as delivery_order_id,
        do.order_number,
        do.status,
        do.scheduled_pickup_date,
        do.scheduled_delivery_date,
        fb.name as from_branch_name,
        tb.name as to_branch_name
      FROM shipping.delivery_orders do
      JOIN public.branches fb ON do.from_branch_id = fb.id
      JOIN public.branches tb ON do.to_branch_id = tb.id
      WHERE do.driver_id = $1 
        AND do.status IN ('assigned', 'in_transit')
      ORDER BY do.scheduled_pickup_date ASC
      LIMIT 1
    `;

    const result = await this.db.query(query, [driverId]);
    return result.rows[0] || null;
  }

  async findDriversWithExpiredLicenses(): Promise<Driver[]> {
    const query = `
      SELECT d.*, u.full_name, u.email
      FROM shipping.drivers d
      LEFT JOIN auth.users u ON d.user_id = u.id
      WHERE d.license_expiration_date <= CURRENT_DATE + INTERVAL '30 days'
        AND d.is_active = true
      ORDER BY d.license_expiration_date ASC
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => this.mapToDriver(row));
  }

  async updateDriver(
    id: string,
    updates: {
      licenseNumber?: string;
      licenseExpirationDate?: Date;
      phoneNumber?: string;
      emergencyContact?: {
        name: string;
        phone: string;
        relationship: string;
      };
      status?: DriverStatus;
      isActive?: boolean;
    }
  ): Promise<Driver> {
    const setClause: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let paramIndex = 2;

    if (updates.licenseNumber !== undefined) {
      setClause.push(`license_number = $${paramIndex++}`);
      params.push(updates.licenseNumber);
    }

    if (updates.licenseExpirationDate !== undefined) {
      setClause.push(`license_expiration_date = $${paramIndex++}`);
      params.push(updates.licenseExpirationDate);
    }

    if (updates.phoneNumber !== undefined) {
      setClause.push(`phone_number = $${paramIndex++}`);
      params.push(updates.phoneNumber);
    }

    if (updates.emergencyContact) {
      setClause.push(`emergency_contact_name = $${paramIndex++}`);
      params.push(updates.emergencyContact.name);
      setClause.push(`emergency_contact_phone = $${paramIndex++}`);
      params.push(updates.emergencyContact.phone);
      setClause.push(`emergency_contact_relationship = $${paramIndex++}`);
      params.push(updates.emergencyContact.relationship);
    }

    if (updates.status !== undefined) {
      setClause.push(`status = $${paramIndex++}`);
      params.push(updates.status);
    }

    if (updates.isActive !== undefined) {
      setClause.push(`is_active = $${paramIndex++}`);
      params.push(updates.isActive);
    }

    const query = `
      UPDATE shipping.drivers 
      SET ${setClause.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, params);
    
    if (result.rows.length === 0) {
      throw new Error(`Driver not found: ${id}`);
    }

    return this.mapToDriver(result.rows[0]);
  }

  async getAllDrivers(isActive: boolean = true): Promise<Driver[]> {
    const query = `
      SELECT d.*, u.full_name, u.email
      FROM shipping.drivers d
      LEFT JOIN auth.users u ON d.user_id = u.id
      WHERE d.is_active = $1
      ORDER BY u.full_name ASC
    `;

    const result = await this.db.query(query, [isActive]);
    return result.rows.map(row => this.mapToDriver(row));
  }

  async deactivateDriver(id: string): Promise<void> {
    await this.updateDriver(id, { 
      isActive: false, 
      status: DriverStatus.OFFLINE 
    });
  }

  private mapToDriver(row: any): Driver {
    return {
      id: row.id,
      userId: row.user_id,
      employeeId: row.employee_id,
      licenseNumber: row.license_number,
      licenseExpirationDate: row.license_expiration_date,
      status: row.status,
      currentLocation: row.current_latitude && row.current_longitude ? {
        latitude: parseFloat(row.current_latitude),
        longitude: parseFloat(row.current_longitude),
        updatedAt: row.location_updated_at,
      } : undefined,
      phoneNumber: row.phone_number,
      emergencyContact: {
        name: row.emergency_contact_name,
        phone: row.emergency_contact_phone,
        relationship: row.emergency_contact_relationship,
      },
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Additional fields from user join
      fullName: row.full_name,
      email: row.email,
    };
  }
}

export default DriverModel;