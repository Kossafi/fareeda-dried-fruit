import cron from 'node-cron';
import DatabaseConnection from '../database/connection';
import { config } from '../config';
import logger from '../utils/logger';

export class AlertChecker {
  private db = DatabaseConnection.getInstance();
  private isRunning = false;

  start(): void {
    // Run every 5 minutes by default
    const schedule = `*/${config.inventory.alertCheckInterval / 60} * * * *`;
    
    cron.schedule(schedule, async () => {
      if (this.isRunning) {
        logger.debug('Alert checker already running, skipping this cycle');
        return;
      }

      try {
        this.isRunning = true;
        await this.checkLowStockAlerts();
        await this.checkExpiringItems();
        await this.cleanupOldAlerts();
      } catch (error) {
        logger.error('Alert checker failed:', error);
      } finally {
        this.isRunning = false;
      }
    });

    logger.info(`Alert checker started with schedule: ${schedule}`);
  }

  private async checkLowStockAlerts(): Promise<void> {
    const query = `
      SELECT ii.id, ii.product_id, ii.branch_id, ii.current_stock, ii.reserved_stock,
             ii.available_stock, ii.min_stock_level, ii.reorder_point,
             p.name as product_name, p.sku as product_sku, b.name as branch_name
      FROM inventory.inventory_items ii
      JOIN public.products p ON ii.product_id = p.id
      JOIN public.branches b ON ii.branch_id = b.id
      WHERE ii.available_stock <= ii.reorder_point
        AND NOT EXISTS (
          SELECT 1 FROM inventory.low_stock_alerts lsa 
          WHERE lsa.inventory_item_id = ii.id 
            AND lsa.status = 'active'
            AND lsa.created_at > NOW() - INTERVAL '1 hour'
        )
    `;

    const result = await this.db.query(query);
    
    for (const row of result.rows) {
      await this.createLowStockAlert(row);
    }

    if (result.rows.length > 0) {
      logger.info(`Created ${result.rows.length} low stock alerts`);
    }
  }

  private async createLowStockAlert(item: any): Promise<void> {
    const alertLevel = item.available_stock <= (item.min_stock_level * config.inventory.criticalStockThreshold)
      ? 'critical'
      : 'warning';

    const alertId = require('uuid').v4();
    
    const query = `
      INSERT INTO inventory.low_stock_alerts (
        id, inventory_item_id, alert_level, current_stock, min_stock_level,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await this.db.query(query, [
      alertId,
      item.id,
      alertLevel,
      item.available_stock,
      item.min_stock_level,
      'active',
      new Date(),
      new Date(),
    ]);

    // Publish alert event
    await this.db.publishEvent('stock.alerts', '', {
      alertId,
      inventoryItemId: item.id,
      productId: item.product_id,
      productName: item.product_name,
      productSku: item.product_sku,
      branchId: item.branch_id,
      branchName: item.branch_name,
      alertLevel,
      currentStock: item.current_stock,
      availableStock: item.available_stock,
      minStockLevel: item.min_stock_level,
      reorderPoint: item.reorder_point,
    });

    logger.warn('Low stock alert created', {
      alertId,
      inventoryItemId: item.id,
      productName: item.product_name,
      branchName: item.branch_name,
      alertLevel,
      availableStock: item.available_stock,
      reorderPoint: item.reorder_point,
    });
  }

  private async checkExpiringItems(): Promise<void> {
    const query = `
      SELECT ii.id, ii.product_id, ii.branch_id, ii.expiration_date,
             ii.current_stock, ii.batch_number,
             p.name as product_name, p.sku as product_sku, b.name as branch_name,
             EXTRACT(DAYS FROM ii.expiration_date - NOW()) as days_until_expiry
      FROM inventory.inventory_items ii
      JOIN public.products p ON ii.product_id = p.id
      JOIN public.branches b ON ii.branch_id = b.id
      WHERE ii.expiration_date IS NOT NULL
        AND ii.expiration_date <= NOW() + INTERVAL '30 days'
        AND ii.current_stock > 0
    `;

    const result = await this.db.query(query);
    
    for (const row of result.rows) {
      await this.publishExpirationAlert(row);
    }

    if (result.rows.length > 0) {
      logger.info(`Found ${result.rows.length} items expiring soon`);
    }
  }

  private async publishExpirationAlert(item: any): Promise<void> {
    const daysUntilExpiry = Math.ceil(item.days_until_expiry);
    let alertLevel = 'warning';
    
    if (daysUntilExpiry <= 3) {
      alertLevel = 'critical';
    } else if (daysUntilExpiry <= 7) {
      alertLevel = 'warning';
    } else {
      alertLevel = 'info';
    }

    // Publish expiration alert event
    await this.db.publishEvent('inventory.events', 'expiration.alert', {
      inventoryItemId: item.id,
      productId: item.product_id,
      productName: item.product_name,
      productSku: item.product_sku,
      branchId: item.branch_id,
      branchName: item.branch_name,
      expirationDate: item.expiration_date,
      daysUntilExpiry,
      alertLevel,
      currentStock: item.current_stock,
      batchNumber: item.batch_number,
    });

    logger.info('Expiration alert published', {
      inventoryItemId: item.id,
      productName: item.product_name,
      branchName: item.branch_name,
      daysUntilExpiry,
      alertLevel,
    });
  }

  private async cleanupOldAlerts(): Promise<void> {
    // Resolve alerts where stock is now above reorder point
    const resolveQuery = `
      UPDATE inventory.low_stock_alerts 
      SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
      WHERE status = 'active'
        AND EXISTS (
          SELECT 1 FROM inventory.inventory_items ii 
          WHERE ii.id = inventory_item_id 
            AND ii.available_stock > ii.reorder_point
        )
    `;

    const resolveResult = await this.db.query(resolveQuery);
    
    if (resolveResult.rowCount && resolveResult.rowCount > 0) {
      logger.info(`Resolved ${resolveResult.rowCount} low stock alerts`);
    }

    // Delete old resolved alerts (older than 30 days)
    const deleteQuery = `
      DELETE FROM inventory.low_stock_alerts 
      WHERE status = 'resolved' 
        AND resolved_at < NOW() - INTERVAL '30 days'
    `;

    const deleteResult = await this.db.query(deleteQuery);
    
    if (deleteResult.rowCount && deleteResult.rowCount > 0) {
      logger.info(`Deleted ${deleteResult.rowCount} old resolved alerts`);
    }
  }
}