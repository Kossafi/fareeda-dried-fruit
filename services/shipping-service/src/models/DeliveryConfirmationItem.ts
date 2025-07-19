import DatabaseConnection from '../database/connection';
import { DeliveryConfirmationItem, ConditionStatus } from '@dried-fruits/types';

export class DeliveryConfirmationItemModel {
  private db = DatabaseConnection.getInstance();

  async create(itemData: {
    deliveryConfirmationId: string;
    deliveryOrderItemId: string;
    expectedQuantity: number;
    receivedQuantity: number;
    unit: string;
    conditionStatus?: ConditionStatus;
    barcodeScanned?: boolean;
    batchNumber?: string;
    expirationDate?: Date;
    damageDescription?: string;
    photoEvidence?: string[];
  }): Promise<DeliveryConfirmationItem> {
    const query = `
      INSERT INTO shipping.delivery_confirmation_items (
        delivery_confirmation_id, delivery_order_item_id, expected_quantity,
        received_quantity, unit, condition_status, barcode_scanned,
        batch_number, expiration_date, damage_description, photo_evidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      itemData.deliveryConfirmationId,
      itemData.deliveryOrderItemId,
      itemData.expectedQuantity,
      itemData.receivedQuantity,
      itemData.unit,
      itemData.conditionStatus || ConditionStatus.GOOD,
      itemData.barcodeScanned || false,
      itemData.batchNumber,
      itemData.expirationDate,
      itemData.damageDescription,
      itemData.photoEvidence,
    ];

    const result = await this.db.query(query, values);
    return this.mapToDeliveryConfirmationItem(result.rows[0]);
  }

  async findByConfirmation(confirmationId: string): Promise<DeliveryConfirmationItem[]> {
    const query = `
      SELECT dci.*, doi.product_name, doi.product_id
      FROM shipping.delivery_confirmation_items dci
      JOIN shipping.delivery_order_items doi ON dci.delivery_order_item_id = doi.id
      WHERE dci.delivery_confirmation_id = $1 
      ORDER BY dci.created_at ASC
    `;

    const result = await this.db.query(query, [confirmationId]);
    return result.rows.map(row => ({
      ...this.mapToDeliveryConfirmationItem(row),
      productName: row.product_name,
      productId: row.product_id,
    }));
  }

  async findById(id: string): Promise<DeliveryConfirmationItem | null> {
    const query = `
      SELECT dci.*, doi.product_name, doi.product_id
      FROM shipping.delivery_confirmation_items dci
      JOIN shipping.delivery_order_items doi ON dci.delivery_order_item_id = doi.id
      WHERE dci.id = $1
    `;

    const result = await this.db.query(query, [id]);
    if (result.rows.length === 0) {
      return null;
    }

    return {
      ...this.mapToDeliveryConfirmationItem(result.rows[0]),
      productName: result.rows[0].product_name,
      productId: result.rows[0].product_id,
    };
  }

  async bulkCreate(items: Array<{
    deliveryConfirmationId: string;
    deliveryOrderItemId: string;
    expectedQuantity: number;
    receivedQuantity: number;
    unit: string;
    conditionStatus?: ConditionStatus;
    barcodeScanned?: boolean;
    batchNumber?: string;
    expirationDate?: Date;
    damageDescription?: string;
    photoEvidence?: string[];
  }>): Promise<DeliveryConfirmationItem[]> {
    if (items.length === 0) {
      return [];
    }

    return this.db.transaction(async (client) => {
      const results: DeliveryConfirmationItem[] = [];

      for (const item of items) {
        const query = `
          INSERT INTO shipping.delivery_confirmation_items (
            delivery_confirmation_id, delivery_order_item_id, expected_quantity,
            received_quantity, unit, condition_status, barcode_scanned,
            batch_number, expiration_date, damage_description, photo_evidence
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;

        const values = [
          item.deliveryConfirmationId,
          item.deliveryOrderItemId,
          item.expectedQuantity,
          item.receivedQuantity,
          item.unit,
          item.conditionStatus || ConditionStatus.GOOD,
          item.barcodeScanned || false,
          item.batchNumber,
          item.expirationDate,
          item.damageDescription,
          item.photoEvidence,
        ];

        const result = await client.query(query, values);
        results.push(this.mapToDeliveryConfirmationItem(result.rows[0]));
      }

      return results;
    });
  }

  async updateItem(
    id: string,
    updates: {
      receivedQuantity?: number;
      conditionStatus?: ConditionStatus;
      damageDescription?: string;
      photoEvidence?: string[];
    }
  ): Promise<DeliveryConfirmationItem> {
    const setClause: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let paramIndex = 2;

    if (updates.receivedQuantity !== undefined) {
      setClause.push(`received_quantity = $${paramIndex++}`);
      params.push(updates.receivedQuantity);
    }

    if (updates.conditionStatus !== undefined) {
      setClause.push(`condition_status = $${paramIndex++}`);
      params.push(updates.conditionStatus);
    }

    if (updates.damageDescription !== undefined) {
      setClause.push(`damage_description = $${paramIndex++}`);
      params.push(updates.damageDescription);
    }

    if (updates.photoEvidence !== undefined) {
      setClause.push(`photo_evidence = $${paramIndex++}`);
      params.push(updates.photoEvidence);
    }

    const query = `
      UPDATE shipping.delivery_confirmation_items 
      SET ${setClause.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, params);
    
    if (result.rows.length === 0) {
      throw new Error(`Delivery confirmation item not found: ${id}`);
    }

    return this.mapToDeliveryConfirmationItem(result.rows[0]);
  }

  async findDiscrepantItems(confirmationId: string): Promise<Array<DeliveryConfirmationItem & {
    discrepancyQuantity: number;
    discrepancyPercentage: number;
    productName: string;
    productId: string;
  }>> {
    const query = `
      SELECT dci.*, doi.product_name, doi.product_id,
             (dci.received_quantity - dci.expected_quantity) as discrepancy_quantity,
             CASE 
               WHEN dci.expected_quantity > 0 
               THEN ((dci.received_quantity - dci.expected_quantity) / dci.expected_quantity) * 100
               ELSE 0 
             END as discrepancy_percentage
      FROM shipping.delivery_confirmation_items dci
      JOIN shipping.delivery_order_items doi ON dci.delivery_order_item_id = doi.id
      WHERE dci.delivery_confirmation_id = $1 
        AND ABS(dci.received_quantity - dci.expected_quantity) > 0.001
      ORDER BY ABS(dci.received_quantity - dci.expected_quantity) DESC
    `;

    const result = await this.db.query(query, [confirmationId]);
    
    return result.rows.map(row => ({
      ...this.mapToDeliveryConfirmationItem(row),
      discrepancyQuantity: parseFloat(row.discrepancy_quantity),
      discrepancyPercentage: parseFloat(row.discrepancy_percentage),
      productName: row.product_name,
      productId: row.product_id,
    }));
  }

  async findDamagedItems(confirmationId: string): Promise<Array<DeliveryConfirmationItem & {
    productName: string;
    productId: string;
  }>> {
    const query = `
      SELECT dci.*, doi.product_name, doi.product_id
      FROM shipping.delivery_confirmation_items dci
      JOIN shipping.delivery_order_items doi ON dci.delivery_order_item_id = doi.id
      WHERE dci.delivery_confirmation_id = $1 
        AND dci.condition_status IN ('damaged', 'expired')
      ORDER BY dci.created_at ASC
    `;

    const result = await this.db.query(query, [confirmationId]);
    
    return result.rows.map(row => ({
      ...this.mapToDeliveryConfirmationItem(row),
      productName: row.product_name,
      productId: row.product_id,
    }));
  }

  async getItemsByProduct(
    productId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<DeliveryConfirmationItem & {
    orderNumber: string;
    branchName: string;
    confirmationDate: Date;
  }>> {
    let query = `
      SELECT dci.*, do.order_number, b.name as branch_name, dc.confirmation_date
      FROM shipping.delivery_confirmation_items dci
      JOIN shipping.delivery_confirmations dc ON dci.delivery_confirmation_id = dc.id
      JOIN shipping.delivery_orders do ON dc.delivery_order_id = do.id
      JOIN shipping.delivery_order_items doi ON dci.delivery_order_item_id = doi.id
      JOIN public.branches b ON dc.branch_id = b.id
      WHERE doi.product_id = $1
    `;

    const params = [productId];
    let paramIndex = 2;

    if (startDate && endDate) {
      query += ` AND dc.confirmation_date >= $${paramIndex++} AND dc.confirmation_date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY dc.confirmation_date DESC`;

    const result = await this.db.query(query, params);
    
    return result.rows.map(row => ({
      ...this.mapToDeliveryConfirmationItem(row),
      orderNumber: row.order_number,
      branchName: row.branch_name,
      confirmationDate: row.confirmation_date,
    }));
  }

  async deleteItem(id: string): Promise<void> {
    const query = `
      DELETE FROM shipping.delivery_confirmation_items 
      WHERE id = $1
    `;

    await this.db.query(query, [id]);
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

export default DeliveryConfirmationItemModel;