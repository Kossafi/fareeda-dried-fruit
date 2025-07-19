"""
Product management endpoint tests
"""
import pytest
from fastapi.testclient import TestClient


class TestProducts:
    """Test product endpoints"""
    
    def test_get_products(self, client: TestClient, admin_headers, test_product):
        """Test get all products"""
        response = client.get("/api/v1/products/", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Check if test product is in the list
        product_skus = [p["sku"] for p in data]
        assert test_product.sku in product_skus
    
    def test_get_product_by_id(self, client: TestClient, admin_headers, test_product):
        """Test get product by ID"""
        response = client.get(f"/api/v1/products/{test_product.id}", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_product.id)
        assert data["sku"] == test_product.sku
        assert data["product_name"] == test_product.product_name
    
    def test_get_nonexistent_product(self, client: TestClient, admin_headers):
        """Test get nonexistent product"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/v1/products/{fake_id}", headers=admin_headers)
        
        assert response.status_code == 404
    
    def test_create_product(self, client: TestClient, admin_headers, sample_product_data):
        """Test create new product"""
        response = client.post("/api/v1/products/", json=sample_product_data, headers=admin_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["sku"] == sample_product_data["sku"]
        assert data["product_name"] == sample_product_data["product_name"]
        assert data["category"] == sample_product_data["category"]
        assert float(data["unit_price"]) == sample_product_data["unit_price"]
    
    def test_create_product_duplicate_sku(self, client: TestClient, admin_headers, test_product):
        """Test create product with duplicate SKU"""
        product_data = {
            "product_name": "Another Product",
            "product_name_en": "Another Product",
            "sku": test_product.sku,  # Duplicate SKU
            "category": "DRIED_FRUIT",
            "unit_price": 90.00,
            "cost_price": 54.00,
            "unit": "GRAM",
            "weight_per_unit": 100,
            "description": "Another test product",
            "is_active": True
        }
        response = client.post("/api/v1/products/", json=product_data, headers=admin_headers)
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
    
    def test_create_product_invalid_data(self, client: TestClient, admin_headers):
        """Test create product with invalid data"""
        invalid_data = {
            "product_name": "",  # Empty name
            "sku": "TEST",
            "category": "INVALID_CATEGORY",
            "unit_price": -10.00,  # Negative price
        }
        response = client.post("/api/v1/products/", json=invalid_data, headers=admin_headers)
        
        assert response.status_code == 422
    
    def test_update_product(self, client: TestClient, admin_headers, test_product):
        """Test update product"""
        update_data = {
            "product_name": "Updated Product Name",
            "unit_price": 150.00,
            "description": "Updated description"
        }
        response = client.put(f"/api/v1/products/{test_product.id}", json=update_data, headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["product_name"] == update_data["product_name"]
        assert float(data["unit_price"]) == update_data["unit_price"]
        assert data["description"] == update_data["description"]
    
    def test_update_nonexistent_product(self, client: TestClient, admin_headers):
        """Test update nonexistent product"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        update_data = {"product_name": "Updated Name"}
        response = client.put(f"/api/v1/products/{fake_id}", json=update_data, headers=admin_headers)
        
        assert response.status_code == 404
    
    def test_delete_product(self, client: TestClient, admin_headers):
        """Test delete product"""
        # First create a product to delete
        product_data = {
            "product_name": "To Delete",
            "product_name_en": "To Delete",
            "sku": "DELETE001",
            "category": "DRIED_FRUIT",
            "unit_price": 100.00,
            "cost_price": 60.00,
            "unit": "GRAM",
            "weight_per_unit": 100,
            "description": "Product to delete",
            "is_active": True
        }
        create_response = client.post("/api/v1/products/", json=product_data, headers=admin_headers)
        assert create_response.status_code == 201
        product_id = create_response.json()["id"]
        
        # Delete the product
        response = client.delete(f"/api/v1/products/{product_id}", headers=admin_headers)
        assert response.status_code == 200
        
        # Verify it's deleted
        get_response = client.get(f"/api/v1/products/{product_id}", headers=admin_headers)
        assert get_response.status_code == 404
    
    def test_search_products(self, client: TestClient, admin_headers, test_product):
        """Test search products"""
        response = client.get(f"/api/v1/products/search?q={test_product.product_name[:4]}", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should find the test product
        product_names = [p["product_name"] for p in data]
        assert any(test_product.product_name in name for name in product_names)
    
    def test_get_products_by_category(self, client: TestClient, admin_headers, test_product):
        """Test get products by category"""
        response = client.get(f"/api/v1/products/category/{test_product.category.value}", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All products should have the same category
        for product in data:
            assert product["category"] == test_product.category.value
    
    def test_get_low_stock_products(self, client: TestClient, admin_headers):
        """Test get low stock products"""
        response = client.get("/api/v1/products/low-stock", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_unauthorized_access(self, client: TestClient, sales_headers):
        """Test unauthorized access to admin-only endpoints"""
        # Sales user should not be able to create products
        product_data = {
            "product_name": "Unauthorized Product",
            "sku": "UNAUTH001",
            "category": "DRIED_FRUIT",
            "unit_price": 100.00
        }
        response = client.post("/api/v1/products/", json=product_data, headers=sales_headers)
        
        assert response.status_code == 403