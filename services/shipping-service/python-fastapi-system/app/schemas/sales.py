"""
Sales schemas for API requests and responses
"""
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, Field, validator, EmailStr

from app.models.sales import PaymentMethod, TransactionStatus, DiscountType, CustomerTier, CustomerStatus


# Customer schemas
class CustomerBase(BaseModel):
    """Base customer schema with common fields"""
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=10)
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    """Schema for creating new customer"""
    pass


class CustomerUpdate(BaseModel):
    """Schema for updating customer"""
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=10)
    tier: Optional[CustomerTier] = None
    status: Optional[CustomerStatus] = None
    notes: Optional[str] = None


class CustomerResponse(CustomerBase):
    """Schema for customer responses"""
    id: str
    customer_code: str
    full_name: str
    tier: CustomerTier
    status: CustomerStatus
    total_spent: Decimal
    total_orders: int
    loyalty_points: int
    points_redeemed: int
    last_purchase_date: Optional[datetime] = None
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


class CustomerListResponse(BaseModel):
    """Schema for customer list responses"""
    customers: List[CustomerResponse]
    total: int
    page: int
    size: int
    pages: int


class CustomerStatistics(BaseModel):
    """Schema for customer statistics"""
    total_customers: int
    active_customers: int
    customers_by_tier: Dict[str, int]
    new_customers_30_days: int
    recent_activity: int
    top_spenders: List[Dict[str, Any]]


# Sales transaction item schemas
class SalesTransactionItemBase(BaseModel):
    """Base schema for transaction items"""
    product_id: str
    quantity: Decimal = Field(..., gt=0, decimal_places=3)
    unit_price: Decimal = Field(..., gt=0, decimal_places=2)
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    notes: Optional[str] = None


class SalesTransactionItemCreate(SalesTransactionItemBase):
    """Schema for creating transaction item"""
    pass


class SalesTransactionItemResponse(SalesTransactionItemBase):
    """Schema for transaction item response"""
    id: str
    transaction_id: str
    total_price: Decimal
    created_at: datetime
    
    # Product details (populated from join)
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    
    class Config:
        from_attributes = True


# Sales transaction schemas
class SalesTransactionBase(BaseModel):
    """Base schema for sales transactions"""
    branch_id: str
    customer_id: Optional[str] = None
    payment_method: PaymentMethod
    discount_amount: Decimal = Field(Decimal('0'), ge=0, decimal_places=2)
    discount_type: Optional[DiscountType] = None
    tax_amount: Decimal = Field(Decimal('0'), ge=0, decimal_places=2)
    notes: Optional[str] = None


class SalesTransactionCreate(SalesTransactionBase):
    """Schema for creating sales transaction"""
    items: List[SalesTransactionItemCreate] = Field(..., min_items=1)
    
    @validator('items')
    def validate_items(cls, v):
        """Validate transaction items"""
        if not v:
            raise ValueError('Transaction must have at least one item')
        return v


class SalesTransactionUpdate(BaseModel):
    """Schema for updating sales transaction"""
    customer_id: Optional[str] = None
    payment_method: Optional[PaymentMethod] = None
    notes: Optional[str] = None
    status: Optional[TransactionStatus] = None


class SalesTransactionResponse(SalesTransactionBase):
    """Schema for sales transaction response"""
    id: str
    receipt_number: str
    cashier_id: str
    subtotal: Decimal
    total_amount: Decimal
    total_weight: Decimal
    status: TransactionStatus
    void_reason: Optional[str] = None
    voided_by: Optional[str] = None
    voided_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    # Related data
    items: List[SalesTransactionItemResponse] = []
    customer: Optional[CustomerResponse] = None
    cashier_name: Optional[str] = None
    branch_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class SalesTransactionListResponse(BaseModel):
    """Schema for sales transaction list responses"""
    transactions: List[SalesTransactionResponse]
    total: int
    page: int
    size: int
    pages: int


# Quick sale schemas
class QuickSaleItem(BaseModel):
    """Schema for quick sale item"""
    product_id: Optional[str] = None
    barcode: Optional[str] = None
    quantity: Decimal = Field(..., gt=0, decimal_places=3)
    unit_price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)


class QuickSaleRequest(BaseModel):
    """Schema for quick sale request"""
    branch_id: str
    customer_id: Optional[str] = None
    items: List[QuickSaleItem] = Field(..., min_items=1)
    payment_method: PaymentMethod
    discount_amount: Decimal = Field(Decimal('0'), ge=0, decimal_places=2)
    discount_type: Optional[DiscountType] = None
    tax_amount: Decimal = Field(Decimal('0'), ge=0, decimal_places=2)
    cash_received: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    notes: Optional[str] = None


class QuickSaleResponse(BaseModel):
    """Schema for quick sale response"""
    transaction: SalesTransactionResponse
    change_due: Optional[Decimal] = None
    receipt_data: Dict[str, Any]


# Void transaction schema
class VoidTransactionRequest(BaseModel):
    """Schema for void transaction request"""
    void_reason: str = Field(..., min_length=1, max_length=500)


# Sales summary schemas
class SalesSummary(BaseModel):
    """Schema for sales summary"""
    transaction_count: int
    total_revenue: Decimal
    subtotal: Decimal
    total_tax: Decimal
    total_discount: Decimal
    average_sale: Decimal
    payment_breakdown: List[Dict[str, Any]]


class TopSellingProduct(BaseModel):
    """Schema for top selling product"""
    product_id: str
    product_name: str
    product_sku: str
    total_sold: Decimal
    total_revenue: Decimal
    transaction_count: int


class HourlySales(BaseModel):
    """Schema for hourly sales data"""
    hour: int
    transaction_count: int
    total_amount: Decimal


class DailySales(BaseModel):
    """Schema for daily sales data"""
    date: date
    transaction_count: int
    total_amount: Decimal
    unique_customers: int


# Customer purchase history
class CustomerPurchaseHistory(BaseModel):
    """Schema for customer purchase history"""
    transactions: List[SalesTransactionResponse]
    statistics: Dict[str, Any]
    favorite_products: List[Dict[str, Any]]


# Loyalty point schemas
class LoyaltyPointTransaction(BaseModel):
    """Schema for loyalty point transaction"""
    customer_id: str
    points: int
    transaction_type: str  # earned, redeemed, expired
    description: str
    reference_id: Optional[str] = None


class RedeemPointsRequest(BaseModel):
    """Schema for redeem points request"""
    customer_id: str
    points_to_redeem: int = Field(..., gt=0)
    redemption_value: Decimal = Field(..., gt=0, decimal_places=2)
    notes: Optional[str] = None


# Receipt schemas
class ReceiptData(BaseModel):
    """Schema for receipt data"""
    receipt_number: str
    transaction_date: datetime
    branch_name: str
    cashier_name: str
    customer_name: Optional[str] = None
    items: List[Dict[str, Any]]
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    payment_method: str
    cash_received: Optional[Decimal] = None
    change_due: Optional[Decimal] = None
    loyalty_points_earned: Optional[int] = None
    loyalty_points_balance: Optional[int] = None


# Search and filter schemas
class SalesSearchFilters(BaseModel):
    """Schema for sales search filters"""
    receipt_number: Optional[str] = None
    customer_id: Optional[str] = None
    branch_id: Optional[str] = None
    cashier_id: Optional[str] = None
    status: Optional[TransactionStatus] = None
    payment_method: Optional[PaymentMethod] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None


class CustomerSearchFilters(BaseModel):
    """Schema for customer search filters"""
    search_query: Optional[str] = None
    tier: Optional[CustomerTier] = None
    status: Optional[CustomerStatus] = None
    city: Optional[str] = None
    has_purchases: Optional[bool] = None
    birthday_month: Optional[int] = Field(None, ge=1, le=12)


# Bulk operations
class BulkCustomerUpdate(BaseModel):
    """Schema for bulk customer update"""
    customer_ids: List[str]
    tier: Optional[CustomerTier] = None
    status: Optional[CustomerStatus] = None
    notes: Optional[str] = None


class MergeCustomersRequest(BaseModel):
    """Schema for merge customers request"""
    primary_customer_id: str
    duplicate_customer_id: str
    reason: str = Field(..., min_length=1)


# Export schemas
class SalesExportRequest(BaseModel):
    """Schema for sales export request"""
    format: str = Field("csv", pattern="^(csv|excel|pdf)$")
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    branch_id: Optional[str] = None
    include_items: bool = True
    include_customer_details: bool = True


class CustomerExportRequest(BaseModel):
    """Schema for customer export request"""
    format: str = Field("csv", pattern="^(csv|excel)$")
    include_inactive: bool = False
    tier: Optional[CustomerTier] = None
    city: Optional[str] = None