import { BaseEntity, Address, Status } from './common';

export interface Branch extends BaseEntity {
  branchCode: string;
  name: string;
  type: BranchType;
  status: Status;
  address: Address;
  contactInfo: BranchContactInfo;
  operatingHours: OperatingHours[];
  managerId?: string;
  staff: BranchStaff[];
  settings: BranchSettings;
  performance: BranchPerformance;
}

export enum BranchType {
  COMPANY_OWNED = 'company_owned',
  FRANCHISE = 'franchise',
  MALL_COUNTER = 'mall_counter',
  KIOSK = 'kiosk',
  WAREHOUSE = 'warehouse',
  DISTRIBUTION_CENTER = 'distribution_center'
}

export interface BranchContactInfo {
  phoneNumber: string;
  email?: string;
  faxNumber?: string;
  website?: string;
}

export interface OperatingHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
  breakTimes?: BreakTime[];
}

export interface BreakTime {
  startTime: string;
  endTime: string;
  description?: string;
}

export interface BranchStaff {
  userId: string;
  position: string;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  permissions: string[];
}

export interface BranchSettings {
  timezone: string;
  currency: string;
  language: string;
  taxRate: number;
  allowNegativeStock: boolean;
  requireManagerApproval: BranchApprovalSettings;
  posSettings: POSSettings;
  loyaltyPointsMultiplier: number;
}

export interface BranchApprovalSettings {
  discounts: boolean;
  returns: boolean;
  voids: boolean;
  stockAdjustments: boolean;
  priceOverrides: boolean;
}

export interface POSSettings {
  receiptTemplate: string;
  printReceipts: boolean;
  emailReceipts: boolean;
  smsReceipts: boolean;
  allowCashPayments: boolean;
  allowCardPayments: boolean;
  allowMobilePayments: boolean;
  roundingMethod: 'up' | 'down' | 'nearest';
}

export interface BranchPerformance {
  monthlyRevenue: number;
  dailyRevenue: number;
  targetRevenue: number;
  customerCount: number;
  averageTransactionValue: number;
  conversionRate: number;
  stockTurnover: number;
  lastUpdated: Date;
}

export interface Mall extends BaseEntity {
  name: string;
  address: Address;
  contactInfo: BranchContactInfo;
  operatingHours: OperatingHours[];
  managementCompany: string;
  reportingSystem?: MallReportingSystem;
  branches: string[];
}

export interface MallReportingSystem {
  systemName: string;
  apiEndpoint?: string;
  reportingSchedule: string;
  dataFormat: 'json' | 'xml' | 'csv' | 'excel';
  authentication: {
    type: 'api_key' | 'oauth' | 'basic_auth';
    credentials: Record<string, string>;
  };
}