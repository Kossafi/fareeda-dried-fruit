-- =====================================================
-- Reporting and Analytics System Schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Report types and formats
CREATE TYPE report_type AS ENUM (
    'sales_analytics',
    'inventory_movement',
    'branch_performance',
    'product_ranking',
    'sampling_roi',
    'procurement_analysis',
    'financial_summary',
    'operational_kpi'
);

CREATE TYPE export_format AS ENUM ('pdf', 'excel', 'csv', 'json');
CREATE TYPE schedule_frequency AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');
CREATE TYPE cache_status AS ENUM ('valid', 'expired', 'generating', 'failed');

-- Report cache for performance optimization
CREATE TABLE report_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    report_type report_type NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    data JSONB NOT NULL,
    data_hash VARCHAR(64) NOT NULL, -- SHA256 hash for data integrity
    status cache_status DEFAULT 'valid',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    generation_time_ms INTEGER DEFAULT 0,
    data_size_bytes INTEGER DEFAULT 0,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    INDEX(cache_key),
    INDEX(report_type),
    INDEX(status),
    INDEX(expires_at)
);

-- Scheduled reports
CREATE TABLE report_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_name VARCHAR(255) NOT NULL,
    report_type report_type NOT NULL,
    frequency schedule_frequency NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    export_format export_format DEFAULT 'pdf',
    is_active BOOLEAN DEFAULT true,
    recipients TEXT[], -- email addresses
    next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_run_status VARCHAR(50) DEFAULT 'pending',
    run_count INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Report execution history
CREATE TABLE report_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID REFERENCES report_schedules(id),
    report_type report_type NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    export_format export_format,
    execution_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    execution_end TIMESTAMP WITH TIME ZONE,
    execution_time_ms INTEGER,
    status VARCHAR(50) DEFAULT 'running',
    file_path TEXT,
    file_size_bytes INTEGER,
    error_message TEXT,
    triggered_by UUID REFERENCES users(id),
    data_rows_count INTEGER DEFAULT 0
);

-- Analytics materialized views for performance

-- Daily sales summary
CREATE MATERIALIZED VIEW daily_sales_summary AS
SELECT 
    DATE(s.transaction_date) as sale_date,
    s.branch_id,
    b.name as branch_name,
    s.product_id,
    p.name as product_name,
    p.category_id,
    pc.name as category_name,
    COUNT(s.id) as transaction_count,
    SUM(s.quantity) as total_quantity,
    SUM(s.total_amount) as total_revenue,
    AVG(s.total_amount) as avg_transaction_value,
    SUM(s.cost_of_goods) as total_cogs,
    SUM(s.total_amount - s.cost_of_goods) as gross_profit,
    (SUM(s.total_amount - s.cost_of_goods) / NULLIF(SUM(s.total_amount), 0) * 100) as gross_margin_percentage
FROM sales s
JOIN branches b ON s.branch_id = b.id
JOIN products p ON s.product_id = p.id
LEFT JOIN product_categories pc ON p.category_id = pc.id
WHERE s.status = 'completed'
GROUP BY DATE(s.transaction_date), s.branch_id, b.name, s.product_id, p.name, p.category_id, pc.name;

-- Monthly inventory movement summary
CREATE MATERIALIZED VIEW monthly_inventory_movement AS
SELECT 
    DATE_TRUNC('month', sm.movement_date) as movement_month,
    sm.branch_id,
    b.name as branch_name,
    sm.product_id,
    p.name as product_name,
    sm.movement_type,
    COUNT(*) as movement_count,
    SUM(sm.quantity) as total_quantity,
    SUM(sm.quantity * sm.unit_cost) as total_value,
    AVG(sm.unit_cost) as avg_unit_cost
FROM stock_movements sm
JOIN inventory_items ii ON sm.inventory_item_id = ii.id
JOIN branches b ON ii.branch_id = b.id
JOIN products p ON ii.product_id = p.id
GROUP BY DATE_TRUNC('month', sm.movement_date), sm.branch_id, b.name, sm.product_id, p.name, sm.movement_type;

-- Branch performance summary
CREATE MATERIALIZED VIEW branch_performance_summary AS
SELECT 
    b.id as branch_id,
    b.name as branch_name,
    b.location,
    -- Sales metrics
    COUNT(DISTINCT s.id) as total_transactions,
    SUM(s.total_amount) as total_revenue,
    AVG(s.total_amount) as avg_transaction_value,
    SUM(s.cost_of_goods) as total_cogs,
    SUM(s.total_amount - s.cost_of_goods) as gross_profit,
    -- Inventory metrics
    COUNT(DISTINCT ii.id) as total_inventory_items,
    SUM(ii.quantity_in_stock * ii.unit_cost) as inventory_value,
    -- Sampling metrics
    COALESCE(sampling_stats.total_sampling_cost, 0) as total_sampling_cost,
    COALESCE(sampling_stats.sampling_conversion_rate, 0) as sampling_conversion_rate,
    COALESCE(sampling_stats.sampling_roi, 0) as sampling_roi,
    -- Procurement metrics
    COALESCE(procurement_stats.total_purchase_orders, 0) as total_purchase_orders,
    COALESCE(procurement_stats.total_procurement_value, 0) as total_procurement_value,
    -- Performance indicators
    (SUM(s.total_amount - s.cost_of_goods) / NULLIF(SUM(s.total_amount), 0) * 100) as gross_margin_percentage,
    (SUM(ii.quantity_in_stock * ii.unit_cost) / NULLIF(SUM(s.total_amount), 0)) as inventory_turnover_ratio
FROM branches b
LEFT JOIN sales s ON b.id = s.branch_id AND s.status = 'completed'
LEFT JOIN inventory_items ii ON b.id = ii.branch_id AND ii.is_active = true
LEFT JOIN (
    SELECT 
        ss.branch_id,
        SUM(sr.total_cost) as total_sampling_cost,
        (COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true)::DECIMAL / 
         NULLIF(COUNT(*), 0) * 100) as sampling_conversion_rate,
        ((SUM(sr.purchase_amount) - SUM(sr.total_cost)) / NULLIF(SUM(sr.total_cost), 0) * 100) as sampling_roi
    FROM sampling_sessions ss
    JOIN sampling_records sr ON ss.id = sr.sampling_session_id
    WHERE ss.status = 'completed'
    GROUP BY ss.branch_id
) sampling_stats ON b.id = sampling_stats.branch_id
LEFT JOIN (
    SELECT 
        po.branch_id,
        COUNT(*) as total_purchase_orders,
        SUM(po.total_amount) as total_procurement_value
    FROM purchase_orders po
    WHERE po.status = 'completed'
    GROUP BY po.branch_id
) procurement_stats ON b.id = procurement_stats.branch_id
GROUP BY b.id, b.name, b.location, sampling_stats.total_sampling_cost, 
         sampling_stats.sampling_conversion_rate, sampling_stats.sampling_roi,
         procurement_stats.total_purchase_orders, procurement_stats.total_procurement_value;

-- Product ranking summary
CREATE MATERIALIZED VIEW product_ranking_summary AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.sku,
    p.category_id,
    pc.name as category_name,
    -- Sales metrics
    COUNT(DISTINCT s.id) as total_transactions,
    SUM(s.quantity) as total_quantity_sold,
    SUM(s.total_amount) as total_revenue,
    AVG(s.unit_price) as avg_selling_price,
    SUM(s.cost_of_goods) as total_cogs,
    (SUM(s.total_amount - s.cost_of_goods) / NULLIF(SUM(s.total_amount), 0) * 100) as gross_margin_percentage,
    -- Inventory metrics
    COUNT(DISTINCT ii.branch_id) as available_in_branches,
    SUM(ii.quantity_in_stock) as total_current_stock,
    AVG(ii.unit_cost) as avg_inventory_cost,
    -- Sampling metrics
    COALESCE(sampling_metrics.total_samples, 0) as total_samples_given,
    COALESCE(sampling_metrics.conversion_rate, 0) as sampling_conversion_rate,
    -- Ranking
    RANK() OVER (ORDER BY SUM(s.total_amount) DESC) as revenue_rank,
    RANK() OVER (ORDER BY SUM(s.quantity) DESC) as quantity_rank,
    RANK() OVER (ORDER BY (SUM(s.total_amount - s.cost_of_goods) / NULLIF(SUM(s.total_amount), 0)) DESC) as margin_rank
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id
LEFT JOIN sales s ON p.id = s.product_id AND s.status = 'completed'
LEFT JOIN inventory_items ii ON p.id = ii.product_id AND ii.is_active = true
LEFT JOIN (
    SELECT 
        sr.product_id,
        COUNT(*) as total_samples,
        (COUNT(*) FILTER (WHERE sr.resulted_in_purchase = true)::DECIMAL / 
         NULLIF(COUNT(*), 0) * 100) as conversion_rate
    FROM sampling_records sr
    JOIN sampling_sessions ss ON sr.sampling_session_id = ss.id
    WHERE ss.status = 'completed'
    GROUP BY sr.product_id
) sampling_metrics ON p.id = sampling_metrics.product_id
GROUP BY p.id, p.name, p.sku, p.category_id, pc.name, 
         sampling_metrics.total_samples, sampling_metrics.conversion_rate;

-- Indexes for performance
CREATE INDEX idx_report_cache_key ON report_cache(cache_key);
CREATE INDEX idx_report_cache_type_status ON report_cache(report_type, status);
CREATE INDEX idx_report_cache_expires ON report_cache(expires_at);

CREATE INDEX idx_report_schedules_active ON report_schedules(is_active, next_run_at);
CREATE INDEX idx_report_schedules_type ON report_schedules(report_type);

CREATE INDEX idx_report_executions_schedule ON report_executions(schedule_id);
CREATE INDEX idx_report_executions_status ON report_executions(status);

CREATE INDEX idx_daily_sales_date ON daily_sales_summary(sale_date);
CREATE INDEX idx_daily_sales_branch ON daily_sales_summary(branch_id);
CREATE INDEX idx_daily_sales_product ON daily_sales_summary(product_id);

CREATE INDEX idx_monthly_inventory_month ON monthly_inventory_movement(movement_month);
CREATE INDEX idx_monthly_inventory_branch ON monthly_inventory_movement(branch_id);

-- Functions for analytics

-- Function to generate cache key
CREATE OR REPLACE FUNCTION generate_cache_key(
    report_type_param report_type,
    parameters_param JSONB
)
RETURNS VARCHAR(255) AS $$
DECLARE
    params_text TEXT;
    cache_key TEXT;
BEGIN
    -- Sort parameters to ensure consistent key generation
    SELECT string_agg(key || ':' || value, '|' ORDER BY key)
    INTO params_text
    FROM jsonb_each_text(parameters_param);
    
    cache_key := report_type_param::TEXT || '_' || 
                 encode(digest(COALESCE(params_text, ''), 'sha256'), 'hex');
    
    RETURN substring(cache_key from 1 for 255);
END;
$$ LANGUAGE plpgsql;

-- Function to invalidate cache
CREATE OR REPLACE FUNCTION invalidate_report_cache(
    cache_pattern TEXT DEFAULT '%'
)
RETURNS INTEGER AS $$
DECLARE
    invalidated_count INTEGER;
BEGIN
    UPDATE report_cache 
    SET status = 'expired'
    WHERE cache_key LIKE cache_pattern 
    AND status = 'valid';
    
    GET DIAGNOSTICS invalidated_count = ROW_COUNT;
    
    RETURN invalidated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired cache
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM report_cache 
    WHERE expires_at < CURRENT_TIMESTAMP 
    OR status = 'failed';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_inventory_movement;
    REFRESH MATERIALIZED VIEW CONCURRENTLY branch_performance_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY product_ranking_summary;
    
    -- Invalidate related cache
    PERFORM invalidate_report_cache('%sales%');
    PERFORM invalidate_report_cache('%inventory%');
    PERFORM invalidate_report_cache('%branch%');
    PERFORM invalidate_report_cache('%product%');
END;
$$ LANGUAGE plpgsql;

-- Function to calculate next run time for schedules
CREATE OR REPLACE FUNCTION calculate_next_run(
    frequency_param schedule_frequency,
    from_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    CASE frequency_param
        WHEN 'daily' THEN
            RETURN from_time + INTERVAL '1 day';
        WHEN 'weekly' THEN
            RETURN from_time + INTERVAL '1 week';
        WHEN 'monthly' THEN
            RETURN from_time + INTERVAL '1 month';
        WHEN 'quarterly' THEN
            RETURN from_time + INTERVAL '3 months';
        WHEN 'yearly' THEN
            RETURN from_time + INTERVAL '1 year';
        ELSE
            RETURN from_time + INTERVAL '1 day';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to get sales trends
CREATE OR REPLACE FUNCTION get_sales_trends(
    branch_id_param UUID DEFAULT NULL,
    product_id_param UUID DEFAULT NULL,
    date_from DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    date_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    trend_date DATE,
    total_revenue DECIMAL(15,2),
    total_quantity DECIMAL(10,2),
    transaction_count BIGINT,
    avg_transaction_value DECIMAL(15,2),
    gross_profit DECIMAL(15,2),
    gross_margin_percentage DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dss.sale_date,
        SUM(dss.total_revenue),
        SUM(dss.total_quantity),
        SUM(dss.transaction_count),
        AVG(dss.avg_transaction_value),
        SUM(dss.gross_profit),
        (SUM(dss.gross_profit) / NULLIF(SUM(dss.total_revenue), 0) * 100)::DECIMAL(5,2)
    FROM daily_sales_summary dss
    WHERE dss.sale_date BETWEEN date_from AND date_to
    AND (branch_id_param IS NULL OR dss.branch_id = branch_id_param)
    AND (product_id_param IS NULL OR dss.product_id = product_id_param)
    GROUP BY dss.sale_date
    ORDER BY dss.sale_date;
END;
$$ LANGUAGE plpgsql;

-- Triggers to invalidate cache on data changes

-- Invalidate sales cache when sales data changes
CREATE OR REPLACE FUNCTION invalidate_sales_cache()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM invalidate_report_cache('%sales%');
    PERFORM invalidate_report_cache('%branch%');
    PERFORM invalidate_report_cache('%product%');
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invalidate_sales_cache
    AFTER INSERT OR UPDATE OR DELETE ON sales
    FOR EACH STATEMENT
    EXECUTE FUNCTION invalidate_sales_cache();

-- Invalidate inventory cache when inventory changes
CREATE OR REPLACE FUNCTION invalidate_inventory_cache()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM invalidate_report_cache('%inventory%');
    PERFORM invalidate_report_cache('%branch%');
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invalidate_inventory_cache
    AFTER INSERT OR UPDATE OR DELETE ON inventory_items
    FOR EACH STATEMENT
    EXECUTE FUNCTION invalidate_inventory_cache();

CREATE TRIGGER trigger_invalidate_stock_movement_cache
    AFTER INSERT OR UPDATE OR DELETE ON stock_movements
    FOR EACH STATEMENT
    EXECUTE FUNCTION invalidate_inventory_cache();

-- Invalidate sampling cache when sampling data changes
CREATE OR REPLACE FUNCTION invalidate_sampling_cache()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM invalidate_report_cache('%sampling%');
    PERFORM invalidate_report_cache('%branch%');
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invalidate_sampling_cache
    AFTER INSERT OR UPDATE OR DELETE ON sampling_records
    FOR EACH STATEMENT
    EXECUTE FUNCTION invalidate_sampling_cache();

-- Invalidate procurement cache when procurement data changes
CREATE OR REPLACE FUNCTION invalidate_procurement_cache()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM invalidate_report_cache('%procurement%');
    PERFORM invalidate_report_cache('%supplier%');
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invalidate_procurement_cache
    AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
    FOR EACH STATEMENT
    EXECUTE FUNCTION invalidate_procurement_cache();

-- Auto-update cache access statistics
CREATE OR REPLACE FUNCTION update_cache_access()
RETURNS TRIGGER AS $$
BEGIN
    NEW.access_count := OLD.access_count + 1;
    NEW.last_accessed_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cache_access
    BEFORE UPDATE ON report_cache
    FOR EACH ROW
    WHEN (OLD.access_count IS NOT NULL)
    EXECUTE FUNCTION update_cache_access();

-- Create unique indexes for materialized views
CREATE UNIQUE INDEX idx_daily_sales_summary_unique 
ON daily_sales_summary(sale_date, branch_id, product_id);

CREATE UNIQUE INDEX idx_monthly_inventory_movement_unique 
ON monthly_inventory_movement(movement_month, branch_id, product_id, movement_type);

CREATE UNIQUE INDEX idx_branch_performance_summary_unique 
ON branch_performance_summary(branch_id);

CREATE UNIQUE INDEX idx_product_ranking_summary_unique 
ON product_ranking_summary(product_id);

-- Initial data and schedules
INSERT INTO report_schedules (schedule_name, report_type, frequency, parameters, recipients, next_run_at, created_by) VALUES
('Daily Sales Report', 'sales_analytics', 'daily', '{"period": "yesterday"}', ARRAY['management@driedfruits.com'], CURRENT_TIMESTAMP + INTERVAL '1 day', 
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)),
('Weekly Branch Performance', 'branch_performance', 'weekly', '{"period": "last_week"}', ARRAY['operations@driedfruits.com'], CURRENT_TIMESTAMP + INTERVAL '1 week',
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)),
('Monthly Procurement Analysis', 'procurement_analysis', 'monthly', '{"period": "last_month"}', ARRAY['procurement@driedfruits.com'], CURRENT_TIMESTAMP + INTERVAL '1 month',
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1));

COMMENT ON TABLE report_cache IS 'Cache for expensive report queries with TTL and access tracking';
COMMENT ON TABLE report_schedules IS 'Automated report generation schedules';
COMMENT ON TABLE report_executions IS 'History and status of report generation executions';
COMMENT ON MATERIALIZED VIEW daily_sales_summary IS 'Pre-aggregated daily sales data for fast reporting';
COMMENT ON MATERIALIZED VIEW branch_performance_summary IS 'Comprehensive branch performance metrics';
COMMENT ON MATERIALIZED VIEW product_ranking_summary IS 'Product performance rankings and metrics';