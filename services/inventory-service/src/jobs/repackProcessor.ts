import cron from 'node-cron';
import { RepackService } from '../services/RepackService';
import { RepackOrderStatus } from '@dried-fruits/types';
import DatabaseConnection from '../database/connection';
import logger from '../utils/logger';

export class RepackProcessor {
  private repackService = new RepackService();
  private db = DatabaseConnection.getInstance();
  private isRunning = false;

  start(): void {
    // Run every hour to check for ready repack orders
    cron.schedule('0 * * * *', async () => {
      if (this.isRunning) {
        logger.debug('Repack processor already running, skipping this cycle');
        return;
      }

      try {
        this.isRunning = true;
        await this.processReadyOrders();
        await this.checkOverdueOrders();
        await this.generateRepackSuggestions();
      } catch (error) {
        logger.error('Repack processor failed:', error);
      } finally {
        this.isRunning = false;
      }
    });

    logger.info('Repack processor started');
  }

  private async processReadyOrders(): Promise<void> {
    try {
      const readyOrders = await this.repackService.getReadyForProcessing();
      
      if (readyOrders.length === 0) {
        logger.debug('No repack orders ready for processing');
        return;
      }

      logger.info(`Found ${readyOrders.length} repack orders ready for processing`);

      for (const order of readyOrders) {
        try {
          // Validate feasibility before processing
          const validation = await this.repackService.validateRepackFeasibility(order.id);
          
          if (!validation.isValid) {
            // Log validation issues but don't auto-cancel
            logger.warn('Repack order not feasible', {
              repackOrderId: order.id,
              repackNumber: order.repackNumber,
              validationIssues: validation.validationResults.filter(r => !r.isValid),
            });
            
            // Publish validation failure event
            await this.db.publishEvent('repack.orders', 'validation_failed', {
              repackOrderId: order.id,
              repackNumber: order.repackNumber,
              branchId: order.branchId,
              validationResults: validation.validationResults,
            });
            
            continue;
          }

          // Publish ready for processing event
          await this.db.publishEvent('repack.orders', 'ready_for_processing', {
            repackOrderId: order.id,
            repackNumber: order.repackNumber,
            branchId: order.branchId,
            targetProductId: order.targetProduct.productId,
            expectedQuantity: order.targetProduct.expectedQuantity,
            sourceItemsCount: order.sourceItems.length,
          });

          logger.info('Repack order ready for processing', {
            repackOrderId: order.id,
            repackNumber: order.repackNumber,
            branchId: order.branchId,
          });

        } catch (error) {
          logger.error('Error processing repack order', {
            repackOrderId: order.id,
            error: (error as Error).message,
          });
        }
      }
    } catch (error) {
      logger.error('Error getting ready repack orders:', error);
    }
  }

  private async checkOverdueOrders(): Promise<void> {
    try {
      // Find orders that are overdue (scheduled more than 24 hours ago but still planned)
      const overdueQuery = `
        SELECT ro.*, tp.name as target_product_name, b.name as branch_name
        FROM inventory.repack_orders ro
        JOIN public.products tp ON ro.target_product_id = tp.id
        JOIN public.branches b ON ro.branch_id = b.id
        WHERE ro.status = $1 
          AND ro.scheduled_date < NOW() - INTERVAL '24 hours'
      `;

      const result = await this.db.query(overdueQuery, [RepackOrderStatus.PLANNED]);
      
      if (result.rows.length === 0) {
        return;
      }

      logger.warn(`Found ${result.rows.length} overdue repack orders`);

      for (const row of result.rows) {
        // Publish overdue alert
        await this.db.publishEvent('repack.orders', 'overdue', {
          repackOrderId: row.id,
          repackNumber: row.repack_number,
          branchId: row.branch_id,
          branchName: row.branch_name,
          targetProductName: row.target_product_name,
          scheduledDate: row.scheduled_date,
          hoursOverdue: Math.floor((Date.now() - new Date(row.scheduled_date).getTime()) / (1000 * 60 * 60)),
        });

        logger.warn('Overdue repack order detected', {
          repackOrderId: row.id,
          repackNumber: row.repack_number,
          branchName: row.branch_name,
          scheduledDate: row.scheduled_date,
        });
      }
    } catch (error) {
      logger.error('Error checking overdue repack orders:', error);
    }
  }

  private async generateRepackSuggestions(): Promise<void> {
    try {
      // Get all active branches
      const branchesQuery = `
        SELECT id, name FROM public.branches 
        WHERE status = 'active'
      `;

      const branchesResult = await this.db.query(branchesQuery);
      
      for (const branch of branchesResult.rows) {
        try {
          const suggestions = await this.repackService.suggestRepackOpportunities(branch.id);
          
          if (suggestions.length > 0) {
            // Publish suggestion event
            await this.db.publishEvent('repack.orders', 'suggestions_generated', {
              branchId: branch.id,
              branchName: branch.name,
              suggestionsCount: suggestions.length,
              suggestions: suggestions.slice(0, 5), // Top 5 suggestions
            });

            logger.info('Repack suggestions generated', {
              branchId: branch.id,
              branchName: branch.name,
              suggestionsCount: suggestions.length,
            });
          }
        } catch (error) {
          logger.error(`Error generating suggestions for branch ${branch.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error generating repack suggestions:', error);
    }
  }

  async processRepackOrderAutomatically(repackOrderId: string): Promise<boolean> {
    try {
      const order = await this.repackService.getRepackOrder(repackOrderId);
      if (!order) {
        logger.error('Repack order not found for automatic processing', { repackOrderId });
        return false;
      }

      if (order.status !== RepackOrderStatus.PLANNED) {
        logger.warn('Repack order not in planned status for automatic processing', {
          repackOrderId,
          status: order.status,
        });
        return false;
      }

      // Validate feasibility
      const validation = await this.repackService.validateRepackFeasibility(repackOrderId);
      if (!validation.isValid) {
        logger.warn('Repack order not feasible for automatic processing', {
          repackOrderId,
          validationIssues: validation.validationResults.filter(r => !r.isValid),
        });
        return false;
      }

      // For automatic processing, we would need:
      // 1. Robotic systems to handle the physical repack
      // 2. Weight/quantity sensors for accurate measurements
      // 3. Quality control cameras
      // 4. Automated packaging systems

      // For now, we just mark it as ready and notify operators
      await this.db.publishEvent('repack.orders', 'auto_process_ready', {
        repackOrderId,
        repackNumber: order.repackNumber,
        branchId: order.branchId,
        message: 'Order validated and ready for automatic processing',
      });

      logger.info('Repack order prepared for automatic processing', {
        repackOrderId,
        repackNumber: order.repackNumber,
      });

      return true;
    } catch (error) {
      logger.error('Error in automatic repack processing:', {
        repackOrderId,
        error: (error as Error).message,
      });
      return false;
    }
  }
}