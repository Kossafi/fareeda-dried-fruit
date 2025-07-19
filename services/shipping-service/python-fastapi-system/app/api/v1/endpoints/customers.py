"""
Customer management endpoints for CRM operations
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.crud_customer import customer_crud
from app.crud.crud_sales import sales_crud
from app.schemas.sales import (
    CustomerCreate, CustomerUpdate, CustomerResponse, CustomerListResponse,
    CustomerStatistics, CustomerPurchaseHistory, RedeemPointsRequest,
    CustomerSearchFilters, BulkCustomerUpdate, MergeCustomersRequest
)
from app.models.sales import CustomerTier, CustomerStatus
from app.models.user import User
from app.api.dependencies import (
    get_current_user, get_current_active_user,
    check_sales_permission, check_user_management_permission,
    get_pagination_params
)

router = APIRouter()


@router.get("/", response_model=CustomerListResponse)
async def get_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params),
    search_query: Optional[str] = Query(None, description="Search customers"),
    tier: Optional[CustomerTier] = Query(None, description="Filter by tier"),
    status: Optional[CustomerStatus] = Query(None, description="Filter by status"),
    city: Optional[str] = Query(None, description="Filter by city"),
    birthday_month: Optional[int] = Query(None, ge=1, le=12, description="Filter by birthday month")
) -> CustomerListResponse:
    """
    Get all customers with pagination and filters
    """
    # Search customers
    customers = customer_crud.search_customers(
        db,
        search_query=search_query or "",
        tier=tier,
        status=status,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    
    # Apply additional filters
    if city:
        customers = [c for c in customers if c.city and c.city.lower() == city.lower()]
    
    if birthday_month:
        customers = [c for c in customers if c.date_of_birth and c.date_of_birth.month == birthday_month]
    
    # Get total count
    total = len(customer_crud.search_customers(
        db,
        search_query=search_query or "",
        tier=tier,
        status=status,
        skip=0,
        limit=10000
    ))
    
    return CustomerListResponse(
        customers=[CustomerResponse.from_orm(customer) for customer in customers],
        total=total,
        page=pagination["page"],
        size=pagination["size"],
        pages=(total + pagination["size"] - 1) // pagination["size"]
    )


@router.get("/statistics", response_model=CustomerStatistics)
async def get_customer_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CustomerStatistics:
    """
    Get customer statistics
    """
    stats = customer_crud.get_customer_statistics(db)
    return CustomerStatistics(**stats)


@router.get("/active", response_model=List[CustomerResponse])
async def get_active_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params)
) -> List[CustomerResponse]:
    """
    Get active customers only
    """
    customers = customer_crud.get_active_customers(
        db,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    return [CustomerResponse.from_orm(customer) for customer in customers]


@router.get("/vip", response_model=List[CustomerResponse])
async def get_vip_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params)
) -> List[CustomerResponse]:
    """
    Get VIP customers
    """
    customers = customer_crud.get_vip_customers(
        db,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    return [CustomerResponse.from_orm(customer) for customer in customers]


@router.get("/inactive", response_model=List[CustomerResponse])
async def get_inactive_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params),
    days_inactive: int = Query(90, ge=1, le=365, description="Days since last purchase")
) -> List[CustomerResponse]:
    """
    Get inactive customers
    """
    customers = customer_crud.get_inactive_customers(
        db,
        days_inactive=days_inactive,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    return [CustomerResponse.from_orm(customer) for customer in customers]


@router.get("/birthdays", response_model=List[CustomerResponse])
async def get_birthday_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    month: Optional[int] = Query(None, ge=1, le=12, description="Birthday month"),
    day: Optional[int] = Query(None, ge=1, le=31, description="Birthday day")
) -> List[CustomerResponse]:
    """
    Get customers with birthdays in specified month/day
    """
    customers = customer_crud.get_birthday_customers(
        db,
        month=month,
        day=day
    )
    return [CustomerResponse.from_orm(customer) for customer in customers]


@router.get("/by-tier/{tier}", response_model=List[CustomerResponse])
async def get_customers_by_tier(
    tier: CustomerTier,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params)
) -> List[CustomerResponse]:
    """
    Get customers by tier
    """
    customers = customer_crud.get_by_tier(
        db,
        tier=tier,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    return [CustomerResponse.from_orm(customer) for customer in customers]


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CustomerResponse:
    """
    Get customer by ID
    """
    customer = customer_crud.get(db, id=customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    return CustomerResponse.from_orm(customer)


@router.get("/{customer_id}/purchase-history", response_model=CustomerPurchaseHistory)
async def get_customer_purchase_history(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params)
) -> CustomerPurchaseHistory:
    """
    Get customer purchase history
    """
    customer = customer_crud.get(db, id=customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    history = sales_crud.get_customer_purchase_history(
        db,
        customer_id=customer_id,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    
    return CustomerPurchaseHistory(**history)


@router.post("/", response_model=CustomerResponse)
async def create_customer(
    customer_in: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_sales_permission)
) -> CustomerResponse:
    """
    Create new customer
    """
    # Check if customer with email already exists
    if customer_in.email:
        existing = customer_crud.get_by_email(db, email=customer_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer with this email already exists"
            )
    
    # Check if customer with phone already exists
    if customer_in.phone:
        existing = customer_crud.get_by_phone(db, phone=customer_in.phone)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer with this phone number already exists"
            )
    
    # Generate customer code
    customer_code = customer_crud.generate_customer_code(db)
    
    # Create customer
    customer_data = customer_in.dict()
    customer_data["customer_code"] = customer_code
    customer_data["tier"] = CustomerTier.REGULAR
    customer_data["status"] = CustomerStatus.ACTIVE
    
    customer = customer_crud.create(db, obj_in=customer_data)
    
    # Log customer creation
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="customer_created",
        resource="customer",
        resource_id=str(customer.id),
        details={
            "customer_code": customer.customer_code,
            "customer_name": customer.full_name
        }
    )
    
    return CustomerResponse.from_orm(customer)


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    customer_in: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_sales_permission)
) -> CustomerResponse:
    """
    Update customer information
    """
    customer = customer_crud.get(db, id=customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    # Check for duplicate email
    if customer_in.email and customer_in.email != customer.email:
        existing = customer_crud.get_by_email(db, email=customer_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer with this email already exists"
            )
    
    # Check for duplicate phone
    if customer_in.phone and customer_in.phone != customer.phone:
        existing = customer_crud.get_by_phone(db, phone=customer_in.phone)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer with this phone number already exists"
            )
    
    # Update customer
    customer = customer_crud.update(db, db_obj=customer, obj_in=customer_in)
    
    # Log update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="customer_updated",
        resource="customer",
        resource_id=str(customer.id),
        details={
            "customer_code": customer.customer_code,
            "updates": customer_in.dict(exclude_unset=True)
        }
    )
    
    return CustomerResponse.from_orm(customer)


@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_user_management_permission)
) -> Dict[str, Any]:
    """
    Delete customer (soft delete)
    """
    customer = customer_crud.get(db, id=customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    # Check if customer has purchase history
    history = sales_crud.get_customer_purchase_history(db, customer_id=customer_id)
    if history["statistics"]["total_transactions"] > 0:
        # Don't delete, just deactivate
        customer.status = CustomerStatus.INACTIVE
        db.add(customer)
        db.commit()
        
        message = "Customer deactivated (has purchase history)"
    else:
        # Safe to soft delete
        customer_crud.soft_delete(db, id=customer_id)
        message = "Customer deleted successfully"
    
    # Log action
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="customer_deleted",
        resource="customer",
        resource_id=str(customer_id),
        details={
            "customer_code": customer.customer_code,
            "action": message
        }
    )
    
    return {"message": message}


@router.post("/{customer_id}/redeem-points")
async def redeem_loyalty_points(
    customer_id: str,
    redeem_request: RedeemPointsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_sales_permission)
) -> Dict[str, Any]:
    """
    Redeem customer loyalty points
    """
    try:
        customer = customer_crud.redeem_loyalty_points(
            db,
            customer_id=customer_id,
            points_to_redeem=redeem_request.points_to_redeem,
            redemption_value=redeem_request.redemption_value,
            notes=redeem_request.notes
        )
        
        # Log redemption
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="loyalty_points_redeemed",
            resource="customer",
            resource_id=str(customer_id),
            details={
                "points_redeemed": redeem_request.points_to_redeem,
                "redemption_value": str(redeem_request.redemption_value),
                "remaining_points": customer.loyalty_points
            }
        )
        
        return {
            "message": "Points redeemed successfully",
            "points_redeemed": redeem_request.points_to_redeem,
            "redemption_value": redeem_request.redemption_value,
            "remaining_points": customer.loyalty_points
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/bulk-update")
async def bulk_update_customers(
    bulk_update: BulkCustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_user_management_permission)
) -> Dict[str, Any]:
    """
    Bulk update customers
    """
    if bulk_update.tier:
        customers = customer_crud.bulk_update_tier(
            db,
            customer_ids=bulk_update.customer_ids,
            new_tier=bulk_update.tier
        )
        
        # Log bulk update
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="customers_bulk_updated",
            details={
                "customer_count": len(customers),
                "new_tier": bulk_update.tier.value
            }
        )
        
        return {
            "message": f"Updated {len(customers)} customers",
            "updated_count": len(customers)
        }
    
    return {"message": "No updates specified"}


@router.post("/merge")
async def merge_customers(
    merge_request: MergeCustomersRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_user_management_permission)
) -> Dict[str, Any]:
    """
    Merge duplicate customer records
    """
    try:
        primary_customer = customer_crud.merge_customers(
            db,
            primary_customer_id=merge_request.primary_customer_id,
            duplicate_customer_id=merge_request.duplicate_customer_id
        )
        
        # Log merge
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="customers_merged",
            resource="customer",
            resource_id=str(primary_customer.id),
            details={
                "primary_customer": primary_customer.customer_code,
                "duplicate_customer": merge_request.duplicate_customer_id,
                "reason": merge_request.reason
            }
        )
        
        return {
            "message": "Customers merged successfully",
            "primary_customer": CustomerResponse.from_orm(primary_customer)
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/export/data")
async def export_customer_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(check_user_management_permission),
    include_inactive: bool = Query(False, description="Include inactive customers"),
    tier: Optional[CustomerTier] = Query(None, description="Filter by tier")
) -> List[Dict[str, Any]]:
    """
    Export customer data
    """
    data = customer_crud.export_customer_data(
        db,
        include_inactive=include_inactive,
        tier=tier
    )
    
    # Log export
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="customer_data_exported",
        details={
            "customer_count": len(data),
            "include_inactive": include_inactive,
            "tier_filter": tier.value if tier else None
        }
    )
    
    return data


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