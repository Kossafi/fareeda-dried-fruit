import { Request, Response } from 'express';
import Joi from 'joi';
import ReportingService from '../services/ReportingService';
import { 
  ReportType,
  ExportFormat,
  TimePeriod,
  ReportRequest,
  ExportRequest
} from '@dried-fruits/types';
import logger from '../utils/logger';

const reportingService = new ReportingService();

// Validation schemas
const reportRequestSchema = Joi.object({
  reportType: Joi.string().valid(...Object.values(ReportType)).required(),
  parameters: Joi.object({
    branchId: Joi.alternatives().try(
      Joi.string().uuid(),
      Joi.array().items(Joi.string().uuid())
    ).optional(),
    productId: Joi.alternatives().try(
      Joi.string().uuid(),
      Joi.array().items(Joi.string().uuid())
    ).optional(),
    categoryId: Joi.alternatives().try(
      Joi.string().uuid(),
      Joi.array().items(Joi.string().uuid())
    ).optional(),
    supplierId: Joi.alternatives().try(
      Joi.string().uuid(),
      Joi.array().items(Joi.string().uuid())
    ).optional(),
    period: Joi.string().valid(...Object.values(TimePeriod)).optional(),
    dateFrom: Joi.date().optional(),
    dateTo: Joi.date().optional(),
    groupBy: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional(),
    metrics: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional(),
    comparison: Joi.boolean().optional(),
    comparisonPeriod: Joi.string().valid(...Object.values(TimePeriod)).optional(),
    includeSubcategories: Joi.boolean().optional(),
    includeInactive: Joi.boolean().optional()
  }).optional(),
  format: Joi.string().valid(...Object.values(ExportFormat)).optional(),
  useCache: Joi.boolean().optional(),
  cacheTimeout: Joi.number().min(1).max(1440).optional() // 1 minute to 24 hours
});

const exportRequestSchema = Joi.object({
  reportType: Joi.string().valid(...Object.values(ReportType)).required(),
  format: Joi.string().valid(...Object.values(ExportFormat)).required(),
  parameters: Joi.object().required(),
  fileName: Joi.string().max(255).optional(),
  template: Joi.string().optional(),
  includeCharts: Joi.boolean().optional(),
  includeRawData: Joi.boolean().optional()
});

// Sales Analytics Report
export const getSalesAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = reportRequestSchema.validate({
      reportType: ReportType.SALES_ANALYTICS,
      parameters: req.query,
      useCache: req.query.useCache !== 'false',
      cacheTimeout: req.query.cacheTimeout ? parseInt(req.query.cacheTimeout as string) : undefined
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const report = await reportingService.generateReport(value as ReportRequest);

    logger.info('Sales analytics generated', {
      reportType: value.reportType,
      executionTimeMs: report.metadata.executionTimeMs,
      fromCache: report.metadata.fromCache,
      dataRowsCount: report.metadata.dataRowsCount
    });

    res.json({
      success: true,
      data: report.data,
      metadata: report.metadata
    });

  } catch (error) {
    logger.error('Sales analytics error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate sales analytics'
    });
  }
};

// Inventory Movement Report
export const getInventoryMovement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = reportRequestSchema.validate({
      reportType: ReportType.INVENTORY_MOVEMENT,
      parameters: req.query,
      useCache: req.query.useCache !== 'false',
      cacheTimeout: req.query.cacheTimeout ? parseInt(req.query.cacheTimeout as string) : undefined
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const report = await reportingService.generateReport(value as ReportRequest);

    res.json({
      success: true,
      data: report.data,
      metadata: report.metadata
    });

  } catch (error) {
    logger.error('Inventory movement error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate inventory movement report'
    });
  }
};

// Branch Performance Report
export const getBranchPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = reportRequestSchema.validate({
      reportType: ReportType.BRANCH_PERFORMANCE,
      parameters: req.query,
      useCache: req.query.useCache !== 'false',
      cacheTimeout: req.query.cacheTimeout ? parseInt(req.query.cacheTimeout as string) : undefined
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const report = await reportingService.generateReport(value as ReportRequest);

    res.json({
      success: true,
      data: report.data,
      metadata: report.metadata
    });

  } catch (error) {
    logger.error('Branch performance error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate branch performance report'
    });
  }
};

// Product Ranking Report
export const getProductRanking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = reportRequestSchema.validate({
      reportType: ReportType.PRODUCT_RANKING,
      parameters: req.query,
      useCache: req.query.useCache !== 'false',
      cacheTimeout: req.query.cacheTimeout ? parseInt(req.query.cacheTimeout as string) : undefined
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const report = await reportingService.generateReport(value as ReportRequest);

    res.json({
      success: true,
      data: report.data,
      metadata: report.metadata
    });

  } catch (error) {
    logger.error('Product ranking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate product ranking report'
    });
  }
};

// Sampling ROI Report
export const getSamplingROI = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = reportRequestSchema.validate({
      reportType: ReportType.SAMPLING_ROI,
      parameters: req.query,
      useCache: req.query.useCache !== 'false',
      cacheTimeout: req.query.cacheTimeout ? parseInt(req.query.cacheTimeout as string) : undefined
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const report = await reportingService.generateReport(value as ReportRequest);

    res.json({
      success: true,
      data: report.data,
      metadata: report.metadata
    });

  } catch (error) {
    logger.error('Sampling ROI error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate sampling ROI report'
    });
  }
};

// Procurement Analysis Report
export const getProcurementAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = reportRequestSchema.validate({
      reportType: ReportType.PROCUREMENT_ANALYSIS,
      parameters: req.query,
      useCache: req.query.useCache !== 'false',
      cacheTimeout: req.query.cacheTimeout ? parseInt(req.query.cacheTimeout as string) : undefined
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const report = await reportingService.generateReport(value as ReportRequest);

    res.json({
      success: true,
      data: report.data,
      metadata: report.metadata
    });

  } catch (error) {
    logger.error('Procurement analysis error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate procurement analysis report'
    });
  }
};

// Real-time Dashboard
export const getRealTimeDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.query;
    
    // Convert branchId to array if provided
    const branchIds = branchId ? (Array.isArray(branchId) ? branchId : [branchId]) : undefined;

    const reportRequest: ReportRequest = {
      reportType: ReportType.OPERATIONAL_KPI,
      parameters: {
        branchId: branchIds
      },
      useCache: false // Real-time data should not be cached
    };

    const report = await reportingService.generateReport(reportRequest);

    res.json({
      success: true,
      data: report.data,
      metadata: report.metadata
    });

  } catch (error) {
    logger.error('Real-time dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate real-time dashboard'
    });
  }
};

// Financial Summary Report
export const getFinancialSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = reportRequestSchema.validate({
      reportType: ReportType.FINANCIAL_SUMMARY,
      parameters: req.query,
      useCache: req.query.useCache !== 'false',
      cacheTimeout: req.query.cacheTimeout ? parseInt(req.query.cacheTimeout as string) : undefined
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    // Financial summary combines multiple analytics
    const salesReport = await reportingService.generateReport({
      reportType: ReportType.SALES_ANALYTICS,
      parameters: value.parameters,
      useCache: true
    });

    const procurementReport = await reportingService.generateReport({
      reportType: ReportType.PROCUREMENT_ANALYSIS,
      parameters: value.parameters,
      useCache: true
    });

    const samplingReport = await reportingService.generateReport({
      reportType: ReportType.SAMPLING_ROI,
      parameters: value.parameters,
      useCache: true
    });

    const financialSummary = {
      revenue: salesReport.data.summary,
      costs: {
        procurement: procurementReport.data.summary.totalProcurementValue,
        sampling: samplingReport.data.summary.totalSamplingCost,
        operational: 0 // Placeholder
      },
      profitability: {
        grossProfit: salesReport.data.summary.grossProfit,
        grossMargin: salesReport.data.summary.grossMarginPercentage,
        samplingROI: samplingReport.data.summary.overallROI
      },
      trends: {
        revenue: salesReport.data.trends,
        costs: procurementReport.data.orders,
        sampling: samplingReport.data.trends
      }
    };

    res.json({
      success: true,
      data: financialSummary,
      metadata: {
        reportType: ReportType.FINANCIAL_SUMMARY,
        parameters: value.parameters,
        generatedAt: new Date(),
        executionTimeMs: 0,
        dataRowsCount: 0,
        fromCache: false
      }
    });

  } catch (error) {
    logger.error('Financial summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate financial summary'
    });
  }
};

// Generic Report Generator
export const generateReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = reportRequestSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const report = await reportingService.generateReport(value as ReportRequest);

    res.json({
      success: true,
      data: report.data,
      metadata: report.metadata
    });

  } catch (error) {
    logger.error('Generate report error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate report'
    });
  }
};

// Export Report
export const exportReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = exportRequestSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const exportResult = await reportingService.exportReport(value as ExportRequest);

    logger.info('Report exported', {
      reportType: value.reportType,
      format: value.format,
      fileName: exportResult.fileName,
      fileSize: exportResult.fileSize
    });

    res.json({
      success: true,
      message: 'Report exported successfully',
      data: exportResult
    });

  } catch (error) {
    logger.error('Export report error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to export report'
    });
  }
};

// Chart Data Endpoint for Data Visualization
export const getChartData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reportType, chartType, parameters } = req.query;

    if (!reportType || !chartType) {
      res.status(400).json({
        success: false,
        message: 'reportType and chartType are required'
      });
      return;
    }

    // Generate report first
    const reportRequest: ReportRequest = {
      reportType: reportType as ReportType,
      parameters: parameters ? JSON.parse(parameters as string) : {},
      useCache: true
    };

    const report = await reportingService.generateReport(reportRequest);

    // Convert report data to chart format
    const chartData = convertToChartData(report.data, chartType as string);

    res.json({
      success: true,
      data: chartData,
      metadata: {
        chartType,
        reportType,
        generatedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Chart data error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate chart data'
    });
  }
};

// Cache Management
export const getCacheStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await reportingService.getCacheStatistics();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Cache statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cache statistics'
    });
  }
};

export const invalidateCache = async (req: Request, res: Response): Promise<void> => {
  try {
    const { pattern } = req.body;

    const invalidatedCount = await reportingService.invalidateCache(pattern);

    res.json({
      success: true,
      message: `Invalidated ${invalidatedCount} cache entries`,
      data: { invalidatedCount }
    });

  } catch (error) {
    logger.error('Cache invalidation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to invalidate cache'
    });
  }
};

export const cleanExpiredCache = async (req: Request, res: Response): Promise<void> => {
  try {
    const deletedCount = await reportingService.cleanExpiredCache();

    res.json({
      success: true,
      message: `Cleaned ${deletedCount} expired cache entries`,
      data: { deletedCount }
    });

  } catch (error) {
    logger.error('Cache cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clean cache'
    });
  }
};

export const refreshMaterializedViews = async (req: Request, res: Response): Promise<void> => {
  try {
    await reportingService.refreshMaterializedViews();

    res.json({
      success: true,
      message: 'Materialized views refreshed successfully'
    });

  } catch (error) {
    logger.error('Refresh materialized views error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh materialized views'
    });
  }
};

// Helper function to convert report data to chart format
function convertToChartData(reportData: any, chartType: string): any {
  switch (chartType) {
    case 'line':
    case 'bar':
      if (reportData.trends) {
        return {
          labels: reportData.trends.map((trend: any) => trend.date),
          datasets: [{
            label: 'Revenue',
            data: reportData.trends.map((trend: any) => trend.revenue),
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2
          }]
        };
      }
      break;

    case 'pie':
    case 'doughnut':
      if (reportData.branchBreakdown) {
        return {
          labels: reportData.branchBreakdown.map((branch: any) => branch.branchName),
          datasets: [{
            data: reportData.branchBreakdown.map((branch: any) => branch.revenue),
            backgroundColor: [
              '#FF6384',
              '#36A2EB',
              '#FFCE56',
              '#4BC0C0',
              '#9966FF',
              '#FF9F40'
            ]
          }]
        };
      }
      break;

    case 'area':
      if (reportData.trends) {
        return {
          labels: reportData.trends.map((trend: any) => trend.date),
          datasets: [{
            label: 'Revenue',
            data: reportData.trends.map((trend: any) => trend.revenue),
            fill: true,
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            tension: 0.4
          }]
        };
      }
      break;

    default:
      return reportData;
  }

  return reportData;
}