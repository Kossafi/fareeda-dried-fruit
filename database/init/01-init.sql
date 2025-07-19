-- Create database extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS sales;
CREATE SCHEMA IF NOT EXISTS shipping;
CREATE SCHEMA IF NOT EXISTS auth;

-- Create enum types
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'branch_manager', 'staff', 'customer');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE branch_type AS ENUM ('company_owned', 'franchise', 'mall_counter', 'kiosk', 'warehouse', 'distribution_center');
CREATE TYPE unit_type AS ENUM ('gram', 'kilogram', 'piece', 'box', 'package');
CREATE TYPE stock_movement_type AS ENUM ('incoming', 'outgoing', 'adjustment', 'transfer', 'repack', 'sample', 'waste', 'return');
CREATE TYPE order_status AS ENUM ('draft', 'pending', 'confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded');
CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'failed', 'cancelled', 'refunded', 'partially_refunded');
CREATE TYPE payment_method AS ENUM ('cash', 'credit_card', 'debit_card', 'mobile_payment', 'bank_transfer', 'loyalty_points', 'gift_card');
CREATE TYPE shipment_status AS ENUM ('pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned', 'cancelled');
CREATE TYPE membership_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');

-- Grant permissions
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA inventory TO postgres;
GRANT USAGE ON SCHEMA sales TO postgres;
GRANT USAGE ON SCHEMA shipping TO postgres;
GRANT USAGE ON SCHEMA auth TO postgres;