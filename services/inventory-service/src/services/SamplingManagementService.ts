import DatabaseConnection from '../database/connection';
import SamplingPolicy from '../models/SamplingPolicy';
import SamplingSession from '../models/SamplingSession';
import SamplingRecord from '../models/SamplingRecord';
import SamplingApproval from '../models/SamplingApproval';
import { 
  SamplingStatus, 
  ProductCondition, 
  CustomerResponse, 
  ApprovalStatus,
  TrafficLevel 
} from '@dried-fruits/types';
import logger from '../utils/logger';

export class SamplingManagementService {
  private samplingPolicy: SamplingPolicy;
  private samplingSession: SamplingSession;
  private samplingRecord: SamplingRecord;
  private samplingApproval: SamplingApproval;

  constructor() {
    this.samplingPolicy = new SamplingPolicy();
    this.samplingSession = new SamplingSession();
    this.samplingRecord = new SamplingRecord();
    this.samplingApproval = new SamplingApproval();
  }

  // Record sampling with weight validation and automatic stock deduction
  async recordSampling(samplingData: {
    sessionId?: string;
    branchId: string;
    productId: string;
    inventoryItemId?: string;
    weightGram: number;
    conductedBy: string;
    customerCount?: number;
    customerResponse?: CustomerResponse;
    resultedInPurchase?: boolean;
    purchaseAmount?: number;
    notes?: string;
    weatherCondition?: string;
    footTrafficLevel?: TrafficLevel;
  }): Promise<{
    session: SamplingSession;
    record: SamplingRecord;
    stockDeducted: boolean;
    requiresApproval: boolean;
    costCalculation: {
      unitCost: number;
      totalCost: number;
      dailyTotal: number;
      monthlyTotal: number;
    };
  }> {
    try {
      logger.info('Recording sampling', {
        branchId: samplingData.branchId,
        productId: samplingData.productId,
        weightGram: samplingData.weightGram,
        conductedBy: samplingData.conductedBy
      });

      // Validate weight format
      const weightValidation = SamplingRecord.validateWeightFormat(samplingData.weightGram);
      if (!weightValidation.valid) {
        throw new Error(weightValidation.error);
      }

      // Get or create sampling session
      let session: SamplingSession;
      if (samplingData.sessionId) {
        session = await this.samplingSession.getById(samplingData.sessionId);
        if (!session) {
          throw new Error('Sampling session not found');
        }
        if (session.status !== 'active') {
          throw new Error('Sampling session is not active');
        }
      } else {
        // Create new session
        session = await this.samplingSession.create({
          branchId: samplingData.branchId,
          conductedBy: samplingData.conductedBy,
          customerCount: samplingData.customerCount,
          weatherCondition: samplingData.weatherCondition,
          footTrafficLevel: samplingData.footTrafficLevel
        });
      }

      // Check sampling limits and policies
      const policy = await this.samplingPolicy.getPolicyForBranchProduct(
        samplingData.branchId,
        samplingData.productId
      );

      if (!policy) {
        throw new Error('No sampling policy found for this branch/product combination');
      }

      // Check if sampling is allowed
      const limitCheck = await this.samplingPolicy.checkSamplingLimits(
        samplingData.branchId,
        samplingData.productId,
        samplingData.weightGram,
        new Date()
      );

      if (!limitCheck.allowed) {
        if (limitCheck.requiresApproval) {
          // Create approval request
          await this.requestApprovalForExcess(
            samplingData.branchId,
            samplingData.productId,
            samplingData.weightGram,
            samplingData.conductedBy,
            'Exceeds daily limit',
            samplingData.customerCount
          );
          throw new Error(`Sampling exceeds limits and requires approval: ${limitCheck.reason}`);
        } else {
          throw new Error(`Sampling not allowed: ${limitCheck.reason}`);
        }
      }

      // Get inventory item if not specified
      let inventoryItemId = samplingData.inventoryItemId;
      if (!inventoryItemId) {
        inventoryItemId = await this.findBestInventoryItem(
          samplingData.branchId,
          samplingData.productId,
          samplingData.weightGram
        );
      }

      // Create sampling record (this will automatically deduct stock)
      const record = await this.samplingRecord.create({
        samplingSessionId: session.id!,
        productId: samplingData.productId,
        inventoryItemId: inventoryItemId,
        weightGram: samplingData.weightGram,
        productCondition: 'excellent', // Default, can be updated later
        customerResponse: samplingData.customerResponse,
        resultedInPurchase: samplingData.resultedInPurchase || false,
        purchaseAmount: samplingData.purchaseAmount,
        notes: samplingData.notes,
        recordedBy: samplingData.conductedBy
      });

      // Calculate cost breakdown
      const costCalculation = await this.calculateCostBreakdown(
        samplingData.branchId,
        samplingData.productId,
        samplingData.weightGram,
        record.unitCostPerGram
      );

      // Check if session needs approval
      const requiresApproval = limitCheck.requiresApproval || false;

      // Update session if it requires approval
      if (requiresApproval) {
        await this.samplingSession.requestApproval(session.id!);
        session = await this.samplingSession.getById(session.id!);
      }

      logger.info('Sampling recorded successfully', {
        sessionId: session.id,
        recordId: record.id,
        weightGram: samplingData.weightGram,
        totalCost: record.totalCost,
        requiresApproval
      });

      return {
        session: session!,
        record,
        stockDeducted: true,
        requiresApproval,
        costCalculation
      };

    } catch (error) {
      logger.error('Error recording sampling:', error);
      throw error;
    }
  }

  // Request approval for excess sampling
  async requestApprovalForExcess(
    branchId: string,
    productId: string,
    requestedWeightGram: number,
    requestedBy: string,
    reason: string,
    expectedCustomerCount?: number,
    specialOccasion?: string
  ): Promise<SamplingApproval> {
    try {
      const approval = await this.samplingApproval.create({
        branchId,
        productId,
        requestedBy,
        requestedWeightGram,
        reasonForExcess: reason,
        expectedCustomerCount,
        specialOccasion
      });

      logger.info('Approval request created', {
        approvalId: approval.id,
        branchId,
        productId,
        requestedWeightGram,
        requestedBy
      });

      return approval;

    } catch (error) {
      logger.error('Error creating approval request:', error);
      throw error;
    }
  }

  // Approve excess sampling request
  async approveExcessSampling(
    approvalId: string,
    approvedBy: string,
    approvedWeightGram?: number,
    notes?: string
  ): Promise<SamplingApproval> {
    try {
      const approval = await this.samplingApproval.approve(
        approvalId,
        approvedBy,
        approvedWeightGram,
        notes
      );

      logger.info('Excess sampling approved', {
        approvalId,
        approvedBy,
        approvedWeightGram: approval.approvedWeightGram
      });

      return approval;

    } catch (error) {
      logger.error('Error approving excess sampling:', error);
      throw error;
    }
  }

  // Complete sampling session
  async completeSamplingSession(
    sessionId: string,
    completedBy: string
  ): Promise<SamplingSession> {
    try {
      const session = await this.samplingSession.complete(sessionId);

      // Update daily summary
      await this.updateDailySummary(session.branchId, session.sessionDate);

      logger.info('Sampling session completed', {
        sessionId,
        sessionNumber: session.sessionNumber,
        totalWeight: session.totalWeightGram,
        totalCost: session.totalCost,
        completedBy
      });

      return session;

    } catch (error) {
      logger.error('Error completing sampling session:', error);
      throw error;
    }
  }

  // Get daily sampling report for branch
  async getDailyReport(branchId: string, date: Date): Promise<{
    summary: {
      totalSessions: number;
      totalWeight: number;
      totalCost: number;
      totalCustomers: number;
      averageSessionWeight: number;
      policyCompliance: number;
    };
    sessions: Array<{
      sessionNumber: string;
      conductedBy: string;
      totalWeight: number;
      totalCost: number;
      itemCount: number;
      status: SamplingStatus;
      requiresApproval: boolean;
    }>;
    products: Array<{
      productId: string;
      productName: string;
      totalWeight: number;
      totalCost: number;
      sampleCount: number;
      conversionRate: number;
    }>;
    policyLimits: Array<{
      productId: string;
      productName: string;
      dailyLimit: number;
      currentUsage: number;
      remainingQuota: number;
      complianceStatus: 'within' | 'approaching' | 'exceeded';
    }>;
  }> {
    try {
      const db = DatabaseConnection.getInstance();

      // Get daily sessions
      const sessions = await this.samplingSession.getDailySessionsForBranch(branchId, date);

      // Get session summary
      const sessionStats = await this.samplingSession.getSessionStatistics(branchId, date, date);

      // Get product breakdown
      const productQuery = `
        SELECT 
          sr.product_id,
          p.name as product_name,
          SUM(sr.weight_gram) as total_weight,
          SUM(sr.total_cost) as total_cost,
          COUNT(*) as sample_count,
          COALESCE(
            (COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true)::DECIMAL / 
             NULLIF(COUNT(*), 0) * 100), 0
          ) as conversion_rate
        FROM sampling_records sr
        JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
        JOIN products p ON sr.product_id = p.id
        WHERE ss.branch_id = $1 
        AND ss.session_date = $2
        AND ss.status IN ('completed', 'active')
        GROUP BY sr.product_id, p.name
        ORDER BY total_weight DESC
      `;

      const productResult = await db.query(productQuery, [branchId, date]);
      const products = productResult.rows.map(row => ({
        productId: row.product_id,
        productName: row.product_name,
        totalWeight: parseFloat(row.total_weight),
        totalCost: parseFloat(row.total_cost),
        sampleCount: parseInt(row.sample_count),
        conversionRate: parseFloat(row.conversion_rate)
      }));

      // Get policy limits and compliance
      const policyQuery = `
        WITH daily_usage AS (
          SELECT 
            sr.product_id,
            SUM(sr.weight_gram) as current_usage
          FROM sampling_records sr
          JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
          WHERE ss.branch_id = $1 
          AND ss.session_date = $2
          AND ss.status IN ('completed', 'active')
          GROUP BY sr.product_id
        )
        SELECT 
          sp.product_id,
          p.name as product_name,
          sp.daily_limit_gram,
          COALESCE(du.current_usage, 0) as current_usage,
          (sp.daily_limit_gram - COALESCE(du.current_usage, 0)) as remaining_quota,
          CASE 
            WHEN COALESCE(du.current_usage, 0) > sp.daily_limit_gram THEN 'exceeded'
            WHEN COALESCE(du.current_usage, 0) > (sp.daily_limit_gram * 0.8) THEN 'approaching'
            ELSE 'within'
          END as compliance_status
        FROM sampling_policies sp
        JOIN products p ON sp.product_id = p.id
        LEFT JOIN daily_usage du ON sp.product_id = du.product_id
        WHERE sp.branch_id = $1 
        AND sp.is_active = true
        AND sp.product_id IS NOT NULL
        ORDER BY p.name
      `;

      const policyResult = await db.query(policyQuery, [branchId, date]);
      const policyLimits = policyResult.rows.map(row => ({
        productId: row.product_id,
        productName: row.product_name,
        dailyLimit: parseFloat(row.daily_limit_gram),
        currentUsage: parseFloat(row.current_usage),
        remainingQuota: parseFloat(row.remaining_quota),
        complianceStatus: row.compliance_status as 'within' | 'approaching' | 'exceeded'
      }));

      // Calculate compliance percentage
      const totalPolicies = policyLimits.length;
      const compliantPolicies = policyLimits.filter(p => p.complianceStatus === 'within').length;
      const compliancePercentage = totalPolicies > 0 ? (compliantPolicies / totalPolicies * 100) : 100;

      return {
        summary: {
          totalSessions: sessionStats.totalSessions,
          totalWeight: sessionStats.totalWeight,
          totalCost: sessionStats.totalCost,
          totalCustomers: sessionStats.averageCustomersPerSession * sessionStats.totalSessions,
          averageSessionWeight: sessionStats.totalSessions > 0 ? sessionStats.totalWeight / sessionStats.totalSessions : 0,
          policyCompliance: compliancePercentage
        },
        sessions: sessions.map(session => ({
          sessionNumber: session.sessionNumber,
          conductedBy: (session as any).conducted_by_name || session.conductedBy,
          totalWeight: session.totalWeightGram,
          totalCost: session.totalCost,
          itemCount: session.totalItems,
          status: session.status,
          requiresApproval: session.requiresApproval
        })),
        products,
        policyLimits
      };

    } catch (error) {
      logger.error('Error generating daily sampling report:', error);
      throw error;
    }
  }

  // Get cost report for period
  async getCostReport(filters: {
    branchId?: string;
    productId?: string;
    dateFrom: Date;
    dateTo: Date;
  }): Promise<{
    totalCost: number;
    totalWeight: number;
    averageCostPerGram: number;
    costBreakdown: Array<{
      date: string;
      totalCost: number;
      totalWeight: number;
      sessionCount: number;
    }>;
    productCosts: Array<{
      productId: string;
      productName: string;
      totalCost: number;
      totalWeight: number;
      averageCostPerGram: number;
      percentage: number;
    }>;
    branchCosts: Array<{
      branchId: string;
      branchName: string;
      totalCost: number;
      totalWeight: number;
      sessionCount: number;
      percentage: number;
    }>;
    budgetAnalysis: {
      totalBudget: number;
      usedBudget: number;
      remainingBudget: number;
      budgetUtilization: number;
    };
  }> {
    try {
      const db = DatabaseConnection.getInstance();

      let whereClause = 'WHERE ss.session_date BETWEEN $1 AND $2 AND ss.status = \'completed\'';
      const values = [filters.dateFrom, filters.dateTo];
      let paramCount = 3;

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

      // Get overall totals
      const totalQuery = `
        SELECT 
          COALESCE(SUM(sr.total_cost), 0) as total_cost,
          COALESCE(SUM(sr.weight_gram), 0) as total_weight
        FROM sampling_records sr
        JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
        ${whereClause}
      `;

      const totalResult = await db.query(totalQuery, values);
      const totals = totalResult.rows[0];

      // Get daily breakdown
      const dailyQuery = `
        SELECT 
          ss.session_date::date as date,
          COALESCE(SUM(sr.total_cost), 0) as total_cost,
          COALESCE(SUM(sr.weight_gram), 0) as total_weight,
          COUNT(DISTINCT ss.id) as session_count
        FROM sampling_records sr
        JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
        ${whereClause}
        GROUP BY ss.session_date::date
        ORDER BY ss.session_date::date
      `;

      const dailyResult = await db.query(dailyQuery, values);
      const costBreakdown = dailyResult.rows.map(row => ({
        date: row.date,
        totalCost: parseFloat(row.total_cost),
        totalWeight: parseFloat(row.total_weight),
        sessionCount: parseInt(row.session_count)
      }));

      // Get product costs
      const productQuery = `
        SELECT 
          sr.product_id,
          p.name as product_name,
          COALESCE(SUM(sr.total_cost), 0) as total_cost,
          COALESCE(SUM(sr.weight_gram), 0) as total_weight,
          COALESCE(AVG(sr.unit_cost_per_gram), 0) as avg_cost_per_gram
        FROM sampling_records sr
        JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
        JOIN products p ON sr.product_id = p.id
        ${whereClause}
        GROUP BY sr.product_id, p.name
        ORDER BY total_cost DESC
      `;

      const productResult = await db.query(productQuery, values);
      const totalCostForPercent = parseFloat(totals.total_cost) || 1;
      
      const productCosts = productResult.rows.map(row => ({
        productId: row.product_id,
        productName: row.product_name,
        totalCost: parseFloat(row.total_cost),
        totalWeight: parseFloat(row.total_weight),
        averageCostPerGram: parseFloat(row.avg_cost_per_gram),
        percentage: (parseFloat(row.total_cost) / totalCostForPercent) * 100
      }));

      // Get branch costs (if not filtered by branch)
      let branchCosts = [];
      if (!filters.branchId) {
        const branchQuery = `
          SELECT 
            ss.branch_id,
            b.name as branch_name,
            COALESCE(SUM(sr.total_cost), 0) as total_cost,
            COALESCE(SUM(sr.weight_gram), 0) as total_weight,
            COUNT(DISTINCT ss.id) as session_count
          FROM sampling_records sr
          JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
          JOIN branches b ON ss.branch_id = b.id
          ${whereClause}
          GROUP BY ss.branch_id, b.name
          ORDER BY total_cost DESC
        `;

        const branchResult = await db.query(branchQuery, values);
        branchCosts = branchResult.rows.map(row => ({
          branchId: row.branch_id,
          branchName: row.branch_name,
          totalCost: parseFloat(row.total_cost),
          totalWeight: parseFloat(row.total_weight),
          sessionCount: parseInt(row.session_count),
          percentage: (parseFloat(row.total_cost) / totalCostForPercent) * 100
        }));
      }

      // Get budget analysis
      const budgetAnalysis = await this.calculateBudgetAnalysis(filters);

      return {
        totalCost: parseFloat(totals.total_cost),
        totalWeight: parseFloat(totals.total_weight),
        averageCostPerGram: parseFloat(totals.total_weight) > 0 ? 
          parseFloat(totals.total_cost) / parseFloat(totals.total_weight) : 0,
        costBreakdown,
        productCosts,
        branchCosts,
        budgetAnalysis
      };

    } catch (error) {
      logger.error('Error generating cost report:', error);
      throw error;
    }
  }

  // Get sampling effectiveness analysis
  async getEffectivenessAnalysis(filters: {
    branchId: string;
    productId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{
    overallMetrics: {
      totalSamples: number;
      totalConversions: number;
      conversionRate: number;
      totalRevenue: number;
      totalCost: number;
      roi: number;
      costPerConversion: number;
      revenuePerSample: number;
    };
    trends: Array<{
      date: string;
      samples: number;
      conversions: number;
      conversionRate: number;
      cost: number;
      revenue: number;
      roi: number;
    }>;
    productPerformance: Array<{
      productId: string;
      productName: string;
      samples: number;
      conversions: number;
      conversionRate: number;
      avgPurchaseAmount: number;
      totalRevenue: number;
      totalCost: number;
      roi: number;
    }>;
    customerResponseAnalysis: {
      responseDistribution: Array<{
        response: CustomerResponse;
        count: number;
        percentage: number;
        conversionRate: number;
      }>;
      averageResponseScore: number;
      positiveResponseRate: number;
    };
    recommendations: string[];
  }> {
    try {
      // Get conversion analysis
      const conversionData = await this.samplingRecord.getConversionAnalysis({
        branchId: filters.branchId,
        productId: filters.productId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo
      });

      // Get daily trends
      const trends = await this.getDailyTrends(filters);

      // Calculate customer response analysis
      const responseAnalysis = await this.getCustomerResponseAnalysis(filters);

      // Generate recommendations
      const recommendations = this.generateRecommendations(conversionData, responseAnalysis);

      return {
        overallMetrics: {
          totalSamples: conversionData.totalSamples,
          totalConversions: conversionData.totalConversions,
          conversionRate: conversionData.conversionRate,
          totalRevenue: conversionData.totalRevenue,
          totalCost: conversionData.totalCost,
          roi: conversionData.roi,
          costPerConversion: conversionData.totalConversions > 0 ? 
            conversionData.totalCost / conversionData.totalConversions : 0,
          revenuePerSample: conversionData.totalSamples > 0 ? 
            conversionData.totalRevenue / conversionData.totalSamples : 0
        },
        trends,
        productPerformance: conversionData.productBreakdown,
        customerResponseAnalysis: responseAnalysis,
        recommendations
      };

    } catch (error) {
      logger.error('Error generating effectiveness analysis:', error);
      throw error;
    }
  }

  // Find best inventory item for sampling
  private async findBestInventoryItem(
    branchId: string, 
    productId: string, 
    requiredWeight: number
  ): Promise<string> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT id, quantity_in_stock, expiration_date, unit_cost
      FROM inventory_items
      WHERE branch_id = $1 
      AND product_id = $2 
      AND is_active = true
      AND quantity_in_stock >= $3
      ORDER BY 
        expiration_date ASC NULLS LAST,
        unit_cost ASC
      LIMIT 1
    `;

    const result = await db.query(query, [branchId, productId, requiredWeight]);

    if (result.rows.length === 0) {
      throw new Error('Insufficient inventory for sampling');
    }

    return result.rows[0].id;
  }

  // Calculate cost breakdown
  private async calculateCostBreakdown(
    branchId: string,
    productId: string,
    weightGram: number,
    unitCostPerGram: number
  ): Promise<{
    unitCost: number;
    totalCost: number;
    dailyTotal: number;
    monthlyTotal: number;
  }> {
    const db = DatabaseConnection.getInstance();

    const totalCost = weightGram * unitCostPerGram;
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get daily total
    const dailyQuery = `
      SELECT COALESCE(SUM(sr.total_cost), 0) as daily_total
      FROM sampling_records sr
      JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
      WHERE ss.branch_id = $1 
      AND sr.product_id = $2
      AND ss.session_date = $3
      AND ss.status IN ('completed', 'active')
    `;

    const dailyResult = await db.query(dailyQuery, [branchId, productId, today]);
    const dailyTotal = parseFloat(dailyResult.rows[0].daily_total) + totalCost;

    // Get monthly total
    const monthlyQuery = `
      SELECT COALESCE(SUM(sr.total_cost), 0) as monthly_total
      FROM sampling_records sr
      JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
      WHERE ss.branch_id = $1 
      AND sr.product_id = $2
      AND ss.session_date >= $3
      AND ss.status = 'completed'
    `;

    const monthlyResult = await db.query(monthlyQuery, [branchId, productId, monthStart]);
    const monthlyTotal = parseFloat(monthlyResult.rows[0].monthly_total) + totalCost;

    return {
      unitCost: unitCostPerGram,
      totalCost,
      dailyTotal,
      monthlyTotal
    };
  }

  // Calculate budget analysis
  private async calculateBudgetAnalysis(filters: {
    branchId?: string;
    productId?: string;
    dateFrom: Date;
    dateTo: Date;
  }): Promise<{
    totalBudget: number;
    usedBudget: number;
    remainingBudget: number;
    budgetUtilization: number;
  }> {
    const db = DatabaseConnection.getInstance();

    // Get monthly budgets from policies
    let budgetQuery = `
      SELECT COALESCE(SUM(monthly_budget), 0) as total_budget
      FROM sampling_policies
      WHERE is_active = true
      AND monthly_budget IS NOT NULL
    `;

    const budgetValues = [];
    if (filters.branchId) {
      budgetQuery += ' AND branch_id = $1';
      budgetValues.push(filters.branchId);
    }

    const budgetResult = await db.query(budgetQuery, budgetValues);
    const totalBudget = parseFloat(budgetResult.rows[0].total_budget) || 0;

    // Calculate months in date range
    const monthsInRange = Math.ceil(
      (filters.dateTo.getTime() - filters.dateFrom.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    const periodBudget = totalBudget * monthsInRange;

    // Get actual spending
    let spendingQuery = `
      SELECT COALESCE(SUM(sr.total_cost), 0) as used_budget
      FROM sampling_records sr
      JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
      WHERE ss.session_date BETWEEN $1 AND $2
      AND ss.status = 'completed'
    `;

    const spendingValues = [filters.dateFrom, filters.dateTo];
    let paramCount = 3;

    if (filters.branchId) {
      spendingQuery += ` AND ss.branch_id = $${paramCount}`;
      spendingValues.push(filters.branchId);
      paramCount++;
    }

    if (filters.productId) {
      spendingQuery += ` AND sr.product_id = $${paramCount}`;
      spendingValues.push(filters.productId);
    }

    const spendingResult = await db.query(spendingQuery, spendingValues);
    const usedBudget = parseFloat(spendingResult.rows[0].used_budget) || 0;

    return {
      totalBudget: periodBudget,
      usedBudget,
      remainingBudget: periodBudget - usedBudget,
      budgetUtilization: periodBudget > 0 ? (usedBudget / periodBudget) * 100 : 0
    };
  }

  // Get daily trends
  private async getDailyTrends(filters: {
    branchId: string;
    productId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<Array<{
    date: string;
    samples: number;
    conversions: number;
    conversionRate: number;
    cost: number;
    revenue: number;
    roi: number;
  }>> {
    const db = DatabaseConnection.getInstance();

    let whereClause = 'WHERE ss.branch_id = $1 AND ss.status = \'completed\'';
    const values = [filters.branchId];
    let paramCount = 2;

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
    }

    const query = `
      SELECT 
        ss.session_date::date as date,
        COUNT(*) as samples,
        COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true) as conversions,
        COALESCE(
          (COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true)::DECIMAL / 
           NULLIF(COUNT(*), 0) * 100), 0
        ) as conversion_rate,
        COALESCE(SUM(sr.total_cost), 0) as cost,
        COALESCE(SUM(sr.purchase_amount), 0) as revenue
      FROM sampling_records sr
      JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
      ${whereClause}
      GROUP BY ss.session_date::date
      ORDER BY ss.session_date::date
    `;

    const result = await db.query(query, values);

    return result.rows.map(row => {
      const cost = parseFloat(row.cost);
      const revenue = parseFloat(row.revenue);
      const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;

      return {
        date: row.date,
        samples: parseInt(row.samples),
        conversions: parseInt(row.conversions),
        conversionRate: parseFloat(row.conversion_rate),
        cost,
        revenue,
        roi
      };
    });
  }

  // Get customer response analysis
  private async getCustomerResponseAnalysis(filters: {
    branchId: string;
    productId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{
    responseDistribution: Array<{
      response: CustomerResponse;
      count: number;
      percentage: number;
      conversionRate: number;
    }>;
    averageResponseScore: number;
    positiveResponseRate: number;
  }> {
    const db = DatabaseConnection.getInstance();

    let whereClause = 'WHERE ss.branch_id = $1 AND ss.status = \'completed\' AND sr.customer_response IS NOT NULL';
    const values = [filters.branchId];
    let paramCount = 2;

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
    }

    const query = `
      SELECT 
        sr.customer_response,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true) as conversions,
        CASE sr.customer_response
          WHEN 'very_positive' THEN 5
          WHEN 'positive' THEN 4
          WHEN 'neutral' THEN 3
          WHEN 'negative' THEN 2
          WHEN 'very_negative' THEN 1
        END as response_score
      FROM sampling_records sr
      JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
      ${whereClause}
      GROUP BY sr.customer_response
      ORDER BY response_score DESC
    `;

    const result = await db.query(query, values);
    const totalResponses = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);

    const responseDistribution = result.rows.map(row => {
      const count = parseInt(row.count);
      const conversions = parseInt(row.conversions);
      return {
        response: row.customer_response as CustomerResponse,
        count,
        percentage: totalResponses > 0 ? (count / totalResponses) * 100 : 0,
        conversionRate: count > 0 ? (conversions / count) * 100 : 0
      };
    });

    // Calculate average response score
    const totalScore = result.rows.reduce((sum, row) => {
      return sum + (parseInt(row.count) * parseInt(row.response_score));
    }, 0);
    const averageResponseScore = totalResponses > 0 ? totalScore / totalResponses : 3;

    // Calculate positive response rate
    const positiveResponses = result.rows
      .filter(row => ['positive', 'very_positive'].includes(row.customer_response))
      .reduce((sum, row) => sum + parseInt(row.count), 0);
    const positiveResponseRate = totalResponses > 0 ? (positiveResponses / totalResponses) * 100 : 0;

    return {
      responseDistribution,
      averageResponseScore,
      positiveResponseRate
    };
  }

  // Generate recommendations based on analysis
  private generateRecommendations(
    conversionData: any,
    responseAnalysis: any
  ): string[] {
    const recommendations = [];

    // ROI-based recommendations
    if (conversionData.roi < 0) {
      recommendations.push('Consider reducing sampling costs or improving conversion strategies as ROI is negative');
    } else if (conversionData.roi < 50) {
      recommendations.push('ROI is below 50% - consider optimizing sampling approach or targeting higher-value customers');
    }

    // Conversion rate recommendations
    if (conversionData.conversionRate < 10) {
      recommendations.push('Low conversion rate - consider training staff on sampling techniques and customer engagement');
    } else if (conversionData.conversionRate > 30) {
      recommendations.push('Excellent conversion rate - maintain current sampling practices');
    }

    // Response quality recommendations
    if (responseAnalysis.averageResponseScore < 3.5) {
      recommendations.push('Customer response scores are below average - review product quality and presentation');
    }

    if (responseAnalysis.positiveResponseRate < 60) {
      recommendations.push('Consider improving product selection for sampling or timing of sampling activities');
    }

    // Cost efficiency recommendations
    if (conversionData.totalSamples > 0) {
      const costPerSample = conversionData.totalCost / conversionData.totalSamples;
      if (costPerSample > 5) {
        recommendations.push('High cost per sample - consider reducing portion sizes or focusing on higher-conversion products');
      }
    }

    return recommendations;
  }

  // Update daily summary
  private async updateDailySummary(branchId: string, date: Date): Promise<void> {
    const db = DatabaseConnection.getInstance();
    
    const query = `SELECT update_daily_sampling_summary($1, NULL, $2)`;
    await db.query(query, [branchId, date]);
  }
}

export default SamplingManagementService;