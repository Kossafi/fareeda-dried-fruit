import { BaseModel } from './BaseModel';
import DatabaseConnection from '../database/connection';
import { SamplingRecord as ISamplingRecord, ProductCondition, CustomerResponse } from '@dried-fruits/types';

export class SamplingRecord extends BaseModel implements ISamplingRecord {
  public samplingSessionId!: string;
  public productId!: string;
  public inventoryItemId?: string;
  public batchNumber?: string;
  public weightGram!: number;
  public unitCostPerGram!: number;
  public totalCost!: number;
  public productCondition!: ProductCondition;
  public expirationDate?: Date;
  public customerResponse?: CustomerResponse;
  public resultedInPurchase!: boolean;
  public purchaseAmount?: number;
  public notes?: string;
  public recordedBy!: string;
  public recordedAt!: Date;

  protected tableName = 'sampling_records';

  constructor(data?: Partial<ISamplingRecord>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  // Create new sampling record with weight validation
  async create(recordData: {
    samplingSessionId: string;
    productId: string;
    inventoryItemId?: string;
    batchNumber?: string;
    weightGram: number;
    unitCostPerGram?: number;
    productCondition?: ProductCondition;
    expirationDate?: Date;
    customerResponse?: CustomerResponse;
    resultedInPurchase?: boolean;
    purchaseAmount?: number;
    notes?: string;
    recordedBy: string;
  }): Promise<SamplingRecord> {
    const db = DatabaseConnection.getInstance();

    // Validate weight
    await this.validateWeight(recordData.weightGram, recordData.productId, recordData.samplingSessionId);

    // Get cost per gram if not provided
    let unitCost = recordData.unitCostPerGram;
    if (!unitCost) {
      unitCost = await this.getProductCostPerGram(recordData.productId, recordData.inventoryItemId);
    }

    // Calculate total cost
    const totalCost = recordData.weightGram * unitCost;

    const query = `
      INSERT INTO sampling_records (
        sampling_session_id, product_id, inventory_item_id, batch_number,
        weight_gram, unit_cost_per_gram, total_cost, product_condition,
        expiration_date, customer_response, resulted_in_purchase,
        purchase_amount, notes, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      recordData.samplingSessionId,
      recordData.productId,
      recordData.inventoryItemId || null,
      recordData.batchNumber || null,
      recordData.weightGram,
      unitCost,
      totalCost,
      recordData.productCondition || 'excellent',
      recordData.expirationDate || null,
      recordData.customerResponse || null,
      recordData.resultedInPurchase || false,
      recordData.purchaseAmount || null,
      recordData.notes || null,
      recordData.recordedBy
    ];

    const result = await db.query(query, values);
    const record = new SamplingRecord(result.rows[0]);

    console.log(`Sampling record created: ${record.weightGram}g of product ${recordData.productId}`);
    
    return record;
  }

  // Validate weight against policies and limits
  private async validateWeight(weightGram: number, productId: string, sessionId: string): Promise<void> {
    const db = DatabaseConnection.getInstance();

    // Get session and branch info
    const sessionQuery = `
      SELECT branch_id, session_date 
      FROM sampling_sessions 
      WHERE id = $1
    `;
    const sessionResult = await db.query(sessionQuery, [sessionId]);
    
    if (sessionResult.rows.length === 0) {
      throw new Error('Sampling session not found');
    }

    const { branch_id: branchId, session_date: sessionDate } = sessionResult.rows[0];

    // Check sampling limits using database function
    const limitsQuery = `SELECT check_sampling_limits($1, $2, $3, $4) as result`;
    const limitsResult = await db.query(limitsQuery, [branchId, productId, weightGram, sessionDate]);
    const limits = limitsResult.rows[0].result;

    if (!limits.allowed) {
      throw new Error(`Sampling not allowed: ${limits.reason}`);
    }

    // Check if requires approval
    if (limits.requires_approval) {
      // Mark session as requiring approval
      await db.query(`
        UPDATE sampling_sessions 
        SET requires_approval = true, status = 'pending_approval'
        WHERE id = $1 AND status = 'active'
      `, [sessionId]);
    }

    // Validate weight precision (max 3 decimal places)
    if (!/^\d+(\.\d{1,3})?$/.test(weightGram.toString())) {
      throw new Error('Weight must have maximum 3 decimal places');
    }

    // Minimum weight validation
    if (weightGram < 0.001) {
      throw new Error('Weight must be at least 0.001 grams');
    }

    // Maximum single sample weight validation
    if (weightGram > 100) {
      throw new Error('Single sample cannot exceed 100 grams');
    }
  }

  // Get product cost per gram
  private async getProductCostPerGram(productId: string, inventoryItemId?: string): Promise<number> {
    const db = DatabaseConnection.getInstance();

    if (inventoryItemId) {
      // Get cost from specific inventory item
      const query = `
        SELECT unit_cost FROM inventory_items 
        WHERE id = $1 AND product_id = $2
      `;
      const result = await db.query(query, [inventoryItemId, productId]);
      
      if (result.rows.length > 0) {
        return parseFloat(result.rows[0].unit_cost);
      }
    }

    // Get average cost from sampling policy or product
    const policyQuery = `
      SELECT cost_per_gram FROM sampling_policies 
      WHERE product_id = $1 AND is_active = true
      LIMIT 1
    `;
    const policyResult = await db.query(policyQuery, [productId]);
    
    if (policyResult.rows.length > 0) {
      return parseFloat(policyResult.rows[0].cost_per_gram);
    }

    // Fallback to average inventory cost
    const avgQuery = `
      SELECT AVG(unit_cost) as avg_cost 
      FROM inventory_items 
      WHERE product_id = $1 AND is_active = true
    `;
    const avgResult = await db.query(avgQuery, [productId]);
    
    if (avgResult.rows.length > 0 && avgResult.rows[0].avg_cost) {
      return parseFloat(avgResult.rows[0].avg_cost);
    }

    // Default fallback cost
    return 1.0;
  }

  // Update customer response and purchase info
  async updateCustomerResponse(id: string, responseData: {
    customerResponse: CustomerResponse;
    resultedInPurchase: boolean;
    purchaseAmount?: number;
    notes?: string;
  }): Promise<SamplingRecord> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE sampling_records 
      SET 
        customer_response = $2,
        resulted_in_purchase = $3,
        purchase_amount = $4,
        notes = COALESCE($5, notes)
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      id,
      responseData.customerResponse,
      responseData.resultedInPurchase,
      responseData.purchaseAmount || null,
      responseData.notes || null
    ];

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Sampling record not found');
    }

    return new SamplingRecord(result.rows[0]);
  }

  // Get records by session
  async getBySession(sessionId: string): Promise<SamplingRecord[]> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT 
        sr.*,
        p.name as product_name,
        p.sku as product_sku,
        ii.batch_number as inventory_batch,
        u.username as recorded_by_name
      FROM sampling_records sr
      JOIN products p ON sr.product_id = p.id
      LEFT JOIN inventory_items ii ON sr.inventory_item_id = ii.id
      JOIN users u ON sr.recorded_by = u.id
      WHERE sr.sampling_session_id = $1
      ORDER BY sr.recorded_at DESC
    `;

    const result = await db.query(query, [sessionId]);
    return result.rows.map(row => new SamplingRecord(row));
  }

  // Get records by product
  async getByProduct(productId: string, dateFrom?: Date, dateTo?: Date): Promise<SamplingRecord[]> {
    const db = DatabaseConnection.getInstance();

    let whereClause = 'WHERE sr.product_id = $1';
    const values = [productId];
    let paramCount = 2;

    if (dateFrom) {
      whereClause += ` AND ss.session_date >= $${paramCount}`;
      values.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      whereClause += ` AND ss.session_date <= $${paramCount}`;
      values.push(dateTo);
      paramCount++;
    }

    const query = `
      SELECT 
        sr.*,
        ss.session_number,
        ss.session_date,
        b.name as branch_name,
        p.name as product_name,
        u.username as recorded_by_name
      FROM sampling_records sr
      JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
      JOIN branches b ON ss.branch_id = b.id
      JOIN products p ON sr.product_id = p.id
      JOIN users u ON sr.recorded_by = u.id
      ${whereClause}
      AND ss.status = 'completed'
      ORDER BY ss.session_date DESC, sr.recorded_at DESC
    `;

    const result = await db.query(query, values);
    return result.rows.map(row => new SamplingRecord(row));
  }

  // Get records by branch and date
  async getByBranchAndDate(branchId: string, date: Date): Promise<SamplingRecord[]> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT 
        sr.*,
        ss.session_number,
        p.name as product_name,
        p.sku as product_sku,
        u.username as recorded_by_name
      FROM sampling_records sr
      JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
      JOIN products p ON sr.product_id = p.id
      JOIN users u ON sr.recorded_by = u.id
      WHERE ss.branch_id = $1 
      AND ss.session_date = $2
      AND ss.status IN ('completed', 'active')
      ORDER BY sr.recorded_at DESC
    `;

    const result = await db.query(query, [branchId, date]);
    return result.rows.map(row => new SamplingRecord(row));
  }

  // Get conversion analysis
  async getConversionAnalysis(filters: {
    branchId?: string;
    productId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{
    totalSamples: number;
    totalConversions: number;
    conversionRate: number;
    totalRevenue: number;
    totalCost: number;
    roi: number;
    averagePurchaseAmount: number;
    responseBreakdown: Array<{
      response: CustomerResponse;
      count: number;
      conversionRate: number;
    }>;
    productBreakdown: Array<{
      productId: string;
      productName: string;
      samples: number;
      conversions: number;
      conversionRate: number;
      revenue: number;
    }>;
  }> {
    const db = DatabaseConnection.getInstance();

    let whereClause = 'WHERE ss.status = \'completed\'';
    const values = [];
    let paramCount = 1;

    if (filters.branchId) {
      whereClause += ` AND ss.branch_id = $${paramCount}`;
      values.push(filters.branchId);
      paramCount++;
    }

    if (filters.productId) {
      whereClause += ` AND sr.product_id = $${paramCount}`;
      values.push(filters.productId);
      paramCount++;
    }

    if (filters.dateFrom) {
      whereClause += ` AND ss.session_date >= $${paramCount}`;
      values.push(filters.dateFrom);
      paramCount++;
    }

    if (filters.dateTo) {
      whereClause += ` AND ss.session_date <= $${paramCount}`;
      values.push(filters.dateTo);
      paramCount++;
    }

    const query = `
      WITH base_stats AS (
        SELECT 
          COUNT(*) as total_samples,
          COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true) as total_conversions,
          COALESCE(SUM(sr.purchase_amount), 0) as total_revenue,
          COALESCE(SUM(sr.total_cost), 0) as total_cost,
          COALESCE(AVG(sr.purchase_amount) FILTER (WHERE sr.resulted_in_purchase = true), 0) as avg_purchase
        FROM sampling_records sr
        JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
        ${whereClause}
      ),
      response_breakdown AS (
        SELECT 
          sr.customer_response,
          COUNT(*) as count,
          COALESCE(
            (COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true)::DECIMAL / 
             NULLIF(COUNT(*), 0) * 100), 0
          ) as conversion_rate
        FROM sampling_records sr
        JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
        ${whereClause}
        AND sr.customer_response IS NOT NULL
        GROUP BY sr.customer_response
      ),
      product_breakdown AS (
        SELECT 
          sr.product_id,
          p.name as product_name,
          COUNT(*) as samples,
          COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true) as conversions,
          COALESCE(
            (COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true)::DECIMAL / 
             NULLIF(COUNT(*), 0) * 100), 0
          ) as conversion_rate,
          COALESCE(SUM(sr.purchase_amount), 0) as revenue
        FROM sampling_records sr
        JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
        JOIN products p ON sr.product_id = p.id
        ${whereClause}
        GROUP BY sr.product_id, p.name
        ORDER BY samples DESC
        LIMIT 10
      )
      SELECT 
        bs.*,
        json_agg(
          DISTINCT jsonb_build_object(
            'response', rb.customer_response,
            'count', rb.count,
            'conversion_rate', rb.conversion_rate
          )
        ) FILTER (WHERE rb.customer_response IS NOT NULL) as response_breakdown,
        json_agg(
          DISTINCT jsonb_build_object(
            'product_id', pb.product_id,
            'product_name', pb.product_name,
            'samples', pb.samples,
            'conversions', pb.conversions,
            'conversion_rate', pb.conversion_rate,
            'revenue', pb.revenue
          )
        ) FILTER (WHERE pb.product_id IS NOT NULL) as product_breakdown
      FROM base_stats bs
      LEFT JOIN response_breakdown rb ON true
      LEFT JOIN product_breakdown pb ON true
      GROUP BY bs.total_samples, bs.total_conversions, bs.total_revenue, bs.total_cost, bs.avg_purchase
    `;

    const result = await db.query(query, values);
    const row = result.rows[0] || {};

    const totalSamples = parseInt(row.total_samples) || 0;
    const totalConversions = parseInt(row.total_conversions) || 0;
    const totalRevenue = parseFloat(row.total_revenue) || 0;
    const totalCost = parseFloat(row.total_cost) || 0;

    return {
      totalSamples,
      totalConversions,
      conversionRate: totalSamples > 0 ? (totalConversions / totalSamples * 100) : 0,
      totalRevenue,
      totalCost,
      roi: totalCost > 0 ? ((totalRevenue - totalCost) / totalCost * 100) : 0,
      averagePurchaseAmount: parseFloat(row.avg_purchase) || 0,
      responseBreakdown: row.response_breakdown || [],
      productBreakdown: row.product_breakdown || []
    };
  }

  // Delete record (with stock restoration)
  async delete(id: string): Promise<boolean> {
    const db = DatabaseConnection.getInstance();

    // Get record details first
    const getQuery = `SELECT * FROM sampling_records WHERE id = $1`;
    const getResult = await db.query(getQuery, [id]);
    
    if (getResult.rows.length === 0) {
      throw new Error('Sampling record not found');
    }

    const record = getResult.rows[0];

    // Restore stock if inventory item exists
    if (record.inventory_item_id) {
      await db.query(`
        UPDATE inventory_items
        SET 
          quantity_in_stock = quantity_in_stock + $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [record.weight_gram, record.inventory_item_id]);

      // Create reverse stock movement
      await db.query(`
        INSERT INTO stock_movements (
          inventory_item_id, movement_type, quantity, unit_cost,
          reference_type, reference_id, performed_by, notes
        ) VALUES ($1, 'sampling_return', $2, $3, 'sampling_record', $4, $5, $6)
      `, [
        record.inventory_item_id,
        record.weight_gram,
        record.unit_cost_per_gram,
        record.id,
        record.recorded_by,
        'Stock restored from deleted sampling record'
      ]);
    }

    // Delete the record
    const deleteQuery = `DELETE FROM sampling_records WHERE id = $1`;
    const deleteResult = await db.query(deleteQuery, [id]);

    return deleteResult.rowCount > 0;
  }

  // Get weight validation rules
  static getWeightValidationRules(): {
    minWeight: number;
    maxWeight: number;
    decimalPlaces: number;
    unit: string;
  } {
    return {
      minWeight: 0.001, // 1 milligram
      maxWeight: 100,   // 100 grams per sample
      decimalPlaces: 3, // Up to 3 decimal places
      unit: 'gram'
    };
  }

  // Validate weight format
  static validateWeightFormat(weight: number): { valid: boolean; error?: string } {
    const rules = this.getWeightValidationRules();

    if (weight < rules.minWeight) {
      return { valid: false, error: `Weight must be at least ${rules.minWeight} grams` };
    }

    if (weight > rules.maxWeight) {
      return { valid: false, error: `Weight cannot exceed ${rules.maxWeight} grams per sample` };
    }

    // Check decimal places
    const decimalPart = weight.toString().split('.')[1];
    if (decimalPart && decimalPart.length > rules.decimalPlaces) {
      return { valid: false, error: `Weight can have maximum ${rules.decimalPlaces} decimal places` };
    }

    return { valid: true };
  }
}

export default SamplingRecord;