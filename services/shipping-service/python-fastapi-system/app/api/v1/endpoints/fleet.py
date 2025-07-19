"""
Fleet management endpoints for vehicles, drivers, and routes
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.crud_fleet import vehicle_crud, driver_crud, delivery_route_crud
from app.schemas.shipping import (
    VehicleCreate, VehicleUpdate, VehicleResponse,
    DriverCreate, DriverUpdate, DriverResponse,
    DeliveryRouteCreate, DeliveryRouteUpdate, DeliveryRouteResponse,
    VehicleMaintenanceCreate, VehicleMaintenanceRecord,
    DriverPerformance
)
from app.models.shipping import VehicleStatus, DriverStatus, VehicleType
from app.models.user import User
from app.api.dependencies import (
    get_current_user, get_current_active_user,
    check_delivery_permission, check_user_management_permission,
    get_pagination_params, get_date_range_params
)

router = APIRouter()


# Vehicle endpoints
@router.get("/vehicles/", response_model=List[VehicleResponse])
async def get_vehicles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params),
    vehicle_type: Optional[VehicleType] = Query(None, description="Filter by vehicle type"),
    status: Optional[VehicleStatus] = Query(None, description="Filter by status"),
    available_only: bool = Query(False, description="Show only available vehicles")
) -> List[VehicleResponse]:
    """
    Get all vehicles with filters
    """
    if available_only:
        vehicles = vehicle_crud.get_available_vehicles(
            db,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
    elif vehicle_type:
        vehicles = vehicle_crud.get_by_type(
            db,
            vehicle_type=vehicle_type.value,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
    else:
        filters = {}
        if status:
            filters["status"] = status
        
        vehicles = vehicle_crud.get_multi(
            db,
            skip=pagination["skip"],
            limit=pagination["limit"],
            filters=filters
        )
    
    return [VehicleResponse.from_orm(vehicle) for vehicle in vehicles]


@router.get("/vehicles/maintenance-due", response_model=List[VehicleResponse])
async def get_vehicles_maintenance_due(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    days_ahead: int = Query(30, ge=1, le=365, description="Days ahead to check")
) -> List[VehicleResponse]:
    """
    Get vehicles with maintenance due
    """
    vehicles = vehicle_crud.get_maintenance_due(db, days_ahead=days_ahead)
    return [VehicleResponse.from_orm(vehicle) for vehicle in vehicles]


@router.get("/vehicles/statistics")
async def get_vehicle_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get vehicle statistics
    """
    return vehicle_crud.get_vehicle_statistics(db)


@router.get("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(
    vehicle_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> VehicleResponse:
    """
    Get vehicle by ID
    """
    vehicle = vehicle_crud.get(db, id=vehicle_id)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found"
        )
    
    return VehicleResponse.from_orm(vehicle)


@router.post("/vehicles/", response_model=VehicleResponse)
async def create_vehicle(
    vehicle_in: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_user_management_permission)
) -> VehicleResponse:
    """
    Create new vehicle
    """
    # Check if license plate already exists
    existing = vehicle_crud.get_by_license_plate(db, license_plate=vehicle_in.license_plate)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vehicle with this license plate already exists"
        )
    
    # Create vehicle
    vehicle = vehicle_crud.create(db, obj_in=vehicle_in)
    
    # Log vehicle creation
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="vehicle_created",
        resource="vehicle",
        resource_id=str(vehicle.id),
        details={
            "license_plate": vehicle.license_plate,
            "vehicle_type": vehicle.vehicle_type.value
        }
    )
    
    return VehicleResponse.from_orm(vehicle)


@router.put("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: str,
    vehicle_in: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_user_management_permission)
) -> VehicleResponse:
    """
    Update vehicle information
    """
    vehicle = vehicle_crud.get(db, id=vehicle_id)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found"
        )
    
    # Update vehicle
    vehicle = vehicle_crud.update(db, db_obj=vehicle, obj_in=vehicle_in)
    
    # Log update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="vehicle_updated",
        resource="vehicle",
        resource_id=str(vehicle.id),
        details={
            "license_plate": vehicle.license_plate,
            "updates": vehicle_in.dict(exclude_unset=True)
        }
    )
    
    return VehicleResponse.from_orm(vehicle)


@router.post("/vehicles/{vehicle_id}/maintenance", response_model=VehicleResponse)
async def schedule_vehicle_maintenance(
    vehicle_id: str,
    maintenance_date: datetime,
    maintenance_type: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_user_management_permission)
) -> VehicleResponse:
    """
    Schedule vehicle maintenance
    """
    try:
        vehicle = vehicle_crud.schedule_maintenance(
            db,
            vehicle_id=vehicle_id,
            maintenance_date=maintenance_date,
            maintenance_type=maintenance_type,
            notes=notes
        )
        
        # Log maintenance scheduling
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="vehicle_maintenance_scheduled",
            resource="vehicle",
            resource_id=str(vehicle.id),
            details={
                "maintenance_type": maintenance_type,
                "scheduled_date": maintenance_date.isoformat()
            }
        )
        
        return VehicleResponse.from_orm(vehicle)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/vehicles/{vehicle_id}/maintenance/complete", response_model=VehicleResponse)
async def complete_vehicle_maintenance(
    vehicle_id: str,
    maintenance_cost: Decimal,
    performed_by: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_user_management_permission)
) -> VehicleResponse:
    """
    Complete vehicle maintenance
    """
    try:
        vehicle = vehicle_crud.complete_maintenance(
            db,
            vehicle_id=vehicle_id,
            maintenance_cost=maintenance_cost,
            performed_by=performed_by,
            notes=notes
        )
        
        # Log maintenance completion
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="vehicle_maintenance_completed",
            resource="vehicle",
            resource_id=str(vehicle.id),
            details={
                "cost": str(maintenance_cost),
                "performed_by": performed_by
            }
        )
        
        return VehicleResponse.from_orm(vehicle)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Driver endpoints
@router.get("/drivers/", response_model=List[DriverResponse])
async def get_drivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params),
    status: Optional[DriverStatus] = Query(None, description="Filter by status"),
    available_only: bool = Query(False, description="Show only available drivers")
) -> List[DriverResponse]:
    """
    Get all drivers with filters
    """
    if available_only:
        drivers = driver_crud.get_available_drivers(
            db,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
    else:
        filters = {}
        if status:
            filters["status"] = status
        
        drivers = driver_crud.get_multi(
            db,
            skip=pagination["skip"],
            limit=pagination["limit"],
            filters=filters
        )
    
    return [DriverResponse.from_orm(driver) for driver in drivers]


@router.get("/drivers/license-expiring", response_model=List[DriverResponse])
async def get_drivers_license_expiring(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    days_ahead: int = Query(30, ge=1, le=365, description="Days ahead to check")
) -> List[DriverResponse]:
    """
    Get drivers with license expiring soon
    """
    drivers = driver_crud.get_license_expiring(db, days_ahead=days_ahead)
    return [DriverResponse.from_orm(driver) for driver in drivers]


@router.get("/drivers/statistics")
async def get_driver_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get driver statistics
    """
    return driver_crud.get_driver_statistics(db)


@router.get("/drivers/{driver_id}", response_model=DriverResponse)
async def get_driver(
    driver_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> DriverResponse:
    """
    Get driver by ID
    """
    driver = driver_crud.get(db, id=driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )
    
    return DriverResponse.from_orm(driver)


@router.get("/drivers/{driver_id}/performance", response_model=DriverPerformance)
async def get_driver_performance(
    driver_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_range: dict = Depends(get_date_range_params)
) -> DriverPerformance:
    """
    Get driver performance metrics
    """
    driver = driver_crud.get(db, id=driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )
    
    performance = driver_crud.get_driver_performance(
        db,
        driver_id=driver_id,
        date_from=date_range.get("date_from"),
        date_to=date_range.get("date_to")
    )
    
    return DriverPerformance(
        driver=DriverResponse.from_orm(driver),
        total_deliveries=performance["total_deliveries"],
        on_time_deliveries=performance["on_time_deliveries"],
        late_deliveries=performance["late_deliveries"],
        average_delivery_time=performance.get("average_delivery_time", 0),
        customer_rating=float(driver.rating) if driver.rating else None
    )


@router.post("/drivers/", response_model=DriverResponse)
async def create_driver(
    driver_in: DriverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_user_management_permission)
) -> DriverResponse:
    """
    Create new driver
    """
    # Check if employee ID already exists
    existing = driver_crud.get_by_employee_id(db, employee_id=driver_in.employee_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Driver with this employee ID already exists"
        )
    
    # Check if license number already exists
    existing = driver_crud.get_by_license_number(db, license_number=driver_in.license_number)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Driver with this license number already exists"
        )
    
    # Create driver
    driver = driver_crud.create(db, obj_in=driver_in)
    
    # Log driver creation
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="driver_created",
        resource="driver",
        resource_id=str(driver.id),
        details={
            "employee_id": driver.employee_id,
            "full_name": driver.full_name
        }
    )
    
    return DriverResponse.from_orm(driver)


@router.put("/drivers/{driver_id}", response_model=DriverResponse)
async def update_driver(
    driver_id: str,
    driver_in: DriverUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_user_management_permission)
) -> DriverResponse:
    """
    Update driver information
    """
    driver = driver_crud.get(db, id=driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )
    
    # Check for duplicate license number
    if driver_in.license_number and driver_in.license_number != driver.license_number:
        existing = driver_crud.get_by_license_number(db, license_number=driver_in.license_number)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Driver with this license number already exists"
            )
    
    # Update driver
    driver = driver_crud.update(db, db_obj=driver, obj_in=driver_in)
    
    # Log update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="driver_updated",
        resource="driver",
        resource_id=str(driver.id),
        details={
            "employee_id": driver.employee_id,
            "updates": driver_in.dict(exclude_unset=True)
        }
    )
    
    return DriverResponse.from_orm(driver)


# Route endpoints
@router.get("/routes/", response_model=List[DeliveryRouteResponse])
async def get_delivery_routes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params),
    active_only: bool = Query(True, description="Show only active routes"),
    driver_id: Optional[str] = Query(None, description="Filter by driver"),
    vehicle_id: Optional[str] = Query(None, description="Filter by vehicle")
) -> List[DeliveryRouteResponse]:
    """
    Get all delivery routes with filters
    """
    if active_only:
        routes = delivery_route_crud.get_active_routes(
            db,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
    elif driver_id:
        routes = delivery_route_crud.get_by_driver(
            db,
            driver_id=driver_id,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
    elif vehicle_id:
        routes = delivery_route_crud.get_by_vehicle(
            db,
            vehicle_id=vehicle_id,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
    else:
        routes = delivery_route_crud.get_multi(
            db,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
    
    # Add related data
    route_responses = []
    for route in routes:
        response = DeliveryRouteResponse.from_orm(route)
        if route.driver:
            response.driver = DriverResponse.from_orm(route.driver)
        if route.vehicle:
            response.vehicle = VehicleResponse.from_orm(route.vehicle)
        route_responses.append(response)
    
    return route_responses


@router.get("/routes/{route_id}", response_model=DeliveryRouteResponse)
async def get_delivery_route(
    route_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> DeliveryRouteResponse:
    """
    Get delivery route by ID
    """
    route = delivery_route_crud.get(db, id=route_id)
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )
    
    response = DeliveryRouteResponse.from_orm(route)
    if route.driver:
        response.driver = DriverResponse.from_orm(route.driver)
    if route.vehicle:
        response.vehicle = VehicleResponse.from_orm(route.vehicle)
    
    return response


@router.get("/routes/{route_id}/performance")
async def get_route_performance(
    route_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_range: dict = Depends(get_date_range_params)
) -> Dict[str, Any]:
    """
    Get route performance metrics
    """
    performance = delivery_route_crud.get_route_performance(
        db,
        route_id=route_id,
        date_from=date_range.get("date_from"),
        date_to=date_range.get("date_to")
    )
    
    return performance


@router.post("/routes/", response_model=DeliveryRouteResponse)
async def create_delivery_route(
    route_in: DeliveryRouteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_user_management_permission)
) -> DeliveryRouteResponse:
    """
    Create new delivery route
    """
    # Check if route name already exists
    existing = delivery_route_crud.get_by_name(db, route_name=route_in.route_name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Route with this name already exists"
        )
    
    # Verify driver exists
    driver = driver_crud.get(db, id=route_in.driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )
    
    # Verify vehicle exists
    vehicle = vehicle_crud.get(db, id=route_in.vehicle_id)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found"
        )
    
    # Create route
    route = delivery_route_crud.create(db, obj_in=route_in)
    
    # Log route creation
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="delivery_route_created",
        resource="delivery_route",
        resource_id=str(route.id),
        details={
            "route_name": route.route_name,
            "driver_id": str(route.driver_id),
            "vehicle_id": str(route.vehicle_id)
        }
    )
    
    response = DeliveryRouteResponse.from_orm(route)
    response.driver = DriverResponse.from_orm(driver)
    response.vehicle = VehicleResponse.from_orm(vehicle)
    
    return response


@router.put("/routes/{route_id}", response_model=DeliveryRouteResponse)
async def update_delivery_route(
    route_id: str,
    route_in: DeliveryRouteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_user_management_permission)
) -> DeliveryRouteResponse:
    """
    Update delivery route
    """
    route = delivery_route_crud.get(db, id=route_id)
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )
    
    # Check for duplicate route name
    if route_in.route_name and route_in.route_name != route.route_name:
        existing = delivery_route_crud.get_by_name(db, route_name=route_in.route_name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Route with this name already exists"
            )
    
    # Update route
    route = delivery_route_crud.update(db, db_obj=route, obj_in=route_in)
    
    # Log update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="delivery_route_updated",
        resource="delivery_route",
        resource_id=str(route.id),
        details={
            "route_name": route.route_name,
            "updates": route_in.dict(exclude_unset=True)
        }
    )
    
    response = DeliveryRouteResponse.from_orm(route)
    if route.driver:
        response.driver = DriverResponse.from_orm(route.driver)
    if route.vehicle:
        response.vehicle = VehicleResponse.from_orm(route.vehicle)
    
    return response


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