import { BaseModel } from './BaseModel';
import DatabaseConnection from '../database/connection';
import { SamplingPolicy as ISamplingPolicy, UnitType } from '@dried-fruits/types';

export class SamplingPolicy extends BaseModel implements ISamplingPolicy {
  public branchId!: string;
  public productId?: string;
  public categoryId?: string;
  public dailyLimitGram!: number;
  public maxPerSessionGram!: number;
  public costPerGram!: number;
  public monthlyBudget?: number;
  public allowedHoursStart!: string;
  public allowedHoursEnd!: string;
  public weekendEnabled!: boolean;
  public requiresApprovalAboveGram!: number;
  public autoApproveBelowGram!: number;
  public isActive!: boolean;
  public effectiveFrom!: Date;
  public effectiveUntil?: Date;
  public createdBy!: string;

  protected tableName = 'sampling_policies';

  constructor(data?: Partial<ISamplingPolicy>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  // Create new sampling policy
  async create(policyData: {
    branchId: string;
    productId?: string;
    categoryId?: string;
    dailyLimitGram: number;
    maxPerSessionGram: number;
    costPerGram: number;
    monthlyBudget?: number;
    allowedHoursStart?: string;
    allowedHoursEnd?: string;
    weekendEnabled?: boolean;
    requiresApprovalAboveGram?: number;
    autoApproveBelowGram?: number;
    effectiveFrom?: Date;
    effectiveUntil?: Date;
    createdBy: string;
  }): Promise<SamplingPolicy> {
    const db = DatabaseConnection.getInstance();

    // Validate policy data
    this.validatePolicyData(policyData);

    const query = `
      INSERT INTO sampling_policies (
        branch_id, product_id, category_id, daily_limit_gram, max_per_session_gram,
        cost_per_gram, monthly_budget, allowed_hours_start, allowed_hours_end,
        weekend_enabled, requires_approval_above_gram, auto_approve_below_gram,
        effective_from, effective_until, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const values = [
      policyData.branchId,
      policyData.productId || null,
      policyData.categoryId || null,
      policyData.dailyLimitGram,
      policyData.maxPerSessionGram,
      policyData.costPerGram,
      policyData.monthlyBudget || null,
      policyData.allowedHoursStart || '09:00:00',
      policyData.allowedHoursEnd || '21:00:00',
      policyData.weekendEnabled ?? true,
      policyData.requiresApprovalAboveGram || 50.0,
      policyData.autoApproveBelowGram || 20.0,
      policyData.effectiveFrom || new Date(),
      policyData.effectiveUntil || null,
      policyData.createdBy
    ];

    const result = await db.query(query, values);
    const policy = new SamplingPolicy(result.rows[0]);

    console.log(`Sampling policy created for branch ${policyData.branchId}`);
    
    return policy;
  }

  // Get policy for branch and product
  async getPolicyForBranchProduct(branchId: string, productId?: string): Promise<SamplingPolicy | null> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT sp.*, b.name as branch_name, p.name as product_name, c.name as category_name
      FROM sampling_policies sp
      JOIN branches b ON sp.branch_id = b.id
      LEFT JOIN products p ON sp.product_id = p.id
      LEFT JOIN categories c ON sp.category_id = c.id
      WHERE sp.branch_id = $1
      AND (sp.product_id = $2 OR sp.product_id IS NULL)
      AND sp.is_active = true
      AND (sp.effective_until IS NULL OR sp.effective_until >= CURRENT_DATE)
      ORDER BY sp.product_id NULLS LAST
      LIMIT 1
    `;

    const result = await db.query(query, [branchId, productId || null]);

    if (result.rows.length === 0) {
      return null;
    }

    return new SamplingPolicy(result.rows[0]);
  }

  // Check sampling limits using database function
  async checkSamplingLimits(
    branchId: string, 
    productId: string, 
    weightGram: number, 
    date?: Date
  ): Promise<{
    allowed: boolean;
    reason?: string;
    dailyLimit?: number;
    currentUsage?: number;
    remaining?: number;
    requiresApproval?: boolean;
    sessionLimit?: number;
    allowedHours?: string;
  }> {
    const db = DatabaseConnection.getInstance();

    const query = `SELECT check_sampling_limits($1, $2, $3, $4) as result`;
    const values = [branchId, productId, weightGram, date || new Date()];

    const result = await db.query(query, values);
    return result.rows[0].result;
  }

  // Update sampling policy
  async update(id: string, updateData: Partial<ISamplingPolicy>): Promise<SamplingPolicy> {
    const db = DatabaseConnection.getInstance();

    // Validate update data
    if (updateData.dailyLimitGram || updateData.maxPerSessionGram) {
      this.validatePolicyData(updateData as any);
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

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
      UPDATE sampling_policies 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Sampling policy not found');
    }

    return new SamplingPolicy(result.rows[0]);
  }

  // Get policies by branch
  async getPoliciesByBranch(branchId: string): Promise<SamplingPolicy[]> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT sp.*, b.name as branch_name, p.name as product_name, c.name as category_name
      FROM sampling_policies sp
      JOIN branches b ON sp.branch_id = b.id
      LEFT JOIN products p ON sp.product_id = p.id
      LEFT JOIN categories c ON sp.category_id = c.id
      WHERE sp.branch_id = $1
      AND sp.is_active = true
      ORDER BY p.name NULLS LAST
    `;

    const result = await db.query(query, [branchId]);
    return result.rows.map(row => new SamplingPolicy(row));
  }

  // Get all active policies
  async getAllActivePolicies(): Promise<SamplingPolicy[]> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT sp.*, b.name as branch_name, p.name as product_name, c.name as category_name
      FROM sampling_policies sp
      JOIN branches b ON sp.branch_id = b.id
      LEFT JOIN products p ON sp.product_id = p.id
      LEFT JOIN categories c ON sp.category_id = c.id
      WHERE sp.is_active = true
      AND (sp.effective_until IS NULL OR sp.effective_until >= CURRENT_DATE)
      ORDER BY b.name, p.name NULLS LAST
    `;

    const result = await db.query(query);
    return result.rows.map(row => new SamplingPolicy(row));
  }

  // Bulk create policies for branch
  async bulkCreateForBranch(
    branchId: string, 
    policies: Array<{
      productId?: string;
      dailyLimitGram: number;
      maxPerSessionGram: number;
      costPerGram: number;
    }>,
    createdBy: string
  ): Promise<SamplingPolicy[]> {
    const db = DatabaseConnection.getInstance();

    const values = [];
    const placeholders = [];
    let paramCount = 1;

    for (let i = 0; i < policies.length; i++) {
      const policy = policies[i];
      placeholders.push(`($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5})`);
      values.push(
        branchId,
        policy.productId || null,
        policy.dailyLimitGram,
        policy.maxPerSessionGram,
        policy.costPerGram,
        createdBy
      );
      paramCount += 6;
    }

    const query = `
      INSERT INTO sampling_policies (
        branch_id, product_id, daily_limit_gram, max_per_session_gram, cost_per_gram, created_by
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (branch_id, product_id) 
      DO UPDATE SET 
        daily_limit_gram = EXCLUDED.daily_limit_gram,
        max_per_session_gram = EXCLUDED.max_per_session_gram,
        cost_per_gram = EXCLUDED.cost_per_gram,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows.map(row => new SamplingPolicy(row));
  }

  // Deactivate policy
  async deactivate(id: string): Promise<SamplingPolicy> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE sampling_policies 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('Sampling policy not found');
    }

    return new SamplingPolicy(result.rows[0]);
  }

  // Get policy usage statistics
  async getPolicyUsageStats(branchId: string, dateFrom?: Date, dateTo?: Date): Promise<{
    totalSessions: number;
    totalWeight: number;
    totalCost: number;
    averageSessionWeight: number;
    complianceRate: number;
    topProducts: Array<{
      productId: string;
      productName: string;
      totalWeight: number;
      totalCost: number;
      sessionCount: number;
    }>;
  }> {
    const db = DatabaseConnection.getInstance();

    let whereClause = 'WHERE ss.branch_id = $1';
    const values = [branchId];
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
      WITH session_stats AS (
        SELECT 
          COUNT(DISTINCT ss.id) as total_sessions,
          COALESCE(SUM(sr.weight_gram), 0) as total_weight,
          COALESCE(SUM(sr.total_cost), 0) as total_cost,
          COALESCE(AVG(ss.total_weight_gram), 0) as avg_session_weight
        FROM sampling_sessions ss
        LEFT JOIN sampling_records sr ON ss.id = sr.sampling_session_id
        ${whereClause}
        AND ss.status = 'completed'
      ),
      product_stats AS (
        SELECT 
          sr.product_id,
          p.name as product_name,
          SUM(sr.weight_gram) as total_weight,
          SUM(sr.total_cost) as total_cost,
          COUNT(DISTINCT ss.id) as session_count
        FROM sampling_sessions ss
        JOIN sampling_records sr ON ss.id = sr.sampling_session_id
        JOIN products p ON sr.product_id = p.id
        ${whereClause}
        AND ss.status = 'completed'
        GROUP BY sr.product_id, p.name
        ORDER BY SUM(sr.weight_gram) DESC
        LIMIT 10
      )
      SELECT 
        ss.*,
        json_agg(
          json_build_object(
            'product_id', ps.product_id,
            'product_name', ps.product_name,
            'total_weight', ps.total_weight,
            'total_cost', ps.total_cost,
            'session_count', ps.session_count
          ) ORDER BY ps.total_weight DESC
        ) FILTER (WHERE ps.product_id IS NOT NULL) as top_products
      FROM session_stats ss
      LEFT JOIN product_stats ps ON true
      GROUP BY ss.total_sessions, ss.total_weight, ss.total_cost, ss.avg_session_weight
    `;

    const result = await db.query(query, values);
    const row = result.rows[0] || {};

    return {
      totalSessions: parseInt(row.total_sessions) || 0,
      totalWeight: parseFloat(row.total_weight) || 0,
      totalCost: parseFloat(row.total_cost) || 0,
      averageSessionWeight: parseFloat(row.avg_session_weight) || 0,
      complianceRate: 95.0, // TODO: Calculate actual compliance rate
      topProducts: row.top_products || []
    };
  }

  // Validate policy data
  private validatePolicyData(data: any): void {
    if (data.dailyLimitGram <= 0) {
      throw new Error('Daily limit must be greater than 0');
    }

    if (data.maxPerSessionGram <= 0) {
      throw new Error('Max per session must be greater than 0');
    }

    if (data.maxPerSessionGram > data.dailyLimitGram) {
      throw new Error('Max per session cannot exceed daily limit');
    }

    if (data.costPerGram < 0) {
      throw new Error('Cost per gram cannot be negative');
    }

    if (data.requiresApprovalAboveGram && data.autoApproveBelowGram) {
      if (data.autoApproveBelowGram >= data.requiresApprovalAboveGram) {
        throw new Error('Auto approve threshold must be less than approval requirement threshold');
      }
    }
  }

  // Helper method to convert camelCase to snake_case
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export default SamplingPolicy;