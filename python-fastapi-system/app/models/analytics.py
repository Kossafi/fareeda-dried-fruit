"""
Analytics and reporting models for business intelligence
"""
import enum
from decimal import Decimal
from datetime import datetime, date
from typing import List, Optional

from sqlalchemy import (
    Column, String, Text, Boolean, DECIMAL, Integer, 
    ForeignKey, DateTime, Date, Enum, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, AuditMixin


class ReportType(str, enum.Enum):
    """Report type enumeration"""
    SALES_SUMMARY = "sales_summary"
    INVENTORY_REPORT = "inventory_report"
    PRODUCT_PERFORMANCE = "product_performance"
    BRANCH_PERFORMANCE = "branch_performance"
    SUPPLIER_PERFORMANCE = "supplier_performance"
    SAMPLING_ANALYSIS = "sampling_analysis"
    PROCUREMENT_ANALYSIS = "procurement_analysis"
    FINANCIAL_SUMMARY = "financial_summary"
    CUSTOMER_ANALYSIS = "customer_analysis"
    TREND_ANALYSIS = "trend_analysis"


class ReportStatus(str, enum.Enum):
    """Report status enumeration"""
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class DailySales(BaseModel):
    """Daily sales summary for fast reporting"""
    
    __tablename__ = "daily_sales"
    
    # Date and Branch
    sales_date = Column(Date, nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    
    # Sales Metrics
    total_transactions = Column(Integer, default=0, nullable=False)
    total_customers = Column(Integer, default=0, nullable=False)
    total_items_sold = Column(Integer, default=0, nullable=False)
    total_quantity_sold = Column(DECIMAL(15, 3), default=0, nullable=False)
    
    # Revenue Metrics
    gross_revenue = Column(DECIMAL(15, 2), default=0, nullable=False)
    total_discounts = Column(DECIMAL(12, 2), default=0, nullable=False)
    net_revenue = Column(DECIMAL(15, 2), default=0, nullable=False)
    tax_amount = Column(DECIMAL(12, 2), default=0, nullable=False)
    
    # Cost and Profit
    total_cost = Column(DECIMAL(15, 2), default=0, nullable=False)
    gross_profit = Column(DECIMAL(15, 2), default=0, nullable=False)
    gross_margin_percentage = Column(DECIMAL(5, 2), default=0, nullable=False)
    
    # Average Metrics
    average_transaction_value = Column(DECIMAL(10, 2), default=0, nullable=False)
    average_items_per_transaction = Column(DECIMAL(6, 2), default=0, nullable=False)
    average_customer_value = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Payment Methods
    cash_sales = Column(DECIMAL(12, 2), default=0, nullable=False)
    card_sales = Column(DECIMAL(12, 2), default=0, nullable=False)
    mobile_payment_sales = Column(DECIMAL(12, 2), default=0, nullable=False)
    
    # Customer Types
    walk_in_sales = Column(DECIMAL(12, 2), default=0, nullable=False)
    member_sales = Column(DECIMAL(12, 2), default=0, nullable=False)
    vip_sales = Column(DECIMAL(12, 2), default=0, nullable=False)
    
    # Operational Metrics
    peak_hour_sales = Column(DECIMAL(12, 2), default=0, nullable=False)
    peak_hour = Column(String(5), nullable=True)  # "14:00"
    staff_count = Column(Integer, default=1, nullable=False)
    sales_per_staff = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Relationships
    branch = relationship("Branch")
    
    def calculate_metrics(self):
        """Calculate derived metrics"""
        if self.total_transactions > 0:
            self.average_transaction_value = self.net_revenue / self.total_transactions
            self.average_items_per_transaction = Decimal(self.total_items_sold) / self.total_transactions
        
        if self.total_customers > 0:
            self.average_customer_value = self.net_revenue / self.total_customers
        
        if self.net_revenue > 0:
            self.gross_margin_percentage = (self.gross_profit / self.net_revenue) * 100
        
        if self.staff_count > 0:
            self.sales_per_staff = self.net_revenue / self.staff_count
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return ["sales_date", "branch_id"]


class ProductPerformance(BaseModel):
    """Daily product performance metrics"""
    
    __tablename__ = "product_performance"
    
    # Date and Product
    performance_date = Column(Date, nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    
    # Sales Metrics
    quantity_sold = Column(DECIMAL(12, 3), default=0, nullable=False)
    number_of_sales = Column(Integer, default=0, nullable=False)
    total_revenue = Column(DECIMAL(12, 2), default=0, nullable=False)
    total_cost = Column(DECIMAL(12, 2), default=0, nullable=False)
    gross_profit = Column(DECIMAL(12, 2), default=0, nullable=False)
    
    # Inventory Metrics
    opening_stock = Column(DECIMAL(12, 3), default=0, nullable=False)
    closing_stock = Column(DECIMAL(12, 3), default=0, nullable=False)
    stock_movement = Column(DECIMAL(12, 3), default=0, nullable=False)
    
    # Performance Indicators
    inventory_turnover = Column(DECIMAL(8, 4), default=0, nullable=False)
    days_of_stock = Column(Integer, nullable=True)
    stockout_duration_hours = Column(Integer, default=0, nullable=False)
    
    # Sampling Metrics
    sampling_weight = Column(DECIMAL(8, 3), default=0, nullable=False)
    sampling_cost = Column(DECIMAL(8, 2), default=0, nullable=False)
    sampling_conversions = Column(Integer, default=0, nullable=False)
    sampling_roi = Column(DECIMAL(8, 2), default=0, nullable=False)
    
    # Ranking
    sales_rank = Column(Integer, nullable=True)
    profit_rank = Column(Integer, nullable=True)
    velocity_rank = Column(Integer, nullable=True)
    
    # Relationships
    product = relationship("Product")
    branch = relationship("Branch")
    
    def calculate_inventory_turnover(self):
        """Calculate inventory turnover"""
        if self.opening_stock > 0:
            average_stock = (self.opening_stock + self.closing_stock) / 2
            if average_stock > 0:
                self.inventory_turnover = self.quantity_sold / average_stock
    
    def calculate_days_of_stock(self):
        """Calculate days of stock remaining"""
        if self.quantity_sold > 0:
            daily_velocity = self.quantity_sold  # Already daily
            if daily_velocity > 0:
                self.days_of_stock = int(self.closing_stock / daily_velocity)
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return ["performance_date", "product_id", "branch_id"]


class BranchPerformance(BaseModel):
    """Daily branch performance metrics"""
    
    __tablename__ = "branch_performance"
    
    # Date and Branch
    performance_date = Column(Date, nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    
    # Sales Performance
    total_revenue = Column(DECIMAL(15, 2), default=0, nullable=False)
    total_transactions = Column(Integer, default=0, nullable=False)
    total_customers = Column(Integer, default=0, nullable=False)
    average_transaction_value = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Profitability
    gross_profit = Column(DECIMAL(15, 2), default=0, nullable=False)
    gross_margin_percentage = Column(DECIMAL(5, 2), default=0, nullable=False)
    operational_costs = Column(DECIMAL(12, 2), default=0, nullable=False)
    net_profit = Column(DECIMAL(15, 2), default=0, nullable=False)
    
    # Inventory Performance
    inventory_turnover = Column(DECIMAL(8, 4), default=0, nullable=False)
    stockout_incidents = Column(Integer, default=0, nullable=False)
    low_stock_alerts = Column(Integer, default=0, nullable=False)
    inventory_value = Column(DECIMAL(15, 2), default=0, nullable=False)
    
    # Sampling Performance
    sampling_sessions = Column(Integer, default=0, nullable=False)
    sampling_cost = Column(DECIMAL(10, 2), default=0, nullable=False)
    sampling_conversions = Column(Integer, default=0, nullable=False)
    sampling_roi = Column(DECIMAL(8, 2), default=0, nullable=False)
    
    # Operational Efficiency
    staff_count = Column(Integer, default=1, nullable=False)
    revenue_per_staff = Column(DECIMAL(10, 2), default=0, nullable=False)
    transactions_per_staff = Column(DECIMAL(8, 2), default=0, nullable=False)
    
    # Customer Metrics
    new_customers = Column(Integer, default=0, nullable=False)
    returning_customers = Column(Integer, default=0, nullable=False)
    customer_retention_rate = Column(DECIMAL(5, 2), default=0, nullable=False)
    
    # Delivery Performance
    delivery_orders = Column(Integer, default=0, nullable=False)
    delivery_success_rate = Column(DECIMAL(5, 2), default=100, nullable=False)
    average_delivery_time = Column(Integer, nullable=True)  # minutes
    
    # Ranking Among Branches
    revenue_rank = Column(Integer, nullable=True)
    profit_rank = Column(Integer, nullable=True)
    efficiency_rank = Column(Integer, nullable=True)
    
    # Relationships
    branch = relationship("Branch")
    
    def calculate_efficiency_metrics(self):
        """Calculate staff efficiency metrics"""
        if self.staff_count > 0:
            self.revenue_per_staff = self.total_revenue / self.staff_count
            self.transactions_per_staff = Decimal(self.total_transactions) / self.staff_count
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return ["performance_date", "branch_id"]


class SupplierPerformance(BaseModel):
    """Monthly supplier performance metrics"""
    
    __tablename__ = "supplier_performance"
    
    # Date and Supplier
    performance_month = Column(Date, nullable=False)  # First day of month
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    
    # Order Metrics
    total_orders = Column(Integer, default=0, nullable=False)
    total_order_value = Column(DECIMAL(15, 2), default=0, nullable=False)
    average_order_value = Column(DECIMAL(12, 2), default=0, nullable=False)
    
    # Delivery Performance
    orders_delivered_on_time = Column(Integer, default=0, nullable=False)
    orders_delivered_late = Column(Integer, default=0, nullable=False)
    on_time_delivery_rate = Column(DECIMAL(5, 2), default=0, nullable=False)
    average_delivery_delay_days = Column(DECIMAL(6, 2), default=0, nullable=False)
    
    # Quality Performance
    orders_accepted = Column(Integer, default=0, nullable=False)
    orders_rejected = Column(Integer, default=0, nullable=False)
    quality_acceptance_rate = Column(DECIMAL(5, 2), default=0, nullable=False)
    defect_rate = Column(DECIMAL(5, 2), default=0, nullable=False)
    
    # Financial Performance
    total_amount_paid = Column(DECIMAL(15, 2), default=0, nullable=False)
    payment_disputes = Column(Integer, default=0, nullable=False)
    price_competitiveness_score = Column(DECIMAL(3, 2), default=0, nullable=False)
    
    # Communication and Service
    response_time_hours = Column(DECIMAL(6, 2), default=0, nullable=False)
    communication_rating = Column(DECIMAL(3, 2), default=0, nullable=False)
    service_rating = Column(DECIMAL(3, 2), default=0, nullable=False)
    
    # Overall Performance
    overall_performance_score = Column(DECIMAL(4, 2), default=0, nullable=False)
    performance_grade = Column(String(2), nullable=True)  # A+, A, B+, B, C+, C, D, F
    
    # Recommendations
    risk_level = Column(String(20), default="low", nullable=False)
    recommended_action = Column(String(100), nullable=True)
    
    # Relationships
    supplier = relationship("Supplier")
    
    def calculate_overall_score(self):
        """Calculate overall performance score"""
        weights = {
            'delivery': 0.3,
            'quality': 0.3,
            'price': 0.2,
            'service': 0.2
        }
        
        delivery_score = float(self.on_time_delivery_rate) / 20  # Convert % to 5-point scale
        quality_score = float(self.quality_acceptance_rate) / 20
        price_score = float(self.price_competitiveness_score)
        service_score = float(self.service_rating)
        
        self.overall_performance_score = (
            delivery_score * weights['delivery'] +
            quality_score * weights['quality'] +
            price_score * weights['price'] +
            service_score * weights['service']
        )
        
        # Assign performance grade
        if self.overall_performance_score >= 4.5:
            self.performance_grade = "A+"
        elif self.overall_performance_score >= 4.0:
            self.performance_grade = "A"
        elif self.overall_performance_score >= 3.5:
            self.performance_grade = "B+"
        elif self.overall_performance_score >= 3.0:
            self.performance_grade = "B"
        elif self.overall_performance_score >= 2.5:
            self.performance_grade = "C+"
        elif self.overall_performance_score >= 2.0:
            self.performance_grade = "C"
        elif self.overall_performance_score >= 1.0:
            self.performance_grade = "D"
        else:
            self.performance_grade = "F"
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return ["performance_month", "supplier_id", "performance_grade"]


class ReportGeneration(BaseModel, AuditMixin):
    """Report generation tracking"""
    
    __tablename__ = "report_generations"
    
    # Report Information
    report_id = Column(String(50), unique=True, nullable=False, index=True)
    report_type = Column(Enum(ReportType), nullable=False)
    report_name = Column(String(300), nullable=False)
    
    # Parameters
    date_from = Column(Date, nullable=False)
    date_to = Column(Date, nullable=False)
    branch_ids = Column(JSONB, nullable=True)  # Array of branch IDs
    product_ids = Column(JSONB, nullable=True)  # Array of product IDs
    filters = Column(JSONB, nullable=True)  # Additional filters
    
    # Generation Status
    status = Column(Enum(ReportStatus), default=ReportStatus.GENERATING, nullable=False)
    
    # Timing
    generation_started_at = Column(DateTime(timezone=True), nullable=False)
    generation_completed_at = Column(DateTime(timezone=True), nullable=True)
    generation_duration_seconds = Column(Integer, nullable=True)
    
    # Generated By
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Results
    record_count = Column(Integer, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    file_path = Column(String(500), nullable=True)
    file_format = Column(String(20), nullable=True)  # pdf, excel, csv
    
    # Cache Information
    cache_key = Column(String(200), nullable=True)
    cache_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Error Handling
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    
    # Access Control
    is_public = Column(Boolean, default=False, nullable=False)
    authorized_users = Column(JSONB, nullable=True)  # Array of user IDs
    
    # Report Data (for small reports)
    report_data = Column(JSONB, nullable=True)
    
    # Relationships
    generated_by_user = relationship("User")
    
    def calculate_generation_time(self):
        """Calculate generation duration"""
        if self.generation_completed_at and self.generation_started_at:
            duration = self.generation_completed_at - self.generation_started_at
            self.generation_duration_seconds = int(duration.total_seconds())
    
    @property
    def is_completed(self) -> bool:
        """Check if report generation is completed"""
        return self.status == ReportStatus.COMPLETED
    
    @property
    def is_expired(self) -> bool:
        """Check if cached report is expired"""
        if self.cache_expires_at:
            return datetime.utcnow() > self.cache_expires_at
        return False
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return ["report_id", "report_name"]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "report_type", "status", "generated_by", "date_from", 
            "date_to", "is_public", "generation_started_at"
        ]


class KPIMetrics(BaseModel):
    """Key Performance Indicators for dashboard"""
    
    __tablename__ = "kpi_metrics"
    
    # Time Period
    metric_date = Column(Date, nullable=False)
    metric_period = Column(String(20), nullable=False)  # daily, weekly, monthly
    
    # Scope
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    category = Column(String(50), nullable=False)  # sales, inventory, customers, operations
    
    # KPI Values
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(DECIMAL(15, 4), nullable=False)
    metric_unit = Column(String(20), nullable=True)  # currency, percentage, count
    
    # Targets and Comparisons
    target_value = Column(DECIMAL(15, 4), nullable=True)
    previous_value = Column(DECIMAL(15, 4), nullable=True)
    year_over_year_value = Column(DECIMAL(15, 4), nullable=True)
    
    # Performance Indicators
    vs_target_percentage = Column(DECIMAL(8, 2), nullable=True)
    vs_previous_percentage = Column(DECIMAL(8, 2), nullable=True)
    vs_yoy_percentage = Column(DECIMAL(8, 2), nullable=True)
    
    # Trend Information
    trend_direction = Column(String(10), nullable=True)  # up, down, stable
    trend_strength = Column(String(20), nullable=True)  # strong, moderate, weak
    
    # Relationships
    branch = relationship("Branch")
    
    def calculate_comparisons(self):
        """Calculate comparison percentages"""
        if self.target_value and self.target_value > 0:
            self.vs_target_percentage = ((self.metric_value - self.target_value) / self.target_value) * 100
        
        if self.previous_value and self.previous_value > 0:
            self.vs_previous_percentage = ((self.metric_value - self.previous_value) / self.previous_value) * 100
        
        if self.year_over_year_value and self.year_over_year_value > 0:
            self.vs_yoy_percentage = ((self.metric_value - self.year_over_year_value) / self.year_over_year_value) * 100
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return ["metric_date", "metric_period", "branch_id", "category", "metric_name"]


class CustomerAnalytics(BaseModel):
    """Customer behavior analytics"""
    
    __tablename__ = "customer_analytics"
    
    # Time Period
    analytics_date = Column(Date, nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    
    # Customer Metrics
    total_customers = Column(Integer, default=0, nullable=False)
    new_customers = Column(Integer, default=0, nullable=False)
    returning_customers = Column(Integer, default=0, nullable=False)
    
    # Segmentation
    walk_in_customers = Column(Integer, default=0, nullable=False)
    member_customers = Column(Integer, default=0, nullable=False)
    vip_customers = Column(Integer, default=0, nullable=False)
    
    # Behavior Metrics
    average_purchase_value = Column(DECIMAL(10, 2), default=0, nullable=False)
    average_items_per_purchase = Column(DECIMAL(6, 2), default=0, nullable=False)
    repeat_purchase_rate = Column(DECIMAL(5, 2), default=0, nullable=False)
    
    # Loyalty Metrics
    customer_lifetime_value = Column(DECIMAL(12, 2), default=0, nullable=False)
    customer_acquisition_cost = Column(DECIMAL(8, 2), default=0, nullable=False)
    churn_rate = Column(DECIMAL(5, 2), default=0, nullable=False)
    
    # Preferences
    top_product_categories = Column(JSONB, nullable=True)  # Array of category preferences
    peak_shopping_hours = Column(JSONB, nullable=True)  # Array of peak hours
    preferred_payment_methods = Column(JSONB, nullable=True)
    
    # Relationships
    branch = relationship("Branch")
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return ["analytics_date", "branch_id"]


# Add indexes for performance
Index('idx_daily_sales_date_branch', DailySales.sales_date, DailySales.branch_id, unique=True)
Index('idx_product_performance_date_product', ProductPerformance.performance_date, ProductPerformance.product_id)
Index('idx_branch_performance_date_branch', BranchPerformance.performance_date, BranchPerformance.branch_id, unique=True)
Index('idx_supplier_performance_month_supplier', SupplierPerformance.performance_month, SupplierPerformance.supplier_id, unique=True)
Index('idx_report_generation_type_status', ReportGeneration.report_type, ReportGeneration.status)
Index('idx_kpi_metrics_date_category', KPIMetrics.metric_date, KPIMetrics.category)
Index('idx_customer_analytics_date_branch', CustomerAnalytics.analytics_date, CustomerAnalytics.branch_id)