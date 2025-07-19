"""
Barcode schemas for API requests and responses
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from uuid import UUID

from app.models.barcode import BarcodeType, ScanPurpose, LabelSize, PrinterType


# Base barcode schema
class BarcodeBase(BaseModel):
    """Base barcode schema with common fields"""
    barcode: str = Field(..., min_length=1, max_length=100)
    barcode_type: BarcodeType = BarcodeType.CODE128
    product_id: str
    batch_number: Optional[str] = Field(None, max_length=50)
    expiry_date: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


# Barcode creation schema
class BarcodeCreate(BaseModel):
    """Schema for creating new barcode"""
    product_id: str
    barcode_type: BarcodeType = BarcodeType.CODE128
    batch_number: Optional[str] = Field(None, max_length=50)
    expiry_date: Optional[datetime] = None
    template_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# Barcode update schema
class BarcodeUpdate(BaseModel):
    """Schema for updating barcode"""
    batch_number: Optional[str] = Field(None, max_length=50)
    expiry_date: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


# Barcode generation request
class BarcodeGenerateRequest(BaseModel):
    """Schema for barcode generation request"""
    product_id: str
    quantity: int = Field(1, ge=1, le=1000)
    barcode_type: BarcodeType = BarcodeType.CODE128
    template_id: Optional[str] = None
    batch_number: Optional[str] = Field(None, max_length=50)
    expiry_date: Optional[datetime] = None


# Barcode response schema
class BarcodeResponse(BarcodeBase):
    """Schema for barcode responses"""
    id: str
    template_id: Optional[str] = None
    is_active: bool
    is_printed: bool
    print_count: int
    scan_count: int
    last_scanned_at: Optional[datetime] = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Barcode with product response
class BarcodeWithProductResponse(BarcodeResponse):
    """Schema for barcode with product details"""
    product_name: str
    product_sku: str
    product_category: str


# Barcode scan log schema
class BarcodeScanLogBase(BaseModel):
    """Base schema for barcode scan log"""
    barcode_id: str
    scan_purpose: ScanPurpose
    scan_location: Optional[str] = Field(None, max_length=200)
    device_id: Optional[str] = Field(None, max_length=100)
    metadata: Optional[Dict[str, Any]] = None


class BarcodeScanLogCreate(BaseModel):
    """Schema for creating scan log"""
    barcode: str = Field(..., min_length=1, max_length=100)
    scan_purpose: ScanPurpose
    scan_location: Optional[str] = Field(None, max_length=200)
    device_id: Optional[str] = Field(None, max_length=100)
    metadata: Optional[Dict[str, Any]] = None


class BarcodeScanLogResponse(BarcodeScanLogBase):
    """Schema for scan log response"""
    id: str
    barcode_string: str
    product_id: str
    scanned_by: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Barcode template schema
class BarcodeTemplateBase(BaseModel):
    """Base schema for barcode template"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    barcode_type: BarcodeType
    label_size: LabelSize
    template_design: Dict[str, Any]
    printer_type: PrinterType = PrinterType.THERMAL
    is_default: bool = False


class BarcodeTemplateCreate(BarcodeTemplateBase):
    """Schema for creating barcode template"""
    pass


class BarcodeTemplateUpdate(BaseModel):
    """Schema for updating barcode template"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    template_design: Optional[Dict[str, Any]] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class BarcodeTemplateResponse(BarcodeTemplateBase):
    """Schema for barcode template response"""
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Barcode print job schema
class BarcodePrintJobCreate(BaseModel):
    """Schema for creating print job"""
    barcode_ids: List[str]
    template_id: str
    printer_id: Optional[str] = None
    copies: int = Field(1, ge=1, le=100)
    priority: int = Field(5, ge=1, le=10)


class BarcodePrintJobResponse(BaseModel):
    """Schema for print job response"""
    id: str
    barcode_ids: List[str]
    template_id: str
    printer_id: Optional[str] = None
    copies: int
    priority: int
    status: str
    error_message: Optional[str] = None
    created_by: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Barcode list response
class BarcodeListResponse(BaseModel):
    """Schema for barcode list responses"""
    barcodes: List[BarcodeResponse]
    total: int
    page: int
    size: int
    pages: int


# Scan history response
class ScanHistoryResponse(BaseModel):
    """Schema for scan history response"""
    scans: List[BarcodeScanLogResponse]
    total: int
    page: int
    size: int
    pages: int


# Barcode statistics
class BarcodeStatistics(BaseModel):
    """Schema for barcode statistics"""
    total_barcodes: int
    active_barcodes: int
    total_scans: int
    scans_by_purpose: Dict[str, int]
    most_scanned_products: List[Dict[str, Any]]
    recent_scans: int
    print_jobs_pending: int


# Barcode verification request
class BarcodeVerifyRequest(BaseModel):
    """Schema for barcode verification"""
    barcode: str = Field(..., min_length=1, max_length=100)
    scan_purpose: ScanPurpose = ScanPurpose.INVENTORY
    location: Optional[str] = None
    device_id: Optional[str] = None


# Barcode verification response
class BarcodeVerifyResponse(BaseModel):
    """Schema for barcode verification response"""
    valid: bool
    barcode_id: Optional[str] = None
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    is_expired: bool = False
    message: str


# Barcode deactivation request
class BarcodeDeactivateRequest(BaseModel):
    """Schema for barcode deactivation"""
    reason: str = Field(..., min_length=1, max_length=500)


# Batch operations
class BarcodeBatchOperation(BaseModel):
    """Schema for batch barcode operations"""
    barcode_ids: List[str]
    operation: str = Field(..., pattern="^(print|deactivate|export)$")
    parameters: Optional[Dict[str, Any]] = None


# Export request
class BarcodeExportRequest(BaseModel):
    """Schema for barcode export request"""
    format: str = Field("pdf", pattern="^(pdf|csv|excel)$")
    include_images: bool = True
    filters: Optional[Dict[str, Any]] = None


# Label design schema
class LabelDesignElement(BaseModel):
    """Schema for label design element"""
    type: str = Field(..., pattern="^(barcode|text|image|qrcode)$")
    x: float = Field(..., ge=0)
    y: float = Field(..., ge=0)
    width: Optional[float] = Field(None, gt=0)
    height: Optional[float] = Field(None, gt=0)
    content: Optional[str] = None
    font_size: Optional[int] = Field(None, gt=0)
    font_family: Optional[str] = None
    alignment: Optional[str] = Field(None, pattern="^(left|center|right)$")
    rotation: Optional[int] = Field(0, ge=0, lt=360)


class LabelDesign(BaseModel):
    """Schema for complete label design"""
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)
    unit: str = Field("mm", pattern="^(mm|cm|inch)$")
    elements: List[LabelDesignElement]
    margin: Optional[float] = Field(2, ge=0)
    background_color: Optional[str] = None