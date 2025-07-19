#!/usr/bin/env python3
"""
Basic system test script to validate the dried fruits inventory system
"""
import sys
import os
from pathlib import Path
import asyncio
import json

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.utils.demo_data import DemoDataGenerator


class SystemTester:
    """Test the system functionality"""
    
    def __init__(self):
        self.client = TestClient(app)
        self.access_token = None
        self.test_results = []
    
    def run_all_tests(self):
        """Run all system tests"""
        print("🧪 Starting System Tests")
        print("=" * 50)
        
        # Test database connection
        self.test_database_connection()
        
        # Test authentication
        self.test_authentication()
        
        # Test core API endpoints
        if self.access_token:
            self.test_user_endpoints()
            self.test_product_endpoints()
            self.test_inventory_endpoints()
            self.test_sales_endpoints()
            self.test_shipping_endpoints()
            self.test_analytics_endpoints()
        
        # Print test summary
        self.print_test_summary()
    
    def test_database_connection(self):
        """Test database connection"""
        print("🔌 Testing database connection...")
        try:
            db = next(get_db())
            # Try a simple query
            result = db.execute("SELECT 1").fetchone()
            self.record_test("Database Connection", True, "Database connected successfully")
        except Exception as e:
            self.record_test("Database Connection", False, f"Database connection failed: {e}")
    
    def test_authentication(self):
        """Test authentication endpoints"""
        print("🔐 Testing authentication...")
        
        # Test login
        try:
            response = self.client.post("/api/v1/auth/login", json={
                "username": "admin",
                "password": "admin123"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                self.record_test("Authentication - Login", True, "Login successful")
            else:
                self.record_test("Authentication - Login", False, f"Login failed: {response.text}")
        except Exception as e:
            self.record_test("Authentication - Login", False, f"Login error: {e}")
    
    def test_user_endpoints(self):
        """Test user management endpoints"""
        print("👥 Testing user endpoints...")
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        # Test get users
        try:
            response = self.client.get("/api/v1/users/", headers=headers)
            if response.status_code == 200:
                users = response.json()
                self.record_test("Users - Get All", True, f"Retrieved {len(users)} users")
            else:
                self.record_test("Users - Get All", False, f"Failed to get users: {response.text}")
        except Exception as e:
            self.record_test("Users - Get All", False, f"Error: {e}")
    
    def test_product_endpoints(self):
        """Test product management endpoints"""
        print("🥭 Testing product endpoints...")
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        # Test get products
        try:
            response = self.client.get("/api/v1/products/", headers=headers)
            if response.status_code == 200:
                products = response.json()
                self.record_test("Products - Get All", True, f"Retrieved {len(products)} products")
            else:
                self.record_test("Products - Get All", False, f"Failed to get products: {response.text}")
        except Exception as e:
            self.record_test("Products - Get All", False, f"Error: {e}")
    
    def test_inventory_endpoints(self):
        """Test inventory management endpoints"""
        print("📦 Testing inventory endpoints...")
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        # Test get inventory
        try:
            response = self.client.get("/api/v1/inventory/", headers=headers)
            if response.status_code == 200:
                inventory = response.json()
                self.record_test("Inventory - Get All", True, f"Retrieved {len(inventory)} inventory items")
            else:
                self.record_test("Inventory - Get All", False, f"Failed to get inventory: {response.text}")
        except Exception as e:
            self.record_test("Inventory - Get All", False, f"Error: {e}")
    
    def test_sales_endpoints(self):
        """Test sales management endpoints"""
        print("💰 Testing sales endpoints...")
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        # Test get customers
        try:
            response = self.client.get("/api/v1/customers/", headers=headers)
            if response.status_code == 200:
                customers = response.json()
                self.record_test("Sales - Get Customers", True, f"Retrieved {len(customers)} customers")
            else:
                self.record_test("Sales - Get Customers", False, f"Failed to get customers: {response.text}")
        except Exception as e:
            self.record_test("Sales - Get Customers", False, f"Error: {e}")
    
    def test_shipping_endpoints(self):
        """Test shipping management endpoints"""
        print("🚚 Testing shipping endpoints...")
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        # Test get vehicles
        try:
            response = self.client.get("/api/v1/fleet/vehicles/", headers=headers)
            if response.status_code == 200:
                vehicles = response.json()
                self.record_test("Shipping - Get Vehicles", True, f"Retrieved {len(vehicles)} vehicles")
            else:
                self.record_test("Shipping - Get Vehicles", False, f"Failed to get vehicles: {response.text}")
        except Exception as e:
            self.record_test("Shipping - Get Vehicles", False, f"Error: {e}")
    
    def test_analytics_endpoints(self):
        """Test analytics endpoints"""
        print("📊 Testing analytics endpoints...")
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        # Test get KPI dashboard
        try:
            response = self.client.get("/api/v1/analytics/dashboard", headers=headers)
            if response.status_code == 200:
                dashboard = response.json()
                self.record_test("Analytics - KPI Dashboard", True, "Dashboard data retrieved")
            else:
                self.record_test("Analytics - KPI Dashboard", False, f"Failed to get dashboard: {response.text}")
        except Exception as e:
            self.record_test("Analytics - KPI Dashboard", False, f"Error: {e}")
        
        # Test get sales analytics
        try:
            response = self.client.get("/api/v1/analytics/sales", headers=headers)
            if response.status_code == 200:
                sales_data = response.json()
                self.record_test("Analytics - Sales Data", True, "Sales analytics retrieved")
            else:
                self.record_test("Analytics - Sales Data", False, f"Failed to get sales analytics: {response.text}")
        except Exception as e:
            self.record_test("Analytics - Sales Data", False, f"Error: {e}")
    
    def record_test(self, test_name: str, passed: bool, message: str):
        """Record test result"""
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "message": message
        })
        
        status = "✅" if passed else "❌"
        print(f"   {status} {test_name}: {message}")
    
    def print_test_summary(self):
        """Print test summary"""
        print("\n📋 Test Summary")
        print("=" * 50)
        
        passed_tests = sum(1 for result in self.test_results if result["passed"])
        total_tests = len(self.test_results)
        
        print(f"Tests Passed: {passed_tests}/{total_tests}")
        print(f"Success Rate: {passed_tests/total_tests*100:.1f}%")
        
        if passed_tests == total_tests:
            print("🎉 All tests passed! System is working correctly.")
        else:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"   - {result['test']}: {result['message']}")


def main():
    """Main function to run system tests"""
    print("🌟 Dried Fruits Inventory System Tests")
    print("=" * 50)
    
    # Check if demo data exists
    try:
        db = next(get_db())
        from app.models.user import User
        user_count = db.query(User).count()
        
        if user_count == 0:
            print("⚠️  No demo data found. Please run generate_demo_data.py first.")
            return
        
        print(f"📊 Found {user_count} users in database. Starting tests...")
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        return
    
    # Run tests
    tester = SystemTester()
    tester.run_all_tests()


if __name__ == "__main__":
    main()