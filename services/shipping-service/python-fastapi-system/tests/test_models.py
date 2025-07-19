"""
Model tests for database models
"""
import pytest
from decimal import Decimal
from datetime import datetime, date

from app.models.user import User, UserRole
from app.models.branch import Branch
from app.models.product import Product, ProductCategory, Unit
from app.models.inventory import Inventory, StockMovement, MovementType, MovementReason
from app.models.sales import Customer, CustomerTier, SalesTransaction, SalesTransactionItem, TransactionStatus, PaymentMethod
from app.models.shipping import Vehicle, VehicleType, VehicleStatus, Driver, DriverStatus
from app.models.analytics import DailyMetrics
from app.core.security import get_password_hash, verify_password


class TestUserModel:
    """Test User model"""
    
    def test_create_user(self, db):
        """Test creating a user"""
        user = User(
            username="testuser",
            email="test@example.com",
            hashed_password=get_password_hash("testpass123"),
            first_name="Test",
            last_name="User",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)
        
        assert user.id is not None
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.role == UserRole.ADMIN
        assert user.is_active is True
        assert user.is_verified is True
        assert user.created_at is not None
        assert user.updated_at is not None
    
    def test_user_password_verification(self, db):
        """Test user password verification"""
        password = "testpass123"
        hashed = get_password_hash(password)
        
        user = User(
            username="testuser2",
            email="test2@example.com",
            hashed_password=hashed,
            first_name="Test",
            last_name="User",
            role=UserRole.SALES
        )
        
        db.add(user)
        db.commit()
        
        # Test password verification
        assert verify_password(password, user.hashed_password)
        assert not verify_password("wrongpass", user.hashed_password)
    
    def test_user_full_name_property(self, db):
        """Test user full name property"""
        user = User(
            username="testuser3",
            email="test3@example.com",
            hashed_password="hashedpass",
            first_name="John",
            last_name="Doe",
            role=UserRole.MANAGER
        )
        
        db.add(user)
        db.commit()
        
        assert user.full_name == "John Doe"


class TestBranchModel:
    """Test Branch model"""
    
    def test_create_branch(self, db):
        """Test creating a branch"""
        branch = Branch(
            branch_name="Test Branch",
            branch_code="TEST001",
            address="123 Test Street",
            city="Test City",
            phone="123-456-7890",
            email="test@branch.com",
            is_active=True
        )
        
        db.add(branch)
        db.commit()
        db.refresh(branch)
        
        assert branch.id is not None
        assert branch.branch_name == "Test Branch"
        assert branch.branch_code == "TEST001"
        assert branch.is_active is True
        assert branch.created_at is not None


class TestProductModel:
    """Test Product model"""
    
    def test_create_product(self, db):
        """Test creating a product"""
        product = Product(
            product_name="Test Mango",
            product_name_en="Test Mango",
            sku="MANGO001",
            category=ProductCategory.DRIED_FRUIT,
            unit_price=Decimal("120.00"),
            cost_price=Decimal("72.00"),
            unit=Unit.GRAM,
            weight_per_unit=Decimal("100"),
            description="Test dried mango",
            is_active=True
        )
        
        db.add(product)
        db.commit()
        db.refresh(product)
        
        assert product.id is not None
        assert product.product_name == "Test Mango"
        assert product.sku == "MANGO001"
        assert product.category == ProductCategory.DRIED_FRUIT
        assert product.unit_price == Decimal("120.00")
        assert product.cost_price == Decimal("72.00")
        assert product.unit == Unit.GRAM
        assert product.is_active is True
    
    def test_product_profit_margin(self, db):
        """Test product profit margin calculation"""
        product = Product(
            product_name="Test Product",
            sku="TEST001",
            category=ProductCategory.DRIED_FRUIT,
            unit_price=Decimal("100.00"),
            cost_price=Decimal("60.00"),
            unit=Unit.GRAM
        )
        
        db.add(product)
        db.commit()
        
        expected_margin = (Decimal("100.00") - Decimal("60.00")) / Decimal("100.00") * 100
        assert product.profit_margin == expected_margin


class TestInventoryModel:
    """Test Inventory model"""
    
    def test_create_inventory(self, db, test_branch, test_product):
        """Test creating inventory"""
        inventory = Inventory(
            branch_id=test_branch.id,
            product_id=test_product.id,
            quantity_on_hand=Decimal("1000"),
            quantity_reserved=Decimal("50"),
            reorder_point=Decimal("100"),
            max_stock_level=Decimal("5000")
        )
        
        db.add(inventory)
        db.commit()
        db.refresh(inventory)
        
        assert inventory.id is not None
        assert inventory.branch_id == test_branch.id
        assert inventory.product_id == test_product.id
        assert inventory.quantity_on_hand == Decimal("1000")
        assert inventory.quantity_available == Decimal("950")  # 1000 - 50
        assert inventory.needs_reorder is False  # 1000 > 100
    
    def test_inventory_needs_reorder(self, db, test_branch, test_product):
        """Test inventory reorder logic"""
        inventory = Inventory(
            branch_id=test_branch.id,
            product_id=test_product.id,
            quantity_on_hand=Decimal("80"),  # Below reorder point
            quantity_reserved=Decimal("0"),
            reorder_point=Decimal("100"),
            max_stock_level=Decimal("5000")
        )
        
        db.add(inventory)
        db.commit()
        
        assert inventory.needs_reorder is True


class TestStockMovementModel:
    """Test StockMovement model"""
    
    def test_create_stock_movement(self, db, test_branch, test_product):
        """Test creating stock movement"""
        movement = StockMovement(
            branch_id=test_branch.id,
            product_id=test_product.id,
            movement_type=MovementType.IN,
            quantity=Decimal("100"),
            reason=MovementReason.PURCHASE,
            reference_number="PO001",
            notes="Test purchase"
        )
        
        db.add(movement)
        db.commit()
        db.refresh(movement)
        
        assert movement.id is not None
        assert movement.branch_id == test_branch.id
        assert movement.product_id == test_product.id
        assert movement.movement_type == MovementType.IN
        assert movement.quantity == Decimal("100")
        assert movement.reason == MovementReason.PURCHASE
        assert movement.reference_number == "PO001"
        assert movement.created_at is not None


class TestCustomerModel:
    """Test Customer model"""
    
    def test_create_customer(self, db):
        """Test creating a customer"""
        customer = Customer(
            customer_code="CUST001",
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            phone="123-456-7890",
            address="123 Customer Street",
            city="Customer City",
            tier=CustomerTier.SILVER,
            status="active"
        )
        
        db.add(customer)
        db.commit()
        db.refresh(customer)
        
        assert customer.id is not None
        assert customer.customer_code == "CUST001"
        assert customer.first_name == "John"
        assert customer.last_name == "Doe"
        assert customer.full_name == "John Doe"
        assert customer.email == "john.doe@example.com"
        assert customer.tier == CustomerTier.SILVER
        assert customer.status == "active"
        assert customer.registration_date is not None


class TestSalesTransactionModel:
    """Test SalesTransaction model"""
    
    def test_create_sales_transaction(self, db, test_branch, test_customer):
        """Test creating a sales transaction"""
        transaction = SalesTransaction(
            transaction_number="TXN001",
            branch_id=test_branch.id,
            customer_id=test_customer.id,
            payment_method=PaymentMethod.CASH,
            total_amount=Decimal("250.00"),
            status=TransactionStatus.COMPLETED
        )
        
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        
        assert transaction.id is not None
        assert transaction.transaction_number == "TXN001"
        assert transaction.branch_id == test_branch.id
        assert transaction.customer_id == test_customer.id
        assert transaction.payment_method == PaymentMethod.CASH
        assert transaction.total_amount == Decimal("250.00")
        assert transaction.status == TransactionStatus.COMPLETED
        assert transaction.created_at is not None


class TestSalesTransactionItemModel:
    """Test SalesTransactionItem model"""
    
    def test_create_transaction_item(self, db, test_product):
        """Test creating a transaction item"""
        # First create a transaction
        transaction = SalesTransaction(
            transaction_number="TXN002",
            branch_id=test_product.id,  # Using product ID as branch ID for simplicity
            payment_method=PaymentMethod.CASH,
            total_amount=Decimal("0"),
            status=TransactionStatus.PENDING
        )
        
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        
        # Create transaction item
        item = SalesTransactionItem(
            transaction_id=transaction.id,
            product_id=test_product.id,
            quantity=Decimal("2"),
            unit_price=test_product.unit_price,
            total_price=Decimal("2") * test_product.unit_price
        )
        
        db.add(item)
        db.commit()
        db.refresh(item)
        
        assert item.id is not None
        assert item.transaction_id == transaction.id
        assert item.product_id == test_product.id
        assert item.quantity == Decimal("2")
        assert item.unit_price == test_product.unit_price
        assert item.total_price == Decimal("2") * test_product.unit_price


class TestVehicleModel:
    """Test Vehicle model"""
    
    def test_create_vehicle(self, db):
        """Test creating a vehicle"""
        vehicle = Vehicle(
            license_plate="ABC-1234",
            vehicle_type=VehicleType.TRUCK,
            max_weight=Decimal("5000"),
            max_volume=Decimal("20"),
            fuel_type="diesel",
            status=VehicleStatus.AVAILABLE,
            is_available=True,
            mileage=50000
        )
        
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
        
        assert vehicle.id is not None
        assert vehicle.license_plate == "ABC-1234"
        assert vehicle.vehicle_type == VehicleType.TRUCK
        assert vehicle.max_weight == Decimal("5000")
        assert vehicle.max_volume == Decimal("20")
        assert vehicle.status == VehicleStatus.AVAILABLE
        assert vehicle.is_available is True
        assert vehicle.mileage == 50000


class TestDriverModel:
    """Test Driver model"""
    
    def test_create_driver(self, db):
        """Test creating a driver"""
        driver = Driver(
            employee_id="EMP001",
            first_name="John",
            last_name="Driver",
            license_number="LIC123456",
            license_expiry=date(2025, 12, 31),
            phone="123-456-7890",
            status=DriverStatus.AVAILABLE,
            is_available=True,
            rating=Decimal("4.5")
        )
        
        db.add(driver)
        db.commit()
        db.refresh(driver)
        
        assert driver.id is not None
        assert driver.employee_id == "EMP001"
        assert driver.first_name == "John"
        assert driver.last_name == "Driver"
        assert driver.full_name == "John Driver"
        assert driver.license_number == "LIC123456"
        assert driver.status == DriverStatus.AVAILABLE
        assert driver.is_available is True
        assert driver.rating == Decimal("4.5")


class TestDailyMetricsModel:
    """Test DailyMetrics model"""
    
    def test_create_daily_metrics(self, db, test_branch):
        """Test creating daily metrics"""
        metrics = DailyMetrics(
            date=date.today(),
            branch_id=test_branch.id,
            total_revenue=Decimal("15000.00"),
            total_transactions=50,
            total_customers=35,
            inventory_value=Decimal("500000.00"),
            low_stock_alerts=3,
            calculated_at=datetime.utcnow()
        )
        
        db.add(metrics)
        db.commit()
        db.refresh(metrics)
        
        assert metrics.id is not None
        assert metrics.date == date.today()
        assert metrics.branch_id == test_branch.id
        assert metrics.total_revenue == Decimal("15000.00")
        assert metrics.total_transactions == 50
        assert metrics.total_customers == 35
        assert metrics.inventory_value == Decimal("500000.00")
        assert metrics.low_stock_alerts == 3
        assert metrics.calculated_at is not None
        assert metrics.created_at is not None