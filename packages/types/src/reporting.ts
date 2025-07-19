// Reporting and Analytics Types

export enum ReportType {
  SALES_ANALYTICS = 'sales_analytics',
  INVENTORY_MOVEMENT = 'inventory_movement',
  BRANCH_PERFORMANCE = 'branch_performance',
  PRODUCT_RANKING = 'product_ranking',
  SAMPLING_ROI = 'sampling_roi',
  PROCUREMENT_ANALYSIS = 'procurement_analysis',
  FINANCIAL_SUMMARY = 'financial_summary',
  OPERATIONAL_KPI = 'operational_kpi'
}

export enum ExportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
  JSON = 'json'
}

export enum ScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

export enum CacheStatus {
  VALID = 'valid',
  EXPIRED = 'expired',
  GENERATING = 'generating',
  FAILED = 'failed'
}

export enum TimePeriod {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  THIS_WEEK = 'this_week',
  LAST_WEEK = 'last_week',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_QUARTER = 'this_quarter',
  LAST_QUARTER = 'last_quarter',
  THIS_YEAR = 'this_year',
  LAST_YEAR = 'last_year',
  CUSTOM = 'custom'
}

// Base interfaces
export interface ReportCache {
  id: string;
  cacheKey: string;
  reportType: ReportType;
  parameters: Record<string, any>;
  data: any;
  dataHash: string;
  status: CacheStatus;
  generatedAt: Date;
  expiresAt: Date;
  generationTimeMs: number;
  dataSizeBytes: number;
  accessCount: number;
  lastAccessedAt: Date;
  createdBy?: string;
}

export interface ReportSchedule {
  id: string;
  scheduleName: string;
  reportType: ReportType;
  frequency: ScheduleFrequency;
  parameters: Record<string, any>;
  exportFormat: ExportFormat;
  isActive: boolean;
  recipients: string[];
  nextRunAt: Date;
  lastRunAt?: Date;
  lastRunStatus?: string;
  runCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportExecution {
  id: string;
  scheduleId?: string;
  reportType: ReportType;
  parameters: Record<string, any>;
  exportFormat?: ExportFormat;
  executionStart: Date;
  executionEnd?: Date;
  executionTimeMs?: number;
  status: string;
  filePath?: string;
  fileSizeBytes?: number;
  errorMessage?: string;
  triggeredBy?: string;
  dataRowsCount: number;
}

// Analytics Data Structures
export interface SalesAnalytics {
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    totalQuantity: number;
    averageTransactionValue: number;
    grossProfit: number;
    grossMarginPercentage: number;
    topSellingProduct: string;
    bestPerformingBranch: string;
  };
  trends: Array<{
    date: string;
    revenue: number;
    transactions: number;
    quantity: number;
    averageValue: number;
    grossProfit: number;
    marginPercentage: number;
  }>;
  branchBreakdown: Array<{
    branchId: string;
    branchName: string;
    revenue: number;
    transactions: number;
    marketShare: number;
    growthRate: number;
  }>;
  productBreakdown: Array<{
    productId: string;
    productName: string;
    revenue: number;
    quantity: number;
    marketShare: number;
    profitMargin: number;
  }>;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    revenue: number;
    quantity: number;
    averagePrice: number;
    profitMargin: number;
  }>;
  hourlyPattern: Array<{
    hour: number;
    revenue: number;
    transactions: number;
    averageValue: number;
  }>;
  comparisons: {
    previousPeriod: {
      revenue: number;
      transactions: number;
      growthRate: number;
    };
    yearOverYear: {
      revenue: number;
      transactions: number;
      growthRate: number;
    };
  };
}

export interface InventoryMovement {
  summary: {
    totalMovements: number;
    totalValue: number;
    stockIncrease: number;
    stockDecrease: number;
    turnoverRate: number;
    deadStockValue: number;
  };
  movements: Array<{
    date: string;
    movementType: string;
    quantity: number;
    value: number;
    productCount: number;
  }>;
  productMovements: Array<{
    productId: string;
    productName: string;
    totalIn: number;
    totalOut: number;
    netChange: number;
    turnoverRate: number;
    currentStock: number;
    stockValue: number;
  }>;
  branchMovements: Array<{
    branchId: string;
    branchName: string;
    totalIn: number;
    totalOut: number;
    netChange: number;
    stockValue: number;
  }>;
  slowMovingProducts: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    lastMovement: Date;
    daysWithoutMovement: number;
    stockValue: number;
  }>;
  fastMovingProducts: Array<{
    productId: string;
    productName: string;
    turnoverRate: number;
    averageDailyMovement: number;
    currentStock: number;
    recommendedReorderPoint: number;
  }>;
}

export interface BranchPerformance {
  summary: {
    totalBranches: number;
    totalRevenue: number;
    averageRevenuePerBranch: number;
    bestPerformingBranch: string;
    worstPerformingBranch: string;
  };
  branches: Array<{
    branchId: string;
    branchName: string;
    location: string;
    revenue: number;
    transactions: number;
    averageTransactionValue: number;
    grossProfit: number;
    grossMarginPercentage: number;
    inventoryValue: number;
    inventoryTurnover: number;
    samplingCost: number;
    samplingROI: number;
    performanceScore: number;
    ranking: number;
    growthRate: number;
  }>;
  comparisons: Array<{
    metric: string;
    branchRankings: Array<{
      branchId: string;
      branchName: string;
      value: number;
      rank: number;
    }>;
  }>;
  efficiency: Array<{
    branchId: string;
    branchName: string;
    revenuePerSquareMeter?: number;
    transactionsPerHour?: number;
    inventoryTurnoverDays: number;
    staffProductivity?: number;
  }>;
}

export interface ProductRanking {
  summary: {
    totalProducts: number;
    topPerformer: string;
    bottomPerformer: string;
    averageMargin: number;
  };
  products: Array<{
    productId: string;
    productName: string;
    sku: string;
    categoryName: string;
    totalRevenue: number;
    totalQuantity: number;
    transactions: number;
    averagePrice: number;
    grossMargin: number;
    inventoryTurnover: number;
    samplingConversionRate: number;
    revenueRank: number;
    quantityRank: number;
    marginRank: number;
    overallRank: number;
    performanceScore: number;
    trendDirection: 'up' | 'down' | 'stable';
  }>;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    totalRevenue: number;
    totalProducts: number;
    averageMargin: number;
    marketShare: number;
  }>;
  trends: Array<{
    productId: string;
    productName: string;
    monthlyData: Array<{
      month: string;
      revenue: number;
      quantity: number;
      rank: number;
    }>;
  }>;
}

export interface SamplingROI {
  summary: {
    totalSamplingCost: number;
    totalSamplingRevenue: number;
    overallROI: number;
    conversionRate: number;
    costPerConversion: number;
    revenuePerSample: number;
  };
  branchAnalysis: Array<{
    branchId: string;
    branchName: string;
    totalCost: number;
    totalRevenue: number;
    roi: number;
    conversionRate: number;
    samplesGiven: number;
    conversions: number;
    costPerSample: number;
    revenuePerSample: number;
  }>;
  productAnalysis: Array<{
    productId: string;
    productName: string;
    totalCost: number;
    totalRevenue: number;
    roi: number;
    conversionRate: number;
    samplesGiven: number;
    averageSampleSize: number;
    costPerGram: number;
  }>;
  trends: Array<{
    date: string;
    cost: number;
    revenue: number;
    roi: number;
    conversionRate: number;
    samplesGiven: number;
  }>;
  efficiency: Array<{
    metric: string;
    value: number;
    benchmark: number;
    performance: 'above' | 'below' | 'at';
  }>;
}

export interface ProcurementAnalysis {
  summary: {
    totalPurchaseOrders: number;
    totalProcurementValue: number;
    averageOrderValue: number;
    onTimeDeliveryRate: number;
    qualityPassRate: number;
    costSavings: number;
  };
  suppliers: Array<{
    supplierId: string;
    supplierName: string;
    totalOrders: number;
    totalValue: number;
    averageLeadTime: number;
    onTimeDeliveryRate: number;
    qualityRating: number;
    priceCompetitiveness: number;
    overallRating: number;
    marketShare: number;
  }>;
  orders: Array<{
    month: string;
    orderCount: number;
    totalValue: number;
    averageValue: number;
    onTimeDeliveries: number;
    qualityIssues: number;
  }>;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    totalValue: number;
    orderCount: number;
    averagePrice: number;
    priceVariance: number;
    topSupplier: string;
  }>;
  costs: Array<{
    month: string;
    materialCost: number;
    shippingCost: number;
    qualityCost: number;
    totalCost: number;
    budgetVariance: number;
  }>;
}

export interface RealTimeDashboard {
  overview: {
    todayRevenue: number;
    todayTransactions: number;
    activeBranches: number;
    lowStockAlerts: number;
    pendingApprovals: number;
    criticalIssues: number;
  };
  liveMetrics: {
    hourlyRevenue: Array<{
      hour: number;
      revenue: number;
      transactions: number;
    }>;
    branchStatus: Array<{
      branchId: string;
      branchName: string;
      status: 'online' | 'offline' | 'warning';
      currentRevenue: number;
      target: number;
      achievement: number;
    }>;
    topProducts: Array<{
      productId: string;
      productName: string;
      todayQuantity: number;
      todayRevenue: number;
      trend: number;
    }>;
    alerts: Array<{
      type: string;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      timestamp: Date;
      branchId?: string;
    }>;
  };
  performance: {
    revenueTarget: {
      current: number;
      target: number;
      achievement: number;
      trend: number;
    };
    inventoryHealth: {
      totalValue: number;
      lowStockItems: number;
      overstockItems: number;
      turnoverRate: number;
    };
    operationalEfficiency: {
      averageTransactionTime: number;
      systemUptime: number;
      errorRate: number;
      processingSpeed: number;
    };
  };
}

// Request/Response types
export interface ReportRequest {
  reportType: ReportType;
  parameters: {
    branchId?: string;
    productId?: string;
    categoryId?: string;
    supplierId?: string;
    period?: TimePeriod;
    dateFrom?: Date;
    dateTo?: Date;
    groupBy?: string[];
    metrics?: string[];
    comparison?: boolean;
    includeSubcategories?: boolean;
    includeInactive?: boolean;
  };
  format?: ExportFormat;
  useCache?: boolean;
  cacheTimeout?: number; // minutes
}

export interface ReportResponse<T = any> {
  success: boolean;
  data: T;
  metadata: {
    reportType: ReportType;
    parameters: Record<string, any>;
    generatedAt: Date;
    executionTimeMs: number;
    dataRowsCount: number;
    fromCache: boolean;
    cacheExpiresAt?: Date;
  };
  exportUrl?: string;
}

export interface ExportRequest {
  reportType: ReportType;
  format: ExportFormat;
  parameters: Record<string, any>;
  fileName?: string;
  template?: string;
  includeCharts?: boolean;
  includeRawData?: boolean;
}

export interface ExportResponse {
  success: boolean;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  expiresAt: Date;
  downloadToken: string;
}

export interface ScheduleReportRequest {
  scheduleName: string;
  reportType: ReportType;
  frequency: ScheduleFrequency;
  parameters: Record<string, any>;
  exportFormat: ExportFormat;
  recipients: string[];
  startDate?: Date;
  endDate?: Date;
  timezone?: string;
}

export interface DashboardWidgetConfig {
  id: string;
  title: string;
  type: 'chart' | 'metric' | 'table' | 'map';
  reportType: ReportType;
  parameters: Record<string, any>;
  refreshInterval: number; // seconds
  chartConfig?: {
    chartType: 'line' | 'bar' | 'pie' | 'doughnut' | 'area';
    xAxis: string;
    yAxis: string;
    groupBy?: string;
    colors?: string[];
  };
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isVisible: boolean;
}

export interface AnalyticsFilters {
  branches?: string[];
  products?: string[];
  categories?: string[];
  suppliers?: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
  comparison?: {
    enabled: boolean;
    period: TimePeriod;
  };
  grouping: {
    timeUnit: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
    dimensions: string[];
  };
  metrics: string[];
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
  }>;
}

export interface TableData {
  headers: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'currency' | 'percentage' | 'date';
    sortable?: boolean;
    format?: string;
  }>;
  rows: Array<Record<string, any>>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
  sorting?: {
    column: string;
    direction: 'asc' | 'desc';
  };
}

export interface MetricCard {
  title: string;
  value: number;
  format: 'number' | 'currency' | 'percentage';
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'stable';
    period: string;
  };
  target?: {
    value: number;
    achievement: number;
  };
  status: 'success' | 'warning' | 'danger' | 'info';
}

// Aggregation functions
export interface AggregationConfig {
  groupBy: string[];
  metrics: Array<{
    field: string;
    function: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';
    alias?: string;
  }>;
  filters?: Record<string, any>;
  having?: Record<string, any>;
  orderBy?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  limit?: number;
}

export interface QueryOptimization {
  useCache: boolean;
  cacheTimeout: number;
  useMaterializedViews: boolean;
  indexHints?: string[];
  parallelQuery?: boolean;
  compressionLevel?: number;
}