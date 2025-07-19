-- Delivery Confirmation and Verification System Schema
-- =====================================================

-- Create delivery confirmations table
CREATE TABLE IF NOT EXISTS shipping.delivery_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_order_id UUID NOT NULL REFERENCES shipping.delivery_orders(id),
    confirmed_by UUID NOT NULL, -- User ID of the person confirming
    confirmation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    branch_id UUID NOT NULL, -- Branch receiving the delivery
    confirmation_method VARCHAR(50) NOT NULL DEFAULT 'manual', -- manual, barcode_scan, mobile_app
    notes TEXT,
    signature_data TEXT, -- Base64 encoded signature
    photo_evidence TEXT[], -- Array of photo URLs
    location_coordinates POINT, -- GPS coordinates of confirmation
    device_info JSONB, -- Device information for audit trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create delivery confirmation items table
CREATE TABLE IF NOT EXISTS shipping.delivery_confirmation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_confirmation_id UUID NOT NULL REFERENCES shipping.delivery_confirmations(id) ON DELETE CASCADE,
    delivery_order_item_id UUID NOT NULL REFERENCES shipping.delivery_order_items(id),
    expected_quantity DECIMAL(10,3) NOT NULL,
    received_quantity DECIMAL(10,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    condition_status VARCHAR(50) DEFAULT 'good', -- good, damaged, expired, missing
    barcode_scanned BOOLEAN DEFAULT false,
    batch_number VARCHAR(100),
    expiration_date DATE,
    damage_description TEXT,
    photo_evidence TEXT[], -- Photos of damaged items
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stock transfers table
CREATE TABLE IF NOT EXISTS shipping.stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_order_id UUID NOT NULL REFERENCES shipping.delivery_orders(id),
    delivery_confirmation_id UUID REFERENCES shipping.delivery_confirmations(id),
    from_branch_id UUID NOT NULL,
    to_branch_id UUID NOT NULL,
    transfer_type VARCHAR(50) NOT NULL DEFAULT 'delivery', -- delivery, return, adjustment
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID, -- User ID who processed the transfer
    total_items INTEGER NOT NULL DEFAULT 0,
    total_value DECIMAL(15,2) DEFAULT 0,
    reference_number VARCHAR(100) UNIQUE,
    notes TEXT,
    error_message TEXT, -- If transfer failed
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stock transfer items table
CREATE TABLE IF NOT EXISTS shipping.stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_transfer_id UUID NOT NULL REFERENCES shipping.stock_transfers(id) ON DELETE CASCADE,
    delivery_order_item_id UUID NOT NULL REFERENCES shipping.delivery_order_items(id),
    product_id UUID NOT NULL,
    inventory_item_id UUID NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_cost DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(15,2) DEFAULT 0,
    batch_number VARCHAR(100),
    expiration_date DATE,
    transfer_status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create discrepancy reports table
CREATE TABLE IF NOT EXISTS shipping.discrepancy_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_order_id UUID NOT NULL REFERENCES shipping.delivery_orders(id),
    delivery_confirmation_id UUID REFERENCES shipping.delivery_confirmations(id),
    reported_by UUID NOT NULL, -- User ID who reported
    report_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    discrepancy_type VARCHAR(50) NOT NULL, -- quantity_shortage, quantity_excess, damage, wrong_item, missing_item
    severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    status VARCHAR(50) DEFAULT 'open', -- open, investigating, resolved, closed
    resolution TEXT,
    resolved_by UUID, -- User ID who resolved
    resolved_at TIMESTAMP WITH TIME ZONE,
    total_affected_items INTEGER DEFAULT 0,
    total_value_impact DECIMAL(15,2) DEFAULT 0,
    requires_investigation BOOLEAN DEFAULT false,
    escalated_to UUID, -- Manager or supervisor ID
    escalated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create discrepancy report items table
CREATE TABLE IF NOT EXISTS shipping.discrepancy_report_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discrepancy_report_id UUID NOT NULL REFERENCES shipping.discrepancy_reports(id) ON DELETE CASCADE,
    delivery_order_item_id UUID NOT NULL REFERENCES shipping.delivery_order_items(id),
    product_id UUID NOT NULL,
    expected_quantity DECIMAL(10,3) NOT NULL,
    received_quantity DECIMAL(10,3) NOT NULL,
    discrepancy_quantity DECIMAL(10,3) NOT NULL, -- Can be negative for shortages
    unit VARCHAR(20) NOT NULL,
    discrepancy_reason TEXT,
    photo_evidence TEXT[],
    estimated_value_impact DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create barcode scan logs table
CREATE TABLE IF NOT EXISTS shipping.barcode_scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_confirmation_id UUID REFERENCES shipping.delivery_confirmations(id),
    delivery_order_item_id UUID REFERENCES shipping.delivery_order_items(id),
    barcode_value VARCHAR(255) NOT NULL,
    scan_result VARCHAR(50) NOT NULL, -- success, not_found, invalid, duplicate
    scanned_by UUID NOT NULL, -- User ID
    scan_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    device_info JSONB,
    location_coordinates POINT,
    verification_details JSONB, -- Additional verification data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_delivery_confirmations_order_id ON shipping.delivery_confirmations(delivery_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_confirmations_branch_id ON shipping.delivery_confirmations(branch_id);
CREATE INDEX IF NOT EXISTS idx_delivery_confirmations_date ON shipping.delivery_confirmations(confirmation_date);
CREATE INDEX IF NOT EXISTS idx_delivery_confirmations_confirmed_by ON shipping.delivery_confirmations(confirmed_by);

CREATE INDEX IF NOT EXISTS idx_delivery_confirmation_items_confirmation_id ON shipping.delivery_confirmation_items(delivery_confirmation_id);
CREATE INDEX IF NOT EXISTS idx_delivery_confirmation_items_order_item_id ON shipping.delivery_confirmation_items(delivery_order_item_id);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_order_id ON shipping.stock_transfers(delivery_order_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_confirmation_id ON shipping.stock_transfers(delivery_confirmation_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON shipping.stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_branch ON shipping.stock_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_branch ON shipping.stock_transfers(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_reference ON shipping.stock_transfers(reference_number);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer_id ON shipping.stock_transfer_items(stock_transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_product_id ON shipping.stock_transfer_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_inventory_id ON shipping.stock_transfer_items(inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_discrepancy_reports_order_id ON shipping.discrepancy_reports(delivery_order_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_reports_status ON shipping.discrepancy_reports(status);
CREATE INDEX IF NOT EXISTS idx_discrepancy_reports_type ON shipping.discrepancy_reports(discrepancy_type);
CREATE INDEX IF NOT EXISTS idx_discrepancy_reports_severity ON shipping.discrepancy_reports(severity);
CREATE INDEX IF NOT EXISTS idx_discrepancy_reports_reported_by ON shipping.discrepancy_reports(reported_by);

CREATE INDEX IF NOT EXISTS idx_discrepancy_report_items_report_id ON shipping.discrepancy_report_items(discrepancy_report_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_report_items_product_id ON shipping.discrepancy_report_items(product_id);

CREATE INDEX IF NOT EXISTS idx_barcode_scan_logs_confirmation_id ON shipping.barcode_scan_logs(delivery_confirmation_id);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_logs_barcode ON shipping.barcode_scan_logs(barcode_value);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_logs_timestamp ON shipping.barcode_scan_logs(scan_timestamp);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_logs_scanned_by ON shipping.barcode_scan_logs(scanned_by);

-- Create function to generate stock transfer reference number
CREATE OR REPLACE FUNCTION generate_stock_transfer_reference()
RETURNS TEXT AS $$
DECLARE
    new_ref TEXT;
    counter INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(reference_number FROM 4) AS INTEGER)), 0) + 1
    INTO counter
    FROM shipping.stock_transfers
    WHERE reference_number LIKE 'STR%';
    
    new_ref := 'STR' || LPAD(counter::TEXT, 6, '0');
    RETURN new_ref;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate reference number for stock transfers
CREATE OR REPLACE FUNCTION set_stock_transfer_reference()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reference_number IS NULL THEN
        NEW.reference_number := generate_stock_transfer_reference();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_stock_transfer_reference
    BEFORE INSERT ON shipping.stock_transfers
    FOR EACH ROW
    EXECUTE FUNCTION set_stock_transfer_reference();

-- Trigger to update delivery order totals when confirmation items change
CREATE OR REPLACE FUNCTION update_delivery_confirmation_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the parent confirmation with calculated totals
    UPDATE shipping.delivery_confirmations
    SET updated_at = NOW()
    WHERE id = COALESCE(NEW.delivery_confirmation_id, OLD.delivery_confirmation_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_delivery_confirmation_totals
    AFTER INSERT OR UPDATE OR DELETE ON shipping.delivery_confirmation_items
    FOR EACH ROW
    EXECUTE FUNCTION update_delivery_confirmation_totals();

-- Trigger to auto-create stock transfer when delivery is confirmed
CREATE OR REPLACE FUNCTION auto_create_stock_transfer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.confirmation_date IS NOT NULL AND OLD.confirmation_date IS NULL THEN
        INSERT INTO shipping.stock_transfers (
            delivery_order_id,
            delivery_confirmation_id,
            from_branch_id,
            to_branch_id,
            transfer_type,
            status,
            total_items,
            notes
        )
        SELECT 
            NEW.delivery_order_id,
            NEW.id,
            do.from_branch_id,
            do.to_branch_id,
            'delivery',
            'pending',
            (SELECT COUNT(*) FROM shipping.delivery_confirmation_items WHERE delivery_confirmation_id = NEW.id),
            'Auto-generated from delivery confirmation'
        FROM shipping.delivery_orders do
        WHERE do.id = NEW.delivery_order_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_stock_transfer
    AFTER UPDATE ON shipping.delivery_confirmations
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_stock_transfer();

-- Create views for common queries
CREATE OR REPLACE VIEW shipping.delivery_confirmation_summary AS
SELECT 
    dc.id,
    dc.delivery_order_id,
    do.order_number,
    dc.confirmed_by,
    u.full_name as confirmed_by_name,
    dc.confirmation_date,
    dc.branch_id,
    b.name as branch_name,
    dc.confirmation_method,
    COUNT(dci.id) as total_items,
    SUM(dci.expected_quantity) as total_expected_quantity,
    SUM(dci.received_quantity) as total_received_quantity,
    COUNT(CASE WHEN dci.received_quantity != dci.expected_quantity THEN 1 END) as discrepancy_count,
    dc.created_at,
    dc.updated_at
FROM shipping.delivery_confirmations dc
JOIN shipping.delivery_orders do ON dc.delivery_order_id = do.id
LEFT JOIN auth.users u ON dc.confirmed_by = u.id
LEFT JOIN public.branches b ON dc.branch_id = b.id
LEFT JOIN shipping.delivery_confirmation_items dci ON dc.id = dci.delivery_confirmation_id
GROUP BY dc.id, do.order_number, u.full_name, b.name;

CREATE OR REPLACE VIEW shipping.pending_confirmations AS
SELECT 
    do.id as delivery_order_id,
    do.order_number,
    do.to_branch_id,
    b.name as branch_name,
    do.scheduled_delivery_date,
    do.actual_delivery_time,
    do.status,
    COUNT(doi.id) as total_items,
    CASE 
        WHEN do.actual_delivery_time IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (NOW() - do.actual_delivery_time))/3600 
        ELSE NULL 
    END as hours_since_delivery
FROM shipping.delivery_orders do
JOIN public.branches b ON do.to_branch_id = b.id
LEFT JOIN shipping.delivery_order_items doi ON do.id = doi.delivery_order_id
LEFT JOIN shipping.delivery_confirmations dc ON do.id = dc.delivery_order_id
WHERE do.status = 'delivered' 
  AND dc.id IS NULL
GROUP BY do.id, do.order_number, b.name, do.scheduled_delivery_date, do.actual_delivery_time, do.status;

CREATE OR REPLACE VIEW shipping.stock_transfer_summary AS
SELECT 
    st.id,
    st.reference_number,
    st.delivery_order_id,
    do.order_number,
    st.from_branch_id,
    fb.name as from_branch_name,
    st.to_branch_id,
    tb.name as to_branch_name,
    st.status,
    st.total_items,
    st.total_value,
    COUNT(sti.id) as item_count,
    SUM(sti.quantity) as total_quantity,
    COUNT(CASE WHEN sti.transfer_status = 'completed' THEN 1 END) as completed_items,
    COUNT(CASE WHEN sti.transfer_status = 'failed' THEN 1 END) as failed_items,
    st.created_at,
    st.processed_at
FROM shipping.stock_transfers st
JOIN shipping.delivery_orders do ON st.delivery_order_id = do.id
JOIN public.branches fb ON st.from_branch_id = fb.id
JOIN public.branches tb ON st.to_branch_id = tb.id
LEFT JOIN shipping.stock_transfer_items sti ON st.id = sti.stock_transfer_id
GROUP BY st.id, do.order_number, fb.name, tb.name;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON shipping.delivery_confirmations TO shipping_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON shipping.delivery_confirmation_items TO shipping_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON shipping.stock_transfers TO shipping_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON shipping.stock_transfer_items TO shipping_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON shipping.discrepancy_reports TO shipping_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON shipping.discrepancy_report_items TO shipping_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON shipping.barcode_scan_logs TO shipping_service;

GRANT SELECT ON shipping.delivery_confirmation_summary TO shipping_service;
GRANT SELECT ON shipping.pending_confirmations TO shipping_service;
GRANT SELECT ON shipping.stock_transfer_summary TO shipping_service;

GRANT USAGE ON SEQUENCE shipping.delivery_confirmations_id_seq TO shipping_service;
GRANT USAGE ON SEQUENCE shipping.delivery_confirmation_items_id_seq TO shipping_service;
GRANT USAGE ON SEQUENCE shipping.stock_transfers_id_seq TO shipping_service;
GRANT USAGE ON SEQUENCE shipping.stock_transfer_items_id_seq TO shipping_service;
GRANT USAGE ON SEQUENCE shipping.discrepancy_reports_id_seq TO shipping_service;
GRANT USAGE ON SEQUENCE shipping.discrepancy_report_items_id_seq TO shipping_service;
GRANT USAGE ON SEQUENCE shipping.barcode_scan_logs_id_seq TO shipping_service;

-- Insert sample data for testing
INSERT INTO shipping.delivery_confirmations (id, delivery_order_id, confirmed_by, branch_id, confirmation_method, notes) 
VALUES (gen_random_uuid(), (SELECT id FROM shipping.delivery_orders LIMIT 1), gen_random_uuid(), gen_random_uuid(), 'manual', 'Sample confirmation')
ON CONFLICT DO NOTHING;