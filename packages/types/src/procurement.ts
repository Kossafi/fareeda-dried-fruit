// Procurement and Purchase Order Types

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SENT_TO_SUPPLIER = 'sent_to_supplier',
  CONFIRMED_BY_SUPPLIER = 'confirmed_by_supplier',
  IN_TRANSIT = 'in_transit',
  PARTIALLY_RECEIVED = 'partially_received',
  FULLY_RECEIVED = 'fully_received',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum UrgencyLevel {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum SupplierType {
  REGULAR = 'regular',
  PREMIUM = 'premium',
  BACKUP = 'backup'
}

export enum ApprovalAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  REQUEST_CHANGES = 'request_changes'
}

export enum QualityCheckStatus {
  PENDING = 'pending',
  PASSED = 'passed',
  FAILED = 'failed',
  PARTIAL = 'partial'
}

export interface Supplier {
  id: string;
  supplierCode: string;
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  paymentTerms: number; // days
  creditLimit: number;
  currencyCode: string;
  isActive: boolean;
  supplierType: SupplierType;
  leadTimeDays: number;
  minimumOrderAmount: number;
  discountPercentage: number;
  qualityRating: number; // 0-5
  deliveryRating: number; // 0-5
  priceCompetitiveness: number; // 0-5
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  productId: string;
  supplierSku?: string;
  unitCost: number;
  minimumQuantity: number;
  leadTimeDays: number;
  isPreferred: boolean;
  qualityGrade: string; // A, B, C
  lastPriceUpdate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  branchId: string;
  requestedBy: string;
  status: PurchaseOrderStatus;
  urgency: UrgencyLevel;
  orderDate: Date;
  requiredDate?: Date;
  expectedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shippingCost: number;
  totalAmount: number;
  currencyCode: string;
  paymentTerms: number;
  notes?: string;
  internalNotes?: string;
  supplierReference?: string;
  trackingNumber?: string;
  isAutomated: boolean;
  sourceAlertId?: string;
  approvedBy?: string;
  approvedAt?: Date;
  sentAt?: Date;
  cancelledReason?: string;
  cancelledBy?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  supplierProductId?: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
  actualUnitCost?: number;
  actualTotalCost?: number;
  supplierSku?: string;
  expectedQualityGrade: string;
  actualQualityGrade?: string;
  expirationDate?: Date;
  batchNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseApproval {
  id: string;
  purchaseOrderId: string;
  approvalLevel: number;
  requiredRole: string;
  approverId?: string;
  action?: ApprovalAction;
  comments?: string;
  approvedAmount?: number;
  actionDate?: Date;
  isRequired: boolean;
  createdAt: Date;
}

export interface GoodsReceipt {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string;
  receivedBy: string;
  receivedDate: Date;
  deliveryNoteNumber?: string;
  invoiceNumber?: string;
  totalReceivedAmount: number;
  qualityCheckStatus: QualityCheckStatus;
  qualityCheckedBy?: string;
  qualityCheckDate?: Date;
  qualityNotes?: string;
  discrepancyNotes?: string;
  isComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoodsReceiptItem {
  id: string;
  goodsReceiptId: string;
  purchaseOrderItemId: string;
  productId: string;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
  qualityGrade?: string;
  expirationDate?: Date;
  batchNumber?: string;
  conditionNotes?: string;
  isAccepted: boolean;
  rejectionReason?: string;
  inventoryItemId?: string;
  createdAt: Date;
}

export interface SupplierEvaluation {
  id: string;
  supplierId: string;
  evaluationPeriodStart: Date;
  evaluationPeriodEnd: Date;
  totalOrders: number;
  totalOrderValue: number;
  onTimeDeliveries: number;
  qualityIssues: number;
  deliveryRating: number; // 0-5
  qualityRating: number; // 0-5
  priceCompetitiveness: number; // 0-5
  communicationRating: number; // 0-5
  overallRating: number; // 0-5
  notes?: string;
  evaluatedBy: string;
  createdAt: Date;
}

// Request/Response types for API

export interface CreatePurchaseOrderRequest {
  supplierId: string;
  branchId: string;
  urgency?: UrgencyLevel;
  requiredDate?: Date;
  notes?: string;
  sourceAlertId?: string;
  items: {
    productId: string;
    quantity: number;
    unitCost?: number;
    notes?: string;
  }[];
}

export interface UpdatePurchaseOrderRequest {
  urgency?: UrgencyLevel;
  requiredDate?: Date;
  expectedDeliveryDate?: Date;
  notes?: string;
  internalNotes?: string;
  supplierReference?: string;
  trackingNumber?: string;
}

export interface ApprovePurchaseOrderRequest {
  action: ApprovalAction;
  comments?: string;
  approvedAmount?: number;
}

export interface CreateGoodsReceiptRequest {
  purchaseOrderId: string;
  deliveryNoteNumber?: string;
  invoiceNumber?: string;
  qualityNotes?: string;
  items: {
    purchaseOrderItemId: string;
    quantityReceived: number;
    unitCost?: number;
    qualityGrade?: string;
    expirationDate?: Date;
    batchNumber?: string;
    conditionNotes?: string;
    isAccepted?: boolean;
    rejectionReason?: string;
  }[];
}

export interface SupplierPerformanceReport {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  totalValue: number;
  averageLeadTime: number;
  onTimeDeliveryRate: number;
  qualityScore: number;
  priceCompetitiveness: number;
  overallRating: number;
  lastEvaluationDate?: Date;
  trends: {
    month: string;
    orders: number;
    value: number;
    onTimeRate: number;
    qualityScore: number;
  }[];
}

export interface ProcurementDashboard {
  pendingApprovals: number;
  ordersInTransit: number;
  overdueDeliveries: number;
  monthlySpend: number;
  topSuppliers: {
    supplierId: string;
    supplierName: string;
    monthlyValue: number;
    orderCount: number;
    rating: number;
  }[];
  recentOrders: {
    poNumber: string;
    supplierName: string;
    totalAmount: number;
    status: PurchaseOrderStatus;
    orderDate: Date;
  }[];
  urgentOrders: {
    poNumber: string;
    supplierName: string;
    requiredDate: Date;
    status: PurchaseOrderStatus;
  }[];
}

// Filters and search
export interface PurchaseOrderFilters {
  status?: PurchaseOrderStatus[];
  supplierId?: string;
  branchId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  urgency?: UrgencyLevel[];
  amountMin?: number;
  amountMax?: number;
  requestedBy?: string;
  search?: string; // po number, supplier name, etc.
}

export interface SupplierFilters {
  isActive?: boolean;
  supplierType?: SupplierType[];
  ratingMin?: number;
  location?: string;
  search?: string;
}

// Integration with inventory and alerts
export interface AutoPurchaseOrderRequest {
  alertId: string;
  supplierId?: string; // if not provided, system will select best supplier
  urgency?: UrgencyLevel;
  notes?: string;
}

export interface SupplierRecommendation {
  supplierId: string;
  supplierName: string;
  unitCost: number;
  leadTimeDays: number;
  qualityGrade: string;
  overallScore: number; // calculated based on price, quality, delivery
  isPreferred: boolean;
  lastOrderDate?: Date;
  reasons: string[]; // why this supplier is recommended
}