"""
Shipping schemas for API requests and responses
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, Field, validator

from app.models.shipping import ShipmentStatus, DeliveryStatus, VehicleStatus, DriverStatus, VehicleType


# Shipment item schemas
class ShipmentItemBase(BaseModel):
    """Base schema for shipment items"""
    product_id: Optional[str] = None
    quantity: Decimal = Field(..., gt=0, decimal_places=3)
    weight: Decimal = Field(..., gt=0, decimal_places=3)
    volume: Optional[Decimal] = Field(None, gt=0, decimal_places=3)
    value: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    description: Optional[str] = None
    handling_notes: Optional[str] = None


class ShipmentItemCreate(ShipmentItemBase):
    """Schema for creating shipment item"""
    pass


class ShipmentItemResponse(ShipmentItemBase):
    """Schema for shipment item response"""
    id: str
    shipment_id: str
    created_at: datetime
    
    # Product details (populated from join)
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    
    class Config:
        from_attributes = True


# Shipment schemas
class ShipmentBase(BaseModel):
    """Base schema for shipments"""
    from_branch_id: str
    to_branch_id: str
    priority: str = Field("normal", pattern="^(low|normal|high|urgent)$")
    special_instructions: Optional[str] = None
    scheduled_delivery_date: Optional[datetime] = None


class ShipmentCreate(ShipmentBase):
    """Schema for creating shipment"""
    items: List[ShipmentItemCreate] = Field(..., min_items=1)
    
    @validator('items')
    def validate_items(cls, v):
        """Validate shipment items"""
        if not v:
            raise ValueError('Shipment must have at least one item')
        return v


class ShipmentUpdate(BaseModel):
    """Schema for updating shipment"""
    priority: Optional[str] = Field(None, pattern="^(low|normal|high|urgent)$")
    special_instructions: Optional[str] = None
    scheduled_delivery_date: Optional[datetime] = None
    estimated_delivery_date: Optional[datetime] = None


class ShipmentResponse(ShipmentBase):
    """Schema for shipment response"""
    id: str
    tracking_number: str
    status: ShipmentStatus
    total_weight: Decimal
    total_volume: Decimal
    estimated_value: Decimal
    route_id: Optional[str] = None
    assigned_at: Optional[datetime] = None
    shipped_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    estimated_delivery_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    
    # Related data
    items: List[ShipmentItemResponse] = []
    from_branch_name: Optional[str] = None
    to_branch_name: Optional[str] = None
    route_name: Optional[str] = None
    driver_name: Optional[str] = None
    vehicle_plate: Optional[str] = None
    
    class Config:
        from_attributes = True


class ShipmentListResponse(BaseModel):
    """Schema for shipment list responses"""
    shipments: List[ShipmentResponse]
    total: int
    page: int
    size: int
    pages: int


# Driver schemas
class DriverBase(BaseModel):
    """Base schema for drivers"""
    employee_id: str = Field(..., max_length=50)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., max_length=20)
    email: Optional[str] = None
    license_number: str = Field(..., max_length=50)
    license_expiry: datetime
    license_class: str = Field(..., max_length=10)
    emergency_contact: Optional[Dict[str, Any]] = None


class DriverCreate(DriverBase):
    """Schema for creating driver"""
    pass


class DriverUpdate(BaseModel):
    """Schema for updating driver"""
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = None
    license_number: Optional[str] = Field(None, max_length=50)
    license_expiry: Optional[datetime] = None
    license_class: Optional[str] = Field(None, max_length=10)
    status: Optional[DriverStatus] = None
    emergency_contact: Optional[Dict[str, Any]] = None


class DriverResponse(DriverBase):
    """Schema for driver response"""
    id: str
    full_name: str
    status: DriverStatus
    is_available: bool
    total_deliveries: int
    rating: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime
    
    @validator('full_name', always=True)
    def compute_full_name(cls, v, values):
        """Compute full name from first and last name"""
        first = values.get('first_name', '')
        last = values.get('last_name', '')
        return f"{first} {last}".strip()
    
    class Config:
        from_attributes = True


# Vehicle schemas
class VehicleBase(BaseModel):
    """Base schema for vehicles"""
    license_plate: str = Field(..., max_length=20)
    make: str = Field(..., max_length=50)
    model: str = Field(..., max_length=50)
    year: int = Field(..., ge=1900, le=2030)
    vehicle_type: VehicleType
    max_weight: Decimal = Field(..., gt=0, decimal_places=3)
    max_volume: Decimal = Field(..., gt=0, decimal_places=3)
    fuel_type: str = Field(..., max_length=20)
    insurance_expiry: datetime
    registration_expiry: datetime


class VehicleCreate(VehicleBase):
    """Schema for creating vehicle"""
    pass


class VehicleUpdate(BaseModel):
    """Schema for updating vehicle"""
    make: Optional[str] = Field(None, max_length=50)
    model: Optional[str] = Field(None, max_length=50)
    year: Optional[int] = Field(None, ge=1900, le=2030)
    vehicle_type: Optional[VehicleType] = None
    max_weight: Optional[Decimal] = Field(None, gt=0, decimal_places=3)
    max_volume: Optional[Decimal] = Field(None, gt=0, decimal_places=3)
    fuel_type: Optional[str] = Field(None, max_length=20)
    status: Optional[VehicleStatus] = None
    insurance_expiry: Optional[datetime] = None
    registration_expiry: Optional[datetime] = None
    last_maintenance: Optional[datetime] = None
    mileage: Optional[int] = None


class VehicleResponse(VehicleBase):
    """Schema for vehicle response"""
    id: str
    status: VehicleStatus
    is_available: bool
    mileage: Optional[int] = None
    last_maintenance: Optional[datetime] = None
    next_maintenance: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Delivery route schemas
class DeliveryRouteBase(BaseModel):
    """Base schema for delivery routes"""
    route_name: str = Field(..., min_length=1, max_length=100)
    start_location: str = Field(..., max_length=200)
    end_location: str = Field(..., max_length=200)
    estimated_distance: Decimal = Field(..., gt=0, decimal_places=2)
    estimated_duration: int = Field(..., gt=0)  # in minutes
    route_coordinates: Optional[List[Dict[str, float]]] = None


class DeliveryRouteCreate(DeliveryRouteBase):
    """Schema for creating delivery route"""
    driver_id: str
    vehicle_id: str


class DeliveryRouteUpdate(BaseModel):
    """Schema for updating delivery route"""
    route_name: Optional[str] = Field(None, min_length=1, max_length=100)
    start_location: Optional[str] = Field(None, max_length=200)
    end_location: Optional[str] = Field(None, max_length=200)
    estimated_distance: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    estimated_duration: Optional[int] = Field(None, gt=0)
    driver_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    is_active: Optional[bool] = None
    route_coordinates: Optional[List[Dict[str, float]]] = None


class DeliveryRouteResponse(DeliveryRouteBase):
    """Schema for delivery route response"""
    id: str
    driver_id: str
    vehicle_id: str
    is_active: bool
    total_deliveries: int
    success_rate: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime
    
    # Related data
    driver: Optional[DriverResponse] = None
    vehicle: Optional[VehicleResponse] = None
    
    class Config:
        from_attributes = True


# Status update schemas
class StatusUpdateRequest(BaseModel):
    """Schema for status update request"""
    status: ShipmentStatus
    location: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = None


class BulkStatusUpdateRequest(BaseModel):
    """Schema for bulk status update request"""
    shipment_ids: List[str]
    status: ShipmentStatus
    notes: Optional[str] = None


# Route assignment schema
class RouteAssignmentRequest(BaseModel):
    """Schema for route assignment request"""
    shipment_ids: List[str]
    route_id: str


# Tracking schemas
class TrackingResponse(BaseModel):
    """Schema for tracking response"""
    shipment: ShipmentResponse
    current_location: Optional[str] = None
    status_history: List[Dict[str, Any]]
    estimated_delivery: Optional[datetime] = None
    route_info: Optional[Dict[str, Any]] = None


class ShipmentStatusHistory(BaseModel):
    """Schema for shipment status history"""
    id: str
    shipment_id: str
    old_status: ShipmentStatus
    new_status: ShipmentStatus
    location: Optional[str] = None
    notes: Optional[str] = None
    changed_by: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# Statistics schemas
class ShipmentStatistics(BaseModel):
    """Schema for shipment statistics"""
    total_shipments: int
    status_breakdown: Dict[str, int]
    average_delivery_time_hours: float
    on_time_delivery_rate: float
    delivered_shipments: int


class DeliveryScheduleItem(BaseModel):
    """Schema for delivery schedule item"""
    shipment_id: str
    tracking_number: str
    to_branch: str
    status: str
    total_weight: Decimal
    estimated_delivery: Optional[datetime] = None


class DeliveryScheduleRoute(BaseModel):
    """Schema for delivery schedule route"""
    route_id: Optional[str] = None
    driver_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    shipments: List[DeliveryScheduleItem]


# Search and filter schemas
class ShipmentSearchFilters(BaseModel):
    """Schema for shipment search filters"""
    tracking_number: Optional[str] = None
    from_branch_id: Optional[str] = None
    to_branch_id: Optional[str] = None
    status: Optional[ShipmentStatus] = None
    priority: Optional[str] = None
    route_id: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


# Route optimization schemas
class RouteOptimizationRequest(BaseModel):
    """Schema for route optimization request"""
    date: datetime
    max_shipments_per_route: int = Field(10, ge=1, le=50)
    max_weight_per_route: Optional[Decimal] = Field(None, gt=0)
    max_volume_per_route: Optional[Decimal] = Field(None, gt=0)


class OptimizedRoute(BaseModel):
    """Schema for optimized route"""
    route: DeliveryRouteResponse
    shipments: List[ShipmentResponse]
    total_weight: Decimal
    total_volume: Decimal
    estimated_duration: int
    optimization_score: float


# Driver performance schemas
class DriverPerformance(BaseModel):
    """Schema for driver performance"""
    driver: DriverResponse
    total_deliveries: int
    on_time_deliveries: int
    late_deliveries: int
    average_delivery_time: float
    customer_rating: Optional[float] = None
    fuel_efficiency: Optional[float] = None


# Vehicle maintenance schemas
class VehicleMaintenanceRecord(BaseModel):
    """Schema for vehicle maintenance record"""
    id: str
    vehicle_id: str
    maintenance_type: str
    description: str
    cost: Decimal
    performed_by: str
    performed_at: datetime
    next_maintenance_due: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class VehicleMaintenanceCreate(BaseModel):
    """Schema for creating vehicle maintenance record"""
    vehicle_id: str
    maintenance_type: str = Field(..., max_length=100)
    description: str
    cost: Decimal = Field(..., gt=0, decimal_places=2)
    performed_by: str = Field(..., max_length=200)
    performed_at: datetime
    next_maintenance_due: Optional[datetime] = None