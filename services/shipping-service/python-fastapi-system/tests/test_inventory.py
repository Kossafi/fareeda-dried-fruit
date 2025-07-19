"""
Inventory management endpoint tests
"""
import pytest
from fastapi.testclient import TestClient
from decimal import Decimal


class TestInventory:
    """Test inventory endpoints"""
    
    def test_get_inventory(self, client: TestClient, admin_headers, test_inventory):
        """Test get all inventory"""
        response = client.get("/api/v1/inventory/", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Check if test inventory is in the list
        inventory_ids = [inv["id"] for inv in data]
        assert str(test_inventory.id) in inventory_ids
    
    def test_get_inventory_by_branch(self, client: TestClient, admin_headers, test_inventory, test_branch):
        """Test get inventory by branch"""
        response = client.get(f"/api/v1/inventory/branch/{test_branch.id}", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # All inventory items should belong to the specified branch
        for inv in data:
            assert inv["branch_id"] == str(test_branch.id)
    
    def test_get_inventory_by_product(self, client: TestClient, admin_headers, test_inventory, test_product):
        """Test get inventory by product"""
        response = client.get(f"/api/v1/inventory/product/{test_product.id}", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # All inventory items should belong to the specified product
        for inv in data:
            assert inv["product_id"] == str(test_product.id)
    
    def test_get_inventory_item(self, client: TestClient, admin_headers, test_inventory):
        """Test get specific inventory item"""
        response = client.get(f"/api/v1/inventory/{test_inventory.id}", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_inventory.id)
        assert data["branch_id"] == str(test_inventory.branch_id)
        assert data["product_id"] == str(test_inventory.product_id)
        assert float(data["quantity_on_hand"]) == float(test_inventory.quantity_on_hand)
    
    def test_get_nonexistent_inventory(self, client: TestClient, admin_headers):
        """Test get nonexistent inventory item"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/v1/inventory/{fake_id}", headers=admin_headers)
        
        assert response.status_code == 404
    
    def test_create_stock_movement_in(self, client: TestClient, admin_headers, test_inventory):
        """Test create stock movement IN"""
        movement_data = {
            "branch_id": str(test_inventory.branch_id),
            "product_id": str(test_inventory.product_id),
            "movement_type": "IN",
            "quantity": 100,
            "reason": "PURCHASE",
            "reference_number": "PO001",
            "notes": "Test stock in"
        }
        response = client.post("/api/v1/inventory/movements", json=movement_data, headers=admin_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["movement_type"] == "IN"
        assert float(data["quantity"]) == 100
        assert data["reason"] == "PURCHASE"
    
    def test_create_stock_movement_out(self, client: TestClient, admin_headers, test_inventory):
        """Test create stock movement OUT"""
        movement_data = {
            "branch_id": str(test_inventory.branch_id),
            "product_id": str(test_inventory.product_id),
            "movement_type": "OUT",
            "quantity": 50,
            "reason": "SALE",
            "reference_number": "SALE001",
            "notes": "Test stock out"
        }
        response = client.post("/api/v1/inventory/movements", json=movement_data, headers=admin_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["movement_type"] == "OUT"
        assert float(data["quantity"]) == 50
        assert data["reason"] == "SALE"
    
    def test_create_stock_movement_invalid_quantity(self, client: TestClient, admin_headers, test_inventory):
        """Test create stock movement with invalid quantity"""
        movement_data = {
            "branch_id": str(test_inventory.branch_id),
            "product_id": str(test_inventory.product_id),
            "movement_type": "OUT",
            "quantity": 99999,  # More than available
            "reason": "SALE",
            "reference_number": "INVALID001"
        }
        response = client.post("/api/v1/inventory/movements", json=movement_data, headers=admin_headers)
        
        assert response.status_code == 400
        assert "insufficient stock" in response.json()["detail"].lower()
    
    def test_get_stock_movements(self, client: TestClient, admin_headers):
        """Test get stock movements"""
        response = client.get("/api/v1/inventory/movements", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_stock_movements_by_branch(self, client: TestClient, admin_headers, test_branch):
        """Test get stock movements by branch"""
        response = client.get(f"/api/v1/inventory/movements/branch/{test_branch.id}", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # All movements should belong to the specified branch
        for movement in data:
            assert movement["branch_id"] == str(test_branch.id)
    
    def test_get_stock_movements_by_product(self, client: TestClient, admin_headers, test_product):
        """Test get stock movements by product"""
        response = client.get(f"/api/v1/inventory/movements/product/{test_product.id}", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # All movements should belong to the specified product
        for movement in data:
            assert movement["product_id"] == str(test_product.id)
    
    def test_update_inventory_levels(self, client: TestClient, admin_headers, test_inventory):
        """Test update inventory levels"""
        update_data = {
            "reorder_point": 200,
            "max_stock_level": 8000
        }
        response = client.put(f"/api/v1/inventory/{test_inventory.id}", json=update_data, headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert float(data["reorder_point"]) == 200
        assert float(data["max_stock_level"]) == 8000
    
    def test_get_low_stock_alerts(self, client: TestClient, admin_headers):
        """Test get low stock alerts"""
        response = client.get("/api/v1/inventory/alerts/low-stock", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_out_of_stock_alerts(self, client: TestClient, admin_headers):
        """Test get out of stock alerts"""
        response = client.get("/api/v1/inventory/alerts/out-of-stock", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_inventory_value(self, client: TestClient, admin_headers, test_branch):
        """Test get inventory value by branch"""
        response = client.get(f"/api/v1/inventory/value/branch/{test_branch.id}", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "total_value" in data
        assert "total_quantity" in data
        assert "total_items" in data
    
    def test_inventory_summary(self, client: TestClient, admin_headers):
        """Test get inventory summary"""
        response = client.get("/api/v1/inventory/summary", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "total_value" in data
        assert "total_items" in data
        assert "low_stock_count" in data
        assert "out_of_stock_count" in data
    
    def test_stock_count_adjustment(self, client: TestClient, admin_headers, test_inventory):
        """Test stock count adjustment"""
        adjustment_data = {
            "actual_quantity": 950,
            "reason": "STOCK_COUNT",
            "notes": "Physical count adjustment"
        }
        response = client.post(f"/api/v1/inventory/{test_inventory.id}/adjust", json=adjustment_data, headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert float(data["quantity_on_hand"]) == 950
    
    def test_unauthorized_inventory_access(self, client: TestClient, sales_headers):
        """Test unauthorized access to inventory management"""
        # Sales user should not be able to create stock movements
        movement_data = {
            "branch_id": "test-branch-id",
            "product_id": "test-product-id",
            "movement_type": "IN",
            "quantity": 100,
            "reason": "PURCHASE"
        }
        response = client.post("/api/v1/inventory/movements", json=movement_data, headers=sales_headers)
        
        assert response.status_code == 403