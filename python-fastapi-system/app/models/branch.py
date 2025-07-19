"""
Branch model and related tables
"""
import enum
from typing import List

from sqlalchemy import Column, String, Text, Boolean, DECIMAL, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, AuditMixin


class BranchType(str, enum.Enum):
    """Branch type enumeration"""
    MAIN = "main"
    PREMIUM = "premium"
    SHOPPING_CENTER = "shopping_center"
    COMMUNITY = "community"
    EXPRESS = "express"
    WAREHOUSE = "warehouse"


class BranchStatus(str, enum.Enum):
    """Branch status enumeration"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    UNDER_RENOVATION = "under_renovation"
    TEMPORARILY_CLOSED = "temporarily_closed"


class Branch(BaseModel, AuditMixin):
    """Branch model"""
    
    __tablename__ = "branches"
    
    # Basic Information
    branch_name = Column(String(200), nullable=False)
    branch_code = Column(String(20), unique=True, nullable=False, index=True)
    branch_type = Column(String(50), default=BranchType.COMMUNITY, nullable=False)
    status = Column(String(50), default=BranchStatus.ACTIVE, nullable=False)
    
    # Location Information
    address = Column(Text, nullable=False)
    province = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    postal_code = Column(String(10), nullable=True)
    latitude = Column(DECIMAL(10, 8), nullable=True)
    longitude = Column(DECIMAL(11, 8), nullable=True)
    
    # Contact Information
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    fax = Column(String(20), nullable=True)
    
    # Management Information
    manager_name = Column(String(200), nullable=True)
    manager_phone = Column(String(20), nullable=True)
    manager_email = Column(String(255), nullable=True)
    
    # Operational Information
    operating_hours = Column(JSONB, nullable=True)  # {"mon": "09:00-18:00", ...}
    services = Column(JSONB, nullable=True)  # ["retail", "sampling", "delivery"]
    facilities = Column(JSONB, nullable=True)  # ["parking", "air_conditioning", ...]
    
    # Business Metrics
    floor_area = Column(DECIMAL(8, 2), nullable=True)  # Square meters
    storage_capacity = Column(DECIMAL(10, 2), nullable=True)  # Cubic meters
    max_daily_customers = Column(Integer, nullable=True)
    
    # Financial Information
    monthly_rent = Column(DECIMAL(12, 2), nullable=True)
    monthly_utilities = Column(DECIMAL(10, 2), nullable=True)
    security_deposit = Column(DECIMAL(12, 2), nullable=True)
    
    # Configuration
    settings = Column(JSONB, nullable=True)
    tax_settings = Column(JSONB, nullable=True)
    pricing_settings = Column(JSONB, nullable=True)
    
    # Notes and Description
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Relationships
    users = relationship("User", back_populates="branch")
    inventory_stocks = relationship("InventoryStock", back_populates="branch")
    sales = relationship("Sale", back_populates="branch")
    deliveries = relationship("Delivery", back_populates="branch")
    
    @property
    def is_operational(self) -> bool:
        """Check if branch is operational"""
        return self.status == BranchStatus.ACTIVE and self.is_active
    
    @property
    def staff_count(self) -> int:
        """Get number of staff members"""
        return len([user for user in self.users if user.is_active])
    
    @property
    def coordinates(self) -> tuple:
        """Get latitude, longitude coordinates"""
        if self.latitude and self.longitude:
            return (float(self.latitude), float(self.longitude))
        return None
    
    def get_operating_hours_today(self) -> str:
        """Get today's operating hours"""
        if not self.operating_hours:
            return "Not specified"
        
        from datetime import datetime
        today = datetime.now().strftime("%a").lower()[:3]  # mon, tue, wed, etc.
        
        return self.operating_hours.get(today, "Closed")
    
    def is_service_available(self, service: str) -> bool:
        """Check if specific service is available"""
        if not self.services:
            return False
        return service in self.services
    
    def has_facility(self, facility: str) -> bool:
        """Check if branch has specific facility"""
        if not self.facilities:
            return False
        return facility in self.facilities
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return [
            "branch_name", "branch_code", "address", 
            "manager_name", "phone", "email"
        ]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "branch_type", "status", "province", "district",
            "is_active", "created_at"
        ]


class BranchSettings(BaseModel):
    """Branch-specific settings"""
    
    __tablename__ = "branch_settings"
    
    branch_id = Column(String(36), ForeignKey("branches.id"), nullable=False)
    setting_key = Column(String(100), nullable=False)
    setting_value = Column(JSONB, nullable=True)
    setting_type = Column(String(50), nullable=False)  # text, number, boolean, json
    description = Column(Text, nullable=True)
    
    # Relationships
    branch = relationship("Branch")
    
    class Meta:
        unique_together = ["branch_id", "setting_key"]


class BranchPerformance(BaseModel):
    """Branch performance metrics"""
    
    __tablename__ = "branch_performance"
    
    branch_id = Column(String(36), ForeignKey("branches.id"), nullable=False)
    metric_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    
    # Sales Metrics
    daily_revenue = Column(DECIMAL(12, 2), default=0, nullable=False)
    daily_transactions = Column(Integer, default=0, nullable=False)
    daily_customers = Column(Integer, default=0, nullable=False)
    average_transaction_value = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Inventory Metrics
    total_products = Column(Integer, default=0, nullable=False)
    low_stock_items = Column(Integer, default=0, nullable=False)
    out_of_stock_items = Column(Integer, default=0, nullable=False)
    inventory_turnover = Column(DECIMAL(8, 4), default=0, nullable=False)
    
    # Operational Metrics
    staff_on_duty = Column(Integer, default=0, nullable=False)
    customer_satisfaction = Column(DECIMAL(3, 2), nullable=True)  # 1.00 to 5.00
    delivery_orders = Column(Integer, default=0, nullable=False)
    delivery_completion_rate = Column(DECIMAL(5, 2), default=100, nullable=False)
    
    # Cost Metrics
    daily_costs = Column(DECIMAL(10, 2), default=0, nullable=False)
    sampling_costs = Column(DECIMAL(8, 2), default=0, nullable=False)
    operational_costs = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Additional Metrics
    metrics_data = Column(JSONB, nullable=True)
    
    # Relationships
    branch = relationship("Branch")
    
    @property
    def profit_margin(self) -> float:
        """Calculate profit margin"""
        if self.daily_revenue > 0:
            profit = self.daily_revenue - self.daily_costs
            return float(profit / self.daily_revenue * 100)
        return 0.0
    
    @property
    def cost_ratio(self) -> float:
        """Calculate cost to revenue ratio"""
        if self.daily_revenue > 0:
            return float(self.daily_costs / self.daily_revenue * 100)
        return 0.0
    
    class Meta:
        unique_together = ["branch_id", "metric_date"]