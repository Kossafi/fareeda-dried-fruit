"""
Barcode management endpoints for generation, scanning, and printing
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime
import io
import qrcode
from barcode import Code128, EAN13
from barcode.writer import ImageWriter

from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.crud_barcode import barcode_crud
from app.crud.crud_product import product_crud
from app.schemas.barcode import (
    BarcodeCreate, BarcodeUpdate, BarcodeResponse,
    BarcodeWithProductResponse, BarcodeListResponse,
    BarcodeGenerateRequest, BarcodeScanLogCreate, BarcodeScanLogResponse,
    BarcodeTemplateCreate, BarcodeTemplateUpdate, BarcodeTemplateResponse,
    BarcodePrintJobCreate, BarcodePrintJobResponse,
    BarcodeStatistics, BarcodeVerifyRequest, BarcodeVerifyResponse,
    BarcodeDeactivateRequest, ScanHistoryResponse
)
from app.models.barcode import BarcodeType, ScanPurpose
from app.models.user import User
from app.api.dependencies import (
    get_current_user, get_current_active_user,
    check_inventory_management_permission,
    get_pagination_params, get_date_range_params
)

router = APIRouter()


@router.get("/", response_model=BarcodeListResponse)
async def get_barcodes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params),
    product_id: Optional[str] = Query(None, description="Filter by product"),
    barcode_type: Optional[BarcodeType] = Query(None, description="Filter by type"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    batch_number: Optional[str] = Query(None, description="Filter by batch")
) -> BarcodeListResponse:
    """
    Get all barcodes with pagination and filters
    """
    # Build filters
    filters = {}
    if product_id:
        filters["product_id"] = product_id
    if barcode_type:
        filters["barcode_type"] = barcode_type
    if is_active is not None:
        filters["is_active"] = is_active
    if batch_number:
        filters["batch_number"] = batch_number
    
    # Get barcodes
    barcodes = barcode_crud.get_multi(
        db,
        skip=pagination["skip"],
        limit=pagination["limit"],
        filters=filters
    )
    
    total = barcode_crud.count(db, filters=filters)
    
    # Add product info
    barcode_responses = []
    for barcode in barcodes:
        product = product_crud.get(db, id=barcode.product_id)
        response = BarcodeWithProductResponse(
            **BarcodeResponse.from_orm(barcode).dict(),
            product_name=product.product_name,
            product_sku=product.sku,
            product_category=product.category.value
        )
        barcode_responses.append(response)
    
    return BarcodeListResponse(
        barcodes=barcode_responses,
        total=total,
        page=pagination["page"],
        size=pagination["size"],
        pages=(total + pagination["size"] - 1) // pagination["size"]
    )


@router.get("/statistics", response_model=BarcodeStatistics)
async def get_barcode_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_range: dict = Depends(get_date_range_params)
) -> BarcodeStatistics:
    """
    Get barcode statistics
    """
    # Get total counts
    total_barcodes = barcode_crud.count(db)
    active_barcodes = barcode_crud.count(db, filters={"is_active": True})
    
    # Get scan statistics
    scan_stats = barcode_crud.get_scan_statistics(
        db,
        date_from=date_range.get("date_from"),
        date_to=date_range.get("date_to")
    )
    
    # Get pending print jobs
    print_queue = barcode_crud.get_print_queue(db, status="pending")
    
    return BarcodeStatistics(
        total_barcodes=total_barcodes,
        active_barcodes=active_barcodes,
        total_scans=scan_stats["total_scans"],
        scans_by_purpose=scan_stats["scans_by_purpose"],
        most_scanned_products=scan_stats["most_scanned_products"],
        recent_scans=scan_stats["total_scans"],  # In date range
        print_jobs_pending=len(print_queue)
    )


@router.get("/templates", response_model=List[BarcodeTemplateResponse])
async def get_barcode_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_active: Optional[bool] = Query(True, description="Filter by active status")
) -> List[BarcodeTemplateResponse]:
    """
    Get barcode templates
    """
    templates = barcode_crud.get_templates(db, is_active=is_active)
    return [BarcodeTemplateResponse.from_orm(template) for template in templates]


@router.get("/scan-history", response_model=ScanHistoryResponse)
async def get_scan_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params),
    date_range: dict = Depends(get_date_range_params),
    barcode_id: Optional[str] = Query(None, description="Filter by barcode"),
    product_id: Optional[str] = Query(None, description="Filter by product"),
    scan_purpose: Optional[ScanPurpose] = Query(None, description="Filter by purpose")
) -> ScanHistoryResponse:
    """
    Get barcode scan history
    """
    scans = barcode_crud.get_scan_history(
        db,
        barcode_id=barcode_id,
        product_id=product_id,
        scan_purpose=scan_purpose,
        date_from=date_range.get("date_from"),
        date_to=date_range.get("date_to"),
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    
    # Get total count
    total = len(barcode_crud.get_scan_history(
        db,
        barcode_id=barcode_id,
        product_id=product_id,
        scan_purpose=scan_purpose,
        date_from=date_range.get("date_from"),
        date_to=date_range.get("date_to"),
        skip=0,
        limit=10000
    ))
    
    return ScanHistoryResponse(
        scans=[BarcodeScanLogResponse.from_orm(scan) for scan in scans],
        total=total,
        page=pagination["page"],
        size=pagination["size"],
        pages=(total + pagination["size"] - 1) // pagination["size"]
    )


@router.get("/{barcode_id}", response_model=BarcodeWithProductResponse)
async def get_barcode(
    barcode_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> BarcodeWithProductResponse:
    """
    Get barcode by ID
    """
    barcode = barcode_crud.get(db, id=barcode_id)
    if not barcode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Barcode not found"
        )
    
    product = product_crud.get(db, id=barcode.product_id)
    
    return BarcodeWithProductResponse(
        **BarcodeResponse.from_orm(barcode).dict(),
        product_name=product.product_name,
        product_sku=product.sku,
        product_category=product.category.value
    )


@router.get("/{barcode_id}/image")
async def get_barcode_image(
    barcode_id: str,
    db: Session = Depends(get_db),
    width: int = Query(300, ge=100, le=1000),
    height: int = Query(100, ge=50, le=500),
    format: str = Query("png", pattern="^(png|svg)$")
):
    """
    Get barcode image
    """
    barcode = barcode_crud.get(db, id=barcode_id)
    if not barcode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Barcode not found"
        )
    
    # Generate barcode image
    img_buffer = io.BytesIO()
    
    if barcode.barcode_type == BarcodeType.QR:
        # Generate QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(barcode.barcode)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(img_buffer, format="PNG")
    elif barcode.barcode_type == BarcodeType.EAN13:
        # Generate EAN-13
        ean = EAN13(barcode.barcode, writer=ImageWriter())
        ean.write(img_buffer)
    else:
        # Generate Code128
        code128 = Code128(barcode.barcode, writer=ImageWriter())
        code128.write(img_buffer)
    
    img_buffer.seek(0)
    
    return StreamingResponse(
        img_buffer,
        media_type=f"image/{format}",
        headers={
            "Content-Disposition": f"inline; filename=barcode_{barcode_id}.{format}"
        }
    )


@router.post("/generate", response_model=List[BarcodeResponse])
async def generate_barcodes(
    generate_request: BarcodeGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_management_permission)
) -> List[BarcodeResponse]:
    """
    Generate new barcodes for a product
    """
    # Verify product exists
    product = product_crud.get(db, id=generate_request.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Generate barcodes
    barcodes = barcode_crud.bulk_generate(
        db,
        product_id=generate_request.product_id,
        quantity=generate_request.quantity,
        barcode_type=generate_request.barcode_type,
        template_id=generate_request.template_id,
        batch_number=generate_request.batch_number,
        expiry_date=generate_request.expiry_date,
        created_by=current_user.id
    )
    
    # Log barcode generation
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="barcodes_generated",
        resource="barcode",
        details={
            "product_id": str(generate_request.product_id),
            "quantity": generate_request.quantity,
            "barcode_type": generate_request.barcode_type.value
        }
    )
    
    return [BarcodeResponse.from_orm(barcode) for barcode in barcodes]


@router.post("/scan", response_model=BarcodeVerifyResponse)
async def scan_barcode(
    scan_request: BarcodeVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> BarcodeVerifyResponse:
    """
    Scan and verify barcode
    """
    # Find barcode
    barcode = barcode_crud.get_by_barcode(db, barcode=scan_request.barcode)
    
    if not barcode:
        return BarcodeVerifyResponse(
            valid=False,
            message="Barcode not found in system"
        )
    
    if not barcode.is_active:
        return BarcodeVerifyResponse(
            valid=False,
            barcode_id=str(barcode.id),
            message="Barcode has been deactivated"
        )
    
    # Get product info
    product = product_crud.get(db, id=barcode.product_id)
    
    # Check expiry
    is_expired = False
    if barcode.expiry_date:
        is_expired = barcode.expiry_date < datetime.utcnow()
    
    # Log scan
    scan_log = barcode_crud.log_scan(
        db,
        barcode_id=barcode.id,
        scan_purpose=scan_request.scan_purpose,
        location=scan_request.location,
        device_id=scan_request.device_id,
        scanned_by=current_user.id,
        metadata={
            "user_id": str(current_user.id),
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    
    return BarcodeVerifyResponse(
        valid=True,
        barcode_id=str(barcode.id),
        product_id=str(product.id),
        product_name=product.product_name,
        product_sku=product.sku,
        batch_number=barcode.batch_number,
        expiry_date=barcode.expiry_date,
        is_expired=is_expired,
        message="Barcode verified successfully"
    )


@router.post("/templates", response_model=BarcodeTemplateResponse)
async def create_barcode_template(
    template_in: BarcodeTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_management_permission)
) -> BarcodeTemplateResponse:
    """
    Create new barcode template
    """
    template = barcode_crud.create_template(db, obj_in=template_in)
    
    # Log template creation
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="barcode_template_created",
        resource="barcode_template",
        resource_id=str(template.id),
        details={
            "template_name": template.name,
            "barcode_type": template.barcode_type.value
        }
    )
    
    return BarcodeTemplateResponse.from_orm(template)


@router.post("/print", response_model=BarcodePrintJobResponse)
async def create_print_job(
    print_job: BarcodePrintJobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> BarcodePrintJobResponse:
    """
    Create barcode print job
    """
    try:
        result = barcode_crud.create_print_job(
            db,
            barcode_ids=print_job.barcode_ids,
            template_id=print_job.template_id,
            printer_id=print_job.printer_id,
            copies=print_job.copies,
            created_by=current_user.id
        )
        
        # Log print job creation
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="print_job_created",
            details={
                "barcode_count": result["barcode_count"],
                "total_labels": result["total_labels"]
            }
        )
        
        return BarcodePrintJobResponse.from_orm(result["print_job"])
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{barcode_id}", response_model=BarcodeResponse)
async def update_barcode(
    barcode_id: str,
    barcode_in: BarcodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_management_permission)
) -> BarcodeResponse:
    """
    Update barcode information
    """
    barcode = barcode_crud.get(db, id=barcode_id)
    if not barcode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Barcode not found"
        )
    
    # Update barcode
    barcode = barcode_crud.update(db, db_obj=barcode, obj_in=barcode_in)
    
    # Log update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="barcode_updated",
        resource="barcode",
        resource_id=str(barcode.id),
        details=barcode_in.dict(exclude_unset=True)
    )
    
    return BarcodeResponse.from_orm(barcode)


@router.post("/{barcode_id}/deactivate")
async def deactivate_barcode(
    barcode_id: str,
    deactivate_request: BarcodeDeactivateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_management_permission)
) -> Dict[str, Any]:
    """
    Deactivate a barcode
    """
    try:
        barcode = barcode_crud.deactivate_barcode(
            db,
            barcode_id=barcode_id,
            reason=deactivate_request.reason
        )
        
        # Log deactivation
        await log_user_activity(
            db,
            user_id=str(current_user.id),
            action="barcode_deactivated",
            resource="barcode",
            resource_id=str(barcode_id),
            details={
                "reason": deactivate_request.reason
            }
        )
        
        return {
            "message": "Barcode deactivated successfully",
            "barcode_id": str(barcode.id)
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{barcode_id}")
async def delete_barcode(
    barcode_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_inventory_management_permission)
) -> Dict[str, Any]:
    """
    Delete barcode (soft delete)
    """
    barcode = barcode_crud.get(db, id=barcode_id)
    if not barcode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Barcode not found"
        )
    
    # Check if barcode has been scanned
    if barcode.scan_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete barcode that has been scanned"
        )
    
    # Soft delete
    barcode_crud.soft_delete(db, id=barcode_id)
    
    # Log deletion
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="barcode_deleted",
        resource="barcode",
        resource_id=str(barcode_id)
    )
    
    return {"message": "Barcode deleted successfully"}


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