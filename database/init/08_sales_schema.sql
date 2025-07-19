-- Sales recording and tracking schema
-- This schema handles sales transactions, payments, and customer management

-- Create schemas
CREATE SCHEMA IF NOT EXISTS sales;

-- Create enums
CREATE TYPE sale_status AS ENUM (
  'pending',
  'completed',
  'voided',
  'refunded'
);

CREATE TYPE payment_method AS ENUM (
  'cash',
  'credit_card',
  'debit_card',
  'mobile_payment',
  'bank_transfer',
  'store_credit',
  'gift_card',
  'multiple'
);

CREATE TYPE sale_type AS ENUM (
  'walk_in',
  'online',
  'phone_order',
  'mall_kiosk',
  'wholesale',
  'employee'
);

CREATE TYPE discount_type AS ENUM (
  'percentage',
  'fixed_amount',
  'buy_x_get_y',
  'bulk_discount',
  'member_discount',
  'employee_discount'
);

-- Customers table
CREATE TABLE sales.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(200) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  email VARCHAR(255),
  phone_number VARCHAR(20),
  date_of_birth DATE,
  
  -- Address
  street_address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Thailand',
  
  -- Membership
  membership_level VARCHAR(50),
  membership_number VARCHAR(50) UNIQUE,
  member_since DATE,
  points_balance INTEGER NOT NULL DEFAULT 0,
  
  -- Purchase history
  total_purchases INTEGER NOT NULL DEFAULT 0,
  total_spent DECIMAL(12, 2) NOT NULL DEFAULT 0,
  average_order_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
  last_purchase_date TIMESTAMP WITH TIME ZONE,
  
  -- Preferences
  preferred_branch_id UUID REFERENCES public.branches(id),
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL),
  CONSTRAINT valid_phone CHECK (LENGTH(phone_number) >= 10 OR phone_number IS NULL),
  CONSTRAINT valid_points CHECK (points_balance >= 0),
  CONSTRAINT valid_totals CHECK (total_purchases >= 0 AND total_spent >= 0)
);

-- Sales table (main sales transactions)
CREATE TABLE sales.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number VARCHAR(50) NOT NULL UNIQUE,
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  customer_id UUID REFERENCES sales.customers(id),
  customer_name VARCHAR(200),
  customer_phone VARCHAR(20),
  customer_email VARCHAR(255),
  sale_type sale_type NOT NULL DEFAULT 'walk_in',
  status sale_status NOT NULL DEFAULT 'pending',
  
  -- Totals
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  change_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- Staff and location
  sold_by UUID NOT NULL REFERENCES auth.users(id),
  cashier_id UUID REFERENCES auth.users(id),
  mall_location VARCHAR(200),
  pos_terminal_id VARCHAR(100),
  
  -- Timestamps
  sale_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  voided_at TIMESTAMP WITH TIME ZONE,
  voided_by UUID REFERENCES auth.users(id),
  void_reason TEXT,
  
  -- Additional info
  notes TEXT,
  receipt_printed BOOLEAN NOT NULL DEFAULT false,
  email_receipt_sent BOOLEAN NOT NULL DEFAULT false,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_amounts CHECK (
    subtotal >= 0 AND 
    discount_amount >= 0 AND 
    tax_amount >= 0 AND 
    total_amount >= 0 AND 
    paid_amount >= 0 AND 
    change_amount >= 0
  ),
  CONSTRAINT valid_payment CHECK (
    (status = 'completed' AND paid_amount >= total_amount) OR 
    status != 'completed'
  ),
  CONSTRAINT valid_void CHECK (
    (status = 'voided' AND voided_at IS NOT NULL AND voided_by IS NOT NULL) OR 
    status != 'voided'
  )
);

-- Sale items table
CREATE TABLE sales.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales.sales(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory.inventory_items(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name VARCHAR(200) NOT NULL,
  product_sku VARCHAR(100),
  
  -- Quantity and pricing
  quantity DECIMAL(10, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  list_price DECIMAL(10, 2) NOT NULL,
  
  -- Discounts
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12, 2) NOT NULL,
  
  -- Product details
  batch_number VARCHAR(50),
  expiration_date DATE,
  barcode_scanned BOOLEAN NOT NULL DEFAULT false,
  
  -- Weight information (for products sold by weight)
  actual_weight DECIMAL(10, 3),
  tare_weight DECIMAL(10, 3),
  net_weight DECIMAL(10, 3),
  
  -- Cost tracking
  unit_cost DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(12, 2) NOT NULL,
  gross_margin DECIMAL(12, 2) GENERATED ALWAYS AS (line_total - total_cost) STORED,
  
  -- Status
  voided BOOLEAN NOT NULL DEFAULT false,
  voided_at TIMESTAMP WITH TIME ZONE,
  void_reason TEXT,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_prices CHECK (unit_price >= 0 AND list_price >= 0 AND unit_cost >= 0),
  CONSTRAINT valid_discounts CHECK (discount_amount >= 0 AND discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT valid_weights CHECK (
    (actual_weight IS NULL AND tare_weight IS NULL AND net_weight IS NULL) OR
    (actual_weight >= 0 AND tare_weight >= 0 AND net_weight >= 0)
  ),
  CONSTRAINT valid_void_item CHECK (
    (voided = true AND voided_at IS NOT NULL) OR 
    voided = false
  )
);

-- Sale payments table
CREATE TABLE sales.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales.sales(id) ON DELETE CASCADE,
  payment_method payment_method NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'THB',
  
  -- Payment details
  reference_number VARCHAR(100),
  card_last_4 VARCHAR(4),
  card_type VARCHAR(50),
  authorization_code VARCHAR(100),
  
  -- Processing info
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processor_response TEXT,
  is_refunded BOOLEAN NOT NULL DEFAULT false,
  refunded_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  refunded_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_payment_amount CHECK (amount > 0),
  CONSTRAINT valid_refund CHECK (refunded_amount >= 0 AND refunded_amount <= amount),
  CONSTRAINT valid_refund_status CHECK (
    (is_refunded = true AND refunded_at IS NOT NULL) OR 
    is_refunded = false
  )
);

-- Sale discounts table
CREATE TABLE sales.sale_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales.sales(id) ON DELETE CASCADE,
  discount_type discount_type NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Discount calculation
  discount_value DECIMAL(10, 2) NOT NULL, -- Percentage or fixed amount
  discount_amount DECIMAL(12, 2) NOT NULL, -- Calculated discount amount
  
  -- Conditions
  minimum_quantity INTEGER,
  minimum_amount DECIMAL(12, 2),
  applicable_product_ids UUID[],
  
  -- Validity
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_to TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Usage tracking
  times_used INTEGER NOT NULL DEFAULT 1,
  max_usage INTEGER,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_discount_value CHECK (discount_value >= 0),
  CONSTRAINT valid_discount_amount CHECK (discount_amount >= 0),
  CONSTRAINT valid_usage CHECK (times_used >= 0 AND (max_usage IS NULL OR times_used <= max_usage))
);

-- Daily sales summary table (for reporting optimization)
CREATE TABLE sales.daily_sales_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  sale_date DATE NOT NULL,
  
  -- Sales metrics
  total_sales INTEGER NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_tax DECIMAL(12, 2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- Transaction metrics
  transaction_count INTEGER NOT NULL DEFAULT 0,
  average_transaction_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
  largest_transaction DECIMAL(12, 2) NOT NULL DEFAULT 0,
  smallest_transaction DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- Customer metrics
  unique_customers INTEGER NOT NULL DEFAULT 0,
  new_customers INTEGER NOT NULL DEFAULT 0,
  returning_customers INTEGER NOT NULL DEFAULT 0,
  
  -- Payment method breakdown (stored as JSONB)
  payment_breakdown JSONB NOT NULL DEFAULT '{}',
  
  -- Product performance (top 10 products)
  top_products JSONB NOT NULL DEFAULT '[]',
  
  -- Hourly breakdown
  hourly_sales JSONB NOT NULL DEFAULT '[]',
  
  -- Last updated
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(branch_id, sale_date),
  CONSTRAINT valid_summary_amounts CHECK (
    total_amount >= 0 AND 
    total_discount >= 0 AND 
    total_tax >= 0 AND 
    net_amount >= 0
  )
);

-- Real-time sales cache table (for WebSocket updates)
CREATE TABLE sales.realtime_sales_cache (
  branch_id UUID PRIMARY KEY REFERENCES public.branches(id),
  
  -- Today's metrics
  today_sales INTEGER NOT NULL DEFAULT 0,
  today_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  today_transactions INTEGER NOT NULL DEFAULT 0,
  
  -- Comparisons
  yesterday_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  last_week_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  month_to_date_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- Current metrics
  average_transaction_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
  transactions_per_hour DECIMAL(10, 2) NOT NULL DEFAULT 0,
  
  -- Recent activity (last 10 sales)
  recent_sales JSONB NOT NULL DEFAULT '[]',
  
  -- Alerts
  low_stock_alerts JSONB NOT NULL DEFAULT '[]',
  
  -- Last updated
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_live BOOLEAN NOT NULL DEFAULT true
);

-- Indexes for better performance
CREATE INDEX idx_sales_branch_id ON sales.sales(branch_id);
CREATE INDEX idx_sales_customer_id ON sales.sales(customer_id);
CREATE INDEX idx_sales_sale_date ON sales.sales(sale_date);
CREATE INDEX idx_sales_status ON sales.sales(status);
CREATE INDEX idx_sales_sold_by ON sales.sales(sold_by);
CREATE INDEX idx_sales_sale_number ON sales.sales(sale_number);
CREATE INDEX idx_sales_created_at ON sales.sales(created_at);

CREATE INDEX idx_sale_items_sale_id ON sales.sale_items(sale_id);
CREATE INDEX idx_sale_items_inventory_item_id ON sales.sale_items(inventory_item_id);
CREATE INDEX idx_sale_items_product_id ON sales.sale_items(product_id);
CREATE INDEX idx_sale_items_voided ON sales.sale_items(voided);

CREATE INDEX idx_sale_payments_sale_id ON sales.sale_payments(sale_id);
CREATE INDEX idx_sale_payments_method ON sales.sale_payments(payment_method);
CREATE INDEX idx_sale_payments_processed_at ON sales.sale_payments(processed_at);

CREATE INDEX idx_sale_discounts_sale_id ON sales.sale_discounts(sale_id);
CREATE INDEX idx_sale_discounts_type ON sales.sale_discounts(discount_type);

CREATE INDEX idx_customers_customer_code ON sales.customers(customer_code);
CREATE INDEX idx_customers_email ON sales.customers(email);
CREATE INDEX idx_customers_phone ON sales.customers(phone_number);
CREATE INDEX idx_customers_membership_number ON sales.customers(membership_number);
CREATE INDEX idx_customers_preferred_branch ON sales.customers(preferred_branch_id);

CREATE INDEX idx_daily_summary_branch_date ON sales.daily_sales_summary(branch_id, sale_date);
CREATE INDEX idx_daily_summary_date ON sales.daily_sales_summary(sale_date);

-- GIN indexes for JSONB columns
CREATE INDEX idx_daily_summary_payment_breakdown_gin ON sales.daily_sales_summary USING GIN (payment_breakdown);
CREATE INDEX idx_daily_summary_top_products_gin ON sales.daily_sales_summary USING GIN (top_products);
CREATE INDEX idx_realtime_cache_recent_sales_gin ON sales.realtime_sales_cache USING GIN (recent_sales);

-- Functions and triggers

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER trigger_update_sales_updated_at
  BEFORE UPDATE ON sales.sales
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_updated_at();

CREATE TRIGGER trigger_update_customers_updated_at
  BEFORE UPDATE ON sales.customers
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_updated_at();

CREATE TRIGGER trigger_update_sale_items_updated_at
  BEFORE UPDATE ON sales.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_updated_at();

CREATE TRIGGER trigger_update_sale_payments_updated_at
  BEFORE UPDATE ON sales.sale_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_updated_at();

-- Function to generate sale number
CREATE OR REPLACE FUNCTION generate_sale_number(branch_prefix TEXT DEFAULT 'SAL')
RETURNS TEXT AS $$
DECLARE
  date_part TEXT := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  sequence_part TEXT;
  sale_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT LPAD((COUNT(*) + 1)::TEXT, 4, '0')
  INTO sequence_part
  FROM sales.sales
  WHERE DATE(created_at) = CURRENT_DATE;
  
  sale_number := branch_prefix || '-' || date_part || '-' || sequence_part;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM sales.sales WHERE sale_number = sale_number) LOOP
    sequence_part := LPAD((sequence_part::INTEGER + 1)::TEXT, 4, '0');
    sale_number := branch_prefix || '-' || date_part || '-' || sequence_part;
  END LOOP;
  
  RETURN sale_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update sale totals
CREATE OR REPLACE FUNCTION update_sale_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sales.sales 
  SET 
    subtotal = (
      SELECT COALESCE(SUM(line_total), 0)
      FROM sales.sale_items 
      WHERE sale_id = COALESCE(NEW.sale_id, OLD.sale_id)
        AND voided = false
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.sale_id, OLD.sale_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update sale totals when items change
CREATE TRIGGER trigger_update_sale_totals
  AFTER INSERT OR UPDATE OR DELETE ON sales.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_totals();

-- Function to update customer statistics
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    UPDATE sales.customers 
    SET 
      total_purchases = total_purchases + 1,
      total_spent = total_spent + NEW.total_amount,
      average_order_value = (total_spent + NEW.total_amount) / (total_purchases + 1),
      last_purchase_date = NEW.sale_date,
      updated_at = NOW()
    WHERE id = NEW.customer_id;
  ELSIF OLD.status = 'completed' AND NEW.status != 'completed' THEN
    -- Handle reversal (void/refund)
    UPDATE sales.customers 
    SET 
      total_purchases = GREATEST(0, total_purchases - 1),
      total_spent = GREATEST(0, total_spent - OLD.total_amount),
      average_order_value = CASE 
        WHEN total_purchases <= 1 THEN 0
        ELSE (total_spent - OLD.total_amount) / (total_purchases - 1)
      END,
      updated_at = NOW()
    WHERE id = OLD.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update customer statistics
CREATE TRIGGER trigger_update_customer_stats
  AFTER UPDATE ON sales.sales
  FOR EACH ROW
  WHEN (NEW.customer_id IS NOT NULL)
  EXECUTE FUNCTION update_customer_stats();

-- Views for common queries

-- Sales with customer and branch information
CREATE VIEW sales.v_sales_detailed AS
SELECT 
  s.*,
  c.customer_code,
  c.full_name as customer_full_name,
  c.membership_level,
  c.is_vip,
  b.name as branch_name,
  b.code as branch_code,
  u.full_name as sold_by_name,
  ca.full_name as cashier_name
FROM sales.sales s
LEFT JOIN sales.customers c ON s.customer_id = c.id
LEFT JOIN public.branches b ON s.branch_id = b.id
LEFT JOIN auth.users u ON s.sold_by = u.id
LEFT JOIN auth.users ca ON s.cashier_id = ca.id;

-- Today's sales summary by branch
CREATE VIEW sales.v_today_sales_summary AS
SELECT 
  s.branch_id,
  b.name as branch_name,
  COUNT(*) as total_sales,
  SUM(s.total_amount) as total_revenue,
  AVG(s.total_amount) as average_sale,
  SUM(s.discount_amount) as total_discounts,
  COUNT(DISTINCT s.customer_id) as unique_customers
FROM sales.sales s
JOIN public.branches b ON s.branch_id = b.id
WHERE DATE(s.sale_date) = CURRENT_DATE 
  AND s.status = 'completed'
GROUP BY s.branch_id, b.name;

-- Product sales performance
CREATE VIEW sales.v_product_performance AS
SELECT 
  si.product_id,
  p.name as product_name,
  p.category,
  COUNT(*) as times_sold,
  SUM(si.quantity) as total_quantity_sold,
  SUM(si.line_total) as total_revenue,
  AVG(si.unit_price) as average_selling_price,
  SUM(si.gross_margin) as total_margin,
  AVG(si.gross_margin / NULLIF(si.line_total, 0) * 100) as average_margin_percentage
FROM sales.sale_items si
JOIN public.products p ON si.product_id = p.id
JOIN sales.sales s ON si.sale_id = s.id
WHERE s.status = 'completed' 
  AND si.voided = false
  AND s.sale_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY si.product_id, p.name, p.category
ORDER BY total_revenue DESC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON sales.sales TO sales_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales.sale_items TO sales_service;
GRANT SELECT, INSERT, UPDATE ON sales.sale_payments TO sales_service;
GRANT SELECT, INSERT, UPDATE ON sales.sale_discounts TO sales_service;
GRANT SELECT, INSERT, UPDATE ON sales.customers TO sales_service;
GRANT SELECT, INSERT, UPDATE ON sales.daily_sales_summary TO sales_service;
GRANT SELECT, INSERT, UPDATE ON sales.realtime_sales_cache TO sales_service;

-- Grant view permissions
GRANT SELECT ON sales.v_sales_detailed TO sales_service;
GRANT SELECT ON sales.v_today_sales_summary TO sales_service;
GRANT SELECT ON sales.v_product_performance TO sales_service;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA sales TO sales_service;

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION generate_sale_number(TEXT) TO sales_service;

-- Add comments for documentation
COMMENT ON SCHEMA sales IS 'Sales recording and tracking system for dried fruits retail operations';
COMMENT ON TABLE sales.sales IS 'Main sales transactions with customer and payment information';
COMMENT ON TABLE sales.sale_items IS 'Individual items sold in each transaction';
COMMENT ON TABLE sales.sale_payments IS 'Payment methods and processing details for sales';
COMMENT ON TABLE sales.customers IS 'Customer profiles and purchase history';
COMMENT ON TABLE sales.daily_sales_summary IS 'Pre-calculated daily sales metrics for reporting';
COMMENT ON VIEW sales.v_sales_detailed IS 'Sales with enriched customer and branch information';
COMMENT ON VIEW sales.v_product_performance IS 'Product sales performance metrics for the last 30 days';