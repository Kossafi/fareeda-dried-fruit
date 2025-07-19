"""
Product model and related tables
"""
import enum
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Column, String, Text, Boolean, DECIMAL, Integer, 
    ForeignKey, DateTime, Enum
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, AuditMixin


class ProductStatus(str, enum.Enum):
    """Product status enumeration"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    DISCONTINUED = "discontinued"
    OUT_OF_STOCK = "out_of_stock"
    PENDING_APPROVAL = "pending_approval"


class UnitOfMeasure(str, enum.Enum):
    """Unit of measure enumeration"""
    GRAM = "gram"
    KILOGRAM = "kilogram"
    KHIT = "khit"  # Thai unit (16 grams)
    PIECE = "piece"
    BOX = "box"
    PACKAGE = "package"


class ProductCategory(BaseModel, AuditMixin):
    """Product category model"""
    
    __tablename__ = "product_categories"
    
    category_name = Column(String(200), nullable=False)
    category_code = Column(String(20), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    
    # Hierarchy
    parent_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"), nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    
    # SEO and Marketing
    seo_title = Column(String(255), nullable=True)
    seo_description = Column(Text, nullable=True)
    seo_keywords = Column(String(500), nullable=True)
    
    # Settings
    settings = Column(JSONB, nullable=True)
    
    # Relationships
    parent = relationship("ProductCategory", remote_side="ProductCategory.id")
    children = relationship("ProductCategory", back_populates="parent")
    products = relationship("Product", back_populates="category")
    
    @property
    def full_path(self) -> str:
        """Get full category path"""
        if self.parent:
            return f"{self.parent.full_path} > {self.category_name}"
        return self.category_name
    
    @property
    def product_count(self) -> int:
        """Get number of active products in category"""
        return len([p for p in self.products if p.is_active])
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return ["category_name", "category_code", "description"]


class Product(BaseModel, AuditMixin):
    """Product model"""
    
    __tablename__ = "products"
    
    # Basic Information
    product_name = Column(String(300), nullable=False)
    product_name_en = Column(String(300), nullable=True)
    product_code = Column(String(50), unique=True, nullable=False, index=True)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    barcode = Column(String(50), unique=True, nullable=True, index=True)
    
    # Category
    category_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"), nullable=False)
    
    # Description and Details
    description = Column(Text, nullable=True)
    description_en = Column(Text, nullable=True)
    short_description = Column(String(500), nullable=True)
    ingredients = Column(Text, nullable=True)
    allergen_info = Column(Text, nullable=True)
    
    # Pricing
    unit_price = Column(DECIMAL(10, 2), nullable=False)
    cost_price = Column(DECIMAL(10, 2), nullable=False)
    wholesale_price = Column(DECIMAL(10, 2), nullable=True)
    member_price = Column(DECIMAL(10, 2), nullable=True)
    
    # Physical Properties
    weight_per_unit = Column(DECIMAL(10, 3), nullable=False)  # Weight in grams
    unit_of_measure = Column(Enum(UnitOfMeasure), default=UnitOfMeasure.GRAM, nullable=False)
    net_weight = Column(DECIMAL(10, 3), nullable=True)
    gross_weight = Column(DECIMAL(10, 3), nullable=True)
    
    # Dimensions (in cm)
    length = Column(DECIMAL(8, 2), nullable=True)
    width = Column(DECIMAL(8, 2), nullable=True)
    height = Column(DECIMAL(8, 2), nullable=True)
    volume = Column(DECIMAL(10, 3), nullable=True)  # cubic cm
    
    # Inventory Management
    minimum_stock_level = Column(DECIMAL(10, 2), default=0, nullable=False)
    optimal_stock_level = Column(DECIMAL(10, 2), default=0, nullable=False)
    maximum_stock_level = Column(DECIMAL(10, 2), nullable=True)
    reorder_point = Column(DECIMAL(10, 2), nullable=True)
    reorder_quantity = Column(DECIMAL(10, 2), nullable=True)
    
    # Quality and Safety
    shelf_life_days = Column(Integer, nullable=True)
    storage_requirements = Column(JSONB, nullable=True)
    handling_instructions = Column(Text, nullable=True)
    quality_standards = Column(JSONB, nullable=True)
    
    # Nutritional Information
    nutritional_info = Column(JSONB, nullable=True)
    calories_per_100g = Column(DECIMAL(8, 2), nullable=True)
    
    # Status and Availability
    status = Column(Enum(ProductStatus), default=ProductStatus.ACTIVE, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    is_bestseller = Column(Boolean, default=False, nullable=False)
    is_new_arrival = Column(Boolean, default=False, nullable=False)
    is_organic = Column(Boolean, default=False, nullable=False)
    is_premium = Column(Boolean, default=False, nullable=False)
    
    # Marketing and Display
    images = Column(JSONB, nullable=True)  # Array of image URLs
    tags = Column(JSONB, nullable=True)  # Array of tags
    marketing_text = Column(Text, nullable=True)
    
    # SEO
    seo_title = Column(String(255), nullable=True)
    seo_description = Column(Text, nullable=True)
    seo_keywords = Column(String(500), nullable=True)
    
    # Sampling Configuration
    allow_sampling = Column(Boolean, default=True, nullable=False)
    sampling_cost_per_gram = Column(DECIMAL(8, 4), nullable=True)
    max_sample_weight = Column(DECIMAL(6, 3), default=30.0, nullable=False)  # grams
    
    # Origin and Sourcing
    origin_country = Column(String(100), nullable=True)
    origin_province = Column(String(100), nullable=True)
    supplier_info = Column(JSONB, nullable=True)
    
    # Certifications
    certifications = Column(JSONB, nullable=True)  # ["organic", "fair_trade", etc.]
    
    # Additional Attributes
    attributes = Column(JSONB, nullable=True)
    specifications = Column(JSONB, nullable=True)
    
    # Relationships
    category = relationship("ProductCategory", back_populates="products")
    inventory_stocks = relationship("InventoryStock", back_populates="product")
    sales_items = relationship("SaleItem", back_populates="product")
    
    @property
    def gross_margin(self) -> Decimal:
        """Calculate gross margin"""
        if self.unit_price > 0:
            return ((self.unit_price - self.cost_price) / self.unit_price) * 100
        return Decimal('0')
    
    @property
    def profit_per_unit(self) -> Decimal:
        """Calculate profit per unit"""
        return self.unit_price - self.cost_price
    
    @property
    def is_low_margin(self) -> bool:
        """Check if product has low margin (less than 20%)"""
        return self.gross_margin < 20
    
    @property
    def is_available(self) -> bool:
        """Check if product is available for sale"""
        return (
            self.is_active and 
            self.status == ProductStatus.ACTIVE
        )
    
    @property
    def display_name(self) -> str:
        """Get display name with fallback"""
        return self.product_name or self.product_code
    
    @property
    def main_image(self) -> Optional[str]:
        """Get main product image"""
        if self.images and len(self.images) > 0:
            return self.images[0]
        return None
    
    def get_price_for_customer_type(self, customer_type: str = "regular") -> Decimal:
        """Get price based on customer type"""
        price_map = {
            "regular": self.unit_price,
            "member": self.member_price or self.unit_price,
            "wholesale": self.wholesale_price or self.unit_price
        }
        return price_map.get(customer_type, self.unit_price)
    
    def calculate_volume(self) -> Optional[Decimal]:
        """Calculate volume from dimensions"""
        if self.length and self.width and self.height:
            return self.length * self.width * self.height
        return None
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return [
            "product_name", "product_name_en", "product_code", 
            "sku", "barcode", "description", "short_description"
        ]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "category_id", "status", "is_featured", "is_bestseller", 
            "is_new_arrival", "is_organic", "is_premium", "allow_sampling",
            "origin_country", "origin_province", "is_active", "created_at"
        ]


class ProductVariant(BaseModel, AuditMixin):
    """Product variant model for different sizes/weights"""
    
    __tablename__ = "product_variants"
    
    parent_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    variant_name = Column(String(200), nullable=False)
    variant_code = Column(String(50), unique=True, nullable=False)
    sku = Column(String(100), unique=True, nullable=False)
    barcode = Column(String(50), unique=True, nullable=True)
    
    # Variant-specific properties
    weight_per_unit = Column(DECIMAL(10, 3), nullable=False)
    unit_price = Column(DECIMAL(10, 2), nullable=False)
    cost_price = Column(DECIMAL(10, 2), nullable=False)
    
    # Inventory
    minimum_stock_level = Column(DECIMAL(10, 2), default=0, nullable=False)
    optimal_stock_level = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    parent_product = relationship("Product")
    
    @property
    def full_name(self) -> str:
        """Get full variant name"""
        return f"{self.parent_product.product_name} - {self.variant_name}"


class ProductReview(BaseModel):
    """Product review model"""
    
    __tablename__ = "product_reviews"
    
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    customer_name = Column(String(200), nullable=True)
    customer_email = Column(String(255), nullable=True)
    
    rating = Column(Integer, nullable=False)  # 1-5 stars
    title = Column(String(300), nullable=True)
    review_text = Column(Text, nullable=True)
    
    is_verified_purchase = Column(Boolean, default=False, nullable=False)
    is_approved = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    product = relationship("Product")
    user = relationship("User")
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return ["product_id", "rating", "is_verified_purchase", "is_approved", "created_at"]