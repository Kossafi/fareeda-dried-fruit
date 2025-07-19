-- Branches table
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type branch_type NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    address_street VARCHAR(255) NOT NULL,
    address_city VARCHAR(100) NOT NULL,
    address_province VARCHAR(100) NOT NULL,
    address_postal_code VARCHAR(20) NOT NULL,
    address_country VARCHAR(100) NOT NULL DEFAULT 'Thailand',
    address_lat DECIMAL(10, 8),
    address_lng DECIMAL(11, 8),
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    fax_number VARCHAR(20),
    website VARCHAR(255),
    manager_id UUID REFERENCES auth.users(id),
    timezone VARCHAR(50) DEFAULT 'Asia/Bangkok',
    currency VARCHAR(3) DEFAULT 'THB',
    language VARCHAR(10) DEFAULT 'th',
    tax_rate DECIMAL(5, 4) DEFAULT 0.07,
    allow_negative_stock BOOLEAN DEFAULT false,
    loyalty_points_multiplier DECIMAL(3, 2) DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Branch operating hours
CREATE TABLE public.branch_operating_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    open_time TIME,
    close_time TIME,
    is_open BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, day_of_week)
);

-- Branch break times
CREATE TABLE public.branch_break_times (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operating_hours_id UUID NOT NULL REFERENCES public.branch_operating_hours(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Branch staff assignments
CREATE TABLE public.branch_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    position VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, user_id, start_date)
);

-- Branch approval settings
CREATE TABLE public.branch_approval_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    require_manager_approval_discounts BOOLEAN DEFAULT false,
    require_manager_approval_returns BOOLEAN DEFAULT true,
    require_manager_approval_voids BOOLEAN DEFAULT true,
    require_manager_approval_stock_adjustments BOOLEAN DEFAULT true,
    require_manager_approval_price_overrides BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Branch POS settings
CREATE TABLE public.branch_pos_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    receipt_template TEXT,
    print_receipts BOOLEAN DEFAULT true,
    email_receipts BOOLEAN DEFAULT false,
    sms_receipts BOOLEAN DEFAULT false,
    allow_cash_payments BOOLEAN DEFAULT true,
    allow_card_payments BOOLEAN DEFAULT true,
    allow_mobile_payments BOOLEAN DEFAULT true,
    rounding_method VARCHAR(10) DEFAULT 'nearest' CHECK (rounding_method IN ('up', 'down', 'nearest')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Branch performance metrics
CREATE TABLE public.branch_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    daily_revenue DECIMAL(12, 2) DEFAULT 0,
    monthly_revenue DECIMAL(12, 2) DEFAULT 0,
    target_revenue DECIMAL(12, 2) DEFAULT 0,
    customer_count INTEGER DEFAULT 0,
    average_transaction_value DECIMAL(10, 2) DEFAULT 0,
    conversion_rate DECIMAL(5, 4) DEFAULT 0,
    stock_turnover DECIMAL(8, 4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, date)
);

-- Malls table
CREATE TABLE public.malls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address_street VARCHAR(255) NOT NULL,
    address_city VARCHAR(100) NOT NULL,
    address_province VARCHAR(100) NOT NULL,
    address_postal_code VARCHAR(20) NOT NULL,
    address_country VARCHAR(100) NOT NULL DEFAULT 'Thailand',
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    management_company VARCHAR(255),
    api_endpoint VARCHAR(500),
    reporting_schedule VARCHAR(100),
    data_format VARCHAR(20) DEFAULT 'json',
    auth_type VARCHAR(20),
    auth_credentials JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mall operating hours
CREATE TABLE public.mall_operating_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mall_id UUID NOT NULL REFERENCES public.malls(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    open_time TIME,
    close_time TIME,
    is_open BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(mall_id, day_of_week)
);

-- Mall branch associations
CREATE TABLE public.mall_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mall_id UUID NOT NULL REFERENCES public.malls(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(mall_id, branch_id)
);

-- Create indexes
CREATE INDEX idx_branches_code ON public.branches(branch_code);
CREATE INDEX idx_branches_type ON public.branches(type);
CREATE INDEX idx_branches_status ON public.branches(status);
CREATE INDEX idx_branch_staff_branch_id ON public.branch_staff(branch_id);
CREATE INDEX idx_branch_staff_user_id ON public.branch_staff(user_id);
CREATE INDEX idx_branch_performance_branch_date ON public.branch_performance(branch_id, date);
CREATE INDEX idx_mall_branches_mall_id ON public.mall_branches(mall_id);
CREATE INDEX idx_mall_branches_branch_id ON public.mall_branches(branch_id);