"""
Sales model and related tables
"""
import enum
from decimal import Decimal
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Column, String, Text, Boolean, DECIMAL, Integer, 
    ForeignKey, DateTime, Enum, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, AuditMixin


class PaymentMethod(str, enum.Enum):
    """Payment method enumeration"""
    CASH = "cash"
    CARD = "card"
    MOBILE_PAYMENT = "mobile_payment"
    BANK_TRANSFER = "bank_transfer"
    QR_CODE = "qr_code"
    CREDIT = "credit"


class CustomerType(str, enum.Enum):
    """Customer type enumeration"""
    WALK_IN = "walk_in"
    REGULAR = "regular"
    MEMBER = "member"
    VIP = "vip"
    WHOLESALE = "wholesale"


class SaleStatus(str, enum.Enum):
    """Sale status enumeration"""
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class Sale(BaseModel, AuditMixin):
    """Main sales transaction model"""
    
    __tablename__ = "sales"
    
    # Sale Identification
    sale_number = Column(String(50), unique=True, nullable=False, index=True)
    receipt_number = Column(String(50), unique=True, nullable=True)
    
    # Branch and Staff
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    staff_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Customer Information
    customer_type = Column(Enum(CustomerType), default=CustomerType.WALK_IN, nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(200), nullable=True)
    customer_phone = Column(String(20), nullable=True)
    customer_email = Column(String(255), nullable=True)
    
    # Transaction Timing
    transaction_date = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Financial Summary
    subtotal = Column(DECIMAL(12, 2), default=0, nullable=False)
    discount_amount = Column(DECIMAL(10, 2), default=0, nullable=False)
    discount_percentage = Column(DECIMAL(5, 2), default=0, nullable=False)
    tax_amount = Column(DECIMAL(10, 2), default=0, nullable=False)
    tax_rate = Column(DECIMAL(5, 4), default=0.07, nullable=False)  # 7% VAT
    total_amount = Column(DECIMAL(12, 2), default=0, nullable=False)
    
    # Cost and Profit
    cost_of_goods = Column(DECIMAL(12, 2), default=0, nullable=False)
    gross_profit = Column(DECIMAL(12, 2), default=0, nullable=False)
    profit_margin = Column(DECIMAL(5, 2), default=0, nullable=False)
    
    # Payment Information
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    payment_reference = Column(String(100), nullable=True)
    amount_paid = Column(DECIMAL(12, 2), default=0, nullable=False)
    change_amount = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Status
    status = Column(Enum(SaleStatus), default=SaleStatus.PENDING, nullable=False)
    
    # Promotions and Discounts
    promotion_code = Column(String(50), nullable=True)
    loyalty_points_used = Column(Integer, default=0, nullable=False)
    loyalty_points_earned = Column(Integer, default=0, nullable=False)
    
    # Additional Information
    notes = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)
    pos_terminal = Column(String(50), nullable=True)
    
    # Gift and Special Services
    is_gift = Column(Boolean, default=False, nullable=False)
    gift_message = Column(Text, nullable=True)
    requires_delivery = Column(Boolean, default=False, nullable=False)
    delivery_address = Column(JSONB, nullable=True)
    
    # Returns and Refunds
    original_sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id"), nullable=True)
    return_reason = Column(Text, nullable=True)
    refund_amount = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Relationships
    branch = relationship("Branch", back_populates="sales")
    staff_member = relationship("User", back_populates="sales")
    customer = relationship("Customer", back_populates="sales")
    sale_items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    payments = relationship("SalePayment", back_populates="sale", cascade="all, delete-orphan")
    original_sale = relationship("Sale", remote_side="Sale.id")
    returns = relationship("Sale", back_populates="original_sale")
    
    def calculate_totals(self):
        """Calculate sale totals from items"""
        # Calculate subtotal from items
        self.subtotal = sum(item.line_total for item in self.sale_items)
        self.cost_of_goods = sum(item.cost_total for item in self.sale_items)
        
        # Apply discount
        if self.discount_percentage > 0:
            self.discount_amount = (self.subtotal * self.discount_percentage) / 100
        
        # Calculate tax
        taxable_amount = self.subtotal - self.discount_amount
        self.tax_amount = taxable_amount * self.tax_rate
        
        # Calculate total
        self.total_amount = taxable_amount + self.tax_amount
        
        # Calculate profit
        self.gross_profit = (self.subtotal - self.discount_amount) - self.cost_of_goods
        if self.subtotal > 0:
            self.profit_margin = (self.gross_profit / self.subtotal) * 100
    
    @property
    def item_count(self) -> int:
        """Get total number of items"""
        return len(self.sale_items)
    
    @property
    def total_quantity(self) -> Decimal:
        """Get total quantity of all items"""
        return sum(item.quantity for item in self.sale_items)
    
    @property
    def is_return(self) -> bool:
        """Check if this is a return transaction"""
        return self.original_sale_id is not None
    
    @property
    def can_be_returned(self) -> bool:
        """Check if sale can be returned"""
        return (
            self.status == SaleStatus.COMPLETED and
            self.total_amount > 0 and
            not self.is_return
        )
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return ["sale_number", "receipt_number", "customer_name", "customer_phone"]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "branch_id", "staff_id", "customer_type", "status",
            "payment_method", "transaction_date", "is_gift"
        ]


class SaleItem(BaseModel):
    """Individual items in a sale"""
    
    __tablename__ = "sale_items"
    
    # References
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Item Details
    product_name = Column(String(300), nullable=False)  # Snapshot at time of sale
    product_code = Column(String(50), nullable=False)
    sku = Column(String(100), nullable=False)
    
    # Quantity and Pricing
    quantity = Column(DECIMAL(12, 3), nullable=False)
    unit_price = Column(DECIMAL(10, 2), nullable=False)
    original_price = Column(DECIMAL(10, 2), nullable=True)  # Before any discounts
    
    # Discounts
    discount_percentage = Column(DECIMAL(5, 2), default=0, nullable=False)
    discount_amount = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Totals
    line_total = Column(DECIMAL(12, 2), nullable=False)
    cost_price = Column(DECIMAL(10, 4), nullable=False)
    cost_total = Column(DECIMAL(12, 2), nullable=False)
    profit_amount = Column(DECIMAL(10, 2), nullable=False)
    
    # Weight and Measurement
    unit_weight = Column(DECIMAL(10, 3), nullable=True)
    total_weight = Column(DECIMAL(12, 3), nullable=True)
    
    # Sampling Reference
    was_sampled = Column(Boolean, default=False, nullable=False)
    sampling_session_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Special Instructions
    notes = Column(Text, nullable=True)
    special_price_reason = Column(String(200), nullable=True)
    
    # Return Information
    returned_quantity = Column(DECIMAL(12, 3), default=0, nullable=False)
    return_reason = Column(Text, nullable=True)
    
    # Relationships
    sale = relationship("Sale", back_populates="sale_items")
    product = relationship("Product", back_populates="sales_items")
    
    def calculate_line_total(self):
        """Calculate line total"""
        base_total = self.quantity * self.unit_price
        self.line_total = base_total - self.discount_amount
        self.cost_total = self.quantity * self.cost_price
        self.profit_amount = self.line_total - self.cost_total
    
    @property
    def returnable_quantity(self) -> Decimal:
        """Get quantity that can still be returned"""
        return self.quantity - self.returned_quantity
    
    @property
    def profit_margin(self) -> Decimal:
        """Calculate profit margin for this item"""
        if self.line_total > 0:
            return (self.profit_amount / self.line_total) * 100
        return Decimal('0')


class SalePayment(BaseModel):
    """Payment details for sales (supports split payments)"""
    
    __tablename__ = "sale_payments"
    
    # References
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id"), nullable=False)
    
    # Payment Details
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    amount = Column(DECIMAL(10, 2), nullable=False)
    currency = Column(String(3), default="THB", nullable=False)
    
    # Payment Processing
    payment_reference = Column(String(100), nullable=True)
    transaction_id = Column(String(100), nullable=True)
    authorization_code = Column(String(50), nullable=True)
    
    # Card/Digital Payment Details
    card_type = Column(String(50), nullable=True)  # visa, mastercard, etc.
    card_last_four = Column(String(4), nullable=True)
    card_brand = Column(String(50), nullable=True)
    
    # Mobile/QR Payment Details
    mobile_provider = Column(String(50), nullable=True)  # truemoney, promptpay, etc.
    qr_code_type = Column(String(50), nullable=True)
    
    # Status
    status = Column(String(50), default="completed", nullable=False)
    processed_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    
    # Receipt Information
    receipt_number = Column(String(50), nullable=True)
    receipt_url = Column(String(500), nullable=True)
    
    # Relationships
    sale = relationship("Sale", back_populates="payments")


class Customer(BaseModel, AuditMixin):
    """Customer information"""
    
    __tablename__ = "customers"
    
    # Basic Information
    customer_number = Column(String(50), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    
    # Demographics
    date_of_birth = Column(DateTime(timezone=True), nullable=True)
    gender = Column(String(10), nullable=True)
    occupation = Column(String(100), nullable=True)
    
    # Address Information
    address = Column(JSONB, nullable=True)
    delivery_addresses = Column(JSONB, nullable=True)  # Array of addresses
    
    # Customer Type and Status
    customer_type = Column(Enum(CustomerType), default=CustomerType.REGULAR, nullable=False)
    status = Column(String(50), default="active", nullable=False)
    
    # Loyalty and Membership
    membership_number = Column(String(50), unique=True, nullable=True)
    membership_level = Column(String(50), nullable=True)  # bronze, silver, gold, platinum
    loyalty_points = Column(Integer, default=0, nullable=False)
    membership_start_date = Column(DateTime(timezone=True), nullable=True)
    membership_expiry_date = Column(DateTime(timezone=True), nullable=True)
    
    # Purchase History Summary
    total_purchases = Column(Integer, default=0, nullable=False)
    total_spent = Column(DECIMAL(15, 2), default=0, nullable=False)
    last_purchase_date = Column(DateTime(timezone=True), nullable=True)
    average_order_value = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Preferences
    preferred_products = Column(JSONB, nullable=True)  # Array of product IDs
    communication_preferences = Column(JSONB, nullable=True)
    dietary_preferences = Column(JSONB, nullable=True)
    
    # Marketing
    marketing_consent = Column(Boolean, default=False, nullable=False)
    marketing_source = Column(String(100), nullable=True)
    referral_code = Column(String(20), unique=True, nullable=True)
    referred_by = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    special_requirements = Column(Text, nullable=True)
    
    # Relationships
    sales = relationship("Sale", back_populates="customer")
    referrer = relationship("Customer", remote_side="Customer.id")
    referrals = relationship("Customer", back_populates="referrer")
    
    @property
    def full_name(self) -> str:
        """Get customer's full name"""
        return f"{self.first_name} {self.last_name}"
    
    @property
    def is_member(self) -> bool:
        """Check if customer is a member"""
        return self.membership_number is not None
    
    @property
    def days_since_last_purchase(self) -> Optional[int]:
        """Get days since last purchase"""
        if self.last_purchase_date:
            return (datetime.utcnow() - self.last_purchase_date).days
        return None
    
    def calculate_summary_stats(self):
        """Calculate purchase summary statistics"""
        if self.total_purchases > 0:
            self.average_order_value = self.total_spent / self.total_purchases
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return [
            "customer_number", "first_name", "last_name", 
            "phone", "email", "membership_number"
        ]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "customer_type", "status", "membership_level", 
            "gender", "is_active", "created_at"
        ]


# Add indexes for performance
Index('idx_sale_transaction_date', Sale.transaction_date)
Index('idx_sale_branch_date', Sale.branch_id, Sale.transaction_date)
Index('idx_sale_staff_date', Sale.staff_id, Sale.transaction_date)
Index('idx_sale_customer', Sale.customer_id)
Index('idx_sale_item_product', SaleItem.product_id)
Index('idx_customer_phone', Customer.phone)
Index('idx_customer_email', Customer.email)