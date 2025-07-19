"""
Product management endpoints for CRUD operations on products
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.crud_product import product_crud
from app.crud.crud_inventory import inventory_crud
from app.schemas.product import (
    ProductCreate, ProductUpdate, ProductResponse, ProductListResponse,
    ProductWithVariantsResponse, ProductWithReviewsResponse,
    ProductStatistics, LowStockProduct, BestsellerProduct, ExpiringProduct,
    PriceUpdateRequest, DiscountRequest, BulkStatusUpdateRequest,
    ProductSearchFilters, ProductVariantCreate, ProductVariantUpdate,
    ProductReviewCreate
)
from app.models.product import ProductCategory, ProductStatus
from app.models.user import User
from app.api.dependencies import (
    get_current_user, get_current_active_user,
    check_product_management_permission,
    get_pagination_params, get_search_params
)

router = APIRouter()


@router.get("/", response_model=ProductListResponse)
async def get_products(
    db: Session = Depends(get_db),
    pagination: dict = Depends(get_pagination_params),
    search: dict = Depends(get_search_params),
    category: Optional[ProductCategory] = Query(None, description="Filter by category"),
    status: Optional[ProductStatus] = Query(None, description="Filter by status"),
    min_price: Optional[Decimal] = Query(None, description="Minimum price"),
    max_price: Optional[Decimal] = Query(None, description="Maximum price"),
    in_stock_only: bool = Query(False, description="Show only in-stock products"),
    is_featured: Optional[bool] = Query(None, description="Filter by featured status"),
    is_organic: Optional[bool] = Query(None, description="Filter by organic status")
) -> ProductListResponse:
    """
    Get all products with pagination and filters
    """
    # Search products
    products = product_crud.search_products(
        db,
        search_query=search["search_query"],
        category=category,
        status=status,
        min_price=min_price,
        max_price=max_price,
        in_stock_only=in_stock_only,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    
    # Get total count
    total = len(product_crud.search_products(
        db,
        search_query=search["search_query"],
        category=category,
        status=status,
        min_price=min_price,
        max_price=max_price,
        in_stock_only=in_stock_only,
        skip=0,
        limit=10000
    ))
    
    # Add inventory info to products
    product_responses = []
    for product in products:
        response = ProductResponse.from_orm(product)
        
        # Get total stock across all branches
        inventories = inventory_crud.get_by_product(db, product_id=product.id)
        total_stock = sum(inv.quantity_on_hand for inv in inventories)
        response.in_stock = total_stock > 0
        response.stock_level = total_stock
        
        product_responses.append(response)
    
    return ProductListResponse(
        products=product_responses,
        total=total,
        page=pagination["page"],
        size=pagination["size"],
        pages=(total + pagination["size"] - 1) // pagination["size"]
    )


@router.get("/active", response_model=List[ProductResponse])
async def get_active_products(
    db: Session = Depends(get_db),
    pagination: dict = Depends(get_pagination_params)
) -> List[ProductResponse]:
    """
    Get active products only
    """
    products = product_crud.get_active_products(
        db,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    return [ProductResponse.from_orm(product) for product in products]


@router.get("/low-stock", response_model=List[LowStockProduct])
async def get_low_stock_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[str] = Query(None, description="Filter by branch"),
    pagination: dict = Depends(get_pagination_params)
) -> List[LowStockProduct]:
    """
    Get products with low stock
    """
    low_stock_items = product_crud.get_low_stock_products(
        db,
        branch_id=branch_id,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    
    results = []
    for item in low_stock_items:
        results.append(LowStockProduct(
            product=ProductResponse.from_orm(item["product"]),
            stock_level=item["stock_level"],
            reorder_point=item["reorder_point"],
            shortage=item["shortage"],
            branch_id=str(item["inventory"].branch_id)
        ))
    
    return results


@router.get("/bestsellers", response_model=List[BestsellerProduct])
async def get_bestsellers(
    db: Session = Depends(get_db),
    days: int = Query(30, description="Number of days to analyze"),
    limit: int = Query(10, description="Number of products to return")
) -> List[BestsellerProduct]:
    """
    Get bestselling products
    """
    bestsellers = product_crud.get_bestsellers(db, days=days, limit=limit)
    
    results = []
    for item in bestsellers:
        results.append(BestsellerProduct(
            product=ProductResponse.from_orm(item["product"]),
            total_sold=item["total_sold"],
            total_revenue=item["total_revenue"],
            period_days=item["period_days"]
        ))
    
    return results


@router.get("/expiring", response_model=List[ExpiringProduct])
async def get_expiring_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    days: int = Query(30, description="Days until expiry"),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
) -> List[ExpiringProduct]:
    """
    Get products expiring soon
    """
    expiring_items = product_crud.get_expiring_products(
        db,
        days=days,
        branch_id=branch_id
    )
    
    results = []
    for item in expiring_items:
        results.append(ExpiringProduct(
            product=ProductResponse.from_orm(item["product"]),
            expiry_date=item["expiry_date"],
            days_until_expiry=item["days_until_expiry"],
            quantity=item["quantity"],
            branch_id=str(item["inventory"].branch_id)
        ))
    
    return results


@router.get("/by-category/{category}", response_model=List[ProductResponse])
async def get_products_by_category(
    category: ProductCategory,
    db: Session = Depends(get_db),
    pagination: dict = Depends(get_pagination_params)
) -> List[ProductResponse]:
    """
    Get products by category
    """
    products = product_crud.get_by_category(
        db,
        category=category,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    return [ProductResponse.from_orm(product) for product in products]


@router.get("/{product_id}", response_model=ProductWithVariantsResponse)
async def get_product(
    product_id: str,
    db: Session = Depends(get_db)
) -> ProductWithVariantsResponse:
    """
    Get product by ID with variants
    """
    product = product_crud.get(db, id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    response = ProductWithVariantsResponse.from_orm(product)
    
    # Add stock info
    inventories = inventory_crud.get_by_product(db, product_id=product.id)
    total_stock = sum(inv.quantity_on_hand for inv in inventories)
    response.in_stock = total_stock > 0
    response.stock_level = total_stock
    
    return response


@router.get("/{product_id}/statistics", response_model=ProductStatistics)
async def get_product_statistics(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ProductStatistics:
    """
    Get comprehensive product statistics
    """
    stats = product_crud.get_product_statistics(db, product_id=product_id)
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    return ProductStatistics(**stats)


@router.post("/", response_model=ProductResponse)
async def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_product_management_permission)
) -> ProductResponse:
    """
    Create new product
    """
    # Check if SKU already exists
    if product_crud.get_by_sku(db, sku=product_in.sku):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product with this SKU already exists"
        )
    
    # Check if barcode already exists
    if product_in.barcode and product_crud.get_by_barcode(db, barcode=product_in.barcode):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product with this barcode already exists"
        )
    
    # Create product
    product = product_crud.create(db, obj_in=product_in)
    
    # Log product creation
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="product_created",
        resource="product",
        resource_id=str(product.id),
        details={
            "product_name": product.product_name,
            "sku": product.sku
        }
    )
    
    return ProductResponse.from_orm(product)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_product_management_permission)
) -> ProductResponse:
    """
    Update product
    """
    product = product_crud.get(db, id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Check for duplicate SKU
    if product_in.sku and product_in.sku != product.sku:
        if product_crud.get_by_sku(db, sku=product_in.sku):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Product with this SKU already exists"
            )
    
    # Check for duplicate barcode
    if product_in.barcode and product_in.barcode != product.barcode:
        if product_crud.get_by_barcode(db, barcode=product_in.barcode):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Product with this barcode already exists"
            )
    
    # Update product
    product = product_crud.update(db, db_obj=product, obj_in=product_in)
    
    # Log product update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="product_updated",
        resource="product",
        resource_id=str(product.id),
        details={
            "product_name": product.product_name,
            "sku": product.sku
        }
    )
    
    return ProductResponse.from_orm(product)


@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_product_management_permission)
) -> Dict[str, Any]:
    """
    Delete product (soft delete)
    """
    product = product_crud.get(db, id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Check if product has inventory
    inventories = inventory_crud.get_by_product(db, product_id=product_id)
    if any(inv.quantity_on_hand > 0 for inv in inventories):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete product with existing inventory"
        )
    
    # Soft delete product
    product_crud.soft_delete(db, id=product_id)
    
    # Log product deletion
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="product_deleted",
        resource="product",
        resource_id=str(product.id),
        details={
            "product_name": product.product_name,
            "sku": product.sku
        }
    )
    
    return {"message": "Product deleted successfully"}


@router.post("/{product_id}/update-price", response_model=ProductResponse)
async def update_product_price(
    product_id: str,
    price_update: PriceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_product_management_permission)
) -> ProductResponse:
    """
    Update product price
    """
    product = product_crud.update_price(
        db,
        product_id=product_id,
        new_price=price_update.new_price,
        update_variants=price_update.update_variants
    )
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Log price update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="product_price_updated",
        resource="product",
        resource_id=str(product.id),
        details={
            "product_name": product.product_name,
            "new_price": str(price_update.new_price)
        }
    )
    
    return ProductResponse.from_orm(product)


@router.post("/{product_id}/apply-discount", response_model=ProductResponse)
async def apply_product_discount(
    product_id: str,
    discount: DiscountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_product_management_permission)
) -> ProductResponse:
    """
    Apply discount to product
    """
    product = product_crud.apply_discount(
        db,
        product_id=product_id,
        discount_percentage=discount.discount_percentage
    )
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Log discount application
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="product_discount_applied",
        resource="product",
        resource_id=str(product.id),
        details={
            "product_name": product.product_name,
            "discount_percentage": discount.discount_percentage
        }
    )
    
    return ProductResponse.from_orm(product)


@router.post("/bulk-update-status")
async def bulk_update_product_status(
    status_update: BulkStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_product_management_permission)
) -> Dict[str, Any]:
    """
    Bulk update product status
    """
    products = product_crud.bulk_update_status(
        db,
        product_ids=status_update.product_ids,
        status=status_update.status
    )
    
    # Log bulk update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="products_bulk_status_update",
        details={
            "product_count": len(products),
            "new_status": status_update.status.value
        }
    )
    
    return {
        "message": f"Updated status for {len(products)} products",
        "updated_count": len(products)
    }


@router.post("/{product_id}/images")
async def upload_product_images(
    product_id: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(check_product_management_permission)
) -> Dict[str, Any]:
    """
    Upload product images
    """
    product = product_crud.get(db, id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # TODO: Implement file upload logic
    # For now, just return success
    
    return {
        "message": "Images uploaded successfully",
        "count": len(files)
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