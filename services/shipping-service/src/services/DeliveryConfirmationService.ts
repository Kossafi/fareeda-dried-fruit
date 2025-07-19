import DatabaseConnection from '../database/connection';
import DeliveryConfirmationModel from '../models/DeliveryConfirmation';
import DeliveryConfirmationItemModel from '../models/DeliveryConfirmationItem';
import StockTransferModel from '../models/StockTransfer';
import DiscrepancyReportModel from '../models/DiscrepancyReport';
import DeliveryOrderModel from '../models/DeliveryOrder';
import { 
  DeliveryConfirmation, 
  DeliveryConfirmationItem,
  ConfirmationMethod,
  ConditionStatus,
  DiscrepancyType,
  DiscrepancySeverity,
  DeliveryStatus,
  TransferStatus,
  UnitType 
} from '@dried-fruits/types';
import logger from '../utils/logger';
import axios from 'axios';
import { config } from '../config';

interface ConfirmDeliveryRequest {
  deliveryOrderId: string;
  confirmedBy: string;
  branchId: string;
  confirmationMethod: ConfirmationMethod;
  items: Array<{
    deliveryOrderItemId: string;
    expectedQuantity: number;
    receivedQuantity: number;
    unit: UnitType;
    conditionStatus?: ConditionStatus;
    barcodeScanned?: boolean;
    batchNumber?: string;
    expirationDate?: Date;
    damageDescription?: string;
    photoEvidence?: string[];
  }>;
  notes?: string;
  signatureData?: string;
  photoEvidence?: string[];
  locationCoordinates?: { latitude: number; longitude: number };
  deviceInfo?: any;
}

interface BarcodeConfirmRequest {
  deliveryOrderId: string;
  confirmedBy: string;
  branchId: string;
  scannedBarcodes: Array<{
    barcode: string;
    quantity: number;
    unit: UnitType;
    batchNumber?: string;
    expirationDate?: Date;
  }>;
  deviceInfo?: any;
  locationCoordinates?: { latitude: number; longitude: number };
}

export class DeliveryConfirmationService {
  private db = DatabaseConnection.getInstance();
  private confirmationModel = new DeliveryConfirmationModel();
  private confirmationItemModel = new DeliveryConfirmationItemModel();
  private stockTransferModel = new StockTransferModel();
  private discrepancyReportModel = new DiscrepancyReportModel();
  private deliveryOrderModel = new DeliveryOrderModel();

  async confirmDelivery(confirmationData: ConfirmDeliveryRequest): Promise<DeliveryConfirmation> {
    return this.db.transaction(async (client) => {
      try {
        // Validate delivery order exists and can be confirmed
        await this.validateDeliveryOrder(confirmationData.deliveryOrderId);

        // Check if already confirmed
        const existingConfirmation = await this.confirmationModel.findByDeliveryOrder(
          confirmationData.deliveryOrderId
        );
        if (existingConfirmation) {
          throw new Error('Delivery order has already been confirmed');
        }

        // Create delivery confirmation
        const confirmation = await this.confirmationModel.create({
          deliveryOrderId: confirmationData.deliveryOrderId,
          confirmedBy: confirmationData.confirmedBy,
          branchId: confirmationData.branchId,
          confirmationMethod: confirmationData.confirmationMethod,
          notes: confirmationData.notes,
          signatureData: confirmationData.signatureData,
          photoEvidence: confirmationData.photoEvidence,
          locationCoordinates: confirmationData.locationCoordinates,
          deviceInfo: confirmationData.deviceInfo,
        });

        // Create confirmation items
        const confirmationItems = await this.confirmationItemModel.bulkCreate(
          confirmationData.items.map(item => ({
            deliveryConfirmationId: confirmation.id,
            ...item,
          }))
        );

        // Check for discrepancies
        const discrepancies = this.identifyDiscrepancies(confirmationItems);
        
        if (discrepancies.length > 0) {
          // Create discrepancy report
          await this.createDiscrepancyReport(
            confirmationData.deliveryOrderId,
            confirmation.id,
            confirmationData.confirmedBy,
            discrepancies
          );
        }

        // Process automatic stock transfer
        await this.processStockTransfer(confirmation, confirmationItems);

        // Update delivery order status
        await this.deliveryOrderModel.updateStatus(
          confirmationData.deliveryOrderId,
          DeliveryStatus.DELIVERED,
          {
            actualDeliveryTime: new Date(),
            receivedBy: confirmationData.confirmedBy,
          }
        );

        // Publish confirmation event
        await this.publishConfirmationEvent('delivery.confirmed', {
          confirmationId: confirmation.id,
          deliveryOrderId: confirmationData.deliveryOrderId,
          branchId: confirmationData.branchId,
          itemCount: confirmationItems.length,
          discrepancyCount: discrepancies.length,
        });

        logger.info('Delivery confirmed successfully', {
          confirmationId: confirmation.id,
          deliveryOrderId: confirmationData.deliveryOrderId,
          itemCount: confirmationItems.length,
          discrepancyCount: discrepancies.length,
        });

        return {
          ...confirmation,
          items: confirmationItems,
        };

      } catch (error) {
        logger.error('Failed to confirm delivery', { 
          error: error.message, 
          deliveryOrderId: confirmationData.deliveryOrderId 
        });
        throw error;
      }
    });
  }

  async confirmWithBarcodeScan(scanData: BarcodeConfirmRequest): Promise<DeliveryConfirmation> {
    return this.db.transaction(async (client) => {
      try {
        // Validate barcodes and get product information
        const validatedItems = await this.validateAndMapBarcodes(
          scanData.deliveryOrderId,
          scanData.scannedBarcodes
        );

        // Create confirmation using validated items
        const confirmationRequest: ConfirmDeliveryRequest = {
          deliveryOrderId: scanData.deliveryOrderId,
          confirmedBy: scanData.confirmedBy,
          branchId: scanData.branchId,
          confirmationMethod: ConfirmationMethod.BARCODE_SCAN,
          items: validatedItems.map(item => ({
            deliveryOrderItemId: item.deliveryOrderItemId,
            expectedQuantity: item.expectedQuantity,
            receivedQuantity: item.scannedQuantity,
            unit: item.unit,
            conditionStatus: ConditionStatus.GOOD,
            barcodeScanned: true,
            batchNumber: item.batchNumber,
            expirationDate: item.expirationDate,
          })),
          locationCoordinates: scanData.locationCoordinates,
          deviceInfo: scanData.deviceInfo,
        };

        // Log barcode scans
        await this.logBarcodeScans(scanData);

        return this.confirmDelivery(confirmationRequest);

      } catch (error) {
        logger.error('Failed to confirm delivery with barcode scan', { 
          error: error.message, 
          deliveryOrderId: scanData.deliveryOrderId 
        });
        throw error;
      }
    });
  }

  async reportDiscrepancy(
    deliveryOrderId: string,
    reportedBy: string,
    discrepancyData: {
      discrepancyType: DiscrepancyType;
      severity: DiscrepancySeverity;
      items: Array<{
        deliveryOrderItemId: string;
        expectedQuantity: number;
        receivedQuantity: number;
        unit: UnitType;
        discrepancyReason?: string;
        photoEvidence?: string[];
        estimatedValueImpact?: number;
      }>;
      notes?: string;
    }
  ): Promise<void> {
    try {
      const totalAffectedItems = discrepancyData.items.length;
      const totalValueImpact = discrepancyData.items.reduce(
        (sum, item) => sum + (item.estimatedValueImpact || 0), 
        0
      );

      // Create discrepancy report
      const report = await this.discrepancyReportModel.create({
        deliveryOrderId,
        reportedBy,
        discrepancyType: discrepancyData.discrepancyType,
        severity: discrepancyData.severity,
        totalAffectedItems,
        totalValueImpact,
        requiresInvestigation: discrepancyData.severity === DiscrepancySeverity.HIGH ||
                               discrepancyData.severity === DiscrepancySeverity.CRITICAL ||
                               totalValueImpact > 5000,
      });

      // Create discrepancy report items
      await this.createDiscrepancyReportItems(report.id, discrepancyData.items);

      // Publish discrepancy event
      await this.publishConfirmationEvent('delivery.discrepancy_reported', {
        reportId: report.id,
        deliveryOrderId,
        discrepancyType: discrepancyData.discrepancyType,
        severity: discrepancyData.severity,
        totalValueImpact,
      });

      logger.info('Discrepancy reported', {
        reportId: report.id,
        deliveryOrderId,
        discrepancyType: discrepancyData.discrepancyType,
        totalAffectedItems,
      });

    } catch (error) {
      logger.error('Failed to report discrepancy', { 
        error: error.message, 
        deliveryOrderId 
      });
      throw error;
    }
  }

  async getDeliveryHistory(orderId: string): Promise<{
    confirmation: DeliveryConfirmation | null;
    items: DeliveryConfirmationItem[];
    stockTransfers: any[];
    discrepancyReports: any[];
    summary: {
      totalItems: number;
      confirmedItems: number;
      discrepantItems: number;
      totalExpected: number;
      totalReceived: number;
      discrepancyPercentage: number;
    };
  }> {
    const history = await this.confirmationModel.getConfirmationHistory(orderId);
    const stockTransfers = await this.stockTransferModel.findByDeliveryOrder(orderId);
    const discrepancyReports = await this.discrepancyReportModel.findByDeliveryOrder(orderId);

    const summary = {
      totalItems: history.items.length,
      confirmedItems: history.items.filter(item => item.receivedQuantity > 0).length,
      discrepantItems: history.discrepancyCount,
      totalExpected: history.totalExpected,
      totalReceived: history.totalReceived,
      discrepancyPercentage: history.totalExpected > 0 
        ? Math.abs(history.totalReceived - history.totalExpected) / history.totalExpected * 100 
        : 0,
    };

    return {
      confirmation: history.confirmation,
      items: history.items,
      stockTransfers,
      discrepancyReports,
      summary,
    };
  }

  async getPendingConfirmations(branchId?: string): Promise<any[]> {
    return this.confirmationModel.getPendingConfirmations(branchId);
  }

  async getConfirmationAnalytics(
    branchId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const [
      confirmationAnalytics,
      discrepancyAnalytics,
      stockTransferAnalytics,
    ] = await Promise.all([
      this.confirmationModel.getConfirmationAnalytics(branchId, startDate, endDate),
      this.discrepancyReportModel.getDiscrepancyAnalytics(startDate!, endDate!, branchId),
      this.stockTransferModel.getTransferAnalytics(startDate!, endDate!, branchId),
    ]);

    return {
      confirmations: confirmationAnalytics,
      discrepancies: discrepancyAnalytics,
      stockTransfers: stockTransferAnalytics,
    };
  }

  private async validateDeliveryOrder(deliveryOrderId: string): Promise<void> {
    const order = await this.deliveryOrderModel.findById(deliveryOrderId);
    if (!order) {
      throw new Error('Delivery order not found');
    }

    if (order.status !== DeliveryStatus.DELIVERED) {
      throw new Error('Delivery order must be in delivered status to confirm');
    }
  }

  private async validateAndMapBarcodes(
    deliveryOrderId: string,
    scannedBarcodes: Array<{
      barcode: string;
      quantity: number;
      unit: UnitType;
      batchNumber?: string;
      expirationDate?: Date;
    }>
  ): Promise<Array<{
    deliveryOrderItemId: string;
    expectedQuantity: number;
    scannedQuantity: number;
    unit: UnitType;
    batchNumber?: string;
    expirationDate?: Date;
  }>> {
    try {
      // Call barcode service to validate and get product information
      const barcodeService = axios.create({
        baseURL: config.services.barcodeService?.url || 'http://localhost:3008',
        timeout: config.services.barcodeService?.timeout || 5000,
      });

      const response = await barcodeService.post('/api/barcodes/validate-batch', {
        barcodes: scannedBarcodes.map(item => item.barcode),
        deliveryOrderId,
      });

      if (!response.data.success) {
        throw new Error(`Barcode validation failed: ${response.data.message}`);
      }

      const validatedBarcodes = response.data.validatedBarcodes;
      
      // Map validated barcodes to delivery order items
      const mappedItems: any[] = [];

      for (const scanned of scannedBarcodes) {
        const validated = validatedBarcodes.find(
          (v: any) => v.barcode === scanned.barcode
        );

        if (!validated) {
          throw new Error(`Invalid barcode: ${scanned.barcode}`);
        }

        mappedItems.push({
          deliveryOrderItemId: validated.deliveryOrderItemId,
          expectedQuantity: validated.expectedQuantity,
          scannedQuantity: scanned.quantity,
          unit: scanned.unit,
          batchNumber: scanned.batchNumber || validated.batchNumber,
          expirationDate: scanned.expirationDate || validated.expirationDate,
        });
      }

      return mappedItems;

    } catch (error) {
      logger.error('Failed to validate barcodes', { error: error.message, scannedBarcodes });
      throw new Error(`Barcode validation failed: ${error.message}`);
    }
  }

  private identifyDiscrepancies(
    items: DeliveryConfirmationItem[]
  ): Array<{
    item: DeliveryConfirmationItem;
    discrepancyType: DiscrepancyType;
    discrepancyQuantity: number;
  }> {
    const discrepancies: any[] = [];

    for (const item of items) {
      const quantityDiff = item.receivedQuantity - item.expectedQuantity;
      
      if (Math.abs(quantityDiff) > 0.001) {
        discrepancies.push({
          item,
          discrepancyType: quantityDiff > 0 
            ? DiscrepancyType.QUANTITY_EXCESS 
            : DiscrepancyType.QUANTITY_SHORTAGE,
          discrepancyQuantity: quantityDiff,
        });
      }

      if (item.conditionStatus === ConditionStatus.DAMAGED) {
        discrepancies.push({
          item,
          discrepancyType: DiscrepancyType.DAMAGE,
          discrepancyQuantity: item.receivedQuantity,
        });
      }

      if (item.conditionStatus === ConditionStatus.EXPIRED) {
        discrepancies.push({
          item,
          discrepancyType: DiscrepancyType.DAMAGE, // Could be separate type for expired
          discrepancyQuantity: item.receivedQuantity,
        });
      }
    }

    return discrepancies;
  }

  private async createDiscrepancyReport(
    deliveryOrderId: string,
    confirmationId: string,
    reportedBy: string,
    discrepancies: Array<{
      item: DeliveryConfirmationItem;
      discrepancyType: DiscrepancyType;
      discrepancyQuantity: number;
    }>
  ): Promise<void> {
    if (discrepancies.length === 0) return;

    // Determine overall severity
    const hasCriticalDiscrepancies = discrepancies.some(d => 
      Math.abs(d.discrepancyQuantity) > 10 || d.discrepancyType === DiscrepancyType.DAMAGE
    );
    
    const severity = hasCriticalDiscrepancies 
      ? DiscrepancySeverity.HIGH 
      : DiscrepancySeverity.MEDIUM;

    await this.discrepancyReportModel.create({
      deliveryOrderId,
      deliveryConfirmationId: confirmationId,
      reportedBy,
      discrepancyType: DiscrepancyType.QUANTITY_SHORTAGE, // Dominant type
      severity,
      totalAffectedItems: discrepancies.length,
      totalValueImpact: 0, // Would calculate based on product costs
      requiresInvestigation: severity === DiscrepancySeverity.HIGH,
    });
  }

  private async createDiscrepancyReportItems(
    reportId: string,
    items: Array<{
      deliveryOrderItemId: string;
      expectedQuantity: number;
      receivedQuantity: number;
      unit: UnitType;
      discrepancyReason?: string;
      photoEvidence?: string[];
      estimatedValueImpact?: number;
    }>
  ): Promise<void> {
    // Implementation would create discrepancy report items
    // This is a placeholder for the actual implementation
  }

  private async processStockTransfer(
    confirmation: DeliveryConfirmation,
    items: DeliveryConfirmationItem[]
  ): Promise<void> {
    try {
      // Get delivery order information
      const order = await this.deliveryOrderModel.findById(confirmation.deliveryOrderId);
      if (!order) {
        throw new Error('Delivery order not found for stock transfer');
      }

      // Create stock transfer
      const stockTransfer = await this.stockTransferModel.create({
        deliveryOrderId: confirmation.deliveryOrderId,
        deliveryConfirmationId: confirmation.id,
        fromBranchId: order.fromBranchId,
        toBranchId: order.toBranchId,
        totalItems: items.length,
        notes: 'Auto-generated from delivery confirmation',
      });

      // Process the actual inventory transfer
      await this.executeInventoryTransfer(stockTransfer, items);

      // Update stock transfer status
      await this.stockTransferModel.updateStatus(
        stockTransfer.id,
        TransferStatus.COMPLETED,
        confirmation.confirmedBy
      );

    } catch (error) {
      logger.error('Failed to process stock transfer', { 
        error: error.message, 
        confirmationId: confirmation.id 
      });
      // Don't throw error here to avoid failing the entire confirmation
    }
  }

  private async executeInventoryTransfer(
    stockTransfer: any,
    items: DeliveryConfirmationItem[]
  ): Promise<void> {
    try {
      const inventoryService = axios.create({
        baseURL: config.services.inventoryService.url,
        timeout: config.services.inventoryService.timeout,
      });

      const transferItems = items.map(item => ({
        inventoryItemId: item.deliveryOrderItemId, // This would be mapped properly
        quantity: item.receivedQuantity,
        unit: item.unit,
        batchNumber: item.batchNumber,
        expirationDate: item.expirationDate,
      }));

      await inventoryService.post('/api/inventory/transfer', {
        fromBranchId: stockTransfer.fromBranchId,
        toBranchId: stockTransfer.toBranchId,
        items: transferItems,
        referenceType: 'delivery_confirmation',
        referenceId: stockTransfer.deliveryConfirmationId,
      });

    } catch (error) {
      logger.error('Failed to execute inventory transfer', { 
        error: error.message, 
        stockTransferId: stockTransfer.id 
      });
      throw error;
    }
  }

  private async logBarcodeScans(scanData: BarcodeConfirmRequest): Promise<void> {
    try {
      for (const scan of scanData.scannedBarcodes) {
        const query = `
          INSERT INTO shipping.barcode_scan_logs (
            barcode_value, scan_result, scanned_by, device_info, location_coordinates
          ) VALUES ($1, $2, $3, $4, POINT($5, $6))
        `;

        await this.db.query(query, [
          scan.barcode,
          'success',
          scanData.confirmedBy,
          scanData.deviceInfo,
          scanData.locationCoordinates?.longitude || null,
          scanData.locationCoordinates?.latitude || null,
        ]);
      }
    } catch (error) {
      logger.error('Failed to log barcode scans', { error: error.message });
    }
  }

  private async publishConfirmationEvent(eventType: string, data: any): Promise<void> {
    try {
      await this.db.publishEvent('delivery_confirmation', eventType, data);
    } catch (error) {
      logger.error('Failed to publish confirmation event', { eventType, data, error: error.message });
    }
  }
}

export default DeliveryConfirmationService;