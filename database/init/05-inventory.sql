-- Inventory items
CREATE TABLE inventory.inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    current_stock DECIMAL(12, 3) NOT NULL DEFAULT 0,
    reserved_stock DECIMAL(12, 3) NOT NULL DEFAULT 0,
    available_stock DECIMAL(12, 3) GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
    unit unit_type NOT NULL,
    min_stock_level DECIMAL(12, 3) NOT NULL DEFAULT 0,
    max_stock_level DECIMAL(12, 3),
    reorder_point DECIMAL(12, 3) NOT NULL DEFAULT 0,
    reorder_quantity DECIMAL(12, 3) NOT NULL DEFAULT 0,
    last_restock_date TIMESTAMP,
    expiration_date TIMESTAMP,
    batch_number VARCHAR(50),
    supplier_lot_number VARCHAR(50),
    location_section VARCHAR(20),
    location_aisle VARCHAR(20),
    location_shelf VARCHAR(20),
    location_bin VARCHAR(20),
    cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    average_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, branch_id, batch_number)
);

-- Stock movements
CREATE TABLE inventory.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_item_id UUID NOT NULL REFERENCES inventory.inventory_items(id) ON DELETE CASCADE,
    type stock_movement_type NOT NULL,
    quantity DECIMAL(12, 3) NOT NULL,
    unit unit_type NOT NULL,
    previous_stock DECIMAL(12, 3) NOT NULL,
    new_stock DECIMAL(12, 3) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock counts
CREATE TABLE inventory.stock_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    count_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    type VARCHAR(20) DEFAULT 'cycle' CHECK (type IN ('full', 'cycle', 'spot')),
    scheduled_date TIMESTAMP NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    counted_by UUID[] NOT NULL,
    supervised_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock count items
CREATE TABLE inventory.stock_count_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_count_id UUID NOT NULL REFERENCES inventory.stock_counts(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory.inventory_items(id) ON DELETE CASCADE,
    expected_quantity DECIMAL(12, 3) NOT NULL,
    counted_quantity DECIMAL(12, 3),
    variance DECIMAL(12, 3) GENERATED ALWAYS AS (counted_quantity - expected_quantity) STORED,
    notes TEXT,
    counted_by UUID REFERENCES auth.users(id),
    counted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stock_count_id, inventory_item_id)
);

-- Repack orders
CREATE TABLE inventory.repack_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repack_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    target_product_id UUID NOT NULL REFERENCES public.products(id),
    expected_quantity DECIMAL(12, 3) NOT NULL,
    actual_quantity DECIMAL(12, 3),
    target_unit unit_type NOT NULL,
    scheduled_date TIMESTAMP NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    performed_by UUID REFERENCES auth.users(id),
    supervised_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Repack source items
CREATE TABLE inventory.repack_source_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repack_order_id UUID NOT NULL REFERENCES inventory.repack_orders(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory.inventory_items(id),
    required_quantity DECIMAL(12, 3) NOT NULL,
    actual_quantity DECIMAL(12, 3),
    unit unit_type NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Low stock alerts
CREATE TABLE inventory.low_stock_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_item_id UUID NOT NULL REFERENCES inventory.inventory_items(id) ON DELETE CASCADE,
    alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('warning', 'critical')),
    current_stock DECIMAL(12, 3) NOT NULL,
    min_stock_level DECIMAL(12, 3) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'ignored')),
    notified_users UUID[],
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_inventory_items_product_branch ON inventory.inventory_items(product_id, branch_id);
CREATE INDEX idx_inventory_items_branch_id ON inventory.inventory_items(branch_id);
CREATE INDEX idx_inventory_items_current_stock ON inventory.inventory_items(current_stock);
CREATE INDEX idx_inventory_items_reorder_point ON inventory.inventory_items(reorder_point);
CREATE INDEX idx_stock_movements_inventory_item ON inventory.stock_movements(inventory_item_id);
CREATE INDEX idx_stock_movements_type ON inventory.stock_movements(type);
CREATE INDEX idx_stock_movements_performed_by ON inventory.stock_movements(performed_by);
CREATE INDEX idx_stock_movements_created_at ON inventory.stock_movements(created_at);
CREATE INDEX idx_stock_counts_branch_id ON inventory.stock_counts(branch_id);
CREATE INDEX idx_stock_counts_status ON inventory.stock_counts(status);
CREATE INDEX idx_stock_counts_scheduled_date ON inventory.stock_counts(scheduled_date);
CREATE INDEX idx_repack_orders_branch_id ON inventory.repack_orders(branch_id);
CREATE INDEX idx_repack_orders_status ON inventory.repack_orders(status);
CREATE INDEX idx_low_stock_alerts_inventory_item ON inventory.low_stock_alerts(inventory_item_id);
CREATE INDEX idx_low_stock_alerts_status ON inventory.low_stock_alerts(status);