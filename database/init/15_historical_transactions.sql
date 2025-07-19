-- ================================================
-- PART 2: HISTORICAL TRANSACTION DATA (6 MONTHS)
-- Realistic sales, inventory movements, and business operations
-- ================================================

BEGIN;

-- ================================================
-- INITIAL INVENTORY SETUP (All branches, all products)
-- ================================================

-- Set initial stock levels for all products across all branches
INSERT INTO inventory_stocks (id, branch_id, product_id, current_stock, reserved_stock, last_updated, last_movement_id, reorder_point, optimal_stock_level)
SELECT 
    uuid_generate_v4(),
    b.id as branch_id,
    p.id as product_id,
    -- Stock levels vary by branch type and product popularity
    CASE 
        WHEN b.location_type = 'premium' THEN p.optimal_stock_level * (0.8 + random() * 0.4) -- 80-120% of optimal
        WHEN b.location_type = 'shopping_center' THEN p.optimal_stock_level * (0.9 + random() * 0.3) -- 90-120%
        WHEN b.location_type = 'community' THEN p.optimal_stock_level * (0.7 + random() * 0.4) -- 70-110%
        WHEN b.location_type = 'express' THEN p.optimal_stock_level * (0.4 + random() * 0.3) -- 40-70%
        ELSE p.optimal_stock_level * (0.6 + random() * 0.4)
    END as current_stock,
    0 as reserved_stock, -- No reservations initially
    CURRENT_TIMESTAMP - INTERVAL '180 days' as last_updated,
    NULL as last_movement_id,
    p.minimum_stock_level as reorder_point,
    p.optimal_stock_level
FROM branches b
CROSS JOIN products p;

-- ================================================
-- ALERT THRESHOLDS SETUP
-- ================================================

-- Set up alert thresholds for all branch-product combinations
INSERT INTO alert_thresholds (id, branch_id, product_id, reorder_point, reorder_quantity, min_order_quantity, max_stock_level, is_active, created_by)
SELECT 
    uuid_generate_v4(),
    inv.branch_id,
    inv.product_id,
    inv.reorder_point,
    p.optimal_stock_level * 0.6 as reorder_quantity, -- Reorder 60% of optimal
    p.minimum_stock_level as min_order_quantity,
    p.optimal_stock_level * 1.5 as max_stock_level, -- 150% of optimal as max
    true as is_active,
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1) as created_by
FROM inventory_stocks inv
JOIN products p ON p.id = inv.product_id;

-- ================================================
-- SAMPLING POLICIES SETUP
-- ================================================

-- Create sampling policies for different branch types
INSERT INTO sampling_policies (id, branch_id, product_id, max_daily_weight, cost_per_gram, requires_approval_above, is_active, created_by)
SELECT 
    uuid_generate_v4(),
    b.id as branch_id,
    p.id as product_id,
    -- Daily sampling limits based on branch type and product cost
    CASE 
        WHEN b.location_type = 'premium' AND p.unit_price > 400 THEN 50.0 -- High-end products, limited sampling
        WHEN b.location_type = 'premium' THEN 80.0
        WHEN b.location_type = 'shopping_center' AND p.unit_price > 400 THEN 80.0
        WHEN b.location_type = 'shopping_center' THEN 120.0
        WHEN b.location_type = 'community' THEN 100.0
        WHEN b.location_type = 'express' THEN 60.0
        ELSE 80.0
    END as max_daily_weight,
    p.cost_price / p.weight_per_unit as cost_per_gram, -- Cost per gram based on product cost
    -- Approval required above certain threshold
    CASE 
        WHEN b.location_type = 'premium' THEN 30.0
        WHEN b.location_type = 'express' THEN 20.0
        ELSE 40.0
    END as requires_approval_above,
    true as is_active,
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1) as created_by
FROM branches b
CROSS JOIN products p;

-- ================================================
-- GENERATE 6 MONTHS OF HISTORICAL SALES DATA
-- ================================================

-- Function to generate realistic sales patterns
CREATE OR REPLACE FUNCTION generate_historical_sales() RETURNS void AS $$
DECLARE
    current_date DATE;
    end_date DATE;
    branch_record RECORD;
    product_record RECORD;
    sales_count INTEGER;
    base_daily_sales INTEGER;
    weekend_multiplier DECIMAL;
    seasonal_multiplier DECIMAL;
    quantity DECIMAL;
    unit_price DECIMAL;
    discount_percentage DECIMAL;
    customer_type VARCHAR(20);
    staff_user_id UUID;
    sale_id UUID;
    item_cost DECIMAL;
BEGIN
    -- Set date range (last 6 months)
    current_date := CURRENT_DATE - INTERVAL '180 days';
    end_date := CURRENT_DATE;
    
    WHILE current_date <= end_date LOOP
        -- Weekend sales boost
        weekend_multiplier := CASE 
            WHEN EXTRACT(DOW FROM current_date) IN (0, 6) THEN 1.4 -- Sunday, Saturday
            WHEN EXTRACT(DOW FROM current_date) = 5 THEN 1.2 -- Friday
            ELSE 1.0
        END;
        
        -- Seasonal patterns (higher sales during holidays and hot season)
        seasonal_multiplier := CASE
            WHEN EXTRACT(MONTH FROM current_date) IN (3, 4, 5) THEN 1.3 -- Hot season
            WHEN EXTRACT(MONTH FROM current_date) IN (12, 1) THEN 1.5 -- Holiday season
            WHEN EXTRACT(MONTH FROM current_date) IN (7, 8) THEN 0.8 -- Rainy season
            ELSE 1.0
        END;
        
        -- Generate sales for each branch
        FOR branch_record IN SELECT * FROM branches WHERE is_active = true LOOP
            -- Base sales volume varies by branch type
            base_daily_sales := CASE 
                WHEN branch_record.location_type = 'premium' THEN 8 + FLOOR(random() * 5)
                WHEN branch_record.location_type = 'shopping_center' THEN 15 + FLOOR(random() * 10)
                WHEN branch_record.location_type = 'community' THEN 12 + FLOOR(random() * 8)
                WHEN branch_record.location_type = 'express' THEN 6 + FLOOR(random() * 4)
                ELSE 10
            END;
            
            sales_count := FLOOR(base_daily_sales * weekend_multiplier * seasonal_multiplier);
            
            -- Get random staff member for this branch
            SELECT id INTO staff_user_id 
            FROM users 
            WHERE branch_id = branch_record.id AND role IN ('staff', 'manager') 
            ORDER BY random() 
            LIMIT 1;
            
            -- Generate individual sales transactions
            FOR i IN 1..sales_count LOOP
                sale_id := uuid_generate_v4();
                
                -- Customer type distribution
                customer_type := CASE 
                    WHEN random() < 0.3 THEN 'walk_in'
                    WHEN random() < 0.7 THEN 'regular'
                    ELSE 'vip'
                END;
                
                -- Insert sale record
                INSERT INTO sales (
                    id, branch_id, sale_number, transaction_date, customer_type,
                    subtotal, discount_amount, tax_amount, total_amount, payment_method,
                    served_by, notes, cost_of_goods
                ) VALUES (
                    sale_id,
                    branch_record.id,
                    'SALE-' || TO_CHAR(current_date, 'YYYYMMDD') || '-' || LPAD(i::text, 4, '0'),
                    current_date + (random() * INTERVAL '14 hours') + INTERVAL '8 hours', -- Business hours
                    customer_type,
                    0, -- Will be calculated from items
                    0, -- Will be calculated
                    0, -- Will be calculated  
                    0, -- Will be calculated
                    CASE 
                        WHEN random() < 0.6 THEN 'cash'
                        WHEN random() < 0.9 THEN 'card'
                        ELSE 'mobile_payment'
                    END,
                    staff_user_id,
                    CASE WHEN random() < 0.1 THEN 'Customer requested gift wrapping' ELSE NULL END,
                    0 -- Will be calculated
                );
                
                -- Generate 1-4 items per sale
                FOR j IN 1..(1 + FLOOR(random() * 4)) LOOP
                    -- Select random product with preference for popular items
                    SELECT * INTO product_record 
                    FROM products 
                    WHERE is_active = true
                    ORDER BY 
                        CASE 
                            WHEN unit_price < 300 THEN random() * 2 -- Popular cheaper items
                            WHEN unit_price < 500 THEN random() * 1.5 -- Moderate items
                            ELSE random() -- Premium items
                        END DESC
                    LIMIT 1;
                    
                    -- Calculate quantity (bias toward smaller quantities)
                    quantity := CASE 
                        WHEN product_record.weight_per_unit > 200 THEN (random() * 2 + 1) * 100 -- Large items: 100-300g
                        WHEN product_record.weight_per_unit > 100 THEN (random() * 3 + 1) * 100 -- Medium items: 100-400g
                        ELSE (random() * 5 + 1) * 100 -- Small items: 100-600g
                    END;
                    
                    -- Apply customer-type pricing
                    unit_price := product_record.unit_price;
                    discount_percentage := CASE 
                        WHEN customer_type = 'vip' THEN 5 + random() * 10 -- 5-15% discount
                        WHEN customer_type = 'regular' THEN random() * 5 -- 0-5% discount
                        ELSE 0 -- No discount for walk-in
                    END;
                    
                    item_cost := product_record.cost_price * (quantity / product_record.weight_per_unit);
                    
                    -- Insert sale item
                    INSERT INTO sales_items (
                        id, sale_id, product_id, quantity, unit_price, 
                        discount_percentage, line_total, cost_price
                    ) VALUES (
                        uuid_generate_v4(),
                        sale_id,
                        product_record.id,
                        quantity,
                        unit_price,
                        discount_percentage,
                        (quantity / product_record.weight_per_unit) * unit_price * (1 - discount_percentage / 100),
                        item_cost
                    );
                    
                    -- Create inventory movement (stock reduction)
                    INSERT INTO inventory_movements (
                        id, branch_id, product_id, movement_type, quantity,
                        movement_date, reference_type, reference_id, unit_cost,
                        notes, created_by
                    ) VALUES (
                        uuid_generate_v4(),
                        branch_record.id,
                        product_record.id,
                        'sale',
                        -quantity, -- Negative for stock reduction
                        current_date + (random() * INTERVAL '14 hours') + INTERVAL '8 hours',
                        'sale',
                        sale_id,
                        product_record.cost_price,
                        'Sale transaction',
                        staff_user_id
                    );
                    
                    -- Update inventory stock
                    UPDATE inventory_stocks 
                    SET 
                        current_stock = current_stock - quantity,
                        last_updated = current_date + (random() * INTERVAL '14 hours') + INTERVAL '8 hours'
                    WHERE branch_id = branch_record.id AND product_id = product_record.id;
                    
                END LOOP;
                
                -- Update sale totals
                UPDATE sales 
                SET 
                    subtotal = (SELECT COALESCE(SUM(line_total), 0) FROM sales_items WHERE sale_id = sales.id),
                    cost_of_goods = (SELECT COALESCE(SUM(cost_price), 0) FROM sales_items WHERE sale_id = sales.id)
                WHERE id = sale_id;
                
                UPDATE sales 
                SET 
                    discount_amount = subtotal * 0.02, -- Small additional discount
                    tax_amount = subtotal * 0.07, -- 7% VAT
                    total_amount = subtotal + (subtotal * 0.07) - (subtotal * 0.02)
                WHERE id = sale_id;
                
            END LOOP;
        END LOOP;
        
        current_date := current_date + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to generate sales data
SELECT generate_historical_sales();

-- Drop the temporary function
DROP FUNCTION generate_historical_sales();

-- ================================================
-- GENERATE SAMPLING DATA (Historical)
-- ================================================

-- Function to generate realistic sampling history
CREATE OR REPLACE FUNCTION generate_historical_sampling() RETURNS void AS $$
DECLARE
    current_date DATE;
    end_date DATE;
    branch_record RECORD;
    product_record RECORD;
    policy_record RECORD;
    session_count INTEGER;
    session_id UUID;
    staff_user_id UUID;
    customer_count INTEGER;
    weight_sampled DECIMAL;
    total_cost DECIMAL;
BEGIN
    current_date := CURRENT_DATE - INTERVAL '180 days';
    end_date := CURRENT_DATE;
    
    WHILE current_date <= end_date LOOP
        -- Generate sampling sessions for each branch (not every day)
        FOR branch_record IN SELECT * FROM branches WHERE is_active = true LOOP
            -- Sampling frequency varies by branch type (2-5 sessions per week)
            IF random() < CASE 
                WHEN branch_record.location_type = 'premium' THEN 0.8
                WHEN branch_record.location_type = 'shopping_center' THEN 0.9
                WHEN branch_record.location_type = 'community' THEN 0.7
                WHEN branch_record.location_type = 'express' THEN 0.5
                ELSE 0.6
            END THEN
                
                session_count := 1 + FLOOR(random() * 3); -- 1-3 sessions per day
                
                FOR session_idx IN 1..session_count LOOP
                    session_id := uuid_generate_v4();
                    
                    -- Get random staff member
                    SELECT id INTO staff_user_id 
                    FROM users 
                    WHERE branch_id = branch_record.id AND role IN ('staff', 'manager') 
                    ORDER BY random() 
                    LIMIT 1;
                    
                    customer_count := 1 + FLOOR(random() * 5); -- 1-5 customers per session
                    
                    -- Create sampling session
                    INSERT INTO sampling_sessions (
                        id, branch_id, session_date, staff_id, customer_count,
                        session_notes, total_cost, status
                    ) VALUES (
                        session_id,
                        branch_record.id,
                        current_date + (random() * INTERVAL '12 hours') + INTERVAL '9 hours',
                        staff_user_id,
                        customer_count,
                        CASE 
                            WHEN random() < 0.2 THEN 'High customer interest in tropical fruits'
                            WHEN random() < 0.4 THEN 'Regular promotional sampling'
                            WHEN random() < 0.6 THEN 'New product introduction'
                            ELSE NULL
                        END,
                        0, -- Will be calculated
                        'completed'
                    );
                    
                    -- Generate sampling records for this session
                    FOR sample_idx IN 1..(1 + FLOOR(random() * 4)) LOOP -- 1-4 products sampled
                        -- Select products with sampling policies
                        SELECT p.*, sp.* INTO product_record, policy_record
                        FROM products p
                        JOIN sampling_policies sp ON sp.product_id = p.id
                        WHERE sp.branch_id = branch_record.id AND sp.is_active = true
                        ORDER BY random()
                        LIMIT 1;
                        
                        -- Generate realistic sampling weight
                        weight_sampled := CASE 
                            WHEN product_record.unit_price > 500 THEN 3 + random() * 12 -- 3-15g for premium
                            WHEN product_record.unit_price > 300 THEN 5 + random() * 15 -- 5-20g for mid-range
                            ELSE 8 + random() * 22 -- 8-30g for standard
                        END;
                        
                        -- Ensure within daily limits
                        weight_sampled := LEAST(weight_sampled, policy_record.max_daily_weight * 0.3);
                        
                        total_cost := weight_sampled * policy_record.cost_per_gram;
                        
                        -- Insert sampling record
                        INSERT INTO sampling_records (
                            id, sampling_session_id, product_id, weight_gram, total_cost
                        ) VALUES (
                            uuid_generate_v4(),
                            session_id,
                            product_record.id,
                            weight_sampled,
                            total_cost
                        );
                        
                        -- Create inventory movement for sampling
                        INSERT INTO inventory_movements (
                            id, branch_id, product_id, movement_type, quantity,
                            movement_date, reference_type, reference_id, unit_cost,
                            notes, created_by
                        ) VALUES (
                            uuid_generate_v4(),
                            branch_record.id,
                            product_record.id,
                            'sampling',
                            -weight_sampled, -- Negative for stock reduction
                            current_date + (random() * INTERVAL '12 hours') + INTERVAL '9 hours',
                            'sampling_session',
                            session_id,
                            policy_record.cost_per_gram,
                            'Product sampling',
                            staff_user_id
                        );
                        
                        -- Update inventory stock
                        UPDATE inventory_stocks 
                        SET 
                            current_stock = current_stock - weight_sampled,
                            last_updated = current_date + (random() * INTERVAL '12 hours') + INTERVAL '9 hours'
                        WHERE branch_id = branch_record.id AND product_id = product_record.id;
                        
                    END LOOP;
                    
                    -- Update session total cost
                    UPDATE sampling_sessions 
                    SET total_cost = (
                        SELECT COALESCE(SUM(total_cost), 0) 
                        FROM sampling_records 
                        WHERE sampling_session_id = session_id
                    )
                    WHERE id = session_id;
                    
                END LOOP;
            END IF;
        END LOOP;
        
        current_date := current_date + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute sampling data generation
SELECT generate_historical_sampling();

-- Drop the temporary function
DROP FUNCTION generate_historical_sampling();

-- ================================================
-- GENERATE PURCHASE ORDERS AND PROCUREMENT DATA
-- ================================================

-- Function to generate realistic procurement history
CREATE OR REPLACE FUNCTION generate_historical_procurement() RETURNS void AS $$
DECLARE
    current_date DATE;
    end_date DATE;
    supplier_record RECORD;
    branch_record RECORD;
    product_record RECORD;
    po_count INTEGER;
    po_id UUID;
    manager_user_id UUID;
    admin_user_id UUID;
    order_quantity DECIMAL;
    unit_cost DECIMAL;
    line_total DECIMAL;
    po_number VARCHAR(50);
    approval_id UUID;
BEGIN
    current_date := CURRENT_DATE - INTERVAL '180 days';
    end_date := CURRENT_DATE;
    
    -- Get admin and manager IDs
    SELECT id INTO admin_user_id FROM users WHERE role = 'admin' LIMIT 1;
    SELECT id INTO manager_user_id FROM users WHERE role = 'manager' LIMIT 1;
    
    -- Generate purchase orders weekly
    WHILE current_date <= end_date LOOP
        IF EXTRACT(DOW FROM current_date) = 1 THEN -- Monday orders
            po_count := 2 + FLOOR(random() * 4); -- 2-5 POs per week
            
            FOR po_idx IN 1..po_count LOOP
                -- Select supplier
                SELECT * INTO supplier_record 
                FROM suppliers 
                WHERE is_active = true 
                ORDER BY random() 
                LIMIT 1;
                
                po_id := uuid_generate_v4();
                po_number := 'PO-' || TO_CHAR(current_date, 'YYYYMMDD') || '-' || LPAD(po_idx::text, 3, '0');
                
                -- Create purchase order
                INSERT INTO purchase_orders (
                    id, po_number, supplier_id, status, order_date,
                    expected_delivery_date, total_amount, currency, payment_terms,
                    delivery_address, notes, created_by
                ) VALUES (
                    po_id,
                    po_number,
                    supplier_record.id,
                    'completed', -- Most historical orders completed
                    current_date,
                    current_date + INTERVAL '7 days' + (random() * INTERVAL '7 days'),
                    0, -- Will be calculated
                    'THB',
                    supplier_record.payment_terms,
                    'Main Warehouse - 123 Storage Rd, Bangkok 10400',
                    CASE WHEN random() < 0.2 THEN 'Urgent delivery required' ELSE NULL END,
                    manager_user_id
                );
                
                -- Add purchase order items (2-6 products per order)
                FOR item_idx IN 1..(2 + FLOOR(random() * 5)) LOOP
                    -- Select products that supplier provides
                    SELECT * INTO product_record 
                    FROM products 
                    WHERE is_active = true 
                    ORDER BY random() 
                    LIMIT 1;
                    
                    -- Calculate order quantity (restock amount)
                    order_quantity := product_record.optimal_stock_level * (1 + random()) * 12; -- For all branches
                    unit_cost := product_record.cost_price * (0.9 + random() * 0.2); -- Cost variation
                    line_total := order_quantity * unit_cost;
                    
                    INSERT INTO purchase_order_items (
                        id, purchase_order_id, product_id, quantity,
                        unit_cost, line_total, notes
                    ) VALUES (
                        uuid_generate_v4(),
                        po_id,
                        product_record.id,
                        order_quantity,
                        unit_cost,
                        line_total,
                        NULL
                    );
                END LOOP;
                
                -- Update PO total
                UPDATE purchase_orders 
                SET total_amount = (
                    SELECT COALESCE(SUM(line_total), 0) 
                    FROM purchase_order_items 
                    WHERE purchase_order_id = po_id
                )
                WHERE id = po_id;
                
                -- Create approval workflow
                approval_id := uuid_generate_v4();
                INSERT INTO purchase_order_approvals (
                    id, purchase_order_id, approver_id, approval_level,
                    status, approved_at, comments
                ) VALUES (
                    approval_id,
                    po_id,
                    manager_user_id,
                    1,
                    'approved',
                    current_date + INTERVAL '1 hour',
                    'Approved for standard procurement'
                );
                
                -- Executive approval for large orders
                IF (SELECT total_amount FROM purchase_orders WHERE id = po_id) > 50000 THEN
                    INSERT INTO purchase_order_approvals (
                        id, purchase_order_id, approver_id, approval_level,
                        status, approved_at, comments
                    ) VALUES (
                        uuid_generate_v4(),
                        po_id,
                        admin_user_id,
                        2,
                        'approved',
                        current_date + INTERVAL '4 hours',
                        'Executive approval for high-value procurement'
                    );
                END IF;
                
                -- Create goods receipt (most orders delivered)
                IF random() < 0.9 THEN
                    INSERT INTO goods_receipts (
                        id, purchase_order_id, receipt_number, received_date,
                        received_by, quality_check_status, notes, total_received_value
                    ) VALUES (
                        uuid_generate_v4(),
                        po_id,
                        'GR-' || po_number,
                        current_date + INTERVAL '5 days' + (random() * INTERVAL '5 days'),
                        manager_user_id,
                        CASE 
                            WHEN random() < 0.95 THEN 'passed'
                            ELSE 'failed'
                        END,
                        CASE WHEN random() < 0.1 THEN 'Some items had minor quality issues' ELSE NULL END,
                        (SELECT total_amount FROM purchase_orders WHERE id = po_id)
                    );
                    
                    -- Distribute inventory to branches
                    FOR branch_record IN SELECT * FROM branches WHERE is_active = true LOOP
                        FOR item_record IN 
                            SELECT poi.*, p.id as product_id
                            FROM purchase_order_items poi
                            JOIN products p ON p.id = poi.product_id
                            WHERE poi.purchase_order_id = po_id
                        LOOP
                            -- Distribute quantity across branches
                            order_quantity := item_record.quantity / 12 * (0.8 + random() * 0.4);
                            
                            -- Create inventory movement (stock increase)
                            INSERT INTO inventory_movements (
                                id, branch_id, product_id, movement_type, quantity,
                                movement_date, reference_type, reference_id, unit_cost,
                                notes, created_by
                            ) VALUES (
                                uuid_generate_v4(),
                                branch_record.id,
                                item_record.product_id,
                                'purchase',
                                order_quantity, -- Positive for stock increase
                                current_date + INTERVAL '7 days',
                                'purchase_order',
                                po_id,
                                item_record.unit_cost,
                                'Stock replenishment',
                                manager_user_id
                            );
                            
                            -- Update inventory stock
                            UPDATE inventory_stocks 
                            SET 
                                current_stock = current_stock + order_quantity,
                                last_updated = current_date + INTERVAL '7 days'
                            WHERE branch_id = branch_record.id AND product_id = item_record.product_id;
                        END LOOP;
                    END LOOP;
                END IF;
                
            END LOOP;
        END IF;
        
        current_date := current_date + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute procurement data generation
SELECT generate_historical_procurement();

-- Drop the temporary function
DROP FUNCTION generate_historical_procurement();

-- ================================================
-- GENERATE LOW STOCK ALERTS
-- ================================================

-- Create alerts for products currently below reorder point
INSERT INTO stock_alerts (id, branch_id, product_id, alert_type, severity, current_stock, reorder_point, suggested_quantity, alert_number, status, detected_at, created_by)
SELECT 
    uuid_generate_v4(),
    inv.branch_id,
    inv.product_id,
    'low_stock' as alert_type,
    CASE 
        WHEN inv.current_stock <= inv.reorder_point * 0.5 THEN 'critical'
        WHEN inv.current_stock <= inv.reorder_point * 0.7 THEN 'high'
        ELSE 'medium'
    END as severity,
    inv.current_stock,
    inv.reorder_point,
    p.optimal_stock_level * 0.6 as suggested_quantity,
    'ALERT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(ROW_NUMBER() OVER ()::text, 4, '0'),
    'active' as status,
    CURRENT_TIMESTAMP - (random() * INTERVAL '5 days'),
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
FROM inventory_stocks inv
JOIN products p ON p.id = inv.product_id
WHERE inv.current_stock <= inv.reorder_point
ORDER BY (inv.current_stock / NULLIF(inv.reorder_point, 0));

-- ================================================
-- REFRESH MATERIALIZED VIEWS
-- ================================================

REFRESH MATERIALIZED VIEW daily_sales_summary;
REFRESH MATERIALIZED VIEW branch_performance_summary;
REFRESH MATERIALIZED VIEW product_performance_summary;
REFRESH MATERIALIZED VIEW inventory_turnover_summary;

COMMIT;