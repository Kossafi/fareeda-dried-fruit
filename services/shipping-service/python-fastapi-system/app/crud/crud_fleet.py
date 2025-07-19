"""
CRUD operations for Fleet Management (Vehicles, Drivers, Routes)
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc

from app.crud.base import CRUDBase
from app.models.shipping import Vehicle, Driver, DeliveryRoute, VehicleStatus, DriverStatus
from app.schemas.shipping import (
    VehicleCreate, VehicleUpdate, DriverCreate, DriverUpdate,
    DeliveryRouteCreate, DeliveryRouteUpdate
)


class CRUDVehicle(CRUDBase[Vehicle, VehicleCreate, VehicleUpdate]):
    """CRUD operations for Vehicle model"""
    
    def get_by_license_plate(self, db: Session, *, license_plate: str) -> Optional[Vehicle]:
        """Get vehicle by license plate"""
        return db.query(Vehicle).filter(Vehicle.license_plate == license_plate).first()
    
    def get_available_vehicles(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[Vehicle]:
        """Get available vehicles"""
        return db.query(Vehicle).filter(
            and_(
                Vehicle.status == VehicleStatus.AVAILABLE,
                Vehicle.is_available == True
            )
        ).offset(skip).limit(limit).all()
    
    def get_by_type(
        self,
        db: Session,
        *,
        vehicle_type: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Vehicle]:
        """Get vehicles by type"""
        return db.query(Vehicle).filter(
            Vehicle.vehicle_type == vehicle_type
        ).offset(skip).limit(limit).all()
    
    def get_maintenance_due(
        self,
        db: Session,
        *,
        days_ahead: int = 30,
        skip: int = 0,
        limit: int = 100
    ) -> List[Vehicle]:
        """Get vehicles with maintenance due"""
        due_date = datetime.utcnow() + timedelta(days=days_ahead)
        
        return db.query(Vehicle).filter(
            and_(
                Vehicle.next_maintenance <= due_date,
                Vehicle.status != VehicleStatus.MAINTENANCE
            )
        ).order_by(Vehicle.next_maintenance).offset(skip).limit(limit).all()
    
    def update_mileage(
        self,
        db: Session,
        *,
        vehicle_id: UUID,
        new_mileage: int
    ) -> Vehicle:
        """Update vehicle mileage"""
        vehicle = self.get(db, id=vehicle_id)
        if not vehicle:
            raise ValueError("Vehicle not found")
        
        vehicle.mileage = new_mileage
        
        # Check if maintenance is due based on mileage
        if vehicle.mileage and vehicle.last_maintenance:
            mileage_since_maintenance = vehicle.mileage - (vehicle.last_maintenance_mileage or 0)
            if mileage_since_maintenance >= 10000:  # 10,000 km maintenance interval
                vehicle.next_maintenance = datetime.utcnow() + timedelta(days=7)
        
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
        
        return vehicle
    
    def schedule_maintenance(
        self,
        db: Session,
        *,
        vehicle_id: UUID,
        maintenance_date: datetime,
        maintenance_type: str,
        notes: Optional[str] = None
    ) -> Vehicle:
        """Schedule vehicle maintenance"""
        vehicle = self.get(db, id=vehicle_id)
        if not vehicle:
            raise ValueError("Vehicle not found")
        
        vehicle.status = VehicleStatus.MAINTENANCE
        vehicle.is_available = False
        vehicle.next_maintenance = maintenance_date
        
        # Create maintenance record
        from app.models.shipping import VehicleMaintenanceRecord
        
        maintenance_record = VehicleMaintenanceRecord(
            vehicle_id=vehicle_id,
            maintenance_type=maintenance_type,
            scheduled_date=maintenance_date,
            notes=notes,
            status="scheduled"
        )
        
        db.add(vehicle)
        db.add(maintenance_record)
        db.commit()
        db.refresh(vehicle)
        
        return vehicle
    
    def complete_maintenance(
        self,
        db: Session,
        *,
        vehicle_id: UUID,
        maintenance_cost: Decimal,
        performed_by: str,
        notes: Optional[str] = None
    ) -> Vehicle:
        """Complete vehicle maintenance"""
        vehicle = self.get(db, id=vehicle_id)
        if not vehicle:
            raise ValueError("Vehicle not found")
        
        vehicle.status = VehicleStatus.AVAILABLE
        vehicle.is_available = True
        vehicle.last_maintenance = datetime.utcnow()
        vehicle.last_maintenance_mileage = vehicle.mileage
        
        # Calculate next maintenance date (3 months or 10,000 km)
        vehicle.next_maintenance = datetime.utcnow() + timedelta(days=90)
        
        # Update maintenance record
        from app.models.shipping import VehicleMaintenanceRecord
        
        maintenance_record = db.query(VehicleMaintenanceRecord).filter(
            and_(
                VehicleMaintenanceRecord.vehicle_id == vehicle_id,
                VehicleMaintenanceRecord.status == "scheduled"
            )
        ).first()
        
        if maintenance_record:
            maintenance_record.status = "completed"
            maintenance_record.completed_date = datetime.utcnow()
            maintenance_record.cost = maintenance_cost
            maintenance_record.performed_by = performed_by
            maintenance_record.notes = notes
        
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
        
        return vehicle
    
    def get_vehicle_statistics(self, db: Session) -> Dict[str, Any]:
        """Get vehicle statistics"""
        total_vehicles = db.query(Vehicle).count()
        
        # Vehicles by status
        status_counts = {}
        for status in VehicleStatus:
            count = db.query(Vehicle).filter(Vehicle.status == status).count()
            status_counts[status.value] = count
        
        # Maintenance due
        maintenance_due = len(self.get_maintenance_due(db, days_ahead=30))
        
        return {
            "total_vehicles": total_vehicles,
            "status_breakdown": status_counts,
            "maintenance_due": maintenance_due
        }


class CRUDDriver(CRUDBase[Driver, DriverCreate, DriverUpdate]):
    """CRUD operations for Driver model"""
    
    def get_by_employee_id(self, db: Session, *, employee_id: str) -> Optional[Driver]:
        """Get driver by employee ID"""
        return db.query(Driver).filter(Driver.employee_id == employee_id).first()
    
    def get_by_license_number(self, db: Session, *, license_number: str) -> Optional[Driver]:
        """Get driver by license number"""
        return db.query(Driver).filter(Driver.license_number == license_number).first()
    
    def get_available_drivers(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[Driver]:
        """Get available drivers"""
        return db.query(Driver).filter(
            and_(
                Driver.status == DriverStatus.AVAILABLE,
                Driver.is_available == True
            )
        ).offset(skip).limit(limit).all()
    
    def get_license_expiring(
        self,
        db: Session,
        *,
        days_ahead: int = 30,
        skip: int = 0,
        limit: int = 100
    ) -> List[Driver]:
        """Get drivers with license expiring soon"""
        expiry_date = datetime.utcnow() + timedelta(days=days_ahead)
        
        return db.query(Driver).filter(
            Driver.license_expiry <= expiry_date
        ).order_by(Driver.license_expiry).offset(skip).limit(limit).all()
    
    def update_rating(
        self,
        db: Session,
        *,
        driver_id: UUID,
        new_rating: float
    ) -> Driver:
        """Update driver rating"""
        driver = self.get(db, id=driver_id)
        if not driver:
            raise ValueError("Driver not found")
        
        # Calculate new average rating
        if driver.rating:
            # Simple average (in production, you'd track rating count)
            driver.rating = (driver.rating + new_rating) / 2
        else:
            driver.rating = new_rating
        
        db.add(driver)
        db.commit()
        db.refresh(driver)
        
        return driver
    
    def get_driver_performance(
        self,
        db: Session,
        *,
        driver_id: UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get driver performance statistics"""
        from app.models.shipping import Shipment
        
        query = db.query(Shipment).join(DeliveryRoute).filter(
            DeliveryRoute.driver_id == driver_id
        )
        
        if date_from:
            query = query.filter(Shipment.created_at >= date_from)
        
        if date_to:
            query = query.filter(Shipment.created_at <= date_to)
        
        deliveries = query.all()
        
        # Calculate performance metrics
        total_deliveries = len(deliveries)
        on_time_deliveries = len([
            d for d in deliveries 
            if d.delivered_at and d.estimated_delivery_date and d.delivered_at <= d.estimated_delivery_date
        ])
        
        on_time_rate = (on_time_deliveries / total_deliveries * 100) if total_deliveries > 0 else 0
        
        return {
            "total_deliveries": total_deliveries,
            "on_time_deliveries": on_time_deliveries,
            "late_deliveries": total_deliveries - on_time_deliveries,
            "on_time_rate": round(on_time_rate, 2)
        }
    
    def get_driver_statistics(self, db: Session) -> Dict[str, Any]:
        """Get driver statistics"""
        total_drivers = db.query(Driver).count()
        
        # Drivers by status
        status_counts = {}
        for status in DriverStatus:
            count = db.query(Driver).filter(Driver.status == status).count()
            status_counts[status.value] = count
        
        # License expiring
        license_expiring = len(self.get_license_expiring(db, days_ahead=30))
        
        return {
            "total_drivers": total_drivers,
            "status_breakdown": status_counts,
            "license_expiring": license_expiring
        }


class CRUDDeliveryRoute(CRUDBase[DeliveryRoute, DeliveryRouteCreate, DeliveryRouteUpdate]):
    """CRUD operations for DeliveryRoute model"""
    
    def get_by_name(self, db: Session, *, route_name: str) -> Optional[DeliveryRoute]:
        """Get route by name"""
        return db.query(DeliveryRoute).filter(DeliveryRoute.route_name == route_name).first()
    
    def get_active_routes(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[DeliveryRoute]:
        """Get active routes"""
        return db.query(DeliveryRoute).filter(
            DeliveryRoute.is_active == True
        ).offset(skip).limit(limit).all()
    
    def get_by_driver(
        self,
        db: Session,
        *,
        driver_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[DeliveryRoute]:
        """Get routes by driver"""
        return db.query(DeliveryRoute).filter(
            DeliveryRoute.driver_id == driver_id
        ).offset(skip).limit(limit).all()
    
    def get_by_vehicle(
        self,
        db: Session,
        *,
        vehicle_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[DeliveryRoute]:
        """Get routes by vehicle"""
        return db.query(DeliveryRoute).filter(
            DeliveryRoute.vehicle_id == vehicle_id
        ).offset(skip).limit(limit).all()
    
    def get_route_performance(
        self,
        db: Session,
        *,
        route_id: UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get route performance statistics"""
        from app.models.shipping import Shipment
        
        query = db.query(Shipment).filter(Shipment.route_id == route_id)
        
        if date_from:
            query = query.filter(Shipment.created_at >= date_from)
        
        if date_to:
            query = query.filter(Shipment.created_at <= date_to)
        
        shipments = query.all()
        
        # Calculate performance metrics
        total_shipments = len(shipments)
        completed_shipments = len([s for s in shipments if s.status == "delivered"])
        
        success_rate = (completed_shipments / total_shipments * 100) if total_shipments > 0 else 0
        
        return {
            "total_shipments": total_shipments,
            "completed_shipments": completed_shipments,
            "success_rate": round(success_rate, 2)
        }
    
    def optimize_route_assignment(
        self,
        db: Session,
        *,
        date: datetime
    ) -> List[Dict[str, Any]]:
        """Optimize route assignments for a date"""
        # Get available routes
        available_routes = self.get_active_routes(db)
        
        # Get pending shipments
        from app.models.shipping import Shipment, ShipmentStatus
        pending_shipments = db.query(Shipment).filter(
            and_(
                Shipment.status == ShipmentStatus.PENDING,
                func.date(Shipment.scheduled_delivery_date) == date.date()
            )
        ).all()
        
        # Simple optimization algorithm
        route_assignments = []
        
        for route in available_routes:
            # Check route capacity
            if not route.vehicle:
                continue
            
            max_weight = route.vehicle.max_weight
            max_volume = route.vehicle.max_volume
            
            current_weight = Decimal('0')
            current_volume = Decimal('0')
            assigned_shipments = []
            
            for shipment in pending_shipments:
                # Check if shipment fits
                if (current_weight + shipment.total_weight <= max_weight and
                    current_volume + shipment.total_volume <= max_volume):
                    
                    assigned_shipments.append(shipment)
                    current_weight += shipment.total_weight
                    current_volume += shipment.total_volume
                    
                    # Remove from pending list
                    pending_shipments.remove(shipment)
            
            if assigned_shipments:
                route_assignments.append({
                    "route": route,
                    "shipments": assigned_shipments,
                    "total_weight": current_weight,
                    "total_volume": current_volume,
                    "utilization": {
                        "weight": float(current_weight / max_weight * 100),
                        "volume": float(current_volume / max_volume * 100)
                    }
                })
        
        return route_assignments


# Create CRUD instances
vehicle_crud = CRUDVehicle(Vehicle)
driver_crud = CRUDDriver(Driver)
delivery_route_crud = CRUDDeliveryRoute(DeliveryRoute)