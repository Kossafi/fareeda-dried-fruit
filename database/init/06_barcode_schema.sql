-- Barcode management schema
-- This schema handles barcode generation, scanning, and tracking for all entities

-- Create barcode types enum
CREATE TYPE barcode_type AS ENUM (
  'product',
  'inventory_item', 
  'repack_order',
  'batch',
  'shipment',
  'location'
);

-- Create scan result enum
CREATE TYPE scan_result AS ENUM (
  'success',
  'invalid',
  'expired'
);

-- Barcodes table - stores all generated barcodes
CREATE TABLE inventory.barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode_id VARCHAR(100) NOT NULL UNIQUE, -- The actual barcode identifier
  type barcode_type NOT NULL,
  entity_id VARCHAR(100) NOT NULL, -- ID of the entity this barcode represents
  entity_type VARCHAR(50) NOT NULL, -- Type of entity (product, inventory_item, etc.)
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  data JSONB NOT NULL, -- Encoded data specific to the barcode type
  checksum VARCHAR(32) NOT NULL, -- Data integrity checksum
  
  -- Different barcode formats
  code128 VARCHAR(50), -- Code 128 barcode string
  ean13 VARCHAR(13), -- EAN-13 barcode for products
  qr_data TEXT, -- QR code data string
  
  -- Status and tracking
  is_active BOOLEAN NOT NULL DEFAULT true,
  printed_count INTEGER NOT NULL DEFAULT 0,
  last_scanned_at TIMESTAMP WITH TIME ZONE,
  scanned_count INTEGER NOT NULL DEFAULT 0,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT valid_entity_id CHECK (entity_id != ''),
  CONSTRAINT valid_checksum CHECK (LENGTH(checksum) = 16)
);

-- Barcode scans table - tracks all barcode scanning activities
CREATE TABLE inventory.barcode_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode_id VARCHAR(100) NOT NULL, -- References barcodes.barcode_id
  scanned_by UUID NOT NULL REFERENCES auth.users(id),
  scan_location VARCHAR(200), -- Physical location where scan occurred
  scan_device VARCHAR(100), -- Device used for scanning (handheld, mobile, etc.)
  scan_result scan_result NOT NULL,
  scan_data JSONB, -- Additional data captured during scan
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Index for barcode lookups
  INDEX idx_barcode_scans_barcode_id ON inventory.barcode_scans(barcode_id),
  INDEX idx_barcode_scans_scanned_by ON inventory.barcode_scans(scanned_by),
  INDEX idx_barcode_scans_created_at ON inventory.barcode_scans(created_at)
);

-- Barcode print jobs table - tracks printing operations
CREATE TABLE inventory.barcode_print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode_id VARCHAR(100) NOT NULL, -- References barcodes.barcode_id
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  printer_name VARCHAR(100),
  copies INTEGER NOT NULL DEFAULT 1,
  paper_size VARCHAR(20) DEFAULT 'label_medium',
  print_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, printing, completed, failed
  error_message TEXT,
  printed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_copies CHECK (copies > 0 AND copies <= 100),
  CONSTRAINT valid_paper_size CHECK (paper_size IN ('A4', 'label_small', 'label_medium', 'label_large'))
);

-- Indexes for better performance
CREATE INDEX idx_barcodes_barcode_id ON inventory.barcodes(barcode_id);
CREATE INDEX idx_barcodes_entity ON inventory.barcodes(entity_id, entity_type);
CREATE INDEX idx_barcodes_branch ON inventory.barcodes(branch_id);
CREATE INDEX idx_barcodes_type ON inventory.barcodes(type);
CREATE INDEX idx_barcodes_active ON inventory.barcodes(is_active) WHERE is_active = true;
CREATE INDEX idx_barcodes_code128 ON inventory.barcodes(code128) WHERE code128 IS NOT NULL;
CREATE INDEX idx_barcodes_ean13 ON inventory.barcodes(ean13) WHERE ean13 IS NOT NULL;
CREATE INDEX idx_barcodes_created_at ON inventory.barcodes(created_at);

-- GIN index for JSONB data queries
CREATE INDEX idx_barcodes_data_gin ON inventory.barcodes USING GIN (data);

-- Indexes for barcode scans
CREATE INDEX idx_barcode_scans_result ON inventory.barcode_scans(scan_result);
CREATE INDEX idx_barcode_scans_location ON inventory.barcode_scans(scan_location);

-- Indexes for print jobs
CREATE INDEX idx_barcode_print_jobs_barcode_id ON inventory.barcode_print_jobs(barcode_id);
CREATE INDEX idx_barcode_print_jobs_status ON inventory.barcode_print_jobs(print_status);
CREATE INDEX idx_barcode_print_jobs_requested_by ON inventory.barcode_print_jobs(requested_by);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_barcode_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_barcode_updated_at
  BEFORE UPDATE ON inventory.barcodes
  FOR EACH ROW
  EXECUTE FUNCTION update_barcode_updated_at();

-- Function to validate barcode data integrity
CREATE OR REPLACE FUNCTION validate_barcode_checksum()
RETURNS TRIGGER AS $$
BEGIN
  -- In a real implementation, you would validate the checksum here
  -- For now, we just ensure it's not empty
  IF LENGTH(NEW.checksum) != 16 THEN
    RAISE EXCEPTION 'Invalid checksum length. Expected 16 characters, got %', LENGTH(NEW.checksum);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate checksum on insert/update
CREATE TRIGGER trigger_validate_barcode_checksum
  BEFORE INSERT OR UPDATE ON inventory.barcodes
  FOR EACH ROW
  EXECUTE FUNCTION validate_barcode_checksum();

-- Views for common barcode queries

-- Active barcodes with entity information
CREATE VIEW inventory.v_active_barcodes AS
SELECT 
  b.*,
  CASE 
    WHEN b.type = 'product' THEN p.name
    WHEN b.type = 'inventory_item' THEN p.name
    ELSE 'N/A'
  END as entity_name,
  br.name as branch_name
FROM inventory.barcodes b
LEFT JOIN public.products p ON (
  (b.type = 'product' AND b.entity_id = p.id) OR
  (b.type = 'inventory_item' AND (b.data->>'productId')::text = p.id)
)
LEFT JOIN public.branches br ON b.branch_id = br.id
WHERE b.is_active = true;

-- Barcode scan statistics by branch
CREATE VIEW inventory.v_barcode_scan_stats AS
SELECT 
  b.branch_id,
  br.name as branch_name,
  DATE(bs.created_at) as scan_date,
  COUNT(*) as total_scans,
  COUNT(CASE WHEN bs.scan_result = 'success' THEN 1 END) as successful_scans,
  COUNT(CASE WHEN bs.scan_result = 'invalid' THEN 1 END) as invalid_scans,
  COUNT(CASE WHEN bs.scan_result = 'expired' THEN 1 END) as expired_scans,
  COUNT(DISTINCT bs.scanned_by) as unique_scanners
FROM inventory.barcode_scans bs
JOIN inventory.barcodes b ON bs.barcode_id = b.barcode_id
JOIN public.branches br ON b.branch_id = br.id
GROUP BY b.branch_id, br.name, DATE(bs.created_at);

-- Most scanned products view
CREATE VIEW inventory.v_most_scanned_products AS
SELECT 
  (b.data->>'productId')::text as product_id,
  p.name as product_name,
  p.category,
  b.branch_id,
  br.name as branch_name,
  COUNT(bs.id) as scan_count,
  COUNT(CASE WHEN bs.scan_result = 'success' THEN 1 END) as successful_scans,
  MAX(bs.created_at) as last_scanned_at,
  COUNT(DISTINCT bs.scanned_by) as unique_scanners
FROM inventory.barcode_scans bs
JOIN inventory.barcodes b ON bs.barcode_id = b.barcode_id
JOIN public.products p ON (b.data->>'productId')::text = p.id
JOIN public.branches br ON b.branch_id = br.id
WHERE bs.created_at >= NOW() - INTERVAL '30 days'
  AND bs.scan_result = 'success'
GROUP BY (b.data->>'productId')::text, p.name, p.category, b.branch_id, br.name
ORDER BY scan_count DESC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON inventory.barcodes TO inventory_service;
GRANT SELECT, INSERT ON inventory.barcode_scans TO inventory_service;
GRANT SELECT, INSERT, UPDATE ON inventory.barcode_print_jobs TO inventory_service;
GRANT SELECT ON inventory.v_active_barcodes TO inventory_service;
GRANT SELECT ON inventory.v_barcode_scan_stats TO inventory_service;
GRANT SELECT ON inventory.v_most_scanned_products TO inventory_service;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA inventory TO inventory_service;

-- Add comments for documentation
COMMENT ON TABLE inventory.barcodes IS 'Stores all generated barcodes for products, inventory items, and other entities';
COMMENT ON TABLE inventory.barcode_scans IS 'Tracks all barcode scanning activities for audit and analytics';
COMMENT ON TABLE inventory.barcode_print_jobs IS 'Manages barcode printing requests and status';
COMMENT ON VIEW inventory.v_active_barcodes IS 'Active barcodes with enriched entity information';
COMMENT ON VIEW inventory.v_barcode_scan_stats IS 'Daily barcode scanning statistics by branch';
COMMENT ON VIEW inventory.v_most_scanned_products IS 'Most frequently scanned products in the last 30 days';