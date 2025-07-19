"""
Repack system models for combining products into new SKUs
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


class RepackStatus(str, enum.Enum):
    """Repack status enumeration"""
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


class RepackType(str, enum.Enum):
    """Repack type enumeration"""
    GIFT_SET = "gift_set"
    VARIETY_PACK = "variety_pack"
    BULK_REPACK = "bulk_repack"
    CUSTOM_MIX = "custom_mix"
    PROMOTIONAL = "promotional"
    SEASONAL = "seasonal"


class Repack(BaseModel, AuditMixin):
    """Main repack model for combining products into new SKUs"""
    
    __tablename__ = "repacks"
    
    # Basic Information
    repack_name = Column(String(300), nullable=False)
    repack_name_en = Column(String(300), nullable=True)
    repack_code = Column(String(50), unique=True, nullable=False, index=True)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    barcode = Column(String(50), unique=True, nullable=True, index=True)
    
    # Repack Type and Category
    repack_type = Column(Enum(RepackType), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"), nullable=True)
    
    # Description
    description = Column(Text, nullable=True)
    description_en = Column(Text, nullable=True)
    short_description = Column(String(500), nullable=True)
    
    # Pricing
    unit_price = Column(DECIMAL(10, 2), nullable=False)
    cost_price = Column(DECIMAL(10, 2), nullable=False)  # Calculated from components
    member_price = Column(DECIMAL(10, 2), nullable=True)
    wholesale_price = Column(DECIMAL(10, 2), nullable=True)
    
    # Physical Properties
    total_weight = Column(DECIMAL(10, 3), nullable=False)  # Sum of component weights
    net_weight = Column(DECIMAL(10, 3), nullable=True)
    package_weight = Column(DECIMAL(10, 3), nullable=True)  # Weight of packaging
    
    # Dimensions
    length = Column(DECIMAL(8, 2), nullable=True)
    width = Column(DECIMAL(8, 2), nullable=True)
    height = Column(DECIMAL(8, 2), nullable=True)
    volume = Column(DECIMAL(10, 3), nullable=True)
    
    # Inventory Management
    minimum_stock_level = Column(DECIMAL(10, 2), default=0, nullable=False)
    optimal_stock_level = Column(DECIMAL(10, 2), default=0, nullable=False)
    maximum_stock_level = Column(DECIMAL(10, 2), nullable=True)
    
    # Production Information
    batch_size = Column(Integer, default=1, nullable=False)  # Standard production batch
    production_time_minutes = Column(Integer, nullable=True)
    labor_cost_per_unit = Column(DECIMAL(8, 2), default=0, nullable=False)
    packaging_cost_per_unit = Column(DECIMAL(8, 2), default=0, nullable=False)
    
    # Quality and Safety
    shelf_life_days = Column(Integer, nullable=True)
    storage_requirements = Column(JSONB, nullable=True)
    handling_instructions = Column(Text, nullable=True)
    
    # Status and Availability
    status = Column(Enum(RepackStatus), default=RepackStatus.PLANNED, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    is_seasonal = Column(Boolean, default=False, nullable=False)
    is_gift_item = Column(Boolean, default=False, nullable=False)
    is_custom_order_only = Column(Boolean, default=False, nullable=False)
    
    # Marketing
    images = Column(JSONB, nullable=True)  # Array of image URLs
    tags = Column(JSONB, nullable=True)  # Array of tags
    marketing_text = Column(Text, nullable=True)
    
    # Recipe/Formula
    recipe_version = Column(String(10), default="1.0", nullable=False)
    recipe_notes = Column(Text, nullable=True)
    
    # Validity Period
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    
    # Production Statistics
    total_produced = Column(Integer, default=0, nullable=False)
    total_sold = Column(Integer, default=0, nullable=False)
    last_produced_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    category = relationship("ProductCategory")
    components = relationship("RepackComponent", back_populates="repack", cascade="all, delete-orphan")
    productions = relationship("RepackProduction", back_populates="repack")
    inventory_stocks = relationship("InventoryStock", back_populates="repack")
    
    @property
    def component_count(self) -> int:
        """Get number of components in repack"""
        return len(self.components)
    
    @property
    def total_component_cost(self) -> Decimal:
        """Calculate total cost of all components"""
        return sum(comp.total_cost for comp in self.components)
    
    @property
    def total_cost(self) -> Decimal:
        """Calculate total cost including labor and packaging"""
        return self.total_component_cost + self.labor_cost_per_unit + self.packaging_cost_per_unit
    
    @property
    def gross_margin(self) -> Decimal:
        """Calculate gross margin percentage"""
        if self.unit_price > 0:
            return ((self.unit_price - self.total_cost) / self.unit_price) * 100
        return Decimal('0')
    
    @property
    def is_profitable(self) -> bool:
        """Check if repack is profitable"""
        return self.unit_price > self.total_cost
    
    @property
    def is_active_recipe(self) -> bool:
        """Check if recipe is currently active"""
        now = datetime.utcnow()
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        return True
    
    def calculate_weights_and_costs(self):
        """Recalculate total weights and costs from components"""
        self.total_weight = sum(comp.quantity for comp in self.components)
        self.cost_price = self.total_cost
    
    def can_be_produced(self, branch_id: str = None) -> tuple[bool, str]:
        """Check if repack can be produced with current inventory"""
        # This would check inventory levels for all components
        # Implementation depends on inventory checking logic
        return True, "All components available"
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return [
            "repack_name", "repack_name_en", "repack_code", 
            "sku", "barcode", "description"
        ]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "repack_type", "category_id", "status", "is_featured", 
            "is_seasonal", "is_gift_item", "is_active"
        ]


class RepackComponent(BaseModel):
    """Components/ingredients in a repack"""
    
    __tablename__ = "repack_components"
    
    # References
    repack_id = Column(UUID(as_uuid=True), ForeignKey("repacks.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Component Details
    component_name = Column(String(300), nullable=False)  # Snapshot for consistency
    sequence_order = Column(Integer, default=1, nullable=False)
    
    # Quantity
    quantity = Column(DECIMAL(12, 3), nullable=False)  # Quantity in product's unit
    unit_cost = Column(DECIMAL(10, 4), nullable=False)  # Cost per unit at time of recipe creation
    total_cost = Column(DECIMAL(12, 2), nullable=False)  # quantity * unit_cost
    
    # Tolerances for Production
    min_quantity = Column(DECIMAL(12, 3), nullable=True)  # Minimum acceptable quantity
    max_quantity = Column(DECIMAL(12, 3), nullable=True)  # Maximum acceptable quantity
    
    # Quality Requirements
    quality_requirements = Column(JSONB, nullable=True)
    is_optional = Column(Boolean, default=False, nullable=False)
    
    # Substitution Rules
    can_substitute = Column(Boolean, default=False, nullable=False)
    substitute_products = Column(JSONB, nullable=True)  # Array of product IDs
    substitute_ratio = Column(DECIMAL(5, 4), default=1.0, nullable=False)
    
    # Processing Instructions
    preparation_notes = Column(Text, nullable=True)
    processing_order = Column(Integer, nullable=True)
    
    # Cost Allocation
    cost_percentage = Column(DECIMAL(5, 2), nullable=True)  # Percentage of total cost
    
    # Relationships
    repack = relationship("Repack", back_populates="components")
    product = relationship("Product")
    
    def calculate_total_cost(self):
        """Calculate total cost for this component"""
        self.total_cost = self.quantity * self.unit_cost
    
    @property
    def is_within_tolerance(self, actual_quantity: Decimal) -> bool:
        """Check if actual quantity is within tolerance"""
        if self.min_quantity and actual_quantity < self.min_quantity:
            return False
        if self.max_quantity and actual_quantity > self.max_quantity:
            return False
        return True
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return ["repack_id", "product_id", "is_optional", "can_substitute"]


class RepackProduction(BaseModel, AuditMixin):
    """Production batch records for repacks"""
    
    __tablename__ = "repack_productions"
    
    # Production Information
    production_number = Column(String(50), unique=True, nullable=False, index=True)
    repack_id = Column(UUID(as_uuid=True), ForeignKey("repacks.id"), nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    
    # Batch Details
    batch_size = Column(Integer, nullable=False)  # Number of units to produce
    actual_produced = Column(Integer, default=0, nullable=False)
    rejected_units = Column(Integer, default=0, nullable=False)
    
    # Timing
    planned_start = Column(DateTime(timezone=True), nullable=False)
    actual_start = Column(DateTime(timezone=True), nullable=True)
    planned_completion = Column(DateTime(timezone=True), nullable=False)
    actual_completion = Column(DateTime(timezone=True), nullable=True)
    
    # Staff and Resources
    production_supervisor = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    production_team = Column(JSONB, nullable=True)  # Array of user IDs
    
    # Status
    status = Column(Enum(RepackStatus), default=RepackStatus.PLANNED, nullable=False)
    
    # Quality Control
    qc_passed = Column(Boolean, nullable=True)
    qc_notes = Column(Text, nullable=True)
    qc_checked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    qc_checked_at = Column(DateTime(timezone=True), nullable=True)
    
    # Costs
    material_cost = Column(DECIMAL(12, 2), default=0, nullable=False)
    labor_cost = Column(DECIMAL(10, 2), default=0, nullable=False)
    overhead_cost = Column(DECIMAL(10, 2), default=0, nullable=False)
    total_cost = Column(DECIMAL(12, 2), default=0, nullable=False)
    cost_per_unit = Column(DECIMAL(10, 4), default=0, nullable=False)
    
    # Yield Information
    yield_percentage = Column(DECIMAL(5, 2), default=100, nullable=False)
    waste_amount = Column(DECIMAL(10, 3), default=0, nullable=False)
    waste_cost = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Equipment and Location
    production_line = Column(String(100), nullable=True)
    equipment_used = Column(JSONB, nullable=True)
    location = Column(String(100), nullable=True)
    
    # Environmental Conditions
    temperature = Column(DECIMAL(5, 2), nullable=True)
    humidity = Column(DECIMAL(5, 2), nullable=True)
    conditions_notes = Column(Text, nullable=True)
    
    # Documentation
    notes = Column(Text, nullable=True)
    issues_encountered = Column(Text, nullable=True)
    lessons_learned = Column(Text, nullable=True)
    
    # Relationships
    repack = relationship("Repack", back_populates="productions")
    branch = relationship("Branch")
    supervisor = relationship("User", foreign_keys=[production_supervisor])
    qc_checker = relationship("User", foreign_keys=[qc_checked_by])
    component_usage = relationship("RepackComponentUsage", back_populates="production")
    
    @property
    def production_efficiency(self) -> float:
        """Calculate production efficiency percentage"""
        if self.batch_size > 0:
            return (self.actual_produced / self.batch_size) * 100
        return 0.0
    
    @property
    def rejection_rate(self) -> float:
        """Calculate rejection rate percentage"""
        total_units = self.actual_produced + self.rejected_units
        if total_units > 0:
            return (self.rejected_units / total_units) * 100
        return 0.0
    
    @property
    def duration_hours(self) -> Optional[float]:
        """Get production duration in hours"""
        if self.actual_start and self.actual_completion:
            duration = self.actual_completion - self.actual_start
            return duration.total_seconds() / 3600
        return None
    
    def calculate_costs(self):
        """Calculate total production costs"""
        self.total_cost = self.material_cost + self.labor_cost + self.overhead_cost
        if self.actual_produced > 0:
            self.cost_per_unit = self.total_cost / self.actual_produced
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "repack_id", "branch_id", "status", "production_supervisor",
            "planned_start", "actual_start", "qc_passed"
        ]


class RepackComponentUsage(BaseModel):
    """Actual component usage in production"""
    
    __tablename__ = "repack_component_usage"
    
    # References
    production_id = Column(UUID(as_uuid=True), ForeignKey("repack_productions.id"), nullable=False)
    component_id = Column(UUID(as_uuid=True), ForeignKey("repack_components.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Usage Details
    planned_quantity = Column(DECIMAL(12, 3), nullable=False)
    actual_quantity = Column(DECIMAL(12, 3), nullable=False)
    variance_quantity = Column(DECIMAL(12, 3), default=0, nullable=False)
    variance_percentage = Column(DECIMAL(5, 2), default=0, nullable=False)
    
    # Cost Information
    unit_cost = Column(DECIMAL(10, 4), nullable=False)
    total_cost = Column(DECIMAL(12, 2), nullable=False)
    
    # Batch/Lot Tracking
    batch_numbers_used = Column(JSONB, nullable=True)  # Array of batch numbers
    lot_numbers_used = Column(JSONB, nullable=True)
    
    # Quality Information
    quality_grade = Column(String(50), nullable=True)
    quality_notes = Column(Text, nullable=True)
    
    # Waste and Loss
    waste_quantity = Column(DECIMAL(10, 3), default=0, nullable=False)
    waste_reason = Column(String(200), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    substitution_used = Column(Boolean, default=False, nullable=False)
    substitution_notes = Column(Text, nullable=True)
    
    # Relationships
    production = relationship("RepackProduction", back_populates="component_usage")
    component = relationship("RepackComponent")
    product = relationship("Product")
    
    def calculate_variance(self):
        """Calculate usage variance"""
        self.variance_quantity = self.actual_quantity - self.planned_quantity
        if self.planned_quantity > 0:
            self.variance_percentage = (self.variance_quantity / self.planned_quantity) * 100
    
    @property
    def is_over_usage(self) -> bool:
        """Check if actual usage exceeded planned"""
        return self.actual_quantity > self.planned_quantity
    
    @property
    def efficiency_percentage(self) -> float:
        """Calculate usage efficiency"""
        if self.actual_quantity > 0:
            usable_quantity = self.actual_quantity - self.waste_quantity
            return (usable_quantity / self.actual_quantity) * 100
        return 100.0


# Add indexes for performance
Index('idx_repack_component_repack', RepackComponent.repack_id)
Index('idx_repack_production_repack', RepackProduction.repack_id)
Index('idx_repack_production_branch', RepackProduction.branch_id)
Index('idx_repack_production_date', RepackProduction.planned_start)
Index('idx_component_usage_production', RepackComponentUsage.production_id)