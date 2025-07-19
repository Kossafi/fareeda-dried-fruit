import cron from 'node-cron';
import DatabaseConnection from '../database/connection';
import ReportingService from './ReportingService';
import { 
  ReportSchedule, 
  ReportType,
  ExportFormat,
  ScheduleFrequency 
} from '@dried-fruits/types';
import logger from '../utils/logger';

export class ReportSchedulerService {
  private db: DatabaseConnection;
  private reportingService: ReportingService;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.db = DatabaseConnection.getInstance();
    this.reportingService = new ReportingService();
  }

  // Initialize all scheduled reports
  async initializeScheduledReports(): Promise<void> {
    try {
      logger.info('Initializing scheduled reports');

      // Get all active schedules
      const schedules = await this.getActiveSchedules();

      // Schedule each report
      for (const schedule of schedules) {
        await this.scheduleReport(schedule);
      }

      // Schedule cleanup jobs
      this.scheduleCleanupJobs();

      logger.info('Scheduled reports initialized', { 
        count: schedules.length 
      });

    } catch (error) {
      logger.error('Error initializing scheduled reports:', error);
      throw error;
    }
  }

  // Schedule a single report
  async scheduleReport(schedule: ReportSchedule): Promise<void> {
    try {
      const cronExpression = this.getCronExpression(schedule.frequency, schedule.nextRunAt);
      
      const task = cron.schedule(cronExpression, async () => {
        await this.executeScheduledReport(schedule.id);
      }, {
        scheduled: false,
        timezone: 'Asia/Bangkok' // Thailand timezone
      });

      // Store the task
      this.scheduledJobs.set(schedule.id, task);
      
      // Start the task
      task.start();

      logger.info('Report scheduled', {
        scheduleId: schedule.id,
        scheduleName: schedule.scheduleName,
        cronExpression,
        nextRun: schedule.nextRunAt
      });

    } catch (error) {
      logger.error('Error scheduling report:', error);
      throw error;
    }
  }

  // Execute a scheduled report
  async executeScheduledReport(scheduleId: string): Promise<void> {
    try {
      logger.info('Executing scheduled report', { scheduleId });

      // Get schedule details
      const schedule = await this.getScheduleById(scheduleId);
      if (!schedule || !schedule.isActive) {
        logger.warn('Schedule not found or inactive', { scheduleId });
        return;
      }

      // Create execution record
      const executionId = await this.createExecutionRecord(schedule);

      try {
        // Generate and export report
        const exportResult = await this.reportingService.exportReport({
          reportType: schedule.reportType,
          format: schedule.exportFormat,
          parameters: schedule.parameters,
          fileName: `${schedule.scheduleName}_${new Date().toISOString().split('T')[0]}`
        });

        // Update execution record with success
        await this.updateExecutionRecord(executionId, {
          status: 'completed',
          filePath: exportResult.fileUrl,
          fileSizeBytes: exportResult.fileSize,
          executionEnd: new Date()
        });

        // Send report to recipients
        if (schedule.recipients && schedule.recipients.length > 0) {
          await this.sendReportToRecipients(schedule, exportResult);
        }

        // Update schedule for next run
        await this.updateScheduleNextRun(scheduleId, schedule.frequency);

        logger.info('Scheduled report executed successfully', {
          scheduleId,
          executionId,
          fileName: exportResult.fileName,
          recipientCount: schedule.recipients?.length || 0
        });

      } catch (error) {
        // Update execution record with failure
        await this.updateExecutionRecord(executionId, {
          status: 'failed',
          errorMessage: error.message,
          executionEnd: new Date()
        });

        logger.error('Scheduled report execution failed:', error);
        throw error;
      }

    } catch (error) {
      logger.error('Error executing scheduled report:', error);
    }
  }

  // Get active schedules from database
  private async getActiveSchedules(): Promise<ReportSchedule[]> {
    const query = `
      SELECT * FROM report_schedules 
      WHERE is_active = true 
      AND next_run_at <= CURRENT_TIMESTAMP + INTERVAL '1 minute'
      ORDER BY next_run_at
    `;

    const result = await this.db.query(query);
    return result.rows as ReportSchedule[];
  }

  // Get schedule by ID
  private async getScheduleById(scheduleId: string): Promise<ReportSchedule | null> {
    const query = `SELECT * FROM report_schedules WHERE id = $1`;
    const result = await this.db.query(query, [scheduleId]);
    
    return result.rows.length > 0 ? result.rows[0] as ReportSchedule : null;
  }

  // Create execution record
  private async createExecutionRecord(schedule: ReportSchedule): Promise<string> {
    const query = `
      INSERT INTO report_executions (
        schedule_id, report_type, parameters, export_format, status
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const result = await this.db.query(query, [
      schedule.id,
      schedule.reportType,
      JSON.stringify(schedule.parameters),
      schedule.exportFormat,
      'running'
    ]);

    return result.rows[0].id;
  }

  // Update execution record
  private async updateExecutionRecord(
    executionId: string, 
    updates: {
      status?: string;
      filePath?: string;
      fileSizeBytes?: number;
      errorMessage?: string;
      executionEnd?: Date;
    }
  ): Promise<void> {
    const setClause = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        setClause.push(`${dbKey} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (setClause.length === 0) return;

    values.push(executionId);

    const query = `
      UPDATE report_executions 
      SET ${setClause.join(', ')}, execution_time_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - execution_start)) * 1000
      WHERE id = $${paramCount}
    `;

    await this.db.query(query, values);
  }

  // Update schedule next run time
  private async updateScheduleNextRun(scheduleId: string, frequency: ScheduleFrequency): Promise<void> {
    const query = `
      UPDATE report_schedules 
      SET 
        next_run_at = calculate_next_run($1, CURRENT_TIMESTAMP),
        last_run_at = CURRENT_TIMESTAMP,
        last_run_status = 'completed',
        run_count = run_count + 1
      WHERE id = $2
    `;

    await this.db.query(query, [frequency, scheduleId]);
  }

  // Send report to recipients
  private async sendReportToRecipients(
    schedule: ReportSchedule, 
    exportResult: any
  ): Promise<void> {
    try {
      // This would integrate with email service
      logger.info('Sending report to recipients', {
        scheduleId: schedule.id,
        recipients: schedule.recipients,
        fileName: exportResult.fileName
      });

      // TODO: Implement email sending
      // await emailService.sendReport({
      //   recipients: schedule.recipients,
      //   subject: `Automated Report: ${schedule.scheduleName}`,
      //   attachmentUrl: exportResult.fileUrl,
      //   attachmentName: exportResult.fileName
      // });

    } catch (error) {
      logger.error('Error sending report to recipients:', error);
    }
  }

  // Get cron expression for frequency
  private getCronExpression(frequency: ScheduleFrequency, nextRun: Date): string {
    const minute = nextRun.getMinutes();
    const hour = nextRun.getHours();
    const dayOfMonth = nextRun.getDate();
    const month = nextRun.getMonth() + 1;
    const dayOfWeek = nextRun.getDay();

    switch (frequency) {
      case ScheduleFrequency.DAILY:
        return `${minute} ${hour} * * *`;
      
      case ScheduleFrequency.WEEKLY:
        return `${minute} ${hour} * * ${dayOfWeek}`;
      
      case ScheduleFrequency.MONTHLY:
        return `${minute} ${hour} ${dayOfMonth} * *`;
      
      case ScheduleFrequency.QUARTERLY:
        // Run every 3 months on the same day
        return `${minute} ${hour} ${dayOfMonth} */3 *`;
      
      case ScheduleFrequency.YEARLY:
        return `${minute} ${hour} ${dayOfMonth} ${month} *`;
      
      default:
        // Default to daily
        return `${minute} ${hour} * * *`;
    }
  }

  // Schedule cleanup jobs
  private scheduleCleanupJobs(): void {
    // Clean expired cache every hour
    cron.schedule('0 * * * *', async () => {
      try {
        const deletedCount = await this.reportingService.cleanExpiredCache();
        logger.info('Cache cleanup completed', { deletedCount });
      } catch (error) {
        logger.error('Cache cleanup failed:', error);
      }
    });

    // Refresh materialized views every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      try {
        await this.reportingService.refreshMaterializedViews();
        logger.info('Materialized views refreshed');
      } catch (error) {
        logger.error('Materialized views refresh failed:', error);
      }
    });

    // Clean old execution records monthly
    cron.schedule('0 2 1 * *', async () => {
      try {
        const deletedCount = await this.cleanOldExecutionRecords();
        logger.info('Old execution records cleaned', { deletedCount });
      } catch (error) {
        logger.error('Execution records cleanup failed:', error);
      }
    });

    logger.info('Cleanup jobs scheduled');
  }

  // Clean old execution records
  private async cleanOldExecutionRecords(): Promise<number> {
    const query = `
      DELETE FROM report_executions 
      WHERE execution_start < CURRENT_TIMESTAMP - INTERVAL '6 months'
    `;

    const result = await this.db.query(query);
    return result.rowCount;
  }

  // Add new schedule
  async addSchedule(scheduleData: {
    scheduleName: string;
    reportType: ReportType;
    frequency: ScheduleFrequency;
    parameters: Record<string, any>;
    exportFormat: ExportFormat;
    recipients: string[];
    createdBy: string;
    startDate?: Date;
  }): Promise<ReportSchedule> {
    try {
      const nextRunAt = scheduleData.startDate || this.calculateNextRun(scheduleData.frequency);

      const query = `
        INSERT INTO report_schedules (
          schedule_name, report_type, frequency, parameters,
          export_format, recipients, next_run_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await this.db.query(query, [
        scheduleData.scheduleName,
        scheduleData.reportType,
        scheduleData.frequency,
        JSON.stringify(scheduleData.parameters),
        scheduleData.exportFormat,
        scheduleData.recipients,
        nextRunAt,
        scheduleData.createdBy
      ]);

      const schedule = result.rows[0] as ReportSchedule;

      // Schedule the report
      await this.scheduleReport(schedule);

      logger.info('Report schedule added', {
        scheduleId: schedule.id,
        scheduleName: schedule.scheduleName
      });

      return schedule;

    } catch (error) {
      logger.error('Error adding report schedule:', error);
      throw error;
    }
  }

  // Remove schedule
  async removeSchedule(scheduleId: string): Promise<void> {
    try {
      // Stop the cron job
      const task = this.scheduledJobs.get(scheduleId);
      if (task) {
        task.stop();
        this.scheduledJobs.delete(scheduleId);
      }

      // Deactivate in database
      const query = `
        UPDATE report_schedules 
        SET is_active = false 
        WHERE id = $1
      `;

      await this.db.query(query, [scheduleId]);

      logger.info('Report schedule removed', { scheduleId });

    } catch (error) {
      logger.error('Error removing report schedule:', error);
      throw error;
    }
  }

  // Calculate next run time
  private calculateNextRun(frequency: ScheduleFrequency, from?: Date): Date {
    const now = from || new Date();
    
    switch (frequency) {
      case ScheduleFrequency.DAILY:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      case ScheduleFrequency.WEEKLY:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      case ScheduleFrequency.MONTHLY:
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      
      case ScheduleFrequency.QUARTERLY:
        const nextQuarter = new Date(now);
        nextQuarter.setMonth(nextQuarter.getMonth() + 3);
        return nextQuarter;
      
      case ScheduleFrequency.YEARLY:
        const nextYear = new Date(now);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear;
      
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  // Get schedule statistics
  async getScheduleStatistics(): Promise<{
    totalSchedules: number;
    activeSchedules: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    avgExecutionTime: number;
  }> {
    const query = `
      SELECT 
        COUNT(DISTINCT rs.id) as total_schedules,
        COUNT(DISTINCT rs.id) FILTER (WHERE rs.is_active = true) as active_schedules,
        COUNT(re.id) as total_executions,
        COUNT(re.id) FILTER (WHERE re.status = 'completed') as successful_executions,
        COUNT(re.id) FILTER (WHERE re.status = 'failed') as failed_executions,
        COALESCE(AVG(re.execution_time_ms), 0) as avg_execution_time
      FROM report_schedules rs
      LEFT JOIN report_executions re ON rs.id = re.schedule_id
      WHERE rs.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
    `;

    const result = await this.db.query(query);
    const stats = result.rows[0];

    return {
      totalSchedules: parseInt(stats.total_schedules),
      activeSchedules: parseInt(stats.active_schedules),
      totalExecutions: parseInt(stats.total_executions),
      successfulExecutions: parseInt(stats.successful_executions),
      failedExecutions: parseInt(stats.failed_executions),
      avgExecutionTime: parseFloat(stats.avg_execution_time)
    };
  }

  // Shutdown all scheduled jobs
  shutdown(): void {
    logger.info('Shutting down report scheduler');
    
    this.scheduledJobs.forEach((task, scheduleId) => {
      task.stop();
      logger.debug('Stopped scheduled task', { scheduleId });
    });
    
    this.scheduledJobs.clear();
  }
}

export default ReportSchedulerService;