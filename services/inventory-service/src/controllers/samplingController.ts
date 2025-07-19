import { Request, Response } from 'express';
import Joi from 'joi';
import SamplingManagementService from '../services/SamplingManagementService';
import SamplingPolicy from '../models/SamplingPolicy';
import SamplingSession from '../models/SamplingSession';
import SamplingRecord from '../models/SamplingRecord';
import SamplingApproval from '../models/SamplingApproval';
import { 
  SamplingStatus, 
  ProductCondition, 
  CustomerResponse, 
  ApprovalStatus,
  TrafficLevel,
  UnitType 
} from '@dried-fruits/types';
import logger from '../utils/logger';

const samplingService = new SamplingManagementService();
const samplingPolicy = new SamplingPolicy();
const samplingSession = new SamplingSession();
const samplingRecord = new SamplingRecord();
const samplingApproval = new SamplingApproval();

// Validation schemas
const recordSamplingSchema = Joi.object({
  sessionId: Joi.string().uuid().optional(),
  branchId: Joi.string().uuid().required(),
  productId: Joi.string().uuid().required(),
  inventoryItemId: Joi.string().uuid().optional(),
  weightGram: Joi.number().positive().precision(3).max(100).required(),
  customerCount: Joi.number().integer().min(1).max(50).optional(),
  customerResponse: Joi.string().valid(...Object.values(CustomerResponse)).optional(),
  resultedInPurchase: Joi.boolean().optional(),
  purchaseAmount: Joi.number().min(0).optional(),
  notes: Joi.string().max(500).optional(),
  weatherCondition: Joi.string().max(50).optional(),
  footTrafficLevel: Joi.string().valid(...Object.values(TrafficLevel)).optional()
});

const approveExcessSchema = Joi.object({
  approvalId: Joi.string().uuid().required(),
  approvedWeightGram: Joi.number().positive().optional(),
  notes: Joi.string().max(1000).optional()
});

const createPolicySchema = Joi.object({
  branchId: Joi.string().uuid().required(),
  productId: Joi.string().uuid().optional(),
  categoryId: Joi.string().uuid().optional(),
  dailyLimitGram: Joi.number().positive().required(),
  maxPerSessionGram: Joi.number().positive().required(),
  costPerGram: Joi.number().min(0).required(),
  monthlyBudget: Joi.number().min(0).optional(),
  allowedHoursStart: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  allowedHoursEnd: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  weekendEnabled: Joi.boolean().optional(),
  requiresApprovalAboveGram: Joi.number().positive().optional(),
  autoApproveBelowGram: Joi.number().positive().optional()
});

// Record sampling with weight validation
export const recordSampling = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = recordSamplingSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    // Add conducted by from authenticated user
    value.conductedBy = req.user?.id;

    const result = await samplingService.recordSampling(value);

    logger.info('Sampling recorded', {
      sessionId: result.session.id,
      recordId: result.record.id,
      branchId: value.branchId,
      productId: value.productId,
      weightGram: value.weightGram,
      totalCost: result.costCalculation.totalCost,
      conductedBy: req.user?.id
    });

    res.status(201).json({
      success: true,
      message: 'Sampling recorded successfully',
      data: {
        session: result.session,
        record: result.record,
        stockDeducted: result.stockDeducted,
        requiresApproval: result.requiresApproval,
        costCalculation: result.costCalculation
      }
    });

  } catch (error) {
    logger.error('Record sampling error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record sampling'
    });
  }
};

// Get daily sampling report for branch
export const getDailyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { date } = req.query;

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
      return;
    }

    const reportDate = date ? new Date(date as string) : new Date();
    const report = await samplingService.getDailyReport(branchId, reportDate);

    res.json({
      success: true,
      data: report,
      meta: {
        branchId,
        date: reportDate.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    logger.error('Get daily report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate daily report'
    });
  }
};

// Get cost report for period
export const getCostReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period } = req.params;
    const { branchId, productId, startDate, endDate } = req.query;

    // Parse period parameter
    let dateFrom: Date;
    let dateTo: Date = new Date();

    if (startDate && endDate) {
      dateFrom = new Date(startDate as string);
      dateTo = new Date(endDate as string);
    } else {
      switch (period) {
        case 'today':
          dateFrom = new Date();
          dateFrom.setHours(0, 0, 0, 0);
          break;
        case 'week':
          dateFrom = new Date();
          dateFrom.setDate(dateTo.getDate() - 7);
          break;
        case 'month':
          dateFrom = new Date();
          dateFrom.setMonth(dateTo.getMonth() - 1);
          break;
        case 'quarter':
          dateFrom = new Date();
          dateFrom.setMonth(dateTo.getMonth() - 3);
          break;
        default:
          res.status(400).json({
            success: false,
            message: 'Invalid period. Use: today, week, month, quarter, or provide startDate and endDate'
          });
          return;
      }
    }

    const report = await samplingService.getCostReport({
      branchId: branchId as string,
      productId: productId as string,
      dateFrom,
      dateTo
    });

    res.json({
      success: true,
      data: report,
      meta: {
        period,
        dateFrom: dateFrom.toISOString().split('T')[0],
        dateTo: dateTo.toISOString().split('T')[0],
        branchId: branchId || 'all',
        productId: productId || 'all'
      }
    });

  } catch (error) {
    logger.error('Get cost report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate cost report'
    });
  }
};

// Approve excess sampling
export const approveExcess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = approveExcessSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const approval = await samplingService.approveExcessSampling(
      value.approvalId,
      req.user?.id || 'system',
      value.approvedWeightGram,
      value.notes
    );

    logger.info('Excess sampling approved', {
      approvalId: value.approvalId,
      approvedBy: req.user?.id,
      approvedWeightGram: approval.approvedWeightGram
    });

    res.json({
      success: true,
      message: 'Excess sampling approved successfully',
      data: approval
    });

  } catch (error) {
    logger.error('Approve excess sampling error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve excess sampling'
    });
  }
};

// Get sampling effectiveness analysis
export const getEffectiveness = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { productId, startDate, endDate, period } = req.query;

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
      return;
    }

    // Parse date range
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;

    if (startDate && endDate) {
      dateFrom = new Date(startDate as string);
      dateTo = new Date(endDate as string);
    } else if (period) {
      dateTo = new Date();
      switch (period) {
        case 'week':
          dateFrom = new Date();
          dateFrom.setDate(dateTo.getDate() - 7);
          break;
        case 'month':
          dateFrom = new Date();
          dateFrom.setMonth(dateTo.getMonth() - 1);
          break;
        case 'quarter':
          dateFrom = new Date();
          dateFrom.setMonth(dateTo.getMonth() - 3);
          break;
        default:
          dateFrom = new Date();
          dateFrom.setDate(dateTo.getDate() - 30); // Default to 30 days
      }
    }

    const analysis = await samplingService.getEffectivenessAnalysis({
      branchId,
      productId: productId as string,
      dateFrom,
      dateTo
    });

    res.json({
      success: true,
      data: analysis,
      meta: {
        branchId,
        productId: productId || 'all',
        dateFrom: dateFrom?.toISOString().split('T')[0],
        dateTo: dateTo?.toISOString().split('T')[0],
        period: period || 'custom'
      }
    });

  } catch (error) {
    logger.error('Get effectiveness analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate effectiveness analysis'
    });
  }
};

// Complete sampling session
export const completeSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
      return;
    }

    const session = await samplingService.completeSamplingSession(sessionId, req.user?.id || 'system');

    logger.info('Sampling session completed', {
      sessionId,
      sessionNumber: session.sessionNumber,
      completedBy: req.user?.id
    });

    res.json({
      success: true,
      message: 'Sampling session completed successfully',
      data: session
    });

  } catch (error) {
    logger.error('Complete session error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete session'
    });
  }
};

// Get pending approvals
export const getPendingApprovals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.query;

    const approvals = await samplingApproval.getPendingApprovals(branchId as string);

    res.json({
      success: true,
      data: approvals,
      meta: {
        count: approvals.length,
        branchId: branchId || 'all'
      }
    });

  } catch (error) {
    logger.error('Get pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending approvals'
    });
  }
};

// Reject excess sampling
export const rejectExcess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { approvalId } = req.params;
    const { reason } = req.body;

    if (!approvalId) {
      res.status(400).json({
        success: false,
        message: 'Approval ID is required'
      });
      return;
    }

    if (!reason) {
      res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
      return;
    }

    const approval = await samplingApproval.reject(
      approvalId,
      req.user?.id || 'system',
      reason
    );

    logger.info('Excess sampling rejected', {
      approvalId,
      rejectedBy: req.user?.id,
      reason
    });

    res.json({
      success: true,
      message: 'Excess sampling rejected',
      data: approval
    });

  } catch (error) {
    logger.error('Reject excess sampling error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reject excess sampling'
    });
  }
};

// Get user's approval requests
export const getUserApprovals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
      return;
    }

    const approvals = await samplingApproval.getByRequester(
      userId,
      status as ApprovalStatus
    );

    res.json({
      success: true,
      data: approvals,
      meta: {
        count: approvals.length,
        userId,
        status: status || 'all'
      }
    });

  } catch (error) {
    logger.error('Get user approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user approvals'
    });
  }
};

// Create or update sampling policy
export const createOrUpdatePolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = createPolicySchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    value.createdBy = req.user?.id;

    const policy = await samplingPolicy.create(value);

    logger.info('Sampling policy created/updated', {
      policyId: policy.id,
      branchId: value.branchId,
      productId: value.productId,
      dailyLimitGram: value.dailyLimitGram,
      createdBy: req.user?.id
    });

    res.status(201).json({
      success: true,
      message: 'Sampling policy created/updated successfully',
      data: policy
    });

  } catch (error) {
    logger.error('Create/update policy error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create/update sampling policy'
    });
  }
};

// Get sampling policies for branch
export const getBranchPolicies = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
      return;
    }

    const policies = await samplingPolicy.getPoliciesByBranch(branchId);

    res.json({
      success: true,
      data: policies,
      meta: {
        count: policies.length,
        branchId
      }
    });

  } catch (error) {
    logger.error('Get branch policies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve branch policies'
    });
  }
};

// Get active sampling sessions
export const getActiveSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.query;

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
      return;
    }

    const sessions = await samplingSession.getActiveSessionsForBranch(branchId as string);

    res.json({
      success: true,
      data: sessions,
      meta: {
        count: sessions.length,
        branchId
      }
    });

  } catch (error) {
    logger.error('Get active sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve active sessions'
    });
  }
};

// Update customer response for sampling record
export const updateCustomerResponse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { recordId } = req.params;
    const updateResponseSchema = Joi.object({
      customerResponse: Joi.string().valid(...Object.values(CustomerResponse)).required(),
      resultedInPurchase: Joi.boolean().required(),
      purchaseAmount: Joi.number().min(0).optional(),
      notes: Joi.string().max(500).optional()
    });

    const { error, value } = updateResponseSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    if (!recordId) {
      res.status(400).json({
        success: false,
        message: 'Record ID is required'
      });
      return;
    }

    const record = await samplingRecord.updateCustomerResponse(recordId, value);

    logger.info('Customer response updated', {
      recordId,
      customerResponse: value.customerResponse,
      resultedInPurchase: value.resultedInPurchase,
      updatedBy: req.user?.id
    });

    res.json({
      success: true,
      message: 'Customer response updated successfully',
      data: record
    });

  } catch (error) {
    logger.error('Update customer response error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update customer response'
    });
  }
};

// Get sampling statistics
export const getSamplingStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId, startDate, endDate } = req.query;

    const dateFrom = startDate ? new Date(startDate as string) : undefined;
    const dateTo = endDate ? new Date(endDate as string) : undefined;

    const [sessionStats, approvalStats] = await Promise.all([
      samplingSession.getSessionStatistics(branchId as string, dateFrom, dateTo),
      samplingApproval.getApprovalStatistics(branchId as string, dateFrom, dateTo)
    ]);

    res.json({
      success: true,
      data: {
        sessions: sessionStats,
        approvals: approvalStats
      },
      meta: {
        branchId: branchId || 'all',
        dateFrom: dateFrom?.toISOString().split('T')[0],
        dateTo: dateTo?.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    logger.error('Get sampling statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sampling statistics'
    });
  }
};

// Check sampling limits before recording
export const checkSamplingLimits = async (req: Request, res: Response): Promise<void> => {
  try {
    const checkLimitsSchema = Joi.object({
      branchId: Joi.string().uuid().required(),
      productId: Joi.string().uuid().required(),
      weightGram: Joi.number().positive().precision(3).max(100).required(),
      date: Joi.date().optional()
    });

    const { error, value } = checkLimitsSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const limits = await samplingPolicy.checkSamplingLimits(
      value.branchId,
      value.productId,
      value.weightGram,
      value.date
    );

    res.json({
      success: true,
      data: limits
    });

  } catch (error) {
    logger.error('Check sampling limits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check sampling limits'
    });
  }
};