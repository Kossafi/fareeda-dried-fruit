"""
Demo data generator for the dried fruits inventory system
"""
import random
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any
from uuid import uuid4

from sqlalchemy.orm import Session
from faker import Faker

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.branch import Branch
from app.models.product import Product, ProductCategory, Unit
from app.models.inventory import Inventory, StockMovement, MovementType, MovementReason
from app.models.sales import (
    Customer, CustomerTier, SalesTransaction, SalesTransactionItem,
    TransactionStatus, PaymentMethod
)
from app.models.shipping import (
    Vehicle, VehicleType, VehicleStatus, Driver, DriverStatus,
    DeliveryRoute, Shipment, ShipmentStatus
)
from app.models.barcode import Barcode, BarcodeType
from app.core.security import get_password_hash


class DemoDataGenerator:
    """Generate demo data for the dried fruits inventory system"""
    
    def __init__(self, db: Session):
        self.db = db
        self.fake = Faker(['th_TH', 'en_US'])  # Thai and English locales
        
        # Store generated data for relationships
        self.users = []
        self.branches = []
        self.products = []
        self.customers = []
        self.vehicles = []
        self.drivers = []
        self.routes = []
        
        # Dried fruits product data
        self.dried_fruits = [
            {"name": "มะม่วงแห้ง", "name_en": "Dried Mango", "category": "DRIED_FRUIT", "unit_price": 120},
            {"name": "ลูกเกดแห้ง", "name_en": "Dried Raisins", "category": "DRIED_FRUIT", "unit_price": 85},
            {"name": "แอปเปิ้ลแห้ง", "name_en": "Dried Apple", "category": "DRIED_FRUIT", "unit_price": 95},
            {"name": "กล้วยแห้ง", "name_en": "Dried Banana", "category": "DRIED_FRUIT", "unit_price": 75},
            {"name": "สับปะรดแห้ง", "name_en": "Dried Pineapple", "category": "DRIED_FRUIT", "unit_price": 110},
            {"name": "มะเขือเทศแห้ง", "name_en": "Dried Tomato", "category": "VEGETABLE", "unit_price": 150},
            {"name": "พริกแห้ง", "name_en": "Dried Chili", "category": "SPICE", "unit_price": 200},
            {"name": "ลูกอบเชย", "name_en": "Cinnamon", "category": "SPICE", "unit_price": 180},
            {"name": "กานพลู", "name_en": "Cloves", "category": "SPICE", "unit_price": 220},
            {"name": "มะม่วงหิมพานต์", "name_en": "Cashew Nuts", "category": "NUT", "unit_price": 320},
            {"name": "อัลมอนด์", "name_en": "Almonds", "category": "NUT", "unit_price": 280},
            {"name": "ถั่วลิสง", "name_en": "Peanuts", "category": "NUT", "unit_price": 65},
            {"name": "งาขาว", "name_en": "White Sesame", "category": "SEED", "unit_price": 90},
            {"name": "งาดำ", "name_en": "Black Sesame", "category": "SEED", "unit_price": 95},
            {"name": "เมล็ดฟักทอง", "name_en": "Pumpkin Seeds", "category": "SEED", "unit_price": 120},
        ]
        
        # Thai branch locations
        self.thai_branches = [
            {"name": "สาขาสยาม", "address": "สยามพารากอน ชั้น 1", "city": "กรุงเทพมหานคร", "phone": "02-123-4567"},
            {"name": "สาขาเซ็นทรัลลาดพร้าว", "address": "เซ็นทรัลลาดพร้าว ชั้น 2", "city": "กรุงเทพมหานคร", "phone": "02-234-5678"},
            {"name": "สาขาเชียงใหม่", "address": "เซ็นทรัลเชียงใหม่ ชั้น 1", "city": "เชียงใหม่", "phone": "053-123-456"},
            {"name": "สาขาภูเก็ต", "address": "เซ็นทรัลภูเก็ต ชั้น 3", "city": "ภูเก็ต", "phone": "076-123-456"},
            {"name": "สาขาขอนแก่น", "address": "เซ็นทรัลขอนแก่น ชั้น 2", "city": "ขอนแก่น", "phone": "043-123-456"},
            {"name": "สาขาหาดใหญ่", "address": "เซ็นทรัลหาดใหญ่ ชั้น 1", "city": "สงขลา", "phone": "074-123-456"},
            {"name": "สาขาราชบุรี", "address": "77 ถนนราชบุรี", "city": "ราชบุรี", "phone": "032-123-456"},
            {"name": "สาขานครปฐม", "address": "99 ถนนนครปฐม", "city": "นครปฐม", "phone": "034-123-456"},
        ]
    
    def generate_all_demo_data(self, 
                              num_users: int = 20,
                              num_customers: int = 100,
                              num_transactions: int = 500,
                              num_shipments: int = 200,
                              days_back: int = 90) -> Dict[str, Any]:
        """Generate all demo data"""
        
        print("🚀 Starting demo data generation...")
        
        # Generate basic entities
        self.generate_users(num_users)
        self.generate_branches()
        self.generate_products()
        self.generate_customers(num_customers)
        self.generate_fleet()
        
        # Generate inventory and movements
        self.generate_inventory()
        self.generate_stock_movements(days_back)
        
        # Generate sales transactions
        self.generate_sales_transactions(num_transactions, days_back)
        
        # Generate shipments
        self.generate_shipments(num_shipments, days_back)
        
        # Generate analytics data
        self.generate_daily_metrics(days_back)
        
        summary = {
            "users": len(self.users),
            "branches": len(self.branches),
            "products": len(self.products),
            "customers": len(self.customers),
            "vehicles": len(self.vehicles),
            "drivers": len(self.drivers),
            "routes": len(self.routes),
            "transactions": num_transactions,
            "shipments": num_shipments,
            "days_covered": days_back
        }
        
        print("✅ Demo data generation completed!")
        print(f"📊 Summary: {summary}")
        
        return summary
    
    def generate_users(self, num_users: int):
        """Generate demo users"""
        print(f"👥 Generating {num_users} users...")
        
        # Create admin user
        admin_user = User(
            username="admin",
            email="admin@driedfruits.com",
            hashed_password=get_password_hash("admin123"),
            first_name="Admin",
            last_name="User",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True
        )
        self.db.add(admin_user)
        self.users.append(admin_user)
        
        # Create manager users
        for i in range(3):
            manager = User(
                username=f"manager{i+1}",
                email=f"manager{i+1}@driedfruits.com",
                hashed_password=get_password_hash("manager123"),
                first_name=self.fake.first_name(),
                last_name=self.fake.last_name(),
                role=UserRole.MANAGER,
                is_active=True,
                is_verified=True
            )
            self.db.add(manager)
            self.users.append(manager)
        
        # Create other role users
        roles = [UserRole.SALES, UserRole.INVENTORY, UserRole.DELIVERY]
        for i in range(num_users - 4):
            role = random.choice(roles)
            user = User(
                username=f"user{i+1}",
                email=f"user{i+1}@driedfruits.com",
                hashed_password=get_password_hash("user123"),
                first_name=self.fake.first_name(),
                last_name=self.fake.last_name(),
                role=role,
                is_active=True,
                is_verified=True
            )
            self.db.add(user)
            self.users.append(user)
        
        self.db.commit()
    
    def generate_branches(self):
        """Generate demo branches"""
        print(f"🏢 Generating {len(self.thai_branches)} branches...")
        
        for i, branch_data in enumerate(self.thai_branches):
            branch = Branch(
                branch_name=branch_data["name"],
                branch_code=f"BR{i+1:03d}",
                address=branch_data["address"],
                city=branch_data["city"],
                phone=branch_data["phone"],
                email=f"branch{i+1}@driedfruits.com",
                is_active=True
            )
            self.db.add(branch)
            self.branches.append(branch)
        
        self.db.commit()
    
    def generate_products(self):
        """Generate demo products"""
        print(f"🥭 Generating {len(self.dried_fruits)} products...")
        
        for i, fruit_data in enumerate(self.dried_fruits):
            # Generate SKU
            sku = f"DF{i+1:03d}"
            
            product = Product(
                product_name=fruit_data["name"],
                product_name_en=fruit_data["name_en"],
                sku=sku,
                category=ProductCategory(fruit_data["category"]),
                unit_price=Decimal(str(fruit_data["unit_price"])),
                cost_price=Decimal(str(fruit_data["unit_price"] * 0.6)),  # 60% of unit price
                unit=Unit.GRAM,
                weight_per_unit=Decimal("100"),  # 100g per unit
                description=f"Premium quality {fruit_data['name_en']} from Thailand",
                is_active=True
            )
            self.db.add(product)
            self.products.append(product)
            
            # Generate barcode
            barcode = Barcode(
                product_id=product.id,
                barcode_type=BarcodeType.EAN13,
                barcode_data=f"890{i+1:010d}",  # Thai country code + product number
                is_active=True
            )
            self.db.add(barcode)
        
        self.db.commit()
    
    def generate_customers(self, num_customers: int):
        """Generate demo customers"""
        print(f"👨‍💼 Generating {num_customers} customers...")
        
        for i in range(num_customers):
            tier = random.choice(list(CustomerTier))
            
            customer = Customer(
                customer_code=f"CUST{i+1:06d}",
                first_name=self.fake.first_name(),
                last_name=self.fake.last_name(),
                email=self.fake.email(),
                phone=self.fake.phone_number(),
                address=self.fake.address(),
                city=random.choice([b.city for b in self.branches]),
                tier=tier,
                status="active",
                registration_date=self.fake.date_between(start_date='-2y', end_date='today')
            )
            self.db.add(customer)
            self.customers.append(customer)
        
        self.db.commit()
    
    def generate_fleet(self):
        """Generate demo fleet (vehicles, drivers, routes)"""
        print("🚛 Generating fleet data...")
        
        # Generate vehicles
        vehicle_types = [VehicleType.TRUCK, VehicleType.VAN, VehicleType.MOTORCYCLE]
        for i in range(15):
            vehicle_type = random.choice(vehicle_types)
            
            # Set capacity based on vehicle type
            if vehicle_type == VehicleType.TRUCK:
                max_weight = Decimal("5000")
                max_volume = Decimal("20")
            elif vehicle_type == VehicleType.VAN:
                max_weight = Decimal("1500")
                max_volume = Decimal("8")
            else:  # MOTORCYCLE
                max_weight = Decimal("100")
                max_volume = Decimal("0.5")
            
            vehicle = Vehicle(
                license_plate=f"กท-{random.randint(1000, 9999)}",
                vehicle_type=vehicle_type,
                max_weight=max_weight,
                max_volume=max_volume,
                fuel_type="gasoline",
                status=VehicleStatus.AVAILABLE,
                is_available=True,
                mileage=random.randint(10000, 100000),
                last_maintenance=self.fake.date_between(start_date='-6m', end_date='today'),
                next_maintenance=self.fake.date_between(start_date='today', end_date='+3m')
            )
            self.db.add(vehicle)
            self.vehicles.append(vehicle)
        
        # Generate drivers
        for i in range(12):
            driver = Driver(
                employee_id=f"EMP{i+1:04d}",
                first_name=self.fake.first_name(),
                last_name=self.fake.last_name(),
                license_number=f"LIC{random.randint(100000, 999999)}",
                license_expiry=self.fake.date_between(start_date='today', end_date='+2y'),
                phone=self.fake.phone_number(),
                status=DriverStatus.AVAILABLE,
                is_available=True,
                rating=Decimal(str(random.uniform(3.5, 5.0)))
            )
            self.db.add(driver)
            self.drivers.append(driver)
        
        self.db.commit()
        
        # Generate delivery routes
        for i in range(8):
            route = DeliveryRoute(
                route_name=f"เส้นทาง {self.branches[i].city}",
                driver_id=self.drivers[i].id,
                vehicle_id=self.vehicles[i].id,
                estimated_duration=timedelta(hours=random.randint(4, 12)),
                max_stops=random.randint(5, 15),
                is_active=True
            )
            self.db.add(route)
            self.routes.append(route)
        
        self.db.commit()
    
    def generate_inventory(self):
        """Generate demo inventory"""
        print("📦 Generating inventory data...")
        
        for branch in self.branches:
            for product in self.products:
                # Random initial stock levels
                quantity = Decimal(str(random.randint(100, 1000)))
                reorder_point = Decimal(str(random.randint(50, 200)))
                
                inventory = Inventory(
                    branch_id=branch.id,
                    product_id=product.id,
                    quantity_on_hand=quantity,
                    quantity_reserved=Decimal(str(random.randint(0, 50))),
                    reorder_point=reorder_point,
                    max_stock_level=reorder_point * 5,
                    last_movement_date=datetime.utcnow() - timedelta(days=random.randint(1, 30))
                )
                self.db.add(inventory)
        
        self.db.commit()
    
    def generate_stock_movements(self, days_back: int):
        """Generate demo stock movements"""
        print(f"📊 Generating stock movements for {days_back} days...")
        
        movement_types = [MovementType.IN, MovementType.OUT]
        reasons = list(MovementReason)
        
        for _ in range(days_back * 10):  # ~10 movements per day
            movement = StockMovement(
                branch_id=random.choice(self.branches).id,
                product_id=random.choice(self.products).id,
                movement_type=random.choice(movement_types),
                quantity=Decimal(str(random.randint(1, 100))),
                reason=random.choice(reasons),
                reference_number=f"MOV{random.randint(100000, 999999)}",
                notes=self.fake.sentence(),
                created_at=self.fake.date_time_between(
                    start_date=f'-{days_back}d',
                    end_date='now'
                )
            )
            self.db.add(movement)
        
        self.db.commit()
    
    def generate_sales_transactions(self, num_transactions: int, days_back: int):
        """Generate demo sales transactions"""
        print(f"💰 Generating {num_transactions} sales transactions...")
        
        payment_methods = list(PaymentMethod)
        
        for i in range(num_transactions):
            # Random transaction date
            transaction_date = self.fake.date_time_between(
                start_date=f'-{days_back}d',
                end_date='now'
            )
            
            transaction = SalesTransaction(
                transaction_number=f"TXN{i+1:08d}",
                branch_id=random.choice(self.branches).id,
                customer_id=random.choice(self.customers).id if random.random() > 0.3 else None,
                cashier_id=random.choice([u.id for u in self.users if u.role == UserRole.SALES]),
                payment_method=random.choice(payment_methods),
                status=TransactionStatus.COMPLETED,
                created_at=transaction_date
            )
            self.db.add(transaction)
            self.db.flush()  # Get the ID
            
            # Add transaction items
            num_items = random.randint(1, 5)
            total_amount = Decimal('0')
            
            for _ in range(num_items):
                product = random.choice(self.products)
                quantity = Decimal(str(random.randint(1, 10)))
                unit_price = product.unit_price
                total_price = quantity * unit_price
                
                item = SalesTransactionItem(
                    transaction_id=transaction.id,
                    product_id=product.id,
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=total_price
                )
                self.db.add(item)
                total_amount += total_price
            
            transaction.total_amount = total_amount
        
        self.db.commit()
    
    def generate_shipments(self, num_shipments: int, days_back: int):
        """Generate demo shipments"""
        print(f"🚚 Generating {num_shipments} shipments...")
        
        statuses = list(ShipmentStatus)
        
        for i in range(num_shipments):
            created_date = self.fake.date_time_between(
                start_date=f'-{days_back}d',
                end_date='now'
            )
            
            route = random.choice(self.routes)
            status = random.choice(statuses)
            
            shipment = Shipment(
                shipment_number=f"SHP{i+1:08d}",
                branch_id=random.choice(self.branches).id,
                customer_id=random.choice(self.customers).id,
                route_id=route.id,
                delivery_address=self.fake.address(),
                total_weight=Decimal(str(random.randint(1, 100))),
                total_volume=Decimal(str(random.uniform(0.1, 5.0))),
                status=status,
                estimated_delivery_date=created_date + timedelta(days=random.randint(1, 7)),
                created_at=created_date
            )
            
            # Set delivered date if status is delivered
            if status == ShipmentStatus.DELIVERED:
                shipment.delivered_at = created_date + timedelta(days=random.randint(1, 5))
            
            self.db.add(shipment)
        
        self.db.commit()
    
    def generate_daily_metrics(self, days_back: int):
        """Generate daily metrics snapshots"""
        print(f"📈 Generating daily metrics for {days_back} days...")
        
        from app.models.analytics import DailyMetrics
        
        for days_ago in range(days_back):
            date = (datetime.utcnow() - timedelta(days=days_ago)).date()
            
            for branch in self.branches[:3]:  # Only for first 3 branches
                metrics = DailyMetrics(
                    date=date,
                    branch_id=branch.id,
                    total_revenue=Decimal(str(random.randint(10000, 50000))),
                    total_transactions=random.randint(50, 200),
                    total_customers=random.randint(30, 150),
                    inventory_value=Decimal(str(random.randint(500000, 1000000))),
                    low_stock_alerts=random.randint(0, 10),
                    calculated_at=datetime.utcnow()
                )
                self.db.add(metrics)
        
        self.db.commit()
    
    def clear_all_data(self):
        """Clear all demo data"""
        print("🗑️ Clearing all demo data...")
        
        # Clear in reverse order of dependencies
        self.db.query(DailyMetrics).delete()
        self.db.query(SalesTransactionItem).delete()
        self.db.query(SalesTransaction).delete()
        self.db.query(Shipment).delete()
        self.db.query(StockMovement).delete()
        self.db.query(Inventory).delete()
        self.db.query(Barcode).delete()
        self.db.query(DeliveryRoute).delete()
        self.db.query(Driver).delete()
        self.db.query(Vehicle).delete()
        self.db.query(Customer).delete()
        self.db.query(Product).delete()
        self.db.query(Branch).delete()
        self.db.query(User).delete()
        
        self.db.commit()
        print("✅ All demo data cleared!")


def generate_demo_data():
    """Generate demo data for the system"""
    db = next(get_db())
    generator = DemoDataGenerator(db)
    
    try:
        # Clear existing data first
        generator.clear_all_data()
        
        # Generate new demo data
        summary = generator.generate_all_demo_data(
            num_users=25,
            num_customers=150,
            num_transactions=800,
            num_shipments=300,
            days_back=120
        )
        
        return summary
        
    except Exception as e:
        print(f"❌ Error generating demo data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    generate_demo_data()