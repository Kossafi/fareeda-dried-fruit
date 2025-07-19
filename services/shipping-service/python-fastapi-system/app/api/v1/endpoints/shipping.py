"""
Shipping and delivery tracking endpoints
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.crud_shipping import shipping_crud
from app.schemas.shipping import (
    ShipmentCreate, ShipmentUpdate, ShipmentResponse, ShipmentListResponse,
    StatusUpdateRequest, BulkStatusUpdateRequest, RouteAssignmentRequest,
    TrackingResponse, ShipmentStatistics, DeliveryScheduleRoute,
    ShipmentSearchFilters, RouteOptimizationRequest, OptimizedRoute
)
from app.models.shipping import ShipmentStatus
from app.models.user import User
from app.api.dependencies import (
    get_current_user, get_current_active_user,
    check_delivery_permission, check_inventory_management_permission,
    get_pagination_params, get_date_range_params
)

router = APIRouter()


@router.get("/", response_model=ShipmentListResponse)
async def get_shipments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params),
    date_range: dict = Depends(get_date_range_params),
    tracking_number: Optional[str] = Query(None, description="Filter by tracking number"),
    from_branch_id: Optional[str] = Query(None, description="Filter by origin branch"),
    to_branch_id: Optional[str] = Query(None, description="Filter by destination branch"),
    status: Optional[ShipmentStatus] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    route_id: Optional[str] = Query(None, description="Filter by route")
) -> ShipmentListResponse:
    """
    Get all shipments with pagination and filters
    """
    # Handle single tracking number search
    if tracking_number:
        shipment = shipping_crud.get_by_tracking_number(db, tracking_number=tracking_number)
        shipments = [shipment] if shipment else []
        total = 1 if shipment else 0
    elif from_branch_id or to_branch_id:
        # Branch-based filtering
        branch_id = from_branch_id or to_branch_id
        shipments = shipping_crud.get_by_branch(
            db,
            branch_id=branch_id,
            status=status,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
        total = len(shipping_crud.get_by_branch(db, branch_id=branch_id, status=status, skip=0, limit=10000))
    elif route_id:
        # Route-based filtering
        shipments = shipping_crud.get_by_route(
            db,
            route_id=route_id,
            date_from=date_range.get("date_from"),
            date_to=date_range.get("date_to"),
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
        total = len(shipping_crud.get_by_route(
            db,
            route_id=route_id,
            date_from=date_range.get("date_from"),
            date_to=date_range.get("date_to"),
            skip=0,
            limit=10000
        ))
    else:
        # General filtering
        filters = {}
        if status:
            filters["status"] = status
        if priority:
            filters["priority"] = priority
        
        shipments = shipping_crud.get_multi(
            db,
            skip=pagination["skip"],
            limit=pagination["limit"],
            filters=filters
        )
        total = shipping_crud.count(db, filters=filters)
    
    # Add related data
    shipment_responses = []
    for shipment in shipments:
        response = ShipmentResponse.from_orm(shipment)
        
        # Add branch names
        if shipment.from_branch:
            response.from_branch_name = shipment.from_branch.branch_name
        if shipment.to_branch:
            response.to_branch_name = shipment.to_branch.branch_name
        
        # Add route info
        if shipment.route:
            response.route_name = shipment.route.route_name
            if shipment.route.driver:
                response.driver_name = shipment.route.driver.full_name
            if shipment.route.vehicle:
                response.vehicle_plate = shipment.route.vehicle.license_plate
        
        shipment_responses.append(response)
    
    return ShipmentListResponse(
        shipments=shipment_responses,
        total=total,
        page=pagination["page"],
        size=pagination["size"],
        pages=(total + pagination["size"] - 1) // pagination["size"]
    )


@router.get("/statistics", response_model=ShipmentStatistics)
async def get_shipment_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_range: dict = Depends(get_date_range_params),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
) -> ShipmentStatistics:
    """
    Get shipment statistics
    """
    stats = shipping_crud.get_shipment_statistics(
        db,
        date_from=date_range.get("date_from"),
        date_to=date_range.get("date_to"),
        branch_id=branch_id
    )
    
    return ShipmentStatistics(**stats)


@router.get("/overdue", response_model=List[ShipmentResponse])
async def get_overdue_shipments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params),
    hours_overdue: int = Query(24, ge=1, le=168, description="Hours overdue")
) -> List[ShipmentResponse]:
    """
    Get overdue shipments
    """
    shipments = shipping_crud.get_overdue_shipments(
        db,
        hours_overdue=hours_overdue,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    
    return [ShipmentResponse.from_orm(shipment) for shipment in shipments]


@router.get("/schedule", response_model=List[DeliveryScheduleRoute])
async def get_delivery_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    schedule_date: date = Query(..., description="Schedule date"),
    driver_id: Optional[str] = Query(None, description="Filter by driver"),
    route_id: Optional[str] = Query(None, description="Filter by route")
) -> List[DeliveryScheduleRoute]:
    """
    Get delivery schedule for a specific date
    """
    schedule_datetime = datetime.combine(schedule_date, datetime.min.time())
    
    schedule = shipping_crud.get_delivery_schedule(
        db,
        date=schedule_datetime,
        driver_id=driver_id,
        route_id=route_id
    )
    
    return [DeliveryScheduleRoute(**route) for route in schedule]


@router.get("/track/{tracking_number}", response_model=TrackingResponse)
async def track_shipment(
    tracking_number: str,
    db: Session = Depends(get_db)
) -> TrackingResponse:
    """
    Track shipment by tracking number (public endpoint)
    """
    tracking_info = shipping_crud.get_shipment_tracking(
        db,
        tracking_number=tracking_number
    )
    
    if not tracking_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shipment not found"
        )
    
    return TrackingResponse(
        shipment=ShipmentResponse.from_orm(tracking_info["shipment"]),
        current_location=tracking_info["current_location"],
        status_history=[
            {
                "status": h.new_status.value,
                "location": h.location,
                "notes": h.notes,
                "timestamp": h.created_at
            }
            for h in tracking_info["status_history"]
        ],
        estimated_delivery=tracking_info["estimated_delivery"],
        route_info=tracking_info["route_info"]
    )


@router.get("/{shipment_id}", response_model=ShipmentResponse)
async def get_shipment(
    shipment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ShipmentResponse:
    """
    Get shipment by ID
    """
    shipment = shipping_crud.get(db, id=shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shipment not found"
        )
    
    response = ShipmentResponse.from_orm(shipment)
    
    # Add related data
    if shipment.from_branch:
        response.from_branch_name = shipment.from_branch.branch_name
    if shipment.to_branch:
        response.to_branch_name = shipment.to_branch.branch_name
    if shipment.route:
        response.route_name = shipment.route.route_name
        if shipment.route.driver:
            response.driver_name = shipment.route.driver.full_name
        if shipment.route.vehicle:
            response.vehicle_plate = shipment.route.vehicle.license_plate
    
    return response


@router.post("/", response_model=ShipmentResponse)
async def create_shipment(
    shipment_in: ShipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_delivery_permission)
) -> ShipmentResponse:
    """
    Create new shipment
    """
    try:
        # Convert items to the format expected by create_shipment
        items = []
        for item in shipment_in.items:
            items.append({
                "product_id": item.product_id,
                "quantity": item.quantity,
                "weight": item.weight,
                "volume": item.volume or 0,
                "value": item.value or 0,
                "description": item.description,
                "handling_notes": item.handling_notes
            })
        
        # Create shipment
        shipment = shipping_crud.create_shipment(
            db,
            from_branch_id=shipment_in.from_branch_id,
            to_branch_id=shipment_in.to_branch_id,
            items=items,
            priority=shipment_in.priority,
            special_instructions=shipment_in.special_instructions,
            created_by=current_user.id
        )
        
        # Log shipment creation
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="shipment_created",
            resource="shipment",
            resource_id=str(shipment.id),
            details={
                "tracking_number": shipment.tracking_number,
                "from_branch": str(shipment.from_branch_id),
                "to_branch": str(shipment.to_branch_id),
                "item_count": len(items)
            }
        )
        
        return ShipmentResponse.from_orm(shipment)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{shipment_id}", response_model=ShipmentResponse)
async def update_shipment(
    shipment_id: str,
    shipment_in: ShipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_delivery_permission)
) -> ShipmentResponse:
    """
    Update shipment information
    """
    shipment = shipping_crud.get(db, id=shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shipment not found"
        )
    
    # Check if shipment can be updated
    if shipment.status in [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update delivered or cancelled shipment"
        )
    
    # Update shipment
    shipment = shipping_crud.update(db, db_obj=shipment, obj_in=shipment_in)
    
    # Log update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="shipment_updated",
        resource="shipment",
        resource_id=str(shipment.id),
        details={
            "tracking_number": shipment.tracking_number,
            "updates": shipment_in.dict(exclude_unset=True)
        }
    )
    
    return ShipmentResponse.from_orm(shipment)


@router.post("/{shipment_id}/status")
async def update_shipment_status(
    shipment_id: str,
    status_update: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_delivery_permission)
) -> Dict[str, Any]:
    """
    Update shipment status
    """
    try:
        shipment = shipping_crud.update_status(
            db,
            shipment_id=shipment_id,
            status=status_update.status,
            location=status_update.location,
            notes=status_update.notes,
            updated_by=current_user.id
        )
        
        # Log status update
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="shipment_status_updated",
            resource="shipment",
            resource_id=str(shipment.id),
            details={
                "tracking_number": shipment.tracking_number,
                "new_status": status_update.status.value,
                "location": status_update.location
            }
        )
        
        return {
            "message": "Status updated successfully",
            "shipment_id": str(shipment.id),
            "tracking_number": shipment.tracking_number,
            "new_status": status_update.status.value
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/bulk-status-update")
async def bulk_update_shipment_status(
    bulk_update: BulkStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_delivery_permission)
) -> Dict[str, Any]:
    """
    Bulk update shipment status
    """
    updated_shipments = shipping_crud.bulk_update_status(
        db,
        shipment_ids=bulk_update.shipment_ids,
        status=bulk_update.status,
        notes=bulk_update.notes,
        updated_by=current_user.id
    )
    
    # Log bulk update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="shipments_bulk_status_updated",
        details={
            "updated_count": len(updated_shipments),
            "new_status": bulk_update.status.value
        }
    )
    
    return {
        "message": f"Updated status for {len(updated_shipments)} shipments",
        "updated_count": len(updated_shipments),
        "new_status": bulk_update.status.value
    }


@router.post("/{shipment_id}/assign-route")
async def assign_shipment_to_route(
    shipment_id: str,
    route_assignment: RouteAssignmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_delivery_permission)
) -> Dict[str, Any]:
    """
    Assign shipment to delivery route
    """
    try:
        shipment = shipping_crud.assign_to_route(
            db,
            shipment_id=shipment_id,
            route_id=route_assignment.route_id,
            assigned_by=current_user.id
        )
        
        # Log assignment
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="shipment_assigned_to_route",
            resource="shipment",
            resource_id=str(shipment.id),
            details={
                "tracking_number": shipment.tracking_number,
                "route_id": str(route_assignment.route_id)
            }
        )
        
        return {
            "message": "Shipment assigned to route successfully",
            "shipment_id": str(shipment.id),
            "route_id": str(route_assignment.route_id)
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/bulk-assign-route")
async def bulk_assign_shipments_to_route(
    route_assignment: RouteAssignmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_delivery_permission)
) -> Dict[str, Any]:
    """
    Bulk assign shipments to delivery route
    """
    assigned_count = 0
    failed_assignments = []
    
    for shipment_id in route_assignment.shipment_ids:
        try:
            shipping_crud.assign_to_route(
                db,
                shipment_id=shipment_id,
                route_id=route_assignment.route_id,
                assigned_by=current_user.id
            )
            assigned_count += 1
        except ValueError as e:
            failed_assignments.append({
                "shipment_id": shipment_id,
                "error": str(e)
            })
    
    # Log bulk assignment
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="shipments_bulk_assigned_to_route",
        details={
            "assigned_count": assigned_count,
            "failed_count": len(failed_assignments),
            "route_id": str(route_assignment.route_id)
        }
    )
    
    return {
        "message": f"Assigned {assigned_count} shipments to route",
        "assigned_count": assigned_count,
        "failed_assignments": failed_assignments
    }


@router.post("/optimize-routes")
async def optimize_delivery_routes(
    optimization_request: RouteOptimizationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_delivery_permission)
) -> List[OptimizedRoute]:
    """
    Optimize delivery routes for a specific date
    """
    optimized_routes = shipping_crud.optimize_routes(
        db,
        date=optimization_request.date,
        max_shipments_per_route=optimization_request.max_shipments_per_route
    )
    
    # Convert to response format
    routes = []
    for route_data in optimized_routes:
        route = route_data["route"]
        shipments = route_data["shipments"]
        
        # Calculate totals
        total_weight = sum(s.total_weight for s in shipments)
        total_volume = sum(s.total_volume for s in shipments)
        
        routes.append(OptimizedRoute(
            route=route,
            shipments=shipments,
            total_weight=total_weight,
            total_volume=total_volume,
            estimated_duration=route.estimated_duration,
            optimization_score=85.0  # Simplified score
        ))
    
    # Log optimization
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="routes_optimized",
        details={
            "date": optimization_request.date.isoformat(),
            "optimized_routes": len(routes)
        }
    )
    
    return routes


@router.delete("/{shipment_id}")
async def cancel_shipment(
    shipment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_delivery_permission)
) -> Dict[str, Any]:
    """
    Cancel shipment
    """
    shipment = shipping_crud.get(db, id=shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shipment not found"
        )
    
    # Check if shipment can be cancelled
    if shipment.status in [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel delivered or already cancelled shipment"
        )
    
    # Update status to cancelled
    shipment = shipping_crud.update_status(
        db,
        shipment_id=shipment_id,
        status=ShipmentStatus.CANCELLED,
        notes="Cancelled by user",
        updated_by=current_user.id
    )
    
    # Log cancellation
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="shipment_cancelled",
        resource="shipment",
        resource_id=str(shipment.id),
        details={
            "tracking_number": shipment.tracking_number
        }
    )
    
    return {
        "message": "Shipment cancelled successfully",
        "shipment_id": str(shipment.id),
        "tracking_number": shipment.tracking_number
    }


# Helper function
async def log_user_activity(
    db: Session,
    user_id: str,
    action: str,
    resource: str = None,
    resource_id: str = None,
    details: dict = None
):
    """Log user activity"""
    # TODO: Implement user activity logging
    pass