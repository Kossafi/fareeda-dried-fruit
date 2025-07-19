"""
CRUD operations for Sales model
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc

from app.crud.base import CRUDBase
from app.models.sales import (
    SalesTransaction, SalesTransactionItem, Customer, 
    PaymentMethod, TransactionStatus, DiscountType
)
from app.models.product import Product
from app.models.inventory import Inventory
from app.crud.crud_inventory import inventory_crud
from app.schemas.sales import SalesTransactionCreate, SalesTransactionUpdate


class CRUDSales(CRUDBase[SalesTransaction, SalesTransactionCreate, SalesTransactionUpdate]):
    """CRUD operations for Sales model"""
    
    def get_by_receipt_number(self, db: Session, *, receipt_number: str) -> Optional[SalesTransaction]:
        """Get sales transaction by receipt number"""
        return db.query(SalesTransaction).filter(
            SalesTransaction.receipt_number == receipt_number
        ).first()
    
    def get_by_customer(
        self,
        db: Session,
        *,
        customer_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[SalesTransaction]:
        """Get sales transactions by customer"""
        return db.query(SalesTransaction).filter(
            SalesTransaction.customer_id == customer_id
        ).order_by(desc(SalesTransaction.created_at)).offset(skip).limit(limit).all()
    
    def get_by_branch(
        self,
        db: Session,
        *,
        branch_id: UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[SalesTransaction]:
        """Get sales transactions by branch"""
        query = db.query(SalesTransaction).filter(
            SalesTransaction.branch_id == branch_id
        )
        
        if date_from:
            query = query.filter(SalesTransaction.created_at >= date_from)
        
        if date_to:
            query = query.filter(SalesTransaction.created_at <= date_to)
        
        return query.order_by(desc(SalesTransaction.created_at)).offset(skip).limit(limit).all()
    
    def get_by_cashier(
        self,
        db: Session,
        *,
        cashier_id: UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[SalesTransaction]:
        """Get sales transactions by cashier"""
        query = db.query(SalesTransaction).filter(
            SalesTransaction.cashier_id == cashier_id
        )
        
        if date_from:
            query = query.filter(SalesTransaction.created_at >= date_from)
        
        if date_to:
            query = query.filter(SalesTransaction.created_at <= date_to)
        
        return query.order_by(desc(SalesTransaction.created_at)).offset(skip).limit(limit).all()
    
    def create_sale(
        self,
        db: Session,
        *,
        branch_id: UUID,
        cashier_id: UUID,
        customer_id: Optional[UUID] = None,
        items: List[Dict[str, Any]],
        payment_method: PaymentMethod,
        discount_amount: Decimal = Decimal('0'),
        discount_type: Optional[DiscountType] = None,
        tax_amount: Decimal = Decimal('0'),
        notes: Optional[str] = None
    ) -> SalesTransaction:
        """Create a complete sales transaction"""
        
        # Calculate totals
        subtotal = Decimal('0')
        total_weight = Decimal('0')
        transaction_items = []
        
        # Process each item
        for item_data in items:
            product = db.query(Product).filter(Product.id == item_data["product_id"]).first()
            if not product:
                raise ValueError(f"Product {item_data['product_id']} not found")
            
            quantity = Decimal(str(item_data["quantity"]))
            unit_price = item_data.get("unit_price", product.unit_price)
            
            # Calculate discounted price if applicable
            if item_data.get("discount_percentage"):
                discount_pct = Decimal(str(item_data["discount_percentage"]))
                unit_price = unit_price * (1 - discount_pct / 100)
            
            total_price = quantity * unit_price
            subtotal += total_price
            total_weight += quantity * product.weight_per_unit
            
            transaction_items.append({
                "product_id": item_data["product_id"],
                "quantity": quantity,
                "unit_price": unit_price,
                "total_price": total_price,
                "discount_percentage": item_data.get("discount_percentage", 0),
                "notes": item_data.get("notes")
            })
        
        # Apply transaction-level discount
        if discount_amount > 0:
            if discount_type == DiscountType.PERCENTAGE:
                discount_amount = subtotal * (discount_amount / 100)
            subtotal -= discount_amount
        
        # Calculate final total
        total_amount = subtotal + tax_amount
        
        # Generate receipt number
        receipt_number = self._generate_receipt_number(db, branch_id)
        
        # Create transaction
        transaction = SalesTransaction(
            receipt_number=receipt_number,
            branch_id=branch_id,
            cashier_id=cashier_id,
            customer_id=customer_id,
            subtotal=subtotal,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            discount_type=discount_type,
            total_amount=total_amount,
            total_weight=total_weight,
            payment_method=payment_method,
            status=TransactionStatus.COMPLETED,
            notes=notes
        )
        
        db.add(transaction)
        db.flush()  # Get the transaction ID
        
        # Create transaction items
        for item_data in transaction_items:
            item = SalesTransactionItem(
                transaction_id=transaction.id,
                **item_data
            )
            db.add(item)
            
            # Update inventory
            inventory = inventory_crud.get_by_product_branch(
                db,
                product_id=item_data["product_id"],
                branch_id=branch_id
            )
            
            if inventory:
                inventory_crud.update_stock(
                    db,
                    inventory_id=inventory.id,
                    quantity_change=item_data["quantity"],
                    movement_type="OUT",
                    reason="SALE",
                    reference_id=receipt_number,
                    notes=f"Sale transaction {receipt_number}",
                    user_id=cashier_id
                )
        
        db.commit()
        db.refresh(transaction)
        
        return transaction
    
    def _generate_receipt_number(self, db: Session, branch_id: UUID) -> str:
        """Generate unique receipt number"""
        today = datetime.now().strftime("%Y%m%d")
        
        # Get today's transaction count for this branch
        count = db.query(SalesTransaction).filter(
            and_(
                SalesTransaction.branch_id == branch_id,
                func.date(SalesTransaction.created_at) == datetime.now().date()
            )
        ).count()
        
        # Format: BRANCH_DATE_SEQUENCE (e.g., B001_20240101_0001)
        branch_code = str(branch_id)[:8]  # Use first 8 chars of UUID
        sequence = str(count + 1).zfill(4)
        
        return f"{branch_code}_{today}_{sequence}"
    
    def void_transaction(
        self,
        db: Session,
        *,
        transaction_id: UUID,
        void_reason: str,
        voided_by: UUID
    ) -> SalesTransaction:
        """Void a sales transaction"""
        transaction = self.get(db, id=transaction_id)
        if not transaction:
            raise ValueError("Transaction not found")
        
        if transaction.status == TransactionStatus.VOIDED:
            raise ValueError("Transaction already voided")
        
        # Update transaction status
        transaction.status = TransactionStatus.VOIDED
        transaction.void_reason = void_reason
        transaction.voided_by = voided_by
        transaction.voided_at = datetime.utcnow()
        
        # Reverse inventory changes
        for item in transaction.items:
            inventory = inventory_crud.get_by_product_branch(
                db,
                product_id=item.product_id,
                branch_id=transaction.branch_id
            )
            
            if inventory:
                inventory_crud.update_stock(
                    db,
                    inventory_id=inventory.id,
                    quantity_change=item.quantity,
                    movement_type="IN",
                    reason="VOID",
                    reference_id=transaction.receipt_number,
                    notes=f"Void transaction {transaction.receipt_number}: {void_reason}",
                    user_id=voided_by
                )
        
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        
        return transaction
    
    def get_sales_summary(
        self,
        db: Session,
        *,
        branch_id: Optional[UUID] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get sales summary statistics"""
        query = db.query(SalesTransaction).filter(
            SalesTransaction.status == TransactionStatus.COMPLETED
        )
        
        if branch_id:
            query = query.filter(SalesTransaction.branch_id == branch_id)
        
        if date_from:
            query = query.filter(SalesTransaction.created_at >= date_from)
        
        if date_to:
            query = query.filter(SalesTransaction.created_at <= date_to)
        
        # Get aggregated data
        summary = query.with_entities(
            func.count(SalesTransaction.id).label("transaction_count"),
            func.sum(SalesTransaction.total_amount).label("total_revenue"),
            func.sum(SalesTransaction.subtotal).label("subtotal"),
            func.sum(SalesTransaction.tax_amount).label("total_tax"),
            func.sum(SalesTransaction.discount_amount).label("total_discount"),
            func.avg(SalesTransaction.total_amount).label("average_sale")
        ).first()
        
        # Get payment method breakdown
        payment_breakdown = query.with_entities(
            SalesTransaction.payment_method,
            func.count(SalesTransaction.id).label("count"),
            func.sum(SalesTransaction.total_amount).label("amount")
        ).group_by(SalesTransaction.payment_method).all()
        
        return {
            "transaction_count": summary.transaction_count or 0,
            "total_revenue": summary.total_revenue or Decimal('0'),
            "subtotal": summary.subtotal or Decimal('0'),
            "total_tax": summary.total_tax or Decimal('0'),
            "total_discount": summary.total_discount or Decimal('0'),
            "average_sale": summary.average_sale or Decimal('0'),
            "payment_breakdown": [
                {
                    "method": method.value,
                    "count": count,
                    "amount": amount
                }
                for method, count, amount in payment_breakdown
            ]
        }
    
    def get_top_selling_products(
        self,
        db: Session,
        *,
        branch_id: Optional[UUID] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get top selling products"""
        query = db.query(
            SalesTransactionItem.product_id,
            func.sum(SalesTransactionItem.quantity).label("total_sold"),
            func.sum(SalesTransactionItem.total_price).label("total_revenue"),
            func.count(SalesTransactionItem.id).label("transaction_count")
        ).join(SalesTransaction)
        
        query = query.filter(SalesTransaction.status == TransactionStatus.COMPLETED)
        
        if branch_id:
            query = query.filter(SalesTransaction.branch_id == branch_id)
        
        if date_from:
            query = query.filter(SalesTransaction.created_at >= date_from)
        
        if date_to:
            query = query.filter(SalesTransaction.created_at <= date_to)
        
        results = query.group_by(
            SalesTransactionItem.product_id
        ).order_by(
            desc(func.sum(SalesTransactionItem.quantity))
        ).limit(limit).all()
        
        # Add product details
        top_products = []
        for result in results:
            product = db.query(Product).filter(Product.id == result.product_id).first()
            if product:
                top_products.append({
                    "product_id": str(result.product_id),
                    "product_name": product.product_name,
                    "product_sku": product.sku,
                    "total_sold": result.total_sold,
                    "total_revenue": result.total_revenue,
                    "transaction_count": result.transaction_count
                })
        
        return top_products
    
    def get_hourly_sales(
        self,
        db: Session,
        *,
        branch_id: Optional[UUID] = None,
        date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Get hourly sales breakdown"""
        if not date:
            date = datetime.now().date()
        
        query = db.query(
            func.extract('hour', SalesTransaction.created_at).label("hour"),
            func.count(SalesTransaction.id).label("transaction_count"),
            func.sum(SalesTransaction.total_amount).label("total_amount")
        ).filter(
            and_(
                SalesTransaction.status == TransactionStatus.COMPLETED,
                func.date(SalesTransaction.created_at) == date
            )
        )
        
        if branch_id:
            query = query.filter(SalesTransaction.branch_id == branch_id)
        
        results = query.group_by(
            func.extract('hour', SalesTransaction.created_at)
        ).order_by(
            func.extract('hour', SalesTransaction.created_at)
        ).all()
        
        # Fill in missing hours with zeros
        hourly_data = {}
        for hour in range(24):
            hourly_data[hour] = {
                "hour": hour,
                "transaction_count": 0,
                "total_amount": Decimal('0')
            }
        
        for result in results:
            hour = int(result.hour)
            hourly_data[hour] = {
                "hour": hour,
                "transaction_count": result.transaction_count,
                "total_amount": result.total_amount or Decimal('0')
            }
        
        return list(hourly_data.values())
    
    def get_customer_purchase_history(
        self,
        db: Session,
        *,
        customer_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> Dict[str, Any]:
        """Get customer purchase history and statistics"""
        # Get transactions
        transactions = self.get_by_customer(
            db,
            customer_id=customer_id,
            skip=skip,
            limit=limit
        )
        
        # Get customer statistics
        stats = db.query(
            func.count(SalesTransaction.id).label("total_transactions"),
            func.sum(SalesTransaction.total_amount).label("total_spent"),
            func.avg(SalesTransaction.total_amount).label("average_order"),
            func.max(SalesTransaction.created_at).label("last_purchase")
        ).filter(
            and_(
                SalesTransaction.customer_id == customer_id,
                SalesTransaction.status == TransactionStatus.COMPLETED
            )
        ).first()
        
        # Get favorite products
        favorite_products = db.query(
            SalesTransactionItem.product_id,
            func.sum(SalesTransactionItem.quantity).label("total_bought"),
            func.count(SalesTransactionItem.id).label("purchase_count")
        ).join(SalesTransaction).filter(
            and_(
                SalesTransaction.customer_id == customer_id,
                SalesTransaction.status == TransactionStatus.COMPLETED
            )
        ).group_by(
            SalesTransactionItem.product_id
        ).order_by(
            desc(func.sum(SalesTransactionItem.quantity))
        ).limit(5).all()
        
        return {
            "transactions": transactions,
            "statistics": {
                "total_transactions": stats.total_transactions or 0,
                "total_spent": stats.total_spent or Decimal('0'),
                "average_order": stats.average_order or Decimal('0'),
                "last_purchase": stats.last_purchase
            },
            "favorite_products": [
                {
                    "product_id": str(fav.product_id),
                    "total_bought": fav.total_bought,
                    "purchase_count": fav.purchase_count
                }
                for fav in favorite_products
            ]
        }


# Create the sales CRUD instance
sales_crud = CRUDSales(SalesTransaction)