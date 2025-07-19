import { BaseEntity, UnitType } from './common';

export enum SaleStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  VOIDED = 'voided',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  MOBILE_PAYMENT = 'mobile_payment',
  BANK_TRANSFER = 'bank_transfer',
  STORE_CREDIT = 'store_credit',
  GIFT_CARD = 'gift_card',
  MULTIPLE = 'multiple',
}

export enum SaleType {
  WALK_IN = 'walk_in',
  ONLINE = 'online',
  PHONE_ORDER = 'phone_order',
  MALL_KIOSK = 'mall_kiosk',
  WHOLESALE = 'wholesale',
  EMPLOYEE = 'employee',
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  BUY_X_GET_Y = 'buy_x_get_y',
  BULK_DISCOUNT = 'bulk_discount',
  MEMBER_DISCOUNT = 'member_discount',
  EMPLOYEE_DISCOUNT = 'employee_discount',
}

export interface Sale extends BaseEntity {
  saleNumber: string;
  branchId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  saleType: SaleType;
  status: SaleStatus;
  
  // Totals
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  
  // Items and payments
  items: SaleItem[];
  payments: SalePayment[];
  discounts: SaleDiscount[];
  
  // Staff and location
  soldBy: string;
  cashierId?: string;
  mallLocation?: string;
  posTerminalId?: string;
  
  // Timestamps
  saleDate: Date;
  voidedAt?: Date;
  voidedBy?: string;
  voidReason?: string;
  
  // Additional info
  notes?: string;
  receiptPrinted: boolean;
  emailReceiptSent: boolean;
}

export interface SaleItem extends BaseEntity {
  saleId: string;
  inventoryItemId: string;
  productId: string;
  productName: string;
  productSku?: string;
  
  // Quantity and pricing
  quantity: number;
  unit: UnitType;
  unitPrice: number;
  listPrice: number;
  
  // Discounts
  discountAmount: number;
  discountPercentage: number;
  lineTotal: number;
  
  // Product details
  batchNumber?: string;
  expirationDate?: Date;
  barcodeScanned: boolean;
  
  // Weight information (for products sold by weight)
  actualWeight?: number;
  tareWeight?: number;
  netWeight?: number;
  
  // Cost tracking
  unitCost: number;
  totalCost: number;
  grossMargin: number;
  
  // Status
  voided: boolean;
  voidedAt?: Date;
  voidReason?: string;
}

export interface SalePayment extends BaseEntity {
  saleId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  currency: string;
  
  // Payment details
  referenceNumber?: string;
  cardLast4?: string;
  cardType?: string;
  authorizationCode?: string;
  
  // Processing info
  processedAt: Date;
  processorResponse?: string;
  isRefunded: boolean;
  refundedAmount: number;
  refundedAt?: Date;
}

export interface SaleDiscount extends BaseEntity {
  saleId: string;
  discountType: DiscountType;
  name: string;
  description?: string;
  
  // Discount calculation
  discountValue: number; // Percentage or fixed amount
  discountAmount: number; // Calculated discount amount
  
  // Conditions
  minimumQuantity?: number;
  minimumAmount?: number;
  applicableProductIds?: string[];
  
  // Validity
  validFrom?: Date;
  validTo?: Date;
  isActive: boolean;
  
  // Usage tracking
  timesUsed: number;
  maxUsage?: number;
}

export interface Customer extends BaseEntity {
  customerCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  
  // Address
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  
  // Membership
  membershipLevel?: string;
  membershipNumber?: string;
  memberSince?: Date;
  pointsBalance: number;
  
  // Purchase history
  totalPurchases: number;
  totalSpent: number;
  averageOrderValue: number;
  lastPurchaseDate?: Date;
  
  // Preferences
  preferredBranchId?: string;
  marketingOptIn: boolean;
  notes?: string;
  
  // Status
  isActive: boolean;
  isVip: boolean;
}

// Request/Response types
export interface CreateSaleRequest {
  branchId: string;
  customerId?: string;
  customerInfo?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  saleType: SaleType;
  items: Array<{
    inventoryItemId: string;
    quantity: number;
    unitPrice?: number; // Optional override
    discountAmount?: number;
    barcodeScanned?: boolean;
    actualWeight?: number;
  }>;
  payments?: Array<{
    paymentMethod: PaymentMethod;
    amount: number;
    referenceNumber?: string;
    cardLast4?: string;
  }>;
  discounts?: Array<{
    discountType: DiscountType;
    name: string;
    discountValue: number;
    applicableProductIds?: string[];
  }>;
  mallLocation?: string;
  posTerminalId?: string;
  notes?: string;
}

export interface VoidSaleRequest {
  reason: string;
  items?: Array<{
    saleItemId: string;
    voidQuantity?: number;
    reason?: string;
  }>;
}

export interface SaleResponse {
  sale: Sale;
  stockAdjustments: Array<{
    inventoryItemId: string;
    previousStock: number;
    newStock: number;
    quantitySold: number;
  }>;
  receiptData: {
    receiptNumber: string;
    qrCode: string;
    printData: any;
  };
}

export interface SalesReport {
  branchId: string;
  branchName: string;
  reportDate: Date;
  
  // Sales summary
  totalSales: number;
  totalAmount: number;
  totalDiscount: number;
  totalTax: number;
  netAmount: number;
  
  // Transaction breakdown
  transactionCount: number;
  averageTransactionValue: number;
  largestTransaction: number;
  smallestTransaction: number;
  
  // Payment methods
  paymentBreakdown: Array<{
    method: PaymentMethod;
    count: number;
    amount: number;
    percentage: number;
  }>;
  
  // Product performance
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
    margin: number;
  }>;
  
  // Hourly breakdown
  hourlySales: Array<{
    hour: number;
    salesCount: number;
    revenue: number;
  }>;
  
  // Staff performance
  staffPerformance: Array<{
    staffId: string;
    staffName: string;
    salesCount: number;
    revenue: number;
  }>;
}

export interface RealTimeSalesData {
  branchId: string;
  currentDate: Date;
  
  // Today's totals
  todaySales: number;
  todayRevenue: number;
  todayTransactions: number;
  
  // Comparisons
  yesterdayRevenue: number;
  lastWeekRevenue: number;
  monthToDateRevenue: number;
  
  // Current metrics
  averageTransactionValue: number;
  transactionsPerHour: number;
  
  // Recent activity
  recentSales: Array<{
    saleNumber: string;
    amount: number;
    itemCount: number;
    timestamp: Date;
    customerName?: string;
  }>;
  
  // Alerts
  lowStockAlerts: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    reorderLevel: number;
  }>;
  
  // Live updates
  lastUpdated: Date;
  isLive: boolean;
}

// Analytics types
export interface SalesAnalytics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  // Revenue metrics
  totalRevenue: number;
  revenueGrowth: number;
  revenueByDay: Array<{
    date: string;
    revenue: number;
    transactions: number;
  }>;
  
  // Product insights
  productPerformance: Array<{
    productId: string;
    productName: string;
    revenue: number;
    quantitySold: number;
    averagePrice: number;
    margin: number;
    growth: number;
  }>;
  
  // Customer insights
  customerMetrics: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    averageOrderValue: number;
    customerRetentionRate: number;
  };
  
  // Trends
  salesTrends: {
    hourlyPattern: number[];
    dailyPattern: number[];
    monthlyPattern: number[];
  };
  
  // Predictions
  predictions: {
    nextDayRevenue: number;
    nextWeekRevenue: number;
    confidence: number;
  };
}

// Mall integration types
export interface MallSalesData {
  mallId: string;
  mallName: string;
  branchId: string;
  
  // Mall-specific metrics
  footTraffic: number;
  conversionRate: number;
  averageSpendPerVisitor: number;
  
  // Comparative data
  ourSales: number;
  mallTotalSales: number;
  marketShare: number;
  categoryShare: number;
  
  // Rankings
  rankInMall: number;
  rankInCategory: number;
  
  // Lease and costs
  rentAmount: number;
  commonAreaCharges: number;
  marketingFund: number;
  totalMallCosts: number;
  
  // Performance vs targets
  salesTarget: number;
  salesAchievement: number;
  targetVariance: number;
}