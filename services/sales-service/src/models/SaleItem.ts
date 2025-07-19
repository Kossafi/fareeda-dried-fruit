import DatabaseConnection from '../database/connection';
import { SaleItem, UnitType } from '@dried-fruits/types';

export class SaleItemModel {
  private db = DatabaseConnection.getInstance();

  async create(itemData: {
    saleId: string;
    inventoryItemId: string;
    productId: string;
    productName: string;
    productSku?: string;
    quantity: number;
    unit: UnitType;
    unitPrice: number;
    listPrice: number;
    discountAmount: number;
    discountPercentage: number;
    lineTotal: number;
    batchNumber?: string;
    expirationDate?: Date;
    barcodeScanned: boolean;
    actualWeight?: number;
    tareWeight?: number;
    netWeight?: number;
    unitCost: number;
    totalCost: number;
  }): Promise<SaleItem> {
    const query = `
      INSERT INTO sales.sale_items (
        sale_id, inventory_item_id, product_id, product_name, product_sku,
        quantity, unit, unit_price, list_price, discount_amount, discount_percentage,
        line_total, batch_number, expiration_date, barcode_scanned,
        actual_weight, tare_weight, net_weight, unit_cost, total_cost
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `;

    const values = [
      itemData.saleId,
      itemData.inventoryItemId,
      itemData.productId,
      itemData.productName,
      itemData.productSku,
      itemData.quantity,
      itemData.unit,
      itemData.unitPrice,
      itemData.listPrice,
      itemData.discountAmount,
      itemData.discountPercentage,
      itemData.lineTotal,
      itemData.batchNumber,
      itemData.expirationDate,
      itemData.barcodeScanned,
      itemData.actualWeight,
      itemData.tareWeight,
      itemData.netWeight,
      itemData.unitCost,
      itemData.totalCost,
    ];

    const result = await this.db.query(query, values);
    return this.mapToSaleItem(result.rows[0]);
  }

  async findBySale(saleId: string): Promise<SaleItem[]> {
    const query = `
      SELECT * FROM sales.sale_items 
      WHERE sale_id = $1 
      ORDER BY created_at ASC
    `;

    const result = await this.db.query(query, [saleId]);
    return result.rows.map(row => this.mapToSaleItem(row));
  }

  async findById(id: string): Promise<SaleItem | null> {
    const query = `
      SELECT * FROM sales.sale_items 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapToSaleItem(result.rows[0]) : null;
  }

  async voidItem(id: string, reason: string): Promise<SaleItem> {
    const query = `
      UPDATE sales.sale_items 
      SET 
        voided = true,
        voided_at = NOW(),
        void_reason = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [id, reason]);
    
    if (result.rows.length === 0) {
      throw new Error(`Sale item not found: ${id}`);
    }

    return this.mapToSaleItem(result.rows[0]);
  }

  async bulkCreate(items: Array<{
    saleId: string;
    inventoryItemId: string;
    productId: string;
    productName: string;
    productSku?: string;
    quantity: number;
    unit: UnitType;
    unitPrice: number;
    listPrice: number;
    discountAmount: number;
    discountPercentage: number;
    lineTotal: number;
    batchNumber?: string;
    expirationDate?: Date;
    barcodeScanned: boolean;
    actualWeight?: number;
    tareWeight?: number;
    netWeight?: number;
    unitCost: number;
    totalCost: number;
  }>): Promise<SaleItem[]> {
    if (items.length === 0) {
      return [];
    }

    return this.db.transaction(async (client) => {
      const results: SaleItem[] = [];

      for (const item of items) {
        const query = `
          INSERT INTO sales.sale_items (
            sale_id, inventory_item_id, product_id, product_name, product_sku,
            quantity, unit, unit_price, list_price, discount_amount, discount_percentage,
            line_total, batch_number, expiration_date, barcode_scanned,
            actual_weight, tare_weight, net_weight, unit_cost, total_cost
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          RETURNING *
        `;

        const values = [
          item.saleId,
          item.inventoryItemId,
          item.productId,
          item.productName,
          item.productSku,
          item.quantity,
          item.unit,
          item.unitPrice,
          item.listPrice,
          item.discountAmount,
          item.discountPercentage,
          item.lineTotal,
          item.batchNumber,
          item.expirationDate,
          item.barcodeScanned,
          item.actualWeight,
          item.tareWeight,
          item.netWeight,
          item.unitCost,
          item.totalCost,
        ];

        const result = await client.query(query, values);
        results.push(this.mapToSaleItem(result.rows[0]));
      }

      return results;
    });
  }

  async findByProduct(productId: string, startDate?: Date, endDate?: Date): Promise<SaleItem[]> {
    let query = `
      SELECT si.*, s.sale_date, s.branch_id, s.status as sale_status
      FROM sales.sale_items si
      JOIN sales.sales s ON si.sale_id = s.id
      WHERE si.product_id = $1 
        AND si.voided = false
        AND s.status = 'completed'
    `;

    const params = [productId];

    if (startDate && endDate) {
      query += ` AND s.sale_date >= $2 AND s.sale_date <= $3`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY s.sale_date DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToSaleItem(row));
  }

  async findByInventoryItem(inventoryItemId: string): Promise<SaleItem[]> {
    const query = `
      SELECT si.*, s.sale_date, s.branch_id, s.status as sale_status
      FROM sales.sale_items si
      JOIN sales.sales s ON si.sale_id = s.id
      WHERE si.inventory_item_id = $1 
        AND si.voided = false
      ORDER BY s.sale_date DESC
    `;

    const result = await this.db.query(query, [inventoryItemId]);
    return result.rows.map(row => this.mapToSaleItem(row));
  }

  async getProductSalesStats(
    productId: string,
    branchId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalQuantitySold: number;
    totalRevenue: number;
    averagePrice: number;
    timesOrdered: number;
    averageQuantityPerSale: number;
  }> {
    let query = `
      SELECT 
        SUM(si.quantity) as total_quantity_sold,
        SUM(si.line_total) as total_revenue,
        AVG(si.unit_price) as average_price,
        COUNT(*) as times_ordered,
        AVG(si.quantity) as average_quantity_per_sale
      FROM sales.sale_items si
      JOIN sales.sales s ON si.sale_id = s.id
      WHERE si.product_id = $1 
        AND si.voided = false
        AND s.status = 'completed'
    `;

    const params = [productId];
    let paramIndex = 2;

    if (branchId) {
      query += ` AND s.branch_id = $${paramIndex++}`;
      params.push(branchId);
    }

    if (startDate && endDate) {
      query += ` AND s.sale_date >= $${paramIndex++} AND s.sale_date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    const result = await this.db.query(query, params);
    const row = result.rows[0];

    return {
      totalQuantitySold: parseFloat(row.total_quantity_sold) || 0,
      totalRevenue: parseFloat(row.total_revenue) || 0,
      averagePrice: parseFloat(row.average_price) || 0,
      timesOrdered: parseInt(row.times_ordered) || 0,
      averageQuantityPerSale: parseFloat(row.average_quantity_per_sale) || 0,
    };
  }

  async findItemsForStockAdjustment(saleId: string): Promise<Array<{
    saleItemId: string;
    inventoryItemId: string;
    productId: string;
    quantity: number;
    unit: UnitType;
    unitCost: number;
  }>> {
    const query = `
      SELECT 
        id as sale_item_id,
        inventory_item_id,
        product_id,
        quantity,
        unit,
        unit_cost
      FROM sales.sale_items 
      WHERE sale_id = $1 
        AND voided = false
    `;

    const result = await this.db.query(query, [saleId]);
    
    return result.rows.map(row => ({
      saleItemId: row.sale_item_id,
      inventoryItemId: row.inventory_item_id,
      productId: row.product_id,
      quantity: parseFloat(row.quantity),
      unit: row.unit,
      unitCost: parseFloat(row.unit_cost),
    }));
  }

  async updatePricing(
    id: string,
    updates: {
      unitPrice?: number;
      discountAmount?: number;
      discountPercentage?: number;
      lineTotal?: number;
    }
  ): Promise<SaleItem> {
    const setClause: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let paramIndex = 2;

    if (updates.unitPrice !== undefined) {
      setClause.push(`unit_price = $${paramIndex++}`);
      params.push(updates.unitPrice);
    }

    if (updates.discountAmount !== undefined) {
      setClause.push(`discount_amount = $${paramIndex++}`);
      params.push(updates.discountAmount);
    }

    if (updates.discountPercentage !== undefined) {
      setClause.push(`discount_percentage = $${paramIndex++}`);
      params.push(updates.discountPercentage);
    }

    if (updates.lineTotal !== undefined) {
      setClause.push(`line_total = $${paramIndex++}`);
      params.push(updates.lineTotal);
    }

    const query = `
      UPDATE sales.sale_items 
      SET ${setClause.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, params);
    
    if (result.rows.length === 0) {
      throw new Error(`Sale item not found: ${id}`);
    }

    return this.mapToSaleItem(result.rows[0]);
  }

  async deleteItem(id: string): Promise<void> {
    const query = `
      DELETE FROM sales.sale_items 
      WHERE id = $1
    `;

    await this.db.query(query, [id]);
  }

  async getTopSellingItems(
    branchId?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 20
  ): Promise<Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
    averagePrice: number;
    margin: number;
  }>> {
    let query = `
      SELECT 
        si.product_id,
        si.product_name,
        SUM(si.quantity) as quantity_sold,
        SUM(si.line_total) as revenue,
        AVG(si.unit_price) as average_price,
        SUM(si.gross_margin) as margin
      FROM sales.sale_items si
      JOIN sales.sales s ON si.sale_id = s.id
      WHERE si.voided = false
        AND s.status = 'completed'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (branchId) {
      query += ` AND s.branch_id = $${paramIndex++}`;
      params.push(branchId);
    }

    if (startDate && endDate) {
      query += ` AND s.sale_date >= $${paramIndex++} AND s.sale_date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    query += `
      GROUP BY si.product_id, si.product_name
      ORDER BY quantity_sold DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await this.db.query(query, params);
    
    return result.rows.map(row => ({
      productId: row.product_id,
      productName: row.product_name,
      quantitySold: parseFloat(row.quantity_sold),
      revenue: parseFloat(row.revenue),
      averagePrice: parseFloat(row.average_price),
      margin: parseFloat(row.margin),
    }));
  }

  private mapToSaleItem(row: any): SaleItem {
    return {
      id: row.id,
      saleId: row.sale_id,
      inventoryItemId: row.inventory_item_id,
      productId: row.product_id,
      productName: row.product_name,
      productSku: row.product_sku,
      quantity: parseFloat(row.quantity),
      unit: row.unit,
      unitPrice: parseFloat(row.unit_price),
      listPrice: parseFloat(row.list_price),
      discountAmount: parseFloat(row.discount_amount),
      discountPercentage: parseFloat(row.discount_percentage),
      lineTotal: parseFloat(row.line_total),
      batchNumber: row.batch_number,
      expirationDate: row.expiration_date,
      barcodeScanned: row.barcode_scanned,
      actualWeight: row.actual_weight ? parseFloat(row.actual_weight) : undefined,
      tareWeight: row.tare_weight ? parseFloat(row.tare_weight) : undefined,
      netWeight: row.net_weight ? parseFloat(row.net_weight) : undefined,
      unitCost: parseFloat(row.unit_cost),
      totalCost: parseFloat(row.total_cost),
      grossMargin: parseFloat(row.gross_margin),
      voided: row.voided,
      voidedAt: row.voided_at,
      voidReason: row.void_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default SaleItemModel;