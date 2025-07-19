-- Database initialization script for production
-- This script is executed when PostgreSQL container starts for the first time

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE dried_fruits_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'dried_fruits_db');

-- Connect to the database
\c dried_fruits_db;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes for better performance
-- These will be created by SQLAlchemy as well, but having them here ensures they exist

-- User table indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Product table indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(product_name gin_trgm_ops);

-- Inventory table indexes
CREATE INDEX IF NOT EXISTS idx_inventory_branch_product ON inventory(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(quantity_on_hand, reorder_point);

-- Sales transaction indexes
CREATE INDEX IF NOT EXISTS idx_sales_transactions_branch ON sales_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_customer ON sales_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_date ON sales_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_status ON sales_transactions(status);

-- Sales transaction items indexes
CREATE INDEX IF NOT EXISTS idx_sales_transaction_items_transaction ON sales_transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sales_transaction_items_product ON sales_transaction_items(product_id);

-- Stock movement indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch_product ON stock_movements(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);

-- Customer indexes
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin((first_name || ' ' || last_name) gin_trgm_ops);

-- Shipment indexes
CREATE INDEX IF NOT EXISTS idx_shipments_branch ON shipments(branch_id);
CREATE INDEX IF NOT EXISTS idx_shipments_customer ON shipments(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_route ON shipments(route_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_date ON shipments(created_at);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date_branch ON daily_metrics(date, branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns (will be created by SQLAlchemy too)
-- These are here as backup

-- Grant permissions
GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT CREATE ON SCHEMA public TO PUBLIC;

-- Create a read-only user for reporting (optional)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'reporting_user') THEN
        CREATE USER reporting_user WITH PASSWORD 'reporting_password';
    END IF;
END
$$;

-- Grant read-only access to reporting user
GRANT CONNECT ON DATABASE dried_fruits_db TO reporting_user;
GRANT USAGE ON SCHEMA public TO reporting_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reporting_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO reporting_user;

-- Create a backup user (optional)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'backup_user') THEN
        CREATE USER backup_user WITH PASSWORD 'backup_password';
    END IF;
END
$$;

-- Grant backup permissions
GRANT CONNECT ON DATABASE dried_fruits_db TO backup_user;
GRANT USAGE ON SCHEMA public TO backup_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_user;

-- Log successful initialization
INSERT INTO public.system_logs (message, level, created_at) 
VALUES ('Database initialized successfully', 'INFO', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;