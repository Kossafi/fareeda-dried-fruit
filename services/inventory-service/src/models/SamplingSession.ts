import { BaseModel } from './BaseModel';
import DatabaseConnection from '../database/connection';
import { SamplingSession as ISamplingSession, SamplingStatus, TrafficLevel } from '@dried-fruits/types';

export class SamplingSession extends BaseModel implements ISamplingSession {
  public sessionNumber!: string;
  public branchId!: string;
  public conductedBy!: string;
  public sessionDate!: Date;
  public sessionTime!: string;
  public customerCount!: number;
  public customerFeedback?: string;
  public weatherCondition?: string;
  public footTrafficLevel?: TrafficLevel;
  public totalWeightGram!: number;
  public totalCost!: number;
  public totalItems!: number;
  public status!: SamplingStatus;
  public requiresApproval!: boolean;
  public approvedBy?: string;
  public approvedAt?: Date;
  public approvalNotes?: string;
  public completedAt?: Date;

  protected tableName = 'sampling_sessions';

  constructor(data?: Partial<ISamplingSession>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  // Create new sampling session
  async create(sessionData: {
    branchId: string;
    conductedBy: string;
    customerCount?: number;
    customerFeedback?: string;
    weatherCondition?: string;
    footTrafficLevel?: TrafficLevel;
  }): Promise<SamplingSession> {
    const db = DatabaseConnection.getInstance();

    const query = `
      INSERT INTO sampling_sessions (
        branch_id, conducted_by, customer_count, customer_feedback,
        weather_condition, foot_traffic_level
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      sessionData.branchId,
      sessionData.conductedBy,
      sessionData.customerCount || 1,
      sessionData.customerFeedback || null,
      sessionData.weatherCondition || null,
      sessionData.footTrafficLevel || null
    ];

    const result = await db.query(query, values);
    const session = new SamplingSession(result.rows[0]);

    console.log(`Sampling session created: ${session.sessionNumber}`);
    
    return session;
  }

  // Complete sampling session
  async complete(id: string): Promise<SamplingSession> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE sampling_sessions 
      SET 
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'active'
      RETURNING *
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('Session not found or already completed');
    }

    const session = new SamplingSession(result.rows[0]);

    // Update daily summary
    await this.updateDailySummary(session.branchId, session.sessionDate);

    return session;
  }

  // Cancel sampling session
  async cancel(id: string, reason?: string): Promise<SamplingSession> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE sampling_sessions 
      SET 
        status = 'cancelled',
        approval_notes = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status IN ('active', 'pending_approval')
      RETURNING *
    `;

    const result = await db.query(query, [id, reason || 'Session cancelled']);

    if (result.rows.length === 0) {
      throw new Error('Session not found or cannot be cancelled');
    }

    return new SamplingSession(result.rows[0]);
  }

  // Request approval for session
  async requestApproval(id: string): Promise<SamplingSession> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE sampling_sessions 
      SET 
        status = 'pending_approval',
        requires_approval = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'active'
      RETURNING *
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('Session not found or cannot request approval');
    }

    return new SamplingSession(result.rows[0]);
  }

  // Approve session
  async approve(id: string, approvedBy: string, notes?: string): Promise<SamplingSession> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE sampling_sessions 
      SET 
        status = 'completed',
        approved_by = $2,
        approved_at = CURRENT_TIMESTAMP,
        approval_notes = $3,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'pending_approval'
      RETURNING *
    `;

    const result = await db.query(query, [id, approvedBy, notes || null]);

    if (result.rows.length === 0) {
      throw new Error('Session not found or not pending approval');
    }

    const session = new SamplingSession(result.rows[0]);

    // Update daily summary
    await this.updateDailySummary(session.branchId, session.sessionDate);

    return session;
  }

  // Reject session approval
  async reject(id: string, rejectedBy: string, reason: string): Promise<SamplingSession> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE sampling_sessions 
      SET 
        status = 'cancelled',
        approved_by = $2,
        approved_at = CURRENT_TIMESTAMP,
        approval_notes = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'pending_approval'
      RETURNING *
    `;

    const result = await db.query(query, [id, rejectedBy, reason]);

    if (result.rows.length === 0) {
      throw new Error('Session not found or not pending approval');
    }

    return new SamplingSession(result.rows[0]);
  }

  // Get session by ID with details
  async getById(id: string): Promise<SamplingSession | null> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT 
        ss.*,
        b.name as branch_name,
        u.username as conducted_by_name,
        ap.username as approved_by_name
      FROM sampling_sessions ss
      JOIN branches b ON ss.branch_id = b.id
      JOIN users u ON ss.conducted_by = u.id
      LEFT JOIN users ap ON ss.approved_by = ap.id
      WHERE ss.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new SamplingSession(result.rows[0]);
  }

  // Get active sessions for branch
  async getActiveSessionsForBranch(branchId: string): Promise<SamplingSession[]> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT 
        ss.*,
        b.name as branch_name,
        u.username as conducted_by_name
      FROM sampling_sessions ss
      JOIN branches b ON ss.branch_id = b.id
      JOIN users u ON ss.conducted_by = u.id
      WHERE ss.branch_id = $1 
      AND ss.status = 'active'
      ORDER BY ss.created_at DESC
    `;

    const result = await db.query(query, [branchId]);
    return result.rows.map(row => new SamplingSession(row));
  }

  // Get daily sessions for branch
  async getDailySessionsForBranch(branchId: string, date: Date): Promise<SamplingSession[]> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT 
        ss.*,
        b.name as branch_name,
        u.username as conducted_by_name,
        ap.username as approved_by_name
      FROM sampling_sessions ss
      JOIN branches b ON ss.branch_id = b.id
      JOIN users u ON ss.conducted_by = u.id
      LEFT JOIN users ap ON ss.approved_by = ap.id
      WHERE ss.branch_id = $1 
      AND ss.session_date = $2
      ORDER BY ss.session_time DESC
    `;

    const result = await db.query(query, [branchId, date]);
    return result.rows.map(row => new SamplingSession(row));
  }

  // Get pending approval sessions
  async getPendingApprovalSessions(branchId?: string): Promise<SamplingSession[]> {
    const db = DatabaseConnection.getInstance();

    let whereClause = "WHERE ss.status = 'pending_approval'";
    const values = [];

    if (branchId) {
      whereClause += ' AND ss.branch_id = $1';
      values.push(branchId);
    }

    const query = `
      SELECT 
        ss.*,
        b.name as branch_name,
        u.username as conducted_by_name
      FROM sampling_sessions ss
      JOIN branches b ON ss.branch_id = b.id
      JOIN users u ON ss.conducted_by = u.id
      ${whereClause}
      ORDER BY ss.created_at ASC
    `;

    const result = await db.query(query, values);
    return result.rows.map(row => new SamplingSession(row));
  }

  // Get sessions with filters
  async getSessionsWithFilters(filters: {
    branchId?: string;
    conductedBy?: string;
    status?: SamplingStatus;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ sessions: SamplingSession[]; total: number }> {
    const db = DatabaseConnection.getInstance();

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.branchId) {
      whereClause += ` AND ss.branch_id = $${paramCount}`;
      values.push(filters.branchId);
      paramCount++;
    }

    if (filters.conductedBy) {
      whereClause += ` AND ss.conducted_by = $${paramCount}`;
      values.push(filters.conductedBy);
      paramCount++;
    }

    if (filters.status) {
      whereClause += ` AND ss.status = $${paramCount}`;
      values.push(filters.status);
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

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sampling_sessions ss
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Get sessions with pagination
    let limitClause = '';
    if (filters.limit) {
      limitClause += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
      paramCount++;

      if (filters.offset) {
        limitClause += ` OFFSET $${paramCount}`;
        values.push(filters.offset);
        paramCount++;
      }
    }

    const query = `
      SELECT 
        ss.*,
        b.name as branch_name,
        u.username as conducted_by_name,
        ap.username as approved_by_name
      FROM sampling_sessions ss
      JOIN branches b ON ss.branch_id = b.id
      JOIN users u ON ss.conducted_by = u.id
      LEFT JOIN users ap ON ss.approved_by = ap.id
      ${whereClause}
      ORDER BY ss.session_date DESC, ss.session_time DESC
      ${limitClause}
    `;

    const result = await db.query(query, values);
    const sessions = result.rows.map(row => new SamplingSession(row));

    return { sessions, total };
  }

  // Update session details
  async updateSessionDetails(id: string, updateData: {
    customerCount?: number;
    customerFeedback?: string;
    weatherCondition?: string;
    footTrafficLevel?: TrafficLevel;
  }): Promise<SamplingSession> {
    const db = DatabaseConnection.getInstance();

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
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
      UPDATE sampling_sessions 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount} AND status = 'active'
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Session not found or cannot be updated');
    }

    return new SamplingSession(result.rows[0]);
  }

  // Get session statistics
  async getSessionStatistics(branchId?: string, dateFrom?: Date, dateTo?: Date): Promise<{
    totalSessions: number;
    completedSessions: number;
    pendingApproval: number;
    totalWeight: number;
    totalCost: number;
    averageCustomersPerSession: number;
    conversionRate: number;
    topConductors: Array<{
      conductorId: string;
      conductorName: string;
      sessionCount: number;
      totalWeight: number;
      conversionRate: number;
    }>;
  }> {
    const db = DatabaseConnection.getInstance();

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (branchId) {
      whereClause += ` AND ss.branch_id = $${paramCount}`;
      values.push(branchId);
      paramCount++;
    }

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
          COUNT(*) as total_sessions,
          COUNT(*) FILTER (WHERE ss.status = 'completed') as completed_sessions,
          COUNT(*) FILTER (WHERE ss.status = 'pending_approval') as pending_approval,
          COALESCE(SUM(ss.total_weight_gram), 0) as total_weight,
          COALESCE(SUM(ss.total_cost), 0) as total_cost,
          COALESCE(AVG(ss.customer_count), 0) as avg_customers
        FROM sampling_sessions ss
        ${whereClause}
      ),
      conversion_stats AS (
        SELECT 
          COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true) as conversions,
          COUNT(*) as total_samples
        FROM sampling_sessions ss
        LEFT JOIN sampling_records sr ON ss.id = sr.sampling_session_id
        ${whereClause}
        AND ss.status = 'completed'
      ),
      conductor_stats AS (
        SELECT 
          ss.conducted_by,
          u.username as conductor_name,
          COUNT(DISTINCT ss.id) as session_count,
          COALESCE(SUM(ss.total_weight_gram), 0) as total_weight,
          COALESCE(
            (COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true)::DECIMAL / 
             NULLIF(COUNT(sr.id), 0) * 100), 0
          ) as conversion_rate
        FROM sampling_sessions ss
        JOIN users u ON ss.conducted_by = u.id
        LEFT JOIN sampling_records sr ON ss.id = sr.sampling_session_id
        ${whereClause}
        AND ss.status = 'completed'
        GROUP BY ss.conducted_by, u.username
        ORDER BY session_count DESC
        LIMIT 10
      )
      SELECT 
        ss.*,
        cs.conversions,
        cs.total_samples,
        json_agg(
          json_build_object(
            'conductor_id', cs2.conducted_by,
            'conductor_name', cs2.conductor_name,
            'session_count', cs2.session_count,
            'total_weight', cs2.total_weight,
            'conversion_rate', cs2.conversion_rate
          ) ORDER BY cs2.session_count DESC
        ) FILTER (WHERE cs2.conducted_by IS NOT NULL) as top_conductors
      FROM session_stats ss
      CROSS JOIN conversion_stats cs
      LEFT JOIN conductor_stats cs2 ON true
      GROUP BY ss.total_sessions, ss.completed_sessions, ss.pending_approval, 
               ss.total_weight, ss.total_cost, ss.avg_customers, 
               cs.conversions, cs.total_samples
    `;

    const result = await db.query(query, values);
    const row = result.rows[0] || {};

    return {
      totalSessions: parseInt(row.total_sessions) || 0,
      completedSessions: parseInt(row.completed_sessions) || 0,
      pendingApproval: parseInt(row.pending_approval) || 0,
      totalWeight: parseFloat(row.total_weight) || 0,
      totalCost: parseFloat(row.total_cost) || 0,
      averageCustomersPerSession: parseFloat(row.avg_customers) || 0,
      conversionRate: row.total_samples > 0 ? 
        (parseInt(row.conversions) / parseInt(row.total_samples) * 100) : 0,
      topConductors: row.top_conductors || []
    };
  }

  // Update daily summary
  private async updateDailySummary(branchId: string, date: Date): Promise<void> {
    const db = DatabaseConnection.getInstance();
    
    const query = `SELECT update_daily_sampling_summary($1, NULL, $2)`;
    await db.query(query, [branchId, date]);
  }

  // Helper method to convert camelCase to snake_case
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export default SamplingSession;