-- Shipping and delivery tracking schema
-- This schema handles delivery orders, driver assignments, and real-time tracking

-- Create schemas
CREATE SCHEMA IF NOT EXISTS shipping;

-- Create enums
CREATE TYPE delivery_status AS ENUM (
  'pending',
  'assigned', 
  'in_transit',
  'delivered',
  'cancelled',
  'failed'
);

CREATE TYPE delivery_type AS ENUM (
  'company_vehicle',
  'third_party',
  'express',
  'standard'
);

CREATE TYPE tracking_event_type AS ENUM (
  'order_created',
  'driver_assigned',
  'pickup_started',
  'pickup_completed',
  'in_transit',
  'delivery_started',
  'delivery_completed',
  'delivery_failed',
  'cancelled'
);

CREATE TYPE driver_status AS ENUM (
  'available',
  'assigned',
  'in_transit',
  'on_break',
  'offline'
);

-- Drivers table
CREATE TABLE shipping.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  employee_id VARCHAR(50) NOT NULL UNIQUE,
  license_number VARCHAR(50) NOT NULL UNIQUE,
  license_expiration_date DATE NOT NULL,
  status driver_status NOT NULL DEFAULT 'offline',
  
  -- Location tracking
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  location_updated_at TIMESTAMP WITH TIME ZONE,
  
  -- Contact information
  phone_number VARCHAR(20) NOT NULL,
  emergency_contact_name VARCHAR(100) NOT NULL,
  emergency_contact_phone VARCHAR(20) NOT NULL,
  emergency_contact_relationship VARCHAR(50) NOT NULL,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT valid_license_expiration CHECK (license_expiration_date > CURRENT_DATE),
  CONSTRAINT valid_phone_number CHECK (LENGTH(phone_number) >= 10),
  CONSTRAINT valid_coordinates CHECK (
    (current_latitude IS NULL AND current_longitude IS NULL) OR
    (current_latitude BETWEEN -90 AND 90 AND current_longitude BETWEEN -180 AND 180)
  )
);

-- Vehicles table
CREATE TABLE shipping.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_plate VARCHAR(20) NOT NULL UNIQUE,
  make VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  year INTEGER NOT NULL,
  
  -- Capacity
  weight_capacity_kg DECIMAL(10, 2) NOT NULL,
  volume_capacity_m3 DECIMAL(10, 2) NOT NULL,
  
  -- Features
  fuel_type VARCHAR(20) NOT NULL,
  has_refrigeration BOOLEAN NOT NULL DEFAULT false,
  gps_device_id VARCHAR(50),
  
  -- Maintenance and insurance
  insurance_expiration_date DATE NOT NULL,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  
  -- Current assignment
  current_driver_id UUID REFERENCES shipping.drivers(id),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT valid_year CHECK (year >= 1990 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
  CONSTRAINT valid_capacity CHECK (weight_capacity_kg > 0 AND volume_capacity_m3 > 0),
  CONSTRAINT valid_insurance CHECK (insurance_expiration_date > CURRENT_DATE)
);

-- Delivery orders table
CREATE TABLE shipping.delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) NOT NULL UNIQUE,
  
  -- Branch information
  from_branch_id UUID NOT NULL REFERENCES public.branches(id),
  to_branch_id UUID NOT NULL REFERENCES public.branches(id),
  
  -- Status and type
  status delivery_status NOT NULL DEFAULT 'pending',
  delivery_type delivery_type NOT NULL,
  
  -- Assignment
  driver_id UUID REFERENCES shipping.drivers(id),
  vehicle_id UUID REFERENCES shipping.vehicles(id),
  
  -- Scheduling
  scheduled_pickup_date TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_delivery_date TIMESTAMP WITH TIME ZONE NOT NULL,
  estimated_delivery_time_minutes INTEGER,
  
  -- Actual times
  actual_pickup_time TIMESTAMP WITH TIME ZONE,
  actual_delivery_time TIMESTAMP WITH TIME ZONE,
  
  -- Order summary
  total_items INTEGER NOT NULL DEFAULT 0,
  total_weight_kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- Special requirements
  special_instructions TEXT,
  requires_signature BOOLEAN NOT NULL DEFAULT false,
  requires_refrigeration BOOLEAN NOT NULL DEFAULT false,
  
  -- Contact information
  contact_person_name VARCHAR(100),
  contact_phone VARCHAR(20),
  
  -- Delivery confirmation
  received_by VARCHAR(100),
  signature_data TEXT, -- Base64 encoded signature
  photo_proof TEXT, -- Base64 encoded photo
  delivery_notes TEXT,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT different_branches CHECK (from_branch_id != to_branch_id),
  CONSTRAINT valid_scheduling CHECK (scheduled_delivery_date > scheduled_pickup_date),
  CONSTRAINT valid_quantities CHECK (total_items >= 0 AND total_weight_kg >= 0 AND total_value >= 0),
  CONSTRAINT valid_assignment CHECK (
    (driver_id IS NULL AND vehicle_id IS NULL) OR
    (driver_id IS NOT NULL)
  )
);

-- Delivery order items table
CREATE TABLE shipping.delivery_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id UUID NOT NULL REFERENCES shipping.delivery_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory.inventory_items(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name VARCHAR(200) NOT NULL,
  
  -- Quantities
  quantity DECIMAL(10, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  weight_kg DECIMAL(10, 2) NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  
  -- Product details
  batch_number VARCHAR(50),
  expiration_date DATE,
  barcode_id VARCHAR(100),
  
  -- Delivery confirmation
  confirmed BOOLEAN NOT NULL DEFAULT false,
  actual_quantity DECIMAL(10, 3),
  notes TEXT,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_weight CHECK (weight_kg >= 0),
  CONSTRAINT valid_value CHECK (value >= 0),
  CONSTRAINT valid_actual_quantity CHECK (actual_quantity IS NULL OR actual_quantity >= 0)
);

-- Delivery tracking table
CREATE TABLE shipping.delivery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id UUID NOT NULL REFERENCES shipping.delivery_orders(id) ON DELETE CASCADE,
  event_type tracking_event_type NOT NULL,
  status delivery_status NOT NULL,
  
  -- Location information
  location VARCHAR(200),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Event details
  description TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  device_info VARCHAR(100),
  metadata JSONB,
  
  -- Timestamp
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_coordinates CHECK (
    (latitude IS NULL AND longitude IS NULL) OR
    (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  )
);

-- Driver assignments table
CREATE TABLE shipping.driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES shipping.drivers(id),
  delivery_order_id UUID NOT NULL REFERENCES shipping.delivery_orders(id),
  vehicle_id UUID REFERENCES shipping.vehicles(id),
  
  -- Assignment details
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  accepted_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Unique constraint to prevent multiple active assignments
  CONSTRAINT unique_active_assignment UNIQUE (delivery_order_id) 
    WHERE is_active = true
);

-- Route optimizations table (for future route planning)
CREATE TABLE shipping.route_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name VARCHAR(100) NOT NULL,
  driver_id UUID NOT NULL REFERENCES shipping.drivers(id),
  vehicle_id UUID NOT NULL REFERENCES shipping.vehicles(id),
  
  -- Route metrics
  estimated_distance_km DECIMAL(10, 2),
  estimated_duration_minutes INTEGER,
  estimated_fuel_cost DECIMAL(10, 2),
  
  -- Route data
  delivery_order_ids UUID[] NOT NULL,
  stops JSONB NOT NULL, -- Array of stop information
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Indexes for better performance
CREATE INDEX idx_delivery_orders_status ON shipping.delivery_orders(status);
CREATE INDEX idx_delivery_orders_from_branch ON shipping.delivery_orders(from_branch_id);
CREATE INDEX idx_delivery_orders_to_branch ON shipping.delivery_orders(to_branch_id);
CREATE INDEX idx_delivery_orders_driver ON shipping.delivery_orders(driver_id);
CREATE INDEX idx_delivery_orders_scheduled_pickup ON shipping.delivery_orders(scheduled_pickup_date);
CREATE INDEX idx_delivery_orders_scheduled_delivery ON shipping.delivery_orders(scheduled_delivery_date);
CREATE INDEX idx_delivery_orders_created_at ON shipping.delivery_orders(created_at);

CREATE INDEX idx_delivery_order_items_delivery_order ON shipping.delivery_order_items(delivery_order_id);
CREATE INDEX idx_delivery_order_items_inventory_item ON shipping.delivery_order_items(inventory_item_id);
CREATE INDEX idx_delivery_order_items_product ON shipping.delivery_order_items(product_id);

CREATE INDEX idx_delivery_tracking_delivery_order ON shipping.delivery_tracking(delivery_order_id);
CREATE INDEX idx_delivery_tracking_timestamp ON shipping.delivery_tracking(timestamp);
CREATE INDEX idx_delivery_tracking_event_type ON shipping.delivery_tracking(event_type);

CREATE INDEX idx_drivers_status ON shipping.drivers(status);
CREATE INDEX idx_drivers_user_id ON shipping.drivers(user_id);
CREATE INDEX idx_drivers_employee_id ON shipping.drivers(employee_id);
CREATE INDEX idx_drivers_location_updated ON shipping.drivers(location_updated_at);

CREATE INDEX idx_vehicles_license_plate ON shipping.vehicles(license_plate);
CREATE INDEX idx_vehicles_current_driver ON shipping.vehicles(current_driver_id);
CREATE INDEX idx_vehicles_active ON shipping.vehicles(is_active) WHERE is_active = true;

CREATE INDEX idx_driver_assignments_driver ON shipping.driver_assignments(driver_id);
CREATE INDEX idx_driver_assignments_delivery_order ON shipping.driver_assignments(delivery_order_id);
CREATE INDEX idx_driver_assignments_active ON shipping.driver_assignments(is_active) WHERE is_active = true;

-- GIN indexes for JSONB columns
CREATE INDEX idx_delivery_tracking_metadata_gin ON shipping.delivery_tracking USING GIN (metadata);
CREATE INDEX idx_route_optimizations_stops_gin ON shipping.route_optimizations USING GIN (stops);

-- Functions and triggers

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_shipping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER trigger_update_delivery_orders_updated_at
  BEFORE UPDATE ON shipping.delivery_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_updated_at();

CREATE TRIGGER trigger_update_drivers_updated_at
  BEFORE UPDATE ON shipping.drivers
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_updated_at();

CREATE TRIGGER trigger_update_vehicles_updated_at
  BEFORE UPDATE ON shipping.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_updated_at();

CREATE TRIGGER trigger_update_delivery_order_items_updated_at
  BEFORE UPDATE ON shipping.delivery_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_shipping_updated_at();

-- Function to generate delivery order number
CREATE OR REPLACE FUNCTION generate_delivery_order_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT := 'DEL';
  date_part TEXT := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  sequence_part TEXT;
  order_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT LPAD((COUNT(*) + 1)::TEXT, 4, '0')
  INTO sequence_part
  FROM shipping.delivery_orders
  WHERE DATE(created_at) = CURRENT_DATE;
  
  order_number := prefix || '-' || date_part || '-' || sequence_part;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM shipping.delivery_orders WHERE order_number = order_number) LOOP
    sequence_part := LPAD((sequence_part::INTEGER + 1)::TEXT, 4, '0');
    order_number := prefix || '-' || date_part || '-' || sequence_part;
  END LOOP;
  
  RETURN order_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update delivery order totals
CREATE OR REPLACE FUNCTION update_delivery_order_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shipping.delivery_orders 
  SET 
    total_items = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM shipping.delivery_order_items 
      WHERE delivery_order_id = COALESCE(NEW.delivery_order_id, OLD.delivery_order_id)
    ),
    total_weight_kg = (
      SELECT COALESCE(SUM(weight_kg), 0)
      FROM shipping.delivery_order_items 
      WHERE delivery_order_id = COALESCE(NEW.delivery_order_id, OLD.delivery_order_id)
    ),
    total_value = (
      SELECT COALESCE(SUM(value), 0)
      FROM shipping.delivery_order_items 
      WHERE delivery_order_id = COALESCE(NEW.delivery_order_id, OLD.delivery_order_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.delivery_order_id, OLD.delivery_order_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update delivery order totals when items change
CREATE TRIGGER trigger_update_delivery_order_totals
  AFTER INSERT OR UPDATE OR DELETE ON shipping.delivery_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_order_totals();

-- Views for common queries

-- Active delivery orders with branch information
CREATE VIEW shipping.v_active_delivery_orders AS
SELECT 
  do.*,
  fb.name as from_branch_name,
  fb.address as from_branch_address,
  tb.name as to_branch_name,
  tb.address as to_branch_address,
  d.employee_id as driver_employee_id,
  u.full_name as driver_name,
  d.phone_number as driver_phone,
  v.license_plate as vehicle_license_plate,
  v.make || ' ' || v.model as vehicle_info
FROM shipping.delivery_orders do
LEFT JOIN public.branches fb ON do.from_branch_id = fb.id
LEFT JOIN public.branches tb ON do.to_branch_id = tb.id
LEFT JOIN shipping.drivers d ON do.driver_id = d.id
LEFT JOIN auth.users u ON d.user_id = u.id
LEFT JOIN shipping.vehicles v ON do.vehicle_id = v.id
WHERE do.status != 'delivered' AND do.status != 'cancelled';

-- Driver performance statistics
CREATE VIEW shipping.v_driver_performance AS
SELECT 
  d.id as driver_id,
  d.employee_id,
  u.full_name as driver_name,
  d.status as current_status,
  COUNT(do.id) as total_deliveries,
  COUNT(CASE WHEN do.status = 'delivered' THEN 1 END) as completed_deliveries,
  COUNT(CASE WHEN do.actual_delivery_time <= do.scheduled_delivery_date THEN 1 END) as on_time_deliveries,
  AVG(EXTRACT(EPOCH FROM (do.actual_delivery_time - do.actual_pickup_time))/60) as avg_delivery_time_minutes,
  MAX(do.actual_delivery_time) as last_delivery_date
FROM shipping.drivers d
LEFT JOIN auth.users u ON d.user_id = u.id
LEFT JOIN shipping.delivery_orders do ON d.id = do.driver_id
WHERE d.is_active = true
GROUP BY d.id, d.employee_id, u.full_name, d.status;

-- Branch delivery statistics
CREATE VIEW shipping.v_branch_delivery_stats AS
SELECT 
  b.id as branch_id,
  b.name as branch_name,
  COUNT(CASE WHEN do.from_branch_id = b.id THEN 1 END) as outgoing_deliveries,
  COUNT(CASE WHEN do.to_branch_id = b.id THEN 1 END) as incoming_deliveries,
  COUNT(CASE WHEN do.to_branch_id = b.id AND do.status = 'delivered' THEN 1 END) as received_deliveries,
  AVG(CASE WHEN do.to_branch_id = b.id AND do.actual_delivery_time IS NOT NULL 
       THEN EXTRACT(EPOCH FROM (do.actual_delivery_time - do.scheduled_delivery_date))/60 END) as avg_delay_minutes
FROM public.branches b
LEFT JOIN shipping.delivery_orders do ON (b.id = do.from_branch_id OR b.id = do.to_branch_id)
GROUP BY b.id, b.name;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON shipping.delivery_orders TO shipping_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON shipping.delivery_order_items TO shipping_service;
GRANT SELECT, INSERT ON shipping.delivery_tracking TO shipping_service;
GRANT SELECT, INSERT, UPDATE ON shipping.driver_assignments TO shipping_service;
GRANT SELECT, INSERT, UPDATE ON shipping.drivers TO shipping_service;
GRANT SELECT, INSERT, UPDATE ON shipping.vehicles TO shipping_service;
GRANT SELECT, INSERT, UPDATE ON shipping.route_optimizations TO shipping_service;

-- Grant view permissions
GRANT SELECT ON shipping.v_active_delivery_orders TO shipping_service;
GRANT SELECT ON shipping.v_driver_performance TO shipping_service;
GRANT SELECT ON shipping.v_branch_delivery_stats TO shipping_service;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA shipping TO shipping_service;

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION generate_delivery_order_number() TO shipping_service;

-- Add comments for documentation
COMMENT ON SCHEMA shipping IS 'Shipping and delivery tracking system for dried fruits inventory management';
COMMENT ON TABLE shipping.delivery_orders IS 'Main delivery orders with scheduling and status tracking';
COMMENT ON TABLE shipping.delivery_order_items IS 'Individual items in each delivery order';
COMMENT ON TABLE shipping.delivery_tracking IS 'Real-time tracking events for delivery orders';
COMMENT ON TABLE shipping.drivers IS 'Driver information and current status';
COMMENT ON TABLE shipping.vehicles IS 'Company vehicles and their specifications';
COMMENT ON TABLE shipping.driver_assignments IS 'Assignment of drivers to delivery orders';
COMMENT ON VIEW shipping.v_active_delivery_orders IS 'Active delivery orders with enriched branch and driver information';
COMMENT ON VIEW shipping.v_driver_performance IS 'Driver performance metrics and statistics';
COMMENT ON VIEW shipping.v_branch_delivery_stats IS 'Branch-level delivery statistics and performance';