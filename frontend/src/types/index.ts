// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// User and Authentication Types
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF'
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  branchId?: string;
  branch?: Branch;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

// Branch Types
export interface Branch {
  id: string;
  name: string;
  location: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Product Types
export enum ProductUnit {
  GRAM = 'GRAM',
  KILOGRAM = 'KILOGRAM',
  PIECE = 'PIECE',
  PACKAGE = 'PACKAGE'
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string;
  unit: ProductUnit;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Stock Management Types
export interface StockLevel {
  id: string;
  productId: string;
  product: Product;
  branchId: string;
  branch: Branch;
  quantity: number;
  threshold: number;
  lastUpdated: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  product: Product;
  branchId: string;
  branch: Branch;
  type: StockMovementType;
  quantity: number;
  notes?: string;
  saleRecordId?: string;
  purchaseOrderId?: string;
  stockReceivingId?: string;
  createdAt: string;
}

export enum StockMovementType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT'
}

// Sales Types
export enum SaleUnit {
  GRAM = 'GRAM',
  KILOGRAM = 'KILOGRAM',
  PIECE = 'PIECE',
  PACKAGE = 'PACKAGE'
}

export interface SaleItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unit: SaleUnit;
  notes?: string;
}

export interface SaleRecord {
  id: string;
  branchId: string;
  branch: Branch;
  totalQuantity: number;
  notes?: string;
  items: SaleItem[];
  recordedBy: string;
  recordedByUser: User;
  recordedAt: string;
}

export interface SaleRecordRequest {
  items: SaleItemRequest[];
  notes?: string;
}

export interface SaleItemRequest {
  productId: string;
  quantity: number;
  unit: SaleUnit;
  notes?: string;
}

// Purchase Order Types
export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  branchId: string;
  branch: Branch;
  status: PurchaseOrderStatus;
  totalQuantity: number;
  notes?: string;
  items: PurchaseOrderItem[];
  requestedBy: string;
  requestedByUser: User;
  requestedAt: string;
  approvedBy?: string;
  approvedByUser?: User;
  approvedAt?: string;
}

export interface PurchaseOrderRequest {
  items: PurchaseOrderItemRequest[];
  notes?: string;
}

export interface PurchaseOrderItemRequest {
  productId: string;
  quantity: number;
  notes?: string;
}

// Stock Receiving Types
export interface StockReceivingItem {
  id: string;
  productId: string;
  product: Product;
  orderedQuantity: number;
  receivedQuantity: number;
  notes?: string;
}

export interface StockReceiving {
  id: string;
  purchaseOrderId: string;
  purchaseOrder: PurchaseOrder;
  branchId: string;
  branch: Branch;
  totalReceivedQuantity: number;
  hasDiscrepancies: boolean;
  notes?: string;
  items: StockReceivingItem[];
  receivedBy: string;
  receivedByUser: User;
  receivedAt: string;
}

export interface StockReceivingRequest {
  purchaseOrderId: string;
  items: StockReceivingItemRequest[];
  notes?: string;
}

export interface StockReceivingItemRequest {
  productId: string;
  receivedQuantity: number;
  notes?: string;
}

// Analytics Types
export interface HourlyQuantitySales {
  hour: number;
  quantitySold: number;
  transactionCount: number;
  topProduct?: string;
}

export interface DailyQuantityTrend {
  date: Date;
  totalQuantitySold: number;
  totalTransactions: number;
  hourlyBreakdown: HourlyQuantitySales[];
}

export interface ProductQuantityRanking {
  rank: number;
  productId: string;
  productName: string;
  productSku: string;
  totalQuantitySold: number;
  totalTransactions: number;
  unit?: ProductUnit;
}

export interface SalesQuantityPattern {
  overview: {
    totalSales: number;
    totalQuantitySold: number;
    averageQuantityPerSale: number;
    averageSalesPerDay: number;
  };
  patterns: {
    peakHour: number;
    peakDay: number;
    bestPerformingTimeSlot: string;
  };
  trends: {
    growthRate: string;
    seasonality: string;
    consistency: number;
  };
}

// UI Component Types
export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  path?: string;
  children?: MenuItem[];
  roles?: UserRole[];
  badge?: string | number;
}

export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
  width?: string;
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Form Types
export interface FormErrors {
  [key: string]: string | undefined;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => string | undefined;
  };
}

// Socket.IO Types
export interface SocketEvents {
  // Stock level updates
  'stock-level-update': (data: { productId: string; branchId: string; quantity: number }) => void;
  'low-stock-alert': (data: { productId: string; branchId: string; currentQuantity: number; threshold: number }) => void;
  
  // Sales updates
  'new-sale': (data: SaleRecord) => void;
  'sales-summary-update': (data: { branchId: string; totalSales: number; totalQuantity: number }) => void;
  
  // Purchase order updates
  'purchase-order-update': (data: { orderId: string; status: PurchaseOrderStatus }) => void;
  'stock-receiving-complete': (data: { receivingId: string; branchId: string }) => void;
}

// Barcode/QR Scanner Types
export interface BarcodeResult {
  text: string;
  format: string;
  timestamp: number;
}

export interface ScannerConfig {
  fps: number;
  qrbox: number;
  aspectRatio?: number;
  disableFlip?: boolean;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// Utility Types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
    Pick<T, Exclude<keyof T, Keys>> 
    & {
        [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
    }[Keys];