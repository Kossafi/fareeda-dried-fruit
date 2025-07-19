"""
CRUD operations for Product model
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app.crud.base import CRUDBase
from app.models.product import Product, ProductCategory, ProductStatus, ProductVariant
from app.schemas.product import ProductCreate, ProductUpdate


class CRUDProduct(CRUDBase[Product, ProductCreate, ProductUpdate]):
    """CRUD operations for Product model"""
    
    def get_by_sku(self, db: Session, *, sku: str) -> Optional[Product]:
        """Get product by SKU"""
        return db.query(Product).filter(Product.sku == sku).first()
    
    def get_by_barcode(self, db: Session, *, barcode: str) -> Optional[Product]:
        """Get product by barcode"""
        return db.query(Product).filter(Product.barcode == barcode).first()
    
    def get_active_products(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[Product]:
        """Get active products"""
        return db.query(Product).filter(
            and_(
                Product.status == ProductStatus.ACTIVE,
                Product.is_active == True
            )
        ).offset(skip).limit(limit).all()
    
    def get_by_category(
        self,
        db: Session,
        *,
        category: ProductCategory,
        skip: int = 0,
        limit: int = 100
    ) -> List[Product]:
        """Get products by category"""
        return db.query(Product).filter(
            Product.category == category
        ).offset(skip).limit(limit).all()
    
    def search_products(
        self,
        db: Session,
        *,
        search_query: str,
        category: Optional[ProductCategory] = None,
        status: Optional[ProductStatus] = None,
        min_price: Optional[Decimal] = None,
        max_price: Optional[Decimal] = None,
        in_stock_only: bool = False,
        skip: int = 0,
        limit: int = 100
    ) -> List[Product]:
        """Search products with filters"""
        query = db.query(Product)
        
        # Apply search query
        if search_query:
            search_filter = or_(
                Product.product_name.ilike(f"%{search_query}%"),
                Product.description.ilike(f"%{search_query}%"),
                Product.sku.ilike(f"%{search_query}%"),
                Product.barcode.ilike(f"%{search_query}%"),
                Product.brand.ilike(f"%{search_query}%")
            )
            query = query.filter(search_filter)
        
        # Apply filters
        if category:
            query = query.filter(Product.category == category)
        
        if status:
            query = query.filter(Product.status == status)
        
        if min_price is not None:
            query = query.filter(Product.unit_price >= min_price)
        
        if max_price is not None:
            query = query.filter(Product.unit_price <= max_price)
        
        if in_stock_only:
            # Join with inventory to check stock
            from app.models.inventory import Inventory
            query = query.join(Inventory).filter(
                Inventory.quantity_on_hand > 0
            )
        
        return query.offset(skip).limit(limit).all()
    
    def get_low_stock_products(
        self,
        db: Session,
        *,
        branch_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get products with low stock"""
        from app.models.inventory import Inventory
        
        query = db.query(Product, Inventory).join(Inventory)
        
        if branch_id:
            query = query.filter(Inventory.branch_id == branch_id)
        
        # Get products where quantity_on_hand <= reorder_point
        query = query.filter(
            Inventory.quantity_on_hand <= Inventory.reorder_point
        )
        
        results = query.offset(skip).limit(limit).all()
        
        # Format results
        low_stock_products = []
        for product, inventory in results:
            low_stock_products.append({
                "product": product,
                "inventory": inventory,
                "stock_level": inventory.quantity_on_hand,
                "reorder_point": inventory.reorder_point,
                "shortage": inventory.reorder_point - inventory.quantity_on_hand
            })
        
        return low_stock_products
    
    def get_bestsellers(
        self,
        db: Session,
        *,
        days: int = 30,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get bestselling products"""
        from app.models.sales import SalesTransactionItem
        from datetime import datetime, timedelta
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Query sales data
        results = db.query(
            Product,
            func.sum(SalesTransactionItem.quantity).label("total_sold"),
            func.sum(SalesTransactionItem.total_price).label("total_revenue")
        ).join(
            SalesTransactionItem
        ).filter(
            SalesTransactionItem.created_at >= start_date
        ).group_by(
            Product.id
        ).order_by(
            func.sum(SalesTransactionItem.quantity).desc()
        ).limit(limit).all()
        
        # Format results
        bestsellers = []
        for product, total_sold, total_revenue in results:
            bestsellers.append({
                "product": product,
                "total_sold": total_sold,
                "total_revenue": total_revenue,
                "period_days": days
            })
        
        return bestsellers
    
    def update_price(
        self,
        db: Session,
        *,
        product_id: UUID,
        new_price: Decimal,
        update_variants: bool = True
    ) -> Product:
        """Update product price"""
        product = self.get(db, id=product_id)
        if not product:
            return None
        
        # Store old price for history
        old_price = product.unit_price
        
        # Update price
        product.unit_price = new_price
        product.discounted_price = None  # Clear discount when updating base price
        
        # Update variants if requested
        if update_variants and product.variants:
            for variant in product.variants:
                # Adjust variant price proportionally
                if variant.price_adjustment:
                    price_ratio = variant.price_adjustment / old_price
                    variant.price_adjustment = new_price * price_ratio
        
        db.add(product)
        db.commit()
        db.refresh(product)
        
        return product
    
    def apply_discount(
        self,
        db: Session,
        *,
        product_id: UUID,
        discount_percentage: float
    ) -> Product:
        """Apply discount to product"""
        product = self.get(db, id=product_id)
        if not product:
            return None
        
        # Calculate discounted price
        discount_amount = product.unit_price * (discount_percentage / 100)
        product.discounted_price = product.unit_price - discount_amount
        product.discount_percentage = discount_percentage
        
        db.add(product)
        db.commit()
        db.refresh(product)
        
        return product
    
    def get_expiring_products(
        self,
        db: Session,
        *,
        days: int = 30,
        branch_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get products expiring within specified days"""
        from app.models.inventory import Inventory
        from datetime import datetime, timedelta
        
        expiry_date = datetime.utcnow() + timedelta(days=days)
        
        query = db.query(Product, Inventory).join(Inventory)
        
        if branch_id:
            query = query.filter(Inventory.branch_id == branch_id)
        
        query = query.filter(
            and_(
                Inventory.expiry_date != None,
                Inventory.expiry_date <= expiry_date
            )
        )
        
        results = query.all()
        
        # Format results
        expiring_products = []
        for product, inventory in results:
            days_until_expiry = (inventory.expiry_date - datetime.utcnow()).days
            expiring_products.append({
                "product": product,
                "inventory": inventory,
                "expiry_date": inventory.expiry_date,
                "days_until_expiry": days_until_expiry,
                "quantity": inventory.quantity_on_hand
            })
        
        return expiring_products
    
    def get_product_statistics(
        self,
        db: Session,
        *,
        product_id: UUID
    ) -> Dict[str, Any]:
        """Get comprehensive product statistics"""
        from app.models.inventory import Inventory
        from app.models.sales import SalesTransactionItem
        from datetime import datetime, timedelta
        
        product = self.get(db, id=product_id)
        if not product:
            return None
        
        # Get inventory stats
        inventory_stats = db.query(
            func.sum(Inventory.quantity_on_hand).label("total_stock"),
            func.count(Inventory.id).label("branch_count")
        ).filter(
            Inventory.product_id == product_id
        ).first()
        
        # Get sales stats (last 30 days)
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        sales_stats = db.query(
            func.sum(SalesTransactionItem.quantity).label("units_sold"),
            func.sum(SalesTransactionItem.total_price).label("revenue"),
            func.count(SalesTransactionItem.id).label("transaction_count")
        ).filter(
            and_(
                SalesTransactionItem.product_id == product_id,
                SalesTransactionItem.created_at >= start_date
            )
        ).first()
        
        # Get average rating
        avg_rating = None
        if product.reviews:
            ratings = [review.rating for review in product.reviews]
            avg_rating = sum(ratings) / len(ratings)
        
        return {
            "product": product,
            "inventory": {
                "total_stock": inventory_stats.total_stock or 0,
                "branch_count": inventory_stats.branch_count or 0
            },
            "sales_30_days": {
                "units_sold": sales_stats.units_sold or 0,
                "revenue": sales_stats.revenue or 0,
                "transaction_count": sales_stats.transaction_count or 0
            },
            "ratings": {
                "average": avg_rating,
                "count": len(product.reviews) if product.reviews else 0
            }
        }
    
    def bulk_update_status(
        self,
        db: Session,
        *,
        product_ids: List[UUID],
        status: ProductStatus
    ) -> List[Product]:
        """Bulk update product status"""
        products = db.query(Product).filter(
            Product.id.in_(product_ids)
        ).all()
        
        for product in products:
            product.status = status
            if status == ProductStatus.DISCONTINUED:
                product.is_active = False
        
        db.commit()
        
        for product in products:
            db.refresh(product)
        
        return products


# Create the product CRUD instance
product_crud = CRUDProduct(Product)