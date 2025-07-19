"""
Barcode and QR code models
"""
import enum
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Column, String, Text, Boolean, Integer, 
    ForeignKey, DateTime, Enum, LargeBinary
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, AuditMixin


class BarcodeType(str, enum.Enum):
    """Barcode type enumeration"""
    EAN13 = "ean13"
    EAN8 = "ean8"
    UPC = "upc"
    CODE128 = "code128"
    CODE39 = "code39"
    QR_CODE = "qr_code"
    DATA_MATRIX = "data_matrix"


class BarcodeStatus(str, enum.Enum):
    """Barcode status enumeration"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class Barcode(BaseModel, AuditMixin):
    """Barcode model for products and inventory tracking"""
    
    __tablename__ = "barcodes"
    
    # Barcode Details
    barcode_value = Column(String(100), unique=True, nullable=False, index=True)
    barcode_type = Column(Enum(BarcodeType), default=BarcodeType.EAN13, nullable=False)
    status = Column(Enum(BarcodeStatus), default=BarcodeStatus.ACTIVE, nullable=False)
    
    # Associated Entity
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id"), nullable=True)
    repack_id = Column(UUID(as_uuid=True), ForeignKey("repacks.id"), nullable=True)
    
    # Barcode Images
    image_path = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)
    thumbnail_path = Column(String(500), nullable=True)
    
    # Generation Information
    generated_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    generation_method = Column(String(50), default="automatic", nullable=False)  # automatic, manual
    
    # Print Information
    last_printed_at = Column(DateTime(timezone=True), nullable=True)
    print_count = Column(Integer, default=0, nullable=False)
    
    # Validity
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_primary = Column(Boolean, default=True, nullable=False)  # Primary barcode for product
    
    # Additional Data for QR Codes
    qr_data = Column(JSONB, nullable=True)  # Additional data encoded in QR
    qr_version = Column(Integer, nullable=True)  # QR code version
    
    # Batch Information
    batch_number = Column(String(100), nullable=True)
    batch_size = Column(Integer, nullable=True)
    
    # Verification
    checksum = Column(String(20), nullable=True)
    verification_code = Column(String(50), nullable=True)
    
    # Usage Statistics
    scan_count = Column(Integer, default=0, nullable=False)
    last_scanned_at = Column(DateTime(timezone=True), nullable=True)
    
    # Notes
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Relationships
    product = relationship("Product")
    variant = relationship("ProductVariant")
    repack = relationship("Repack")
    generated_by_user = relationship("User")
    scan_logs = relationship("BarcodeScanLog", back_populates="barcode")
    
    @property
    def is_expired(self) -> bool:
        """Check if barcode is expired"""
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False
    
    @property
    def is_valid(self) -> bool:
        """Check if barcode is valid for use"""
        return (
            self.status == BarcodeStatus.ACTIVE and
            self.is_active and
            not self.is_expired
        )
    
    @property
    def entity_name(self) -> Optional[str]:
        """Get name of associated entity"""
        if self.product:
            return self.product.product_name
        elif self.variant:
            return self.variant.full_name
        elif self.repack:
            return self.repack.repack_name
        return None
    
    def increment_scan_count(self):
        """Increment scan count and update last scanned time"""
        self.scan_count += 1
        self.last_scanned_at = datetime.utcnow()
    
    def increment_print_count(self):
        """Increment print count and update last printed time"""
        self.print_count += 1
        self.last_printed_at = datetime.utcnow()
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return ["barcode_value", "description", "batch_number"]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "barcode_type", "status", "product_id", "variant_id", 
            "repack_id", "is_primary", "generated_by", "created_at"
        ]


class BarcodeScanLog(BaseModel):
    """Log of barcode scans for tracking and analytics"""
    
    __tablename__ = "barcode_scan_logs"
    
    # References
    barcode_id = Column(UUID(as_uuid=True), ForeignKey("barcodes.id"), nullable=False)
    scanned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    
    # Scan Details
    scanned_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    scan_type = Column(String(50), nullable=False)  # sale, inventory, lookup, etc.
    scan_method = Column(String(50), nullable=False)  # camera, laser, manual
    
    # Device Information
    device_id = Column(String(100), nullable=True)
    device_type = Column(String(50), nullable=True)  # mobile, scanner, pos
    app_version = Column(String(20), nullable=True)
    
    # Location Information
    location = Column(String(100), nullable=True)
    coordinates = Column(JSONB, nullable=True)  # {"lat": x, "lng": y}
    
    # Context Information
    context_type = Column(String(50), nullable=True)  # sale_item, stock_check, etc.
    context_id = Column(UUID(as_uuid=True), nullable=True)
    context_data = Column(JSONB, nullable=True)
    
    # Scan Result
    scan_result = Column(String(50), default="success", nullable=False)
    error_message = Column(Text, nullable=True)
    
    # Additional Data
    metadata = Column(JSONB, nullable=True)
    
    # Relationships
    barcode = relationship("Barcode", back_populates="scan_logs")
    scanned_by_user = relationship("User")
    branch = relationship("Branch")
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "barcode_id", "scanned_by", "branch_id", "scan_type", 
            "scan_method", "scan_result", "scanned_at"
        ]


class BarcodeTemplate(BaseModel, AuditMixin):
    """Templates for barcode generation and printing"""
    
    __tablename__ = "barcode_templates"
    
    # Template Information
    template_name = Column(String(200), nullable=False)
    template_code = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    
    # Template Type
    template_type = Column(String(50), nullable=False)  # product, variant, repack, batch
    barcode_type = Column(Enum(BarcodeType), nullable=False)
    
    # Layout Configuration
    width = Column(Integer, nullable=False)  # in pixels or mm
    height = Column(Integer, nullable=False)
    dpi = Column(Integer, default=300, nullable=False)
    
    # Label Layout
    labels_per_row = Column(Integer, default=1, nullable=False)
    labels_per_column = Column(Integer, default=1, nullable=False)
    margin_top = Column(Integer, default=0, nullable=False)
    margin_bottom = Column(Integer, default=0, nullable=False)
    margin_left = Column(Integer, default=0, nullable=False)
    margin_right = Column(Integer, default=0, nullable=False)
    
    # Text Configuration
    include_text = Column(Boolean, default=True, nullable=False)
    font_name = Column(String(100), default="Arial", nullable=False)
    font_size = Column(Integer, default=10, nullable=False)
    text_position = Column(String(20), default="bottom", nullable=False)  # top, bottom, none
    
    # Content Configuration
    content_template = Column(Text, nullable=True)  # Template string with placeholders
    include_product_name = Column(Boolean, default=True, nullable=False)
    include_price = Column(Boolean, default=False, nullable=False)
    include_date = Column(Boolean, default=False, nullable=False)
    
    # Advanced Settings
    settings = Column(JSONB, nullable=True)
    
    # Usage
    is_default = Column(Boolean, default=False, nullable=False)
    usage_count = Column(Integer, default=0, nullable=False)
    
    @property
    def total_labels_per_sheet(self) -> int:
        """Calculate total labels per sheet"""
        return self.labels_per_row * self.labels_per_column
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return ["template_name", "template_code", "description"]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return ["template_type", "barcode_type", "is_default", "is_active"]


class BarcodePrintJob(BaseModel, AuditMixin):
    """Barcode printing job tracking"""
    
    __tablename__ = "barcode_print_jobs"
    
    # Job Information
    job_number = Column(String(50), unique=True, nullable=False)
    job_name = Column(String(200), nullable=False)
    
    # Template and Configuration
    template_id = Column(UUID(as_uuid=True), ForeignKey("barcode_templates.id"), nullable=False)
    printer_name = Column(String(100), nullable=True)
    
    # Print Details
    total_labels = Column(Integer, nullable=False)
    labels_printed = Column(Integer, default=0, nullable=False)
    copies_per_label = Column(Integer, default=1, nullable=False)
    
    # Items to Print
    print_items = Column(JSONB, nullable=False)  # Array of items with their quantities
    
    # Status
    status = Column(String(50), default="pending", nullable=False)  # pending, printing, completed, failed
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # User and Branch
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    
    # Error Handling
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    
    # Files
    output_file_path = Column(String(500), nullable=True)
    preview_file_path = Column(String(500), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Relationships
    template = relationship("BarcodeTemplate")
    requested_by_user = relationship("User")
    branch = relationship("Branch")
    
    @property
    def completion_percentage(self) -> float:
        """Calculate completion percentage"""
        if self.total_labels > 0:
            return (self.labels_printed / self.total_labels) * 100
        return 0.0
    
    @property
    def is_completed(self) -> bool:
        """Check if print job is completed"""
        return self.status == "completed"
    
    @property
    def duration_minutes(self) -> Optional[float]:
        """Get job duration in minutes"""
        if self.started_at and self.completed_at:
            duration = self.completed_at - self.started_at
            return duration.total_seconds() / 60
        return None
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "template_id", "status", "requested_by", "branch_id", 
            "started_at", "completed_at"
        ]