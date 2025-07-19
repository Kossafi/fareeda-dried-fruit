"""
Test configuration and fixtures
"""
import pytest
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db, Base
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.branch import Branch
from app.models.product import Product, ProductCategory, Unit
from app.models.inventory import Inventory
from app.models.sales import Customer, CustomerTier
from app.core.security import get_password_hash

# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session")
def db() -> Generator:
    """Database session fixture"""
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Create session
    session = TestingSessionLocal()
    
    try:
        yield session
    finally:
        session.close()
        # Clean up
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session")
def client(db) -> Generator:
    """Test client fixture"""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def admin_user(db) -> User:
    """Create admin user fixture"""
    admin = User(
        username="testadmin",
        email="admin@test.com",
        hashed_password=get_password_hash("testpass123"),
        first_name="Test",
        last_name="Admin",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


@pytest.fixture(scope="session")
def manager_user(db) -> User:
    """Create manager user fixture"""
    manager = User(
        username="testmanager",
        email="manager@test.com",
        hashed_password=get_password_hash("testpass123"),
        first_name="Test",
        last_name="Manager",
        role=UserRole.MANAGER,
        is_active=True,
        is_verified=True
    )
    db.add(manager)
    db.commit()
    db.refresh(manager)
    return manager


@pytest.fixture(scope="session")
def sales_user(db) -> User:
    """Create sales user fixture"""
    sales = User(
        username="testsales",
        email="sales@test.com",
        hashed_password=get_password_hash("testpass123"),
        first_name="Test",
        last_name="Sales",
        role=UserRole.SALES,
        is_active=True,
        is_verified=True
    )
    db.add(sales)
    db.commit()
    db.refresh(sales)
    return sales


@pytest.fixture(scope="session")
def test_branch(db) -> Branch:
    """Create test branch fixture"""
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
    return branch


@pytest.fixture(scope="session")
def test_product(db) -> Product:
    """Create test product fixture"""
    product = Product(
        product_name="Test Dried Mango",
        product_name_en="Test Dried Mango",
        sku="TEST001",
        category=ProductCategory.DRIED_FRUIT,
        unit_price=100.00,
        cost_price=60.00,
        unit=Unit.GRAM,
        weight_per_unit=100,
        description="Test product",
        is_active=True
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@pytest.fixture(scope="session")
def test_inventory(db, test_branch, test_product) -> Inventory:
    """Create test inventory fixture"""
    inventory = Inventory(
        branch_id=test_branch.id,
        product_id=test_product.id,
        quantity_on_hand=1000,
        quantity_reserved=0,
        reorder_point=100,
        max_stock_level=5000
    )
    db.add(inventory)
    db.commit()
    db.refresh(inventory)
    return inventory


@pytest.fixture(scope="session")
def test_customer(db) -> Customer:
    """Create test customer fixture"""
    customer = Customer(
        customer_code="CUST001",
        first_name="Test",
        last_name="Customer",
        email="customer@test.com",
        phone="123-456-7890",
        address="123 Customer Street",
        city="Test City",
        tier=CustomerTier.BRONZE,
        status="active"
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@pytest.fixture
def admin_headers(client, admin_user):
    """Get admin authentication headers"""
    login_data = {
        "username": admin_user.username,
        "password": "testpass123"
    }
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def manager_headers(client, manager_user):
    """Get manager authentication headers"""
    login_data = {
        "username": manager_user.username,
        "password": "testpass123"
    }
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sales_headers(client, sales_user):
    """Get sales authentication headers"""
    login_data = {
        "username": sales_user.username,
        "password": "testpass123"
    }
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_product_data():
    """Sample product data for testing"""
    return {
        "product_name": "Test Dried Apple",
        "product_name_en": "Test Dried Apple",
        "sku": "TEST002",
        "category": "DRIED_FRUIT",
        "unit_price": 85.00,
        "cost_price": 51.00,
        "unit": "GRAM",
        "weight_per_unit": 100,
        "description": "Test dried apple product",
        "is_active": True
    }


@pytest.fixture
def sample_customer_data():
    """Sample customer data for testing"""
    return {
        "customer_code": "CUST002",
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane.doe@test.com",
        "phone": "987-654-3210",
        "address": "456 Customer Avenue",
        "city": "Test City",
        "tier": "SILVER",
        "status": "active"
    }