import { BaseEntity, Address } from './common';

// Delivery Confirmation Types
export interface DeliveryConfirmation extends BaseEntity {
  deliveryOrderId: string;
  confirmedBy: string;
  confirmationDate: Date;
  branchId: string;
  confirmationMethod: ConfirmationMethod;
  notes?: string;
  signatureData?: string;
  photoEvidence: string[];
  locationCoordinates?: {
    latitude: number;
    longitude: number;
  };
  deviceInfo?: any;
  items?: DeliveryConfirmationItem[];
}

export interface DeliveryConfirmationItem extends BaseEntity {
  deliveryConfirmationId: string;
  deliveryOrderItemId: string;
  expectedQuantity: number;
  receivedQuantity: number;
  unit: string;
  conditionStatus: ConditionStatus;
  barcodeScanned: boolean;
  batchNumber?: string;
  expirationDate?: Date;
  damageDescription?: string;
  photoEvidence: string[];
}

export enum ConfirmationMethod {
  MANUAL = 'manual',
  BARCODE_SCAN = 'barcode_scan',
  MOBILE_APP = 'mobile_app',
  SIGNATURE_PAD = 'signature_pad'
}

export enum ConditionStatus {
  GOOD = 'good',
  DAMAGED = 'damaged',
  EXPIRED = 'expired',
  MISSING = 'missing'
}

// Stock Transfer Types
export interface StockTransfer extends BaseEntity {
  deliveryOrderId: string;
  deliveryConfirmationId?: string;
  fromBranchId: string;
  toBranchId: string;
  transferType: string;
  status: TransferStatus;
  referenceNumber: string;
  totalItems: number;
  totalValue: number;
  processedAt?: Date;
  processedBy?: string;
  notes?: string;
  errorMessage?: string;
  retryCount: number;
  items?: StockTransferItem[];
}

export interface StockTransferItem extends BaseEntity {
  stockTransferId: string;
  deliveryOrderItemId: string;
  productId: string;
  inventoryItemId: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  batchNumber?: string;
  expirationDate?: Date;
  transferStatus: string;
  errorMessage?: string;
}

export enum TransferStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Discrepancy Report Types
export interface DiscrepancyReport extends BaseEntity {
  deliveryOrderId: string;
  deliveryConfirmationId?: string;
  reportedBy: string;
  reportDate: Date;
  discrepancyType: DiscrepancyType;
  severity: DiscrepancySeverity;
  status: DiscrepancyStatus;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  totalAffectedItems: number;
  totalValueImpact: number;
  requiresInvestigation: boolean;
  escalatedTo?: string;
  escalatedAt?: Date;
  items?: DiscrepancyReportItem[];
}

export interface DiscrepancyReportItem extends BaseEntity {
  discrepancyReportId: string;
  deliveryOrderItemId: string;
  productId: string;
  expectedQuantity: number;
  receivedQuantity: number;
  discrepancyQuantity: number;
  unit: string;
  discrepancyReason?: string;
  photoEvidence: string[];
  estimatedValueImpact: number;
}

export enum DiscrepancyType {
  QUANTITY_SHORTAGE = 'quantity_shortage',
  QUANTITY_EXCESS = 'quantity_excess',
  DAMAGE = 'damage',
  WRONG_ITEM = 'wrong_item',
  MISSING_ITEM = 'missing_item'
}

export enum DiscrepancySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum DiscrepancyStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export interface Shipment extends BaseEntity {
  shipmentNumber: string;
  orderId?: string;
  transferOrderId?: string;
  fromBranchId: string;
  toBranchId: string;
  carrierInfo: CarrierInfo;
  status: ShipmentStatus;
  items: ShipmentItem[];
  pickupAddress: Address;
  deliveryAddress: Address;
  pickupDate: Date;
  expectedDeliveryDate: Date;
  actualDeliveryDate?: Date;
  trackingNumber?: string;
  shippingCost: number;
  weight: number;
  dimensions?: ShipmentDimensions;
  specialInstructions?: string;
  signature?: string;
  photos?: string[];
  deliveryAttempts: DeliveryAttempt[];
}

export interface CarrierInfo {
  carrierId: string;
  carrierName: string;
  serviceType: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
}

export enum ShipmentStatus {
  PENDING = 'pending',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  FAILED_DELIVERY = 'failed_delivery',
  RETURNED = 'returned',
  CANCELLED = 'cancelled'
}

export interface ShipmentItem {
  productId: string;
  quantity: number;
  unit: string;
  weight: number;
  condition: 'good' | 'damaged' | 'missing';
  notes?: string;
}

export interface ShipmentDimensions {
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'inch';
}

export interface DeliveryAttempt {
  attemptNumber: number;
  attemptDate: Date;
  status: 'successful' | 'failed';
  reason?: string;
  recipientName?: string;
  signature?: string;
  photos?: string[];
  notes?: string;
}

export interface TransferOrder extends BaseEntity {
  transferNumber: string;
  fromBranchId: string;
  toBranchId: string;
  status: TransferOrderStatus;
  type: TransferOrderType;
  priority: TransferPriority;
  items: TransferOrderItem[];
  requestedBy: string;
  approvedBy?: string;
  requestedDate: Date;
  approvedDate?: Date;
  shippedDate?: Date;
  receivedDate?: Date;
  notes?: string;
  totalValue: number;
}

export enum TransferOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PREPARING = 'preparing',
  SHIPPED = 'shipped',
  RECEIVED = 'received',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum TransferOrderType {
  REGULAR = 'regular',
  EMERGENCY = 'emergency',
  REDISTRIBUTION = 'redistribution',
  RETURN_TO_WAREHOUSE = 'return_to_warehouse'
}

export enum TransferPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface TransferOrderItem {
  productId: string;
  requestedQuantity: number;
  approvedQuantity?: number;
  shippedQuantity?: number;
  receivedQuantity?: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  notes?: string;
}

export interface Route extends BaseEntity {
  routeName: string;
  description?: string;
  startBranchId: string;
  endBranchId: string;
  waypoints: RouteWaypoint[];
  distance: number;
  estimatedDuration: number;
  cost: number;
  isActive: boolean;
  restrictions?: RouteRestrictions;
}

export interface RouteWaypoint {
  branchId: string;
  sequence: number;
  estimatedArrival: string;
  estimatedDeparture: string;
  serviceTime: number;
}

export interface RouteRestrictions {
  maxWeight: number;
  maxVolume: number;
  vehicleTypes: string[];
  timeWindows: TimeWindow[];
  specialRequirements: string[];
}

export interface TimeWindow {
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
}

export interface Carrier extends BaseEntity {
  carrierCode: string;
  name: string;
  contactInfo: {
    phone: string;
    email: string;
    address: Address;
  };
  serviceTypes: CarrierService[];
  apiIntegration?: CarrierApiIntegration;
  isActive: boolean;
  ratings: CarrierRating;
}

export interface CarrierService {
  serviceCode: string;
  serviceName: string;
  description: string;
  maxWeight: number;
  maxDimensions: ShipmentDimensions;
  deliveryTime: number;
  cost: number;
  isActive: boolean;
}

export interface CarrierApiIntegration {
  apiEndpoint: string;
  apiKey: string;
  trackingEndpoint: string;
  supportedServices: string[];
}

export interface CarrierRating {
  onTimeDelivery: number;
  damageRate: number;
  customerSatisfaction: number;
  responseTime: number;
  lastUpdated: Date;
}

// Enhanced Delivery Tracking System Types
export enum DeliveryStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum DeliveryType {
  COMPANY_VEHICLE = 'company_vehicle',
  THIRD_PARTY = 'third_party',
  EXPRESS = 'express',
  STANDARD = 'standard',
}

export enum TrackingEventType {
  ORDER_CREATED = 'order_created',
  DRIVER_ASSIGNED = 'driver_assigned',
  PICKUP_STARTED = 'pickup_started',
  PICKUP_COMPLETED = 'pickup_completed',
  IN_TRANSIT = 'in_transit',
  DELIVERY_STARTED = 'delivery_started',
  DELIVERY_COMPLETED = 'delivery_completed',
  DELIVERY_FAILED = 'delivery_failed',
  CANCELLED = 'cancelled',
}

export enum DriverStatus {
  AVAILABLE = 'available',
  ASSIGNED = 'assigned',
  IN_TRANSIT = 'in_transit',
  ON_BREAK = 'on_break',
  OFFLINE = 'offline',
}

export interface DeliveryOrder extends BaseEntity {
  orderNumber: string;
  fromBranchId: string;
  toBranchId: string;
  status: DeliveryStatus;
  deliveryType: DeliveryType;
  
  // Driver information
  driverId?: string;
  vehicleId?: string;
  
  // Scheduling
  scheduledPickupDate: Date;
  scheduledDeliveryDate: Date;
  estimatedDeliveryTime?: number; // minutes
  
  // Actual times
  actualPickupTime?: Date;
  actualDeliveryTime?: Date;
  
  // Order details
  totalItems: number;
  totalWeight: number;
  totalValue: number;
  
  // Special instructions
  specialInstructions?: string;
  requiresSignature: boolean;
  requiresRefrigeration: boolean;
  
  // Contact information
  contactPersonName?: string;
  contactPhone?: string;
  
  // Calculated fields
  deliveryDuration?: number;
  delayMinutes?: number;
}

export interface DeliveryOrderItem extends BaseEntity {
  deliveryOrderId: string;
  inventoryItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  weight: number;
  value: number;
  batchNumber?: string;
  expirationDate?: Date;
  barcodeId?: string;
  confirmed: boolean;
  actualQuantity?: number;
  notes?: string;
}

export interface DeliveryTracking extends BaseEntity {
  deliveryOrderId: string;
  eventType: TrackingEventType;
  status: DeliveryStatus;
  location?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  description: string;
  performedBy?: string;
  deviceInfo?: string;
  timestamp: Date;
  metadata?: any;
}

export interface DriverAssignment extends BaseEntity {
  driverId: string;
  deliveryOrderId: string;
  vehicleId?: string;
  assignedAt: Date;
  assignedBy: string;
  acceptedAt?: Date;
  notes?: string;
  isActive: boolean;
}

export interface Driver extends BaseEntity {
  userId: string;
  employeeId: string;
  licenseNumber: string;
  licenseExpirationDate: Date;
  status: DriverStatus;
  currentLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: Date;
  };
  phoneNumber: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  isActive: boolean;
}

export interface Vehicle extends BaseEntity {
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  capacity: {
    weight: number; // kg
    volume: number; // cubic meters
  };
  fuelType: string;
  hasRefrigeration: boolean;
  gpsDeviceId?: string;
  insuranceExpirationDate: Date;
  lastMaintenanceDate: Date;
  nextMaintenanceDate: Date;
  isActive: boolean;
  currentDriverId?: string;
}

// Delivery Confirmation Request Types
export interface ConfirmDeliveryRequest {
  deliveryOrderId: string;
  confirmedBy: string;
  branchId: string;
  confirmationMethod: ConfirmationMethod;
  items: Array<{
    deliveryOrderItemId: string;
    expectedQuantity: number;
    receivedQuantity: number;
    unit: string;
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
  locationCoordinates?: {
    latitude: number;
    longitude: number;
  };
  deviceInfo?: any;
}

export interface BarcodeConfirmRequest {
  deliveryOrderId: string;
  confirmedBy: string;
  branchId: string;
  scannedBarcodes: Array<{
    barcode: string;
    quantity: number;
    unit: string;
    batchNumber?: string;
    expirationDate?: Date;
  }>;
  deviceInfo?: any;
  locationCoordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface ReportDiscrepancyRequest {
  deliveryOrderId: string;
  reportedBy: string;
  discrepancyType: DiscrepancyType;
  severity: DiscrepancySeverity;
  items: Array<{
    deliveryOrderItemId: string;
    expectedQuantity: number;
    receivedQuantity: number;
    unit: string;
    discrepancyReason?: string;
    photoEvidence?: string[];
    estimatedValueImpact?: number;
  }>;
  notes?: string;
}

// Request/Response types
export interface CreateDeliveryOrderRequest {
  fromBranchId: string;
  toBranchId: string;
  deliveryType: DeliveryType;
  scheduledPickupDate: string;
  scheduledDeliveryDate: string;
  items: Array<{
    inventoryItemId: string;
    quantity: number;
  }>;
  specialInstructions?: string;
  requiresSignature?: boolean;
  requiresRefrigeration?: boolean;
  contactPersonName?: string;
  contactPhone?: string;
}

export interface AssignDriverRequest {
  driverId: string;
  vehicleId?: string;
  notes?: string;
}

export interface UpdateDeliveryStatusRequest {
  status: DeliveryStatus;
  location?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
  actualTime?: string;
}

export interface ConfirmDeliveryRequest {
  items: Array<{
    deliveryOrderItemId: string;
    actualQuantity: number;
    barcodeScanned?: boolean;
    notes?: string;
  }>;
  receivedBy: string;
  signatureData?: string; // Base64 encoded signature
  photoProof?: string; // Base64 encoded photo
  notes?: string;
}

export interface TrackingUpdateRequest {
  eventType: TrackingEventType;
  location?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  description: string;
  metadata?: any;
}

// Response types
export interface DeliveryOrderResponse {
  deliveryOrder: DeliveryOrder;
  items: DeliveryOrderItem[];
  driver?: Driver;
  vehicle?: Vehicle;
  fromBranch: {
    id: string;
    name: string;
    address: string;
  };
  toBranch: {
    id: string;
    name: string;
    address: string;
  };
  tracking: DeliveryTracking[];
}

export interface DriverOrdersResponse {
  orders: Array<{
    deliveryOrder: DeliveryOrder;
    fromBranch: { name: string; address: string };
    toBranch: { name: string; address: string };
    itemCount: number;
    totalWeight: number;
  }>;
  driverInfo: Driver;
  vehicle?: Vehicle;
}

export interface BranchIncomingOrdersResponse {
  orders: Array<{
    deliveryOrder: DeliveryOrder;
    fromBranch: { name: string; address: string };
    driver?: { name: string; phone: string };
    vehicle?: { licensePlate: string };
    itemCount: number;
    estimatedArrival: Date;
  }>;
}

// Analytics types
export interface DeliveryAnalytics {
  totalDeliveries: number;
  onTimeDeliveries: number;
  averageDeliveryTime: number;
  successRate: number;
  topDrivers: Array<{
    driverId: string;
    driverName: string;
    deliveryCount: number;
    onTimeRate: number;
  }>;
  deliveryTrends: Array<{
    date: string;
    deliveryCount: number;
    averageTime: number;
    onTimeRate: number;
  }>;
}

export interface RouteOptimization {
  routeId: string;
  driverId: string;
  vehicleId: string;
  estimatedDistance: number;
  estimatedDuration: number;
  fuelCost: number;
  deliveryOrders: string[];
  stops: Array<{
    branchId: string;
    address: string;
    estimatedArrival: Date;
    deliveryOrderIds: string[];
  }>;
}