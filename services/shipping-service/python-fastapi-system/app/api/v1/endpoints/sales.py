"""
Sales recording endpoints for transaction management
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.crud_sales import sales_crud
from app.crud.crud_customer import customer_crud
from app.crud.crud_product import product_crud
from app.crud.crud_barcode import barcode_crud
from app.schemas.sales import (
    SalesTransactionCreate, SalesTransactionUpdate, SalesTransactionResponse,
    SalesTransactionListResponse, QuickSaleRequest, QuickSaleResponse,
    VoidTransactionRequest, SalesSummary, TopSellingProduct,
    HourlySales, CustomerPurchaseHistory, ReceiptData
)
from app.models.sales import PaymentMethod, TransactionStatus
from app.models.user import User
from app.api.dependencies import (
    get_current_user, get_current_active_user,
    check_sales_permission,
    get_pagination_params, get_date_range_params
)

router = APIRouter()


@router.get("/", response_model=SalesTransactionListResponse)
async def get_sales_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params),
    date_range: dict = Depends(get_date_range_params),
    branch_id: Optional[str] = Query(None, description="Filter by branch"),
    customer_id: Optional[str] = Query(None, description="Filter by customer"),
    cashier_id: Optional[str] = Query(None, description="Filter by cashier"),
    status: Optional[TransactionStatus] = Query(None, description="Filter by status"),
    payment_method: Optional[PaymentMethod] = Query(None, description="Filter by payment method"),
    receipt_number: Optional[str] = Query(None, description="Filter by receipt number")
) -> SalesTransactionListResponse:
    """
    Get sales transactions with pagination and filters
    """
    # Build filters based on query parameters
    if receipt_number:
        transaction = sales_crud.get_by_receipt_number(db, receipt_number=receipt_number)
        transactions = [transaction] if transaction else []
        total = 1 if transaction else 0
    elif customer_id:
        transactions = sales_crud.get_by_customer(
            db,
            customer_id=customer_id,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
        total = len(sales_crud.get_by_customer(db, customer_id=customer_id, skip=0, limit=10000))
    elif branch_id:
        transactions = sales_crud.get_by_branch(
            db,
            branch_id=branch_id,
            date_from=date_range.get("date_from"),
            date_to=date_range.get("date_to"),
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
        total = len(sales_crud.get_by_branch(
            db,
            branch_id=branch_id,
            date_from=date_range.get("date_from"),
            date_to=date_range.get("date_to"),
            skip=0,
            limit=10000
        ))
    elif cashier_id:
        transactions = sales_crud.get_by_cashier(
            db,
            cashier_id=cashier_id,
            date_from=date_range.get("date_from"),
            date_to=date_range.get("date_to"),
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
        total = len(sales_crud.get_by_cashier(
            db,
            cashier_id=cashier_id,
            date_from=date_range.get("date_from"),
            date_to=date_range.get("date_to"),
            skip=0,
            limit=10000
        ))
    else:
        # Apply additional filters
        filters = {}
        if status:
            filters["status"] = status
        if payment_method:
            filters["payment_method"] = payment_method
        
        transactions = sales_crud.get_multi(
            db,
            skip=pagination["skip"],
            limit=pagination["limit"],
            filters=filters
        )
        total = sales_crud.count(db, filters=filters)
    
    # Add related data
    transaction_responses = []
    for transaction in transactions:
        response = SalesTransactionResponse.from_orm(transaction)
        
        # Add customer info
        if transaction.customer_id:
            customer = customer_crud.get(db, id=transaction.customer_id)
            if customer:
                response.customer = customer
        
        # Add cashier name
        # TODO: Get cashier name from user service
        response.cashier_name = "Cashier"
        
        # Add branch name
        # TODO: Get branch name from branch service
        response.branch_name = "Branch"
        
        transaction_responses.append(response)
    
    return SalesTransactionListResponse(
        transactions=transaction_responses,
        total=total,
        page=pagination["page"],
        size=pagination["size"],
        pages=(total + pagination["size"] - 1) // pagination["size"]
    )


@router.get("/summary", response_model=SalesSummary)
async def get_sales_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_range: dict = Depends(get_date_range_params),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
) -> SalesSummary:
    """
    Get sales summary statistics
    """
    summary = sales_crud.get_sales_summary(
        db,
        branch_id=branch_id,
        date_from=date_range.get("date_from"),
        date_to=date_range.get("date_to")
    )
    
    return SalesSummary(**summary)


@router.get("/top-products", response_model=List[TopSellingProduct])
async def get_top_selling_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_range: dict = Depends(get_date_range_params),
    branch_id: Optional[str] = Query(None, description="Filter by branch"),
    limit: int = Query(10, ge=1, le=50)
) -> List[TopSellingProduct]:
    """
    Get top selling products
    """
    top_products = sales_crud.get_top_selling_products(
        db,
        branch_id=branch_id,
        date_from=date_range.get("date_from"),
        date_to=date_range.get("date_to"),
        limit=limit
    )
    
    return [TopSellingProduct(**product) for product in top_products]


@router.get("/hourly", response_model=List[HourlySales])
async def get_hourly_sales(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date: Optional[date] = Query(None, description="Date for hourly breakdown"),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
) -> List[HourlySales]:
    """
    Get hourly sales breakdown
    """
    hourly_data = sales_crud.get_hourly_sales(
        db,
        branch_id=branch_id,
        date=date
    )
    
    return [HourlySales(**hour) for hour in hourly_data]


@router.get("/{transaction_id}", response_model=SalesTransactionResponse)
async def get_sales_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> SalesTransactionResponse:
    """
    Get sales transaction by ID
    """
    transaction = sales_crud.get(db, id=transaction_id)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    response = SalesTransactionResponse.from_orm(transaction)
    
    # Add customer info
    if transaction.customer_id:
        customer = customer_crud.get(db, id=transaction.customer_id)
        if customer:
            response.customer = customer
    
    return response


@router.get("/{transaction_id}/receipt", response_model=ReceiptData)
async def get_receipt_data(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ReceiptData:
    """
    Get receipt data for printing
    """
    transaction = sales_crud.get(db, id=transaction_id)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    # Build receipt data
    receipt_items = []
    for item in transaction.items:
        product = product_crud.get(db, id=item.product_id)
        receipt_items.append({
            "product_name": product.product_name if product else "Unknown Product",
            "product_sku": product.sku if product else "",
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total_price": item.total_price,
            "discount_percentage": item.discount_percentage
        })
    
    # Calculate change due for cash payments
    change_due = None
    if transaction.payment_method == PaymentMethod.CASH:
        # TODO: Get cash received from transaction metadata
        cash_received = transaction.total_amount  # Placeholder
        change_due = cash_received - transaction.total_amount
    
    # Get customer info
    customer_name = None
    if transaction.customer_id:
        customer = customer_crud.get(db, id=transaction.customer_id)
        if customer:
            customer_name = customer.full_name
    
    return ReceiptData(
        receipt_number=transaction.receipt_number,
        transaction_date=transaction.created_at,
        branch_name="Branch Name",  # TODO: Get from branch service
        cashier_name="Cashier Name",  # TODO: Get from user service
        customer_name=customer_name,
        items=receipt_items,
        subtotal=transaction.subtotal,
        discount_amount=transaction.discount_amount,
        tax_amount=transaction.tax_amount,
        total_amount=transaction.total_amount,
        payment_method=transaction.payment_method.value,
        cash_received=transaction.total_amount if transaction.payment_method == PaymentMethod.CASH else None,
        change_due=change_due,
        loyalty_points_earned=0,  # TODO: Calculate loyalty points
        loyalty_points_balance=0   # TODO: Get customer loyalty points
    )


@router.post("/", response_model=SalesTransactionResponse)
async def create_sales_transaction(
    transaction_in: SalesTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_sales_permission)
) -> SalesTransactionResponse:
    """
    Create new sales transaction
    """
    try:
        # Convert items to the format expected by create_sale
        items = []
        for item in transaction_in.items:
            # Verify product exists
            product = product_crud.get(db, id=item.product_id)
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product {item.product_id} not found"
                )
            
            items.append({
                "product_id": item.product_id,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "discount_percentage": item.discount_percentage or 0,
                "notes": item.notes
            })
        
        # Create transaction
        transaction = sales_crud.create_sale(
            db,
            branch_id=transaction_in.branch_id,
            cashier_id=current_user.id,
            customer_id=transaction_in.customer_id,
            items=items,
            payment_method=transaction_in.payment_method,
            discount_amount=transaction_in.discount_amount,
            discount_type=transaction_in.discount_type,
            tax_amount=transaction_in.tax_amount,
            notes=transaction_in.notes
        )
        
        # Update customer statistics if customer provided
        if transaction.customer_id:
            customer_crud.update_customer_stats(
                db,
                customer_id=transaction.customer_id,
                purchase_amount=transaction.total_amount,
                purchase_date=transaction.created_at
            )
        
        # Log transaction creation
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="sales_transaction_created",
            resource="sales_transaction",
            resource_id=str(transaction.id),
            details={
                "receipt_number": transaction.receipt_number,
                "total_amount": str(transaction.total_amount),
                "item_count": len(items)
            }
        )
        
        return SalesTransactionResponse.from_orm(transaction)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/quick-sale", response_model=QuickSaleResponse)
async def create_quick_sale(
    quick_sale: QuickSaleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_sales_permission)
) -> QuickSaleResponse:
    """
    Create quick sale transaction (simplified process)
    """
    try:
        # Process items - resolve products by barcode if needed
        items = []
        for item in quick_sale.items:
            product = None
            
            if item.product_id:
                product = product_crud.get(db, id=item.product_id)
            elif item.barcode:
                # Find product by barcode
                barcode_record = barcode_crud.get_by_barcode(db, barcode=item.barcode)
                if barcode_record:
                    product = product_crud.get(db, id=barcode_record.product_id)
            
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product not found for item with barcode: {item.barcode}"
                )
            
            unit_price = item.unit_price or product.unit_price
            
            items.append({
                "product_id": str(product.id),
                "quantity": item.quantity,
                "unit_price": unit_price,
                "discount_percentage": item.discount_percentage or 0,
                "notes": None
            })
        
        # Create transaction
        transaction = sales_crud.create_sale(
            db,
            branch_id=quick_sale.branch_id,
            cashier_id=current_user.id,
            customer_id=quick_sale.customer_id,
            items=items,
            payment_method=quick_sale.payment_method,
            discount_amount=quick_sale.discount_amount,
            discount_type=quick_sale.discount_type,
            tax_amount=quick_sale.tax_amount,
            notes=quick_sale.notes
        )
        
        # Calculate change due
        change_due = None
        if quick_sale.payment_method == PaymentMethod.CASH and quick_sale.cash_received:
            change_due = quick_sale.cash_received - transaction.total_amount
            if change_due < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Insufficient cash received"
                )
        
        # Get receipt data
        receipt_data = await get_receipt_data(str(transaction.id), db, current_user)
        
        return QuickSaleResponse(
            transaction=SalesTransactionResponse.from_orm(transaction),
            change_due=change_due,
            receipt_data=receipt_data.dict()
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{transaction_id}", response_model=SalesTransactionResponse)
async def update_sales_transaction(
    transaction_id: str,
    transaction_in: SalesTransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_sales_permission)
) -> SalesTransactionResponse:
    """
    Update sales transaction (limited fields)
    """
    transaction = sales_crud.get(db, id=transaction_id)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    if transaction.status == TransactionStatus.VOIDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update voided transaction"
        )
    
    # Update transaction
    transaction = sales_crud.update(db, db_obj=transaction, obj_in=transaction_in)
    
    # Log update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="sales_transaction_updated",
        resource="sales_transaction",
        resource_id=str(transaction.id),
        details=transaction_in.dict(exclude_unset=True)
    )
    
    return SalesTransactionResponse.from_orm(transaction)


@router.post("/{transaction_id}/void")
async def void_sales_transaction(
    transaction_id: str,
    void_request: VoidTransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_sales_permission)
) -> Dict[str, Any]:
    """
    Void a sales transaction
    """
    try:
        transaction = sales_crud.void_transaction(
            db,
            transaction_id=transaction_id,
            void_reason=void_request.void_reason,
            voided_by=current_user.id
        )
        
        # Log void operation
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="sales_transaction_voided",
            resource="sales_transaction",
            resource_id=str(transaction.id),
            details={
                "receipt_number": transaction.receipt_number,
                "void_reason": void_request.void_reason
            }
        )
        
        return {
            "message": "Transaction voided successfully",
            "transaction_id": str(transaction.id),
            "receipt_number": transaction.receipt_number
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{transaction_id}")
async def delete_sales_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_sales_permission)
) -> Dict[str, Any]:
    """
    Delete sales transaction (admin only, rarely used)
    """
    transaction = sales_crud.get(db, id=transaction_id)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    # Check if user has admin privileges
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete transactions"
        )
    
    # Soft delete
    sales_crud.soft_delete(db, id=transaction_id)
    
    # Log deletion
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="sales_transaction_deleted",
        resource="sales_transaction",
        resource_id=str(transaction_id),
        details={
            "receipt_number": transaction.receipt_number
        }
    )
    
    return {"message": "Transaction deleted successfully"}


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