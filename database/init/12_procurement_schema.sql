-- =====================================================
-- Purchase Order and Procurement System Schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Suppliers table
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_code VARCHAR(20) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    tax_id VARCHAR(50),
    payment_terms INTEGER DEFAULT 30, -- days
    credit_limit DECIMAL(15,2) DEFAULT 0,
    currency_code VARCHAR(3) DEFAULT 'THB',
    is_active BOOLEAN DEFAULT true,
    supplier_type VARCHAR(50) DEFAULT 'regular', -- regular, premium, backup
    lead_time_days INTEGER DEFAULT 7,
    minimum_order_amount DECIMAL(15,2) DEFAULT 0,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    quality_rating DECIMAL(3,2) DEFAULT 0, -- 0-5 rating
    delivery_rating DECIMAL(3,2) DEFAULT 0, -- 0-5 rating
    price_competitiveness DECIMAL(3,2) DEFAULT 0, -- 0-5 rating
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Supplier products (what each supplier can provide)
CREATE TABLE supplier_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_sku VARCHAR(100),
    unit_cost DECIMAL(10,2) NOT NULL,
    minimum_quantity DECIMAL(10,2) DEFAULT 1,
    lead_time_days INTEGER DEFAULT 7,
    is_preferred BOOLEAN DEFAULT false,
    quality_grade VARCHAR(20) DEFAULT 'A', -- A, B, C grading
    last_price_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, product_id)
);

-- Purchase order statuses
CREATE TYPE purchase_order_status AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'sent_to_supplier',
    'confirmed_by_supplier',
    'in_transit',
    'partially_received',
    'fully_received',
    'completed',
    'cancelled'
);

-- Purchase order urgency levels
CREATE TYPE urgency_level AS ENUM ('low', 'normal', 'high', 'urgent');

-- Purchase orders table
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    requested_by UUID NOT NULL REFERENCES users(id),
    status purchase_order_status DEFAULT 'draft',
    urgency urgency_level DEFAULT 'normal',
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    required_date DATE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    shipping_cost DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    currency_code VARCHAR(3) DEFAULT 'THB',
    payment_terms INTEGER DEFAULT 30,
    notes TEXT,
    internal_notes TEXT, -- for internal use only
    supplier_reference VARCHAR(100), -- supplier's order number
    tracking_number VARCHAR(100),
    is_automated BOOLEAN DEFAULT false, -- created by system from low stock alert
    source_alert_id UUID REFERENCES stock_alerts(id), -- reference to triggering alert
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    cancelled_reason TEXT,
    cancelled_by UUID REFERENCES users(id),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Purchase order items table
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    supplier_product_id UUID REFERENCES supplier_products(id),
    quantity_ordered DECIMAL(10,2) NOT NULL,
    quantity_received DECIMAL(10,2) DEFAULT 0,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(15,2) GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED,
    actual_unit_cost DECIMAL(10,2), -- actual cost when received
    actual_total_cost DECIMAL(15,2), -- actual total when received
    supplier_sku VARCHAR(100),
    expected_quality_grade VARCHAR(20) DEFAULT 'A',
    actual_quality_grade VARCHAR(20),
    expiration_date DATE,
    batch_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Purchase approval workflow
CREATE TYPE approval_action AS ENUM ('approve', 'reject', 'request_changes');

CREATE TABLE purchase_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    approval_level INTEGER NOT NULL, -- 1 = Manager, 2 = Executive, etc.
    required_role VARCHAR(50) NOT NULL, -- manager, executive, admin
    approver_id UUID REFERENCES users(id),
    action approval_action,
    comments TEXT,
    approved_amount DECIMAL(15,2), -- can approve partial amount
    action_date TIMESTAMP WITH TIME ZONE,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Goods receipt/receiving records
CREATE TABLE goods_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    received_by UUID NOT NULL REFERENCES users(id),
    received_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivery_note_number VARCHAR(100),
    invoice_number VARCHAR(100),
    total_received_amount DECIMAL(15,2) DEFAULT 0,
    quality_check_status VARCHAR(20) DEFAULT 'pending', -- pending, passed, failed, partial
    quality_checked_by UUID REFERENCES users(id),
    quality_check_date TIMESTAMP WITH TIME ZONE,
    quality_notes TEXT,
    discrepancy_notes TEXT,
    is_complete BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Goods receipt items
CREATE TABLE goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    purchase_order_item_id UUID NOT NULL REFERENCES purchase_order_items(id),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity_received DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(15,2) GENERATED ALWAYS AS (quantity_received * unit_cost) STORED,
    quality_grade VARCHAR(20),
    expiration_date DATE,
    batch_number VARCHAR(100),
    condition_notes TEXT,
    is_accepted BOOLEAN DEFAULT true,
    rejection_reason TEXT,
    inventory_item_id UUID REFERENCES inventory_items(id), -- link to created inventory
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Supplier performance tracking
CREATE TABLE supplier_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    evaluation_period_start DATE NOT NULL,
    evaluation_period_end DATE NOT NULL,
    total_orders INTEGER DEFAULT 0,
    total_order_value DECIMAL(15,2) DEFAULT 0,
    on_time_deliveries INTEGER DEFAULT 0,
    quality_issues INTEGER DEFAULT 0,
    delivery_rating DECIMAL(3,2) DEFAULT 0, -- 0-5 scale
    quality_rating DECIMAL(3,2) DEFAULT 0, -- 0-5 scale
    price_competitiveness DECIMAL(3,2) DEFAULT 0, -- 0-5 scale
    communication_rating DECIMAL(3,2) DEFAULT 0, -- 0-5 scale
    overall_rating DECIMAL(3,2) DEFAULT 0, -- 0-5 scale
    notes TEXT,
    evaluated_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_branch ON purchase_orders(branch_id);
CREATE INDEX idx_purchase_orders_date ON purchase_orders(order_date);
CREATE INDEX idx_purchase_orders_po_number ON purchase_orders(po_number);

CREATE INDEX idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_product ON purchase_order_items(product_id);

CREATE INDEX idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX idx_supplier_products_product ON supplier_products(product_id);

CREATE INDEX idx_purchase_approvals_po ON purchase_approvals(purchase_order_id);
CREATE INDEX idx_purchase_approvals_level ON purchase_approvals(approval_level);

CREATE INDEX idx_goods_receipts_po ON goods_receipts(purchase_order_id);
CREATE INDEX idx_goods_receipts_date ON goods_receipts(received_date);

-- Functions for automation

-- Generate purchase order number
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
DECLARE
    year_suffix TEXT;
    next_number INTEGER;
    po_number TEXT;
BEGIN
    year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 'PO' || year_suffix || '(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM purchase_orders
    WHERE po_number LIKE 'PO' || year_suffix || '%';
    
    po_number := 'PO' || year_suffix || LPAD(next_number::TEXT, 6, '0');
    
    RETURN po_number;
END;
$$ LANGUAGE plpgsql;

-- Generate goods receipt number
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
    year_suffix TEXT;
    next_number INTEGER;
    receipt_number TEXT;
BEGIN
    year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 'GR' || year_suffix || '(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM goods_receipts
    WHERE receipt_number LIKE 'GR' || year_suffix || '%';
    
    receipt_number := 'GR' || year_suffix || LPAD(next_number::TEXT, 6, '0');
    
    RETURN receipt_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate purchase order totals
CREATE OR REPLACE FUNCTION calculate_po_totals(po_id UUID)
RETURNS VOID AS $$
DECLARE
    subtotal DECIMAL(15,2);
    tax_rate DECIMAL(5,2) := 7.0; -- 7% VAT
    tax_amount DECIMAL(15,2);
    total DECIMAL(15,2);
BEGIN
    -- Calculate subtotal from items
    SELECT COALESCE(SUM(total_cost), 0)
    INTO subtotal
    FROM purchase_order_items
    WHERE purchase_order_id = po_id;
    
    -- Calculate tax
    tax_amount := subtotal * (tax_rate / 100);
    
    -- Calculate total
    total := subtotal + tax_amount;
    
    -- Update purchase order
    UPDATE purchase_orders
    SET 
        subtotal = calculate_po_totals.subtotal,
        tax_amount = calculate_po_totals.tax_amount,
        total_amount = total,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = po_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check approval requirements
CREATE OR REPLACE FUNCTION get_required_approvals(po_amount DECIMAL, branch_id UUID)
RETURNS TABLE(approval_level INTEGER, required_role VARCHAR) AS $$
BEGIN
    -- Basic approval matrix based on amount
    IF po_amount >= 100000 THEN
        -- High value orders require executive approval
        RETURN QUERY VALUES 
            (1, 'manager'::VARCHAR),
            (2, 'executive'::VARCHAR);
    ELSIF po_amount >= 50000 THEN
        -- Medium value orders require manager approval
        RETURN QUERY VALUES 
            (1, 'manager'::VARCHAR);
    ELSE
        -- Low value orders can be auto-approved for managers
        RETURN QUERY VALUES 
            (1, 'supervisor'::VARCHAR);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create approval workflow
CREATE OR REPLACE FUNCTION create_approval_workflow(po_id UUID)
RETURNS VOID AS $$
DECLARE
    po_record RECORD;
    approval_record RECORD;
BEGIN
    -- Get purchase order details
    SELECT total_amount, branch_id INTO po_record
    FROM purchase_orders
    WHERE id = po_id;
    
    -- Create required approval records
    FOR approval_record IN 
        SELECT * FROM get_required_approvals(po_record.total_amount, po_record.branch_id)
    LOOP
        INSERT INTO purchase_approvals (
            purchase_order_id,
            approval_level,
            required_role,
            is_required
        ) VALUES (
            po_id,
            approval_record.approval_level,
            approval_record.required_role,
            true
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update supplier ratings
CREATE OR REPLACE FUNCTION update_supplier_rating(
    supplier_id UUID,
    delivery_score DECIMAL DEFAULT NULL,
    quality_score DECIMAL DEFAULT NULL,
    price_score DECIMAL DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE suppliers
    SET 
        delivery_rating = CASE 
            WHEN delivery_score IS NOT NULL THEN 
                COALESCE((delivery_rating * 0.8) + (delivery_score * 0.2), delivery_score)
            ELSE delivery_rating 
        END,
        quality_rating = CASE 
            WHEN quality_score IS NOT NULL THEN 
                COALESCE((quality_rating * 0.8) + (quality_score * 0.2), quality_score)
            ELSE quality_rating 
        END,
        price_competitiveness = CASE 
            WHEN price_score IS NOT NULL THEN 
                COALESCE((price_competitiveness * 0.8) + (price_score * 0.2), price_score)
            ELSE price_competitiveness 
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = supplier_id;
END;
$$ LANGUAGE plpgsql;

-- Triggers

-- Auto-generate PO number
CREATE OR REPLACE FUNCTION set_po_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
        NEW.po_number := generate_po_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_po_number
    BEFORE INSERT ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION set_po_number();

-- Auto-generate receipt number
CREATE OR REPLACE FUNCTION set_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
        NEW.receipt_number := generate_receipt_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_receipt_number
    BEFORE INSERT ON goods_receipts
    FOR EACH ROW
    EXECUTE FUNCTION set_receipt_number();

-- Auto-calculate PO totals when items change
CREATE OR REPLACE FUNCTION update_po_totals()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM calculate_po_totals(COALESCE(NEW.purchase_order_id, OLD.purchase_order_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_po_totals
    AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_po_totals();

-- Auto-create approval workflow
CREATE OR REPLACE FUNCTION setup_approval_workflow()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'pending_approval' AND OLD.status = 'draft' THEN
        PERFORM create_approval_workflow(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_setup_approval_workflow
    AFTER UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION setup_approval_workflow();

-- Update received quantities in PO items
CREATE OR REPLACE FUNCTION update_received_quantities()
RETURNS TRIGGER AS $$
BEGIN
    -- Update purchase order item received quantity
    UPDATE purchase_order_items
    SET 
        quantity_received = quantity_received + NEW.quantity_received,
        actual_unit_cost = NEW.unit_cost,
        actual_total_cost = quantity_received * NEW.unit_cost,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.purchase_order_item_id;
    
    -- Check if PO is fully received
    PERFORM check_po_completion(
        (SELECT purchase_order_id FROM purchase_order_items WHERE id = NEW.purchase_order_item_id)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_received_quantities
    AFTER INSERT ON goods_receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION update_received_quantities();

-- Function to check if PO is complete
CREATE OR REPLACE FUNCTION check_po_completion(po_id UUID)
RETURNS VOID AS $$
DECLARE
    total_items INTEGER;
    fully_received_items INTEGER;
    partially_received_items INTEGER;
BEGIN
    -- Count items
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE quantity_received >= quantity_ordered),
        COUNT(*) FILTER (WHERE quantity_received > 0 AND quantity_received < quantity_ordered)
    INTO total_items, fully_received_items, partially_received_items
    FROM purchase_order_items
    WHERE purchase_order_id = po_id;
    
    -- Update PO status
    UPDATE purchase_orders
    SET 
        status = CASE
            WHEN fully_received_items = total_items THEN 'fully_received'::purchase_order_status
            WHEN partially_received_items > 0 OR fully_received_items > 0 THEN 'partially_received'::purchase_order_status
            ELSE status
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = po_id;
END;
$$ LANGUAGE plpgsql;

-- Insert sample suppliers
INSERT INTO suppliers (supplier_code, company_name, contact_person, email, phone, address, payment_terms, supplier_type, lead_time_days) VALUES
('SUP001', 'Thai Dried Fruits Co., Ltd.', 'Somchai Jaidee', 'somchai@thaidriedfruits.com', '02-123-4567', '123 Sukhumvit Rd, Bangkok', 30, 'premium', 5),
('SUP002', 'Golden Valley Suppliers', 'Pranee Sukjai', 'info@goldenvalley.co.th', '053-456-789', '456 Chiang Mai Rd, Chiang Mai', 15, 'regular', 7),
('SUP003', 'Tropical Harvest Ltd.', 'John Smith', 'orders@tropicalharvest.com', '076-789-012', '789 Phuket Rd, Phuket', 45, 'regular', 10),
('SUP004', 'Premium Fruits Express', 'Niran Kaewjai', 'niran@premiumfruits.co.th', '02-987-6543', '321 Ratchada Rd, Bangkok', 7, 'premium', 3);

COMMENT ON TABLE suppliers IS 'Supplier master data for procurement';
COMMENT ON TABLE purchase_orders IS 'Purchase order header information';
COMMENT ON TABLE purchase_order_items IS 'Line items for each purchase order';
COMMENT ON TABLE purchase_approvals IS 'Multi-level approval workflow for purchase orders';
COMMENT ON TABLE goods_receipts IS 'Goods receiving records';
COMMENT ON TABLE supplier_evaluations IS 'Supplier performance tracking and evaluation';