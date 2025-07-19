"""
Product schemas for API requests and responses
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, Field, validator

from app.models.product import ProductCategory, ProductStatus, ProductUnit


# Base product schema
class ProductBase(BaseModel):
    """Base product schema with common fields"""
    product_name: str = Field(..., min_length=1, max_length=300)
    sku: str = Field(..., min_length=1, max_length=100)
    barcode: Optional[str] = Field(None, max_length=100)
    category: ProductCategory
    unit: ProductUnit = ProductUnit.KILOGRAM
    weight_per_unit: Decimal = Field(..., gt=0, decimal_places=3)
    unit_price: Decimal = Field(..., gt=0, decimal_places=2)
    cost_price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    description: Optional[str] = None
    brand: Optional[str] = Field(None, max_length=100)
    supplier_id: Optional[str] = None
    min_order_quantity: Optional[Decimal] = Field(None, gt=0)
    max_order_quantity: Optional[Decimal] = Field(None, gt=0)
    
    @validator('max_order_quantity')
    def validate_max_order(cls, v, values):
        """Validate max order quantity is greater than min"""
        if v and 'min_order_quantity' in values and values['min_order_quantity']:
            if v < values['min_order_quantity']:
                raise ValueError('Max order quantity must be greater than min order quantity')
        return v


# Product creation schema
class ProductCreate(ProductBase):
    """Schema for creating new products"""
    status: ProductStatus = ProductStatus.ACTIVE
    is_active: bool = True
    is_featured: bool = False
    is_organic: bool = False
    is_seasonal: bool = False
    nutritional_info: Optional[Dict[str, Any]] = None
    allergen_info: Optional[List[str]] = None
    storage_instructions: Optional[str] = None
    shelf_life_days: Optional[int] = Field(None, gt=0)
    country_of_origin: Optional[str] = Field(None, max_length=100)
    certifications: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    images: Optional[List[str]] = None


# Product update schema
class ProductUpdate(BaseModel):
    """Schema for updating products"""
    product_name: Optional[str] = Field(None, min_length=1, max_length=300)
    sku: Optional[str] = Field(None, min_length=1, max_length=100)
    barcode: Optional[str] = Field(None, max_length=100)
    category: Optional[ProductCategory] = None
    unit: Optional[ProductUnit] = None
    weight_per_unit: Optional[Decimal] = Field(None, gt=0, decimal_places=3)
    unit_price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    cost_price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    discounted_price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    description: Optional[str] = None
    brand: Optional[str] = Field(None, max_length=100)
    supplier_id: Optional[str] = None
    status: Optional[ProductStatus] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_organic: Optional[bool] = None
    is_seasonal: Optional[bool] = None
    min_order_quantity: Optional[Decimal] = Field(None, gt=0)
    max_order_quantity: Optional[Decimal] = Field(None, gt=0)
    nutritional_info: Optional[Dict[str, Any]] = None
    allergen_info: Optional[List[str]] = None
    storage_instructions: Optional[str] = None
    shelf_life_days: Optional[int] = Field(None, gt=0)
    country_of_origin: Optional[str] = Field(None, max_length=100)
    certifications: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    images: Optional[List[str]] = None


# Product variant schema
class ProductVariantBase(BaseModel):
    """Base schema for product variants"""
    variant_name: str = Field(..., min_length=1, max_length=100)
    sku_suffix: str = Field(..., min_length=1, max_length=20)
    weight: Optional[Decimal] = Field(None, gt=0, decimal_places=3)
    price_adjustment: Optional[Decimal] = Field(None, decimal_places=2)
    is_active: bool = True


class ProductVariantCreate(ProductVariantBase):
    """Schema for creating product variant"""
    product_id: str


class ProductVariantUpdate(BaseModel):
    """Schema for updating product variant"""
    variant_name: Optional[str] = Field(None, min_length=1, max_length=100)
    sku_suffix: Optional[str] = Field(None, min_length=1, max_length=20)
    weight: Optional[Decimal] = Field(None, gt=0, decimal_places=3)
    price_adjustment: Optional[Decimal] = Field(None, decimal_places=2)
    is_active: Optional[bool] = None


class ProductVariantResponse(ProductVariantBase):
    """Schema for product variant response"""
    id: str
    product_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Product review schema
class ProductReviewBase(BaseModel):
    """Base schema for product reviews"""
    rating: int = Field(..., ge=1, le=5)
    review_text: Optional[str] = None
    reviewer_name: Optional[str] = Field(None, max_length=100)


class ProductReviewCreate(ProductReviewBase):
    """Schema for creating product review"""
    product_id: str
    customer_id: Optional[str] = None


class ProductReviewResponse(ProductReviewBase):
    """Schema for product review response"""
    id: str
    product_id: str
    customer_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Product response schema
class ProductResponse(ProductBase):
    """Schema for product responses"""
    id: str
    status: ProductStatus
    is_active: bool
    is_featured: bool
    is_organic: bool
    is_seasonal: bool
    discounted_price: Optional[Decimal] = None
    discount_percentage: Optional[float] = None
    nutritional_info: Optional[Dict[str, Any]] = None
    allergen_info: Optional[List[str]] = None
    storage_instructions: Optional[str] = None
    shelf_life_days: Optional[int] = None
    country_of_origin: Optional[str] = None
    certifications: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    images: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    
    # Computed fields
    effective_price: Optional[Decimal] = None
    has_discount: bool = False
    in_stock: Optional[bool] = None
    stock_level: Optional[Decimal] = None
    
    @validator('effective_price', always=True)
    def compute_effective_price(cls, v, values):
        """Compute effective price (discounted or regular)"""
        if 'discounted_price' in values and values['discounted_price']:
            return values['discounted_price']
        return values.get('unit_price')
    
    @validator('has_discount', always=True)
    def compute_has_discount(cls, v, values):
        """Check if product has discount"""
        return bool(values.get('discounted_price'))
    
    class Config:
        from_attributes = True


# Product with variants response
class ProductWithVariantsResponse(ProductResponse):
    """Schema for product with variants"""
    variants: List[ProductVariantResponse] = []


# Product with reviews response
class ProductWithReviewsResponse(ProductResponse):
    """Schema for product with reviews"""
    reviews: List[ProductReviewResponse] = []
    average_rating: Optional[float] = None
    review_count: int = 0


# Product list response schema
class ProductListResponse(BaseModel):
    """Schema for product list responses"""
    products: List[ProductResponse]
    total: int
    page: int
    size: int
    pages: int


# Product statistics schema
class ProductStatistics(BaseModel):
    """Schema for product statistics"""
    product: ProductResponse
    inventory: Dict[str, Any]
    sales_30_days: Dict[str, Any]
    ratings: Dict[str, Any]


# Low stock product schema
class LowStockProduct(BaseModel):
    """Schema for low stock products"""
    product: ProductResponse
    stock_level: Decimal
    reorder_point: Decimal
    shortage: Decimal
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None


# Bestseller product schema
class BestsellerProduct(BaseModel):
    """Schema for bestseller products"""
    product: ProductResponse
    total_sold: Decimal
    total_revenue: Decimal
    period_days: int


# Expiring product schema
class ExpiringProduct(BaseModel):
    """Schema for expiring products"""
    product: ProductResponse
    expiry_date: datetime
    days_until_expiry: int
    quantity: Decimal
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None


# Price update schema
class PriceUpdateRequest(BaseModel):
    """Schema for price update request"""
    new_price: Decimal = Field(..., gt=0, decimal_places=2)
    update_variants: bool = True


# Discount application schema
class DiscountRequest(BaseModel):
    """Schema for discount request"""
    discount_percentage: float = Field(..., gt=0, le=100)


# Bulk status update schema
class BulkStatusUpdateRequest(BaseModel):
    """Schema for bulk status update"""
    product_ids: List[str]
    status: ProductStatus


# Product search filters
class ProductSearchFilters(BaseModel):
    """Schema for product search filters"""
    search_query: Optional[str] = None
    category: Optional[ProductCategory] = None
    status: Optional[ProductStatus] = None
    min_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None
    in_stock_only: bool = False
    is_featured: Optional[bool] = None
    is_organic: Optional[bool] = None
    tags: Optional[List[str]] = None