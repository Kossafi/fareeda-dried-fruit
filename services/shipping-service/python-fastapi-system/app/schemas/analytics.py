"""
Analytics schemas for API requests and responses
"""
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, Field

from app.models.analytics import ReportType, ReportStatus


# Daily metrics schemas
class DailyMetricsBase(BaseModel):
    """Base schema for daily metrics"""
    date: date
    branch_id: Optional[str] = None
    total_revenue: Decimal = Field(..., decimal_places=2)
    total_transactions: int = Field(..., ge=0)
    total_customers: int = Field(..., ge=0)
    inventory_value: Decimal = Field(..., decimal_places=2)
    low_stock_alerts: int = Field(..., ge=0)


class DailyMetricsCreate(DailyMetricsBase):
    """Schema for creating daily metrics"""
    pass


class DailyMetricsResponse(DailyMetricsBase):
    """Schema for daily metrics response"""
    id: str
    calculated_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


# Report generation schemas
class ReportGenerationBase(BaseModel):
    """Base schema for report generation"""
    report_type: ReportType
    parameters: Dict[str, Any]
    description: Optional[str] = None


class ReportGenerationCreate(ReportGenerationBase):
    """Schema for creating report generation"""
    pass


class ReportGenerationResponse(ReportGenerationBase):
    """Schema for report generation response"""
    id: str
    status: ReportStatus
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    error_message: Optional[str] = None
    generated_by: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Analytics response schemas
class SalesAnalytics(BaseModel):
    """Schema for sales analytics response"""
    summary: Dict[str, Any]
    daily_sales: List[Dict[str, Any]]
    top_products: List[Dict[str, Any]]
    payment_methods: Dict[str, Dict[str, Any]]


class InventoryAnalytics(BaseModel):
    """Schema for inventory analytics response"""
    summary: Dict[str, Any]
    alerts: Dict[str, List[Dict[str, Any]]]
    category_breakdown: Dict[str, Dict[str, Any]]
    movement_summary: Dict[str, Any]


class CustomerAnalytics(BaseModel):
    """Schema for customer analytics response"""
    summary: Dict[str, Any]
    tier_breakdown: Dict[str, int]
    top_customers: List[Dict[str, Any]]
    monthly_acquisition: List[Dict[str, Any]]


class ShippingAnalytics(BaseModel):
    """Schema for shipping analytics response"""
    summary: Dict[str, Any]
    status_breakdown: Dict[str, int]
    route_performance: List[Dict[str, Any]]


class KPIDashboard(BaseModel):
    """Schema for KPI dashboard response"""
    period: Dict[str, Any]
    sales: Dict[str, Any]
    inventory: Dict[str, Any]
    customers: Dict[str, Any]
    shipping: Dict[str, Any]


# Trend analysis schemas
class TrendAnalysis(BaseModel):
    """Schema for trend analysis response"""
    metric: str
    period_days: int
    data_points: int
    trend: str
    percentage_change: float
    values: List[float]
    dates: List[str]


# Report request schemas
class ReportRequest(BaseModel):
    """Schema for report request"""
    report_type: ReportType
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    branch_id: Optional[str] = None
    format: str = Field("pdf", pattern="^(pdf|excel|csv)$")
    include_charts: bool = True
    email_recipients: Optional[List[str]] = None


class ScheduledReportRequest(BaseModel):
    """Schema for scheduled report request"""
    report_type: ReportType
    schedule_pattern: str = Field(..., pattern="^(daily|weekly|monthly)$")
    parameters: Dict[str, Any]
    email_recipients: List[str]
    is_active: bool = True


# Dashboard widgets schemas
class DashboardWidget(BaseModel):
    """Schema for dashboard widget"""
    widget_type: str
    title: str
    data: Dict[str, Any]
    position: Dict[str, int]
    size: Dict[str, int]


class DashboardConfig(BaseModel):
    """Schema for dashboard configuration"""
    user_id: str
    widgets: List[DashboardWidget]
    layout: Dict[str, Any]
    refresh_interval: int = Field(300, ge=60, le=3600)  # 1 minute to 1 hour


# Performance metrics schemas
class PerformanceMetrics(BaseModel):
    """Schema for performance metrics"""
    metric_name: str
    current_value: float
    target_value: Optional[float] = None
    previous_value: Optional[float] = None
    trend: str
    status: str  # good, warning, critical
    unit: Optional[str] = None


class BranchPerformance(BaseModel):
    """Schema for branch performance"""
    branch_id: str
    branch_name: str
    metrics: List[PerformanceMetrics]
    ranking: int
    score: float


# Comparison schemas
class PeriodComparison(BaseModel):
    """Schema for period comparison"""
    current_period: Dict[str, Any]
    previous_period: Dict[str, Any]
    comparison: Dict[str, Any]
    growth_rate: float
    trend: str


class BranchComparison(BaseModel):
    """Schema for branch comparison"""
    branches: List[BranchPerformance]
    top_performer: str
    metrics_compared: List[str]


# Forecasting schemas
class ForecastData(BaseModel):
    """Schema for forecast data"""
    metric: str
    historical_data: List[Dict[str, Any]]
    forecast_data: List[Dict[str, Any]]
    confidence_interval: Dict[str, List[float]]
    accuracy_score: Optional[float] = None
    model_used: str


class SalesForecast(BaseModel):
    """Schema for sales forecast"""
    revenue_forecast: ForecastData
    transaction_forecast: ForecastData
    customer_forecast: ForecastData
    period: Dict[str, Any]


# Export schemas
class ExportRequest(BaseModel):
    """Schema for export request"""
    data_type: str = Field(..., pattern="^(sales|inventory|customers|shipping|analytics)$")
    format: str = Field(..., pattern="^(csv|excel|pdf|json)$")
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    filters: Optional[Dict[str, Any]] = None
    include_details: bool = True


class ExportResponse(BaseModel):
    """Schema for export response"""
    export_id: str
    status: str
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    expires_at: Optional[datetime] = None
    created_at: datetime


# Alert schemas
class AlertRule(BaseModel):
    """Schema for alert rule"""
    rule_name: str
    metric: str
    condition: str  # greater_than, less_than, equals, etc.
    threshold: float
    branch_id: Optional[str] = None
    notification_channels: List[str]
    is_active: bool = True


class AlertNotification(BaseModel):
    """Schema for alert notification"""
    id: str
    rule_name: str
    metric: str
    current_value: float
    threshold: float
    severity: str
    message: str
    triggered_at: datetime
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Audit schemas
class AuditLog(BaseModel):
    """Schema for audit log"""
    id: str
    user_id: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime
    
    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    """Schema for audit log response"""
    logs: List[AuditLog]
    total: int
    page: int
    size: int
    pages: int


# Search and filter schemas
class AnalyticsFilters(BaseModel):
    """Schema for analytics filters"""
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    branch_id: Optional[str] = None
    product_category: Optional[str] = None
    customer_tier: Optional[str] = None
    payment_method: Optional[str] = None
    region: Optional[str] = None


class ReportFilters(BaseModel):
    """Schema for report filters"""
    report_type: Optional[ReportType] = None
    status: Optional[ReportStatus] = None
    generated_by: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


# Real-time metrics schemas
class RealTimeMetrics(BaseModel):
    """Schema for real-time metrics"""
    timestamp: datetime
    sales_today: Dict[str, Any]
    inventory_alerts: Dict[str, Any]
    active_shipments: Dict[str, Any]
    system_health: Dict[str, Any]


class LiveDashboard(BaseModel):
    """Schema for live dashboard"""
    current_metrics: RealTimeMetrics
    recent_activities: List[Dict[str, Any]]
    alerts: List[AlertNotification]
    refresh_rate: int = 30  # seconds