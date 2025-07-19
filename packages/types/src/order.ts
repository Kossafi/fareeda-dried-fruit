import { BaseEntity, Address, UnitType } from './common';

export interface Order extends BaseEntity {
  orderNumber: string;
  customerId?: string;
  branchId: string;
  type: OrderType;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  shippingAddress?: Address;
  billingAddress?: Address;
  specialInstructions?: string;
  loyaltyPointsEarned?: number;
  loyaltyPointsUsed?: number;
  salesPersonId?: string;
  approvedBy?: string;
  processedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  refundedAt?: Date;
}

export enum OrderType {
  WALK_IN = 'walk_in',
  ONLINE = 'online',
  PHONE = 'phone',
  DELIVERY = 'delivery',
  PICKUP = 'pickup'
}

export enum OrderStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export enum PaymentStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded'
}

export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  MOBILE_PAYMENT = 'mobile_payment',
  BANK_TRANSFER = 'bank_transfer',
  LOYALTY_POINTS = 'loyalty_points',
  GIFT_CARD = 'gift_card'
}

export interface OrderItem extends BaseEntity {
  orderId: string;
  productId: string;
  quantity: number;
  unit: UnitType;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  totalPrice: number;
  specialInstructions?: string;
}

export interface SalesTransaction extends BaseEntity {
  transactionNumber: string;
  orderId: string;
  branchId: string;
  cashierId: string;
  registerNumber?: string;
  items: SalesTransactionItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  changeAmount: number;
  currency: string;
  paymentMethods: TransactionPayment[];
  customerCount: number;
  receiptNumber?: string;
  voidedAt?: Date;
  voidedBy?: string;
  voidReason?: string;
}

export interface SalesTransactionItem {
  productId: string;
  quantity: number;
  unit: UnitType;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  totalPrice: number;
  promotionIds?: string[];
}

export interface TransactionPayment {
  method: PaymentMethod;
  amount: number;
  referenceNumber?: string;
  cardType?: string;
  last4Digits?: string;
  authorizationCode?: string;
}

export interface Return extends BaseEntity {
  returnNumber: string;
  originalOrderId: string;
  originalTransactionId?: string;
  customerId?: string;
  branchId: string;
  type: ReturnType;
  status: ReturnStatus;
  items: ReturnItem[];
  reason: ReturnReason;
  refundAmount: number;
  restockFee?: number;
  processedBy: string;
  approvedBy?: string;
  refundMethod?: PaymentMethod;
  notes?: string;
}

export enum ReturnType {
  EXCHANGE = 'exchange',
  REFUND = 'refund',
  STORE_CREDIT = 'store_credit'
}

export enum ReturnStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed'
}

export enum ReturnReason {
  DEFECTIVE = 'defective',
  WRONG_ITEM = 'wrong_item',
  CUSTOMER_CHANGED_MIND = 'customer_changed_mind',
  DAMAGED_IN_SHIPPING = 'damaged_in_shipping',
  EXPIRED = 'expired',
  OTHER = 'other'
}

export interface ReturnItem {
  productId: string;
  quantity: number;
  unit: UnitType;
  originalUnitPrice: number;
  refundUnitPrice: number;
  totalRefund: number;
  condition: 'new' | 'opened' | 'damaged';
  restockable: boolean;
}