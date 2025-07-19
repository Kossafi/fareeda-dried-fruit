import DatabaseConnection from '../database/connection';
import StockAlert from '../models/StockAlert';
import AlertThreshold from '../models/AlertThreshold';
import AlertSubscription from '../models/AlertSubscription';
import NotificationDelivery from '../models/NotificationDelivery';
import { AlertType, AlertSeverity, UnitType, NotificationChannel } from '@dried-fruits/types';
import NotificationService from './NotificationService';
import logger from '../utils/logger';

export class StockMonitoringService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  // Main method to check all stock levels and create alerts
  async checkAllStockLevels(): Promise<void> {
    try {
      logger.info('Starting stock level monitoring check');
      
      const db = DatabaseConnection.getInstance();
      
      // Get all inventory items with their current stock levels
      const query = `
        SELECT 
          ii.id as inventory_item_id,
          ii.product_id,
          ii.branch_id,
          ii.quantity_in_stock as current_stock,
          ii.unit,
          ii.batch_number,
          ii.expiration_date,
          p.name as product_name,
          p.sku as product_sku,
          b.name as branch_name,
          c.id as category_id,
          c.name as category_name,
          at.minimum_stock_level,
          at.reorder_point,
          at.maximum_stock_level,
          at.id as threshold_id
        FROM inventory_items ii
        JOIN products p ON ii.product_id = p.id
        JOIN branches b ON ii.branch_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN alert_thresholds at ON ii.branch_id = at.branch_id AND ii.product_id = at.product_id
        WHERE ii.is_active = true
        AND (at.is_active = true OR at.id IS NULL)
        ORDER BY ii.branch_id, ii.product_id
      `;

      const result = await db.query(query);
      const inventoryItems = result.rows;

      logger.info(`Checking ${inventoryItems.length} inventory items for stock alerts`);

      // Process each inventory item
      for (const item of inventoryItems) {
        await this.checkInventoryItem(item);
      }

      // Check for expiring items
      await this.checkExpiringItems();

      // Auto-resolve old alerts
      await this.autoResolveOldAlerts();

      logger.info('Stock level monitoring check completed');

    } catch (error) {
      logger.error('Error in stock monitoring check:', error);
      throw error;
    }
  }

  // Check individual inventory item for alerts
  private async checkInventoryItem(item: any): Promise<void> {
    try {
      const stockAlert = new StockAlert();
      
      // Check if we already have an active alert for this item
      const existingAlert = await stockAlert.checkExistingAlert(
        item.branch_id,
        item.product_id,
        'low_stock'
      );

      // If no threshold is set, skip this item
      if (!item.threshold_id) {
        return;
      }

      const currentStock = parseFloat(item.current_stock);
      const minimumLevel = parseFloat(item.minimum_stock_level);
      const reorderPoint = parseFloat(item.reorder_point);

      // Determine alert type and severity
      let alertType: AlertType;
      let severity: AlertSeverity;
      let shouldCreateAlert = false;

      if (currentStock <= 0) {
        alertType = 'out_of_stock';
        severity = 'critical';
        shouldCreateAlert = true;
      } else if (currentStock <= minimumLevel) {
        alertType = 'low_stock';
        severity = 'high';
        shouldCreateAlert = true;
      } else if (currentStock <= reorderPoint) {
        alertType = 'low_stock';
        severity = 'medium';
        shouldCreateAlert = true;
      }

      // Create alert if needed and no existing active alert
      if (shouldCreateAlert && !existingAlert) {
        await this.createStockAlert({
          alertType,
          severity,
          branchId: item.branch_id,
          productId: item.product_id,
          inventoryItemId: item.inventory_item_id,
          currentStockLevel: currentStock,
          thresholdLevel: alertType === 'out_of_stock' ? 0 : (currentStock <= minimumLevel ? minimumLevel : reorderPoint),
          unit: item.unit,
          productName: item.product_name,
          productSku: item.product_sku,
          branchName: item.branch_name,
          categoryId: item.category_id
        });
      }

      // Resolve alert if stock level is now above reorder point
      if (existingAlert && currentStock > reorderPoint) {
        await stockAlert.resolve(existingAlert.id!, 'system');
        logger.info(`Auto-resolved stock alert ${existingAlert.alertNumber} - stock level restored`);
      }

    } catch (error) {
      logger.error(`Error checking inventory item ${item.inventory_item_id}:`, error);
    }
  }

  // Check for items approaching expiry
  private async checkExpiringItems(): Promise<void> {
    try {
      const db = DatabaseConnection.getInstance();
      
      // Get items expiring within next 7 days
      const query = `
        SELECT 
          ii.id as inventory_item_id,
          ii.product_id,
          ii.branch_id,
          ii.quantity_in_stock as current_stock,
          ii.unit,
          ii.batch_number,
          ii.expiration_date,
          p.name as product_name,
          p.sku as product_sku,
          b.name as branch_name,
          c.id as category_id,
          EXTRACT(DAYS FROM (ii.expiration_date - CURRENT_DATE)) as days_to_expiry
        FROM inventory_items ii
        JOIN products p ON ii.product_id = p.id
        JOIN branches b ON ii.branch_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ii.is_active = true
        AND ii.expiration_date IS NOT NULL
        AND ii.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND ii.quantity_in_stock > 0
      `;

      const result = await db.query(query);
      const expiringItems = result.rows;

      for (const item of expiringItems) {
        const stockAlert = new StockAlert();
        
        // Check if we already have an expiry alert for this item
        const existingAlert = await stockAlert.checkExistingAlert(
          item.branch_id,
          item.product_id,
          'approaching_expiry'
        );

        if (!existingAlert) {
          const daysToExpiry = parseInt(item.days_to_expiry);
          let severity: AlertSeverity = 'low';
          
          if (daysToExpiry <= 1) {
            severity = 'critical';
          } else if (daysToExpiry <= 3) {
            severity = 'high';
          } else if (daysToExpiry <= 5) {
            severity = 'medium';
          }

          await this.createStockAlert({
            alertType: 'approaching_expiry',
            severity,
            branchId: item.branch_id,
            productId: item.product_id,
            inventoryItemId: item.inventory_item_id,
            currentStockLevel: parseFloat(item.current_stock),
            thresholdLevel: daysToExpiry,
            unit: item.unit,
            productName: item.product_name,
            productSku: item.product_sku,
            branchName: item.branch_name,
            categoryId: item.category_id,
            expirationDate: new Date(item.expiration_date),
            batchNumber: item.batch_number
          });
        }
      }

      logger.info(`Checked expiring items, found ${expiringItems.length} items expiring within 7 days`);

    } catch (error) {
      logger.error('Error checking expiring items:', error);
    }
  }

  // Create stock alert and trigger notifications
  private async createStockAlert(alertData: {
    alertType: AlertType;
    severity: AlertSeverity;
    branchId: string;
    productId: string;
    inventoryItemId: string;
    currentStockLevel: number;
    thresholdLevel: number;
    unit: UnitType;
    productName: string;
    productSku: string;
    branchName: string;
    categoryId?: string;
    expirationDate?: Date;
    batchNumber?: string;
  }): Promise<StockAlert> {
    try {
      const stockAlert = new StockAlert();
      const alertThreshold = new AlertThreshold();

      // Calculate suggested reorder quantity
      let suggestedReorderQuantity = 0;
      if (alertData.alertType === 'low_stock' || alertData.alertType === 'out_of_stock') {
        suggestedReorderQuantity = await alertThreshold.calculateSuggestedReorderQuantity(
          alertData.branchId,
          alertData.productId,
          alertData.currentStockLevel
        );
      }

      // Generate alert title and message
      const { title, message } = this.generateAlertContent(alertData, suggestedReorderQuantity);

      // Set expiration date for alert
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.getAlertExpiryDays(alertData.severity));

      // Create the alert
      const alert = await stockAlert.create({
        alertType: alertData.alertType,
        severity: alertData.severity,
        branchId: alertData.branchId,
        productId: alertData.productId,
        inventoryItemId: alertData.inventoryItemId,
        currentStockLevel: alertData.currentStockLevel,
        thresholdLevel: alertData.thresholdLevel,
        suggestedReorderQuantity,
        unit: alertData.unit,
        title,
        message,
        additionalData: {
          productName: alertData.productName,
          productSku: alertData.productSku,
          branchName: alertData.branchName,
          categoryId: alertData.categoryId,
          expirationDate: alertData.expirationDate,
          batchNumber: alertData.batchNumber
        },
        expiresAt
      });

      // Send notifications
      await this.sendAlertNotifications(alert, alertData);

      logger.info(`Created stock alert: ${alert.alertNumber} for ${alertData.alertType}`);

      return alert;

    } catch (error) {
      logger.error('Error creating stock alert:', error);
      throw error;
    }
  }

  // Generate alert title and message
  private generateAlertContent(alertData: {
    alertType: AlertType;
    severity: AlertSeverity;
    productName: string;
    productSku: string;
    branchName: string;
    currentStockLevel: number;
    thresholdLevel: number;
    unit: UnitType;
    expirationDate?: Date;
    batchNumber?: string;
  }, suggestedReorderQuantity: number): { title: string; message: string } {
    
    let title: string;
    let message: string;

    switch (alertData.alertType) {
      case 'out_of_stock':
        title = `สินค้าหมดสต๊อค - ${alertData.productName} ที่ ${alertData.branchName}`;
        message = `สินค้า ${alertData.productName} (${alertData.productSku}) ที่สาขา ${alertData.branchName} หมดสต๊อคแล้ว!\n\n` +
                 `สต๊อคปัจจุบัน: ${alertData.currentStockLevel} ${alertData.unit}\n` +
                 `แนะนำให้สั่งซื้อ: ${suggestedReorderQuantity} ${alertData.unit} โดยด่วน\n\n` +
                 `กรุณาดำเนินการสั่งซื้อเพื่อเติมสต๊อคโดยเร็วที่สุด`;
        break;

      case 'low_stock':
        title = `สต๊อคต่ำ - ${alertData.productName} ที่ ${alertData.branchName}`;
        message = `สินค้า ${alertData.productName} (${alertData.productSku}) ที่สาขา ${alertData.branchName} มีสต๊อคต่ำกว่าเกณฑ์ที่กำหนด\n\n` +
                 `สต๊อคปัจจุบัน: ${alertData.currentStockLevel} ${alertData.unit}\n` +
                 `เกณฑ์ต่ำสุด: ${alertData.thresholdLevel} ${alertData.unit}\n` +
                 `แนะนำให้สั่งซื้อ: ${suggestedReorderQuantity} ${alertData.unit}\n\n` +
                 `กรุณาพิจารณาสั่งซื้อเติมสต๊อค`;
        break;

      case 'approaching_expiry':
        const daysToExpiry = Math.ceil(alertData.thresholdLevel);
        title = `สินค้าใกล้หมดอายุ - ${alertData.productName} ที่ ${alertData.branchName}`;
        message = `สินค้า ${alertData.productName} (${alertData.productSku}) ที่สาขา ${alertData.branchName} ใกล้หมดอายุแล้ว\n\n` +
                 `สต๊อคคงเหลือ: ${alertData.currentStockLevel} ${alertData.unit}\n` +
                 `วันหมดอายุ: ${alertData.expirationDate?.toLocaleDateString('th-TH') || 'ไม่ระบุ'}\n` +
                 `คงเหลือ: ${daysToExpiry} วัน\n` +
                 (alertData.batchNumber ? `Batch: ${alertData.batchNumber}\n` : '') +
                 `\nกรุณาจัดการสินค้าที่ใกล้หมดอายุ เช่น ลดราคา หรือโอนไปสาขาอื่น`;
        break;

      default:
        title = `แจ้งเตือนสต๊อค - ${alertData.productName}`;
        message = `มีการแจ้งเตือนเกี่ยวกับสต๊อคสินค้า ${alertData.productName} ที่สาขา ${alertData.branchName}`;
    }

    return { title, message };
  }

  // Send notifications for the alert
  private async sendAlertNotifications(alert: StockAlert, alertData: {
    branchId: string;
    productId: string;
    categoryId?: string;
  }): Promise<void> {
    try {
      const alertSubscription = new AlertSubscription();
      
      // Get matching subscriptions
      const subscriptions = await alertSubscription.getMatchingSubscriptions({
        alertType: alert.alertType,
        severity: alert.severity,
        branchId: alertData.branchId,
        categoryId: alertData.categoryId
      });

      // Send notifications via different channels
      const channels: NotificationChannel[] = ['email', 'in_app', 'sms', 'push'];
      
      for (const channel of channels) {
        const users = await alertSubscription.getUsersForChannel(channel, {
          alertType: alert.alertType,
          severity: alert.severity,
          branchId: alertData.branchId,
          categoryId: alertData.categoryId
        });

        for (const user of users) {
          // Check if user is in quiet hours for non-critical alerts
          if (alert.severity !== 'critical') {
            const isQuietHours = await alertSubscription.isInQuietHours(user.userId);
            if (isQuietHours && user.digestFrequency === 'immediate') {
              continue; // Skip immediate delivery during quiet hours
            }
          }

          // Create notification delivery
          await this.notificationService.createNotification({
            stockAlertId: alert.id!,
            userId: user.userId,
            channel,
            alertType: alert.alertType,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            recipientEmail: user.email,
            recipientPhone: user.phone
          });
        }
      }

      logger.info(`Sent notifications for alert ${alert.alertNumber} to ${subscriptions.length} subscribers`);

    } catch (error) {
      logger.error(`Error sending notifications for alert ${alert.id}:`, error);
    }
  }

  // Auto-resolve old alerts that are no longer relevant
  private async autoResolveOldAlerts(): Promise<void> {
    try {
      const stockAlert = new StockAlert();
      
      // Resolve expired alerts
      const expiredCount = await stockAlert.autoResolveExpiredAlerts();
      
      // Resolve alerts where stock has been restored for more than 24 hours
      const db = DatabaseConnection.getInstance();
      
      const query = `
        UPDATE stock_alerts sa
        SET 
          status = 'resolved',
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = 'system',
          updated_at = CURRENT_TIMESTAMP
        FROM inventory_items ii, alert_thresholds at
        WHERE sa.status IN ('active', 'acknowledged')
        AND sa.inventory_item_id = ii.id
        AND sa.branch_id = at.branch_id
        AND sa.product_id = at.product_id
        AND at.is_active = true
        AND ii.quantity_in_stock > at.reorder_point
        AND sa.triggered_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
        AND sa.alert_type IN ('low_stock', 'out_of_stock')
      `;

      const result = await db.query(query);
      
      logger.info(`Auto-resolved ${expiredCount} expired alerts and ${result.rowCount} restored stock alerts`);

    } catch (error) {
      logger.error('Error auto-resolving old alerts:', error);
    }
  }

  // Check stock for specific product at specific branch
  async checkProductStock(branchId: string, productId: string): Promise<void> {
    try {
      const db = DatabaseConnection.getInstance();
      
      const query = `
        SELECT 
          ii.id as inventory_item_id,
          ii.product_id,
          ii.branch_id,
          ii.quantity_in_stock as current_stock,
          ii.unit,
          ii.batch_number,
          ii.expiration_date,
          p.name as product_name,
          p.sku as product_sku,
          b.name as branch_name,
          c.id as category_id,
          c.name as category_name,
          at.minimum_stock_level,
          at.reorder_point,
          at.maximum_stock_level,
          at.id as threshold_id
        FROM inventory_items ii
        JOIN products p ON ii.product_id = p.id
        JOIN branches b ON ii.branch_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN alert_thresholds at ON ii.branch_id = at.branch_id AND ii.product_id = at.product_id
        WHERE ii.is_active = true
        AND ii.branch_id = $1
        AND ii.product_id = $2
        AND (at.is_active = true OR at.id IS NULL)
      `;

      const result = await db.query(query, [branchId, productId]);
      
      if (result.rows.length > 0) {
        await this.checkInventoryItem(result.rows[0]);
      }

    } catch (error) {
      logger.error(`Error checking stock for product ${productId} at branch ${branchId}:`, error);
      throw error;
    }
  }

  // Bulk check stock levels for multiple products
  async bulkCheckStock(items: Array<{ branchId: string; productId: string }>): Promise<void> {
    try {
      logger.info(`Bulk checking stock for ${items.length} items`);
      
      for (const item of items) {
        await this.checkProductStock(item.branchId, item.productId);
      }

    } catch (error) {
      logger.error('Error in bulk stock check:', error);
      throw error;
    }
  }

  // Update alert thresholds automatically based on sales history
  async updateAutoThresholds(): Promise<void> {
    try {
      const alertThreshold = new AlertThreshold();
      await alertThreshold.autoUpdateThresholds();
      
      logger.info('Updated automatic alert thresholds based on sales history');

    } catch (error) {
      logger.error('Error updating auto thresholds:', error);
      throw error;
    }
  }

  // Get alert expiry days based on severity
  private getAlertExpiryDays(severity: AlertSeverity): number {
    switch (severity) {
      case 'critical': return 1;
      case 'high': return 3;
      case 'medium': return 7;
      case 'low': return 14;
      default: return 7;
    }
  }

  // Generate stock monitoring report
  async generateMonitoringReport(branchId?: string): Promise<{
    totalItems: number;
    lowStockItems: number;
    outOfStockItems: number;
    expiringItems: number;
    activeAlerts: number;
    criticalAlerts: number;
    itemsWithoutThresholds: number;
    topLowStockProducts: Array<{
      productName: string;
      branchName: string;
      currentStock: number;
      reorderPoint: number;
      unit: string;
    }>;
  }> {
    try {
      const db = DatabaseConnection.getInstance();
      
      let whereClause = 'WHERE ii.is_active = true';
      const values = [];
      
      if (branchId) {
        whereClause += ' AND ii.branch_id = $1';
        values.push(branchId);
      }

      const query = `
        WITH stock_summary AS (
          SELECT 
            COUNT(*) as total_items,
            COUNT(*) FILTER (
              WHERE at.id IS NOT NULL 
              AND ii.quantity_in_stock <= at.reorder_point
              AND ii.quantity_in_stock > 0
            ) as low_stock_items,
            COUNT(*) FILTER (WHERE ii.quantity_in_stock <= 0) as out_of_stock_items,
            COUNT(*) FILTER (
              WHERE ii.expiration_date IS NOT NULL 
              AND ii.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
              AND ii.quantity_in_stock > 0
            ) as expiring_items,
            COUNT(*) FILTER (WHERE at.id IS NULL) as items_without_thresholds
          FROM inventory_items ii
          LEFT JOIN alert_thresholds at ON ii.branch_id = at.branch_id 
            AND ii.product_id = at.product_id 
            AND at.is_active = true
          ${whereClause}
        ),
        alert_summary AS (
          SELECT 
            COUNT(*) FILTER (WHERE sa.status IN ('active', 'acknowledged')) as active_alerts,
            COUNT(*) FILTER (
              WHERE sa.status IN ('active', 'acknowledged') 
              AND sa.severity = 'critical'
            ) as critical_alerts
          FROM stock_alerts sa
          ${branchId ? 'WHERE sa.branch_id = $1' : ''}
        ),
        top_low_stock AS (
          SELECT 
            p.name as product_name,
            b.name as branch_name,
            ii.quantity_in_stock as current_stock,
            at.reorder_point,
            ii.unit
          FROM inventory_items ii
          JOIN products p ON ii.product_id = p.id
          JOIN branches b ON ii.branch_id = b.id
          JOIN alert_thresholds at ON ii.branch_id = at.branch_id 
            AND ii.product_id = at.product_id
          ${whereClause}
          AND at.is_active = true
          AND ii.quantity_in_stock <= at.reorder_point
          AND ii.quantity_in_stock > 0
          ORDER BY (ii.quantity_in_stock / at.reorder_point) ASC
          LIMIT 10
        )
        SELECT 
          ss.*,
          als.*,
          json_agg(
            json_build_object(
              'product_name', tls.product_name,
              'branch_name', tls.branch_name,
              'current_stock', tls.current_stock,
              'reorder_point', tls.reorder_point,
              'unit', tls.unit
            ) ORDER BY (tls.current_stock / tls.reorder_point) ASC
          ) FILTER (WHERE tls.product_name IS NOT NULL) as top_low_stock_products
        FROM stock_summary ss
        CROSS JOIN alert_summary als
        LEFT JOIN top_low_stock tls ON true
        GROUP BY ss.total_items, ss.low_stock_items, ss.out_of_stock_items, 
                 ss.expiring_items, ss.items_without_thresholds, 
                 als.active_alerts, als.critical_alerts
      `;

      const result = await db.query(query, values);
      const row = result.rows[0] || {};
      
      return {
        totalItems: parseInt(row.total_items) || 0,
        lowStockItems: parseInt(row.low_stock_items) || 0,
        outOfStockItems: parseInt(row.out_of_stock_items) || 0,
        expiringItems: parseInt(row.expiring_items) || 0,
        activeAlerts: parseInt(row.active_alerts) || 0,
        criticalAlerts: parseInt(row.critical_alerts) || 0,
        itemsWithoutThresholds: parseInt(row.items_without_thresholds) || 0,
        topLowStockProducts: row.top_low_stock_products || []
      };

    } catch (error) {
      logger.error('Error generating monitoring report:', error);
      throw error;
    }
  }
}

export default StockMonitoringService;