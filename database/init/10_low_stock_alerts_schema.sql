-- =====================================================
-- Low Stock Alert and Notification System Schema
-- =====================================================

-- Alert Thresholds Table
CREATE TABLE IF NOT EXISTS alert_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id),
    
    -- Threshold settings
    minimum_stock_level DECIMAL(10,3) NOT NULL DEFAULT 0,
    reorder_point DECIMAL(10,3) NOT NULL DEFAULT 0,
    maximum_stock_level DECIMAL(10,3),
    unit VARCHAR(20) NOT NULL DEFAULT 'kilogram',
    
    -- Auto-calculation settings
    use_auto_calculation BOOLEAN DEFAULT true,
    auto_calculation_days INTEGER DEFAULT 30, -- Days to analyze for calculation
    safety_stock_multiplier DECIMAL(3,2) DEFAULT 1.2,
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(branch_id, product_id)
);

-- Stock Alerts Table
CREATE TABLE IF NOT EXISTS stock_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Alert details
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'low_stock', 'out_of_stock', 'approaching_expiry', 
        'overstocked', 'manual_alert'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN (
        'low', 'medium', 'high', 'critical'
    )) DEFAULT 'medium',
    status VARCHAR(20) NOT NULL CHECK (status IN (
        'active', 'acknowledged', 'resolved', 'dismissed'
    )) DEFAULT 'active',
    
    -- Product and branch information
    branch_id UUID NOT NULL REFERENCES branches(id),
    product_id UUID NOT NULL REFERENCES products(id),
    inventory_item_id UUID REFERENCES inventory_items(id),
    
    -- Stock information
    current_stock_level DECIMAL(10,3) NOT NULL,
    threshold_level DECIMAL(10,3) NOT NULL,
    suggested_reorder_quantity DECIMAL(10,3),
    unit VARCHAR(20) NOT NULL DEFAULT 'kilogram',
    
    -- Alert metadata
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    additional_data JSONB,
    
    -- Tracking
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Alert Subscriptions Table
CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Subscription settings
    alert_types VARCHAR(50)[] NOT NULL DEFAULT ARRAY['low_stock', 'out_of_stock'],
    severity_levels VARCHAR(20)[] NOT NULL DEFAULT ARRAY['medium', 'high', 'critical'],
    branch_ids UUID[] DEFAULT NULL, -- NULL means all branches
    category_ids UUID[] DEFAULT NULL, -- NULL means all categories
    
    -- Notification channels
    email_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    push_enabled BOOLEAN DEFAULT true,
    
    -- Delivery preferences
    immediate_delivery BOOLEAN DEFAULT true,
    digest_frequency VARCHAR(20) CHECK (digest_frequency IN (
        'immediate', 'hourly', 'daily', 'weekly'
    )) DEFAULT 'immediate',
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(50) DEFAULT 'Asia/Bangkok',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

-- Notification Deliveries Table
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_alert_id UUID NOT NULL REFERENCES stock_alerts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Delivery details
    channel VARCHAR(20) NOT NULL CHECK (channel IN (
        'email', 'sms', 'push', 'in_app', 'webhook'
    )),
    status VARCHAR(20) NOT NULL CHECK (status IN (
        'pending', 'sent', 'delivered', 'failed', 'cancelled'
    )) DEFAULT 'pending',
    
    -- Content
    subject VARCHAR(200),
    message TEXT NOT NULL,
    recipient_address VARCHAR(200), -- email, phone, device token, etc.
    
    -- Tracking
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Metadata
    provider VARCHAR(50), -- Email service, SMS provider, etc.
    provider_message_id VARCHAR(200),
    delivery_metadata JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Alert History Table (for tracking resolved/dismissed alerts)
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_alert_id UUID NOT NULL REFERENCES stock_alerts(id),
    
    -- Action details
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'created', 'acknowledged', 'resolved', 'dismissed', 'escalated'
    )),
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Context
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    notes TEXT,
    system_generated BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification Templates Table
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) UNIQUE NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    
    -- Template content
    subject_template VARCHAR(200),
    message_template TEXT NOT NULL,
    html_template TEXT,
    
    -- Template variables (for documentation)
    available_variables JSONB,
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    language VARCHAR(10) DEFAULT 'th',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Alert Thresholds Indexes
CREATE INDEX IF NOT EXISTS idx_alert_thresholds_branch_product ON alert_thresholds(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_alert_thresholds_branch_active ON alert_thresholds(branch_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_alert_thresholds_product ON alert_thresholds(product_id);
CREATE INDEX IF NOT EXISTS idx_alert_thresholds_category ON alert_thresholds(category_id);

-- Stock Alerts Indexes
CREATE INDEX IF NOT EXISTS idx_stock_alerts_status ON stock_alerts(status);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_type_severity ON stock_alerts(alert_type, severity);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_branch ON stock_alerts(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_triggered_at ON stock_alerts(triggered_at);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_active ON stock_alerts(status) WHERE status IN ('active', 'acknowledged');
CREATE INDEX IF NOT EXISTS idx_stock_alerts_number ON stock_alerts(alert_number);

-- Alert Subscriptions Indexes
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_user ON alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_active ON alert_subscriptions(user_id) WHERE is_active = true;

-- Notification Deliveries Indexes
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_alert ON notification_deliveries(stock_alert_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user ON notification_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_channel ON notification_deliveries(channel);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_pending ON notification_deliveries(status, created_at) WHERE status = 'pending';

-- Alert History Indexes
CREATE INDEX IF NOT EXISTS idx_alert_history_alert ON alert_history(stock_alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_performed_at ON alert_history(performed_at);
CREATE INDEX IF NOT EXISTS idx_alert_history_action ON alert_history(action);

-- Notification Templates Indexes
CREATE INDEX IF NOT EXISTS idx_notification_templates_type_channel ON notification_templates(alert_type, channel);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(is_active);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to generate alert number
CREATE OR REPLACE FUNCTION generate_alert_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    current_date TEXT;
    sequence_num INTEGER;
BEGIN
    current_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- Get next sequence number for today
    SELECT COALESCE(MAX(CAST(SUBSTRING(alert_number FROM 'ALT' || current_date || '-(.*)') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM stock_alerts
    WHERE alert_number LIKE 'ALT' || current_date || '-%';
    
    new_number := 'ALT' || current_date || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate suggested reorder quantity
CREATE OR REPLACE FUNCTION calculate_suggested_reorder_quantity(
    p_branch_id UUID,
    p_product_id UUID,
    p_current_stock DECIMAL,
    p_analysis_days INTEGER DEFAULT 30
)
RETURNS DECIMAL AS $$
DECLARE
    avg_daily_consumption DECIMAL := 0;
    max_stock_level DECIMAL := 0;
    safety_stock DECIMAL := 0;
    suggested_quantity DECIMAL := 0;
    threshold_record RECORD;
BEGIN
    -- Get threshold settings
    SELECT * INTO threshold_record
    FROM alert_thresholds
    WHERE branch_id = p_branch_id AND product_id = p_product_id AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Calculate average daily consumption from sales data
    SELECT COALESCE(AVG(daily_consumption), 0) INTO avg_daily_consumption
    FROM (
        SELECT 
            DATE(s.created_at) as sale_date,
            SUM(si.quantity) as daily_consumption
        FROM sales s
        JOIN sale_items si ON s.id = si.sale_id
        WHERE s.branch_id = p_branch_id 
        AND si.product_id = p_product_id
        AND s.created_at >= CURRENT_DATE - INTERVAL '1 day' * p_analysis_days
        GROUP BY DATE(s.created_at)
    ) daily_sales;
    
    -- Calculate safety stock
    safety_stock := avg_daily_consumption * 7 * COALESCE(threshold_record.safety_stock_multiplier, 1.2);
    
    -- Get maximum stock level
    max_stock_level := COALESCE(threshold_record.maximum_stock_level, threshold_record.reorder_point * 3);
    
    -- Calculate suggested quantity
    suggested_quantity := GREATEST(
        max_stock_level - p_current_stock,
        safety_stock - p_current_stock + (avg_daily_consumption * 14) -- 2 weeks supply
    );
    
    RETURN GREATEST(suggested_quantity, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update alert thresholds based on sales history
CREATE OR REPLACE FUNCTION auto_update_alert_thresholds()
RETURNS VOID AS $$
DECLARE
    threshold_record RECORD;
    avg_daily_consumption DECIMAL;
    suggested_reorder_point DECIMAL;
    suggested_minimum_stock DECIMAL;
BEGIN
    FOR threshold_record IN 
        SELECT * FROM alert_thresholds 
        WHERE use_auto_calculation = true AND is_active = true
    LOOP
        -- Calculate average daily consumption
        SELECT COALESCE(AVG(daily_consumption), 0) INTO avg_daily_consumption
        FROM (
            SELECT 
                DATE(s.created_at) as sale_date,
                SUM(si.quantity) as daily_consumption
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            WHERE s.branch_id = threshold_record.branch_id 
            AND si.product_id = threshold_record.product_id
            AND s.created_at >= CURRENT_DATE - INTERVAL '1 day' * threshold_record.auto_calculation_days
            GROUP BY DATE(s.created_at)
        ) daily_sales;
        
        -- Calculate new thresholds
        suggested_minimum_stock := avg_daily_consumption * 3; -- 3 days minimum
        suggested_reorder_point := avg_daily_consumption * 7 * threshold_record.safety_stock_multiplier; -- 1 week with safety
        
        -- Update thresholds if values are reasonable
        IF avg_daily_consumption > 0 THEN
            UPDATE alert_thresholds
            SET 
                minimum_stock_level = GREATEST(suggested_minimum_stock, threshold_record.minimum_stock_level * 0.5),
                reorder_point = GREATEST(suggested_reorder_point, threshold_record.reorder_point * 0.5),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = threshold_record.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_alert_thresholds_updated_at
    BEFORE UPDATE ON alert_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_alerts_updated_at
    BEFORE UPDATE ON stock_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_subscriptions_updated_at
    BEFORE UPDATE ON alert_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_deliveries_updated_at
    BEFORE UPDATE ON notification_deliveries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-generate alert number
CREATE OR REPLACE FUNCTION set_alert_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.alert_number IS NULL OR NEW.alert_number = '' THEN
        NEW.alert_number := generate_alert_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_stock_alert_number
    BEFORE INSERT ON stock_alerts
    FOR EACH ROW EXECUTE FUNCTION set_alert_number();

-- Trigger to create alert history entry
CREATE OR REPLACE FUNCTION create_alert_history_entry()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT operations
    IF TG_OP = 'INSERT' THEN
        INSERT INTO alert_history (
            stock_alert_id, action, performed_by, new_status, system_generated
        ) VALUES (
            NEW.id, 'created', NEW.acknowledged_by, NEW.status, true
        );
        RETURN NEW;
    END IF;
    
    -- For UPDATE operations (status changes)
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO alert_history (
            stock_alert_id, action, performed_by, previous_status, new_status, system_generated
        ) VALUES (
            NEW.id, 
            CASE 
                WHEN NEW.status = 'acknowledged' THEN 'acknowledged'
                WHEN NEW.status = 'resolved' THEN 'resolved'
                WHEN NEW.status = 'dismissed' THEN 'dismissed'
                ELSE 'updated'
            END,
            NEW.acknowledged_by, 
            OLD.status, 
            NEW.status, 
            false
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_stock_alert_history
    AFTER INSERT OR UPDATE ON stock_alerts
    FOR EACH ROW EXECUTE FUNCTION create_alert_history_entry();

-- =====================================================
-- VIEWS
-- =====================================================

-- Active Alerts View
CREATE OR REPLACE VIEW active_stock_alerts AS
SELECT 
    sa.*,
    b.name as branch_name,
    b.address as branch_address,
    p.name as product_name,
    p.sku as product_sku,
    c.name as category_name,
    ii.batch_number,
    ii.expiration_date,
    u_ack.username as acknowledged_by_username,
    u_res.username as resolved_by_username,
    (sa.triggered_at + INTERVAL '1 day' * 
        CASE sa.severity 
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 7
            ELSE 14
        END
    ) as escalation_due_date
FROM stock_alerts sa
JOIN branches b ON sa.branch_id = b.id
JOIN products p ON sa.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN inventory_items ii ON sa.inventory_item_id = ii.id
LEFT JOIN users u_ack ON sa.acknowledged_by = u_ack.id
LEFT JOIN users u_res ON sa.resolved_by = u_res.id
WHERE sa.status IN ('active', 'acknowledged');

-- Alert Summary View
CREATE OR REPLACE VIEW alert_summary AS
SELECT 
    sa.branch_id,
    b.name as branch_name,
    sa.alert_type,
    sa.severity,
    COUNT(*) as alert_count,
    MIN(sa.triggered_at) as oldest_alert,
    MAX(sa.triggered_at) as newest_alert,
    COUNT(*) FILTER (WHERE sa.status = 'active') as active_count,
    COUNT(*) FILTER (WHERE sa.status = 'acknowledged') as acknowledged_count
FROM stock_alerts sa
JOIN branches b ON sa.branch_id = b.id
WHERE sa.status IN ('active', 'acknowledged')
GROUP BY sa.branch_id, b.name, sa.alert_type, sa.severity;

-- User Notification Preferences View
CREATE OR REPLACE VIEW user_notification_preferences AS
SELECT 
    u.id as user_id,
    u.username,
    u.email,
    u.phone,
    asub.alert_types,
    asub.severity_levels,
    asub.branch_ids,
    asub.category_ids,
    asub.email_enabled,
    asub.in_app_enabled,
    asub.sms_enabled,
    asub.push_enabled,
    asub.digest_frequency,
    asub.quiet_hours_start,
    asub.quiet_hours_end,
    asub.timezone,
    asub.is_active as subscription_active
FROM users u
LEFT JOIN alert_subscriptions asub ON u.id = asub.user_id;

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default notification templates
INSERT INTO notification_templates (template_name, alert_type, channel, subject_template, message_template, available_variables) VALUES
('low_stock_email', 'low_stock', 'email', 
 'แจ้งเตือน: สต๊อคสินค้าใกล้หมด - {{product_name}} ที่ {{branch_name}}',
 'สวัสดีค่ะ {{user_name}},

สต๊อคสินค้า {{product_name}} ({{product_sku}}) ที่สาขา {{branch_name}} ใกล้หมดแล้ว

รายละเอียด:
- สต๊อคปัจจุบัน: {{current_stock}} {{unit}}
- จุดสั่งซื้อ: {{threshold_level}} {{unit}}
- แนะนำสั่งซื้อ: {{suggested_quantity}} {{unit}}

กรุณาตรวจสอบและดำเนินการสั่งซื้อตามความเหมาะสม

ขอบคุณค่ะ
ระบบจัดการสต๊อค',
 '{"user_name": "ชื่อผู้ใช้", "product_name": "ชื่อสินค้า", "product_sku": "รหัสสินค้า", "branch_name": "ชื่อสาขา", "current_stock": "สต๊อคปัจจุบัน", "threshold_level": "ระดับเตือน", "suggested_quantity": "จำนวนที่แนะนำ", "unit": "หน่วย"}'::jsonb),

('out_of_stock_email', 'out_of_stock', 'email',
 'ด่วน! สต๊อคหมด - {{product_name}} ที่ {{branch_name}}',
 'สวัสดีค่ะ {{user_name}},

สต๊อคสินค้า {{product_name}} ({{product_sku}}) ที่สาขา {{branch_name}} หมดแล้ว!

รายละเอียด:
- สต๊อคปัจจุบัน: {{current_stock}} {{unit}}
- แนะนำสั่งซื้อด่วน: {{suggested_quantity}} {{unit}}

กรุณาดำเนินการสั่งซื้อโดยด่วน

ขอบคุณค่ะ
ระบบจัดการสต๊อค',
 '{"user_name": "ชื่อผู้ใช้", "product_name": "ชื่อสินค้า", "product_sku": "รหัสสินค้า", "branch_name": "ชื่อสาขา", "current_stock": "สต๊อคปัจจุบัน", "suggested_quantity": "จำนวนที่แนะนำ", "unit": "หน่วย"}'::jsonb),

('low_stock_sms', 'low_stock', 'sms',
 NULL,
 'แจ้งเตือน: {{product_name}} ที่ {{branch_name}} เหลือ {{current_stock}} {{unit}} (ต่ำกว่าเกณฑ์ {{threshold_level}} {{unit}}) แนะนำสั่งซื้อ {{suggested_quantity}} {{unit}}',
 '{"product_name": "ชื่อสินค้า", "branch_name": "ชื่อสาขา", "current_stock": "สต๊อคปัจจุบัน", "threshold_level": "ระดับเตือน", "suggested_quantity": "จำนวนที่แนะนำ", "unit": "หน่วย"}'::jsonb),

('out_of_stock_sms', 'out_of_stock', 'sms',
 NULL,
 'ด่วน! {{product_name}} ที่ {{branch_name}} หมดสต๊อค! แนะนำสั่งซื้อ {{suggested_quantity}} {{unit}} โดยด่วน',
 '{"product_name": "ชื่อสินค้า", "branch_name": "ชื่อสาขา", "suggested_quantity": "จำนวนที่แนะนำ", "unit": "หน่วย"}'::jsonb)

ON CONFLICT (template_name) DO NOTHING;

-- Set default templates
UPDATE notification_templates 
SET is_default = true 
WHERE template_name IN ('low_stock_email', 'out_of_stock_email', 'low_stock_sms', 'out_of_stock_sms');

COMMIT;