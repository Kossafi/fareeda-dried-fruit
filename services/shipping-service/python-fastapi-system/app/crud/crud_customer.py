"""
CRUD operations for Customer model
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc

from app.crud.base import CRUDBase
from app.models.sales import Customer, CustomerTier, CustomerStatus
from app.schemas.sales import CustomerCreate, CustomerUpdate


class CRUDCustomer(CRUDBase[Customer, CustomerCreate, CustomerUpdate]):
    """CRUD operations for Customer model"""
    
    def get_by_email(self, db: Session, *, email: str) -> Optional[Customer]:
        """Get customer by email"""
        return db.query(Customer).filter(Customer.email == email).first()
    
    def get_by_phone(self, db: Session, *, phone: str) -> Optional[Customer]:
        """Get customer by phone number"""
        return db.query(Customer).filter(Customer.phone == phone).first()
    
    def get_by_customer_code(self, db: Session, *, customer_code: str) -> Optional[Customer]:
        """Get customer by customer code"""
        return db.query(Customer).filter(Customer.customer_code == customer_code).first()
    
    def search_customers(
        self,
        db: Session,
        *,
        search_query: str,
        tier: Optional[CustomerTier] = None,
        status: Optional[CustomerStatus] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Customer]:
        """Search customers with filters"""
        query = db.query(Customer)
        
        # Apply search query
        if search_query:
            search_filter = or_(
                Customer.first_name.ilike(f"%{search_query}%"),
                Customer.last_name.ilike(f"%{search_query}%"),
                Customer.email.ilike(f"%{search_query}%"),
                Customer.phone.ilike(f"%{search_query}%"),
                Customer.customer_code.ilike(f"%{search_query}%")
            )
            query = query.filter(search_filter)
        
        # Apply filters
        if tier:
            query = query.filter(Customer.tier == tier)
        
        if status:
            query = query.filter(Customer.status == status)
        
        return query.order_by(desc(Customer.created_at)).offset(skip).limit(limit).all()
    
    def get_by_tier(
        self,
        db: Session,
        *,
        tier: CustomerTier,
        skip: int = 0,
        limit: int = 100
    ) -> List[Customer]:
        """Get customers by tier"""
        return db.query(Customer).filter(
            Customer.tier == tier
        ).order_by(desc(Customer.total_spent)).offset(skip).limit(limit).all()
    
    def get_active_customers(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[Customer]:
        """Get active customers only"""
        return db.query(Customer).filter(
            Customer.status == CustomerStatus.ACTIVE
        ).order_by(desc(Customer.last_purchase_date)).offset(skip).limit(limit).all()
    
    def get_vip_customers(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[Customer]:
        """Get VIP customers"""
        return db.query(Customer).filter(
            Customer.tier == CustomerTier.VIP
        ).order_by(desc(Customer.total_spent)).offset(skip).limit(limit).all()
    
    def update_customer_stats(
        self,
        db: Session,
        *,
        customer_id: UUID,
        purchase_amount: Decimal,
        purchase_date: datetime
    ) -> Customer:
        """Update customer statistics after purchase"""
        customer = self.get(db, id=customer_id)
        if not customer:
            return None
        
        # Update stats
        customer.total_spent += purchase_amount
        customer.total_orders += 1
        customer.last_purchase_date = purchase_date
        
        # Update tier based on total spent
        if customer.total_spent >= 100000:  # 100,000 THB
            customer.tier = CustomerTier.VIP
        elif customer.total_spent >= 50000:  # 50,000 THB
            customer.tier = CustomerTier.PREMIUM
        elif customer.total_spent >= 10000:  # 10,000 THB
            customer.tier = CustomerTier.GOLD
        else:
            customer.tier = CustomerTier.REGULAR
        
        # Update loyalty points (1 point per 100 THB spent)
        points_earned = int(purchase_amount / 100)
        customer.loyalty_points += points_earned
        
        db.add(customer)
        db.commit()
        db.refresh(customer)
        
        return customer
    
    def redeem_loyalty_points(
        self,
        db: Session,
        *,
        customer_id: UUID,
        points_to_redeem: int,
        redemption_value: Decimal,
        notes: Optional[str] = None
    ) -> Customer:
        """Redeem customer loyalty points"""
        customer = self.get(db, id=customer_id)
        if not customer:
            raise ValueError("Customer not found")
        
        if customer.loyalty_points < points_to_redeem:
            raise ValueError("Insufficient loyalty points")
        
        # Deduct points
        customer.loyalty_points -= points_to_redeem
        customer.points_redeemed += points_to_redeem
        
        # Record redemption
        # TODO: Create loyalty point transaction record
        
        db.add(customer)
        db.commit()
        db.refresh(customer)
        
        return customer
    
    def get_customer_statistics(self, db: Session) -> Dict[str, Any]:
        """Get customer statistics"""
        # Total customers
        total_customers = db.query(Customer).count()
        
        # Active customers
        active_customers = db.query(Customer).filter(
            Customer.status == CustomerStatus.ACTIVE
        ).count()
        
        # Customers by tier
        customers_by_tier = {}
        for tier in CustomerTier:
            count = db.query(Customer).filter(Customer.tier == tier).count()
            customers_by_tier[tier.value] = count
        
        # New customers (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        new_customers = db.query(Customer).filter(
            Customer.created_at >= thirty_days_ago
        ).count()
        
        # Recent activity (customers who purchased in last 30 days)
        recent_activity = db.query(Customer).filter(
            and_(
                Customer.last_purchase_date >= thirty_days_ago,
                Customer.last_purchase_date != None
            )
        ).count()
        
        # Top spenders
        top_spenders = db.query(Customer).order_by(
            desc(Customer.total_spent)
        ).limit(10).all()
        
        return {
            "total_customers": total_customers,
            "active_customers": active_customers,
            "customers_by_tier": customers_by_tier,
            "new_customers_30_days": new_customers,
            "recent_activity": recent_activity,
            "top_spenders": [
                {
                    "customer_id": str(customer.id),
                    "name": customer.full_name,
                    "total_spent": customer.total_spent,
                    "tier": customer.tier.value
                }
                for customer in top_spenders
            ]
        }
    
    def get_inactive_customers(
        self,
        db: Session,
        *,
        days_inactive: int = 90,
        skip: int = 0,
        limit: int = 100
    ) -> List[Customer]:
        """Get customers who haven't purchased in specified days"""
        cutoff_date = datetime.utcnow() - timedelta(days=days_inactive)
        
        return db.query(Customer).filter(
            or_(
                Customer.last_purchase_date < cutoff_date,
                Customer.last_purchase_date == None
            )
        ).order_by(desc(Customer.last_purchase_date)).offset(skip).limit(limit).all()
    
    def get_birthday_customers(
        self,
        db: Session,
        *,
        month: Optional[int] = None,
        day: Optional[int] = None
    ) -> List[Customer]:
        """Get customers with birthdays in specified month/day"""
        query = db.query(Customer).filter(Customer.date_of_birth != None)
        
        if month:
            query = query.filter(func.extract('month', Customer.date_of_birth) == month)
        
        if day:
            query = query.filter(func.extract('day', Customer.date_of_birth) == day)
        
        return query.order_by(Customer.date_of_birth).all()
    
    def bulk_update_tier(
        self,
        db: Session,
        *,
        customer_ids: List[UUID],
        new_tier: CustomerTier
    ) -> List[Customer]:
        """Bulk update customer tier"""
        customers = db.query(Customer).filter(
            Customer.id.in_(customer_ids)
        ).all()
        
        for customer in customers:
            customer.tier = new_tier
        
        db.commit()
        
        for customer in customers:
            db.refresh(customer)
        
        return customers
    
    def export_customer_data(
        self,
        db: Session,
        *,
        include_inactive: bool = False,
        tier: Optional[CustomerTier] = None
    ) -> List[Dict[str, Any]]:
        """Export customer data for reports"""
        query = db.query(Customer)
        
        if not include_inactive:
            query = query.filter(Customer.status == CustomerStatus.ACTIVE)
        
        if tier:
            query = query.filter(Customer.tier == tier)
        
        customers = query.order_by(Customer.created_at).all()
        
        export_data = []
        for customer in customers:
            export_data.append({
                "customer_code": customer.customer_code,
                "name": customer.full_name,
                "email": customer.email,
                "phone": customer.phone,
                "tier": customer.tier.value,
                "status": customer.status.value,
                "total_spent": float(customer.total_spent),
                "total_orders": customer.total_orders,
                "loyalty_points": customer.loyalty_points,
                "last_purchase_date": customer.last_purchase_date.isoformat() if customer.last_purchase_date else None,
                "created_at": customer.created_at.isoformat(),
                "date_of_birth": customer.date_of_birth.isoformat() if customer.date_of_birth else None
            })
        
        return export_data
    
    def generate_customer_code(self, db: Session) -> str:
        """Generate unique customer code"""
        # Get current count
        count = db.query(Customer).count()
        
        # Format: CUST000001
        return f"CUST{str(count + 1).zfill(6)}"
    
    def merge_customers(
        self,
        db: Session,
        *,
        primary_customer_id: UUID,
        duplicate_customer_id: UUID
    ) -> Customer:
        """Merge duplicate customer records"""
        primary = self.get(db, id=primary_customer_id)
        duplicate = self.get(db, id=duplicate_customer_id)
        
        if not primary or not duplicate:
            raise ValueError("One or both customers not found")
        
        # Merge statistics
        primary.total_spent += duplicate.total_spent
        primary.total_orders += duplicate.total_orders
        primary.loyalty_points += duplicate.loyalty_points
        primary.points_redeemed += duplicate.points_redeemed
        
        # Keep the most recent purchase date
        if duplicate.last_purchase_date:
            if not primary.last_purchase_date or duplicate.last_purchase_date > primary.last_purchase_date:
                primary.last_purchase_date = duplicate.last_purchase_date
        
        # Update tier based on new total
        if primary.total_spent >= 100000:
            primary.tier = CustomerTier.VIP
        elif primary.total_spent >= 50000:
            primary.tier = CustomerTier.PREMIUM
        elif primary.total_spent >= 10000:
            primary.tier = CustomerTier.GOLD
        
        # Update sales transactions to point to primary customer
        from app.models.sales import SalesTransaction
        db.query(SalesTransaction).filter(
            SalesTransaction.customer_id == duplicate_customer_id
        ).update({"customer_id": primary_customer_id})
        
        # Soft delete duplicate
        duplicate.status = CustomerStatus.MERGED
        duplicate.notes = f"Merged into customer {primary.customer_code}"
        
        db.add(primary)
        db.add(duplicate)
        db.commit()
        db.refresh(primary)
        
        return primary


# Create the customer CRUD instance
customer_crud = CRUDCustomer(Customer)