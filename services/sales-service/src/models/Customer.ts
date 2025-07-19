import DatabaseConnection from '../database/connection';
import { Customer } from '@dried-fruits/types';

export class CustomerModel {
  private db = DatabaseConnection.getInstance();

  async create(customerData: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    dateOfBirth?: Date;
    gender?: string;
    preferredLanguage?: string;
    notes?: string;
  }): Promise<Customer> {
    const query = `
      INSERT INTO sales.customers (
        name, phone, email, address, city, province, postal_code,
        date_of_birth, gender, preferred_language, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      customerData.name,
      customerData.phone,
      customerData.email,
      customerData.address,
      customerData.city,
      customerData.province,
      customerData.postalCode,
      customerData.dateOfBirth,
      customerData.gender,
      customerData.preferredLanguage,
      customerData.notes,
    ];

    const result = await this.db.query(query, values);
    return this.mapToCustomer(result.rows[0]);
  }

  async findById(id: string): Promise<Customer | null> {
    const query = `
      SELECT * FROM sales.customers 
      WHERE id = $1 AND active = true
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapToCustomer(result.rows[0]) : null;
  }

  async findByPhone(phone: string): Promise<Customer | null> {
    const query = `
      SELECT * FROM sales.customers 
      WHERE phone = $1 AND active = true
    `;

    const result = await this.db.query(query, [phone]);
    return result.rows[0] ? this.mapToCustomer(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const query = `
      SELECT * FROM sales.customers 
      WHERE email = $1 AND active = true
    `;

    const result = await this.db.query(query, [email]);
    return result.rows[0] ? this.mapToCustomer(result.rows[0]) : null;
  }

  async search(
    searchTerm: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ customers: Customer[]; total: number }> {
    const searchPattern = `%${searchTerm.toLowerCase()}%`;
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sales.customers 
      WHERE active = true
        AND (
          LOWER(name) LIKE $1 
          OR LOWER(phone) LIKE $1 
          OR LOWER(email) LIKE $1
        )
    `;

    const dataQuery = `
      SELECT * FROM sales.customers 
      WHERE active = true
        AND (
          LOWER(name) LIKE $1 
          OR LOWER(phone) LIKE $1 
          OR LOWER(email) LIKE $1
        )
      ORDER BY last_purchase_date DESC NULLS LAST, name ASC
      LIMIT $2 OFFSET $3
    `;

    const [countResult, dataResult] = await Promise.all([
      this.db.query(countQuery, [searchPattern]),
      this.db.query(dataQuery, [searchPattern, limit, offset]),
    ]);

    return {
      customers: dataResult.rows.map(row => this.mapToCustomer(row)),
      total: parseInt(countResult.rows[0].total),
    };
  }

  async update(
    id: string,
    updates: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      dateOfBirth?: Date;
      gender?: string;
      preferredLanguage?: string;
      notes?: string;
    }
  ): Promise<Customer> {
    const setClause: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let paramIndex = 2;

    if (updates.name !== undefined) {
      setClause.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }

    if (updates.phone !== undefined) {
      setClause.push(`phone = $${paramIndex++}`);
      params.push(updates.phone);
    }

    if (updates.email !== undefined) {
      setClause.push(`email = $${paramIndex++}`);
      params.push(updates.email);
    }

    if (updates.address !== undefined) {
      setClause.push(`address = $${paramIndex++}`);
      params.push(updates.address);
    }

    if (updates.city !== undefined) {
      setClause.push(`city = $${paramIndex++}`);
      params.push(updates.city);
    }

    if (updates.province !== undefined) {
      setClause.push(`province = $${paramIndex++}`);
      params.push(updates.province);
    }

    if (updates.postalCode !== undefined) {
      setClause.push(`postal_code = $${paramIndex++}`);
      params.push(updates.postalCode);
    }

    if (updates.dateOfBirth !== undefined) {
      setClause.push(`date_of_birth = $${paramIndex++}`);
      params.push(updates.dateOfBirth);
    }

    if (updates.gender !== undefined) {
      setClause.push(`gender = $${paramIndex++}`);
      params.push(updates.gender);
    }

    if (updates.preferredLanguage !== undefined) {
      setClause.push(`preferred_language = $${paramIndex++}`);
      params.push(updates.preferredLanguage);
    }

    if (updates.notes !== undefined) {
      setClause.push(`notes = $${paramIndex++}`);
      params.push(updates.notes);
    }

    const query = `
      UPDATE sales.customers 
      SET ${setClause.join(', ')}
      WHERE id = $1 AND active = true
      RETURNING *
    `;

    const result = await this.db.query(query, params);
    
    if (result.rows.length === 0) {
      throw new Error(`Customer not found: ${id}`);
    }

    return this.mapToCustomer(result.rows[0]);
  }

  async deactivate(id: string): Promise<void> {
    const query = `
      UPDATE sales.customers 
      SET active = false, updated_at = NOW()
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    
    if (result.rowCount === 0) {
      throw new Error(`Customer not found: ${id}`);
    }
  }

  async findTopCustomers(
    branchId?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 20
  ): Promise<Array<{
    customer: Customer;
    totalPurchases: number;
    totalSpent: number;
    averageSpent: number;
    lastPurchase: Date;
    favoriteProducts: Array<{
      productId: string;
      productName: string;
      timesPurchased: number;
    }>;
  }>> {
    let query = `
      SELECT 
        c.*,
        COUNT(s.id) as total_purchases,
        SUM(s.total_amount) as total_spent,
        AVG(s.total_amount) as average_spent,
        MAX(s.sale_date) as last_purchase
      FROM sales.customers c
      JOIN sales.sales s ON c.id = s.customer_id
      WHERE c.active = true
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
      GROUP BY c.id
      ORDER BY total_spent DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await this.db.query(query, params);
    
    const customerStats = await Promise.all(
      result.rows.map(async (row) => {
        const customer = this.mapToCustomer(row);
        
        // Get favorite products for this customer
        const favoriteProductsQuery = `
          SELECT 
            si.product_id,
            si.product_name,
            COUNT(*) as times_purchased
          FROM sales.sale_items si
          JOIN sales.sales s ON si.sale_id = s.id
          WHERE s.customer_id = $1
            AND s.status = 'completed'
            AND si.voided = false
          GROUP BY si.product_id, si.product_name
          ORDER BY times_purchased DESC
          LIMIT 5
        `;

        const favoriteProductsResult = await this.db.query(favoriteProductsQuery, [customer.id]);

        return {
          customer,
          totalPurchases: parseInt(row.total_purchases),
          totalSpent: parseFloat(row.total_spent),
          averageSpent: parseFloat(row.average_spent),
          lastPurchase: row.last_purchase,
          favoriteProducts: favoriteProductsResult.rows.map(fpRow => ({
            productId: fpRow.product_id,
            productName: fpRow.product_name,
            timesPurchased: parseInt(fpRow.times_purchased),
          })),
        };
      })
    );

    return customerStats;
  }

  async getCustomerAnalytics(customerId: string): Promise<{
    totalPurchases: number;
    totalSpent: number;
    averageTransactionValue: number;
    firstPurchase: Date | null;
    lastPurchase: Date | null;
    favoritePaymentMethod: string | null;
    mostShoppedBranch: { branchId: string; visits: number } | null;
    monthlySpending: Array<{ month: string; amount: number; transactions: number }>;
    productCategories: Array<{ category: string; spent: number; purchases: number }>;
  }> {
    const analyticsQuery = `
      SELECT 
        COUNT(*) as total_purchases,
        SUM(total_amount) as total_spent,
        AVG(total_amount) as average_transaction_value,
        MIN(sale_date) as first_purchase,
        MAX(sale_date) as last_purchase
      FROM sales.sales 
      WHERE customer_id = $1 AND status = 'completed'
    `;

    const paymentMethodQuery = `
      SELECT sp.payment_method, COUNT(*) as count
      FROM sales.sale_payments sp
      JOIN sales.sales s ON sp.sale_id = s.id
      WHERE s.customer_id = $1 AND s.status = 'completed' AND sp.voided = false
      GROUP BY sp.payment_method
      ORDER BY count DESC
      LIMIT 1
    `;

    const branchQuery = `
      SELECT branch_id, COUNT(*) as visits
      FROM sales.sales 
      WHERE customer_id = $1 AND status = 'completed'
      GROUP BY branch_id
      ORDER BY visits DESC
      LIMIT 1
    `;

    const monthlySpendingQuery = `
      SELECT 
        TO_CHAR(sale_date, 'YYYY-MM') as month,
        SUM(total_amount) as amount,
        COUNT(*) as transactions
      FROM sales.sales 
      WHERE customer_id = $1 AND status = 'completed'
        AND sale_date >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(sale_date, 'YYYY-MM')
      ORDER BY month DESC
    `;

    const [
      analyticsResult,
      paymentMethodResult,
      branchResult,
      monthlySpendingResult,
    ] = await Promise.all([
      this.db.query(analyticsQuery, [customerId]),
      this.db.query(paymentMethodQuery, [customerId]),
      this.db.query(branchQuery, [customerId]),
      this.db.query(monthlySpendingQuery, [customerId]),
    ]);

    const analytics = analyticsResult.rows[0];

    return {
      totalPurchases: parseInt(analytics.total_purchases) || 0,
      totalSpent: parseFloat(analytics.total_spent) || 0,
      averageTransactionValue: parseFloat(analytics.average_transaction_value) || 0,
      firstPurchase: analytics.first_purchase,
      lastPurchase: analytics.last_purchase,
      favoritePaymentMethod: paymentMethodResult.rows[0]?.payment_method || null,
      mostShoppedBranch: branchResult.rows[0] ? {
        branchId: branchResult.rows[0].branch_id,
        visits: parseInt(branchResult.rows[0].visits),
      } : null,
      monthlySpending: monthlySpendingResult.rows.map(row => ({
        month: row.month,
        amount: parseFloat(row.amount),
        transactions: parseInt(row.transactions),
      })),
      productCategories: [], // Would require product category data
    };
  }

  async findOrCreateByPhone(
    phone: string,
    customerData?: {
      name?: string;
      email?: string;
      address?: string;
      city?: string;
      province?: string;
      postalCode?: string;
    }
  ): Promise<Customer> {
    // First try to find existing customer
    let customer = await this.findByPhone(phone);
    
    if (customer) {
      return customer;
    }

    // Create new customer if not found
    const createData = {
      name: customerData?.name || `Customer ${phone}`,
      phone,
      email: customerData?.email,
      address: customerData?.address,
      city: customerData?.city,
      province: customerData?.province,
      postalCode: customerData?.postalCode,
    };

    return this.create(createData);
  }

  async updateStats(customerId: string, saleData: {
    totalAmount: number;
    saleDate: Date;
  }): Promise<void> {
    const query = `
      UPDATE sales.customers 
      SET 
        total_purchases = total_purchases + 1,
        total_spent = total_spent + $2,
        last_purchase_date = $3,
        last_purchase_amount = $2,
        updated_at = NOW()
      WHERE id = $1
    `;

    await this.db.query(query, [customerId, saleData.totalAmount, saleData.saleDate]);
  }

  private mapToCustomer(row: any): Customer {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      city: row.city,
      province: row.province,
      postalCode: row.postal_code,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      preferredLanguage: row.preferred_language,
      totalPurchases: parseInt(row.total_purchases) || 0,
      totalSpent: parseFloat(row.total_spent) || 0,
      averageSpent: parseFloat(row.average_spent) || 0,
      lastPurchaseDate: row.last_purchase_date,
      lastPurchaseAmount: row.last_purchase_amount ? parseFloat(row.last_purchase_amount) : undefined,
      notes: row.notes,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default CustomerModel;