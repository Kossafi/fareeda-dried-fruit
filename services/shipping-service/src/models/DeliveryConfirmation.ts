import DatabaseConnection from '../database/connection';
import { DeliveryConfirmation, DeliveryConfirmationItem, ConfirmationMethod } from '@dried-fruits/types';
import logger from '../utils/logger';

export class DeliveryConfirmationModel {
  private db = DatabaseConnection.getInstance();

  async create(confirmationData: {
    deliveryOrderId: string;
    confirmedBy: string;
    branchId: string;
    confirmationMethod: ConfirmationMethod;
    notes?: string;
    signatureData?: string;
    photoEvidence?: string[];
    locationCoordinates?: { latitude: number; longitude: number };
    deviceInfo?: any;
  }): Promise<DeliveryConfirmation> {
    return this.db.transaction(async (client) => {
      const query = `
        INSERT INTO shipping.delivery_confirmations (
          delivery_order_id, confirmed_by, branch_id, confirmation_method,
          notes, signature_data, photo_evidence, location_coordinates, device_info
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, POINT($8, $9), $10)
        RETURNING *
      `;

      const values = [
        confirmationData.deliveryOrderId,
        confirmationData.confirmedBy,
        confirmationData.branchId,
        confirmationData.confirmationMethod,
        confirmationData.notes,
        confirmationData.signatureData,
        confirmationData.photoEvidence,
        confirmationData.locationCoordinates?.longitude || null,
        confirmationData.locationCoordinates?.latitude || null,
        confirmationData.deviceInfo,
      ];

      const result = await client.query(query, values);
      const confirmation = result.rows[0];

      logger.info('Delivery confirmation created', {
        confirmationId: confirmation.id,
        deliveryOrderId: confirmationData.deliveryOrderId,
        confirmedBy: confirmationData.confirmedBy,
      });

      return this.mapToDeliveryConfirmation(confirmation);
    });
  }

  async findById(id: string): Promise<DeliveryConfirmation | null> {
    const query = `
      SELECT * FROM shipping.delivery_confirmations 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapToDeliveryConfirmation(result.rows[0]) : null;
  }

  async findByDeliveryOrder(deliveryOrderId: string): Promise<DeliveryConfirmation | null> {
    const query = `
      SELECT * FROM shipping.delivery_confirmations 
      WHERE delivery_order_id = $1
    `;

    const result = await this.db.query(query, [deliveryOrderId]);
    return result.rows[0] ? this.mapToDeliveryConfirmation(result.rows[0]) : null;
  }

  async findByBranch(
    branchId: string,
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<DeliveryConfirmation[]> {
    let query = `
      SELECT * FROM shipping.delivery_confirmations 
      WHERE branch_id = $1
    `;

    const params = [branchId];
    let paramIndex = 2;

    if (startDate && endDate) {
      query += ` AND confirmation_date >= $${paramIndex++} AND confirmation_date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY confirmation_date DESC`;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToDeliveryConfirmation(row));
  }

  async getPendingConfirmations(branchId?: string): Promise<Array<{
    deliveryOrderId: string;
    orderNumber: string;
    branchId: string;
    branchName: string;
    scheduledDeliveryDate: Date;
    actualDeliveryTime: Date;
    totalItems: number;
    hoursSinceDelivery: number;
  }>> {
    let query = `
      SELECT * FROM shipping.pending_confirmations
    `;

    const params: any[] = [];
    
    if (branchId) {
      query += ` WHERE to_branch_id = $1`;
      params.push(branchId);
    }

    query += ` ORDER BY hours_since_delivery DESC NULLS LAST`;

    const result = await this.db.query(query, params);
    
    return result.rows.map(row => ({
      deliveryOrderId: row.delivery_order_id,
      orderNumber: row.order_number,
      branchId: row.to_branch_id,
      branchName: row.branch_name,
      scheduledDeliveryDate: row.scheduled_delivery_date,
      actualDeliveryTime: row.actual_delivery_time,
      totalItems: parseInt(row.total_items) || 0,
      hoursSinceDelivery: parseFloat(row.hours_since_delivery) || 0,
    }));
  }

  async getConfirmationHistory(
    orderId: string
  ): Promise<{
    confirmation: DeliveryConfirmation | null;
    items: DeliveryConfirmationItem[];
    discrepancyCount: number;
    totalExpected: number;
    totalReceived: number;
  }> {
    const confirmation = await this.findByDeliveryOrder(orderId);
    
    if (!confirmation) {
      return {
        confirmation: null,
        items: [],
        discrepancyCount: 0,
        totalExpected: 0,
        totalReceived: 0,
      };
    }

    const itemsQuery = `
      SELECT * FROM shipping.delivery_confirmation_items 
      WHERE delivery_confirmation_id = $1
      ORDER BY created_at ASC
    `;

    const itemsResult = await this.db.query(itemsQuery, [confirmation.id]);
    const items = itemsResult.rows.map(row => this.mapToDeliveryConfirmationItem(row));

    const discrepancyCount = items.filter(item => 
      Math.abs(item.expectedQuantity - item.receivedQuantity) > 0.001
    ).length;

    const totalExpected = items.reduce((sum, item) => sum + item.expectedQuantity, 0);
    const totalReceived = items.reduce((sum, item) => sum + item.receivedQuantity, 0);

    return {
      confirmation,
      items,
      discrepancyCount,
      totalExpected,
      totalReceived,
    };
  }

  async getConfirmationAnalytics(
    branchId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalConfirmations: number;
    averageConfirmationTime: number;
    discrepancyRate: number;
    onTimeConfirmations: number;
    confirmationMethodBreakdown: Array<{
      method: ConfirmationMethod;
      count: number;
      percentage: number;
    }>;
  }> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (branchId) {
      whereClause += ` AND dc.branch_id = $${paramIndex++}`;
      params.push(branchId);
    }

    if (startDate && endDate) {
      whereClause += ` AND dc.confirmation_date >= $${paramIndex++} AND dc.confirmation_date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    const analyticsQuery = `
      SELECT 
        COUNT(*) as total_confirmations,
        AVG(EXTRACT(EPOCH FROM (dc.confirmation_date - do.actual_delivery_time))/3600) as avg_confirmation_hours,
        COUNT(CASE WHEN EXISTS(
          SELECT 1 FROM shipping.delivery_confirmation_items dci 
          WHERE dci.delivery_confirmation_id = dc.id 
            AND dci.received_quantity != dci.expected_quantity
        ) THEN 1 END) as confirmations_with_discrepancies,
        COUNT(CASE WHEN dc.confirmation_date <= do.actual_delivery_time + INTERVAL '4 hours' THEN 1 END) as on_time_confirmations,
        dc.confirmation_method,
        COUNT(*) as method_count
      FROM shipping.delivery_confirmations dc
      JOIN shipping.delivery_orders do ON dc.delivery_order_id = do.id
      ${whereClause}
      GROUP BY dc.confirmation_method
    `;

    const result = await this.db.query(analyticsQuery, params);
    
    const totalConfirmations = result.rows.reduce((sum, row) => sum + parseInt(row.method_count), 0);
    const confirmationsWithDiscrepancies = result.rows.reduce((sum, row) => sum + parseInt(row.confirmations_with_discrepancies), 0);
    const onTimeConfirmations = result.rows.reduce((sum, row) => sum + parseInt(row.on_time_confirmations), 0);
    const avgConfirmationTime = result.rows.length > 0 ? parseFloat(result.rows[0].avg_confirmation_hours) : 0;

    const methodBreakdown = result.rows.map(row => ({
      method: row.confirmation_method as ConfirmationMethod,
      count: parseInt(row.method_count),
      percentage: totalConfirmations > 0 ? (parseInt(row.method_count) / totalConfirmations) * 100 : 0,
    }));

    return {
      totalConfirmations,
      averageConfirmationTime: avgConfirmationTime,
      discrepancyRate: totalConfirmations > 0 ? (confirmationsWithDiscrepancies / totalConfirmations) * 100 : 0,
      onTimeConfirmations,
      confirmationMethodBreakdown: methodBreakdown,
    };
  }

  async updateConfirmation(
    id: string,
    updates: {
      notes?: string;
      signatureData?: string;
      photoEvidence?: string[];
    }
  ): Promise<DeliveryConfirmation> {
    const setClause: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let paramIndex = 2;

    if (updates.notes !== undefined) {
      setClause.push(`notes = $${paramIndex++}`);
      params.push(updates.notes);
    }

    if (updates.signatureData !== undefined) {
      setClause.push(`signature_data = $${paramIndex++}`);
      params.push(updates.signatureData);
    }

    if (updates.photoEvidence !== undefined) {
      setClause.push(`photo_evidence = $${paramIndex++}`);
      params.push(updates.photoEvidence);
    }

    const query = `
      UPDATE shipping.delivery_confirmations 
      SET ${setClause.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, params);
    
    if (result.rows.length === 0) {
      throw new Error(`Delivery confirmation not found: ${id}`);
    }

    return this.mapToDeliveryConfirmation(result.rows[0]);
  }

  private mapToDeliveryConfirmation(row: any): DeliveryConfirmation {
    return {
      id: row.id,
      deliveryOrderId: row.delivery_order_id,
      confirmedBy: row.confirmed_by,
      confirmationDate: row.confirmation_date,
      branchId: row.branch_id,
      confirmationMethod: row.confirmation_method,
      notes: row.notes,
      signatureData: row.signature_data,
      photoEvidence: row.photo_evidence || [],
      locationCoordinates: row.location_coordinates ? {
        latitude: row.location_coordinates.y,
        longitude: row.location_coordinates.x,
      } : undefined,
      deviceInfo: row.device_info,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapToDeliveryConfirmationItem(row: any): DeliveryConfirmationItem {
    return {
      id: row.id,
      deliveryConfirmationId: row.delivery_confirmation_id,
      deliveryOrderItemId: row.delivery_order_item_id,
      expectedQuantity: parseFloat(row.expected_quantity),
      receivedQuantity: parseFloat(row.received_quantity),
      unit: row.unit,
      conditionStatus: row.condition_status,
      barcodeScanned: row.barcode_scanned,
      batchNumber: row.batch_number,
      expirationDate: row.expiration_date,
      damageDescription: row.damage_description,
      photoEvidence: row.photo_evidence || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default DeliveryConfirmationModel;