import DatabaseConnection from '../database/connection';
import { DeliveryOrderItem } from '@dried-fruits/types';

export class DeliveryOrderItemModel {
  private db = DatabaseConnection.getInstance();

  async create(itemData: {
    deliveryOrderId: string;
    inventoryItemId: string;
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    weight: number;
    value: number;
    batchNumber?: string;
    expirationDate?: Date;
    barcodeId?: string;
  }): Promise<DeliveryOrderItem> {
    const query = `
      INSERT INTO shipping.delivery_order_items (
        delivery_order_id, inventory_item_id, product_id, product_name,
        quantity, unit, weight_kg, value, batch_number, expiration_date, barcode_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      itemData.deliveryOrderId,
      itemData.inventoryItemId,
      itemData.productId,
      itemData.productName,
      itemData.quantity,
      itemData.unit,
      itemData.weight,
      itemData.value,
      itemData.batchNumber,
      itemData.expirationDate,
      itemData.barcodeId,
    ];

    const result = await this.db.query(query, values);
    return this.mapToDeliveryOrderItem(result.rows[0]);
  }

  async findByDeliveryOrder(deliveryOrderId: string): Promise<DeliveryOrderItem[]> {
    const query = `
      SELECT * FROM shipping.delivery_order_items 
      WHERE delivery_order_id = $1 
      ORDER BY created_at ASC
    `;

    const result = await this.db.query(query, [deliveryOrderId]);
    return result.rows.map(row => this.mapToDeliveryOrderItem(row));
  }

  async findById(id: string): Promise<DeliveryOrderItem | null> {
    const query = `
      SELECT * FROM shipping.delivery_order_items 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapToDeliveryOrderItem(result.rows[0]) : null;
  }

  async confirmItem(
    id: string,
    actualQuantity: number,
    notes?: string
  ): Promise<DeliveryOrderItem> {
    const query = `
      UPDATE shipping.delivery_order_items 
      SET 
        confirmed = true,
        actual_quantity = $2,
        notes = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [id, actualQuantity, notes]);
    
    if (result.rows.length === 0) {
      throw new Error(`Delivery order item not found: ${id}`);
    }

    return this.mapToDeliveryOrderItem(result.rows[0]);
  }

  async confirmMultipleItems(
    confirmations: Array<{
      id: string;
      actualQuantity: number;
      notes?: string;
    }>
  ): Promise<DeliveryOrderItem[]> {
    return this.db.transaction(async (client) => {
      const results: DeliveryOrderItem[] = [];

      for (const confirmation of confirmations) {
        const query = `
          UPDATE shipping.delivery_order_items 
          SET 
            confirmed = true,
            actual_quantity = $2,
            notes = $3,
            updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `;

        const result = await client.query(query, [
          confirmation.id,
          confirmation.actualQuantity,
          confirmation.notes,
        ]);

        if (result.rows.length > 0) {
          results.push(this.mapToDeliveryOrderItem(result.rows[0]));
        }
      }

      return results;
    });
  }

  async bulkCreate(items: Array<{
    deliveryOrderId: string;
    inventoryItemId: string;
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    weight: number;
    value: number;
    batchNumber?: string;
    expirationDate?: Date;
    barcodeId?: string;
  }>): Promise<DeliveryOrderItem[]> {
    if (items.length === 0) {
      return [];
    }

    return this.db.transaction(async (client) => {
      const results: DeliveryOrderItem[] = [];

      for (const item of items) {
        const query = `
          INSERT INTO shipping.delivery_order_items (
            delivery_order_id, inventory_item_id, product_id, product_name,
            quantity, unit, weight_kg, value, batch_number, expiration_date, barcode_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;

        const values = [
          item.deliveryOrderId,
          item.inventoryItemId,
          item.productId,
          item.productName,
          item.quantity,
          item.unit,
          item.weight,
          item.value,
          item.batchNumber,
          item.expirationDate,
          item.barcodeId,
        ];

        const result = await client.query(query, values);
        results.push(this.mapToDeliveryOrderItem(result.rows[0]));
      }

      return results;
    });
  }

  async findItemsRequiringConfirmation(deliveryOrderId: string): Promise<DeliveryOrderItem[]> {
    const query = `
      SELECT * FROM shipping.delivery_order_items 
      WHERE delivery_order_id = $1 AND confirmed = false
      ORDER BY product_name ASC
    `;

    const result = await this.db.query(query, [deliveryOrderId]);
    return result.rows.map(row => this.mapToDeliveryOrderItem(row));
  }

  async getDeliveryOrderSummary(deliveryOrderId: string): Promise<{
    totalItems: number;
    totalWeight: number;
    totalValue: number;
    confirmedItems: number;
    pendingItems: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_items,
        SUM(weight_kg) as total_weight,
        SUM(value) as total_value,
        COUNT(CASE WHEN confirmed = true THEN 1 END) as confirmed_items,
        COUNT(CASE WHEN confirmed = false THEN 1 END) as pending_items
      FROM shipping.delivery_order_items 
      WHERE delivery_order_id = $1
    `;

    const result = await this.db.query(query, [deliveryOrderId]);
    const row = result.rows[0];

    return {
      totalItems: parseInt(row.total_items) || 0,
      totalWeight: parseFloat(row.total_weight) || 0,
      totalValue: parseFloat(row.total_value) || 0,
      confirmedItems: parseInt(row.confirmed_items) || 0,
      pendingItems: parseInt(row.pending_items) || 0,
    };
  }

  async findItemsByProduct(productId: string, startDate?: Date, endDate?: Date): Promise<DeliveryOrderItem[]> {
    let query = `
      SELECT doi.*, do.order_number, do.status as delivery_status
      FROM shipping.delivery_order_items doi
      JOIN shipping.delivery_orders do ON doi.delivery_order_id = do.id
      WHERE doi.product_id = $1
    `;

    const params = [productId];

    if (startDate && endDate) {
      query += ` AND do.created_at >= $2 AND do.created_at <= $3`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY do.created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToDeliveryOrderItem(row));
  }

  async deleteItem(id: string): Promise<void> {
    const query = `
      DELETE FROM shipping.delivery_order_items 
      WHERE id = $1
    `;

    await this.db.query(query, [id]);
  }

  async deleteItemsByDeliveryOrder(deliveryOrderId: string): Promise<void> {
    const query = `
      DELETE FROM shipping.delivery_order_items 
      WHERE delivery_order_id = $1
    `;

    await this.db.query(query, [deliveryOrderId]);
  }

  private mapToDeliveryOrderItem(row: any): DeliveryOrderItem {
    return {
      id: row.id,
      deliveryOrderId: row.delivery_order_id,
      inventoryItemId: row.inventory_item_id,
      productId: row.product_id,
      productName: row.product_name,
      quantity: parseFloat(row.quantity),
      unit: row.unit,
      weight: parseFloat(row.weight_kg),
      value: parseFloat(row.value),
      batchNumber: row.batch_number,
      expirationDate: row.expiration_date,
      barcodeId: row.barcode_id,
      confirmed: row.confirmed,
      actualQuantity: row.actual_quantity ? parseFloat(row.actual_quantity) : undefined,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default DeliveryOrderItemModel;