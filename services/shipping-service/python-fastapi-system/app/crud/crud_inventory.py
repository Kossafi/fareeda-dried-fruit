"""
CRUD operations for Inventory model
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app.crud.base import CRUDBase
from app.models.inventory import Inventory, StockMovement, MovementType, MovementReason
from app.models.product import Product
from app.schemas.inventory import InventoryCreate, InventoryUpdate, StockMovementCreate


class CRUDInventory(CRUDBase[Inventory, InventoryCreate, InventoryUpdate]):
    """CRUD operations for Inventory model"""
    
    def get_by_product_branch(
        self,
        db: Session,
        *,
        product_id: UUID,
        branch_id: UUID
    ) -> Optional[Inventory]:
        """Get inventory by product and branch"""
        return db.query(Inventory).filter(
            and_(
                Inventory.product_id == product_id,
                Inventory.branch_id == branch_id
            )
        ).first()
    
    def get_by_branch(
        self,
        db: Session,
        *,
        branch_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[Inventory]:
        """Get all inventory for a branch"""
        return db.query(Inventory).filter(
            Inventory.branch_id == branch_id
        ).offset(skip).limit(limit).all()
    
    def get_by_product(
        self,
        db: Session,
        *,
        product_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[Inventory]:
        """Get all inventory for a product across branches"""
        return db.query(Inventory).filter(
            Inventory.product_id == product_id
        ).offset(skip).limit(limit).all()
    
    def update_stock(
        self,
        db: Session,
        *,
        inventory_id: UUID,
        quantity_change: Decimal,
        movement_type: MovementType,
        reason: MovementReason,
        reference_id: Optional[str] = None,
        notes: Optional[str] = None,
        user_id: UUID = None
    ) -> Inventory:
        """Update inventory stock with movement tracking"""
        inventory = self.get(db, id=inventory_id)
        if not inventory:
            return None
        
        # Calculate new quantity
        old_quantity = inventory.quantity_on_hand
        
        if movement_type in [MovementType.IN, MovementType.RETURN, MovementType.PRODUCTION]:
            new_quantity = old_quantity + quantity_change
        else:
            new_quantity = old_quantity - quantity_change
        
        # Validate quantity
        if new_quantity < 0:
            raise ValueError("Insufficient stock")
        
        # Update inventory
        inventory.quantity_on_hand = new_quantity
        inventory.last_movement_date = datetime.utcnow()
        
        # Create stock movement record
        movement = StockMovement(
            inventory_id=inventory_id,
            product_id=inventory.product_id,
            branch_id=inventory.branch_id,
            movement_type=movement_type,
            reason=reason,
            quantity=quantity_change,
            quantity_before=old_quantity,
            quantity_after=new_quantity,
            reference_id=reference_id,
            notes=notes,
            created_by=user_id
        )
        
        db.add(inventory)
        db.add(movement)
        db.commit()
        db.refresh(inventory)
        
        return inventory
    
    def transfer_stock(
        self,
        db: Session,
        *,
        product_id: UUID,
        from_branch_id: UUID,
        to_branch_id: UUID,
        quantity: Decimal,
        user_id: UUID,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Transfer stock between branches"""
        # Get source inventory
        from_inventory = self.get_by_product_branch(
            db,
            product_id=product_id,
            branch_id=from_branch_id
        )
        
        if not from_inventory:
            raise ValueError("Source inventory not found")
        
        if from_inventory.quantity_on_hand < quantity:
            raise ValueError("Insufficient stock in source branch")
        
        # Get or create destination inventory
        to_inventory = self.get_by_product_branch(
            db,
            product_id=product_id,
            branch_id=to_branch_id
        )
        
        if not to_inventory:
            # Create new inventory record
            to_inventory = Inventory(
                product_id=product_id,
                branch_id=to_branch_id,
                quantity_on_hand=0,
                quantity_reserved=0,
                reorder_point=10,  # Default
                reorder_quantity=50  # Default
            )
            db.add(to_inventory)
            db.flush()
        
        # Update source inventory
        from_inventory = self.update_stock(
            db,
            inventory_id=from_inventory.id,
            quantity_change=quantity,
            movement_type=MovementType.OUT,
            reason=MovementReason.TRANSFER,
            reference_id=f"TRANSFER-{to_branch_id}",
            notes=notes,
            user_id=user_id
        )
        
        # Update destination inventory
        to_inventory = self.update_stock(
            db,
            inventory_id=to_inventory.id,
            quantity_change=quantity,
            movement_type=MovementType.IN,
            reason=MovementReason.TRANSFER,
            reference_id=f"TRANSFER-{from_branch_id}",
            notes=notes,
            user_id=user_id
        )
        
        return {
            "from_inventory": from_inventory,
            "to_inventory": to_inventory,
            "quantity_transferred": quantity
        }
    
    def reserve_stock(
        self,
        db: Session,
        *,
        inventory_id: UUID,
        quantity: Decimal,
        order_id: str
    ) -> Inventory:
        """Reserve stock for an order"""
        inventory = self.get(db, id=inventory_id)
        if not inventory:
            return None
        
        available = inventory.quantity_on_hand - inventory.quantity_reserved
        if available < quantity:
            raise ValueError("Insufficient available stock")
        
        inventory.quantity_reserved += quantity
        
        db.add(inventory)
        db.commit()
        db.refresh(inventory)
        
        return inventory
    
    def release_reservation(
        self,
        db: Session,
        *,
        inventory_id: UUID,
        quantity: Decimal,
        order_id: str
    ) -> Inventory:
        """Release reserved stock"""
        inventory = self.get(db, id=inventory_id)
        if not inventory:
            return None
        
        inventory.quantity_reserved = max(0, inventory.quantity_reserved - quantity)
        
        db.add(inventory)
        db.commit()
        db.refresh(inventory)
        
        return inventory
    
    def get_low_stock(
        self,
        db: Session,
        *,
        branch_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get inventory items below reorder point"""
        query = db.query(Inventory, Product).join(Product)
        
        if branch_id:
            query = query.filter(Inventory.branch_id == branch_id)
        
        query = query.filter(
            Inventory.quantity_on_hand <= Inventory.reorder_point
        )
        
        results = query.offset(skip).limit(limit).all()
        
        low_stock_items = []
        for inventory, product in results:
            low_stock_items.append({
                "inventory": inventory,
                "product": product,
                "available": inventory.quantity_on_hand - inventory.quantity_reserved,
                "shortage": inventory.reorder_point - inventory.quantity_on_hand
            })
        
        return low_stock_items
    
    def get_expiring_stock(
        self,
        db: Session,
        *,
        days: int = 30,
        branch_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """Get inventory items expiring within specified days"""
        expiry_date = datetime.utcnow() + timedelta(days=days)
        
        query = db.query(Inventory, Product).join(Product)
        
        if branch_id:
            query = query.filter(Inventory.branch_id == branch_id)
        
        query = query.filter(
            and_(
                Inventory.expiry_date != None,
                Inventory.expiry_date <= expiry_date,
                Inventory.quantity_on_hand > 0
            )
        )
        
        results = query.all()
        
        expiring_items = []
        for inventory, product in results:
            days_until_expiry = (inventory.expiry_date - datetime.utcnow()).days
            expiring_items.append({
                "inventory": inventory,
                "product": product,
                "days_until_expiry": days_until_expiry,
                "quantity": inventory.quantity_on_hand
            })
        
        return expiring_items
    
    def physical_count(
        self,
        db: Session,
        *,
        inventory_id: UUID,
        counted_quantity: Decimal,
        user_id: UUID,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Record physical inventory count"""
        inventory = self.get(db, id=inventory_id)
        if not inventory:
            return None
        
        # Calculate variance
        variance = counted_quantity - inventory.quantity_on_hand
        
        # Create physical count record
        from app.models.inventory import PhysicalCount
        
        count_record = PhysicalCount(
            inventory_id=inventory_id,
            product_id=inventory.product_id,
            branch_id=inventory.branch_id,
            counted_quantity=counted_quantity,
            system_quantity=inventory.quantity_on_hand,
            variance=variance,
            counted_by=user_id,
            notes=notes
        )
        
        db.add(count_record)
        
        # Update inventory if variance exists
        if variance != 0:
            movement_type = MovementType.IN if variance > 0 else MovementType.OUT
            self.update_stock(
                db,
                inventory_id=inventory_id,
                quantity_change=abs(variance),
                movement_type=movement_type,
                reason=MovementReason.ADJUSTMENT,
                reference_id=f"COUNT-{count_record.id}",
                notes=f"Physical count adjustment: {notes}",
                user_id=user_id
            )
        
        inventory.last_count_date = datetime.utcnow()
        db.add(inventory)
        db.commit()
        
        return {
            "inventory": inventory,
            "count_record": count_record,
            "variance": variance
        }
    
    def get_movement_history(
        self,
        db: Session,
        *,
        inventory_id: Optional[UUID] = None,
        product_id: Optional[UUID] = None,
        branch_id: Optional[UUID] = None,
        movement_type: Optional[MovementType] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[StockMovement]:
        """Get stock movement history"""
        query = db.query(StockMovement)
        
        if inventory_id:
            query = query.filter(StockMovement.inventory_id == inventory_id)
        
        if product_id:
            query = query.filter(StockMovement.product_id == product_id)
        
        if branch_id:
            query = query.filter(StockMovement.branch_id == branch_id)
        
        if movement_type:
            query = query.filter(StockMovement.movement_type == movement_type)
        
        if date_from:
            query = query.filter(StockMovement.created_at >= date_from)
        
        if date_to:
            query = query.filter(StockMovement.created_at <= date_to)
        
        return query.order_by(
            StockMovement.created_at.desc()
        ).offset(skip).limit(limit).all()
    
    def get_stock_value(
        self,
        db: Session,
        *,
        branch_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Calculate total stock value"""
        query = db.query(
            func.sum(Inventory.quantity_on_hand * Product.unit_price).label("total_value"),
            func.count(Inventory.id).label("item_count"),
            func.sum(Inventory.quantity_on_hand).label("total_quantity")
        ).join(Product)
        
        if branch_id:
            query = query.filter(Inventory.branch_id == branch_id)
        
        result = query.first()
        
        return {
            "total_value": result.total_value or 0,
            "item_count": result.item_count or 0,
            "total_quantity": result.total_quantity or 0
        }
    
    def batch_update_reorder_points(
        self,
        db: Session,
        *,
        updates: List[Dict[str, Any]]
    ) -> List[Inventory]:
        """Batch update reorder points"""
        updated_items = []
        
        for update in updates:
            inventory = self.get(db, id=update["inventory_id"])
            if inventory:
                if "reorder_point" in update:
                    inventory.reorder_point = update["reorder_point"]
                if "reorder_quantity" in update:
                    inventory.reorder_quantity = update["reorder_quantity"]
                
                db.add(inventory)
                updated_items.append(inventory)
        
        db.commit()
        
        for item in updated_items:
            db.refresh(item)
        
        return updated_items


# Create the inventory CRUD instance
inventory_crud = CRUDInventory(Inventory)