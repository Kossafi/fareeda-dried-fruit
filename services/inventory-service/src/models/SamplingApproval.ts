import { BaseModel } from './BaseModel';
import DatabaseConnection from '../database/connection';
import { SamplingApproval as ISamplingApproval, ApprovalStatus } from '@dried-fruits/types';

export class SamplingApproval extends BaseModel implements ISamplingApproval {
  public branchId!: string;
  public productId!: string;
  public requestedBy!: string;
  public requestDate!: Date;
  public requestedWeightGram!: number;
  public reasonForExcess!: string;
  public expectedCustomerCount?: number;
  public specialOccasion?: string;
  public currentDailyUsageGram!: number;
  public dailyLimitGram!: number;
  public remainingBudget?: number;
  public status!: ApprovalStatus;
  public approvedBy?: string;
  public approvedAt?: Date;
  public approvalNotes?: string;
  public approvedWeightGram?: number;
  public usedWeightGram!: number;
  public expiresAt!: Date;

  protected tableName = 'sampling_approvals';

  constructor(data?: Partial<ISamplingApproval>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  // Create new approval request
  async create(requestData: {
    branchId: string;
    productId: string;
    requestedBy: string;
    requestedWeightGram: number;
    reasonForExcess: string;
    expectedCustomerCount?: number;
    specialOccasion?: string;
  }): Promise<SamplingApproval> {
    const db = DatabaseConnection.getInstance();

    // Get current daily usage and limits
    const usageData = await this.getCurrentUsageAndLimits(
      requestData.branchId, 
      requestData.productId, 
      new Date()
    );

    const query = `
      INSERT INTO sampling_approvals (
        branch_id, product_id, requested_by, requested_weight_gram,
        reason_for_excess, expected_customer_count, special_occasion,
        current_daily_usage_gram, daily_limit_gram, remaining_budget
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      requestData.branchId,
      requestData.productId,
      requestData.requestedBy,
      requestData.requestedWeightGram,
      requestData.reasonForExcess,
      requestData.expectedCustomerCount || null,
      requestData.specialOccasion || null,
      usageData.currentUsage,
      usageData.dailyLimit,
      usageData.remainingBudget || null
    ];

    const result = await db.query(query, values);
    const approval = new SamplingApproval(result.rows[0]);

    // Send notification to managers
    await this.sendApprovalNotification(approval);

    console.log(`Sampling approval request created: ${approval.id}`);
    
    return approval;
  }

  // Approve request
  async approve(
    id: string, 
    approvedBy: string, 
    approvedWeightGram?: number, 
    notes?: string
  ): Promise<SamplingApproval> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE sampling_approvals 
      SET 
        status = 'approved',
        approved_by = $2,
        approved_at = CURRENT_TIMESTAMP,
        approved_weight_gram = $3,
        approval_notes = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `;

    const values = [
      id,
      approvedBy,
      approvedWeightGram || null,
      notes || null
    ];

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Approval request not found or already processed');
    }

    const approval = new SamplingApproval(result.rows[0]);

    // Send approval notification to requester
    await this.sendApprovalResultNotification(approval, true);

    return approval;
  }

  // Reject request
  async reject(id: string, rejectedBy: string, reason: string): Promise<SamplingApproval> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE sampling_approvals 
      SET 
        status = 'rejected',
        approved_by = $2,
        approved_at = CURRENT_TIMESTAMP,
        approval_notes = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `;

    const values = [id, rejectedBy, reason];

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Approval request not found or already processed');
    }

    const approval = new SamplingApproval(result.rows[0]);

    // Send rejection notification to requester
    await this.sendApprovalResultNotification(approval, false);

    return approval;
  }

  // Use approved weight
  async useApprovedWeight(id: string, usedWeight: number): Promise<SamplingApproval> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE sampling_approvals 
      SET 
        used_weight_gram = used_weight_gram + $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      AND status = 'approved'
      AND expires_at > CURRENT_TIMESTAMP
      AND (approved_weight_gram IS NULL OR used_weight_gram + $2 <= approved_weight_gram)
      RETURNING *
    `;

    const result = await db.query(query, [id, usedWeight]);

    if (result.rows.length === 0) {
      throw new Error('Approval not found, expired, or insufficient approved weight remaining');
    }

    return new SamplingApproval(result.rows[0]);
  }

  // Get current usage and limits
  private async getCurrentUsageAndLimits(
    branchId: string, 
    productId: string, 
    date: Date
  ): Promise<{
    currentUsage: number;
    dailyLimit: number;
    remainingBudget?: number;
  }> {
    const db = DatabaseConnection.getInstance();

    // Get current daily usage
    const usageQuery = `
      SELECT COALESCE(SUM(sr.weight_gram), 0) as current_usage
      FROM sampling_records sr
      JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
      WHERE ss.branch_id = $1
      AND sr.product_id = $2
      AND ss.session_date = $3
      AND ss.status IN ('active', 'completed')
    `;

    const usageResult = await db.query(usageQuery, [branchId, productId, date]);
    const currentUsage = parseFloat(usageResult.rows[0].current_usage) || 0;

    // Get daily limit from policy
    const policyQuery = `
      SELECT daily_limit_gram, monthly_budget, cost_per_gram
      FROM sampling_policies
      WHERE branch_id = $1
      AND (product_id = $2 OR product_id IS NULL)
      AND is_active = true
      ORDER BY product_id NULLS LAST
      LIMIT 1
    `;

    const policyResult = await db.query(policyQuery, [branchId, productId]);
    
    if (policyResult.rows.length === 0) {
      throw new Error('No sampling policy found for this branch/product');
    }

    const policy = policyResult.rows[0];
    const dailyLimit = parseFloat(policy.daily_limit_gram);
    
    // Calculate remaining budget (if monthly budget is set)
    let remainingBudget = null;
    if (policy.monthly_budget) {
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const budgetQuery = `
        SELECT COALESCE(SUM(sr.total_cost), 0) as monthly_spending
        FROM sampling_records sr
        JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
        WHERE ss.branch_id = $1
        AND sr.product_id = $2
        AND ss.session_date BETWEEN $3 AND $4
        AND ss.status = 'completed'
      `;

      const budgetResult = await db.query(budgetQuery, [branchId, productId, monthStart, monthEnd]);
      const monthlySpending = parseFloat(budgetResult.rows[0].monthly_spending) || 0;
      remainingBudget = parseFloat(policy.monthly_budget) - monthlySpending;
    }

    return {
      currentUsage,
      dailyLimit,
      remainingBudget
    };
  }

  // Get pending approvals
  async getPendingApprovals(branchId?: string): Promise<SamplingApproval[]> {
    const db = DatabaseConnection.getInstance();

    let whereClause = "WHERE sa.status = 'pending' AND sa.expires_at > CURRENT_TIMESTAMP";
    const values = [];

    if (branchId) {
      whereClause += ' AND sa.branch_id = $1';
      values.push(branchId);
    }

    const query = `
      SELECT 
        sa.*,
        b.name as branch_name,
        p.name as product_name,
        p.sku as product_sku,
        u.username as requested_by_name,
        ap.username as approved_by_name
      FROM sampling_approvals sa
      JOIN branches b ON sa.branch_id = b.id
      JOIN products p ON sa.product_id = p.id
      JOIN users u ON sa.requested_by = u.id
      LEFT JOIN users ap ON sa.approved_by = ap.id
      ${whereClause}
      ORDER BY sa.created_at ASC
    `;

    const result = await db.query(query, values);
    return result.rows.map(row => new SamplingApproval(row));
  }

  // Get approvals by requester
  async getByRequester(requestedBy: string, status?: ApprovalStatus): Promise<SamplingApproval[]> {
    const db = DatabaseConnection.getInstance();

    let whereClause = 'WHERE sa.requested_by = $1';
    const values = [requestedBy];

    if (status) {
      whereClause += ' AND sa.status = $2';
      values.push(status);
    }

    const query = `
      SELECT 
        sa.*,
        b.name as branch_name,
        p.name as product_name,
        p.sku as product_sku,
        ap.username as approved_by_name
      FROM sampling_approvals sa
      JOIN branches b ON sa.branch_id = b.id
      JOIN products p ON sa.product_id = p.id
      LEFT JOIN users ap ON sa.approved_by = ap.id
      ${whereClause}
      ORDER BY sa.created_at DESC
    `;

    const result = await db.query(query, values);
    return result.rows.map(row => new SamplingApproval(row));
  }

  // Get active approvals for sampling session
  async getActiveApprovalsForSampling(
    branchId: string, 
    productId: string, 
    date: Date
  ): Promise<SamplingApproval[]> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT sa.*
      FROM sampling_approvals sa
      WHERE sa.branch_id = $1
      AND sa.product_id = $2
      AND sa.request_date = $3
      AND sa.status = 'approved'
      AND sa.expires_at > CURRENT_TIMESTAMP
      AND (sa.approved_weight_gram IS NULL OR sa.used_weight_gram < sa.approved_weight_gram)
      ORDER BY sa.approved_at ASC
    `;

    const result = await db.query(query, [branchId, productId, date]);
    return result.rows.map(row => new SamplingApproval(row));
  }

  // Expire old pending requests
  async expireOldRequests(): Promise<number> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE sampling_approvals 
      SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'pending' 
      AND expires_at <= CURRENT_TIMESTAMP
    `;

    const result = await db.query(query);
    return result.rowCount;
  }

  // Get approval statistics
  async getApprovalStatistics(branchId?: string, dateFrom?: Date, dateTo?: Date): Promise<{
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    expiredRequests: number;
    averageApprovalTime: number; // in hours
    totalApprovedWeight: number;
    totalUsedWeight: number;
    topRequesters: Array<{
      requesterId: string;
      requesterName: string;
      requestCount: number;
      approvalRate: number;
    }>;
    approvalReasons: Array<{
      reason: string;
      count: number;
    }>;
  }> {
    const db = DatabaseConnection.getInstance();

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (branchId) {
      whereClause += ` AND sa.branch_id = $${paramCount}`;
      values.push(branchId);
      paramCount++;
    }

    if (dateFrom) {
      whereClause += ` AND sa.request_date >= $${paramCount}`;
      values.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      whereClause += ` AND sa.request_date <= $${paramCount}`;
      values.push(dateTo);
      paramCount++;
    }

    const query = `
      WITH approval_stats AS (
        SELECT 
          COUNT(*) as total_requests,
          COUNT(*) FILTER (WHERE sa.status = 'pending') as pending_requests,
          COUNT(*) FILTER (WHERE sa.status = 'approved') as approved_requests,
          COUNT(*) FILTER (WHERE sa.status = 'rejected') as rejected_requests,
          COUNT(*) FILTER (WHERE sa.status = 'expired') as expired_requests,
          COALESCE(
            AVG(
              EXTRACT(EPOCH FROM (sa.approved_at - sa.created_at))/3600
            ) FILTER (WHERE sa.approved_at IS NOT NULL), 0
          ) as avg_approval_hours,
          COALESCE(SUM(sa.approved_weight_gram), 0) as total_approved_weight,
          COALESCE(SUM(sa.used_weight_gram), 0) as total_used_weight
        FROM sampling_approvals sa
        ${whereClause}
      ),
      requester_stats AS (
        SELECT 
          sa.requested_by,
          u.username as requester_name,
          COUNT(*) as request_count,
          COALESCE(
            (COUNT(*) FILTER (WHERE sa.status = 'approved')::DECIMAL / 
             NULLIF(COUNT(*) FILTER (WHERE sa.status IN ('approved', 'rejected')), 0) * 100), 0
          ) as approval_rate
        FROM sampling_approvals sa
        JOIN users u ON sa.requested_by = u.id
        ${whereClause}
        GROUP BY sa.requested_by, u.username
        ORDER BY request_count DESC
        LIMIT 10
      ),
      reason_stats AS (
        SELECT 
          sa.reason_for_excess,
          COUNT(*) as count
        FROM sampling_approvals sa
        ${whereClause}
        GROUP BY sa.reason_for_excess
        ORDER BY count DESC
        LIMIT 10
      )
      SELECT 
        ast.*,
        json_agg(
          DISTINCT jsonb_build_object(
            'requester_id', rs.requested_by,
            'requester_name', rs.requester_name,
            'request_count', rs.request_count,
            'approval_rate', rs.approval_rate
          ) ORDER BY rs.request_count DESC
        ) FILTER (WHERE rs.requested_by IS NOT NULL) as top_requesters,
        json_agg(
          DISTINCT jsonb_build_object(
            'reason', reas.reason_for_excess,
            'count', reas.count
          ) ORDER BY reas.count DESC
        ) FILTER (WHERE reas.reason_for_excess IS NOT NULL) as approval_reasons
      FROM approval_stats ast
      LEFT JOIN requester_stats rs ON true
      LEFT JOIN reason_stats reas ON true
      GROUP BY ast.total_requests, ast.pending_requests, ast.approved_requests, 
               ast.rejected_requests, ast.expired_requests, ast.avg_approval_hours,
               ast.total_approved_weight, ast.total_used_weight
    `;

    const result = await db.query(query, values);
    const row = result.rows[0] || {};

    return {
      totalRequests: parseInt(row.total_requests) || 0,
      pendingRequests: parseInt(row.pending_requests) || 0,
      approvedRequests: parseInt(row.approved_requests) || 0,
      rejectedRequests: parseInt(row.rejected_requests) || 0,
      expiredRequests: parseInt(row.expired_requests) || 0,
      averageApprovalTime: parseFloat(row.avg_approval_hours) || 0,
      totalApprovedWeight: parseFloat(row.total_approved_weight) || 0,
      totalUsedWeight: parseFloat(row.total_used_weight) || 0,
      topRequesters: row.top_requesters || [],
      approvalReasons: row.approval_reasons || []
    };
  }

  // Send approval notification to managers
  private async sendApprovalNotification(approval: SamplingApproval): Promise<void> {
    try {
      // This would integrate with the notification system
      // For now, just log the event
      console.log(`Approval notification sent for request ${approval.id}`);
      
      // TODO: Integrate with notification service
      // await notificationService.sendApprovalRequest(approval);
      
    } catch (error) {
      console.error('Failed to send approval notification:', error);
    }
  }

  // Send approval result notification
  private async sendApprovalResultNotification(approval: SamplingApproval, isApproved: boolean): Promise<void> {
    try {
      console.log(`Approval result notification sent: ${isApproved ? 'APPROVED' : 'REJECTED'} for request ${approval.id}`);
      
      // TODO: Integrate with notification service
      // await notificationService.sendApprovalResult(approval, isApproved);
      
    } catch (error) {
      console.error('Failed to send approval result notification:', error);
    }
  }
}

export default SamplingApproval;