"""
Inventory schemas for API requests and responses
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, Field, validator

from app.models.inventory import MovementType, MovementReason
from app.schemas.product import ProductResponse


# Base inventory schema
class InventoryBase(BaseModel):
    """Base inventory schema with common fields"""
    product_id: str
    branch_id: str
    quantity_on_hand: Decimal = Field(..., ge=0, decimal_places=3)
    quantity_reserved: Decimal = Field(0, ge=0, decimal_places=3)
    reorder_point: Decimal = Field(..., ge=0, decimal_places=3)
    reorder_quantity: Decimal = Field(..., gt=0, decimal_places=3)
    location: Optional[str] = Field(None, max_length=100)
    batch_number: Optional[str] = Field(None, max_length=50)
    expiry_date: Optional[datetime] = None
    
    @validator('quantity_reserved')
    def validate_reserved(cls, v, values):
        """Validate reserved quantity doesn't exceed on hand"""
        if 'quantity_on_hand' in values and v > values['quantity_on_hand']:
            raise ValueError('Reserved quantity cannot exceed quantity on hand')
        return v


# Inventory creation schema
class InventoryCreate(InventoryBase):
    """Schema for creating new inventory"""
    notes: Optional[str] = None


# Inventory update schema
class InventoryUpdate(BaseModel):
    """Schema for updating inventory"""
    quantity_on_hand: Optional[Decimal] = Field(None, ge=0, decimal_places=3)
    quantity_reserved: Optional[Decimal] = Field(None, ge=0, decimal_places=3)
    reorder_point: Optional[Decimal] = Field(None, ge=0, decimal_places=3)
    reorder_quantity: Optional[Decimal] = Field(None, gt=0, decimal_places=3)
    location: Optional[str] = Field(None, max_length=100)
    batch_number: Optional[str] = Field(None, max_length=50)
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None


# Stock movement schema
class StockMovementBase(BaseModel):
    """Base schema for stock movements"""
    movement_type: MovementType
    reason: MovementReason
    quantity: Decimal = Field(..., gt=0, decimal_places=3)
    reference_id: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class StockMovementCreate(StockMovementBase):
    """Schema for creating stock movement"""
    inventory_id: str


class StockMovementResponse(StockMovementBase):
    """Schema for stock movement response"""
    id: str
    inventory_id: str
    product_id: str
    branch_id: str
    quantity_before: Decimal
    quantity_after: Decimal
    created_by: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Stock update request
class StockUpdateRequest(BaseModel):
    """Schema for stock update request"""
    quantity_change: Decimal = Field(..., gt=0, decimal_places=3)
    movement_type: MovementType
    reason: MovementReason
    reference_id: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


# Stock transfer request
class StockTransferRequest(BaseModel):
    """Schema for stock transfer request"""
    product_id: str
    from_branch_id: str
    to_branch_id: str
    quantity: Decimal = Field(..., gt=0, decimal_places=3)
    notes: Optional[str] = None


# Stock reservation request
class StockReservationRequest(BaseModel):
    """Schema for stock reservation request"""
    quantity: Decimal = Field(..., gt=0, decimal_places=3)
    order_id: str


# Physical count request
class PhysicalCountRequest(BaseModel):
    """Schema for physical count request"""
    counted_quantity: Decimal = Field(..., ge=0, decimal_places=3)
    notes: Optional[str] = None


# Physical count response
class PhysicalCountResponse(BaseModel):
    """Schema for physical count response"""
    id: str
    inventory_id: str
    product_id: str
    branch_id: str
    counted_quantity: Decimal
    system_quantity: Decimal
    variance: Decimal
    counted_by: str
    notes: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Inventory response schema
class InventoryResponse(InventoryBase):
    """Schema for inventory responses"""
    id: str
    available_quantity: Decimal
    last_movement_date: Optional[datetime] = None
    last_count_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    @validator('available_quantity', always=True)
    def compute_available(cls, v, values):
        """Compute available quantity"""
        on_hand = values.get('quantity_on_hand', 0)
        reserved = values.get('quantity_reserved', 0)
        return on_hand - reserved
    
    class Config:
        from_attributes = True


# Inventory with product response
class InventoryWithProductResponse(InventoryResponse):
    """Schema for inventory with product details"""
    product: ProductResponse


# Inventory list response schema
class InventoryListResponse(BaseModel):
    """Schema for inventory list responses"""
    items: List[InventoryWithProductResponse]
    total: int
    page: int
    size: int
    pages: int


# Low stock item schema
class LowStockItem(BaseModel):
    """Schema for low stock items"""
    inventory: InventoryResponse
    product: ProductResponse
    available: Decimal
    shortage: Decimal


# Expiring stock item schema
class ExpiringStockItem(BaseModel):
    """Schema for expiring stock items"""
    inventory: InventoryResponse
    product: ProductResponse
    days_until_expiry: int
    quantity: Decimal


# Stock value response
class StockValueResponse(BaseModel):
    """Schema for stock value response"""
    total_value: Decimal
    item_count: int
    total_quantity: Decimal
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None


# Movement history filters
class MovementHistoryFilters(BaseModel):
    """Schema for movement history filters"""
    inventory_id: Optional[str] = None
    product_id: Optional[str] = None
    branch_id: Optional[str] = None
    movement_type: Optional[MovementType] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


# Batch reorder update
class BatchReorderUpdate(BaseModel):
    """Schema for batch reorder point update"""
    inventory_id: str
    reorder_point: Optional[Decimal] = Field(None, ge=0, decimal_places=3)
    reorder_quantity: Optional[Decimal] = Field(None, gt=0, decimal_places=3)


class BatchReorderUpdateRequest(BaseModel):
    """Schema for batch reorder update request"""
    updates: List[BatchReorderUpdate]


# Inventory adjustment schema
class InventoryAdjustment(BaseModel):
    """Schema for inventory adjustment"""
    inventory_id: str
    adjustment_quantity: Decimal = Field(..., decimal_places=3)
    reason: str = Field(..., min_length=1)
    notes: Optional[str] = None


# Stock alert configuration
class StockAlertConfig(BaseModel):
    """Schema for stock alert configuration"""
    inventory_id: str
    alert_enabled: bool = True
    low_stock_threshold: Optional[Decimal] = Field(None, ge=0, decimal_places=3)
    critical_stock_threshold: Optional[Decimal] = Field(None, ge=0, decimal_places=3)
    expiry_alert_days: Optional[int] = Field(None, gt=0)


# Inventory import schema
class InventoryImportItem(BaseModel):
    """Schema for inventory import item"""
    product_sku: str
    branch_code: str
    quantity: Decimal = Field(..., ge=0, decimal_places=3)
    reorder_point: Optional[Decimal] = Field(None, ge=0, decimal_places=3)
    reorder_quantity: Optional[Decimal] = Field(None, gt=0, decimal_places=3)
    location: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None


class InventoryImportRequest(BaseModel):
    """Schema for inventory import request"""
    items: List[InventoryImportItem]
    update_existing: bool = True


# Inventory summary schema
class InventorySummary(BaseModel):
    """Schema for inventory summary"""
    total_items: int
    total_quantity: Decimal
    total_value: Decimal
    low_stock_count: int
    out_of_stock_count: int
    expiring_soon_count: int
    branch_count: int