import DatabaseConnection from '../database/connection';
import AnalyticsEngine from './AnalyticsEngine';
import {
  ReportType,
  ReportRequest,
  ReportResponse,
  ReportCache,
  CacheStatus,
  TimePeriod,
  AnalyticsFilters,
  ExportFormat,
  ExportRequest,
  ExportResponse
} from '@dried-fruits/types';
import logger from '../utils/logger';
import crypto from 'crypto';

export class ReportingService {
  private db: DatabaseConnection;
  private analyticsEngine: AnalyticsEngine;
  private defaultCacheTimeout = 60; // minutes

  constructor() {
    this.db = DatabaseConnection.getInstance();
    this.analyticsEngine = new AnalyticsEngine();
  }

  // Generate report with caching
  async generateReport(request: ReportRequest): Promise<ReportResponse> {
    try {
      const startTime = Date.now();
      logger.info('Generating report', { 
        reportType: request.reportType, 
        parameters: request.parameters 
      });

      // Generate cache key
      const cacheKey = this.generateCacheKey(request.reportType, request.parameters);
      
      // Check cache if enabled
      let cachedData: ReportCache | null = null;
      if (request.useCache !== false) {
        cachedData = await this.getCachedReport(cacheKey);
        if (cachedData && cachedData.status === CacheStatus.VALID) {
          // Update access statistics
          await this.updateCacheAccess(cachedData.id);
          
          return {
            success: true,
            data: cachedData.data,
            metadata: {
              reportType: request.reportType,
              parameters: request.parameters,
              generatedAt: cachedData.generatedAt,
              executionTimeMs: cachedData.generationTimeMs,
              dataRowsCount: this.countDataRows(cachedData.data),
              fromCache: true,
              cacheExpiresAt: cachedData.expiresAt
            }
          };
        }
      }

      // Mark cache as generating to prevent duplicate requests
      if (request.useCache !== false) {
        await this.setCacheStatus(cacheKey, CacheStatus.GENERATING);
      }

      try {
        // Convert request parameters to analytics filters
        const filters = this.convertToAnalyticsFilters(request.parameters);

        // Generate report data based on type
        let reportData;
        switch (request.reportType) {
          case ReportType.SALES_ANALYTICS:
            reportData = await this.analyticsEngine.generateSalesAnalytics(filters);
            break;
          case ReportType.INVENTORY_MOVEMENT:
            reportData = await this.analyticsEngine.generateInventoryMovement(filters);
            break;
          case ReportType.BRANCH_PERFORMANCE:
            reportData = await this.analyticsEngine.generateBranchPerformance(filters);
            break;
          case ReportType.PRODUCT_RANKING:
            reportData = await this.analyticsEngine.generateProductRanking(filters);
            break;
          case ReportType.SAMPLING_ROI:
            reportData = await this.analyticsEngine.generateSamplingROI(filters);
            break;
          case ReportType.PROCUREMENT_ANALYSIS:
            reportData = await this.analyticsEngine.generateProcurementAnalysis(filters);
            break;
          case ReportType.OPERATIONAL_KPI:
            reportData = await this.analyticsEngine.generateRealTimeDashboard(filters.branches);
            break;
          default:
            throw new Error(`Unsupported report type: ${request.reportType}`);
        }

        const executionTime = Date.now() - startTime;
        const dataRowsCount = this.countDataRows(reportData);

        // Cache the result if caching is enabled
        if (request.useCache !== false) {
          const cacheTimeout = request.cacheTimeout || this.defaultCacheTimeout;
          await this.cacheReport(
            cacheKey,
            request.reportType,
            request.parameters,
            reportData,
            executionTime,
            cacheTimeout
          );
        }

        logger.info('Report generated successfully', {
          reportType: request.reportType,
          executionTimeMs: executionTime,
          dataRowsCount,
          fromCache: false
        });

        return {
          success: true,
          data: reportData,
          metadata: {
            reportType: request.reportType,
            parameters: request.parameters,
            generatedAt: new Date(),
            executionTimeMs: executionTime,
            dataRowsCount,
            fromCache: false
          }
        };

      } catch (error) {
        // Mark cache as failed
        if (request.useCache !== false) {
          await this.setCacheStatus(cacheKey, CacheStatus.FAILED);
        }
        throw error;
      }

    } catch (error) {
      logger.error('Error generating report:', error);
      throw error;
    }
  }

  // Export report to various formats
  async exportReport(request: ExportRequest): Promise<ExportResponse> {
    try {
      logger.info('Exporting report', { 
        reportType: request.reportType, 
        format: request.format 
      });

      // Generate the report data first
      const reportRequest: ReportRequest = {
        reportType: request.reportType,
        parameters: request.parameters,
        useCache: true
      };

      const reportResponse = await this.generateReport(reportRequest);

      // Generate export based on format
      let exportResult;
      switch (request.format) {
        case ExportFormat.PDF:
          exportResult = await this.exportToPDF(reportResponse.data, request);
          break;
        case ExportFormat.EXCEL:
          exportResult = await this.exportToExcel(reportResponse.data, request);
          break;
        case ExportFormat.CSV:
          exportResult = await this.exportToCSV(reportResponse.data, request);
          break;
        case ExportFormat.JSON:
          exportResult = await this.exportToJSON(reportResponse.data, request);
          break;
        default:
          throw new Error(`Unsupported export format: ${request.format}`);
      }

      // Store export record
      await this.recordExport(request, exportResult);

      return {
        success: true,
        fileUrl: exportResult.fileUrl,
        fileName: exportResult.fileName,
        fileSize: exportResult.fileSize,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        downloadToken: exportResult.downloadToken
      };

    } catch (error) {
      logger.error('Error exporting report:', error);
      throw error;
    }
  }

  // Get cached report
  private async getCachedReport(cacheKey: string): Promise<ReportCache | null> {
    try {
      const query = `
        SELECT * FROM report_cache 
        WHERE cache_key = $1 
        AND status = 'valid' 
        AND expires_at > CURRENT_TIMESTAMP
      `;

      const result = await this.db.query(query, [cacheKey]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as ReportCache;

    } catch (error) {
      logger.error('Error getting cached report:', error);
      return null;
    }
  }

  // Cache report data
  private async cacheReport(
    cacheKey: string,
    reportType: ReportType,
    parameters: Record<string, any>,
    data: any,
    generationTimeMs: number,
    timeoutMinutes: number
  ): Promise<void> {
    try {
      const dataJson = JSON.stringify(data);
      const dataHash = crypto.createHash('sha256').update(dataJson).digest('hex');
      const dataSizeBytes = Buffer.byteLength(dataJson, 'utf8');
      const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

      const query = `
        INSERT INTO report_cache (
          cache_key, report_type, parameters, data, data_hash,
          status, expires_at, generation_time_ms, data_size_bytes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (cache_key) 
        DO UPDATE SET 
          data = EXCLUDED.data,
          data_hash = EXCLUDED.data_hash,
          status = EXCLUDED.status,
          expires_at = EXCLUDED.expires_at,
          generation_time_ms = EXCLUDED.generation_time_ms,
          data_size_bytes = EXCLUDED.data_size_bytes,
          access_count = 0
      `;

      await this.db.query(query, [
        cacheKey,
        reportType,
        JSON.stringify(parameters),
        dataJson,
        dataHash,
        CacheStatus.VALID,
        expiresAt,
        generationTimeMs,
        dataSizeBytes
      ]);

      logger.debug('Report cached successfully', { 
        cacheKey, 
        dataSizeBytes, 
        expiresAt 
      });

    } catch (error) {
      logger.error('Error caching report:', error);
      // Don't throw - caching failure shouldn't fail the report generation
    }
  }

  // Update cache access statistics
  private async updateCacheAccess(cacheId: string): Promise<void> {
    try {
      const query = `
        UPDATE report_cache 
        SET 
          access_count = access_count + 1,
          last_accessed_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

      await this.db.query(query, [cacheId]);

    } catch (error) {
      logger.error('Error updating cache access:', error);
    }
  }

  // Set cache status
  private async setCacheStatus(cacheKey: string, status: CacheStatus): Promise<void> {
    try {
      const query = `
        INSERT INTO report_cache (cache_key, status, report_type, parameters, data)
        VALUES ($1, $2, 'sales_analytics', '{}', '{}')
        ON CONFLICT (cache_key) 
        DO UPDATE SET status = EXCLUDED.status
      `;

      await this.db.query(query, [cacheKey, status]);

    } catch (error) {
      logger.error('Error setting cache status:', error);
    }
  }

  // Generate cache key
  private generateCacheKey(reportType: ReportType, parameters: Record<string, any>): string {
    const sortedParams = Object.keys(parameters)
      .sort()
      .reduce((result, key) => {
        result[key] = parameters[key];
        return result;
      }, {} as Record<string, any>);

    const paramString = JSON.stringify(sortedParams);
    const hash = crypto.createHash('md5').update(`${reportType}_${paramString}`).digest('hex');
    
    return `${reportType}_${hash}`;
  }

  // Convert request parameters to analytics filters
  private convertToAnalyticsFilters(parameters: Record<string, any>): AnalyticsFilters {
    const filters: AnalyticsFilters = {
      dateRange: {
        start: new Date(),
        end: new Date()
      },
      grouping: {
        timeUnit: 'day',
        dimensions: []
      },
      metrics: []
    };

    // Handle date range
    if (parameters.dateFrom && parameters.dateTo) {
      filters.dateRange.start = new Date(parameters.dateFrom);
      filters.dateRange.end = new Date(parameters.dateTo);
    } else if (parameters.period) {
      const dateRange = this.getPeriodDateRange(parameters.period);
      filters.dateRange = dateRange;
    }

    // Handle filters
    if (parameters.branchId) {
      filters.branches = Array.isArray(parameters.branchId) 
        ? parameters.branchId 
        : [parameters.branchId];
    }

    if (parameters.productId) {
      filters.products = Array.isArray(parameters.productId) 
        ? parameters.productId 
        : [parameters.productId];
    }

    if (parameters.categoryId) {
      filters.categories = Array.isArray(parameters.categoryId) 
        ? parameters.categoryId 
        : [parameters.categoryId];
    }

    if (parameters.supplierId) {
      filters.suppliers = Array.isArray(parameters.supplierId) 
        ? parameters.supplierId 
        : [parameters.supplierId];
    }

    // Handle grouping
    if (parameters.groupBy) {
      filters.grouping.dimensions = Array.isArray(parameters.groupBy) 
        ? parameters.groupBy 
        : [parameters.groupBy];
    }

    // Handle metrics
    if (parameters.metrics) {
      filters.metrics = Array.isArray(parameters.metrics) 
        ? parameters.metrics 
        : [parameters.metrics];
    }

    // Handle comparison
    if (parameters.comparison) {
      filters.comparison = {
        enabled: true,
        period: parameters.comparisonPeriod || TimePeriod.LAST_MONTH
      };
    }

    return filters;
  }

  // Get date range for predefined periods
  private getPeriodDateRange(period: TimePeriod): { start: Date; end: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case TimePeriod.TODAY:
        return { start: today, end: now };
      
      case TimePeriod.YESTERDAY:
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: yesterday, end: yesterday };
      
      case TimePeriod.LAST_7_DAYS:
        const week = new Date(today);
        week.setDate(week.getDate() - 7);
        return { start: week, end: now };
      
      case TimePeriod.LAST_30_DAYS:
        const month = new Date(today);
        month.setDate(month.getDate() - 30);
        return { start: month, end: now };
      
      case TimePeriod.THIS_WEEK:
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());
        return { start: thisWeekStart, end: now };
      
      case TimePeriod.LAST_WEEK:
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
        return { start: lastWeekStart, end: lastWeekEnd };
      
      case TimePeriod.THIS_MONTH:
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: thisMonthStart, end: now };
      
      case TimePeriod.LAST_MONTH:
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: lastMonthStart, end: lastMonthEnd };
      
      case TimePeriod.THIS_QUARTER:
        const quarter = Math.floor(now.getMonth() / 3);
        const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
        return { start: quarterStart, end: now };
      
      case TimePeriod.LAST_QUARTER:
        const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
        const lastQuarterStart = new Date(now.getFullYear(), lastQuarter * 3, 1);
        const lastQuarterEnd = new Date(now.getFullYear(), lastQuarter * 3 + 3, 0);
        return { start: lastQuarterStart, end: lastQuarterEnd };
      
      case TimePeriod.THIS_YEAR:
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return { start: yearStart, end: now };
      
      case TimePeriod.LAST_YEAR:
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
        return { start: lastYearStart, end: lastYearEnd };
      
      default:
        // Default to last 30 days
        const defaultStart = new Date(today);
        defaultStart.setDate(defaultStart.getDate() - 30);
        return { start: defaultStart, end: now };
    }
  }

  // Count data rows in report
  private countDataRows(data: any): number {
    if (!data) return 0;
    
    let count = 0;
    
    // Count rows in different data structures
    Object.values(data).forEach(value => {
      if (Array.isArray(value)) {
        count += value.length;
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(subValue => {
          if (Array.isArray(subValue)) {
            count += subValue.length;
          }
        });
      }
    });
    
    return count;
  }

  // Export to PDF
  private async exportToPDF(data: any, request: ExportRequest): Promise<any> {
    // Implementation for PDF export
    const fileName = request.fileName || `${request.reportType}_${Date.now()}.pdf`;
    const fileUrl = `/exports/${fileName}`;
    const downloadToken = crypto.randomBytes(32).toString('hex');

    return {
      fileUrl,
      fileName,
      fileSize: 0, // Placeholder
      downloadToken
    };
  }

  // Export to Excel
  private async exportToExcel(data: any, request: ExportRequest): Promise<any> {
    // Implementation for Excel export
    const fileName = request.fileName || `${request.reportType}_${Date.now()}.xlsx`;
    const fileUrl = `/exports/${fileName}`;
    const downloadToken = crypto.randomBytes(32).toString('hex');

    return {
      fileUrl,
      fileName,
      fileSize: 0, // Placeholder
      downloadToken
    };
  }

  // Export to CSV
  private async exportToCSV(data: any, request: ExportRequest): Promise<any> {
    // Implementation for CSV export
    const fileName = request.fileName || `${request.reportType}_${Date.now()}.csv`;
    const fileUrl = `/exports/${fileName}`;
    const downloadToken = crypto.randomBytes(32).toString('hex');

    return {
      fileUrl,
      fileName,
      fileSize: 0, // Placeholder
      downloadToken
    };
  }

  // Export to JSON
  private async exportToJSON(data: any, request: ExportRequest): Promise<any> {
    // Implementation for JSON export
    const fileName = request.fileName || `${request.reportType}_${Date.now()}.json`;
    const fileUrl = `/exports/${fileName}`;
    const downloadToken = crypto.randomBytes(32).toString('hex');

    return {
      fileUrl,
      fileName,
      fileSize: Buffer.byteLength(JSON.stringify(data), 'utf8'),
      downloadToken
    };
  }

  // Record export for tracking
  private async recordExport(request: ExportRequest, result: any): Promise<void> {
    try {
      const query = `
        INSERT INTO report_executions (
          report_type, parameters, export_format, execution_start,
          execution_end, status, file_path, file_size_bytes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      await this.db.query(query, [
        request.reportType,
        JSON.stringify(request.parameters),
        request.format,
        new Date(),
        new Date(),
        'completed',
        result.fileUrl,
        result.fileSize
      ]);

    } catch (error) {
      logger.error('Error recording export:', error);
    }
  }

  // Clean expired cache
  async cleanExpiredCache(): Promise<number> {
    try {
      const query = `SELECT clean_expired_cache()`;
      const result = await this.db.query(query);
      
      const deletedCount = result.rows[0].clean_expired_cache;
      logger.info('Cleaned expired cache', { deletedCount });
      
      return deletedCount;

    } catch (error) {
      logger.error('Error cleaning expired cache:', error);
      return 0;
    }
  }

  // Invalidate cache by pattern
  async invalidateCache(pattern: string = '%'): Promise<number> {
    try {
      const query = `SELECT invalidate_report_cache($1)`;
      const result = await this.db.query(query, [pattern]);
      
      const invalidatedCount = result.rows[0].invalidate_report_cache;
      logger.info('Invalidated cache', { pattern, invalidatedCount });
      
      return invalidatedCount;

    } catch (error) {
      logger.error('Error invalidating cache:', error);
      return 0;
    }
  }

  // Refresh materialized views
  async refreshMaterializedViews(): Promise<void> {
    try {
      const query = `SELECT refresh_analytics_views()`;
      await this.db.query(query);
      
      logger.info('Refreshed materialized views');

    } catch (error) {
      logger.error('Error refreshing materialized views:', error);
      throw error;
    }
  }

  // Get cache statistics
  async getCacheStatistics(): Promise<{
    totalCacheEntries: number;
    validEntries: number;
    expiredEntries: number;
    totalCacheSize: number;
    avgGenerationTime: number;
    hitRate: number;
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_cache_entries,
          COUNT(*) FILTER (WHERE status = 'valid' AND expires_at > CURRENT_TIMESTAMP) as valid_entries,
          COUNT(*) FILTER (WHERE status = 'expired' OR expires_at <= CURRENT_TIMESTAMP) as expired_entries,
          COALESCE(SUM(data_size_bytes), 0) as total_cache_size,
          COALESCE(AVG(generation_time_ms), 0) as avg_generation_time,
          CASE 
            WHEN SUM(access_count) > 0 THEN 
              (COUNT(*) FILTER (WHERE access_count > 0)::DECIMAL / COUNT(*) * 100)
            ELSE 0 
          END as hit_rate
        FROM report_cache
      `;

      const result = await this.db.query(query);
      const stats = result.rows[0];

      return {
        totalCacheEntries: parseInt(stats.total_cache_entries),
        validEntries: parseInt(stats.valid_entries),
        expiredEntries: parseInt(stats.expired_entries),
        totalCacheSize: parseInt(stats.total_cache_size),
        avgGenerationTime: parseFloat(stats.avg_generation_time),
        hitRate: parseFloat(stats.hit_rate)
      };

    } catch (error) {
      logger.error('Error getting cache statistics:', error);
      throw error;
    }
  }
}

export default ReportingService;