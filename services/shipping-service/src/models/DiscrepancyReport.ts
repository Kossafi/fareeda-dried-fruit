import DatabaseConnection from '../database/connection';
import { DiscrepancyReport, DiscrepancyReportItem, DiscrepancyType, DiscrepancySeverity, DiscrepancyStatus } from '@dried-fruits/types';

export class DiscrepancyReportModel {
  private db = DatabaseConnection.getInstance();

  async create(reportData: {
    deliveryOrderId: string;
    deliveryConfirmationId?: string;
    reportedBy: string;
    discrepancyType: DiscrepancyType;
    severity?: DiscrepancySeverity;
    totalAffectedItems: number;
    totalValueImpact?: number;
    requiresInvestigation?: boolean;
  }): Promise<DiscrepancyReport> {
    const query = `
      INSERT INTO shipping.discrepancy_reports (
        delivery_order_id, delivery_confirmation_id, reported_by,
        discrepancy_type, severity, total_affected_items,
        total_value_impact, requires_investigation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      reportData.deliveryOrderId,
      reportData.deliveryConfirmationId,
      reportData.reportedBy,
      reportData.discrepancyType,
      reportData.severity || DiscrepancySeverity.MEDIUM,
      reportData.totalAffectedItems,
      reportData.totalValueImpact || 0,
      reportData.requiresInvestigation || false,
    ];

    const result = await this.db.query(query, values);
    return this.mapToDiscrepancyReport(result.rows[0]);
  }

  async findById(id: string): Promise<DiscrepancyReport | null> {
    const query = `
      SELECT dr.*, do.order_number, u.full_name as reported_by_name
      FROM shipping.discrepancy_reports dr
      JOIN shipping.delivery_orders do ON dr.delivery_order_id = do.id
      LEFT JOIN auth.users u ON dr.reported_by = u.id
      WHERE dr.id = $1
    `;

    const result = await this.db.query(query, [id]);
    if (result.rows.length === 0) {
      return null;
    }

    return {
      ...this.mapToDiscrepancyReport(result.rows[0]),
      orderNumber: result.rows[0].order_number,
      reportedByName: result.rows[0].reported_by_name,
    };
  }

  async findByDeliveryOrder(deliveryOrderId: string): Promise<DiscrepancyReport[]> {
    const query = `
      SELECT dr.*, do.order_number, u.full_name as reported_by_name
      FROM shipping.discrepancy_reports dr
      JOIN shipping.delivery_orders do ON dr.delivery_order_id = do.id
      LEFT JOIN auth.users u ON dr.reported_by = u.id
      WHERE dr.delivery_order_id = $1
      ORDER BY dr.created_at DESC
    `;

    const result = await this.db.query(query, [deliveryOrderId]);
    return result.rows.map(row => ({
      ...this.mapToDiscrepancyReport(row),
      orderNumber: row.order_number,
      reportedByName: row.reported_by_name,
    }));
  }

  async findByStatus(
    status: DiscrepancyStatus,
    severity?: DiscrepancySeverity,
    limit?: number
  ): Promise<Array<DiscrepancyReport & {
    orderNumber: string;
    reportedByName: string;
  }>> {
    let query = `
      SELECT dr.*, do.order_number, u.full_name as reported_by_name
      FROM shipping.discrepancy_reports dr
      JOIN shipping.delivery_orders do ON dr.delivery_order_id = do.id
      LEFT JOIN auth.users u ON dr.reported_by = u.id
      WHERE dr.status = $1
    `;

    const params = [status];
    let paramIndex = 2;

    if (severity) {
      query += ` AND dr.severity = $${paramIndex++}`;
      params.push(severity);
    }

    query += ` ORDER BY dr.created_at DESC`;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => ({
      ...this.mapToDiscrepancyReport(row),
      orderNumber: row.order_number,
      reportedByName: row.reported_by_name,
    }));
  }

  async findRequiringInvestigation(): Promise<Array<DiscrepancyReport & {
    orderNumber: string;
    reportedByName: string;
    daysSinceReported: number;
  }>> {
    const query = `
      SELECT dr.*, do.order_number, u.full_name as reported_by_name,
             EXTRACT(DAYS FROM (NOW() - dr.report_date)) as days_since_reported
      FROM shipping.discrepancy_reports dr
      JOIN shipping.delivery_orders do ON dr.delivery_order_id = do.id
      LEFT JOIN auth.users u ON dr.reported_by = u.id
      WHERE dr.requires_investigation = true 
        AND dr.status IN ('open', 'investigating')
      ORDER BY dr.severity DESC, dr.report_date ASC
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => ({
      ...this.mapToDiscrepancyReport(row),
      orderNumber: row.order_number,
      reportedByName: row.reported_by_name,
      daysSinceReported: parseInt(row.days_since_reported) || 0,
    }));
  }

  async updateStatus(
    id: string,
    status: DiscrepancyStatus,
    resolution?: string,
    resolvedBy?: string
  ): Promise<DiscrepancyReport> {
    const setClause = ['status = $2', 'updated_at = NOW()'];
    const params = [id, status];
    let paramIndex = 3;

    if (status === DiscrepancyStatus.RESOLVED || status === DiscrepancyStatus.CLOSED) {
      setClause.push('resolved_at = NOW()');
      if (resolvedBy) {
        setClause.push(`resolved_by = $${paramIndex++}`);
        params.push(resolvedBy);
      }
    }

    if (resolution) {
      setClause.push(`resolution = $${paramIndex++}`);
      params.push(resolution);
    }

    const query = `
      UPDATE shipping.discrepancy_reports 
      SET ${setClause.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, params);
    
    if (result.rows.length === 0) {
      throw new Error(`Discrepancy report not found: ${id}`);
    }

    return this.mapToDiscrepancyReport(result.rows[0]);
  }

  async escalate(
    id: string,
    escalatedTo: string
  ): Promise<DiscrepancyReport> {
    const query = `
      UPDATE shipping.discrepancy_reports 
      SET 
        escalated_to = $2,
        escalated_at = NOW(),
        status = 'investigating',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [id, escalatedTo]);
    
    if (result.rows.length === 0) {
      throw new Error(`Discrepancy report not found: ${id}`);
    }

    return this.mapToDiscrepancyReport(result.rows[0]);
  }

  async getDiscrepancyAnalytics(
    startDate: Date,
    endDate: Date,
    branchId?: string
  ): Promise<{
    totalReports: number;
    openReports: number;
    resolvedReports: number;
    resolutionRate: number;
    averageResolutionTime: number;
    reportsByType: Array<{
      type: DiscrepancyType;
      count: number;
      percentage: number;
    }>;
    reportsBySeverity: Array<{
      severity: DiscrepancySeverity;
      count: number;
      percentage: number;
    }>;
    totalValueImpact: number;
  }> {
    let whereClause = 'WHERE dr.report_date >= $1 AND dr.report_date <= $2';
    const params = [startDate, endDate];

    if (branchId) {
      whereClause += ' AND (do.from_branch_id = $3 OR do.to_branch_id = $3)';
      params.push(branchId);
    }

    const analyticsQuery = `
      SELECT 
        COUNT(*) as total_reports,
        COUNT(CASE WHEN dr.status IN ('open', 'investigating') THEN 1 END) as open_reports,
        COUNT(CASE WHEN dr.status IN ('resolved', 'closed') THEN 1 END) as resolved_reports,
        AVG(CASE WHEN dr.resolved_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (dr.resolved_at - dr.report_date))/3600 END) as avg_resolution_hours,
        SUM(dr.total_value_impact) as total_value_impact,
        dr.discrepancy_type,
        dr.severity,
        COUNT(*) as type_count
      FROM shipping.discrepancy_reports dr
      JOIN shipping.delivery_orders do ON dr.delivery_order_id = do.id
      ${whereClause}
      GROUP BY dr.discrepancy_type, dr.severity
    `;

    const result = await this.db.query(analyticsQuery, params);
    
    const totalReports = result.rows.reduce((sum, row) => sum + parseInt(row.type_count), 0);
    const openReports = result.rows.reduce((sum, row) => sum + parseInt(row.open_reports), 0);
    const resolvedReports = result.rows.reduce((sum, row) => sum + parseInt(row.resolved_reports), 0);
    const avgResolutionTime = result.rows.length > 0 ? parseFloat(result.rows[0].avg_resolution_hours) : 0;
    const totalValueImpact = result.rows.reduce((sum, row) => sum + parseFloat(row.total_value_impact), 0);

    // Group by type
    const typeMap = new Map<DiscrepancyType, number>();
    const severityMap = new Map<DiscrepancySeverity, number>();

    result.rows.forEach(row => {
      const type = row.discrepancy_type as DiscrepancyType;
      const severity = row.severity as DiscrepancySeverity;
      const count = parseInt(row.type_count);

      typeMap.set(type, (typeMap.get(type) || 0) + count);
      severityMap.set(severity, (severityMap.get(severity) || 0) + count);
    });

    const reportsByType = Array.from(typeMap.entries()).map(([type, count]) => ({
      type,
      count,
      percentage: totalReports > 0 ? (count / totalReports) * 100 : 0,
    }));

    const reportsBySeverity = Array.from(severityMap.entries()).map(([severity, count]) => ({
      severity,
      count,
      percentage: totalReports > 0 ? (count / totalReports) * 100 : 0,
    }));

    return {
      totalReports,
      openReports,
      resolvedReports,
      resolutionRate: totalReports > 0 ? (resolvedReports / totalReports) * 100 : 0,
      averageResolutionTime: avgResolutionTime,
      reportsByType,
      reportsBySeverity,
      totalValueImpact,
    };
  }

  async getCriticalReports(): Promise<Array<DiscrepancyReport & {
    orderNumber: string;
    reportedByName: string;
    urgencyScore: number;
  }>> {
    const query = `
      SELECT dr.*, do.order_number, u.full_name as reported_by_name,
             CASE 
               WHEN dr.severity = 'critical' THEN 100
               WHEN dr.severity = 'high' THEN 75
               WHEN dr.severity = 'medium' THEN 50
               ELSE 25
             END +
             CASE 
               WHEN EXTRACT(DAYS FROM (NOW() - dr.report_date)) > 7 THEN 20
               WHEN EXTRACT(DAYS FROM (NOW() - dr.report_date)) > 3 THEN 10
               ELSE 0
             END +
             CASE 
               WHEN dr.total_value_impact > 10000 THEN 15
               WHEN dr.total_value_impact > 5000 THEN 10
               WHEN dr.total_value_impact > 1000 THEN 5
               ELSE 0
             END as urgency_score
      FROM shipping.discrepancy_reports dr
      JOIN shipping.delivery_orders do ON dr.delivery_order_id = do.id
      LEFT JOIN auth.users u ON dr.reported_by = u.id
      WHERE dr.status IN ('open', 'investigating')
      ORDER BY urgency_score DESC, dr.report_date ASC
      LIMIT 20
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => ({
      ...this.mapToDiscrepancyReport(row),
      orderNumber: row.order_number,
      reportedByName: row.reported_by_name,
      urgencyScore: parseInt(row.urgency_score) || 0,
    }));
  }

  private mapToDiscrepancyReport(row: any): DiscrepancyReport {
    return {
      id: row.id,
      deliveryOrderId: row.delivery_order_id,
      deliveryConfirmationId: row.delivery_confirmation_id,
      reportedBy: row.reported_by,
      reportDate: row.report_date,
      discrepancyType: row.discrepancy_type,
      severity: row.severity,
      status: row.status,
      resolution: row.resolution,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      totalAffectedItems: parseInt(row.total_affected_items) || 0,
      totalValueImpact: parseFloat(row.total_value_impact) || 0,
      requiresInvestigation: row.requires_investigation,
      escalatedTo: row.escalated_to,
      escalatedAt: row.escalated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default DiscrepancyReportModel;