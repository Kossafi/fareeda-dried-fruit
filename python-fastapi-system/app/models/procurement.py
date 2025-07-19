"""
Procurement and supplier management models
"""
import enum
from decimal import Decimal
from datetime import datetime, date
from typing import List, Optional

from sqlalchemy import (
    Column, String, Text, Boolean, DECIMAL, Integer, 
    ForeignKey, DateTime, Date, Enum, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, AuditMixin


class SupplierStatus(str, enum.Enum):
    """Supplier status enumeration"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING_APPROVAL = "pending_approval"
    SUSPENDED = "suspended"
    BLACKLISTED = "blacklisted"


class SupplierType(str, enum.Enum):
    """Supplier type enumeration"""
    MANUFACTURER = "manufacturer"
    DISTRIBUTOR = "distributor"
    WHOLESALER = "wholesaler"
    FARMER = "farmer"
    COOPERATIVE = "cooperative"
    PROCESSOR = "processor"
    IMPORTER = "importer"


class PurchaseOrderStatus(str, enum.Enum):
    """Purchase order status enumeration"""
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SENT = "sent"
    CONFIRMED = "confirmed"
    PARTIALLY_RECEIVED = "partially_received"
    RECEIVED = "received"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    DISPUTED = "disputed"


class PaymentTerms(str, enum.Enum):
    """Payment terms enumeration"""
    CASH_ON_DELIVERY = "cash_on_delivery"
    NET_7 = "net_7"
    NET_15 = "net_15"
    NET_30 = "net_30"
    NET_60 = "net_60"
    NET_90 = "net_90"
    ADVANCE_PAYMENT = "advance_payment"
    LETTER_OF_CREDIT = "letter_of_credit"


class Supplier(BaseModel, AuditMixin):
    """Supplier information model"""
    
    __tablename__ = "suppliers"
    
    # Basic Information
    supplier_name = Column(String(300), nullable=False)
    supplier_code = Column(String(50), unique=True, nullable=False, index=True)
    supplier_type = Column(Enum(SupplierType), nullable=False)
    status = Column(Enum(SupplierStatus), default=SupplierStatus.ACTIVE, nullable=False)
    
    # Contact Information
    contact_person = Column(String(200), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    mobile = Column(String(20), nullable=True)
    fax = Column(String(20), nullable=True)
    website = Column(String(255), nullable=True)
    
    # Address Information
    address_line_1 = Column(String(300), nullable=False)
    address_line_2 = Column(String(300), nullable=True)
    district = Column(String(100), nullable=True)
    province = Column(String(100), nullable=False)
    postal_code = Column(String(10), nullable=True)
    country = Column(String(100), default="Thailand", nullable=False)
    
    # Business Information
    tax_id = Column(String(50), nullable=True)
    business_registration = Column(String(100), nullable=True)
    vat_registration = Column(String(100), nullable=True)
    
    # Financial Information
    payment_terms = Column(Enum(PaymentTerms), default=PaymentTerms.NET_30, nullable=False)
    credit_limit = Column(DECIMAL(15, 2), nullable=True)
    currency = Column(String(3), default="THB", nullable=False)
    
    # Banking Information
    bank_name = Column(String(200), nullable=True)
    bank_account_number = Column(String(50), nullable=True)
    bank_account_name = Column(String(200), nullable=True)
    swift_code = Column(String(11), nullable=True)
    
    # Quality and Certifications
    quality_rating = Column(DECIMAL(3, 2), nullable=True)  # 1.00-5.00
    certifications = Column(JSONB, nullable=True)  # Array of certifications
    quality_standards = Column(JSONB, nullable=True)
    
    # Performance Metrics
    lead_time_days = Column(Integer, default=7, nullable=False)
    minimum_order_amount = Column(DECIMAL(12, 2), nullable=True)
    delivery_reliability = Column(DECIMAL(5, 2), nullable=True)  # Percentage
    price_competitiveness = Column(DECIMAL(3, 2), nullable=True)  # 1.00-5.00
    
    # Product Categories
    product_categories = Column(JSONB, nullable=True)  # Array of category IDs
    specialty_products = Column(JSONB, nullable=True)  # Array of product types
    
    # Preferred Status
    is_preferred = Column(Boolean, default=False, nullable=False)
    preferred_for_categories = Column(JSONB, nullable=True)
    
    # Contract Information
    contract_start_date = Column(Date, nullable=True)
    contract_end_date = Column(Date, nullable=True)
    contract_terms = Column(Text, nullable=True)
    
    # Performance History
    total_orders = Column(Integer, default=0, nullable=False)
    total_order_value = Column(DECIMAL(15, 2), default=0, nullable=False)
    last_order_date = Column(Date, nullable=True)
    average_order_value = Column(DECIMAL(12, 2), default=0, nullable=False)
    
    # Risk Assessment
    risk_level = Column(String(20), default="low", nullable=False)  # low, medium, high
    risk_factors = Column(JSONB, nullable=True)
    insurance_coverage = Column(DECIMAL(12, 2), nullable=True)
    
    # Communication Preferences
    preferred_communication = Column(String(20), default="email", nullable=False)
    communication_language = Column(String(10), default="th", nullable=False)
    
    # Notes and Documents
    notes = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)
    documents = Column(JSONB, nullable=True)  # Array of document references
    
    # Relationships
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")
    supplier_contacts = relationship("SupplierContact", back_populates="supplier")
    supplier_products = relationship("SupplierProduct", back_populates="supplier")
    
    @property
    def is_active_supplier(self) -> bool:
        """Check if supplier is active"""
        return self.status == SupplierStatus.ACTIVE and self.is_active
    
    @property
    def contract_is_active(self) -> bool:
        """Check if contract is currently active"""
        if not self.contract_start_date:
            return False
        today = date.today()
        if today < self.contract_start_date:
            return False
        if self.contract_end_date and today > self.contract_end_date:
            return False
        return True
    
    @property
    def days_until_contract_expiry(self) -> Optional[int]:
        """Get days until contract expires"""
        if self.contract_end_date:
            return (self.contract_end_date - date.today()).days
        return None
    
    def calculate_performance_score(self) -> float:
        """Calculate overall supplier performance score"""
        scores = []
        if self.quality_rating:
            scores.append(float(self.quality_rating))
        if self.delivery_reliability:
            scores.append(float(self.delivery_reliability) / 20)  # Convert % to 5-point scale
        if self.price_competitiveness:
            scores.append(float(self.price_competitiveness))
        
        return sum(scores) / len(scores) if scores else 0.0
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return [
            "supplier_name", "supplier_code", "contact_person",
            "email", "phone", "tax_id"
        ]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "supplier_type", "status", "payment_terms", "is_preferred",
            "province", "country", "risk_level", "is_active"
        ]


class SupplierContact(BaseModel, AuditMixin):
    """Additional contacts for suppliers"""
    
    __tablename__ = "supplier_contacts"
    
    # References
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    
    # Contact Information
    contact_name = Column(String(200), nullable=False)
    position = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    
    # Contact Details
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    mobile = Column(String(20), nullable=True)
    extension = Column(String(10), nullable=True)
    
    # Contact Type
    contact_type = Column(String(50), nullable=False)  # primary, sales, support, finance
    is_primary = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    supplier = relationship("Supplier", back_populates="supplier_contacts")


class SupplierProduct(BaseModel, AuditMixin):
    """Products offered by suppliers with pricing"""
    
    __tablename__ = "supplier_products"
    
    # References
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Supplier-specific Product Information
    supplier_product_code = Column(String(100), nullable=True)
    supplier_product_name = Column(String(300), nullable=True)
    
    # Pricing Information
    unit_price = Column(DECIMAL(12, 4), nullable=False)
    currency = Column(String(3), default="THB", nullable=False)
    minimum_order_quantity = Column(DECIMAL(12, 3), nullable=True)
    
    # Pricing Tiers
    pricing_tiers = Column(JSONB, nullable=True)  # Array of quantity-price tiers
    
    # Availability
    is_available = Column(Boolean, default=True, nullable=False)
    lead_time_days = Column(Integer, default=7, nullable=False)
    stock_quantity = Column(DECIMAL(12, 3), nullable=True)
    
    # Quality Information
    quality_grade = Column(String(10), nullable=True)
    origin = Column(String(100), nullable=True)
    harvest_season = Column(String(100), nullable=True)
    
    # Packaging Information
    packaging_type = Column(String(100), nullable=True)
    packaging_size = Column(String(100), nullable=True)
    units_per_package = Column(Integer, nullable=True)
    
    # Last Updated
    price_updated_at = Column(DateTime(timezone=True), nullable=True)
    availability_updated_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    supplier = relationship("Supplier", back_populates="supplier_products")
    product = relationship("Product")
    
    @property
    def is_price_current(self) -> bool:
        """Check if price is current (within 30 days)"""
        if not self.price_updated_at:
            return False
        days_old = (datetime.utcnow() - self.price_updated_at).days
        return days_old <= 30
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "supplier_id", "product_id", "is_available", "quality_grade",
            "origin", "currency"
        ]


class PurchaseOrder(BaseModel, AuditMixin):
    """Purchase order model"""
    
    __tablename__ = "purchase_orders"
    
    # Order Information
    po_number = Column(String(50), unique=True, nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    
    # Status and Approval
    status = Column(Enum(PurchaseOrderStatus), default=PurchaseOrderStatus.DRAFT, nullable=False)
    approval_status = Column(String(50), default="pending", nullable=False)
    
    # Dates
    order_date = Column(Date, default=date.today, nullable=False)
    required_date = Column(Date, nullable=False)
    expected_delivery_date = Column(Date, nullable=True)
    actual_delivery_date = Column(Date, nullable=True)
    
    # Financial Information
    subtotal = Column(DECIMAL(15, 2), default=0, nullable=False)
    tax_rate = Column(DECIMAL(5, 4), default=0.07, nullable=False)
    tax_amount = Column(DECIMAL(12, 2), default=0, nullable=False)
    shipping_cost = Column(DECIMAL(10, 2), default=0, nullable=False)
    discount_amount = Column(DECIMAL(10, 2), default=0, nullable=False)
    total_amount = Column(DECIMAL(15, 2), default=0, nullable=False)
    currency = Column(String(3), default="THB", nullable=False)
    
    # Payment Information
    payment_terms = Column(Enum(PaymentTerms), nullable=False)
    payment_due_date = Column(Date, nullable=True)
    payment_status = Column(String(50), default="pending", nullable=False)
    
    # Delivery Information
    delivery_address = Column(JSONB, nullable=True)
    delivery_instructions = Column(Text, nullable=True)
    incoterms = Column(String(20), nullable=True)  # EXW, FOB, CIF, etc.
    
    # References
    reference_number = Column(String(100), nullable=True)
    quotation_reference = Column(String(100), nullable=True)
    
    # Created By
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Approval Chain
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Quality Requirements
    quality_requirements = Column(Text, nullable=True)
    inspection_required = Column(Boolean, default=True, nullable=False)
    
    # Special Instructions
    special_instructions = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)
    
    # Tracking
    tracking_number = Column(String(100), nullable=True)
    carrier = Column(String(100), nullable=True)
    
    # Relationships
    supplier = relationship("Supplier", back_populates="purchase_orders")
    branch = relationship("Branch")
    created_by_user = relationship("User", foreign_keys=[created_by])
    approved_by_user = relationship("User", foreign_keys=[approved_by])
    order_items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")
    approvals = relationship("PurchaseOrderApproval", back_populates="purchase_order", cascade="all, delete-orphan")
    receipts = relationship("GoodsReceipt", back_populates="purchase_order")
    
    def calculate_totals(self):
        """Calculate order totals from items"""
        self.subtotal = sum(item.line_total for item in self.order_items)
        self.tax_amount = self.subtotal * self.tax_rate
        self.total_amount = self.subtotal + self.tax_amount + self.shipping_cost - self.discount_amount
    
    @property
    def is_overdue(self) -> bool:
        """Check if order is overdue for delivery"""
        if self.expected_delivery_date and not self.actual_delivery_date:
            return date.today() > self.expected_delivery_date
        return False
    
    @property
    def days_until_delivery(self) -> Optional[int]:
        """Get days until expected delivery"""
        if self.expected_delivery_date:
            return (self.expected_delivery_date - date.today()).days
        return None
    
    @property
    def total_items(self) -> int:
        """Get total number of items in order"""
        return len(self.order_items)
    
    @property
    def total_quantity(self) -> Decimal:
        """Get total quantity of all items"""
        return sum(item.quantity for item in self.order_items)
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return [
            "po_number", "reference_number", "quotation_reference",
            "tracking_number"
        ]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "supplier_id", "branch_id", "status", "approval_status",
            "created_by", "approved_by", "order_date", "required_date"
        ]


class PurchaseOrderItem(BaseModel):
    """Individual items in purchase order"""
    
    __tablename__ = "purchase_order_items"
    
    # References
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_orders.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Item Details
    product_name = Column(String(300), nullable=False)  # Snapshot
    product_code = Column(String(50), nullable=False)
    supplier_product_code = Column(String(100), nullable=True)
    
    # Quantity and Pricing
    quantity = Column(DECIMAL(12, 3), nullable=False)
    unit_price = Column(DECIMAL(12, 4), nullable=False)
    line_total = Column(DECIMAL(15, 2), nullable=False)
    
    # Delivery Information
    requested_delivery_date = Column(Date, nullable=True)
    received_quantity = Column(DECIMAL(12, 3), default=0, nullable=False)
    pending_quantity = Column(DECIMAL(12, 3), nullable=False)
    
    # Quality Specifications
    quality_grade = Column(String(10), nullable=True)
    specifications = Column(JSONB, nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="order_items")
    product = relationship("Product")
    
    def calculate_line_total(self):
        """Calculate line total"""
        self.line_total = self.quantity * self.unit_price
        self.pending_quantity = self.quantity - self.received_quantity
    
    @property
    def is_fully_received(self) -> bool:
        """Check if item is fully received"""
        return self.received_quantity >= self.quantity
    
    @property
    def receipt_percentage(self) -> float:
        """Calculate receipt percentage"""
        if self.quantity > 0:
            return float(self.received_quantity / self.quantity * 100)
        return 0.0


class PurchaseOrderApproval(BaseModel, AuditMixin):
    """Purchase order approval workflow"""
    
    __tablename__ = "purchase_order_approvals"
    
    # References
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_orders.id"), nullable=False)
    approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Approval Details
    approval_level = Column(Integer, nullable=False)
    approval_order = Column(Integer, nullable=False)
    
    # Status
    status = Column(String(50), default="pending", nullable=False)  # pending, approved, rejected
    
    # Decision
    decision = Column(String(20), nullable=True)  # approved, rejected, delegated
    decision_date = Column(DateTime(timezone=True), nullable=True)
    comments = Column(Text, nullable=True)
    
    # Conditions
    conditions = Column(Text, nullable=True)
    amount_limit = Column(DECIMAL(15, 2), nullable=True)
    
    # Delegation
    delegated_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    delegation_reason = Column(Text, nullable=True)
    
    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="approvals")
    approver = relationship("User", foreign_keys=[approver_id])
    delegated_to_user = relationship("User", foreign_keys=[delegated_to])
    
    @property
    def is_pending(self) -> bool:
        """Check if approval is pending"""
        return self.status == "pending"
    
    @property
    def response_time_hours(self) -> Optional[float]:
        """Get response time in hours"""
        if self.decision_date:
            duration = self.decision_date - self.created_at
            return duration.total_seconds() / 3600
        return None


class GoodsReceipt(BaseModel, AuditMixin):
    """Goods receipt for purchase orders"""
    
    __tablename__ = "goods_receipts"
    
    # Receipt Information
    receipt_number = Column(String(50), unique=True, nullable=False, index=True)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_orders.id"), nullable=False)
    
    # Receipt Details
    received_date = Column(Date, default=date.today, nullable=False)
    received_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Delivery Information
    delivery_note_number = Column(String(100), nullable=True)
    carrier = Column(String(100), nullable=True)
    tracking_number = Column(String(100), nullable=True)
    vehicle_details = Column(String(200), nullable=True)
    
    # Quality Check
    quality_check_status = Column(String(50), default="pending", nullable=False)  # pending, passed, failed
    quality_checked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    quality_check_date = Column(DateTime(timezone=True), nullable=True)
    quality_notes = Column(Text, nullable=True)
    
    # Condition on Arrival
    condition_on_arrival = Column(String(50), default="good", nullable=False)
    damage_report = Column(Text, nullable=True)
    temperature_compliant = Column(Boolean, nullable=True)
    packaging_condition = Column(String(50), nullable=True)
    
    # Receipt Summary
    total_items_received = Column(Integer, default=0, nullable=False)
    total_quantity_received = Column(DECIMAL(15, 3), default=0, nullable=False)
    total_value_received = Column(DECIMAL(15, 2), default=0, nullable=False)
    
    # Discrepancies
    has_discrepancies = Column(Boolean, default=False, nullable=False)
    discrepancy_notes = Column(Text, nullable=True)
    
    # Storage Information
    storage_location = Column(String(100), nullable=True)
    storage_temperature = Column(String(50), nullable=True)
    storage_humidity = Column(String(50), nullable=True)
    
    # Documents
    receipt_photos = Column(JSONB, nullable=True)  # Array of photo URLs
    supporting_documents = Column(JSONB, nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="receipts")
    received_by_user = relationship("User", foreign_keys=[received_by])
    quality_checked_by_user = relationship("User", foreign_keys=[quality_checked_by])
    receipt_items = relationship("GoodsReceiptItem", back_populates="receipt", cascade="all, delete-orphan")
    
    def calculate_totals(self):
        """Calculate receipt totals"""
        self.total_items_received = len(self.receipt_items)
        self.total_quantity_received = sum(item.received_quantity for item in self.receipt_items)
        self.total_value_received = sum(item.line_value for item in self.receipt_items)
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return [
            "receipt_number", "delivery_note_number", "tracking_number"
        ]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "purchase_order_id", "received_by", "quality_check_status",
            "condition_on_arrival", "has_discrepancies", "received_date"
        ]


class GoodsReceiptItem(BaseModel):
    """Individual items in goods receipt"""
    
    __tablename__ = "goods_receipt_items"
    
    # References
    receipt_id = Column(UUID(as_uuid=True), ForeignKey("goods_receipts.id"), nullable=False)
    purchase_order_item_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order_items.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Received Quantities
    ordered_quantity = Column(DECIMAL(12, 3), nullable=False)
    received_quantity = Column(DECIMAL(12, 3), nullable=False)
    accepted_quantity = Column(DECIMAL(12, 3), nullable=False)
    rejected_quantity = Column(DECIMAL(12, 3), default=0, nullable=False)
    
    # Quality Information
    quality_grade = Column(String(10), nullable=True)
    batch_number = Column(String(100), nullable=True)
    expiry_date = Column(Date, nullable=True)
    
    # Condition
    condition = Column(String(50), default="good", nullable=False)
    rejection_reason = Column(Text, nullable=True)
    
    # Value
    unit_price = Column(DECIMAL(12, 4), nullable=False)
    line_value = Column(DECIMAL(15, 2), nullable=False)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Relationships
    receipt = relationship("GoodsReceipt", back_populates="receipt_items")
    purchase_order_item = relationship("PurchaseOrderItem")
    product = relationship("Product")
    
    def calculate_line_value(self):
        """Calculate line value"""
        self.line_value = self.accepted_quantity * self.unit_price
    
    @property
    def variance_quantity(self) -> Decimal:
        """Calculate quantity variance"""
        return self.received_quantity - self.ordered_quantity
    
    @property
    def acceptance_rate(self) -> float:
        """Calculate acceptance rate"""
        if self.received_quantity > 0:
            return float(self.accepted_quantity / self.received_quantity * 100)
        return 0.0


# Add indexes for performance
Index('idx_supplier_code', Supplier.supplier_code, unique=True)
Index('idx_supplier_status', Supplier.status)
Index('idx_supplier_type', Supplier.supplier_type)
Index('idx_supplier_product_supplier', SupplierProduct.supplier_id)
Index('idx_supplier_product_product', SupplierProduct.product_id)
Index('idx_purchase_order_supplier', PurchaseOrder.supplier_id)
Index('idx_purchase_order_status', PurchaseOrder.status)
Index('idx_purchase_order_date', PurchaseOrder.order_date)
Index('idx_purchase_order_approval_po', PurchaseOrderApproval.purchase_order_id)
Index('idx_goods_receipt_po', GoodsReceipt.purchase_order_id)
Index('idx_goods_receipt_date', GoodsReceipt.received_date)