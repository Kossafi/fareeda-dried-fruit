"""
Shipping and delivery tracking models
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


class DeliveryStatus(str, enum.Enum):
    """Delivery status enumeration"""
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETURNED = "returned"


class VehicleType(str, enum.Enum):
    """Vehicle type enumeration"""
    MOTORCYCLE = "motorcycle"
    CAR = "car"
    VAN = "van"
    TRUCK = "truck"
    BICYCLE = "bicycle"
    WALKING = "walking"


class DeliveryPriority(str, enum.Enum):
    """Delivery priority enumeration"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"
    SAME_DAY = "same_day"


class Delivery(BaseModel, AuditMixin):
    """Main delivery model"""
    
    __tablename__ = "deliveries"
    
    # Delivery Identification
    delivery_number = Column(String(50), unique=True, nullable=False, index=True)
    tracking_number = Column(String(100), unique=True, nullable=True, index=True)
    
    # Source and Destination
    from_branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    to_branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    
    # Customer Delivery Information
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    delivery_address = Column(JSONB, nullable=False)  # Complete address object
    
    # Contact Information
    recipient_name = Column(String(200), nullable=False)
    recipient_phone = Column(String(20), nullable=False)
    recipient_email = Column(String(255), nullable=True)
    
    # Delivery Details
    delivery_date = Column(DateTime(timezone=True), nullable=False)
    delivery_time_slot = Column(String(50), nullable=True)  # "09:00-12:00"
    priority = Column(Enum(DeliveryPriority), default=DeliveryPriority.NORMAL, nullable=False)
    
    # Driver and Vehicle
    driver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=True)
    vehicle_type = Column(Enum(VehicleType), nullable=True)
    
    # Status and Timing
    status = Column(Enum(DeliveryStatus), default=DeliveryStatus.PENDING, nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    picked_up_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    
    # Distance and Route
    estimated_distance_km = Column(DECIMAL(8, 2), nullable=True)
    actual_distance_km = Column(DECIMAL(8, 2), nullable=True)
    estimated_duration_minutes = Column(Integer, nullable=True)
    actual_duration_minutes = Column(Integer, nullable=True)
    
    # Financial Information
    delivery_fee = Column(DECIMAL(8, 2), default=0, nullable=False)
    fuel_cost = Column(DECIMAL(8, 2), default=0, nullable=False)
    driver_commission = Column(DECIMAL(8, 2), default=0, nullable=False)
    total_cost = Column(DECIMAL(8, 2), default=0, nullable=False)
    
    # Package Information
    total_weight_kg = Column(DECIMAL(8, 3), default=0, nullable=False)
    total_volume_cm3 = Column(DECIMAL(12, 3), default=0, nullable=False)
    package_count = Column(Integer, default=1, nullable=False)
    
    # Special Instructions
    delivery_instructions = Column(Text, nullable=True)
    special_requirements = Column(JSONB, nullable=True)
    handling_instructions = Column(Text, nullable=True)
    
    # Quality and Verification
    requires_signature = Column(Boolean, default=True, nullable=False)
    requires_id_check = Column(Boolean, default=False, nullable=False)
    signature_image_url = Column(String(500), nullable=True)
    id_photo_url = Column(String(500), nullable=True)
    delivery_photo_url = Column(String(500), nullable=True)
    
    # Insurance and COD
    is_insured = Column(Boolean, default=False, nullable=False)
    insurance_value = Column(DECIMAL(10, 2), nullable=True)
    is_cod = Column(Boolean, default=False, nullable=False)  # Cash on Delivery
    cod_amount = Column(DECIMAL(10, 2), nullable=True)
    cod_collected = Column(Boolean, default=False, nullable=False)
    
    # Failure and Returns
    failure_reason = Column(Text, nullable=True)
    failure_count = Column(Integer, default=0, nullable=False)
    last_failure_at = Column(DateTime(timezone=True), nullable=True)
    max_retry_attempts = Column(Integer, default=3, nullable=False)
    
    # Location Tracking
    current_location = Column(JSONB, nullable=True)  # {"lat": x, "lng": y}
    route_history = Column(JSONB, nullable=True)  # Array of location points
    
    # External Integration
    external_tracking_id = Column(String(100), nullable=True)
    external_carrier = Column(String(100), nullable=True)
    external_status = Column(String(50), nullable=True)
    
    # Rating and Feedback
    customer_rating = Column(Integer, nullable=True)  # 1-5 stars
    customer_feedback = Column(Text, nullable=True)
    driver_notes = Column(Text, nullable=True)
    
    # Relationships
    from_branch = relationship("Branch", foreign_keys=[from_branch_id])
    to_branch = relationship("Branch", foreign_keys=[to_branch_id])
    customer = relationship("Customer")
    driver = relationship("User", foreign_keys=[driver_id])
    vehicle = relationship("Vehicle")
    delivery_items = relationship("DeliveryItem", back_populates="delivery", cascade="all, delete-orphan")
    delivery_tracking = relationship("DeliveryTracking", back_populates="delivery", cascade="all, delete-orphan")
    
    @property
    def is_completed(self) -> bool:
        """Check if delivery is completed"""
        return self.status == DeliveryStatus.DELIVERED
    
    @property
    def is_failed(self) -> bool:
        """Check if delivery failed"""
        return self.status == DeliveryStatus.FAILED
    
    @property
    def can_retry(self) -> bool:
        """Check if delivery can be retried"""
        return (
            self.is_failed and 
            self.failure_count < self.max_retry_attempts
        )
    
    @property
    def delivery_address_formatted(self) -> str:
        """Get formatted delivery address"""
        if not self.delivery_address:
            return ""
        
        parts = []
        if self.delivery_address.get("address_line_1"):
            parts.append(self.delivery_address["address_line_1"])
        if self.delivery_address.get("address_line_2"):
            parts.append(self.delivery_address["address_line_2"])
        if self.delivery_address.get("district"):
            parts.append(self.delivery_address["district"])
        if self.delivery_address.get("province"):
            parts.append(self.delivery_address["province"])
        if self.delivery_address.get("postal_code"):
            parts.append(self.delivery_address["postal_code"])
            
        return ", ".join(parts)
    
    @property
    def estimated_profit(self) -> Decimal:
        """Calculate estimated profit from delivery"""
        return self.delivery_fee - self.total_cost
    
    def calculate_totals(self):
        """Calculate delivery totals from items"""
        self.total_weight_kg = sum(item.weight_kg for item in self.delivery_items)
        self.total_volume_cm3 = sum(item.volume_cm3 for item in self.delivery_items)
        self.package_count = len(self.delivery_items)
        
        # Calculate total cost
        self.total_cost = self.fuel_cost + self.driver_commission
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return [
            "delivery_number", "tracking_number", "recipient_name", 
            "recipient_phone", "external_tracking_id"
        ]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "from_branch_id", "to_branch_id", "driver_id", "status", 
            "priority", "delivery_date", "is_cod", "is_insured"
        ]


class DeliveryItem(BaseModel):
    """Items in a delivery"""
    
    __tablename__ = "delivery_items"
    
    # References
    delivery_id = Column(UUID(as_uuid=True), ForeignKey("deliveries.id"), nullable=False)
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id"), nullable=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    repack_id = Column(UUID(as_uuid=True), ForeignKey("repacks.id"), nullable=True)
    
    # Item Details
    item_name = Column(String(300), nullable=False)
    item_code = Column(String(50), nullable=False)
    sku = Column(String(100), nullable=False)
    
    # Quantity and Physical Properties
    quantity = Column(DECIMAL(12, 3), nullable=False)
    weight_kg = Column(DECIMAL(8, 3), nullable=False)
    volume_cm3 = Column(DECIMAL(10, 3), nullable=False)
    
    # Dimensions
    length_cm = Column(DECIMAL(6, 2), nullable=True)
    width_cm = Column(DECIMAL(6, 2), nullable=True)
    height_cm = Column(DECIMAL(6, 2), nullable=True)
    
    # Value and Insurance
    declared_value = Column(DECIMAL(10, 2), nullable=False)
    is_fragile = Column(Boolean, default=False, nullable=False)
    is_perishable = Column(Boolean, default=False, nullable=False)
    requires_cold_storage = Column(Boolean, default=False, nullable=False)
    
    # Package Information
    package_number = Column(String(50), nullable=True)
    barcode = Column(String(50), nullable=True)
    
    # Quality Control
    quality_checked = Column(Boolean, default=False, nullable=False)
    quality_notes = Column(Text, nullable=True)
    
    # Delivery Condition
    condition_on_pickup = Column(String(50), default="good", nullable=False)
    condition_on_delivery = Column(String(50), nullable=True)
    damage_report = Column(Text, nullable=True)
    
    # Special Handling
    handling_requirements = Column(JSONB, nullable=True)
    temperature_requirements = Column(JSONB, nullable=True)
    
    # Relationships
    delivery = relationship("Delivery", back_populates="delivery_items")
    sale = relationship("Sale")
    product = relationship("Product")
    repack = relationship("Repack")
    
    @property
    def is_damaged(self) -> bool:
        """Check if item was damaged during delivery"""
        return self.condition_on_delivery == "damaged"
    
    @property
    def requires_special_handling(self) -> bool:
        """Check if item requires special handling"""
        return (
            self.is_fragile or 
            self.is_perishable or 
            self.requires_cold_storage or
            bool(self.handling_requirements)
        )


class DeliveryTracking(BaseModel):
    """Delivery status tracking and history"""
    
    __tablename__ = "delivery_tracking"
    
    # References
    delivery_id = Column(UUID(as_uuid=True), ForeignKey("deliveries.id"), nullable=False)
    
    # Status Information
    status = Column(Enum(DeliveryStatus), nullable=False)
    previous_status = Column(Enum(DeliveryStatus), nullable=True)
    
    # Location and Time
    location = Column(JSONB, nullable=True)  # {"lat": x, "lng": y, "address": "..."}
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    
    # Activity Details
    activity = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    # User and System Information
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    update_source = Column(String(50), default="manual", nullable=False)  # manual, gps, api
    
    # Device Information
    device_info = Column(JSONB, nullable=True)
    
    # Verification
    photo_url = Column(String(500), nullable=True)
    signature_url = Column(String(500), nullable=True)
    
    # Weather and Conditions
    weather_conditions = Column(String(100), nullable=True)
    traffic_conditions = Column(String(100), nullable=True)
    
    # Relationships
    delivery = relationship("Delivery", back_populates="delivery_tracking")
    updated_by_user = relationship("User")
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return ["delivery_id", "status", "updated_by", "update_source", "timestamp"]


class Vehicle(BaseModel, AuditMixin):
    """Delivery vehicles"""
    
    __tablename__ = "vehicles"
    
    # Vehicle Information
    vehicle_number = Column(String(50), unique=True, nullable=False, index=True)
    license_plate = Column(String(20), unique=True, nullable=False, index=True)
    vehicle_type = Column(Enum(VehicleType), nullable=False)
    
    # Vehicle Details
    make = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    year = Column(Integer, nullable=True)
    color = Column(String(50), nullable=True)
    
    # Capacity
    max_weight_kg = Column(DECIMAL(8, 2), nullable=False)
    max_volume_cm3 = Column(DECIMAL(12, 2), nullable=False)
    fuel_capacity_liters = Column(DECIMAL(6, 2), nullable=True)
    
    # Status
    status = Column(String(50), default="available", nullable=False)  # available, in_use, maintenance, retired
    current_driver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    current_location = Column(JSONB, nullable=True)
    
    # Maintenance
    last_maintenance_date = Column(DateTime(timezone=True), nullable=True)
    next_maintenance_date = Column(DateTime(timezone=True), nullable=True)
    odometer_km = Column(Integer, default=0, nullable=False)
    
    # Insurance and Registration
    insurance_expiry = Column(DateTime(timezone=True), nullable=True)
    registration_expiry = Column(DateTime(timezone=True), nullable=True)
    
    # Tracking Device
    gps_device_id = Column(String(100), nullable=True)
    tracking_enabled = Column(Boolean, default=True, nullable=False)
    
    # Performance Metrics
    fuel_efficiency_kmpl = Column(DECIMAL(5, 2), nullable=True)
    average_delivery_time_minutes = Column(Integer, nullable=True)
    total_deliveries = Column(Integer, default=0, nullable=False)
    total_distance_km = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Relationships
    current_driver = relationship("User")
    deliveries = relationship("Delivery", back_populates="vehicle")
    
    @property
    def is_available(self) -> bool:
        """Check if vehicle is available for assignment"""
        return self.status == "available" and self.is_active
    
    @property
    def needs_maintenance(self) -> bool:
        """Check if vehicle needs maintenance"""
        if self.next_maintenance_date:
            return datetime.utcnow() >= self.next_maintenance_date
        return False
    
    @property
    def utilization_rate(self) -> float:
        """Calculate vehicle utilization rate"""
        # This would need to be calculated based on usage patterns
        # For now, return a placeholder
        return 0.0
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return ["vehicle_number", "license_plate", "make", "model"]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return ["vehicle_type", "status", "current_driver_id", "is_active"]


class DeliveryRoute(BaseModel, AuditMixin):
    """Optimized delivery routes"""
    
    __tablename__ = "delivery_routes"
    
    # Route Information
    route_number = Column(String(50), unique=True, nullable=False, index=True)
    route_name = Column(String(200), nullable=False)
    route_date = Column(DateTime(timezone=True), nullable=False)
    
    # Assignment
    driver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    
    # Route Metrics
    total_deliveries = Column(Integer, default=0, nullable=False)
    total_distance_km = Column(DECIMAL(10, 2), default=0, nullable=False)
    estimated_duration_minutes = Column(Integer, default=0, nullable=False)
    actual_duration_minutes = Column(Integer, nullable=True)
    
    # Status and Timing
    status = Column(String(50), default="planned", nullable=False)  # planned, started, completed, cancelled
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Optimization Data
    optimization_algorithm = Column(String(50), nullable=True)
    optimization_score = Column(DECIMAL(5, 2), nullable=True)
    route_coordinates = Column(JSONB, nullable=True)  # Array of lat/lng points
    
    # Performance
    successful_deliveries = Column(Integer, default=0, nullable=False)
    failed_deliveries = Column(Integer, default=0, nullable=False)
    fuel_consumed_liters = Column(DECIMAL(6, 2), nullable=True)
    fuel_cost = Column(DECIMAL(8, 2), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    driver_feedback = Column(Text, nullable=True)
    
    # Relationships
    driver = relationship("User")
    vehicle = relationship("Vehicle")
    branch = relationship("Branch")
    deliveries = relationship("Delivery")  # Through route_deliveries association
    
    @property
    def success_rate(self) -> float:
        """Calculate delivery success rate"""
        if self.total_deliveries > 0:
            return (self.successful_deliveries / self.total_deliveries) * 100
        return 0.0
    
    @property
    def efficiency_score(self) -> float:
        """Calculate route efficiency score"""
        if self.estimated_duration_minutes and self.actual_duration_minutes:
            return min(100, (self.estimated_duration_minutes / self.actual_duration_minutes) * 100)
        return 0.0
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return ["driver_id", "vehicle_id", "branch_id", "status", "route_date"]


# Add indexes for performance
Index('idx_delivery_status_date', Delivery.status, Delivery.delivery_date)
Index('idx_delivery_driver_date', Delivery.driver_id, Delivery.delivery_date)
Index('idx_delivery_branch_date', Delivery.from_branch_id, Delivery.delivery_date)
Index('idx_delivery_tracking_delivery', DeliveryTracking.delivery_id, DeliveryTracking.timestamp)
Index('idx_vehicle_status', Vehicle.status)
Index('idx_delivery_route_date', DeliveryRoute.route_date)