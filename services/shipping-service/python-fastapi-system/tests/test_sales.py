"""
Sales management endpoint tests
"""
import pytest
from fastapi.testclient import TestClient
from decimal import Decimal


class TestSales:
    """Test sales endpoints"""
    
    def test_get_customers(self, client: TestClient, sales_headers, test_customer):
        """Test get all customers"""
        response = client.get("/api/v1/customers/", headers=sales_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Check if test customer is in the list
        customer_codes = [c["customer_code"] for c in data]
        assert test_customer.customer_code in customer_codes
    
    def test_get_customer_by_id(self, client: TestClient, sales_headers, test_customer):
        """Test get customer by ID"""
        response = client.get(f"/api/v1/customers/{test_customer.id}", headers=sales_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_customer.id)
        assert data["customer_code"] == test_customer.customer_code
        assert data["first_name"] == test_customer.first_name
        assert data["last_name"] == test_customer.last_name
    
    def test_get_nonexistent_customer(self, client: TestClient, sales_headers):
        """Test get nonexistent customer"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/v1/customers/{fake_id}", headers=sales_headers)
        
        assert response.status_code == 404
    
    def test_create_customer(self, client: TestClient, sales_headers, sample_customer_data):
        """Test create new customer"""
        response = client.post("/api/v1/customers/", json=sample_customer_data, headers=sales_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["customer_code"] == sample_customer_data["customer_code"]
        assert data["first_name"] == sample_customer_data["first_name"]
        assert data["last_name"] == sample_customer_data["last_name"]
        assert data["email"] == sample_customer_data["email"]
        assert data["tier"] == sample_customer_data["tier"]
    
    def test_create_customer_duplicate_code(self, client: TestClient, sales_headers, test_customer):
        """Test create customer with duplicate customer code"""
        customer_data = {
            "customer_code": test_customer.customer_code,  # Duplicate code
            "first_name": "Another",
            "last_name": "Customer",
            "email": "another@test.com",
            "phone": "555-0123",
            "address": "123 Another Street",
            "city": "Another City",
            "tier": "BRONZE",
            "status": "active"
        }
        response = client.post("/api/v1/customers/", json=customer_data, headers=sales_headers)
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
    
    def test_create_customer_invalid_data(self, client: TestClient, sales_headers):
        """Test create customer with invalid data"""
        invalid_data = {
            "customer_code": "",  # Empty code
            "first_name": "",  # Empty name
            "email": "invalid-email",  # Invalid email
            "tier": "INVALID_TIER"  # Invalid tier
        }
        response = client.post("/api/v1/customers/", json=invalid_data, headers=sales_headers)
        
        assert response.status_code == 422
    
    def test_update_customer(self, client: TestClient, sales_headers, test_customer):
        """Test update customer"""
        update_data = {
            "first_name": "Updated",
            "last_name": "Name",
            "email": "updated@test.com",
            "tier": "SILVER"
        }
        response = client.put(f"/api/v1/customers/{test_customer.id}", json=update_data, headers=sales_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == update_data["first_name"]
        assert data["last_name"] == update_data["last_name"]
        assert data["email"] == update_data["email"]
        assert data["tier"] == update_data["tier"]
    
    def test_update_nonexistent_customer(self, client: TestClient, sales_headers):
        """Test update nonexistent customer"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        update_data = {"first_name": "Updated"}
        response = client.put(f"/api/v1/customers/{fake_id}", json=update_data, headers=sales_headers)
        
        assert response.status_code == 404
    
    def test_search_customers(self, client: TestClient, sales_headers, test_customer):
        """Test search customers"""
        response = client.get(f"/api/v1/customers/search?q={test_customer.first_name}", headers=sales_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should find the test customer
        customer_names = [f"{c['first_name']} {c['last_name']}" for c in data]
        expected_name = f"{test_customer.first_name} {test_customer.last_name}"
        assert any(expected_name in name for name in customer_names)
    
    def test_get_customers_by_tier(self, client: TestClient, sales_headers, test_customer):
        """Test get customers by tier"""
        response = client.get(f"/api/v1/customers/tier/{test_customer.tier.value}", headers=sales_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All customers should have the same tier
        for customer in data:
            assert customer["tier"] == test_customer.tier.value
    
    def test_create_sales_transaction(self, client: TestClient, sales_headers, test_customer, test_product, test_branch):
        """Test create sales transaction"""
        transaction_data = {
            "branch_id": str(test_branch.id),
            "customer_id": str(test_customer.id),
            "payment_method": "CASH",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 2,
                    "unit_price": float(test_product.unit_price)
                }
            ],
            "notes": "Test transaction"
        }
        response = client.post("/api/v1/sales/transactions", json=transaction_data, headers=sales_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["customer_id"] == str(test_customer.id)
        assert data["payment_method"] == "CASH"
        assert len(data["items"]) == 1
        assert float(data["total_amount"]) == 2 * float(test_product.unit_price)
    
    def test_create_transaction_without_customer(self, client: TestClient, sales_headers, test_product, test_branch):
        """Test create transaction without customer (walk-in)"""
        transaction_data = {
            "branch_id": str(test_branch.id),
            "payment_method": "CASH",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 1,
                    "unit_price": float(test_product.unit_price)
                }
            ]
        }
        response = client.post("/api/v1/sales/transactions", json=transaction_data, headers=sales_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["customer_id"] is None
        assert data["payment_method"] == "CASH"
    
    def test_create_transaction_invalid_product(self, client: TestClient, sales_headers, test_branch):
        """Test create transaction with invalid product"""
        transaction_data = {
            "branch_id": str(test_branch.id),
            "payment_method": "CASH",
            "items": [
                {
                    "product_id": "00000000-0000-0000-0000-000000000000",  # Invalid product ID
                    "quantity": 1,
                    "unit_price": 100.0
                }
            ]
        }
        response = client.post("/api/v1/sales/transactions", json=transaction_data, headers=sales_headers)
        
        assert response.status_code == 400
        assert "not found" in response.json()["detail"].lower()
    
    def test_get_sales_transactions(self, client: TestClient, sales_headers):
        """Test get sales transactions"""
        response = client.get("/api/v1/sales/transactions", headers=sales_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_transaction_by_id(self, client: TestClient, sales_headers, test_customer, test_product, test_branch):
        """Test get transaction by ID"""
        # First create a transaction
        transaction_data = {
            "branch_id": str(test_branch.id),
            "customer_id": str(test_customer.id),
            "payment_method": "CASH",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 1,
                    "unit_price": float(test_product.unit_price)
                }
            ]
        }
        create_response = client.post("/api/v1/sales/transactions", json=transaction_data, headers=sales_headers)
        assert create_response.status_code == 201
        transaction_id = create_response.json()["id"]
        
        # Get the transaction
        response = client.get(f"/api/v1/sales/transactions/{transaction_id}", headers=sales_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == transaction_id
        assert data["customer_id"] == str(test_customer.id)
    
    def test_get_customer_transactions(self, client: TestClient, sales_headers, test_customer):
        """Test get customer's transactions"""
        response = client.get(f"/api/v1/customers/{test_customer.id}/transactions", headers=sales_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All transactions should belong to the customer
        for transaction in data:
            assert transaction["customer_id"] == str(test_customer.id)
    
    def test_get_sales_summary(self, client: TestClient, sales_headers):
        """Test get sales summary"""
        response = client.get("/api/v1/sales/summary", headers=sales_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "total_sales" in data
        assert "total_transactions" in data
        assert "average_transaction" in data
    
    def test_get_sales_summary_by_branch(self, client: TestClient, sales_headers, test_branch):
        """Test get sales summary by branch"""
        response = client.get(f"/api/v1/sales/summary/branch/{test_branch.id}", headers=sales_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "total_sales" in data
        assert "total_transactions" in data
        assert "branch_id" in data
        assert data["branch_id"] == str(test_branch.id)
    
    def test_cancel_transaction(self, client: TestClient, admin_headers, test_customer, test_product, test_branch):
        """Test cancel transaction"""
        # First create a transaction
        transaction_data = {
            "branch_id": str(test_branch.id),
            "customer_id": str(test_customer.id),
            "payment_method": "CASH",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 1,
                    "unit_price": float(test_product.unit_price)
                }
            ]
        }
        create_response = client.post("/api/v1/sales/transactions", json=transaction_data, headers=admin_headers)
        assert create_response.status_code == 201
        transaction_id = create_response.json()["id"]
        
        # Cancel the transaction
        response = client.post(f"/api/v1/sales/transactions/{transaction_id}/cancel", headers=admin_headers)
        assert response.status_code == 200
        
        # Verify it's cancelled
        get_response = client.get(f"/api/v1/sales/transactions/{transaction_id}", headers=admin_headers)
        assert get_response.status_code == 200
        assert get_response.json()["status"] == "CANCELLED"