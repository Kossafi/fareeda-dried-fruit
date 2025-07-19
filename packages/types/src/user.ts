import { BaseEntity, Address } from './common';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  BRANCH_MANAGER = 'branch_manager',
  STAFF = 'staff',
  CUSTOMER = 'customer'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

export interface User extends BaseEntity {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  status: UserStatus;
  profileImage?: string;
  lastLoginAt?: Date;
  emailVerifiedAt?: Date;
  phoneVerifiedAt?: Date;
  branchIds: string[];
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface Customer extends BaseEntity {
  userId: string;
  customerCode: string;
  membershipTier: MembershipTier;
  totalPurchases: number;
  loyaltyPoints: number;
  addresses: CustomerAddress[];
  preferences: CustomerPreferences;
}

export interface CustomerAddress extends Address {
  id: string;
  customerId: string;
  label: string;
  isDefault: boolean;
}

export interface CustomerPreferences {
  favoriteProducts: string[];
  dietaryRestrictions: string[];
  communicationChannels: ('email' | 'sms' | 'push')[];
  marketingOptIn: boolean;
}

export enum MembershipTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum'
}