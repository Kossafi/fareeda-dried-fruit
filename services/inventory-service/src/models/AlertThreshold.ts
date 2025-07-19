import { BaseModel } from './BaseModel';
import DatabaseConnection from '../database/connection';
import { AlertThreshold as IAlertThreshold, UnitType } from '@dried-fruits/types';

export class AlertThreshold extends BaseModel implements IAlertThreshold {
  public branchId!: string;
  public productId!: string;
  public categoryId?: string;
  public minimumStockLevel!: number;
  public reorderPoint!: number;
  public maximumStockLevel?: number;
  public unit!: UnitType;
  public useAutoCalculation!: boolean;
  public autoCalculationDays!: number;
  public safetyStockMultiplier!: number;
  public isActive!: boolean;
  public createdBy!: string;

  protected tableName = 'alert_thresholds';

  constructor(data?: Partial<IAlertThreshold>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  // Create new alert threshold
  async create(thresholdData: {
    branchId: string;
    productId: string;
    categoryId?: string;
    minimumStockLevel: number;
    reorderPoint: number;
    maximumStockLevel?: number;
    unit: UnitType;
    useAutoCalculation?: boolean;
    autoCalculationDays?: number;
    safetyStockMultiplier?: number;
    createdBy: string;
  }): Promise<AlertThreshold> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      INSERT INTO alert_thresholds (
        branch_id, product_id, category_id, minimum_stock_level, 
        reorder_point, maximum_stock_level, unit, use_auto_calculation,
        auto_calculation_days, safety_stock_multiplier, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      thresholdData.branchId,
      thresholdData.productId,
      thresholdData.categoryId || null,
      thresholdData.minimumStockLevel,
      thresholdData.reorderPoint,
      thresholdData.maximumStockLevel || null,
      thresholdData.unit,
      thresholdData.useAutoCalculation ?? true,
      thresholdData.autoCalculationDays ?? 30,
      thresholdData.safetyStockMultiplier ?? 1.2,
      thresholdData.createdBy
    ];

    const result = await db.query(query, values);
    const threshold = new AlertThreshold(result.rows[0]);
    
    // Log threshold creation
    console.log(`Alert threshold created for product ${thresholdData.productId} at branch ${thresholdData.branchId}`);
    
    return threshold;
  }

  // Update alert threshold
  async update(id: string, updateData: Partial<IAlertThreshold>): Promise<AlertThreshold> {
    const db = DatabaseConnection.getInstance();
    
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        const dbKey = this.camelToSnake(key);
        updateFields.push(`${dbKey} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    
    const query = `
      UPDATE alert_thresholds 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Alert threshold not found');
    }

    return new AlertThreshold(result.rows[0]);
  }

  // Get threshold by branch and product
  async getByBranchAndProduct(branchId: string, productId: string): Promise<AlertThreshold | null> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      SELECT * FROM alert_thresholds
      WHERE branch_id = $1 AND product_id = $2 AND is_active = true
    `;

    const result = await db.query(query, [branchId, productId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return new AlertThreshold(result.rows[0]);
  }

  // Get all thresholds for a branch
  async getByBranch(branchId: string): Promise<AlertThreshold[]> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      SELECT at.*, p.name as product_name, p.sku as product_sku, c.name as category_name
      FROM alert_thresholds at
      JOIN products p ON at.product_id = p.id
      LEFT JOIN categories c ON at.category_id = c.id
      WHERE at.branch_id = $1 AND at.is_active = true
      ORDER BY p.name
    `;

    const result = await db.query(query, [branchId]);
    
    return result.rows.map(row => new AlertThreshold(row));
  }

  // Get all thresholds for a product across branches
  async getByProduct(productId: string): Promise<AlertThreshold[]> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      SELECT at.*, b.name as branch_name, b.address as branch_address
      FROM alert_thresholds at
      JOIN branches b ON at.branch_id = b.id
      WHERE at.product_id = $1 AND at.is_active = true
      ORDER BY b.name
    `;

    const result = await db.query(query, [productId]);
    
    return result.rows.map(row => new AlertThreshold(row));
  }

  // Get thresholds that need auto-calculation update
  async getForAutoCalculation(): Promise<AlertThreshold[]> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      SELECT * FROM alert_thresholds
      WHERE use_auto_calculation = true 
      AND is_active = true
      AND updated_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
      ORDER BY updated_at
    `;

    const result = await db.query(query);
    
    return result.rows.map(row => new AlertThreshold(row));
  }

  // Bulk create thresholds for a branch
  async bulkCreateForBranch(branchId: string, thresholds: Array<{
    productId: string;
    minimumStockLevel: number;
    reorderPoint: number;
    unit: UnitType;
  }>, createdBy: string): Promise<AlertThreshold[]> {
    const db = DatabaseConnection.getInstance();
    
    const values = [];
    const placeholders = [];
    let paramCount = 1;

    for (let i = 0; i < thresholds.length; i++) {
      const threshold = thresholds[i];
      placeholders.push(`($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5})`);
      values.push(
        branchId,
        threshold.productId,
        threshold.minimumStockLevel,
        threshold.reorderPoint,
        threshold.unit,
        createdBy
      );
      paramCount += 6;
    }

    const query = `
      INSERT INTO alert_thresholds (
        branch_id, product_id, minimum_stock_level, reorder_point, unit, created_by
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (branch_id, product_id) 
      DO UPDATE SET 
        minimum_stock_level = EXCLUDED.minimum_stock_level,
        reorder_point = EXCLUDED.reorder_point,
        unit = EXCLUDED.unit,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await db.query(query, values);
    
    return result.rows.map(row => new AlertThreshold(row));
  }

  // Calculate suggested reorder quantity using database function
  async calculateSuggestedReorderQuantity(branchId: string, productId: string, currentStock: number): Promise<number> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      SELECT calculate_suggested_reorder_quantity($1, $2, $3) as suggested_quantity
    `;

    const result = await db.query(query, [branchId, productId, currentStock]);
    
    return parseFloat(result.rows[0].suggested_quantity) || 0;
  }

  // Auto-update all thresholds
  async autoUpdateThresholds(): Promise<void> {
    const db = DatabaseConnection.getInstance();
    
    const query = `SELECT auto_update_alert_thresholds()`;
    
    await db.query(query);
    
    console.log('Auto-updated alert thresholds based on sales history');
  }

  // Delete threshold
  async delete(id: string): Promise<boolean> {
    const db = DatabaseConnection.getInstance();
    
    const query = `
      UPDATE alert_thresholds 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    const result = await db.query(query, [id]);
    
    return result.rowCount > 0;
  }

  // Get threshold analytics
  async getThresholdAnalytics(branchId?: string): Promise<{
    totalThresholds: number;
    autoCalculationEnabled: number;
    avgReorderPoint: number;
    thresholdsByCategory: Array<{
      categoryName: string;
      count: number;
      avgMinimumStock: number;
      avgReorderPoint: number;
    }>;
  }> {
    const db = DatabaseConnection.getInstance();
    
    let whereClause = 'WHERE at.is_active = true';
    const values = [];
    
    if (branchId) {
      whereClause += ' AND at.branch_id = $1';
      values.push(branchId);
    }

    const query = `
      SELECT 
        COUNT(*) as total_thresholds,
        COUNT(*) FILTER (WHERE at.use_auto_calculation = true) as auto_calculation_enabled,
        AVG(at.reorder_point) as avg_reorder_point,
        json_agg(
          json_build_object(
            'category_name', COALESCE(c.name, 'Uncategorized'),
            'count', category_stats.count,
            'avg_minimum_stock', category_stats.avg_minimum_stock,
            'avg_reorder_point', category_stats.avg_reorder_point
          )
        ) as thresholds_by_category
      FROM alert_thresholds at
      LEFT JOIN products p ON at.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN (
        SELECT 
          COALESCE(c2.name, 'Uncategorized') as category_name,
          COUNT(*) as count,
          AVG(at2.minimum_stock_level) as avg_minimum_stock,
          AVG(at2.reorder_point) as avg_reorder_point
        FROM alert_thresholds at2
        LEFT JOIN products p2 ON at2.product_id = p2.id
        LEFT JOIN categories c2 ON p2.category_id = c2.id
        ${whereClause}
        GROUP BY COALESCE(c2.name, 'Uncategorized')
      ) category_stats ON COALESCE(c.name, 'Uncategorized') = category_stats.category_name
      ${whereClause}
    `;

    const result = await db.query(query, values);
    const row = result.rows[0];
    
    return {
      totalThresholds: parseInt(row.total_thresholds) || 0,
      autoCalculationEnabled: parseInt(row.auto_calculation_enabled) || 0,
      avgReorderPoint: parseFloat(row.avg_reorder_point) || 0,
      thresholdsByCategory: row.thresholds_by_category || []
    };
  }

  // Helper method to convert camelCase to snake_case
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export default AlertThreshold;