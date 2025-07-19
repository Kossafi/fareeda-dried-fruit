"""
Inventory management endpoints for stock control and tracking
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.crud_inventory import inventory_crud
from app.crud.crud_product import product_crud
from app.schemas.inventory import (
    InventoryCreate, InventoryUpdate, InventoryResponse,
    InventoryWithProductResponse, InventoryListResponse,
    StockUpdateRequest, StockTransferRequest, StockReservationRequest,
    PhysicalCountRequest, PhysicalCountResponse,
    StockMovementResponse, LowStockItem, ExpiringStockItem,
    StockValueResponse, MovementHistoryFilters,
    BatchReorderUpdateRequest, InventoryAdjustment,
    InventorySummary
)
from app.models.inventory import MovementType, MovementReason
from app.models.user import User
from app.api.dependencies import (
    get_current_user, get_current_active_user,
    check_inventory_management_permission,
    get_pagination_params, get_date_range_params
)

router = APIRouter()


@router.get("/", response_model=InventoryListResponse)
async def get_inventory(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params),
    branch_id: Optional[str] = Query(None, description="Filter by branch"),
    product_id: Optional[str] = Query(None, description="Filter by product"),
    low_stock_only: bool = Query(False, description="Show only low stock items")
) -> InventoryListResponse:
    """
    Get inventory items with pagination and filters
    """
    # Build query
    if branch_id:
        items = inventory_crud.get_by_branch(
            db,
            branch_id=branch_id,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
        total = len(inventory_crud.get_by_branch(db, branch_id=branch_id, skip=0, limit=10000))
    elif product_id:
        items = inventory_crud.get_by_product(
            db,
            product_id=product_id,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
        total = len(inventory_crud.get_by_product(db, product_id=product_id, skip=0, limit=10000))
    elif low_stock_only:
        low_stock = inventory_crud.get_low_stock(
            db,
            branch_id=branch_id,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
        items = [item["inventory"] for item in low_stock]
        total = len(inventory_crud.get_low_stock(db, branch_id=branch_id, skip=0, limit=10000))
    else:
        items = inventory_crud.get_multi(
            db,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
        total = inventory_crud.count(db)
    
    # Build response with product details
    inventory_responses = []
    for item in items:
        product = product_crud.get(db, id=item.product_id)
        response = InventoryWithProductResponse(
            **InventoryResponse.from_orm(item).dict(),
            product=product
        )
        inventory_responses.append(response)
    
    return InventoryListResponse(
        items=inventory_responses,
        total=total,
        page=pagination["page"],
        size=pagination["size"],
        pages=(total + pagination["size"] - 1) // pagination["size"]
    )


@router.get("/summary", response_model=InventorySummary)
async def get_inventory_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
) -> InventorySummary:
    """
    Get inventory summary statistics
    """
    # Get stock value
    stock_value = inventory_crud.get_stock_value(db, branch_id=branch_id)
    
    # Get low stock count
    low_stock = inventory_crud.get_low_stock(db, branch_id=branch_id)
    low_stock_count = len(low_stock)
    
    # Get out of stock count
    out_of_stock_count = sum(1 for item in low_stock if item["available"] <= 0)
    
    # Get expiring soon count
    expiring = inventory_crud.get_expiring_stock(db, days=30, branch_id=branch_id)
    expiring_soon_count = len(expiring)
    
    # Get branch count
    if branch_id:
        branch_count = 1
    else:
        # Count unique branches with inventory
        from sqlalchemy import distinct
        branch_count = db.query(distinct(inventory_crud.model.branch_id)).count()
    
    return InventorySummary(
        total_items=stock_value["item_count"],
        total_quantity=stock_value["total_quantity"],
        total_value=stock_value["total_value"],
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        expiring_soon_count=expiring_soon_count,
        branch_count=branch_count
    )


@router.get("/low-stock", response_model=List[LowStockItem])
async def get_low_stock_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[str] = Query(None, description="Filter by branch"),
    pagination: dict = Depends(get_pagination_params)
) -> List[LowStockItem]:
    """
    Get inventory items below reorder point
    """
    low_stock = inventory_crud.get_low_stock(
        db,
        branch_id=branch_id,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    
    results = []
    for item in low_stock:
        results.append(LowStockItem(
            inventory=InventoryResponse.from_orm(item["inventory"]),
            product=item["product"],
            available=item["available"],
            shortage=item["shortage"]
        ))
    
    return results


@router.get("/expiring", response_model=List[ExpiringStockItem])
async def get_expiring_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    days: int = Query(30, description="Days until expiry"),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
) -> List[ExpiringStockItem]:
    """
    Get inventory items expiring soon
    """
    expiring = inventory_crud.get_expiring_stock(
        db,
        days=days,
        branch_id=branch_id
    )
    
    results = []
    for item in expiring:
        results.append(ExpiringStockItem(
            inventory=InventoryResponse.from_orm(item["inventory"]),
            product=item["product"],
            days_until_expiry=item["days_until_expiry"],
            quantity=item["quantity"]
        ))
    
    return results


@router.get("/stock-value", response_model=StockValueResponse)
async def get_stock_value(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
) -> StockValueResponse:
    """
    Get total stock value
    """
    stock_value = inventory_crud.get_stock_value(db, branch_id=branch_id)
    
    return StockValueResponse(
        total_value=stock_value["total_value"],
        item_count=stock_value["item_count"],
        total_quantity=stock_value["total_quantity"],
        branch_id=branch_id
    )


@router.get("/movements", response_model=List[StockMovementResponse])
async def get_stock_movements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params),
    date_range: dict = Depends(get_date_range_params),
    filters: MovementHistoryFilters = Depends()
) -> List[StockMovementResponse]:
    """
    Get stock movement history
    """
    movements = inventory_crud.get_movement_history(
        db,
        inventory_id=filters.inventory_id,
        product_id=filters.product_id,
        branch_id=filters.branch_id,
        movement_type=filters.movement_type,
        date_from=date_range.get("date_from"),
        date_to=date_range.get("date_to"),
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    
    return [StockMovementResponse.from_orm(movement) for movement in movements]


@router.get("/{inventory_id}", response_model=InventoryWithProductResponse)
async def get_inventory_item(
    inventory_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> InventoryWithProductResponse:
    """
    Get inventory item by ID
    """
    inventory = inventory_crud.get(db, id=inventory_id)
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    product = product_crud.get(db, id=inventory.product_id)
    
    return InventoryWithProductResponse(
        **InventoryResponse.from_orm(inventory).dict(),
        product=product
    )


@router.post("/", response_model=InventoryResponse)
async def create_inventory(
    inventory_in: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_management_permission)
) -> InventoryResponse:
    """
    Create new inventory record
    """
    # Check if inventory already exists for product/branch
    existing = inventory_crud.get_by_product_branch(
        db,
        product_id=inventory_in.product_id,
        branch_id=inventory_in.branch_id
    )
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inventory already exists for this product and branch"
        )
    
    # Verify product exists
    product = product_crud.get(db, id=inventory_in.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Create inventory
    inventory = inventory_crud.create(db, obj_in=inventory_in)
    
    # Create initial stock movement
    if inventory.quantity_on_hand > 0:
        inventory_crud.update_stock(
            db,
            inventory_id=inventory.id,
            quantity_change=inventory.quantity_on_hand,
            movement_type=MovementType.IN,
            reason=MovementReason.INITIAL,
            notes="Initial stock",
            user_id=current_user.id
        )
    
    # Log inventory creation
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="inventory_created",
        resource="inventory",
        resource_id=str(inventory.id),
        details={
            "product_id": str(inventory.product_id),
            "branch_id": str(inventory.branch_id),
            "quantity": str(inventory.quantity_on_hand)
        }
    )
    
    return InventoryResponse.from_orm(inventory)


@router.put("/{inventory_id}", response_model=InventoryResponse)
async def update_inventory(
    inventory_id: str,
    inventory_in: InventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_management_permission)
) -> InventoryResponse:
    """
    Update inventory settings (reorder points, location, etc.)
    """
    inventory = inventory_crud.get(db, id=inventory_id)
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    # Update inventory
    inventory = inventory_crud.update(db, db_obj=inventory, obj_in=inventory_in)
    
    # Log inventory update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="inventory_updated",
        resource="inventory",
        resource_id=str(inventory.id),
        details=inventory_in.dict(exclude_unset=True)
    )
    
    return InventoryResponse.from_orm(inventory)


@router.post("/{inventory_id}/update-stock", response_model=InventoryResponse)
async def update_stock(
    inventory_id: str,
    stock_update: StockUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_management_permission)
) -> InventoryResponse:
    """
    Update inventory stock level
    """
    try:
        inventory = inventory_crud.update_stock(
            db,
            inventory_id=inventory_id,
            quantity_change=stock_update.quantity_change,
            movement_type=stock_update.movement_type,
            reason=stock_update.reason,
            reference_id=stock_update.reference_id,
            notes=stock_update.notes,
            user_id=current_user.id
        )
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory item not found"
            )
        
        # Log stock update
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="stock_updated",
            resource="inventory",
            resource_id=str(inventory.id),
            details={
                "quantity_change": str(stock_update.quantity_change),
                "movement_type": stock_update.movement_type.value,
                "reason": stock_update.reason.value
            }
        )
        
        return InventoryResponse.from_orm(inventory)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/transfer", response_model=Dict[str, Any])
async def transfer_stock(
    transfer_request: StockTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_management_permission)
) -> Dict[str, Any]:
    """
    Transfer stock between branches
    """
    try:
        result = inventory_crud.transfer_stock(
            db,
            product_id=transfer_request.product_id,
            from_branch_id=transfer_request.from_branch_id,
            to_branch_id=transfer_request.to_branch_id,
            quantity=transfer_request.quantity,
            user_id=current_user.id,
            notes=transfer_request.notes
        )
        
        # Log transfer
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="stock_transferred",
            details={
                "product_id": str(transfer_request.product_id),
                "from_branch_id": str(transfer_request.from_branch_id),
                "to_branch_id": str(transfer_request.to_branch_id),
                "quantity": str(transfer_request.quantity)
            }
        )
        
        return {
            "message": "Stock transferred successfully",
            "from_inventory": InventoryResponse.from_orm(result["from_inventory"]),
            "to_inventory": InventoryResponse.from_orm(result["to_inventory"]),
            "quantity_transferred": result["quantity_transferred"]
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{inventory_id}/reserve", response_model=InventoryResponse)
async def reserve_stock(
    inventory_id: str,
    reservation: StockReservationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> InventoryResponse:
    """
    Reserve stock for an order
    """
    try:
        inventory = inventory_crud.reserve_stock(
            db,
            inventory_id=inventory_id,
            quantity=reservation.quantity,
            order_id=reservation.order_id
        )
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory item not found"
            )
        
        return InventoryResponse.from_orm(inventory)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{inventory_id}/release-reservation", response_model=InventoryResponse)
async def release_reservation(
    inventory_id: str,
    reservation: StockReservationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> InventoryResponse:
    """
    Release reserved stock
    """
    inventory = inventory_crud.release_reservation(
        db,
        inventory_id=inventory_id,
        quantity=reservation.quantity,
        order_id=reservation.order_id
    )
    
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    return InventoryResponse.from_orm(inventory)


@router.post("/{inventory_id}/physical-count", response_model=PhysicalCountResponse)
async def record_physical_count(
    inventory_id: str,
    count_request: PhysicalCountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_management_permission)
) -> PhysicalCountResponse:
    """
    Record physical inventory count
    """
    result = inventory_crud.physical_count(
        db,
        inventory_id=inventory_id,
        counted_quantity=count_request.counted_quantity,
        user_id=current_user.id,
        notes=count_request.notes
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    # Log physical count
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="physical_count_recorded",
        resource="inventory",
        resource_id=str(inventory_id),
        details={
            "counted_quantity": str(count_request.counted_quantity),
            "variance": str(result["variance"])
        }
    )
    
    return PhysicalCountResponse.from_orm(result["count_record"])


@router.post("/batch-update-reorder-points")
async def batch_update_reorder_points(
    updates: BatchReorderUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_management_permission)
) -> Dict[str, Any]:
    """
    Batch update reorder points
    """
    updated_items = inventory_crud.batch_update_reorder_points(
        db,
        updates=[update.dict() for update in updates.updates]
    )
    
    # Log batch update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="reorder_points_batch_updated",
        details={
            "updated_count": len(updated_items)
        }
    )
    
    return {
        "message": f"Updated reorder points for {len(updated_items)} items",
        "updated_count": len(updated_items)
    }


@router.post("/{inventory_id}/adjust")
async def adjust_inventory(
    inventory_id: str,
    adjustment: InventoryAdjustment,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_management_permission)
) -> Dict[str, Any]:
    """
    Make inventory adjustment
    """
    inventory = inventory_crud.get(db, id=inventory_id)
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    # Determine movement type
    movement_type = MovementType.IN if adjustment.adjustment_quantity > 0 else MovementType.OUT
    
    # Update stock
    try:
        inventory = inventory_crud.update_stock(
            db,
            inventory_id=inventory_id,
            quantity_change=abs(adjustment.adjustment_quantity),
            movement_type=movement_type,
            reason=MovementReason.ADJUSTMENT,
            notes=f"{adjustment.reason}: {adjustment.notes}",
            user_id=current_user.id
        )
        
        # Log adjustment
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="inventory_adjusted",
            resource="inventory",
            resource_id=str(inventory_id),
            details={
                "adjustment_quantity": str(adjustment.adjustment_quantity),
                "reason": adjustment.reason
            }
        )
        
        return {
            "message": "Inventory adjusted successfully",
            "inventory": InventoryResponse.from_orm(inventory)
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


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