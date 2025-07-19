import DatabaseConnection from '../database/connection';
import { Sale, SaleStatus, SaleType } from '@dried-fruits/types';
import logger from '../utils/logger';

export class SaleModel {
  private db = DatabaseConnection.getInstance();

  async create(saleData: {
    branchId: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    saleType: SaleType;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    paidAmount: number;
    changeAmount: number;
    soldBy: string;
    cashierId?: string;
    mallLocation?: string;
    posTerminalId?: string;
    notes?: string;
  }): Promise<Sale> {
    return this.db.transaction(async (client) => {
      // Generate sale number
      const saleNumberResult = await client.query('SELECT generate_sale_number($1) as sale_number', ['SAL']);
      const saleNumber = saleNumberResult.rows[0].sale_number;

      // Create sale
      const insertQuery = `
        INSERT INTO sales.sales (
          sale_number, branch_id, customer_id, customer_name, customer_phone,
          customer_email, sale_type, subtotal, discount_amount, tax_amount,
          total_amount, paid_amount, change_amount, sold_by, cashier_id,
          mall_location, pos_terminal_id, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `;

      const values = [
        saleNumber,
        saleData.branchId,
        saleData.customerId,
        saleData.customerName,
        saleData.customerPhone,
        saleData.customerEmail,
        saleData.saleType,
        saleData.subtotal,
        saleData.discountAmount,
        saleData.taxAmount,
        saleData.totalAmount,
        saleData.paidAmount,
        saleData.changeAmount,
        saleData.soldBy,
        saleData.cashierId,
        saleData.mallLocation,
        saleData.posTerminalId,
        saleData.notes,
        SaleStatus.PENDING,
      ];

      const result = await client.query(insertQuery, values);
      const sale = result.rows[0];

      logger.info('Sale created', {
        saleId: sale.id,
        saleNumber: sale.sale_number,
        branchId: saleData.branchId,
        totalAmount: saleData.totalAmount,
      });

      return this.mapToSale(sale);
    });
  }

  async findById(id: string): Promise<Sale | null> {
    const query = `
      SELECT * FROM sales.sales 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapToSale(result.rows[0]) : null;
  }

  async findBySaleNumber(saleNumber: string): Promise<Sale | null> {
    const query = `
      SELECT * FROM sales.sales 
      WHERE sale_number = $1
    `;

    const result = await this.db.query(query, [saleNumber]);
    return result.rows[0] ? this.mapToSale(result.rows[0]) : null;
  }

  async findByBranch(branchId: string, startDate?: Date, endDate?: Date, limit?: number): Promise<Sale[]> {
    let query = `
      SELECT * FROM sales.sales 
      WHERE branch_id = $1
    `;

    const params = [branchId];
    let paramIndex = 2;

    if (startDate && endDate) {
      query += ` AND sale_date >= $${paramIndex++} AND sale_date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY sale_date DESC`;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToSale(row));
  }

  async updateStatus(
    id: string,
    status: SaleStatus,
    updates?: {
      receiptPrinted?: boolean;
      emailReceiptSent?: boolean;
      voidReason?: string;
      voidedBy?: string;
    }
  ): Promise<Sale> {
    const setClause = ['status = $2', 'updated_at = NOW()'];
    const params = [id, status];
    let paramIndex = 3;

    if (status === SaleStatus.VOIDED) {
      setClause.push(`voided_at = NOW()`);
      if (updates?.voidedBy) {
        setClause.push(`voided_by = $${paramIndex++}`);
        params.push(updates.voidedBy);
      }
      if (updates?.voidReason) {
        setClause.push(`void_reason = $${paramIndex++}`);
        params.push(updates.voidReason);
      }
    }

    if (updates?.receiptPrinted !== undefined) {
      setClause.push(`receipt_printed = $${paramIndex++}`);
      params.push(updates.receiptPrinted);
    }

    if (updates?.emailReceiptSent !== undefined) {
      setClause.push(`email_receipt_sent = $${paramIndex++}`);
      params.push(updates.emailReceiptSent);
    }

    const query = `
      UPDATE sales.sales 
      SET ${setClause.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, params);
    
    if (result.rows.length === 0) {
      throw new Error(`Sale not found: ${id}`);
    }

    const updatedSale = this.mapToSale(result.rows[0]);

    logger.info('Sale status updated', {
      saleId: id,
      newStatus: status,
    });

    return updatedSale;
  }

  async voidSale(id: string, reason: string, voidedBy: string): Promise<Sale> {
    return this.db.transaction(async (client) => {
      // First check if sale can be voided
      const saleQuery = 'SELECT * FROM sales.sales WHERE id = $1';
      const saleResult = await client.query(saleQuery, [id]);
      
      if (saleResult.rows.length === 0) {
        throw new Error('Sale not found');
      }

      const sale = saleResult.rows[0];
      
      if (sale.status === SaleStatus.VOIDED) {
        throw new Error('Sale is already voided');
      }

      if (sale.status !== SaleStatus.COMPLETED) {
        throw new Error('Only completed sales can be voided');
      }

      // Update sale status
      const updateQuery = `
        UPDATE sales.sales 
        SET 
          status = $2,
          voided_at = NOW(),
          voided_by = $3,
          void_reason = $4,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(updateQuery, [id, SaleStatus.VOIDED, voidedBy, reason]);
      
      // Mark all sale items as voided
      await client.query(
        'UPDATE sales.sale_items SET voided = true, voided_at = NOW(), void_reason = $2 WHERE sale_id = $1',
        [id, reason]
      );

      logger.info('Sale voided', {
        saleId: id,
        reason,
        voidedBy,
      });

      return this.mapToSale(result.rows[0]);
    });
  }

  async findSalesByCustomer(customerId: string, limit?: number): Promise<Sale[]> {
    let query = `
      SELECT * FROM sales.sales 
      WHERE customer_id = $1 
      ORDER BY sale_date DESC
    `;

    const params = [customerId];

    if (limit) {
      query += ` LIMIT $2`;
      params.push(limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToSale(row));
  }

  async findSalesByDateRange(
    branchId: string,
    startDate: Date,
    endDate: Date,
    status?: SaleStatus
  ): Promise<Sale[]> {
    let query = `
      SELECT * FROM sales.sales 
      WHERE branch_id = $1 
        AND sale_date >= $2 
        AND sale_date <= $3
    `;

    const params = [branchId, startDate, endDate];

    if (status) {
      query += ` AND status = $4`;
      params.push(status);
    }

    query += ` ORDER BY sale_date DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToSale(row));
  }

  async getSalesAnalytics(
    branchId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSales: number;
    totalRevenue: number;
    averageTransaction: number;
    totalCustomers: number;
    salesByHour: Array<{ hour: number; count: number; revenue: number }>;
    salesByDay: Array<{ date: string; count: number; revenue: number }>;
  }> {
    const analyticsQuery = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as average_transaction,
        COUNT(DISTINCT customer_id) as total_customers
      FROM sales.sales 
      WHERE branch_id = $1 
        AND sale_date >= $2 
        AND sale_date <= $3
        AND status = 'completed'
    `;

    const hourlyQuery = `
      SELECT 
        EXTRACT(HOUR FROM sale_date) as hour,
        COUNT(*) as count,
        SUM(total_amount) as revenue
      FROM sales.sales 
      WHERE branch_id = $1 
        AND sale_date >= $2 
        AND sale_date <= $3
        AND status = 'completed'
      GROUP BY EXTRACT(HOUR FROM sale_date)
      ORDER BY hour
    `;

    const dailyQuery = `
      SELECT 
        DATE(sale_date) as date,
        COUNT(*) as count,
        SUM(total_amount) as revenue
      FROM sales.sales 
      WHERE branch_id = $1 
        AND sale_date >= $2 
        AND sale_date <= $3
        AND status = 'completed'
      GROUP BY DATE(sale_date)
      ORDER BY date
    `;

    const [analyticsResult, hourlyResult, dailyResult] = await Promise.all([
      this.db.query(analyticsQuery, [branchId, startDate, endDate]),
      this.db.query(hourlyQuery, [branchId, startDate, endDate]),
      this.db.query(dailyQuery, [branchId, startDate, endDate]),
    ]);

    const analytics = analyticsResult.rows[0];

    return {
      totalSales: parseInt(analytics.total_sales) || 0,
      totalRevenue: parseFloat(analytics.total_revenue) || 0,
      averageTransaction: parseFloat(analytics.average_transaction) || 0,
      totalCustomers: parseInt(analytics.total_customers) || 0,
      salesByHour: hourlyResult.rows.map(row => ({
        hour: parseInt(row.hour),
        count: parseInt(row.count),
        revenue: parseFloat(row.revenue),
      })),
      salesByDay: dailyResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count),
        revenue: parseFloat(row.revenue),
      })),
    };
  }

  async findRecentSales(branchId: string, limit: number = 10): Promise<Sale[]> {
    const query = `
      SELECT * FROM sales.sales 
      WHERE branch_id = $1 
        AND status = 'completed'
      ORDER BY sale_date DESC 
      LIMIT $2
    `;

    const result = await this.db.query(query, [branchId, limit]);
    return result.rows.map(row => this.mapToSale(row));
  }

  async getTodaysSales(branchId: string): Promise<{
    salesCount: number;
    totalRevenue: number;
    averageTransaction: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as sales_count,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as average_transaction
      FROM sales.sales 
      WHERE branch_id = $1 
        AND DATE(sale_date) = CURRENT_DATE
        AND status = 'completed'
    `;

    const result = await this.db.query(query, [branchId]);
    const row = result.rows[0];

    return {
      salesCount: parseInt(row.sales_count) || 0,
      totalRevenue: parseFloat(row.total_revenue) || 0,
      averageTransaction: parseFloat(row.average_transaction) || 0,
    };
  }

  async findTopProducts(
    branchId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
    averagePrice: number;
  }>> {
    const query = `
      SELECT 
        si.product_id,
        si.product_name,
        SUM(si.quantity) as quantity_sold,
        SUM(si.line_total) as revenue,
        AVG(si.unit_price) as average_price
      FROM sales.sale_items si
      JOIN sales.sales s ON si.sale_id = s.id
      WHERE s.branch_id = $1 
        AND s.sale_date >= $2 
        AND s.sale_date <= $3
        AND s.status = 'completed'
        AND si.voided = false
      GROUP BY si.product_id, si.product_name
      ORDER BY revenue DESC
      LIMIT $4
    `;

    const result = await this.db.query(query, [branchId, startDate, endDate, limit]);
    
    return result.rows.map(row => ({
      productId: row.product_id,
      productName: row.product_name,
      quantitySold: parseFloat(row.quantity_sold),
      revenue: parseFloat(row.revenue),
      averagePrice: parseFloat(row.average_price),
    }));
  }

  private mapToSale(row: any): Sale {
    return {
      id: row.id,
      saleNumber: row.sale_number,
      branchId: row.branch_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email,
      saleType: row.sale_type,
      status: row.status,
      subtotal: parseFloat(row.subtotal),
      discountAmount: parseFloat(row.discount_amount),
      taxAmount: parseFloat(row.tax_amount),
      totalAmount: parseFloat(row.total_amount),
      paidAmount: parseFloat(row.paid_amount),
      changeAmount: parseFloat(row.change_amount),
      items: [], // Will be populated separately
      payments: [], // Will be populated separately
      discounts: [], // Will be populated separately
      soldBy: row.sold_by,
      cashierId: row.cashier_id,
      mallLocation: row.mall_location,
      posTerminalId: row.pos_terminal_id,
      saleDate: row.sale_date,
      voidedAt: row.voided_at,
      voidedBy: row.voided_by,
      voidReason: row.void_reason,
      notes: row.notes,
      receiptPrinted: row.receipt_printed,
      emailReceiptSent: row.email_receipt_sent,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default SaleModel;