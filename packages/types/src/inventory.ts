import { BaseEntity, UnitType } from './common';

export interface InventoryItem extends BaseEntity {
  productId: string;
  branchId: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  unit: UnitType;
  minStockLevel: number;
  maxStockLevel: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastRestockDate?: Date;
  expirationDate?: Date;
  batchNumber?: string;
  supplierLotNumber?: string;
  location?: WarehouseLocation;
  cost: number;
  averageCost: number;
}

export interface WarehouseLocation {
  section: string;
  aisle: string;
  shelf: string;
  bin?: string;
}

export interface StockMovement extends BaseEntity {
  inventoryItemId: string;
  type: StockMovementType;
  quantity: number;
  unit: UnitType;
  previousStock: number;
  newStock: number;
  reason: string;
  referenceId?: string;
  referenceType?: StockMovementReferenceType;
  performedBy: string;
  approvedBy?: string;
  notes?: string;
}

export enum StockMovementType {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
  ADJUSTMENT = 'adjustment',
  TRANSFER = 'transfer',
  REPACK = 'repack',
  SAMPLE = 'sample',
  WASTE = 'waste',
  RETURN = 'return'
}

export enum StockMovementReferenceType {
  PURCHASE_ORDER = 'purchase_order',
  SALES_ORDER = 'sales_order',
  TRANSFER_ORDER = 'transfer_order',
  STOCK_COUNT = 'stock_count',
  REPACK_ORDER = 'repack_order',
  SAMPLE_REQUEST = 'sample_request'
}

export interface StockCount extends BaseEntity {
  branchId: string;
  countNumber: string;
  status: StockCountStatus;
  scheduledDate: Date;
  startedAt?: Date;
  completedAt?: Date;
  countedBy: string[];
  supervisedBy?: string;
  type: StockCountType;
  notes?: string;
  discrepancies: StockCountDiscrepancy[];
}

export enum StockCountStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum StockCountType {
  FULL = 'full',
  CYCLE = 'cycle',
  SPOT = 'spot'
}

export interface StockCountItem extends BaseEntity {
  stockCountId: string;
  inventoryItemId: string;
  expectedQuantity: number;
  countedQuantity?: number;
  variance?: number;
  notes?: string;
  countedBy?: string;
  countedAt?: Date;
}

export interface StockCountDiscrepancy {
  inventoryItemId: string;
  expected: number;
  counted: number;
  variance: number;
  variancePercentage: number;
  reason?: string;
  action: 'approve' | 'investigate' | 'recount';
}

export interface RepackOrder extends BaseEntity {
  repackNumber: string;
  branchId: string;
  status: RepackOrderStatus;
  sourceItems: RepackSourceItem[];
  targetProduct: RepackTargetProduct;
  scheduledDate: Date;
  startedAt?: Date;
  completedAt?: Date;
  performedBy?: string;
  supervisedBy?: string;
  notes?: string;
}

export enum RepackOrderStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface RepackSourceItem {
  inventoryItemId: string;
  requiredQuantity: number;
  actualQuantity?: number;
  unit: UnitType;
}

export interface RepackTargetProduct {
  productId: string;
  expectedQuantity: number;
  actualQuantity?: number;
  unit: UnitType;
}

export interface LowStockAlert extends BaseEntity {
  inventoryItemId: string;
  alertLevel: 'warning' | 'critical';
  currentStock: number;
  minStockLevel: number;
  status: 'active' | 'resolved' | 'ignored';
  notifiedUsers: string[];
  resolvedAt?: Date;
  resolvedBy?: string;
}