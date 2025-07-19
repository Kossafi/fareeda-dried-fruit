-- Orders table
CREATE TABLE sales.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('walk_in', 'online', 'phone', 'delivery', 'pickup')),
    status order_status NOT NULL DEFAULT 'draft',
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    shipping_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'THB',
    payment_status payment_status NOT NULL DEFAULT 'pending',
    payment_method payment_method,
    shipping_address JSONB,
    billing_address JSONB,
    special_instructions TEXT,
    loyalty_points_earned INTEGER DEFAULT 0,
    loyalty_points_used INTEGER DEFAULT 0,
    sales_person_id UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    processed_at TIMESTAMP,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    refunded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items
CREATE TABLE sales.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES sales.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity DECIMAL(12, 3) NOT NULL,
    unit unit_type NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_price DECIMAL(10, 2) NOT NULL,
    special_instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales transactions (POS transactions)
CREATE TABLE sales.sales_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID REFERENCES sales.orders(id),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    cashier_id UUID NOT NULL REFERENCES auth.users(id),
    register_number VARCHAR(20),
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
    change_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'THB',
    customer_count INTEGER DEFAULT 1,
    receipt_number VARCHAR(50),
    voided_at TIMESTAMP,
    voided_by UUID REFERENCES auth.users(id),
    void_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales transaction items
CREATE TABLE sales.sales_transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES sales.sales_transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity DECIMAL(12, 3) NOT NULL,
    unit unit_type NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_price DECIMAL(10, 2) NOT NULL,
    promotion_ids UUID[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transaction payments
CREATE TABLE sales.transaction_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES sales.sales_transactions(id) ON DELETE CASCADE,
    method payment_method NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    reference_number VARCHAR(100),
    card_type VARCHAR(50),
    last_4_digits VARCHAR(4),
    authorization_code VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Returns
CREATE TABLE sales.returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_number VARCHAR(50) UNIQUE NOT NULL,
    original_order_id UUID REFERENCES sales.orders(id),
    original_transaction_id UUID REFERENCES sales.sales_transactions(id),
    customer_id UUID REFERENCES public.customers(id),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('exchange', 'refund', 'store_credit')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('defective', 'wrong_item', 'customer_changed_mind', 'damaged_in_shipping', 'expired', 'other')),
    refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    restock_fee DECIMAL(10, 2) DEFAULT 0,
    processed_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    refund_method payment_method,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Return items
CREATE TABLE sales.return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID NOT NULL REFERENCES sales.returns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity DECIMAL(12, 3) NOT NULL,
    unit unit_type NOT NULL,
    original_unit_price DECIMAL(10, 2) NOT NULL,
    refund_unit_price DECIMAL(10, 2) NOT NULL,
    total_refund DECIMAL(10, 2) NOT NULL,
    condition VARCHAR(20) NOT NULL CHECK (condition IN ('new', 'opened', 'damaged')),
    restockable BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Promotions
CREATE TABLE sales.promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed_amount', 'buy_x_get_y', 'bundle')),
    value DECIMAL(10, 2),
    min_purchase_amount DECIMAL(10, 2),
    max_discount_amount DECIMAL(10, 2),
    applicable_products UUID[],
    applicable_categories UUID[],
    applicable_branches UUID[],
    customer_tiers membership_tier[],
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_orders_customer_id ON sales.orders(customer_id);
CREATE INDEX idx_orders_branch_id ON sales.orders(branch_id);
CREATE INDEX idx_orders_status ON sales.orders(status);
CREATE INDEX idx_orders_created_at ON sales.orders(created_at);
CREATE INDEX idx_order_items_order_id ON sales.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON sales.order_items(product_id);
CREATE INDEX idx_sales_transactions_branch_id ON sales.sales_transactions(branch_id);
CREATE INDEX idx_sales_transactions_cashier_id ON sales.sales_transactions(cashier_id);
CREATE INDEX idx_sales_transactions_created_at ON sales.sales_transactions(created_at);
CREATE INDEX idx_sales_transaction_items_transaction_id ON sales.sales_transaction_items(transaction_id);
CREATE INDEX idx_sales_transaction_items_product_id ON sales.sales_transaction_items(product_id);
CREATE INDEX idx_transaction_payments_transaction_id ON sales.transaction_payments(transaction_id);
CREATE INDEX idx_returns_branch_id ON sales.returns(branch_id);
CREATE INDEX idx_returns_status ON sales.returns(status);
CREATE INDEX idx_return_items_return_id ON sales.return_items(return_id);
CREATE INDEX idx_promotions_start_end_dates ON sales.promotions(start_date, end_date);
CREATE INDEX idx_promotions_is_active ON sales.promotions(is_active);