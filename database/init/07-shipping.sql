-- Carriers
CREATE TABLE shipping.carriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address JSONB NOT NULL,
    api_endpoint VARCHAR(500),
    api_key VARCHAR(255),
    tracking_endpoint VARCHAR(500),
    supported_services TEXT[],
    is_active BOOLEAN DEFAULT true,
    on_time_delivery_rate DECIMAL(5, 4) DEFAULT 0,
    damage_rate DECIMAL(5, 4) DEFAULT 0,
    customer_satisfaction DECIMAL(3, 2) DEFAULT 0,
    response_time INTEGER DEFAULT 0,
    last_rating_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Carrier services
CREATE TABLE shipping.carrier_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_id UUID NOT NULL REFERENCES shipping.carriers(id) ON DELETE CASCADE,
    service_code VARCHAR(20) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    description TEXT,
    max_weight DECIMAL(8, 2) NOT NULL,
    max_length DECIMAL(8, 2),
    max_width DECIMAL(8, 2),
    max_height DECIMAL(8, 2),
    dimensions_unit VARCHAR(10) DEFAULT 'cm',
    delivery_time INTEGER NOT NULL,
    cost DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(carrier_id, service_code)
);

-- Transfer orders
CREATE TABLE shipping.transfer_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    from_branch_id UUID NOT NULL REFERENCES public.branches(id),
    to_branch_id UUID NOT NULL REFERENCES public.branches(id),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'preparing', 'shipped', 'received', 'completed', 'cancelled')),
    type VARCHAR(20) DEFAULT 'regular' CHECK (type IN ('regular', 'emergency', 'redistribution', 'return_to_warehouse')),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    total_value DECIMAL(12, 2) DEFAULT 0,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    requested_date TIMESTAMP NOT NULL,
    approved_date TIMESTAMP,
    shipped_date TIMESTAMP,
    received_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transfer order items
CREATE TABLE shipping.transfer_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_order_id UUID NOT NULL REFERENCES shipping.transfer_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    requested_quantity DECIMAL(12, 3) NOT NULL,
    approved_quantity DECIMAL(12, 3),
    shipped_quantity DECIMAL(12, 3),
    received_quantity DECIMAL(12, 3),
    unit unit_type NOT NULL,
    unit_cost DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipments
CREATE TABLE shipping.shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_number VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID REFERENCES sales.orders(id),
    transfer_order_id UUID REFERENCES shipping.transfer_orders(id),
    from_branch_id UUID NOT NULL REFERENCES public.branches(id),
    to_branch_id UUID NOT NULL REFERENCES public.branches(id),
    carrier_id UUID REFERENCES shipping.carriers(id),
    carrier_name VARCHAR(255),
    service_type VARCHAR(100),
    driver_name VARCHAR(255),
    driver_phone VARCHAR(20),
    vehicle_number VARCHAR(20),
    status shipment_status NOT NULL DEFAULT 'pending',
    pickup_address JSONB NOT NULL,
    delivery_address JSONB NOT NULL,
    pickup_date TIMESTAMP NOT NULL,
    expected_delivery_date TIMESTAMP NOT NULL,
    actual_delivery_date TIMESTAMP,
    tracking_number VARCHAR(100),
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    weight DECIMAL(8, 2) NOT NULL,
    length DECIMAL(8, 2),
    width DECIMAL(8, 2),
    height DECIMAL(8, 2),
    dimensions_unit VARCHAR(10) DEFAULT 'cm',
    special_instructions TEXT,
    signature VARCHAR(255),
    photos TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipment items
CREATE TABLE shipping.shipment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipping.shipments(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity DECIMAL(12, 3) NOT NULL,
    unit unit_type NOT NULL,
    weight DECIMAL(8, 2) NOT NULL,
    condition VARCHAR(20) DEFAULT 'good' CHECK (condition IN ('good', 'damaged', 'missing')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Delivery attempts
CREATE TABLE shipping.delivery_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipping.shipments(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    attempt_date TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('successful', 'failed')),
    reason TEXT,
    recipient_name VARCHAR(255),
    signature VARCHAR(255),
    photos TEXT[],
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Routes
CREATE TABLE shipping.routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_name VARCHAR(255) NOT NULL,
    description TEXT,
    start_branch_id UUID NOT NULL REFERENCES public.branches(id),
    end_branch_id UUID NOT NULL REFERENCES public.branches(id),
    distance DECIMAL(8, 2) NOT NULL,
    estimated_duration INTEGER NOT NULL,
    cost DECIMAL(10, 2) NOT NULL,
    max_weight DECIMAL(8, 2),
    max_volume DECIMAL(8, 2),
    vehicle_types TEXT[],
    special_requirements TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Route waypoints
CREATE TABLE shipping.route_waypoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES shipping.routes(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    sequence INTEGER NOT NULL,
    estimated_arrival TIME NOT NULL,
    estimated_departure TIME NOT NULL,
    service_time INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(route_id, sequence)
);

-- Route time windows
CREATE TABLE shipping.route_time_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES shipping.routes(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    days_of_week INTEGER[] NOT NULL CHECK (array_length(days_of_week, 1) > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_carriers_code ON shipping.carriers(carrier_code);
CREATE INDEX idx_carriers_is_active ON shipping.carriers(is_active);
CREATE INDEX idx_carrier_services_carrier_id ON shipping.carrier_services(carrier_id);
CREATE INDEX idx_transfer_orders_from_branch ON shipping.transfer_orders(from_branch_id);
CREATE INDEX idx_transfer_orders_to_branch ON shipping.transfer_orders(to_branch_id);
CREATE INDEX idx_transfer_orders_status ON shipping.transfer_orders(status);
CREATE INDEX idx_transfer_orders_requested_date ON shipping.transfer_orders(requested_date);
CREATE INDEX idx_transfer_order_items_transfer_id ON shipping.transfer_order_items(transfer_order_id);
CREATE INDEX idx_shipments_from_branch ON shipping.shipments(from_branch_id);
CREATE INDEX idx_shipments_to_branch ON shipping.shipments(to_branch_id);
CREATE INDEX idx_shipments_status ON shipping.shipments(status);
CREATE INDEX idx_shipments_tracking_number ON shipping.shipments(tracking_number);
CREATE INDEX idx_shipments_pickup_date ON shipping.shipments(pickup_date);
CREATE INDEX idx_shipment_items_shipment_id ON shipping.shipment_items(shipment_id);
CREATE INDEX idx_delivery_attempts_shipment_id ON shipping.delivery_attempts(shipment_id);
CREATE INDEX idx_routes_start_branch ON shipping.routes(start_branch_id);
CREATE INDEX idx_routes_end_branch ON shipping.routes(end_branch_id);
CREATE INDEX idx_route_waypoints_route_id ON shipping.route_waypoints(route_id);