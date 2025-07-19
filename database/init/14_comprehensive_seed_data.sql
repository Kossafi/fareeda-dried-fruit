-- ================================================
-- COMPREHENSIVE SEED DATA FOR DRIED FRUITS MANAGEMENT SYSTEM
-- Production-ready realistic demo data for testing
-- ================================================

BEGIN;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- CLEAR EXISTING DATA (For fresh setup)
-- ================================================

TRUNCATE TABLE 
    notification_delivery,
    alert_subscriptions,
    stock_alerts,
    alert_thresholds,
    sampling_approvals,
    sampling_records,
    sampling_sessions,
    sampling_policies,
    goods_receipts,
    purchase_order_items,
    purchase_order_approvals,
    purchase_orders,
    suppliers,
    delivery_confirmations,
    delivery_orders,
    sales_items,
    sales,
    inventory_movements,
    inventory_stocks,
    repack_items,
    repacks,
    users,
    product_categories,
    products,
    branches
RESTART IDENTITY CASCADE;

-- ================================================
-- BRANCH LOCATIONS (12 strategic locations)
-- ================================================

INSERT INTO branches (id, branch_name, branch_code, address, phone, manager_name, is_active, location_type, operating_hours) VALUES
-- Main branches in major shopping centers
(uuid_generate_v4(), 'Siam Paragon Central', 'SPC001', '991 Rama I Rd, Pathum Wan, Bangkok 10330', '+66-2-610-8000', 'Siriporn Chantraklin', true, 'shopping_center', '{"mon": "10:00-22:00", "tue": "10:00-22:00", "wed": "10:00-22:00", "thu": "10:00-22:00", "fri": "10:00-22:00", "sat": "10:00-22:00", "sun": "10:00-22:00"}'),
(uuid_generate_v4(), 'Central World Plaza', 'CWP002', '4, 4/1-4/2, 4/4 Ratchadamri Rd, Pathum Wan, Bangkok 10330', '+66-2-635-1111', 'Nattapong Srisawat', true, 'shopping_center', '{"mon": "10:00-22:00", "tue": "10:00-22:00", "wed": "10:00-22:00", "thu": "10:00-22:00", "fri": "10:00-22:00", "sat": "10:00-22:00", "sun": "10:00-22:00"}'),
(uuid_generate_v4(), 'EmQuartier Sukhumvit', 'EQS003', '693, 695 Sukhumvit Rd, Khlong Tan Nuea, Watthana, Bangkok 10110', '+66-2-269-1000', 'Kultida Pramote', true, 'shopping_center', '{"mon": "10:00-22:00", "tue": "10:00-22:00", "wed": "10:00-22:00", "thu": "10:00-22:00", "fri": "10:00-22:00", "sat": "10:00-22:00", "sun": "10:00-22:00"}'),
(uuid_generate_v4(), 'ICONSIAM Thonburi', 'ICT004', '299 Charoen Nakhon Rd, Khlong Ton Sai, Khlong San, Bangkok 10600', '+66-2-495-7000', 'Worawit Thanakit', true, 'shopping_center', '{"mon": "10:00-22:00", "tue": "10:00-22:00", "wed": "10:00-22:00", "thu": "10:00-22:00", "fri": "10:00-22:00", "sat": "10:00-22:00", "sun": "10:00-22:00"}'),
(uuid_generate_v4(), 'Terminal 21 Asok', 'T21005', '88 Sukhumvit Rd, Khlong Toei, Bangkok 10110', '+66-2-108-0888', 'Panida Rattanawong', true, 'shopping_center', '{"mon": "10:00-22:00", "tue": "10:00-22:00", "wed": "10:00-22:00", "thu": "10:00-22:00", "fri": "10:00-22:00", "sat": "10:00-22:00", "sun": "10:00-22:00"}'),

-- Premium branches in high-end areas
(uuid_generate_v4(), 'Gaysorn Village Premium', 'GVP006', '999 Ploenchit Rd, Lumpini, Pathum Wan, Bangkok 10330', '+66-2-656-1149', 'Suchitra Premsiri', true, 'premium', '{"mon": "10:00-21:00", "tue": "10:00-21:00", "wed": "10:00-21:00", "thu": "10:00-21:00", "fri": "10:00-21:00", "sat": "10:00-21:00", "sun": "10:00-21:00"}'),
(uuid_generate_v4(), 'Central Embassy Luxury', 'CEL007', '1031 Ploenchit Rd, Lumpini, Pathum Wan, Bangkok 10330', '+66-2-160-5888', 'Chaiyaporn Metharom', true, 'premium', '{"mon": "10:00-21:00", "tue": "10:00-21:00", "wed": "10:00-21:00", "thu": "10:00-21:00", "fri": "10:00-21:00", "sat": "10:00-21:00", "sun": "10:00-21:00"}'),

-- Community branches
(uuid_generate_v4(), 'The Mall Bangkapi', 'TMB008', '3522 Lat Phrao Rd, Khlong Chan, Bang Kapi, Bangkok 10240', '+66-2-734-4444', 'Somchai Boonmee', true, 'community', '{"mon": "10:00-21:00", "tue": "10:00-21:00", "wed": "10:00-21:00", "thu": "10:00-21:00", "fri": "10:00-21:00", "sat": "10:00-21:00", "sun": "10:00-21:00"}'),
(uuid_generate_v4(), 'Future Park Rangsit', 'FPR009', '94 Phahonyothin Rd, Prachathipat, Thanyaburi, Pathum Thani 12130', '+66-2-501-2222', 'Anchana Suksawat', true, 'community', '{"mon": "10:00-21:00", "tue": "10:00-21:00", "wed": "10:00-21:00", "thu": "10:00-21:00", "fri": "10:00-21:00", "sat": "10:00-21:00", "sun": "10:00-21:00"}'),
(uuid_generate_v4(), 'Central Westgate', 'CWG010', '199, 199/1 Kamphaeng Phet 6 Rd, Talat Bang Khen, Lak Si, Bangkok 10210', '+66-2-832-1111', 'Piyawan Sukhontha', true, 'community', '{"mon": "10:00-21:00", "tue": "10:00-21:00", "wed": "10:00-21:00", "thu": "10:00-21:00", "fri": "10:00-21:00", "sat": "10:00-21:00", "sun": "10:00-21:00"}'),

-- Express branches (smaller format)
(uuid_generate_v4(), 'BTS Phrom Phong Express', 'BPP011', 'BTS Phrom Phong Station, Sukhumvit Rd, Khlong Tan, Khlong Toei, Bangkok 10110', '+66-2-261-0817', 'Kornkarn Jaidee', true, 'express', '{"mon": "07:00-21:00", "tue": "07:00-21:00", "wed": "07:00-21:00", "thu": "07:00-21:00", "fri": "07:00-21:00", "sat": "07:00-21:00", "sun": "07:00-21:00"}'),
(uuid_generate_v4(), 'MRT Chatuchak Express', 'MCC012', 'MRT Chatuchak Park Station, Phahonyothin Rd, Chatuchak, Bangkok 10900', '+66-2-272-4444', 'Rattana Klanarong', true, 'express', '{"mon": "07:00-21:00", "tue": "07:00-21:00", "wed": "07:00-21:00", "thu": "07:00-21:00", "fri": "07:00-21:00", "sat": "07:00-21:00", "sun": "07:00-21:00"}');

-- ================================================
-- PRODUCT CATEGORIES (Comprehensive Thai dried fruits)
-- ================================================

INSERT INTO product_categories (id, category_name, category_code, description, display_order, is_active) VALUES
(uuid_generate_v4(), 'Tropical Fruits', 'TROP', 'Premium dried tropical fruits from Thailand', 1, true),
(uuid_generate_v4(), 'Stone Fruits', 'STONE', 'Dried stone fruits with natural sweetness', 2, true),
(uuid_generate_v4(), 'Citrus Fruits', 'CITRUS', 'Tangy dried citrus varieties', 3, true),
(uuid_generate_v4(), 'Exotic Specialties', 'EXOTIC', 'Rare and exotic dried fruit specialties', 4, true),
(uuid_generate_v4(), 'Gift Collections', 'GIFT', 'Premium gift sets and collections', 5, true),
(uuid_generate_v4(), 'Organic Selections', 'ORGANIC', 'Certified organic dried fruits', 6, true);

-- ================================================
-- PRODUCTS (25+ Premium Thai Dried Fruits)
-- ================================================

-- Get category IDs for reference
WITH category_ids AS (
    SELECT 
        category_name,
        id as category_id 
    FROM product_categories
)

INSERT INTO products (id, product_name, product_code, sku, category_id, description, unit_price, cost_price, weight_per_unit, unit_of_measure, minimum_stock_level, optimal_stock_level, is_active, shelf_life_days, storage_requirements, nutritional_info) 
SELECT 
    uuid_generate_v4(),
    product_data.product_name,
    product_data.product_code,
    product_data.sku,
    c.category_id,
    product_data.description,
    product_data.unit_price,
    product_data.cost_price,
    product_data.weight_per_unit,
    product_data.unit_of_measure,
    product_data.minimum_stock_level,
    product_data.optimal_stock_level,
    product_data.is_active,
    product_data.shelf_life_days,
    product_data.storage_requirements,
    product_data.nutritional_info
FROM (VALUES
    -- Tropical Fruits
    ('Premium Mango Dried', 'MNG001', 'DFH-MNG-001', 'Tropical Fruits', 'Sweet and chewy dried mango slices from Chiang Mai', 280.00, 140.00, 100.000, 'gram', 50.00, 200.00, true, 365, '{"temperature": "20-25°C", "humidity": "<60%", "light": "dark"}', '{"calories": 319, "sugar": 66, "fiber": 3.2, "vitaminA": 1262}'),
    ('Crystallized Pineapple', 'PIN001', 'DFH-PIN-001', 'Tropical Fruits', 'Naturally sweet crystallized pineapple rings', 320.00, 160.00, 150.000, 'gram', 30.00, 150.00, true, 270, '{"temperature": "18-22°C", "humidity": "<55%", "light": "dark"}', '{"calories": 284, "sugar": 68, "fiber": 2.1, "vitaminC": 15}'),
    ('Coconut Strips Natural', 'COC001', 'DFH-COC-001', 'Tropical Fruits', 'Unsweetened dried coconut strips', 240.00, 120.00, 80.000, 'gram', 40.00, 180.00, true, 180, '{"temperature": "15-20°C", "humidity": "<50%", "light": "dark"}', '{"calories": 660, "fat": 64, "fiber": 9, "protein": 6.9}'),
    ('Dragon Fruit Chips', 'DRG001', 'DFH-DRG-001', 'Tropical Fruits', 'Crispy vacuum-fried dragon fruit chips', 450.00, 225.00, 50.000, 'gram', 25.00, 100.00, true, 240, '{"temperature": "20-25°C", "humidity": "<60%", "light": "dark"}', '{"calories": 269, "sugar": 48, "fiber": 5.2, "antioxidants": "high"}'),
    ('Jackfruit Strips', 'JAK001', 'DFH-JAK-001', 'Tropical Fruits', 'Sweet dried jackfruit strips', 380.00, 190.00, 120.000, 'gram', 35.00, 140.00, true, 300, '{"temperature": "20-25°C", "humidity": "<60%", "light": "dark"}', '{"calories": 287, "sugar": 54, "fiber": 6.7, "vitaminC": 13}'),
    
    -- Stone Fruits  
    ('Thai Dried Longan', 'LON001', 'DFH-LON-001', 'Stone Fruits', 'Premium dried longan from Northern Thailand', 420.00, 210.00, 100.000, 'gram', 40.00, 160.00, true, 365, '{"temperature": "18-22°C", "humidity": "<55%", "light": "dark"}', '{"calories": 266, "sugar": 61, "fiber": 1.1, "vitaminC": 84}'),
    ('Dried Lychee Premium', 'LYC001', 'DFH-LYC-001', 'Stone Fruits', 'Naturally dried lychee with intense flavor', 480.00, 240.00, 80.000, 'gram', 30.00, 120.00, true, 270, '{"temperature": "18-22°C", "humidity": "<55%", "light": "dark"}', '{"calories": 276, "sugar": 65, "fiber": 1.3, "vitaminC": 71}'),
    ('Dried Rambutan', 'RAM001', 'DFH-RAM-001', 'Stone Fruits', 'Sweet dried rambutan from Surat Thani', 360.00, 180.00, 90.000, 'gram', 25.00, 100.00, true, 240, '{"temperature": "20-25°C", "humidity": "<60%", "light": "dark"}', '{"calories": 256, "sugar": 58, "fiber": 2.8, "vitaminC": 19}'),
    
    -- Citrus Fruits
    ('Candied Pomelo', 'POM001', 'DFH-POM-001', 'Citrus Fruits', 'Traditional candied pomelo peels', 290.00, 145.00, 100.000, 'gram', 35.00, 140.00, true, 300, '{"temperature": "20-25°C", "humidity": "<60%", "light": "dark"}', '{"calories": 298, "sugar": 71, "fiber": 4.2, "vitaminC": 61}'),
    ('Dried Lime Slices', 'LIM001', 'DFH-LIM-001', 'Citrus Fruits', 'Tangy dried lime slices', 220.00, 110.00, 60.000, 'gram', 20.00, 80.00, true, 365, '{"temperature": "18-22°C", "humidity": "<55%", "light": "dark"}', '{"calories": 247, "sugar": 38, "fiber": 8.9, "vitaminC": 129}'),
    ('Orange Peel Candied', 'ORA001', 'DFH-ORA-001', 'Citrus Fruits', 'Sweet candied orange peels', 260.00, 130.00, 80.000, 'gram', 25.00, 100.00, true, 270, '{"temperature": "20-25°C", "humidity": "<60%", "light": "dark"}', '{"calories": 315, "sugar": 76, "fiber": 3.1, "vitaminC": 32}'),
    
    -- Exotic Specialties
    ('Durian Chips Premium', 'DUR001', 'DFH-DUR-001', 'Exotic Specialties', 'Vacuum-fried durian chips - King of Fruits', 650.00, 325.00, 60.000, 'gram', 15.00, 60.00, true, 180, '{"temperature": "15-20°C", "humidity": "<50%", "light": "dark"}', '{"calories": 357, "fat": 5.3, "fiber": 3.8, "potassium": 436}'),
    ('Star Fruit Chips', 'STR001', 'DFH-STR-001', 'Exotic Specialties', 'Crispy star fruit chips', 340.00, 170.00, 70.000, 'gram', 20.00, 80.00, true, 240, '{"temperature": "20-25°C", "humidity": "<60%", "light": "dark"}', '{"calories": 289, "sugar": 51, "fiber": 3.9, "vitaminC": 56}'),
    ('Rose Apple Dried', 'ROS001', 'DFH-ROS-001', 'Exotic Specialties', 'Delicate dried rose apple slices', 390.00, 195.00, 85.000, 'gram', 18.00, 72.00, true, 210, '{"temperature": "18-22°C", "humidity": "<55%", "light": "dark"}', '{"calories": 278, "sugar": 63, "fiber": 2.7, "vitaminC": 22}'),
    ('Custard Apple Dried', 'CUS001', 'DFH-CUS-001', 'Exotic Specialties', 'Creamy dried custard apple pieces', 520.00, 260.00, 75.000, 'gram', 12.00, 48.00, true, 150, '{"temperature": "15-20°C", "humidity": "<50%", "light": "dark"}', '{"calories": 334, "sugar": 71, "fiber": 4.4, "vitaminC": 19}'),
    
    -- Gift Collections
    ('Tropical Mix Deluxe', 'TMD001', 'DFH-TMD-001', 'Gift Collections', 'Premium mixed tropical fruits gift box', 890.00, 445.00, 300.000, 'gram', 10.00, 40.00, true, 270, '{"temperature": "18-22°C", "humidity": "<55%", "light": "dark"}', '{"calories": 295, "sugar": 58, "fiber": 4.2, "variety": "mixed"}'),
    ('Executive Selection', 'EXE001', 'DFH-EXE-001', 'Gift Collections', 'Luxury dried fruit collection for executives', 1250.00, 625.00, 400.000, 'gram', 8.00, 32.00, true, 240, '{"temperature": "15-20°C", "humidity": "<50%", "light": "dark"}', '{"calories": 312, "sugar": 62, "fiber": 4.8, "variety": "premium"}'),
    ('Royal Heritage Box', 'ROY001', 'DFH-ROY-001', 'Gift Collections', 'Royal collection inspired by Thai tradition', 1680.00, 840.00, 500.000, 'gram', 5.00, 20.00, true, 300, '{"temperature": "15-20°C", "humidity": "<50%", "light": "dark"}', '{"calories": 318, "sugar": 64, "fiber": 5.1, "variety": "royal"}'),
    
    -- Organic Selections
    ('Organic Mango Slices', 'OMG001', 'DFH-OMG-001', 'Organic Selections', 'Certified organic dried mango slices', 420.00, 210.00, 100.000, 'gram', 30.00, 120.00, true, 365, '{"temperature": "20-25°C", "humidity": "<60%", "light": "dark"}', '{"calories": 319, "sugar": 66, "fiber": 3.2, "organic": true}'),
    ('Organic Coconut Chips', 'OCC001', 'DFH-OCC-001', 'Organic Selections', 'Organic coconut chips - unsweetened', 360.00, 180.00, 80.000, 'gram', 25.00, 100.00, true, 180, '{"temperature": "15-20°C", "humidity": "<50%", "light": "dark"}', '{"calories": 660, "fat": 64, "fiber": 9, "organic": true}'),
    ('Organic Banana Chips', 'OBC001', 'DFH-OBC-001', 'Organic Selections', 'Crispy organic banana chips', 280.00, 140.00, 100.000, 'gram', 40.00, 160.00, true, 240, '{"temperature": "20-25°C", "humidity": "<60%", "light": "dark"}', '{"calories": 519, "fat": 34, "fiber": 7.7, "organic": true}'),
    ('Organic Pineapple Rings', 'OPR001', 'DFH-OPR-001', 'Organic Selections', 'Naturally dried organic pineapple rings', 380.00, 190.00, 120.000, 'gram', 20.00, 80.00, true, 270, '{"temperature": "18-22°C", "humidity": "<55%", "light": "dark"}', '{"calories": 284, "sugar": 68, "fiber": 2.1, "organic": true}'),
    
    -- Additional specialty items
    ('Mixed Nuts & Fruits', 'MNF001', 'DFH-MNF-001', 'Gift Collections', 'Premium mix of dried fruits and nuts', 520.00, 260.00, 200.000, 'gram', 15.00, 60.00, true, 180, '{"temperature": "15-20°C", "humidity": "<50%", "light": "dark"}', '{"calories": 456, "protein": 12, "fat": 28, "fiber": 6.8}'),
    ('Tamarind Sweet', 'TAM001', 'DFH-TAM-001', 'Exotic Specialties', 'Traditional sweet tamarind treats', 190.00, 95.00, 100.000, 'gram', 50.00, 200.00, true, 365, '{"temperature": "20-25°C", "humidity": "<60%", "light": "dark"}', '{"calories": 287, "sugar": 68, "fiber": 5.1, "calcium": 74}'),
    ('Guava Leather', 'GUA001', 'DFH-GUA-001', 'Tropical Fruits', 'Natural fruit leather from fresh guava', 230.00, 115.00, 80.000, 'gram', 35.00, 140.00, true, 300, '{"temperature": "18-22°C", "humidity": "<55%", "light": "dark"}', '{"calories": 312, "sugar": 71, "fiber": 5.4, "vitaminC": 228}')
) AS product_data(product_name, product_code, sku, category_name, description, unit_price, cost_price, weight_per_unit, unit_of_measure, minimum_stock_level, optimal_stock_level, is_active, shelf_life_days, storage_requirements, nutritional_info)
JOIN category_ids c ON c.category_name = product_data.category_name;

-- ================================================
-- USERS (Complete organizational structure)
-- ================================================

INSERT INTO users (id, username, email, password_hash, first_name, last_name, phone, role, branch_id, is_active, employee_id, hire_date, department, salary, emergency_contact) 
SELECT 
    uuid_generate_v4(),
    user_data.username,
    user_data.email,
    '$2b$10$rKzpJQQWJgKqVYgmqPGGLOWYZ5k8.QQJmRJGqRJQzWOVY5K8Z5K8K', -- bcrypt hash for 'password123'
    user_data.first_name,
    user_data.last_name,
    user_data.phone,
    user_data.role,
    CASE 
        WHEN user_data.branch_code IS NOT NULL THEN b.id 
        ELSE NULL 
    END,
    user_data.is_active,
    user_data.employee_id,
    user_data.hire_date,
    user_data.department,
    user_data.salary,
    user_data.emergency_contact
FROM (VALUES
    -- Executive Level
    ('ceo.chairman', 'chairman@driedfruits.com', 'Somchai', 'Ratwattana', '+66-81-234-5678', 'admin', NULL, true, 'EXE001', '2020-01-15', 'Executive', 150000.00, '{"name": "Siriwan Ratwattana", "phone": "+66-81-234-5679", "relation": "spouse"}'),
    ('managing.director', 'md@driedfruits.com', 'Kultida', 'Srisawat', '+66-81-345-6789', 'admin', NULL, true, 'EXE002', '2020-02-01', 'Executive', 120000.00, '{"name": "Niran Srisawat", "phone": "+66-81-345-6790", "relation": "spouse"}'),
    ('operations.director', 'ops.director@driedfruits.com', 'Worawit', 'Thanakit', '+66-81-456-7890', 'admin', NULL, true, 'EXE003', '2020-03-01', 'Operations', 100000.00, '{"name": "Pranee Thanakit", "phone": "+66-81-456-7891", "relation": "spouse"}'),
    
    -- Regional Managers
    ('central.manager', 'central.mgr@driedfruits.com', 'Panida', 'Rattanawong', '+66-82-234-5678', 'manager', 'SPC001', true, 'MGR001', '2020-06-15', 'Regional Management', 65000.00, '{"name": "Suchart Rattanawong", "phone": "+66-82-234-5679", "relation": "spouse"}'),
    ('premium.manager', 'premium.mgr@driedfruits.com', 'Suchitra', 'Premsiri', '+66-82-345-6789', 'manager', 'GVP006', true, 'MGR002', '2020-07-01', 'Regional Management', 65000.00, '{"name": "Narong Premsiri", "phone": "+66-82-345-6790", "relation": "spouse"}'),
    ('community.manager', 'community.mgr@driedfruits.com', 'Somchai', 'Boonmee', '+66-82-456-7890', 'manager', 'TMB008', true, 'MGR003', '2020-08-15', 'Regional Management', 60000.00, '{"name": "Malee Boonmee", "phone": "+66-82-456-7891", "relation": "spouse"}'),
    
    -- Branch Managers (Matching branch managers)
    ('mgr.spc001', 'mgr.spc001@driedfruits.com', 'Siriporn', 'Chantraklin', '+66-83-111-1111', 'manager', 'SPC001', true, 'BMG001', '2021-01-15', 'Branch Management', 45000.00, '{"name": "Prasert Chantraklin", "phone": "+66-83-111-1112", "relation": "spouse"}'),
    ('mgr.cwp002', 'mgr.cwp002@driedfruits.com', 'Nattapong', 'Srisawat', '+66-83-222-2222', 'manager', 'CWP002', true, 'BMG002', '2021-02-01', 'Branch Management', 45000.00, '{"name": "Sirilak Srisawat", "phone": "+66-83-222-2223", "relation": "spouse"}'),
    ('mgr.eqs003', 'mgr.eqs003@driedfruits.com', 'Kultida', 'Pramote', '+66-83-333-3333', 'manager', 'EQS003', true, 'BMG003', '2021-03-01', 'Branch Management', 45000.00, '{"name": "Somsak Pramote", "phone": "+66-83-333-3334", "relation": "spouse"}'),
    ('mgr.ict004', 'mgr.ict004@driedfruits.com', 'Worawit', 'Thanakit', '+66-83-444-4444', 'manager', 'ICT004', true, 'BMG004', '2021-04-01', 'Branch Management', 45000.00, '{"name": "Apinya Thanakit", "phone": "+66-83-444-4445", "relation": "spouse"}'),
    ('mgr.t21005', 'mgr.t21005@driedfruits.com', 'Panida', 'Rattanawong', '+66-83-555-5555', 'manager', 'T21005', true, 'BMG005', '2021-05-01', 'Branch Management', 45000.00, '{"name": "Wichit Rattanawong", "phone": "+66-83-555-5556", "relation": "spouse"}'),
    ('mgr.gvp006', 'mgr.gvp006@driedfruits.com', 'Suchitra', 'Premsiri', '+66-83-666-6666', 'manager', 'GVP006', true, 'BMG006', '2021-06-01', 'Branch Management', 45000.00, '{"name": "Narong Premsiri", "phone": "+66-83-666-6667", "relation": "spouse"}'),
    ('mgr.cel007', 'mgr.cel007@driedfruits.com', 'Chaiyaporn', 'Metharom', '+66-83-777-7777', 'manager', 'CEL007', true, 'BMG007', '2021-07-01', 'Branch Management', 45000.00, '{"name": "Pensri Metharom", "phone": "+66-83-777-7778", "relation": "spouse"}'),
    ('mgr.tmb008', 'mgr.tmb008@driedfruits.com', 'Somchai', 'Boonmee', '+66-83-888-8888', 'manager', 'TMB008', true, 'BMG008', '2021-08-01', 'Branch Management', 42000.00, '{"name": "Malee Boonmee", "phone": "+66-83-888-8889", "relation": "spouse"}'),
    ('mgr.fpr009', 'mgr.fpr009@driedfruits.com', 'Anchana', 'Suksawat', '+66-83-999-9999', 'manager', 'FPR009', true, 'BMG009', '2021-09-01', 'Branch Management', 42000.00, '{"name": "Boonlert Suksawat", "phone": "+66-83-999-9990", "relation": "spouse"}'),
    ('mgr.cwg010', 'mgr.cwg010@driedfruits.com', 'Piyawan', 'Sukhontha', '+66-84-000-0000', 'manager', 'CWG010', true, 'BMG010', '2021-10-01', 'Branch Management', 42000.00, '{"name": "Sakda Sukhontha", "phone": "+66-84-000-0001", "relation": "spouse"}'),
    ('mgr.bpp011', 'mgr.bpp011@driedfruits.com', 'Kornkarn', 'Jaidee', '+66-84-111-1111', 'manager', 'BPP011', true, 'BMG011', '2021-11-01', 'Branch Management', 38000.00, '{"name": "Sunisa Jaidee", "phone": "+66-84-111-1112", "relation": "spouse"}'),
    ('mgr.mcc012', 'mgr.mcc012@driedfruits.com', 'Rattana', 'Klanarong', '+66-84-222-2222', 'manager', 'MCC012', true, 'BMG012', '2021-12-01', 'Branch Management', 38000.00, '{"name": "Preecha Klanarong", "phone": "+66-84-222-2223", "relation": "spouse"}'),
    
    -- Branch Staff (2-3 per branch)
    ('staff.spc001.1', 'staff.spc001.1@driedfruits.com', 'Apinya', 'Srisuwan', '+66-85-111-1111', 'staff', 'SPC001', true, 'STF001', '2022-01-15', 'Sales', 28000.00, '{"name": "Somdet Srisuwan", "phone": "+66-85-111-1112", "relation": "spouse"}'),
    ('staff.spc001.2', 'staff.spc001.2@driedfruits.com', 'Narong', 'Saelim', '+66-85-111-2222', 'staff', 'SPC001', true, 'STF002', '2022-02-01', 'Sales', 28000.00, '{"name": "Parichat Saelim", "phone": "+66-85-111-2223", "relation": "spouse"}'),
    ('staff.cwp002.1', 'staff.cwp002.1@driedfruits.com', 'Sirilak', 'Intharakit', '+66-85-222-1111', 'staff', 'CWP002', true, 'STF003', '2022-03-01', 'Sales', 28000.00, '{"name": "Weerawat Intharakit", "phone": "+66-85-222-1112", "relation": "spouse"}'),
    ('staff.cwp002.2', 'staff.cwp002.2@driedfruits.com', 'Manee', 'Phongsawat', '+66-85-222-2222', 'staff', 'CWP002', true, 'STF004', '2022-04-01', 'Sales', 28000.00, '{"name": "Kosol Phongsawat", "phone": "+66-85-222-2223", "relation": "spouse"}'),
    ('staff.eqs003.1', 'staff.eqs003.1@driedfruits.com', 'Somsak', 'Thongyai', '+66-85-333-1111', 'staff', 'EQS003', true, 'STF005', '2022-05-01', 'Sales', 28000.00, '{"name": "Jintana Thongyai", "phone": "+66-85-333-1112", "relation": "spouse"}'),
    ('staff.eqs003.2', 'staff.eqs003.2@driedfruits.com', 'Apinya', 'Mahachon', '+66-85-333-2222', 'staff', 'EQS003', true, 'STF006', '2022-06-01', 'Sales', 28000.00, '{"name": "Montri Mahachon", "phone": "+66-85-333-2223", "relation": "spouse"}'),
    
    -- Delivery Drivers (Shared across regions)
    ('driver.central.1', 'driver.central.1@driedfruits.com', 'Wichit', 'Changkham', '+66-86-111-1111', 'driver', NULL, true, 'DRV001', '2022-01-15', 'Logistics', 22000.00, '{"name": "Supaporn Changkham", "phone": "+66-86-111-1112", "relation": "spouse"}'),
    ('driver.central.2', 'driver.central.2@driedfruits.com', 'Boonlert', 'Saikaew', '+66-86-222-2222', 'driver', NULL, true, 'DRV002', '2022-02-01', 'Logistics', 22000.00, '{"name": "Malai Saikaew", "phone": "+66-86-222-2223", "relation": "spouse"}'),
    ('driver.premium.1', 'driver.premium.1@driedfruits.com', 'Sakda', 'Pongsiri', '+66-86-333-3333', 'driver', NULL, true, 'DRV003', '2022-03-01', 'Logistics', 22000.00, '{"name": "Anchalee Pongsiri", "phone": "+66-86-333-3334", "relation": "spouse"}'),
    ('driver.community.1', 'driver.community.1@driedfruits.com', 'Preecha', 'Thepsiri', '+66-86-444-4444', 'driver', NULL, true, 'DRV004', '2022-04-01', 'Logistics', 22000.00, '{"name": "Siriporn Thepsiri", "phone": "+66-86-444-4445", "relation": "spouse"}'),
    ('driver.community.2', 'driver.community.2@driedfruits.com', 'Somdet', 'Klaewkla', '+66-86-555-5555', 'driver', NULL, true, 'DRV005', '2022-05-01', 'Logistics', 22000.00, '{"name": "Wanida Klaewkla", "phone": "+66-86-555-5556", "relation": "spouse"}')
) AS user_data(username, email, first_name, last_name, phone, role, branch_code, is_active, employee_id, hire_date, department, salary, emergency_contact)
LEFT JOIN branches b ON b.branch_code = user_data.branch_code;

-- ================================================
-- SUPPLIERS (Comprehensive supplier network)
-- ================================================

INSERT INTO suppliers (id, supplier_name, supplier_code, contact_person, email, phone, address, tax_id, payment_terms, credit_limit, is_active, supplier_type, quality_rating, lead_time_days, minimum_order_value, preferred_products) VALUES
(uuid_generate_v4(), 'Northern Fruits Cooperative', 'NFC001', 'Somporn Chaikaew', 'procurement@northernfruits.co.th', '+66-53-234-567', '145 Moo 3, San Sai District, Chiang Mai 50210', '1234567890123', 'net_30', 500000.00, true, 'cooperative', 4.8, 7, 10000.00, '["mango", "longan", "lychee"]'),
(uuid_generate_v4(), 'Tropical Harvest Ltd', 'THL002', 'Wirat Suksawat', 'orders@tropicalharvest.com', '+66-77-345-678', '88 Industrial Estate Rd, Surat Thani 84000', '2345678901234', 'net_15', 300000.00, true, 'processor', 4.6, 5, 15000.00, '["pineapple", "coconut", "jackfruit"]'),
(uuid_generate_v4(), 'Premium Exotic Fruits', 'PEF003', 'Kultida Preecha', 'sales@premiumexotic.th', '+66-2-456-7890', '456 Bang Na-Trat Rd, Bang Na, Bangkok 10260', '3456789012345', 'net_30', 800000.00, true, 'distributor', 4.9, 3, 20000.00, '["durian", "rambutan", "dragon_fruit"]'),
(uuid_generate_v4(), 'Organic Valley Thailand', 'OVT004', 'Narathip Organic', 'info@organicvalley.th', '+66-44-567-8901', '789 Organic Farm Rd, Khon Kaen 40000', '4567890123456', 'net_45', 600000.00, true, 'organic_farm', 4.7, 10, 25000.00, '["organic_mango", "organic_coconut", "organic_banana"]'),
(uuid_generate_v4(), 'Southern Fruits Alliance', 'SFA005', 'Anchalee Thepsiri', 'contact@southernfruits.co.th', '+66-74-678-9012', '321 Songkhla Rd, Hat Yai, Songkhla 90110', '5678901234567', 'net_21', 400000.00, true, 'alliance', 4.5, 6, 12000.00, '["pomelo", "lime", "tamarind"]'),
(uuid_generate_v4(), 'Royal Fruit Processing', 'RFP006', 'Somsak Kiatisak', 'procurement@royalfruits.th', '+66-35-789-0123', '654 Si Racha Industrial Park, Chonburi 20230', '6789012345678', 'net_30', 1000000.00, true, 'processor', 4.8, 4, 30000.00, '["gift_collections", "premium_mixes"]'),
(uuid_generate_v4(), 'Eastern Orchard Collective', 'EOC007', 'Siriporn Mahachon', 'orders@easternorchard.th', '+66-38-890-1234', '987 Rayong Fruit Valley, Rayong 21000', '7890123456789', 'net_15', 350000.00, true, 'collective', 4.4, 8, 8000.00, '["guava", "star_fruit", "custard_apple"]'),
(uuid_generate_v4(), 'Packaging Solutions Pro', 'PSP008', 'Montri Packaging', 'sales@packagingpro.th', '+66-2-901-2345', '159 Lat Phrao Industrial Zone, Bangkok 10230', '8901234567890', 'net_30', 200000.00, true, 'packaging', 4.6, 2, 5000.00, '["packaging_materials", "gift_boxes"]');

COMMIT;

-- Continue with Part 2...