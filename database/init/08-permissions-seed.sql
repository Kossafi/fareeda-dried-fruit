-- Insert default permissions
INSERT INTO auth.permissions (id, name, description, resource, action) VALUES
  -- User Management
  (uuid_generate_v4(), 'Create Users', 'Create new users', 'users', 'create'),
  (uuid_generate_v4(), 'Read Users', 'View user information', 'users', 'read'),
  (uuid_generate_v4(), 'Update Users', 'Update user information', 'users', 'update'),
  (uuid_generate_v4(), 'Delete Users', 'Delete users', 'users', 'delete'),
  (uuid_generate_v4(), 'Assign Branches', 'Assign branches to users', 'users', 'assign_branches'),
  (uuid_generate_v4(), 'Grant Permissions', 'Grant permissions to users', 'users', 'grant_permissions'),

  -- Inventory Management
  (uuid_generate_v4(), 'View Inventory', 'View inventory levels', 'inventory', 'read'),
  (uuid_generate_v4(), 'Update Stock', 'Update stock levels', 'inventory', 'update'),
  (uuid_generate_v4(), 'Create Stock Movements', 'Create stock movements', 'inventory', 'create_movements'),
  (uuid_generate_v4(), 'Approve Stock Adjustments', 'Approve stock adjustments', 'inventory', 'approve_adjustments'),
  (uuid_generate_v4(), 'Perform Stock Counts', 'Perform stock counts', 'inventory', 'stock_count'),
  (uuid_generate_v4(), 'Create Repack Orders', 'Create repack orders', 'inventory', 'create_repack'),
  (uuid_generate_v4(), 'Approve Repack Orders', 'Approve repack orders', 'inventory', 'approve_repack'),

  -- Product Management
  (uuid_generate_v4(), 'View Products', 'View product information', 'products', 'read'),
  (uuid_generate_v4(), 'Create Products', 'Create new products', 'products', 'create'),
  (uuid_generate_v4(), 'Update Products', 'Update product information', 'products', 'update'),
  (uuid_generate_v4(), 'Delete Products', 'Delete products', 'products', 'delete'),
  (uuid_generate_v4(), 'Manage Pricing', 'Manage product pricing', 'products', 'manage_pricing'),
  (uuid_generate_v4(), 'Generate Barcodes', 'Generate product barcodes', 'products', 'generate_barcodes'),

  -- Sales Management
  (uuid_generate_v4(), 'Process Sales', 'Process sales transactions', 'sales', 'create'),
  (uuid_generate_v4(), 'View Sales', 'View sales data', 'sales', 'read'),
  (uuid_generate_v4(), 'Void Transactions', 'Void sales transactions', 'sales', 'void'),
  (uuid_generate_v4(), 'Apply Discounts', 'Apply discounts to sales', 'sales', 'apply_discounts'),
  (uuid_generate_v4(), 'Process Returns', 'Process product returns', 'sales', 'process_returns'),
  (uuid_generate_v4(), 'Override Prices', 'Override product prices', 'sales', 'override_prices'),

  -- Shipping Management
  (uuid_generate_v4(), 'View Shipments', 'View shipment information', 'shipping', 'read'),
  (uuid_generate_v4(), 'Create Shipments', 'Create new shipments', 'shipping', 'create'),
  (uuid_generate_v4(), 'Update Shipments', 'Update shipment status', 'shipping', 'update'),
  (uuid_generate_v4(), 'Create Transfer Orders', 'Create transfer orders', 'shipping', 'create_transfers'),
  (uuid_generate_v4(), 'Approve Transfer Orders', 'Approve transfer orders', 'shipping', 'approve_transfers'),
  (uuid_generate_v4(), 'Track Deliveries', 'Track delivery status', 'shipping', 'track_deliveries'),

  -- Branch Management
  (uuid_generate_v4(), 'View Branches', 'View branch information', 'branches', 'read'),
  (uuid_generate_v4(), 'Create Branches', 'Create new branches', 'branches', 'create'),
  (uuid_generate_v4(), 'Update Branches', 'Update branch information', 'branches', 'update'),
  (uuid_generate_v4(), 'Delete Branches', 'Delete branches', 'branches', 'delete'),
  (uuid_generate_v4(), 'Manage Branch Settings', 'Manage branch settings', 'branches', 'manage_settings'),

  -- Reporting
  (uuid_generate_v4(), 'View Reports', 'View reports', 'reports', 'read'),
  (uuid_generate_v4(), 'Generate Reports', 'Generate custom reports', 'reports', 'generate'),
  (uuid_generate_v4(), 'Export Data', 'Export data to files', 'reports', 'export'),
  (uuid_generate_v4(), 'View Analytics', 'View analytics dashboard', 'reports', 'analytics'),

  -- Notifications
  (uuid_generate_v4(), 'View Notifications', 'View notifications', 'notifications', 'read'),
  (uuid_generate_v4(), 'Send Notifications', 'Send notifications', 'notifications', 'send'),
  (uuid_generate_v4(), 'Manage Alerts', 'Manage alert settings', 'notifications', 'manage_alerts'),

  -- Customer Management
  (uuid_generate_v4(), 'View Customers', 'View customer information', 'customers', 'read'),
  (uuid_generate_v4(), 'Create Customers', 'Create new customers', 'customers', 'create'),
  (uuid_generate_v4(), 'Update Customers', 'Update customer information', 'customers', 'update'),
  (uuid_generate_v4(), 'Delete Customers', 'Delete customers', 'customers', 'delete'),
  (uuid_generate_v4(), 'Manage Loyalty Points', 'Manage customer loyalty points', 'customers', 'manage_loyalty');

-- Create default super admin user
DO $$
DECLARE
    super_admin_id UUID := uuid_generate_v4();
    permission_record RECORD;
BEGIN
    -- Insert super admin user
    INSERT INTO auth.users (
        id, email, username, password_hash, first_name, last_name, 
        role, status, created_at, updated_at
    ) VALUES (
        super_admin_id,
        'admin@driedfruits.com',
        'admin',
        '$2b$12$LQv3c1yqBwEHfGVRQpsJ.OvP7dGMKJQdCbXnVYcgCGKJl1mJNQfbK', -- password: Admin123!@#
        'Super',
        'Admin',
        'super_admin',
        'active',
        NOW(),
        NOW()
    );

    -- Grant all permissions to super admin
    FOR permission_record IN SELECT id FROM auth.permissions
    LOOP
        INSERT INTO auth.user_permissions (
            id, user_id, permission_id, granted_by, granted_at
        ) VALUES (
            uuid_generate_v4(),
            super_admin_id,
            permission_record.id,
            super_admin_id,
            NOW()
        );
    END LOOP;

    RAISE NOTICE 'Super admin user created with email: admin@driedfruits.com and password: Admin123!@#';
END $$;