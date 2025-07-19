import { BaseEntity } from './common';

// Alert Types
export enum AlertType {
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  APPROACHING_EXPIRY = 'approaching_expiry',
  OVERSTOCKED = 'overstocked',
  MANUAL_ALERT = 'manual_alert'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed'
}

// Notification Types
export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app',
  WEBHOOK = 'webhook'
}

export enum DigestFrequency {
  IMMEDIATE = 'immediate',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly'
}

export enum DeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Alert Models
export interface AlertThreshold extends BaseEntity {
  branchId: string;
  productId: string;
  categoryId?: string;
  minimumStockLevel: number;
  reorderPoint: number;
  maximumStockLevel?: number;
  unit: string;
  useAutoCalculation: boolean;
  autoCalculationDays: number;
  safetyStockMultiplier: number;
  isActive: boolean;
  createdBy: string;
}

export interface StockAlert extends BaseEntity {
  alertNumber: string;
  alertType: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  branchId: string;
  productId: string;
  inventoryItemId?: string;
  currentStockLevel: number;
  thresholdLevel: number;
  suggestedReorderQuantity?: number;
  unit: string;
  title: string;
  message: string;
  additionalData?: any;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  expiresAt?: Date;
}

export interface AlertSubscription extends BaseEntity {
  userId: string;
  alertTypes: AlertType[];
  severityLevels: AlertSeverity[];
  branchIds?: string[];
  categoryIds?: string[];
  emailEnabled: boolean;
  inAppEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  immediateDelivery: boolean;
  digestFrequency: DigestFrequency;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone: string;
  isActive: boolean;
}

export interface NotificationDelivery extends BaseEntity {
  stockAlertId: string;
  userId: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  subject?: string;
  message: string;
  recipientAddress?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  provider?: string;
  providerMessageId?: string;
  deliveryMetadata?: any;
}

export interface AlertHistory extends BaseEntity {
  stockAlertId: string;
  action: string;
  performedBy?: string;
  performedAt: Date;
  previousStatus?: string;
  newStatus?: string;
  notes?: string;
  systemGenerated: boolean;
}

export interface NotificationTemplate extends BaseEntity {
  templateName: string;
  alertType: AlertType;
  channel: NotificationChannel;
  subjectTemplate?: string;
  messageTemplate: string;
  htmlTemplate?: string;
  availableVariables?: any;
  isActive: boolean;
  isDefault: boolean;
  language: string;
}

// Request/Response Types
export interface CreateAlertThresholdRequest {
  branchId: string;
  productId: string;
  categoryId?: string;
  minimumStockLevel: number;
  reorderPoint: number;
  maximumStockLevel?: number;
  unit: string;
  useAutoCalculation?: boolean;
  autoCalculationDays?: number;
  safetyStockMultiplier?: number;
}

export interface UpdateAlertSubscriptionRequest {
  alertTypes?: AlertType[];
  severityLevels?: AlertSeverity[];
  branchIds?: string[];
  categoryIds?: string[];
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  immediateDelivery?: boolean;
  digestFrequency?: DigestFrequency;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}

export interface CreateStockAlertRequest {
  alertType: AlertType;
  severity: AlertSeverity;
  branchId: string;
  productId: string;
  inventoryItemId?: string;
  currentStockLevel: number;
  thresholdLevel: number;
  unit: string;
  title: string;
  message: string;
  additionalData?: any;
}

export interface TestNotificationRequest {
  channel: NotificationChannel;
  recipient: string;
}

// Response Types
export interface AlertsResponse {
  alerts: StockAlert[];
  total: number;
  meta: {
    limit: number;
    offset: number;
    filters?: any;
  };
}

export interface AlertAnalyticsResponse {
  totalAlerts: number;
  activeAlerts: number;
  criticalAlerts: number;
  alertsByType: Array<{ alertType: string; count: number }>;
  alertsBySeverity: Array<{ severity: string; count: number }>;
  topAlertedProducts: Array<{
    productName: string;
    productSku: string;
    alertCount: number;
  }>;
  resolutionTime: {
    average: number;
    median: number;
  };
}

export interface MonitoringReportResponse {
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
}

export interface NotificationStatsResponse {
  totalNotifications: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  deliveryRate: number;
  channelStats: Array<{
    channel: string;
    sent: number;
    delivered: number;
    failed: number;
  }>;
  alertTypeStats: Array<{
    alertType: string;
    count: number;
  }>;
}

// Event Types
export interface StockAlertEvent {
  eventType: 'alert_created' | 'alert_acknowledged' | 'alert_resolved' | 'alert_dismissed' | 'alert_escalated';
  alert: Partial<StockAlert>;
  timestamp: string;
  userId?: string;
}

export interface NotificationEvent {
  eventType: 'notification_sent' | 'notification_delivered' | 'notification_failed';
  delivery: Partial<NotificationDelivery>;
  timestamp: string;
}

// Service Configuration Types
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export interface SMSConfig {
  provider: string;
  apiKey: string;
  apiUrl: string;
  sender: string;
  testPhone?: string;
}

export interface PushConfig {
  serviceAccountKey: any;
  projectId: string;
}

export interface AlertsConfig {
  email: EmailConfig;
  sms: SMSConfig;
  push: PushConfig;
  monitoring: {
    checkInterval: number;
    retryInterval: number;
    escalationRules: {
      critical: number; // hours
      high: number;
      medium: number;
    };
  };
}

export default {
  AlertType,
  AlertSeverity,
  AlertStatus,
  NotificationChannel,
  DigestFrequency,
  DeliveryStatus
};