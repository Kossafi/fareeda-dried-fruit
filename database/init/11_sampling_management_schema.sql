-- =====================================================
-- Sampling Management System Schema
-- =====================================================

-- Sampling Policies Table
CREATE TABLE IF NOT EXISTS sampling_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    
    -- Daily limits per branch/product
    daily_limit_gram DECIMAL(8,3) NOT NULL DEFAULT 100.0,
    max_per_session_gram DECIMAL(8,3) NOT NULL DEFAULT 10.0,
    
    -- Cost control
    cost_per_gram DECIMAL(10,4) NOT NULL DEFAULT 0,
    monthly_budget DECIMAL(12,2) DEFAULT NULL,
    
    -- Time restrictions
    allowed_hours_start TIME DEFAULT '09:00:00',
    allowed_hours_end TIME DEFAULT '21:00:00',
    weekend_enabled BOOLEAN DEFAULT true,
    
    -- Approval settings
    requires_approval_above_gram DECIMAL(8,3) DEFAULT 50.0,
    auto_approve_below_gram DECIMAL(8,3) DEFAULT 20.0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_until DATE DEFAULT NULL,
    
    -- Audit
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT sampling_policies_branch_product_unique UNIQUE(branch_id, product_id),
    CONSTRAINT sampling_policies_valid_hours CHECK (allowed_hours_start < allowed_hours_end),
    CONSTRAINT sampling_policies_valid_limits CHECK (
        daily_limit_gram > 0 AND 
        max_per_session_gram > 0 AND 
        max_per_session_gram <= daily_limit_gram
    )
);

-- Sampling Sessions Table
CREATE TABLE IF NOT EXISTS sampling_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Session info
    branch_id UUID NOT NULL REFERENCES branches(id),
    conducted_by UUID NOT NULL REFERENCES users(id),
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    session_time TIME NOT NULL DEFAULT CURRENT_TIME,
    
    -- Session details
    customer_count INTEGER DEFAULT 1,
    customer_feedback TEXT,
    weather_condition VARCHAR(50),
    foot_traffic_level VARCHAR(20) CHECK (foot_traffic_level IN ('low', 'medium', 'high')),
    
    -- Totals
    total_weight_gram DECIMAL(10,3) NOT NULL DEFAULT 0,
    total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_items INTEGER NOT NULL DEFAULT 0,
    
    -- Status
    status VARCHAR(20) NOT NULL CHECK (status IN (
        'active', 'completed', 'cancelled', 'pending_approval'
    )) DEFAULT 'active',
    
    -- Approval
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Sampling Records Table
CREATE TABLE IF NOT EXISTS sampling_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sampling_session_id UUID NOT NULL REFERENCES sampling_sessions(id) ON DELETE CASCADE,
    
    -- Product info
    product_id UUID NOT NULL REFERENCES products(id),
    inventory_item_id UUID REFERENCES inventory_items(id),
    batch_number VARCHAR(100),
    
    -- Weight and cost
    weight_gram DECIMAL(8,3) NOT NULL,
    unit_cost_per_gram DECIMAL(10,4) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    
    -- Quality info
    product_condition VARCHAR(20) CHECK (product_condition IN (
        'excellent', 'good', 'fair', 'poor'
    )) DEFAULT 'excellent',
    expiration_date DATE,
    
    -- Customer interaction
    customer_response VARCHAR(20) CHECK (customer_response IN (
        'very_positive', 'positive', 'neutral', 'negative', 'very_negative'
    )),
    resulted_in_purchase BOOLEAN DEFAULT false,
    purchase_amount DECIMAL(10,2),
    
    -- Notes
    notes TEXT,
    
    -- Audit
    recorded_by UUID NOT NULL REFERENCES users(id),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT sampling_records_valid_weight CHECK (weight_gram > 0),
    CONSTRAINT sampling_records_valid_cost CHECK (total_cost >= 0)
);

-- Sampling Approvals Table
CREATE TABLE IF NOT EXISTS sampling_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Request info
    branch_id UUID NOT NULL REFERENCES branches(id),
    product_id UUID NOT NULL REFERENCES products(id),
    requested_by UUID NOT NULL REFERENCES users(id),
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Approval details
    requested_weight_gram DECIMAL(8,3) NOT NULL,
    reason_for_excess TEXT NOT NULL,
    expected_customer_count INTEGER,
    special_occasion VARCHAR(200),
    
    -- Current usage context
    current_daily_usage_gram DECIMAL(8,3) NOT NULL DEFAULT 0,
    daily_limit_gram DECIMAL(8,3) NOT NULL,
    remaining_budget DECIMAL(12,2),
    
    -- Approval status
    status VARCHAR(20) NOT NULL CHECK (status IN (
        'pending', 'approved', 'rejected', 'expired'
    )) DEFAULT 'pending',
    
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    
    -- Usage tracking
    approved_weight_gram DECIMAL(8,3),
    used_weight_gram DECIMAL(8,3) DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Daily Sampling Summary View
CREATE TABLE IF NOT EXISTS daily_sampling_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Summary info
    branch_id UUID NOT NULL REFERENCES branches(id),
    product_id UUID REFERENCES products(id),
    summary_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Daily totals
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_weight_gram DECIMAL(10,3) NOT NULL DEFAULT 0,
    total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_customers INTEGER NOT NULL DEFAULT 0,
    
    -- Performance metrics
    conversion_rate DECIMAL(5,2) DEFAULT 0, -- percentage of samples that led to purchase
    average_purchase_amount DECIMAL(10,2) DEFAULT 0,
    cost_per_conversion DECIMAL(10,2) DEFAULT 0,
    
    -- Quality metrics
    average_customer_response DECIMAL(3,2) DEFAULT 3.0, -- 1-5 scale
    positive_response_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Policy compliance
    within_daily_limit BOOLEAN DEFAULT true,
    exceeded_by_gram DECIMAL(8,3) DEFAULT 0,
    approval_requests INTEGER DEFAULT 0,
    
    -- Audit
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(branch_id, product_id, summary_date)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Sampling Policies Indexes
CREATE INDEX IF NOT EXISTS idx_sampling_policies_branch ON sampling_policies(branch_id);
CREATE INDEX IF NOT EXISTS idx_sampling_policies_product ON sampling_policies(product_id);
CREATE INDEX IF NOT EXISTS idx_sampling_policies_category ON sampling_policies(category_id);
CREATE INDEX IF NOT EXISTS idx_sampling_policies_active ON sampling_policies(is_active);

-- Sampling Sessions Indexes
CREATE INDEX IF NOT EXISTS idx_sampling_sessions_branch_date ON sampling_sessions(branch_id, session_date);
CREATE INDEX IF NOT EXISTS idx_sampling_sessions_conducted_by ON sampling_sessions(conducted_by);
CREATE INDEX IF NOT EXISTS idx_sampling_sessions_status ON sampling_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sampling_sessions_number ON sampling_sessions(session_number);
CREATE INDEX IF NOT EXISTS idx_sampling_sessions_approval ON sampling_sessions(requires_approval, status);

-- Sampling Records Indexes
CREATE INDEX IF NOT EXISTS idx_sampling_records_session ON sampling_records(sampling_session_id);
CREATE INDEX IF NOT EXISTS idx_sampling_records_product ON sampling_records(product_id);
CREATE INDEX IF NOT EXISTS idx_sampling_records_inventory ON sampling_records(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_sampling_records_recorded_at ON sampling_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_sampling_records_purchase ON sampling_records(resulted_in_purchase);

-- Sampling Approvals Indexes
CREATE INDEX IF NOT EXISTS idx_sampling_approvals_branch_product ON sampling_approvals(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_sampling_approvals_status ON sampling_approvals(status);
CREATE INDEX IF NOT EXISTS idx_sampling_approvals_requested_by ON sampling_approvals(requested_by);
CREATE INDEX IF NOT EXISTS idx_sampling_approvals_expires_at ON sampling_approvals(expires_at);

-- Daily Summary Indexes
CREATE INDEX IF NOT EXISTS idx_daily_sampling_summary_branch_date ON daily_sampling_summary(branch_id, summary_date);
CREATE INDEX IF NOT EXISTS idx_daily_sampling_summary_product_date ON daily_sampling_summary(product_id, summary_date);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to generate sampling session number
CREATE OR REPLACE FUNCTION generate_sampling_session_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    current_date TEXT;
    sequence_num INTEGER;
BEGIN
    current_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- Get next sequence number for today
    SELECT COALESCE(MAX(CAST(SUBSTRING(session_number FROM 'SMP' || current_date || '-(.*)') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM sampling_sessions
    WHERE session_number LIKE 'SMP' || current_date || '-%';
    
    new_number := 'SMP' || current_date || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to check sampling limits
CREATE OR REPLACE FUNCTION check_sampling_limits(
    p_branch_id UUID,
    p_product_id UUID,
    p_weight_gram DECIMAL,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    policy_record RECORD;
    current_usage DECIMAL := 0;
    result JSON;
BEGIN
    -- Get sampling policy
    SELECT * INTO policy_record
    FROM sampling_policies
    WHERE branch_id = p_branch_id 
    AND (product_id = p_product_id OR product_id IS NULL)
    AND is_active = true
    ORDER BY product_id NULLS LAST
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'No sampling policy found',
            'daily_limit', 0,
            'current_usage', 0,
            'remaining', 0
        );
    END IF;
    
    -- Check if within allowed hours
    IF CURRENT_TIME < policy_record.allowed_hours_start OR 
       CURRENT_TIME > policy_record.allowed_hours_end THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'Outside allowed hours',
            'allowed_hours', policy_record.allowed_hours_start || ' - ' || policy_record.allowed_hours_end
        );
    END IF;
    
    -- Check weekend policy
    IF NOT policy_record.weekend_enabled AND EXTRACT(DOW FROM p_date) IN (0, 6) THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'Weekend sampling not allowed'
        );
    END IF;
    
    -- Get current daily usage
    SELECT COALESCE(SUM(sr.weight_gram), 0) INTO current_usage
    FROM sampling_records sr
    JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
    WHERE ss.branch_id = p_branch_id
    AND sr.product_id = p_product_id
    AND ss.session_date = p_date
    AND ss.status IN ('active', 'completed');
    
    -- Check daily limit
    IF (current_usage + p_weight_gram) > policy_record.daily_limit_gram THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'Exceeds daily limit',
            'daily_limit', policy_record.daily_limit_gram,
            'current_usage', current_usage,
            'remaining', policy_record.daily_limit_gram - current_usage,
            'requires_approval', (current_usage + p_weight_gram) <= (policy_record.daily_limit_gram + policy_record.requires_approval_above_gram)
        );
    END IF;
    
    -- Check session limit
    IF p_weight_gram > policy_record.max_per_session_gram THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'Exceeds per-session limit',
            'session_limit', policy_record.max_per_session_gram,
            'requires_approval', p_weight_gram <= policy_record.requires_approval_above_gram
        );
    END IF;
    
    -- All checks passed
    RETURN json_build_object(
        'allowed', true,
        'daily_limit', policy_record.daily_limit_gram,
        'current_usage', current_usage,
        'remaining', policy_record.daily_limit_gram - current_usage,
        'requires_approval', p_weight_gram > policy_record.auto_approve_below_gram
    );
END;
$$ LANGUAGE plpgsql;

-- Function to calculate sampling effectiveness
CREATE OR REPLACE FUNCTION calculate_sampling_effectiveness(
    p_branch_id UUID,
    p_product_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSON AS $$
DECLARE
    total_cost DECIMAL := 0;
    total_weight DECIMAL := 0;
    total_samples INTEGER := 0;
    total_conversions INTEGER := 0;
    total_revenue DECIMAL := 0;
    avg_response DECIMAL := 0;
    result JSON;
BEGIN
    SELECT 
        COALESCE(SUM(sr.total_cost), 0),
        COALESCE(SUM(sr.weight_gram), 0),
        COUNT(*),
        COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true),
        COALESCE(SUM(sr.purchase_amount), 0),
        COALESCE(AVG(
            CASE sr.customer_response
                WHEN 'very_positive' THEN 5
                WHEN 'positive' THEN 4
                WHEN 'neutral' THEN 3
                WHEN 'negative' THEN 2
                WHEN 'very_negative' THEN 1
                ELSE 3
            END
        ), 3)
    INTO total_cost, total_weight, total_samples, total_conversions, total_revenue, avg_response
    FROM sampling_records sr
    JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
    WHERE ss.branch_id = p_branch_id
    AND sr.product_id = p_product_id
    AND ss.session_date BETWEEN p_start_date AND p_end_date
    AND ss.status = 'completed';
    
    RETURN json_build_object(
        'total_cost', total_cost,
        'total_weight_gram', total_weight,
        'total_samples', total_samples,
        'total_conversions', total_conversions,
        'total_revenue', total_revenue,
        'conversion_rate', CASE WHEN total_samples > 0 THEN (total_conversions::DECIMAL / total_samples * 100) ELSE 0 END,
        'roi_percentage', CASE WHEN total_cost > 0 THEN ((total_revenue - total_cost) / total_cost * 100) ELSE 0 END,
        'cost_per_conversion', CASE WHEN total_conversions > 0 THEN (total_cost / total_conversions) ELSE 0 END,
        'average_customer_response', avg_response,
        'revenue_per_gram', CASE WHEN total_weight > 0 THEN (total_revenue / total_weight) ELSE 0 END
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update daily summary
CREATE OR REPLACE FUNCTION update_daily_sampling_summary(
    p_branch_id UUID,
    p_product_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
DECLARE
    summary_data RECORD;
BEGIN
    -- Calculate daily summary data
    SELECT 
        COUNT(DISTINCT ss.id) as session_count,
        COALESCE(SUM(sr.weight_gram), 0) as total_weight,
        COALESCE(SUM(sr.total_cost), 0) as total_cost,
        COALESCE(SUM(ss.customer_count), 0) as total_customers,
        COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true) as conversions,
        COALESCE(SUM(sr.purchase_amount), 0) as total_revenue,
        COALESCE(AVG(
            CASE sr.customer_response
                WHEN 'very_positive' THEN 5
                WHEN 'positive' THEN 4
                WHEN 'neutral' THEN 3
                WHEN 'negative' THEN 2
                WHEN 'very_negative' THEN 1
                ELSE 3
            END
        ), 3) as avg_response,
        COUNT(*) FILTER (WHERE sr.customer_response IN ('positive', 'very_positive')) as positive_responses,
        COUNT(*) as total_responses
    INTO summary_data
    FROM sampling_sessions ss
    LEFT JOIN sampling_records sr ON ss.id = sr.sampling_session_id
    WHERE ss.branch_id = p_branch_id
    AND (p_product_id IS NULL OR sr.product_id = p_product_id)
    AND ss.session_date = p_date
    AND ss.status = 'completed';
    
    -- Update or insert summary
    INSERT INTO daily_sampling_summary (
        branch_id, product_id, summary_date,
        total_sessions, total_weight_gram, total_cost, total_customers,
        conversion_rate, average_purchase_amount, cost_per_conversion,
        average_customer_response, positive_response_rate
    ) VALUES (
        p_branch_id, p_product_id, p_date,
        summary_data.session_count,
        summary_data.total_weight,
        summary_data.total_cost,
        summary_data.total_customers,
        CASE WHEN summary_data.total_responses > 0 
             THEN (summary_data.conversions::DECIMAL / summary_data.total_responses * 100) 
             ELSE 0 END,
        CASE WHEN summary_data.conversions > 0 
             THEN (summary_data.total_revenue / summary_data.conversions) 
             ELSE 0 END,
        CASE WHEN summary_data.conversions > 0 
             THEN (summary_data.total_cost / summary_data.conversions) 
             ELSE 0 END,
        summary_data.avg_response,
        CASE WHEN summary_data.total_responses > 0 
             THEN (summary_data.positive_responses::DECIMAL / summary_data.total_responses * 100) 
             ELSE 0 END
    )
    ON CONFLICT (branch_id, product_id, summary_date)
    DO UPDATE SET
        total_sessions = EXCLUDED.total_sessions,
        total_weight_gram = EXCLUDED.total_weight_gram,
        total_cost = EXCLUDED.total_cost,
        total_customers = EXCLUDED.total_customers,
        conversion_rate = EXCLUDED.conversion_rate,
        average_purchase_amount = EXCLUDED.average_purchase_amount,
        cost_per_conversion = EXCLUDED.cost_per_conversion,
        average_customer_response = EXCLUDED.average_customer_response,
        positive_response_rate = EXCLUDED.positive_response_rate,
        last_updated_at = CURRENT_TIMESTAMP;
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
CREATE TRIGGER update_sampling_policies_updated_at
    BEFORE UPDATE ON sampling_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sampling_sessions_updated_at
    BEFORE UPDATE ON sampling_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sampling_approvals_updated_at
    BEFORE UPDATE ON sampling_approvals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-generate session number
CREATE OR REPLACE FUNCTION set_sampling_session_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.session_number IS NULL OR NEW.session_number = '' THEN
        NEW.session_number := generate_sampling_session_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_sampling_session_number_trigger
    BEFORE INSERT ON sampling_sessions
    FOR EACH ROW EXECUTE FUNCTION set_sampling_session_number();

-- Trigger to update session totals when records are added
CREATE OR REPLACE FUNCTION update_session_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update session totals
    UPDATE sampling_sessions
    SET 
        total_weight_gram = (
            SELECT COALESCE(SUM(weight_gram), 0)
            FROM sampling_records
            WHERE sampling_session_id = COALESCE(NEW.sampling_session_id, OLD.sampling_session_id)
        ),
        total_cost = (
            SELECT COALESCE(SUM(total_cost), 0)
            FROM sampling_records
            WHERE sampling_session_id = COALESCE(NEW.sampling_session_id, OLD.sampling_session_id)
        ),
        total_items = (
            SELECT COUNT(*)
            FROM sampling_records
            WHERE sampling_session_id = COALESCE(NEW.sampling_session_id, OLD.sampling_session_id)
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.sampling_session_id, OLD.sampling_session_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_totals_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sampling_records
    FOR EACH ROW EXECUTE FUNCTION update_session_totals();

-- Trigger to deduct stock when sampling is recorded
CREATE OR REPLACE FUNCTION deduct_sampling_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Deduct from inventory
    UPDATE inventory_items
    SET 
        quantity_in_stock = quantity_in_stock - NEW.weight_gram,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.inventory_item_id
    AND quantity_in_stock >= NEW.weight_gram;
    
    -- Check if deduction was successful
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient stock for sampling. Required: % grams', NEW.weight_gram;
    END IF;
    
    -- Create stock movement record
    INSERT INTO stock_movements (
        inventory_item_id,
        movement_type,
        quantity,
        unit_cost,
        reference_type,
        reference_id,
        performed_by,
        notes
    ) VALUES (
        NEW.inventory_item_id,
        'sampling',
        -NEW.weight_gram,
        NEW.unit_cost_per_gram,
        'sampling_record',
        NEW.id,
        NEW.recorded_by,
        'Stock deducted for product sampling'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deduct_sampling_stock_trigger
    AFTER INSERT ON sampling_records
    FOR EACH ROW EXECUTE FUNCTION deduct_sampling_stock();

-- =====================================================
-- VIEWS
-- =====================================================

-- Active Sampling Sessions View
CREATE OR REPLACE VIEW active_sampling_sessions AS
SELECT 
    ss.*,
    b.name as branch_name,
    u.username as conducted_by_name,
    ap.username as approved_by_name
FROM sampling_sessions ss
JOIN branches b ON ss.branch_id = b.id
JOIN users u ON ss.conducted_by = u.id
LEFT JOIN users ap ON ss.approved_by = ap.id
WHERE ss.status IN ('active', 'pending_approval');

-- Sampling Usage Summary View
CREATE OR REPLACE VIEW sampling_usage_summary AS
SELECT 
    ss.branch_id,
    b.name as branch_name,
    sr.product_id,
    p.name as product_name,
    ss.session_date,
    COUNT(DISTINCT ss.id) as session_count,
    SUM(sr.weight_gram) as total_weight_gram,
    SUM(sr.total_cost) as total_cost,
    AVG(sr.weight_gram) as avg_weight_per_sample,
    COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true) as conversion_count,
    COUNT(*) as total_samples,
    ROUND(
        (COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true)::DECIMAL / COUNT(*) * 100), 2
    ) as conversion_rate_percent
FROM sampling_sessions ss
JOIN sampling_records sr ON ss.id = sr.sampling_session_id
JOIN branches b ON ss.branch_id = b.id
JOIN products p ON sr.product_id = p.id
WHERE ss.status = 'completed'
GROUP BY ss.branch_id, b.name, sr.product_id, p.name, ss.session_date;

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default sampling policies for each branch
INSERT INTO sampling_policies (
    branch_id, 
    daily_limit_gram, 
    max_per_session_gram, 
    cost_per_gram,
    requires_approval_above_gram,
    auto_approve_below_gram,
    created_by
)
SELECT 
    b.id,
    200.0, -- 200g daily limit
    15.0,  -- 15g per session
    0.50,  -- 0.50 baht per gram
    100.0, -- require approval above 100g
    30.0,  -- auto approve below 30g
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
FROM branches b
WHERE NOT EXISTS (
    SELECT 1 FROM sampling_policies sp 
    WHERE sp.branch_id = b.id AND sp.product_id IS NULL
)
ON CONFLICT (branch_id, product_id) DO NOTHING;

COMMIT;