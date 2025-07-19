"""
Inventory model and related tables
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


class MovementType(str, enum.Enum):
    """Inventory movement type enumeration"""
    SALE = "sale"
    PURCHASE = "purchase"
    ADJUSTMENT = "adjustment"
    TRANSFER = "transfer"
    RETURN = "return"
    DAMAGE = "damage"
    EXPIRED = "expired"
    SAMPLING = "sampling"
    REPACK_IN = "repack_in"
    REPACK_OUT = "repack_out"
    INITIAL_STOCK = "initial_stock"


class StockStatus(str, enum.Enum):
    """Stock status enumeration"""
    AVAILABLE = "available"
    RESERVED = "reserved"
    DAMAGED = "damaged"
    EXPIRED = "expired"
    QUARANTINE = "quarantine"


class InventoryStock(BaseModel, AuditMixin):
    """Current inventory stock levels"""
    
    __tablename__ = "inventory_stocks"
    
    # References
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Stock Quantities (in product's base unit)
    current_stock = Column(DECIMAL(12, 3), default=0, nullable=False)
    reserved_stock = Column(DECIMAL(12, 3), default=0, nullable=False)
    available_stock = Column(DECIMAL(12, 3), default=0, nullable=False)
    damaged_stock = Column(DECIMAL(12, 3), default=0, nullable=False)
    expired_stock = Column(DECIMAL(12, 3), default=0, nullable=False)
    
    # Stock Levels
    minimum_stock_level = Column(DECIMAL(10, 2), default=0, nullable=False)
    optimal_stock_level = Column(DECIMAL(10, 2), default=0, nullable=False)
    maximum_stock_level = Column(DECIMAL(10, 2), nullable=True)
    reorder_point = Column(DECIMAL(10, 2), nullable=True)
    
    # Last Movement
    last_movement_id = Column(UUID(as_uuid=True), nullable=True)
    last_movement_date = Column(DateTime(timezone=True), nullable=True)
    last_count_date = Column(DateTime(timezone=True), nullable=True)
    
    # Cost Information
    average_cost = Column(DECIMAL(10, 4), default=0, nullable=False)
    last_purchase_cost = Column(DECIMAL(10, 4), nullable=True)
    total_value = Column(DECIMAL(15, 2), default=0, nullable=False)
    
    # Location in Branch
    location = Column(String(100), nullable=True)  # Shelf, zone, etc.
    bin_location = Column(String(50), nullable=True)
    
    # Batch/Lot Information
    batch_lots = Column(JSONB, nullable=True)  # Array of batch info
    
    # Quality Information
    quality_status = Column(String(50), default="good", nullable=False)
    expiry_alerts = Column(JSONB, nullable=True)
    
    # Stock Alerts
    is_low_stock = Column(Boolean, default=False, nullable=False)
    is_out_of_stock = Column(Boolean, default=False, nullable=False)
    is_overstock = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    branch = relationship("Branch", back_populates="inventory_stocks")
    product = relationship("Product", back_populates="inventory_stocks")
    movements = relationship("InventoryMovement", back_populates="stock")
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.update_available_stock()
        self.update_stock_alerts()
    
    def update_available_stock(self):
        """Update available stock calculation"""
        self.available_stock = self.current_stock - self.reserved_stock
    
    def update_stock_alerts(self):
        """Update stock alert flags"""
        self.is_out_of_stock = self.current_stock <= 0
        self.is_low_stock = (
            not self.is_out_of_stock and 
            self.current_stock <= self.reorder_point
        ) if self.reorder_point else False
        self.is_overstock = (
            self.maximum_stock_level and 
            self.current_stock > self.maximum_stock_level
        )
    
    def can_reserve(self, quantity: Decimal) -> bool:
        """Check if quantity can be reserved"""
        return self.available_stock >= quantity
    
    def reserve_stock(self, quantity: Decimal) -> bool:
        """Reserve stock quantity"""
        if self.can_reserve(quantity):
            self.reserved_stock += quantity
            self.update_available_stock()
            return True
        return False
    
    def release_reservation(self, quantity: Decimal):
        """Release reserved stock"""
        self.reserved_stock = max(0, self.reserved_stock - quantity)
        self.update_available_stock()
    
    def adjust_stock(self, quantity: Decimal, update_cost: bool = True):
        """Adjust current stock and recalculate"""
        self.current_stock += quantity
        self.update_available_stock()
        self.update_stock_alerts()
        
        if update_cost and self.current_stock > 0:
            self.total_value = self.current_stock * self.average_cost
    
    @property
    def stock_turnover_needed(self) -> Decimal:
        """Calculate how much stock needed to reach optimal level"""
        if self.current_stock < self.optimal_stock_level:
            return self.optimal_stock_level - self.current_stock
        return Decimal('0')
    
    @property
    def days_of_stock(self) -> Optional[int]:
        """Calculate estimated days of stock remaining"""
        # This would need sales velocity data to calculate accurately
        # For now, return None - to be implemented with sales analytics
        return None
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "branch_id", "product_id", "is_low_stock", 
            "is_out_of_stock", "is_overstock", "quality_status"
        ]

# Add composite index for performance
Index(
    'idx_inventory_stock_branch_product', 
    InventoryStock.branch_id, 
    InventoryStock.product_id,
    unique=True
)


class InventoryMovement(BaseModel, AuditMixin):
    """Inventory movement history"""
    
    __tablename__ = "inventory_movements"
    
    # References
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    stock_id = Column(UUID(as_uuid=True), ForeignKey("inventory_stocks.id"), nullable=True)
    
    # Movement Details
    movement_type = Column(Enum(MovementType), nullable=False)
    quantity = Column(DECIMAL(12, 3), nullable=False)  # Positive = increase, Negative = decrease
    unit_cost = Column(DECIMAL(10, 4), nullable=True)
    total_cost = Column(DECIMAL(15, 2), nullable=True)
    
    # Balance After Movement
    balance_after = Column(DECIMAL(12, 3), nullable=False)
    
    # Reference Information
    reference_type = Column(String(50), nullable=True)  # sale, purchase_order, etc.
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    reference_number = Column(String(100), nullable=True)
    
    # Movement Date/Time
    movement_date = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    
    # Batch/Lot Information
    batch_number = Column(String(100), nullable=True)
    lot_number = Column(String(100), nullable=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    
    # Additional Information
    notes = Column(Text, nullable=True)
    reason = Column(String(200), nullable=True)
    
    # Approval Information
    requires_approval = Column(Boolean, default=False, nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approval_notes = Column(Text, nullable=True)
    
    # User who created the movement
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    branch = relationship("Branch")
    product = relationship("Product")
    stock = relationship("InventoryStock", back_populates="movements")
    created_by_user = relationship("User", foreign_keys=[created_by])
    approved_by_user = relationship("User", foreign_keys=[approved_by])
    
    @property
    def is_increase(self) -> bool:
        """Check if movement increases stock"""
        return self.quantity > 0
    
    @property
    def is_decrease(self) -> bool:
        """Check if movement decreases stock"""
        return self.quantity < 0
    
    @property
    def absolute_quantity(self) -> Decimal:
        """Get absolute quantity value"""
        return abs(self.quantity)
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "branch_id", "product_id", "movement_type", "reference_type",
            "created_by", "movement_date", "requires_approval"
        ]


class InventoryCount(BaseModel, AuditMixin):
    """Physical inventory count sessions"""
    
    __tablename__ = "inventory_counts"
    
    # Count Session Information
    count_number = Column(String(50), unique=True, nullable=False)
    count_name = Column(String(200), nullable=False)
    count_type = Column(String(50), default="full", nullable=False)  # full, cycle, spot
    
    # Scope
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"), nullable=True)
    location = Column(String(100), nullable=True)
    
    # Schedule
    scheduled_date = Column(DateTime(timezone=True), nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    
    # Status
    status = Column(String(50), default="planned", nullable=False)  # planned, active, completed, cancelled
    
    # Count Team
    count_supervisor = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    count_team = Column(JSONB, nullable=True)  # Array of user IDs
    
    # Results Summary
    total_items_planned = Column(Integer, default=0, nullable=False)
    total_items_counted = Column(Integer, default=0, nullable=False)
    total_variances = Column(Integer, default=0, nullable=False)
    total_adjustments = Column(DECIMAL(15, 2), default=0, nullable=False)
    
    # Notes
    instructions = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Relationships
    branch = relationship("Branch")
    category = relationship("ProductCategory")
    supervisor = relationship("User", foreign_keys=[count_supervisor])
    count_items = relationship("InventoryCountItem", back_populates="count_session")
    
    @property
    def completion_percentage(self) -> float:
        """Calculate completion percentage"""
        if self.total_items_planned > 0:
            return (self.total_items_counted / self.total_items_planned) * 100
        return 0.0
    
    @property
    def variance_percentage(self) -> float:
        """Calculate variance percentage"""
        if self.total_items_counted > 0:
            return (self.total_variances / self.total_items_counted) * 100
        return 0.0


class InventoryCountItem(BaseModel):
    """Individual items in inventory count"""
    
    __tablename__ = "inventory_count_items"
    
    # References
    count_session_id = Column(UUID(as_uuid=True), ForeignKey("inventory_counts.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Expected vs Actual
    expected_quantity = Column(DECIMAL(12, 3), nullable=False)
    counted_quantity = Column(DECIMAL(12, 3), nullable=True)
    variance_quantity = Column(DECIMAL(12, 3), default=0, nullable=False)
    variance_value = Column(DECIMAL(12, 2), default=0, nullable=False)
    
    # Count Details
    count_status = Column(String(50), default="pending", nullable=False)  # pending, counted, verified, adjusted
    counted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    counted_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    
    # Location and Batch
    location = Column(String(100), nullable=True)
    batch_number = Column(String(100), nullable=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    variance_reason = Column(String(200), nullable=True)
    
    # Adjustment
    adjustment_created = Column(Boolean, default=False, nullable=False)
    adjustment_movement_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Relationships
    count_session = relationship("InventoryCount", back_populates="count_items")
    product = relationship("Product")
    counted_by_user = relationship("User", foreign_keys=[counted_by])
    verified_by_user = relationship("User", foreign_keys=[verified_by])
    
    def calculate_variance(self):
        """Calculate variance after counting"""
        if self.counted_quantity is not None:
            self.variance_quantity = self.counted_quantity - self.expected_quantity
            # Variance value calculation would need unit cost
    
    @property
    def has_variance(self) -> bool:
        """Check if item has variance"""
        return abs(self.variance_quantity) > 0.001  # Small tolerance for decimal precision
    
    @property
    def variance_percentage(self) -> float:
        """Calculate variance percentage"""
        if self.expected_quantity > 0:
            return (self.variance_quantity / self.expected_quantity) * 100
        return 0.0


# Add indexes for performance
Index('idx_inventory_movement_branch_product', InventoryMovement.branch_id, InventoryMovement.product_id)
Index('idx_inventory_movement_date', InventoryMovement.movement_date)
Index('idx_inventory_movement_type', InventoryMovement.movement_type)
Index('idx_inventory_count_item_session', InventoryCountItem.count_session_id)