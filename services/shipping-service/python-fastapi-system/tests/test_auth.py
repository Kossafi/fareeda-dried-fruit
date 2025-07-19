"""
Authentication endpoint tests
"""
import pytest
from fastapi.testclient import TestClient


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_success(self, client: TestClient, admin_user):
        """Test successful login"""
        login_data = {
            "username": admin_user.username,
            "password": "testpass123"
        }
        response = client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["username"] == admin_user.username
    
    def test_login_invalid_credentials(self, client: TestClient):
        """Test login with invalid credentials"""
        login_data = {
            "username": "nonexistent",
            "password": "wrongpass"
        }
        response = client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]
    
    def test_login_missing_fields(self, client: TestClient):
        """Test login with missing fields"""
        login_data = {
            "username": "testuser"
            # Missing password
        }
        response = client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 422
    
    def test_protected_endpoint_without_token(self, client: TestClient):
        """Test accessing protected endpoint without token"""
        response = client.get("/api/v1/users/")
        
        assert response.status_code == 401
    
    def test_protected_endpoint_with_invalid_token(self, client: TestClient):
        """Test accessing protected endpoint with invalid token"""
        headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/api/v1/users/", headers=headers)
        
        assert response.status_code == 401
    
    def test_protected_endpoint_with_valid_token(self, client: TestClient, admin_headers):
        """Test accessing protected endpoint with valid token"""
        response = client.get("/api/v1/users/", headers=admin_headers)
        
        assert response.status_code == 200
    
    def test_role_based_access_admin(self, client: TestClient, admin_headers):
        """Test admin role access"""
        # Admin should access user management
        response = client.get("/api/v1/users/", headers=admin_headers)
        assert response.status_code == 200
    
    def test_role_based_access_sales(self, client: TestClient, sales_headers):
        """Test sales role access"""
        # Sales should access customers
        response = client.get("/api/v1/customers/", headers=sales_headers)
        assert response.status_code == 200
    
    def test_get_current_user(self, client: TestClient, admin_headers, admin_user):
        """Test get current user endpoint"""
        response = client.get("/api/v1/auth/me", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == admin_user.username
        assert data["role"] == admin_user.role.value
    
    def test_logout(self, client: TestClient, admin_headers):
        """Test logout endpoint"""
        response = client.post("/api/v1/auth/logout", headers=admin_headers)
        
        assert response.status_code == 200
        assert response.json()["message"] == "Successfully logged out"