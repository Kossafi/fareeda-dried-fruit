// Common Types and Enums

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

// Unit Types for Dried Fruit Business
export enum UnitType {
  WEIGHT = 'WEIGHT',
  VOLUME = 'VOLUME',
  COUNT = 'COUNT',
  PACKAGE = 'PACKAGE'
}

export interface Unit {
  code: string;
  name: string;
  nameEn: string;
  type: UnitType;
  baseUnit?: string;
  conversionFactor?: number;
}

// Thai units for dried fruit business
export const THAI_UNITS: Unit[] = [
  { code: 'g', name: 'กรัม', nameEn: 'gram', type: UnitType.WEIGHT },
  { code: 'kg', name: 'กิโลกรัม', nameEn: 'kilogram', type: UnitType.WEIGHT, baseUnit: 'g', conversionFactor: 1000 },
  { code: 'khit', name: 'ขีด', nameEn: 'khit', type: UnitType.WEIGHT, baseUnit: 'g', conversionFactor: 15 },
  { code: 'box', name: 'ลัง', nameEn: 'box', type: UnitType.PACKAGE },
  { code: 'pack', name: 'แพ็ค', nameEn: 'pack', type: UnitType.PACKAGE },
  { code: 'piece', name: 'ชิ้น', nameEn: 'piece', type: UnitType.COUNT }
];

export interface UnitConversion {
  fromUnit: string;
  toUnit: string;
  factor: number;
  productId?: string; // Product-specific conversion if needed
}

// Status Enums
export enum Status {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

// Audit Trail
export interface AuditTrail {
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
  version: number;
}

// File Upload
export interface FileUpload {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  uploadedBy: string;
  uploadedAt: Date;
}

// Notification
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  userId: string;
  isRead: boolean;
  data?: any;
  createdAt: Date;
}

export enum NotificationType {
  LOW_STOCK = 'LOW_STOCK',
  ORDER_UPDATE = 'ORDER_UPDATE',
  DELIVERY_STATUS = 'DELIVERY_STATUS',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  APPROVAL_REQUEST = 'APPROVAL_REQUEST'
}