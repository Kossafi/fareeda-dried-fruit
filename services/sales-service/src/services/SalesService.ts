import DatabaseConnection from '../database/connection';
import SaleModel from '../models/Sale';
import SaleItemModel from '../models/SaleItem';
import SalePaymentModel from '../models/SalePayment';
import CustomerModel from '../models/Customer';
import { 
  Sale, 
  SaleItem, 
  SalePayment, 
  Customer,
  SaleStatus, 
  SaleType, 
  PaymentMethod,
  UnitType 
} from '@dried-fruits/types';
import logger from '../utils/logger';
import axios from 'axios';
import { config } from '../config';

interface CreateSaleRequest {
  branchId: string;
  customerId?: string;
  customerData?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  saleType: SaleType;
  items: Array<{
    inventoryItemId: string;
    productId: string;
    quantity: number;
    unit: UnitType;
    unitPrice: number;
    discountAmount?: number;
    discountPercentage?: number;
    barcodeScanned: boolean;
    actualWeight?: number;
    tareWeight?: number;
  }>;
  payments: Array<{
    paymentMethod: PaymentMethod;
    amount: number;
    referenceNumber?: string;
    receivedAmount?: number;
    cardLast4?: string;
    cardType?: string;
    bankName?: string;
    approvalCode?: string;
    terminalId?: string;
  }>;
  discountAmount?: number;
  taxAmount?: number;
  soldBy: string;
  cashierId?: string;
  mallLocation?: string;
  posTerminalId?: string;
  notes?: string;
}

export class SalesService {
  private db = DatabaseConnection.getInstance();
  private saleModel = new SaleModel();
  private saleItemModel = new SaleItemModel();
  private salePaymentModel = new SalePaymentModel();
  private customerModel = new CustomerModel();

  async createSale(saleData: CreateSaleRequest): Promise<Sale> {
    return this.db.transaction(async (client) => {
      try {
        // Validate inventory availability
        await this.validateInventoryAvailability(saleData.items);

        // Calculate totals
        const calculatedTotals = await this.calculateSaleTotals(saleData.items, saleData.discountAmount);

        // Handle customer
        let customerId = saleData.customerId;
        if (!customerId && saleData.customerData?.phone) {
          const customer = await this.customerModel.findOrCreateByPhone(
            saleData.customerData.phone,
            saleData.customerData
          );
          customerId = customer.id;
        }

        // Create sale
        const sale = await this.saleModel.create({
          branchId: saleData.branchId,
          customerId,
          customerName: saleData.customerData?.name,
          customerPhone: saleData.customerData?.phone,
          customerEmail: saleData.customerData?.email,
          saleType: saleData.saleType,
          subtotal: calculatedTotals.subtotal,
          discountAmount: saleData.discountAmount || 0,
          taxAmount: saleData.taxAmount || calculatedTotals.taxAmount,
          totalAmount: calculatedTotals.totalAmount,
          paidAmount: calculatedTotals.paidAmount,
          changeAmount: calculatedTotals.changeAmount,
          soldBy: saleData.soldBy,
          cashierId: saleData.cashierId,
          mallLocation: saleData.mallLocation,
          posTerminalId: saleData.posTerminalId,
          notes: saleData.notes,
        });

        // Create sale items
        const saleItems = await this.createSaleItems(sale.id, saleData.items);

        // Create payments
        const payments = await this.createSalePayments(sale.id, saleData.payments, saleData.soldBy);

        // Update sale status to completed
        const completedSale = await this.saleModel.updateStatus(sale.id, SaleStatus.COMPLETED);

        // Deduct inventory
        await this.deductInventory(saleItems);

        // Update customer stats if customer exists
        if (customerId) {
          await this.customerModel.updateStats(customerId, {
            totalAmount: calculatedTotals.totalAmount,
            saleDate: new Date(),
          });
        }

        // Publish sale event
        await this.publishSaleEvent('sale.created', {
          saleId: sale.id,
          branchId: saleData.branchId,
          totalAmount: calculatedTotals.totalAmount,
          itemCount: saleItems.length,
          customerId,
        });

        // Update real-time cache
        await this.updateRealTimeSalesCache(saleData.branchId, {
          saleNumber: sale.saleNumber,
          totalAmount: calculatedTotals.totalAmount,
          itemCount: saleItems.length,
          customerName: saleData.customerData?.name,
        });

        logger.info('Sale created successfully', {
          saleId: sale.id,
          saleNumber: sale.saleNumber,
          totalAmount: calculatedTotals.totalAmount,
          branchId: saleData.branchId,
        });

        // Return complete sale with items and payments
        return {
          ...completedSale,
          items: saleItems,
          payments,
        };

      } catch (error) {
        logger.error('Failed to create sale', { error: error.message, saleData });
        throw error;
      }
    });
  }

  async voidSale(saleId: string, reason: string, voidedBy: string): Promise<Sale> {
    return this.db.transaction(async (client) => {
      try {
        // Get sale items before voiding for inventory restoration
        const saleItems = await this.saleItemModel.findItemsForStockAdjustment(saleId);

        // Void the sale
        const voidedSale = await this.saleModel.voidSale(saleId, reason, voidedBy);

        // Restore inventory
        await this.restoreInventory(saleItems);

        // Publish void event
        await this.publishSaleEvent('sale.voided', {
          saleId,
          reason,
          voidedBy,
          itemsRestored: saleItems.length,
        });

        logger.info('Sale voided successfully', {
          saleId,
          reason,
          voidedBy,
        });

        return voidedSale;

      } catch (error) {
        logger.error('Failed to void sale', { error: error.message, saleId, reason });
        throw error;
      }
    });
  }

  async getSaleWithDetails(saleId: string): Promise<Sale | null> {
    const sale = await this.saleModel.findById(saleId);
    if (!sale) return null;

    // Get sale items
    const items = await this.saleItemModel.findBySale(saleId);
    
    // Get payments
    const payments = await this.salePaymentModel.findBySale(saleId);

    return {
      ...sale,
      items,
      payments,
    };
  }

  async getSalesByBranch(
    branchId: string,
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<Sale[]> {
    return this.saleModel.findByBranch(branchId, startDate, endDate, limit);
  }

  async getSalesAnalytics(
    branchId: string,
    startDate: Date,
    endDate: Date
  ) {
    const [
      salesAnalytics,
      topProducts,
      paymentAnalytics,
      topCustomers,
    ] = await Promise.all([
      this.saleModel.getSalesAnalytics(branchId, startDate, endDate),
      this.saleModel.findTopProducts(branchId, startDate, endDate, 10),
      this.salePaymentModel.getPaymentAnalytics(branchId, startDate, endDate),
      this.customerModel.findTopCustomers(branchId, startDate, endDate, 10),
    ]);

    return {
      sales: salesAnalytics,
      topProducts,
      payments: paymentAnalytics,
      topCustomers,
    };
  }

  async getRealtimeDashboard(branchId: string) {
    const cached = await this.db.getCachedRealTimeSales(branchId);
    if (cached) {
      return cached;
    }

    // Fallback to fresh data if cache miss
    const todaysSales = await this.saleModel.getTodaysSales(branchId);
    const recentSales = await this.saleModel.findRecentSales(branchId, 10);

    const dashboardData = {
      ...todaysSales,
      recentSales: recentSales.map(sale => ({
        saleNumber: sale.saleNumber,
        amount: sale.totalAmount,
        itemCount: 0, // Would need to count items
        timestamp: sale.saleDate,
        customerName: sale.customerName,
      })),
      lastUpdated: new Date(),
      isLive: false,
    };

    await this.db.cacheRealTimeSales(branchId, dashboardData);
    return dashboardData;
  }

  private async validateInventoryAvailability(items: Array<{
    inventoryItemId: string;
    quantity: number;
    unit: UnitType;
  }>): Promise<void> {
    try {
      const inventoryService = axios.create({
        baseURL: config.services.inventoryService.url,
        timeout: config.services.inventoryService.timeout,
      });

      const validationRequests = items.map(item => ({
        inventoryItemId: item.inventoryItemId,
        requestedQuantity: item.quantity,
        unit: item.unit,
      }));

      const response = await inventoryService.post('/api/inventory/validate-availability', {
        items: validationRequests,
      });

      if (!response.data.success) {
        throw new Error(`Inventory validation failed: ${response.data.message}`);
      }

      const unavailableItems = response.data.unavailableItems || [];
      if (unavailableItems.length > 0) {
        throw new Error(`Insufficient inventory for items: ${unavailableItems.join(', ')}`);
      }

    } catch (error) {
      if (error.response) {
        throw new Error(`Inventory service error: ${error.response.data.message}`);
      }
      throw new Error(`Failed to validate inventory: ${error.message}`);
    }
  }

  private async calculateSaleTotals(
    items: Array<{
      quantity: number;
      unitPrice: number;
      discountAmount?: number;
      discountPercentage?: number;
    }>,
    saleDiscountAmount?: number
  ) {
    let subtotal = 0;

    // Calculate subtotal with item-level discounts
    for (const item of items) {
      const lineTotal = item.quantity * item.unitPrice;
      const itemDiscount = item.discountAmount || 
        (item.discountPercentage ? lineTotal * (item.discountPercentage / 100) : 0);
      subtotal += lineTotal - itemDiscount;
    }

    // Apply sale-level discount
    const discountAmount = saleDiscountAmount || 0;
    const afterDiscount = subtotal - discountAmount;

    // Calculate tax
    const taxAmount = afterDiscount * config.sales.defaultTaxRate;
    const totalAmount = afterDiscount + taxAmount;

    return {
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      paidAmount: totalAmount, // Assuming full payment for now
      changeAmount: 0,
    };
  }

  private async createSaleItems(
    saleId: string,
    itemsData: Array<{
      inventoryItemId: string;
      productId: string;
      quantity: number;
      unit: UnitType;
      unitPrice: number;
      discountAmount?: number;
      discountPercentage?: number;
      barcodeScanned: boolean;
      actualWeight?: number;
      tareWeight?: number;
    }>
  ): Promise<SaleItem[]> {
    // Get product details from inventory service
    const enrichedItems = await this.enrichItemsWithProductData(itemsData);

    const items = enrichedItems.map(item => ({
      saleId,
      inventoryItemId: item.inventoryItemId,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      listPrice: item.listPrice || item.unitPrice,
      discountAmount: item.discountAmount || 0,
      discountPercentage: item.discountPercentage || 0,
      lineTotal: (item.quantity * item.unitPrice) - (item.discountAmount || 0),
      batchNumber: item.batchNumber,
      expirationDate: item.expirationDate,
      barcodeScanned: item.barcodeScanned,
      actualWeight: item.actualWeight,
      tareWeight: item.tareWeight,
      netWeight: item.actualWeight && item.tareWeight ? item.actualWeight - item.tareWeight : undefined,
      unitCost: item.unitCost || 0,
      totalCost: (item.unitCost || 0) * item.quantity,
    }));

    return this.saleItemModel.bulkCreate(items);
  }

  private async createSalePayments(
    saleId: string,
    paymentsData: Array<{
      paymentMethod: PaymentMethod;
      amount: number;
      referenceNumber?: string;
      receivedAmount?: number;
      cardLast4?: string;
      cardType?: string;
      bankName?: string;
      approvalCode?: string;
      terminalId?: string;
    }>,
    processedBy: string
  ): Promise<SalePayment[]> {
    const payments = paymentsData.map(payment => ({
      saleId,
      paymentMethod: payment.paymentMethod,
      amount: payment.amount,
      referenceNumber: payment.referenceNumber,
      receivedAmount: payment.receivedAmount,
      changeAmount: payment.receivedAmount ? Math.max(0, payment.receivedAmount - payment.amount) : undefined,
      cardLast4: payment.cardLast4,
      cardType: payment.cardType,
      bankName: payment.bankName,
      approvalCode: payment.approvalCode,
      terminalId: payment.terminalId,
      processedBy,
    }));

    return this.salePaymentModel.bulkCreate(payments);
  }

  private async enrichItemsWithProductData(
    items: Array<{
      inventoryItemId: string;
      productId: string;
      quantity: number;
      unit: UnitType;
      unitPrice: number;
      discountAmount?: number;
      discountPercentage?: number;
      barcodeScanned: boolean;
      actualWeight?: number;
      tareWeight?: number;
    }>
  ) {
    try {
      const inventoryService = axios.create({
        baseURL: config.services.inventoryService.url,
        timeout: config.services.inventoryService.timeout,
      });

      const response = await inventoryService.post('/api/inventory/items/batch-details', {
        inventoryItemIds: items.map(item => item.inventoryItemId),
      });

      const itemDetails = response.data.items || {};

      return items.map(item => {
        const details = itemDetails[item.inventoryItemId] || {};
        return {
          ...item,
          productName: details.productName || `Product ${item.productId}`,
          productSku: details.productSku,
          listPrice: details.listPrice,
          unitCost: details.unitCost,
          batchNumber: details.batchNumber,
          expirationDate: details.expirationDate,
        };
      });

    } catch (error) {
      logger.warn('Failed to enrich items with product data, using defaults', { error: error.message });
      
      // Return items with default values if service fails
      return items.map(item => ({
        ...item,
        productName: `Product ${item.productId}`,
        productSku: undefined,
        listPrice: item.unitPrice,
        unitCost: 0,
        batchNumber: undefined,
        expirationDate: undefined,
      }));
    }
  }

  private async deductInventory(saleItems: SaleItem[]): Promise<void> {
    try {
      const inventoryService = axios.create({
        baseURL: config.services.inventoryService.url,
        timeout: config.services.inventoryService.timeout,
      });

      const deductionRequests = saleItems.map(item => ({
        inventoryItemId: item.inventoryItemId,
        quantity: item.quantity,
        unit: item.unit,
        reason: 'sale',
        referenceId: item.saleId,
        referenceType: 'sale',
      }));

      await inventoryService.post('/api/inventory/deduct', {
        items: deductionRequests,
      });

    } catch (error) {
      logger.error('Failed to deduct inventory', { error: error.message, saleItems });
      throw new Error(`Inventory deduction failed: ${error.message}`);
    }
  }

  private async restoreInventory(saleItems: Array<{
    inventoryItemId: string;
    quantity: number;
    unit: UnitType;
  }>): Promise<void> {
    try {
      const inventoryService = axios.create({
        baseURL: config.services.inventoryService.url,
        timeout: config.services.inventoryService.timeout,
      });

      const restorationRequests = saleItems.map(item => ({
        inventoryItemId: item.inventoryItemId,
        quantity: item.quantity,
        unit: item.unit,
        reason: 'sale_void',
        referenceType: 'sale_void',
      }));

      await inventoryService.post('/api/inventory/add', {
        items: restorationRequests,
      });

    } catch (error) {
      logger.error('Failed to restore inventory', { error: error.message, saleItems });
      throw new Error(`Inventory restoration failed: ${error.message}`);
    }
  }

  private async publishSaleEvent(eventType: string, data: any): Promise<void> {
    try {
      await this.db.publishEvent('sales', eventType, data);
    } catch (error) {
      logger.error('Failed to publish sale event', { eventType, data, error: error.message });
    }
  }

  private async updateRealTimeSalesCache(branchId: string, saleData: any): Promise<void> {
    try {
      await this.db.updateRealTimeSalesCache(branchId, saleData);
    } catch (error) {
      logger.error('Failed to update real-time sales cache', { branchId, error: error.message });
    }
  }
}

export default SalesService;