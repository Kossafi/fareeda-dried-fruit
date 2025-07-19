"""
Analytics and reporting endpoints
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.crud_analytics import analytics_crud
from app.schemas.analytics import (
    SalesAnalytics, InventoryAnalytics, CustomerAnalytics, ShippingAnalytics,
    KPIDashboard, TrendAnalysis, DailyMetricsCreate, DailyMetricsResponse,
    ReportRequest, ReportGenerationResponse, ExportRequest, ExportResponse,
    AnalyticsFilters, PerformanceMetrics, BranchPerformance, PeriodComparison,
    ForecastData, SalesForecast, RealTimeMetrics, LiveDashboard
)
from app.models.user import User
from app.api.dependencies import (
    get_current_user, get_current_active_user,
    check_reporting_permission, check_admin_permission,
    get_pagination_params, get_date_range_params
)

router = APIRouter()


# KPI Dashboard
@router.get("/dashboard", response_model=KPIDashboard)
async def get_kpi_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_range: dict = Depends(get_date_range_params),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
) -> KPIDashboard:
    """
    Get KPI dashboard with key metrics
    """
    dashboard_data = analytics_crud.get_kpi_dashboard(
        db,
        date_from=date_range.get("date_from"),
        date_to=date_range.get("date_to"),
        branch_id=UUID(branch_id) if branch_id else None
    )
    
    return KPIDashboard(**dashboard_data)


# Sales Analytics
@router.get("/sales", response_model=SalesAnalytics)
async def get_sales_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_range: dict = Depends(get_date_range_params),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
) -> SalesAnalytics:
    """
    Get comprehensive sales analytics
    """
    sales_data = analytics_crud.get_sales_analytics(
        db,
        date_from=date_range.get("date_from"),
        date_to=date_range.get("date_to"),
        branch_id=UUID(branch_id) if branch_id else None
    )
    
    return SalesAnalytics(**sales_data)


# Inventory Analytics
@router.get("/inventory", response_model=InventoryAnalytics)
async def get_inventory_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
) -> InventoryAnalytics:
    """
    Get inventory analytics and alerts
    """
    inventory_data = analytics_crud.get_inventory_analytics(
        db,
        branch_id=UUID(branch_id) if branch_id else None
    )
    
    return InventoryAnalytics(**inventory_data)


# Customer Analytics
@router.get("/customers", response_model=CustomerAnalytics)
async def get_customer_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_range: dict = Depends(get_date_range_params)
) -> CustomerAnalytics:
    """
    Get customer analytics and insights
    """
    customer_data = analytics_crud.get_customer_analytics(
        db,
        date_from=date_range.get("date_from"),
        date_to=date_range.get("date_to")
    )
    
    return CustomerAnalytics(**customer_data)


# Shipping Analytics
@router.get("/shipping", response_model=ShippingAnalytics)
async def get_shipping_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_range: dict = Depends(get_date_range_params)
) -> ShippingAnalytics:
    """
    Get shipping and delivery analytics
    """
    shipping_data = analytics_crud.get_shipping_analytics(
        db,
        date_from=date_range.get("date_from"),
        date_to=date_range.get("date_to")
    )
    
    return ShippingAnalytics(**shipping_data)


# Trend Analysis
@router.get("/trends/{metric}", response_model=TrendAnalysis)
async def get_trend_analysis(
    metric: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period_days: int = Query(30, ge=7, le=365, description="Analysis period in days"),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
) -> TrendAnalysis:
    """
    Get trend analysis for a specific metric
    """
    if metric not in ["revenue", "transactions", "customers", "inventory_value"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid metric. Must be one of: revenue, transactions, customers, inventory_value"
        )
    
    trend_data = analytics_crud.get_trend_analysis(
        db,
        metric=metric,
        period_days=period_days,
        branch_id=UUID(branch_id) if branch_id else None
    )
    
    return TrendAnalysis(**trend_data)


# Daily Metrics
@router.get("/daily-metrics", response_model=List[DailyMetricsResponse])
async def get_daily_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_range: dict = Depends(get_date_range_params),
    branch_id: Optional[str] = Query(None, description="Filter by branch"),
    pagination: dict = Depends(get_pagination_params)
) -> List[DailyMetricsResponse]:
    """
    Get daily metrics history
    """
    filters = {}
    if branch_id:
        filters["branch_id"] = UUID(branch_id)
    
    if date_range.get("date_from"):
        filters["date__gte"] = date_range["date_from"].date()
    
    if date_range.get("date_to"):
        filters["date__lte"] = date_range["date_to"].date()
    
    daily_metrics = analytics_crud.get_multi(
        db,
        skip=pagination["skip"],
        limit=pagination["limit"],
        filters=filters
    )
    
    return [DailyMetricsResponse.from_orm(metric) for metric in daily_metrics]


@router.post("/daily-metrics", response_model=DailyMetricsResponse)
async def create_daily_metrics(
    target_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin_permission),
    branch_id: Optional[str] = Query(None, description="Branch to calculate metrics for")
) -> DailyMetricsResponse:
    """
    Create daily metrics snapshot for a specific date
    """
    metrics = analytics_crud.create_daily_metrics(
        db,
        date=target_date,
        branch_id=UUID(branch_id) if branch_id else None
    )
    
    return DailyMetricsResponse.from_orm(metrics)


# Performance Metrics
@router.get("/performance/branches", response_model=List[BranchPerformance])
async def get_branch_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(check_reporting_permission),
    date_range: dict = Depends(get_date_range_params),
    limit: int = Query(10, ge=1, le=100, description="Number of top branches")
) -> List[BranchPerformance]:
    """
    Get branch performance comparison
    """
    # This would need to be implemented in the CRUD
    # For now, return an empty list
    return []


@router.get("/performance/period-comparison", response_model=PeriodComparison)
async def get_period_comparison(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_start: datetime = Query(..., description="Current period start"),
    current_end: datetime = Query(..., description="Current period end"),
    previous_start: datetime = Query(..., description="Previous period start"),
    previous_end: datetime = Query(..., description="Previous period end"),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
) -> PeriodComparison:
    """
    Compare performance between two periods
    """
    # Get analytics for both periods
    current_data = analytics_crud.get_sales_analytics(
        db,
        date_from=current_start,
        date_to=current_end,
        branch_id=UUID(branch_id) if branch_id else None
    )
    
    previous_data = analytics_crud.get_sales_analytics(
        db,
        date_from=previous_start,
        date_to=previous_end,
        branch_id=UUID(branch_id) if branch_id else None
    )
    
    # Calculate comparison
    current_revenue = current_data["summary"]["total_revenue"]
    previous_revenue = previous_data["summary"]["total_revenue"]
    
    if previous_revenue > 0:
        growth_rate = ((current_revenue - previous_revenue) / previous_revenue) * 100
    else:
        growth_rate = 0
    
    trend = "increasing" if growth_rate > 0 else "decreasing" if growth_rate < 0 else "stable"
    
    return PeriodComparison(
        current_period=current_data["summary"],
        previous_period=previous_data["summary"],
        comparison={
            "revenue_change": current_revenue - previous_revenue,
            "transaction_change": current_data["summary"]["total_transactions"] - previous_data["summary"]["total_transactions"]
        },
        growth_rate=round(growth_rate, 2),
        trend=trend
    )


# Real-time Metrics
@router.get("/real-time", response_model=RealTimeMetrics)
async def get_real_time_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
) -> RealTimeMetrics:
    """
    Get real-time metrics for live dashboard
    """
    # Get today's sales
    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    sales_today = analytics_crud.get_sales_analytics(
        db,
        date_from=today_start,
        date_to=today_end,
        branch_id=UUID(branch_id) if branch_id else None
    )
    
    # Get inventory alerts
    inventory_data = analytics_crud.get_inventory_analytics(
        db,
        branch_id=UUID(branch_id) if branch_id else None
    )
    
    # Get active shipments
    shipping_data = analytics_crud.get_shipping_analytics(
        db,
        date_from=today_start,
        date_to=today_end
    )
    
    return RealTimeMetrics(
        timestamp=datetime.utcnow(),
        sales_today=sales_today["summary"],
        inventory_alerts={
            "low_stock": len(inventory_data["alerts"]["low_stock"]),
            "out_of_stock": len(inventory_data["alerts"]["out_of_stock"])
        },
        active_shipments={
            "total": shipping_data["summary"]["total_shipments"],
            "in_transit": shipping_data["status_breakdown"].get("in_transit", 0),
            "delivered": shipping_data["status_breakdown"].get("delivered", 0)
        },
        system_health={
            "status": "healthy",
            "uptime": "99.9%",
            "response_time": "120ms"
        }
    )


# Export Functions
@router.post("/export", response_model=ExportResponse)
async def export_analytics_data(
    export_request: ExportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_reporting_permission)
) -> ExportResponse:
    """
    Export analytics data to various formats
    """
    # Generate export ID
    from uuid import uuid4
    export_id = str(uuid4())
    
    # Add background task for export processing
    background_tasks.add_task(
        process_export_request,
        db=db,
        export_id=export_id,
        export_request=export_request,
        user_id=str(current_user.id)
    )
    
    return ExportResponse(
        export_id=export_id,
        status="processing",
        created_at=datetime.utcnow()
    )


@router.get("/export/{export_id}", response_model=ExportResponse)
async def get_export_status(
    export_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ExportResponse:
    """
    Get export status and download link
    """
    # This would need to be implemented with proper export tracking
    # For now, return a mock response
    return ExportResponse(
        export_id=export_id,
        status="completed",
        file_url=f"/downloads/export_{export_id}.csv",
        file_size=1024,
        created_at=datetime.utcnow()
    )


# Report Generation
@router.post("/reports/generate", response_model=ReportGenerationResponse)
async def generate_report(
    report_request: ReportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_reporting_permission)
) -> ReportGenerationResponse:
    """
    Generate comprehensive reports
    """
    from uuid import uuid4
    report_id = str(uuid4())
    
    # Add background task for report generation
    background_tasks.add_task(
        process_report_generation,
        db=db,
        report_id=report_id,
        report_request=report_request,
        user_id=str(current_user.id)
    )
    
    # Mock response - in production, this would create a database record
    return ReportGenerationResponse(
        id=report_id,
        report_type=report_request.report_type,
        parameters=report_request.dict(),
        status="pending",
        generated_by=str(current_user.id),
        created_at=datetime.utcnow()
    )


# Background task functions
async def process_export_request(
    db: Session,
    export_id: str,
    export_request: ExportRequest,
    user_id: str
):
    """
    Process export request in background
    """
    # Implementation would go here
    # This would:
    # 1. Query the requested data
    # 2. Format it according to the requested format
    # 3. Save to file storage
    # 4. Update export status in database
    pass


async def process_report_generation(
    db: Session,
    report_id: str,
    report_request: ReportRequest,
    user_id: str
):
    """
    Process report generation in background
    """
    # Implementation would go here
    # This would:
    # 1. Gather all required data
    # 2. Generate charts and visualizations
    # 3. Create PDF/Excel report
    # 4. Send email if requested
    # 5. Update report status in database
    pass