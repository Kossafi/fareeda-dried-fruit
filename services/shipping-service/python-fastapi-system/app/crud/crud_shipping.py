"""
CRUD operations for Shipping model
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc

from app.crud.base import CRUDBase
from app.models.shipping import (
    Shipment, ShipmentItem, DeliveryRoute, Vehicle, Driver,
    ShipmentStatus, DeliveryStatus, VehicleStatus, DriverStatus
)
from app.schemas.shipping import ShipmentCreate, ShipmentUpdate


class CRUDShipping(CRUDBase[Shipment, ShipmentCreate, ShipmentUpdate]):
    """CRUD operations for Shipping model"""
    
    def get_by_tracking_number(self, db: Session, *, tracking_number: str) -> Optional[Shipment]:
        """Get shipment by tracking number"""
        return db.query(Shipment).filter(
            Shipment.tracking_number == tracking_number
        ).first()
    
    def get_by_branch(
        self,
        db: Session,
        *,
        branch_id: UUID,
        status: Optional[ShipmentStatus] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Shipment]:
        """Get shipments by destination branch"""
        query = db.query(Shipment).filter(
            or_(
                Shipment.from_branch_id == branch_id,
                Shipment.to_branch_id == branch_id
            )
        )
        
        if status:
            query = query.filter(Shipment.status == status)
        
        return query.order_by(desc(Shipment.created_at)).offset(skip).limit(limit).all()
    
    def get_by_route(
        self,
        db: Session,
        *,
        route_id: UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Shipment]:
        """Get shipments by delivery route"""
        query = db.query(Shipment).filter(Shipment.route_id == route_id)
        
        if date_from:
            query = query.filter(Shipment.created_at >= date_from)
        
        if date_to:
            query = query.filter(Shipment.created_at <= date_to)
        
        return query.order_by(desc(Shipment.created_at)).offset(skip).limit(limit).all()
    
    def get_by_driver(
        self,
        db: Session,
        *,
        driver_id: UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Shipment]:
        """Get shipments by driver"""
        # Join with DeliveryRoute to get driver
        query = db.query(Shipment).join(DeliveryRoute).filter(
            DeliveryRoute.driver_id == driver_id
        )
        
        if date_from:
            query = query.filter(Shipment.created_at >= date_from)
        
        if date_to:
            query = query.filter(Shipment.created_at <= date_to)
        
        return query.order_by(desc(Shipment.created_at)).offset(skip).limit(limit).all()
    
    def create_shipment(
        self,
        db: Session,
        *,
        from_branch_id: UUID,
        to_branch_id: UUID,
        items: List[Dict[str, Any]],
        priority: str = "normal",
        special_instructions: Optional[str] = None,
        created_by: UUID
    ) -> Shipment:
        """Create a new shipment with items"""
        
        # Generate tracking number
        tracking_number = self._generate_tracking_number(db)
        
        # Calculate totals
        total_weight = Decimal('0')
        total_volume = Decimal('0')
        estimated_value = Decimal('0')
        
        for item in items:
            total_weight += Decimal(str(item.get('weight', 0)))
            total_volume += Decimal(str(item.get('volume', 0)))
            estimated_value += Decimal(str(item.get('value', 0)))
        
        # Create shipment
        shipment = Shipment(
            tracking_number=tracking_number,
            from_branch_id=from_branch_id,
            to_branch_id=to_branch_id,
            total_weight=total_weight,
            total_volume=total_volume,
            estimated_value=estimated_value,
            priority=priority,
            special_instructions=special_instructions,
            status=ShipmentStatus.PENDING,
            created_by=created_by
        )
        
        db.add(shipment)
        db.flush()  # Get the shipment ID
        
        # Create shipment items
        for item_data in items:
            item = ShipmentItem(
                shipment_id=shipment.id,
                product_id=item_data.get('product_id'),
                quantity=Decimal(str(item_data.get('quantity', 0))),
                weight=Decimal(str(item_data.get('weight', 0))),
                volume=Decimal(str(item_data.get('volume', 0))),
                value=Decimal(str(item_data.get('value', 0))),
                description=item_data.get('description'),
                handling_notes=item_data.get('handling_notes')
            )
            db.add(item)
        
        db.commit()
        db.refresh(shipment)
        
        return shipment
    
    def _generate_tracking_number(self, db: Session) -> str:
        """Generate unique tracking number"""
        today = datetime.now().strftime("%Y%m%d")
        
        # Get today's shipment count
        count = db.query(Shipment).filter(
            func.date(Shipment.created_at) == datetime.now().date()
        ).count()
        
        # Format: SH_YYYYMMDD_NNNN
        sequence = str(count + 1).zfill(4)
        return f"SH_{today}_{sequence}"
    
    def update_status(
        self,
        db: Session,
        *,
        shipment_id: UUID,
        status: ShipmentStatus,
        location: Optional[str] = None,
        notes: Optional[str] = None,
        updated_by: UUID
    ) -> Shipment:
        """Update shipment status"""
        shipment = self.get(db, id=shipment_id)
        if not shipment:
            raise ValueError("Shipment not found")
        
        # Update status
        old_status = shipment.status
        shipment.status = status
        
        # Update timestamps based on status
        now = datetime.utcnow()
        if status == ShipmentStatus.IN_TRANSIT:
            shipment.shipped_at = now
        elif status == ShipmentStatus.DELIVERED:
            shipment.delivered_at = now
        elif status == ShipmentStatus.CANCELLED:
            shipment.cancelled_at = now
        
        # Create status history record
        from app.models.shipping import ShipmentStatusHistory
        
        status_history = ShipmentStatusHistory(
            shipment_id=shipment_id,
            old_status=old_status,
            new_status=status,
            location=location,
            notes=notes,
            changed_by=updated_by
        )
        
        db.add(shipment)
        db.add(status_history)
        db.commit()
        db.refresh(shipment)
        
        return shipment
    
    def assign_to_route(
        self,
        db: Session,
        *,
        shipment_id: UUID,
        route_id: UUID,
        assigned_by: UUID
    ) -> Shipment:
        """Assign shipment to delivery route"""
        shipment = self.get(db, id=shipment_id)
        if not shipment:
            raise ValueError("Shipment not found")
        
        # Verify route exists
        route = db.query(DeliveryRoute).filter(DeliveryRoute.id == route_id).first()
        if not route:
            raise ValueError("Route not found")
        
        # Assign to route
        shipment.route_id = route_id
        shipment.status = ShipmentStatus.ASSIGNED
        shipment.assigned_at = datetime.utcnow()
        
        db.add(shipment)
        db.commit()
        db.refresh(shipment)
        
        return shipment
    
    def get_delivery_schedule(
        self,
        db: Session,
        *,
        date: datetime,
        driver_id: Optional[UUID] = None,
        route_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """Get delivery schedule for a specific date"""
        query = db.query(Shipment).join(DeliveryRoute).filter(
            func.date(Shipment.scheduled_delivery_date) == date.date()
        )
        
        if driver_id:
            query = query.filter(DeliveryRoute.driver_id == driver_id)
        
        if route_id:
            query = query.filter(Shipment.route_id == route_id)
        
        shipments = query.order_by(Shipment.scheduled_delivery_date).all()
        
        # Group by route
        schedule = {}
        for shipment in shipments:
            route_name = shipment.route.route_name if shipment.route else "Unassigned"
            if route_name not in schedule:
                schedule[route_name] = {
                    "route_id": str(shipment.route_id) if shipment.route_id else None,
                    "driver_name": shipment.route.driver.full_name if shipment.route and shipment.route.driver else None,
                    "vehicle_number": shipment.route.vehicle.license_plate if shipment.route and shipment.route.vehicle else None,
                    "shipments": []
                }
            
            schedule[route_name]["shipments"].append({
                "shipment_id": str(shipment.id),
                "tracking_number": shipment.tracking_number,
                "to_branch": shipment.to_branch.branch_name if shipment.to_branch else "Unknown",
                "status": shipment.status.value,
                "total_weight": shipment.total_weight,
                "estimated_delivery": shipment.estimated_delivery_date
            })
        
        return list(schedule.values())
    
    def get_shipment_statistics(
        self,
        db: Session,
        *,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        branch_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Get shipment statistics"""
        query = db.query(Shipment)
        
        if date_from:
            query = query.filter(Shipment.created_at >= date_from)
        
        if date_to:
            query = query.filter(Shipment.created_at <= date_to)
        
        if branch_id:
            query = query.filter(
                or_(
                    Shipment.from_branch_id == branch_id,
                    Shipment.to_branch_id == branch_id
                )
            )
        
        # Total shipments
        total_shipments = query.count()
        
        # Shipments by status
        status_counts = {}
        for status in ShipmentStatus:
            count = query.filter(Shipment.status == status).count()
            status_counts[status.value] = count
        
        # Average delivery time
        delivered_shipments = query.filter(
            and_(
                Shipment.status == ShipmentStatus.DELIVERED,
                Shipment.delivered_at != None,
                Shipment.shipped_at != None
            )
        ).all()
        
        if delivered_shipments:
            total_delivery_time = sum(
                (s.delivered_at - s.shipped_at).total_seconds() / 3600  # Convert to hours
                for s in delivered_shipments
            )
            average_delivery_time = total_delivery_time / len(delivered_shipments)
        else:
            average_delivery_time = 0
        
        # On-time delivery rate
        on_time_deliveries = len([
            s for s in delivered_shipments
            if s.delivered_at <= s.estimated_delivery_date
        ])
        
        on_time_rate = (on_time_deliveries / len(delivered_shipments) * 100) if delivered_shipments else 0
        
        return {
            "total_shipments": total_shipments,
            "status_breakdown": status_counts,
            "average_delivery_time_hours": round(average_delivery_time, 2),
            "on_time_delivery_rate": round(on_time_rate, 2),
            "delivered_shipments": len(delivered_shipments)
        }
    
    def get_overdue_shipments(
        self,
        db: Session,
        *,
        hours_overdue: int = 24,
        skip: int = 0,
        limit: int = 100
    ) -> List[Shipment]:
        """Get overdue shipments"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_overdue)
        
        return db.query(Shipment).filter(
            and_(
                Shipment.status.in_([ShipmentStatus.PENDING, ShipmentStatus.ASSIGNED, ShipmentStatus.IN_TRANSIT]),
                Shipment.estimated_delivery_date < cutoff_time
            )
        ).order_by(Shipment.estimated_delivery_date).offset(skip).limit(limit).all()
    
    def get_shipment_tracking(
        self,
        db: Session,
        *,
        tracking_number: str
    ) -> Dict[str, Any]:
        """Get complete shipment tracking information"""
        shipment = self.get_by_tracking_number(db, tracking_number=tracking_number)
        if not shipment:
            return None
        
        # Get status history
        from app.models.shipping import ShipmentStatusHistory
        status_history = db.query(ShipmentStatusHistory).filter(
            ShipmentStatusHistory.shipment_id == shipment.id
        ).order_by(ShipmentStatusHistory.created_at).all()
        
        # Get current location (latest status with location)
        current_location = None
        for history in reversed(status_history):
            if history.location:
                current_location = history.location
                break
        
        return {
            "shipment": shipment,
            "current_location": current_location,
            "status_history": status_history,
            "estimated_delivery": shipment.estimated_delivery_date,
            "route_info": {
                "route_name": shipment.route.route_name if shipment.route else None,
                "driver_name": shipment.route.driver.full_name if shipment.route and shipment.route.driver else None,
                "vehicle_plate": shipment.route.vehicle.license_plate if shipment.route and shipment.route.vehicle else None
            }
        }
    
    def optimize_routes(
        self,
        db: Session,
        *,
        date: datetime,
        max_shipments_per_route: int = 10
    ) -> List[Dict[str, Any]]:
        """Optimize delivery routes (simplified algorithm)"""
        # Get pending shipments for the date
        pending_shipments = db.query(Shipment).filter(
            and_(
                Shipment.status == ShipmentStatus.PENDING,
                func.date(Shipment.scheduled_delivery_date) == date.date()
            )
        ).all()
        
        # Get available routes
        available_routes = db.query(DeliveryRoute).filter(
            DeliveryRoute.is_active == True
        ).all()
        
        # Simple optimization: group by destination area
        route_assignments = {}
        
        for shipment in pending_shipments:
            # Find best route (simplified - by destination branch)
            best_route = None
            for route in available_routes:
                if route.end_location == shipment.to_branch.city:
                    best_route = route
                    break
            
            if not best_route and available_routes:
                best_route = available_routes[0]  # Fallback to first available
            
            if best_route:
                route_key = str(best_route.id)
                if route_key not in route_assignments:
                    route_assignments[route_key] = {
                        "route": best_route,
                        "shipments": []
                    }
                
                if len(route_assignments[route_key]["shipments"]) < max_shipments_per_route:
                    route_assignments[route_key]["shipments"].append(shipment)
        
        return list(route_assignments.values())
    
    def bulk_update_status(
        self,
        db: Session,
        *,
        shipment_ids: List[UUID],
        status: ShipmentStatus,
        notes: Optional[str] = None,
        updated_by: UUID
    ) -> List[Shipment]:
        """Bulk update shipment status"""
        updated_shipments = []
        
        for shipment_id in shipment_ids:
            try:
                shipment = self.update_status(
                    db,
                    shipment_id=shipment_id,
                    status=status,
                    notes=notes,
                    updated_by=updated_by
                )
                updated_shipments.append(shipment)
            except ValueError:
                # Skip invalid shipments
                continue
        
        return updated_shipments


# Create the shipping CRUD instance
shipping_crud = CRUDShipping(Shipment)