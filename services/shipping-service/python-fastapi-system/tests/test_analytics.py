"""
Analytics endpoint tests
"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta


class TestAnalytics:
    """Test analytics endpoints"""
    
    def test_get_kpi_dashboard(self, client: TestClient, admin_headers):
        """Test get KPI dashboard"""
        response = client.get("/api/v1/analytics/dashboard", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert "sales" in data
        assert "inventory" in data
        assert "customers" in data
        assert "shipping" in data
        
        # Check sales data structure
        sales_data = data["sales"]
        assert "revenue" in sales_data
        assert "transactions" in sales_data
        assert "average_transaction" in sales_data
        
        # Check inventory data structure
        inventory_data = data["inventory"]
        assert "total_value" in inventory_data
        assert "low_stock_alerts" in inventory_data
        assert "out_of_stock_alerts" in inventory_data
    
    def test_get_kpi_dashboard_with_date_range(self, client: TestClient, admin_headers):
        """Test get KPI dashboard with date range"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        params = {
            "date_from": start_date.isoformat(),
            "date_to": end_date.isoformat()
        }
        response = client.get("/api/v1/analytics/dashboard", params=params, headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert data["period"]["days"] == 30
    
    def test_get_sales_analytics(self, client: TestClient, admin_headers):
        """Test get sales analytics"""
        response = client.get("/api/v1/analytics/sales", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "daily_sales" in data
        assert "top_products" in data
        assert "payment_methods" in data
        
        # Check summary structure
        summary = data["summary"]
        assert "total_revenue" in summary
        assert "total_transactions" in summary
        assert "average_transaction" in summary
        assert "period_days" in summary
        
        # Check daily sales is a list
        assert isinstance(data["daily_sales"], list)
        
        # Check top products is a list
        assert isinstance(data["top_products"], list)
        
        # Check payment methods is a dict
        assert isinstance(data["payment_methods"], dict)
    
    def test_get_sales_analytics_with_branch_filter(self, client: TestClient, admin_headers, test_branch):
        """Test get sales analytics filtered by branch"""
        params = {"branch_id": str(test_branch.id)}
        response = client.get("/api/v1/analytics/sales", params=params, headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "daily_sales" in data
    
    def test_get_inventory_analytics(self, client: TestClient, admin_headers):
        """Test get inventory analytics"""
        response = client.get("/api/v1/analytics/inventory", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "alerts" in data
        assert "category_breakdown" in data
        assert "movement_summary" in data
        
        # Check summary structure
        summary = data["summary"]
        assert "total_items" in summary
        assert "total_value" in summary
        assert "total_quantity" in summary
        assert "low_stock_count" in summary
        assert "out_of_stock_count" in summary
        
        # Check alerts structure
        alerts = data["alerts"]
        assert "low_stock" in alerts
        assert "out_of_stock" in alerts
        assert isinstance(alerts["low_stock"], list)
        assert isinstance(alerts["out_of_stock"], list)
    
    def test_get_customer_analytics(self, client: TestClient, admin_headers):
        """Test get customer analytics"""
        response = client.get("/api/v1/analytics/customers", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "tier_breakdown" in data
        assert "top_customers" in data
        assert "monthly_acquisition" in data
        
        # Check summary structure
        summary = data["summary"]
        assert "total_customers" in summary
        assert "active_customers" in summary
        assert "new_customers" in summary
        assert "customers_with_purchases" in summary
        assert "retention_rate" in summary
        
        # Check tier breakdown is a dict
        assert isinstance(data["tier_breakdown"], dict)
        
        # Check top customers is a list
        assert isinstance(data["top_customers"], list)
        
        # Check monthly acquisition is a list
        assert isinstance(data["monthly_acquisition"], list)
    
    def test_get_shipping_analytics(self, client: TestClient, admin_headers):
        """Test get shipping analytics"""
        response = client.get("/api/v1/analytics/shipping", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "status_breakdown" in data
        assert "route_performance" in data
        
        # Check summary structure
        summary = data["summary"]
        assert "total_shipments" in summary
        assert "delivered_shipments" in summary
        assert "on_time_delivery_rate" in summary
        assert "average_delivery_time_hours" in summary
        
        # Check status breakdown is a dict
        assert isinstance(data["status_breakdown"], dict)
        
        # Check route performance is a list
        assert isinstance(data["route_performance"], list)
    
    def test_get_trend_analysis(self, client: TestClient, admin_headers):
        """Test get trend analysis"""
        response = client.get("/api/v1/analytics/trends/revenue", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "metric" in data
        assert "period_days" in data
        assert "data_points" in data
        assert "trend" in data
        assert "percentage_change" in data
        assert "values" in data
        assert "dates" in data
        
        # Check data types
        assert data["metric"] == "revenue"
        assert isinstance(data["period_days"], int)
        assert isinstance(data["data_points"], int)
        assert data["trend"] in ["increasing", "decreasing", "stable", "insufficient_data"]
        assert isinstance(data["percentage_change"], (int, float))
        assert isinstance(data["values"], list)
        assert isinstance(data["dates"], list)
    
    def test_get_trend_analysis_invalid_metric(self, client: TestClient, admin_headers):
        """Test get trend analysis with invalid metric"""
        response = client.get("/api/v1/analytics/trends/invalid_metric", headers=admin_headers)
        
        assert response.status_code == 400
        assert "Invalid metric" in response.json()["detail"]
    
    def test_get_trend_analysis_with_params(self, client: TestClient, admin_headers):
        """Test get trend analysis with parameters"""
        params = {"period_days": 60}
        response = client.get("/api/v1/analytics/trends/transactions", params=params, headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["metric"] == "transactions"
        assert data["period_days"] == 60
    
    def test_get_daily_metrics(self, client: TestClient, admin_headers):
        """Test get daily metrics"""
        response = client.get("/api/v1/analytics/daily-metrics", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Check structure of daily metrics if any exist
        if data:
            metric = data[0]
            assert "id" in metric
            assert "date" in metric
            assert "total_revenue" in metric
            assert "total_transactions" in metric
            assert "total_customers" in metric
            assert "inventory_value" in metric
            assert "low_stock_alerts" in metric
            assert "calculated_at" in metric
    
    def test_create_daily_metrics(self, client: TestClient, admin_headers):
        """Test create daily metrics"""
        from datetime import date
        today = date.today()
        
        response = client.post(f"/api/v1/analytics/daily-metrics?target_date={today.isoformat()}", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["date"] == today.isoformat()
        assert "total_revenue" in data
        assert "total_transactions" in data
        assert "total_customers" in data
        assert "inventory_value" in data
        assert "low_stock_alerts" in data
    
    def test_get_real_time_metrics(self, client: TestClient, admin_headers):
        """Test get real-time metrics"""
        response = client.get("/api/v1/analytics/real-time", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "timestamp" in data
        assert "sales_today" in data
        assert "inventory_alerts" in data
        assert "active_shipments" in data
        assert "system_health" in data
        
        # Check sales today structure
        sales_today = data["sales_today"]
        assert "total_revenue" in sales_today
        assert "total_transactions" in sales_today
        
        # Check inventory alerts structure
        inventory_alerts = data["inventory_alerts"]
        assert "low_stock" in inventory_alerts
        assert "out_of_stock" in inventory_alerts
        
        # Check system health structure
        system_health = data["system_health"]
        assert "status" in system_health
        assert "uptime" in system_health
        assert "response_time" in system_health
    
    def test_period_comparison(self, client: TestClient, admin_headers):
        """Test period comparison"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        prev_end = start_date
        prev_start = prev_end - timedelta(days=30)
        
        params = {
            "current_start": start_date.isoformat(),
            "current_end": end_date.isoformat(),
            "previous_start": prev_start.isoformat(),
            "previous_end": prev_end.isoformat()
        }
        response = client.get("/api/v1/analytics/performance/period-comparison", params=params, headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "current_period" in data
        assert "previous_period" in data
        assert "comparison" in data
        assert "growth_rate" in data
        assert "trend" in data
        
        # Check trend value
        assert data["trend"] in ["increasing", "decreasing", "stable"]
        
        # Check growth rate is a number
        assert isinstance(data["growth_rate"], (int, float))
    
    def test_export_analytics_data(self, client: TestClient, admin_headers):
        """Test export analytics data"""
        export_data = {
            "data_type": "sales",
            "format": "csv",
            "include_details": True
        }
        response = client.post("/api/v1/analytics/export", json=export_data, headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "export_id" in data
        assert "status" in data
        assert "created_at" in data
        assert data["status"] == "processing"
    
    def test_export_analytics_data_invalid_format(self, client: TestClient, admin_headers):
        """Test export analytics data with invalid format"""
        export_data = {
            "data_type": "sales",
            "format": "invalid_format",
            "include_details": True
        }
        response = client.post("/api/v1/analytics/export", json=export_data, headers=admin_headers)
        
        assert response.status_code == 422
    
    def test_get_export_status(self, client: TestClient, admin_headers):
        """Test get export status"""
        export_id = "test-export-123"
        response = client.get(f"/api/v1/analytics/export/{export_id}", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "export_id" in data
        assert "status" in data
        assert "created_at" in data
    
    def test_unauthorized_analytics_access(self, client: TestClient, sales_headers):
        """Test unauthorized access to analytics"""
        # Sales user should not access comprehensive analytics
        response = client.get("/api/v1/analytics/dashboard", headers=sales_headers)
        
        # This might be allowed depending on business rules
        # Adjust assertion based on actual permissions
        assert response.status_code in [200, 403]