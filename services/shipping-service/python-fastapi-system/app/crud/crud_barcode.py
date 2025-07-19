"""
CRUD operations for Barcode model
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app.crud.base import CRUDBase
from app.models.barcode import Barcode, BarcodeTemplate, BarcodeType, BarcodeScanLog, ScanPurpose
from app.models.product import Product
from app.schemas.barcode import BarcodeCreate, BarcodeUpdate, BarcodeTemplateCreate, BarcodeScanLogCreate


class CRUDBarcode(CRUDBase[Barcode, BarcodeCreate, BarcodeUpdate]):
    """CRUD operations for Barcode model"""
    
    def get_by_barcode(self, db: Session, *, barcode: str) -> Optional[Barcode]:
        """Get barcode by barcode string"""
        return db.query(Barcode).filter(Barcode.barcode == barcode).first()
    
    def get_by_product(
        self,
        db: Session,
        *,
        product_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[Barcode]:
        """Get all barcodes for a product"""
        return db.query(Barcode).filter(
            Barcode.product_id == product_id
        ).offset(skip).limit(limit).all()
    
    def generate_barcode(
        self,
        db: Session,
        *,
        product_id: UUID,
        barcode_type: BarcodeType = BarcodeType.CODE128,
        template_id: Optional[UUID] = None,
        batch_number: Optional[str] = None,
        expiry_date: Optional[datetime] = None,
        created_by: UUID
    ) -> Barcode:
        """Generate new barcode for product"""
        # Get product
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise ValueError("Product not found")
        
        # Generate barcode string
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        if barcode_type == BarcodeType.EAN13:
            # Generate EAN-13 (13 digits)
            prefix = "880"  # Thailand country code
            product_code = str(product_id)[-6:].zfill(6)
            sequence = timestamp[-3:]
            barcode_str = f"{prefix}{product_code}{sequence}"
            # Calculate check digit
            check_digit = self._calculate_ean13_check_digit(barcode_str)
            barcode_str = f"{barcode_str}{check_digit}"
        elif barcode_type == BarcodeType.CODE128:
            # Generate Code128
            barcode_str = f"FDF{product.sku}{timestamp}"
        elif barcode_type == BarcodeType.QR:
            # Generate QR data
            barcode_str = f"FDF:{product_id}:{timestamp}"
            if batch_number:
                barcode_str += f":{batch_number}"
        else:
            # Default format
            barcode_str = f"{product.sku}-{timestamp}"
        
        # Create barcode record
        barcode = Barcode(
            barcode=barcode_str,
            barcode_type=barcode_type,
            product_id=product_id,
            batch_number=batch_number,
            expiry_date=expiry_date,
            template_id=template_id,
            created_by=created_by
        )
        
        db.add(barcode)
        db.commit()
        db.refresh(barcode)
        
        return barcode
    
    def _calculate_ean13_check_digit(self, barcode: str) -> str:
        """Calculate EAN-13 check digit"""
        if len(barcode) != 12:
            raise ValueError("EAN-13 requires 12 digits")
        
        odd_sum = sum(int(barcode[i]) for i in range(0, 12, 2))
        even_sum = sum(int(barcode[i]) for i in range(1, 12, 2))
        total = odd_sum + (even_sum * 3)
        check_digit = (10 - (total % 10)) % 10
        
        return str(check_digit)
    
    def bulk_generate(
        self,
        db: Session,
        *,
        product_id: UUID,
        quantity: int,
        barcode_type: BarcodeType = BarcodeType.CODE128,
        template_id: Optional[UUID] = None,
        batch_number: Optional[str] = None,
        expiry_date: Optional[datetime] = None,
        created_by: UUID
    ) -> List[Barcode]:
        """Generate multiple barcodes for a product"""
        barcodes = []
        
        for i in range(quantity):
            barcode = self.generate_barcode(
                db,
                product_id=product_id,
                barcode_type=barcode_type,
                template_id=template_id,
                batch_number=batch_number,
                expiry_date=expiry_date,
                created_by=created_by
            )
            barcodes.append(barcode)
        
        return barcodes
    
    def log_scan(
        self,
        db: Session,
        *,
        barcode_id: UUID,
        scan_purpose: ScanPurpose,
        location: Optional[str] = None,
        device_id: Optional[str] = None,
        scanned_by: Optional[UUID] = None,
        metadata: Optional[dict] = None
    ) -> BarcodeScanLog:
        """Log barcode scan"""
        barcode = self.get(db, id=barcode_id)
        if not barcode:
            raise ValueError("Barcode not found")
        
        scan_log = BarcodeScanLog(
            barcode_id=barcode_id,
            barcode_string=barcode.barcode,
            product_id=barcode.product_id,
            scan_purpose=scan_purpose,
            scan_location=location,
            device_id=device_id,
            scanned_by=scanned_by,
            metadata=metadata
        )
        
        # Update last scan info on barcode
        barcode.last_scanned_at = datetime.utcnow()
        barcode.scan_count += 1
        
        db.add(scan_log)
        db.add(barcode)
        db.commit()
        db.refresh(scan_log)
        
        return scan_log
    
    def get_scan_history(
        self,
        db: Session,
        *,
        barcode_id: Optional[UUID] = None,
        product_id: Optional[UUID] = None,
        scan_purpose: Optional[ScanPurpose] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[BarcodeScanLog]:
        """Get barcode scan history"""
        query = db.query(BarcodeScanLog)
        
        if barcode_id:
            query = query.filter(BarcodeScanLog.barcode_id == barcode_id)
        
        if product_id:
            query = query.filter(BarcodeScanLog.product_id == product_id)
        
        if scan_purpose:
            query = query.filter(BarcodeScanLog.scan_purpose == scan_purpose)
        
        if date_from:
            query = query.filter(BarcodeScanLog.created_at >= date_from)
        
        if date_to:
            query = query.filter(BarcodeScanLog.created_at <= date_to)
        
        return query.order_by(
            BarcodeScanLog.created_at.desc()
        ).offset(skip).limit(limit).all()
    
    def get_scan_statistics(
        self,
        db: Session,
        *,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get barcode scan statistics"""
        query = db.query(BarcodeScanLog)
        
        if date_from:
            query = query.filter(BarcodeScanLog.created_at >= date_from)
        
        if date_to:
            query = query.filter(BarcodeScanLog.created_at <= date_to)
        
        # Total scans
        total_scans = query.count()
        
        # Scans by purpose
        scans_by_purpose = {}
        for purpose in ScanPurpose:
            count = query.filter(
                BarcodeScanLog.scan_purpose == purpose
            ).count()
            scans_by_purpose[purpose.value] = count
        
        # Most scanned products
        most_scanned = db.query(
            BarcodeScanLog.product_id,
            func.count(BarcodeScanLog.id).label("scan_count")
        )
        
        if date_from:
            most_scanned = most_scanned.filter(BarcodeScanLog.created_at >= date_from)
        
        if date_to:
            most_scanned = most_scanned.filter(BarcodeScanLog.created_at <= date_to)
        
        most_scanned = most_scanned.group_by(
            BarcodeScanLog.product_id
        ).order_by(
            func.count(BarcodeScanLog.id).desc()
        ).limit(10).all()
        
        return {
            "total_scans": total_scans,
            "scans_by_purpose": scans_by_purpose,
            "most_scanned_products": [
                {"product_id": str(p_id), "scan_count": count}
                for p_id, count in most_scanned
            ]
        }
    
    def deactivate_barcode(
        self,
        db: Session,
        *,
        barcode_id: UUID,
        reason: str
    ) -> Barcode:
        """Deactivate a barcode"""
        barcode = self.get(db, id=barcode_id)
        if not barcode:
            raise ValueError("Barcode not found")
        
        barcode.is_active = False
        barcode.deactivation_reason = reason
        barcode.deactivated_at = datetime.utcnow()
        
        db.add(barcode)
        db.commit()
        db.refresh(barcode)
        
        return barcode
    
    def get_templates(
        self,
        db: Session,
        *,
        is_active: Optional[bool] = True,
        skip: int = 0,
        limit: int = 100
    ) -> List[BarcodeTemplate]:
        """Get barcode templates"""
        query = db.query(BarcodeTemplate)
        
        if is_active is not None:
            query = query.filter(BarcodeTemplate.is_active == is_active)
        
        return query.offset(skip).limit(limit).all()
    
    def create_template(
        self,
        db: Session,
        *,
        obj_in: BarcodeTemplateCreate
    ) -> BarcodeTemplate:
        """Create barcode template"""
        template = BarcodeTemplate(**obj_in.dict())
        db.add(template)
        db.commit()
        db.refresh(template)
        return template
    
    def get_print_queue(
        self,
        db: Session,
        *,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get barcodes in print queue"""
        from app.models.barcode import BarcodePrintJob
        
        query = db.query(BarcodePrintJob)
        
        if status:
            query = query.filter(BarcodePrintJob.status == status)
        
        return query.order_by(
            BarcodePrintJob.created_at.desc()
        ).offset(skip).limit(limit).all()
    
    def create_print_job(
        self,
        db: Session,
        *,
        barcode_ids: List[UUID],
        template_id: UUID,
        printer_id: Optional[str] = None,
        copies: int = 1,
        created_by: UUID
    ) -> Dict[str, Any]:
        """Create barcode print job"""
        from app.models.barcode import BarcodePrintJob
        
        # Verify all barcodes exist
        barcodes = db.query(Barcode).filter(
            Barcode.id.in_(barcode_ids)
        ).all()
        
        if len(barcodes) != len(barcode_ids):
            raise ValueError("Some barcodes not found")
        
        # Create print job
        print_job = BarcodePrintJob(
            barcode_ids=barcode_ids,
            template_id=template_id,
            printer_id=printer_id,
            copies=copies,
            status="pending",
            created_by=created_by
        )
        
        db.add(print_job)
        db.commit()
        db.refresh(print_job)
        
        return {
            "print_job": print_job,
            "barcode_count": len(barcode_ids),
            "total_labels": len(barcode_ids) * copies
        }


# Create the barcode CRUD instance
barcode_crud = CRUDBarcode(Barcode)