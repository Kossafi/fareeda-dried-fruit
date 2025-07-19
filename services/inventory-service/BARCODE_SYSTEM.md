# Barcode System Documentation

Comprehensive barcode generation, scanning, and tracking system for the dried fruits inventory management platform.

## Overview

The barcode system provides end-to-end barcode management capabilities including:
- **Multi-format barcode generation** (Code 128, EAN-13, QR codes)
- **Real-time scanning and validation** with integrity checks
- **Comprehensive audit trails** for all barcode operations
- **Analytics and reporting** for usage patterns and performance
- **Print management** with job tracking and status monitoring

## Supported Barcode Types

### Product Barcodes
- **Purpose**: Identify specific products across the system
- **Format**: Code 128 + EAN-13 + QR Code
- **Contains**: Product ID, branch ID, batch number, expiration date, unit, quantity
- **Use Cases**: Product identification, pricing, inventory tracking

### Inventory Item Barcodes
- **Purpose**: Track specific inventory items with location and batch details
- **Format**: Code 128 + QR Code
- **Contains**: Inventory item ID, product ID, branch ID, location code, batch number
- **Use Cases**: Stock management, location tracking, audit trails

### Repack Order Barcodes
- **Purpose**: Track repack orders and their processing status
- **Format**: Code 128 + QR Code
- **Contains**: Repack order ID, target product ID, branch ID, expected quantity, unit
- **Use Cases**: Repack workflow management, quality control, traceability

### Batch Tracking Barcodes
- **Purpose**: Track product batches across multiple inventory items
- **Format**: Code 128 + QR Code
- **Contains**: Product ID, batch number, branch ID, type identifier
- **Use Cases**: Batch recall, expiration tracking, quality control

## API Endpoints

### Barcode Generation

#### Generate Product Barcode
```bash
POST /api/barcode/generate/product
Content-Type: application/json
Authorization: Bearer {token}

{
  "productId": "product-123",
  "branchId": "branch-456",
  "batchNumber": "BATCH001",
  "expirationDate": "2024-12-31T23:59:59Z",
  "unit": "kilogram",
  "quantity": 10
}
```

Response:
```json
{
  "success": true,
  "data": {
    "barcodeId": "PRD-12345678-abc123-xyz789",
    "code128": "PRD12345678ABC123XYZ",
    "ean13": "1234567890123",
    "qrData": "{\"id\":\"PRD-12345678-abc123-xyz789\",\"type\":\"product\",\"data\":{...}}",
    "type": "product",
    "createdAt": "2024-01-20T10:00:00Z"
  }
}
```

#### Generate Inventory Barcode
```bash
POST /api/barcode/generate/inventory
Content-Type: application/json
Authorization: Bearer {token}

{
  "inventoryItemId": "inventory-123",
  "productId": "product-123",
  "branchId": "branch-456",
  "locationCode": "A1-B2-C3",
  "batchNumber": "BATCH001"
}
```

#### Generate Repack Barcode
```bash
POST /api/barcode/generate/repack
Content-Type: application/json
Authorization: Bearer {token}

{
  "repackOrderId": "repack-123",
  "targetProductId": "mixed-fruits-1kg",
  "branchId": "branch-456",
  "expectedQuantity": 50,
  "unit": "kilogram"
}
```

#### Bulk Generate Inventory Barcodes
```bash
POST /api/barcode/generate/bulk/{branchId}
Authorization: Bearer {token}
```

Generates barcodes for all inventory items in the specified branch that don't already have barcodes.

### Barcode Scanning

#### Scan Barcode
```bash
POST /api/barcode/scan
Content-Type: application/json
Authorization: Bearer {token}

{
  "barcodeIdentifier": "PRD-12345678-abc123-xyz789",
  "scanLocation": "Warehouse-A-Section-1",
  "scanDevice": "Handheld-Scanner-001"
}
```

Response (Success):
```json
{
  "success": true,
  "data": {
    "barcodeData": {
      "id": "PRD-12345678-abc123-xyz789",
      "type": "product",
      "data": {
        "productId": "product-123",
        "branchId": "branch-456",
        "batchNumber": "BATCH001",
        "unit": "kilogram",
        "quantity": 10
      },
      "checksum": "abcd1234efgh5678",
      "createdAt": "2024-01-20T10:00:00Z"
    },
    "entityData": {
      "id": "product-123",
      "name": "Premium Dried Mango",
      "category": "Dried Fruits",
      "description": "High-quality dried mango slices"
    },
    "scanRecord": {
      "id": "scan-123",
      "barcodeId": "PRD-12345678-abc123-xyz789",
      "scannedBy": "user-456",
      "scanLocation": "Warehouse-A-Section-1",
      "scanDevice": "Handheld-Scanner-001",
      "scanResult": "success",
      "createdAt": "2024-01-20T14:30:00Z"
    }
  },
  "message": "Barcode scanned successfully"
}
```

Response (Failure):
```json
{
  "success": false,
  "error": "Barcode not found"
}
```

### Barcode Management

#### Get Entity Barcodes
```bash
GET /api/barcode/entity/{entityType}/{entityId}
Authorization: Bearer {token}
```

#### Get Branch Barcodes
```bash
GET /api/barcode/branch/{branchId}?type=product
Authorization: Bearer {token}
```

#### Record Print Operation
```bash
POST /api/barcode/{barcodeId}/print
Authorization: Bearer {token}
```

#### Deactivate Barcode
```bash
DELETE /api/barcode/{barcodeId}
Authorization: Bearer {token}
```

### Analytics and Reporting

#### Get Scan History
```bash
GET /api/barcode/{barcodeId}/scan-history?limit=50
Authorization: Bearer {token}
```

#### Get Branch Scan Activity
```bash
GET /api/barcode/analytics/{branchId}/scan-activity?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer {token}
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-20",
      "scanCount": 150,
      "successfulScans": 145,
      "failedScans": 5
    }
  ]
}
```

#### Get Most Scanned Products
```bash
GET /api/barcode/analytics/{branchId}/most-scanned?limit=10
Authorization: Bearer {token}
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "productId": "product-123",
      "productName": "Premium Dried Mango",
      "scanCount": 89,
      "lastScanned": "2024-01-20T14:30:00Z"
    }
  ]
}
```

## Barcode Format Specifications

### Barcode ID Structure
Format: `{PREFIX}-{ENTITY_HASH}-{BRANCH_HASH}-{TIMESTAMP}`

- **PREFIX**: 3-letter type identifier (PRD, INV, RPK, BCH)
- **ENTITY_HASH**: 8-character MD5 hash of entity ID
- **BRANCH_HASH**: 6-character MD5 hash of branch ID
- **TIMESTAMP**: Base36 encoded timestamp

Example: `PRD-12345678-abc123-xyz789`

### Code 128 Barcodes
- **Format**: Alphanumeric string derived from barcode ID
- **Length**: 20 characters maximum
- **Character Set**: A-Z, 0-9, hyphens, underscores
- **Use Case**: Standard barcode scanners, POS systems

### EAN-13 Barcodes (Products Only)
- **Format**: 13-digit numeric code
- **Structure**: 12 data digits + 1 check digit
- **Generation**: Hash-based from product ID and branch ID
- **Use Case**: Retail POS systems, standard product identification

### QR Codes
- **Format**: JSON string containing complete barcode data
- **Content**: Barcode ID, type, data payload, checksum, timestamp
- **Use Case**: Mobile apps, detailed information scanning

## Data Integrity and Security

### Checksum Validation
- **Algorithm**: SHA-256 hash of data payload (first 16 characters)
- **Purpose**: Prevent data corruption and tampering
- **Validation**: Performed on every scan operation

### Audit Trail
- **Scan Records**: Every scan operation is logged with user, location, device, result
- **Print Tracking**: All print operations are recorded with job status
- **Event Publishing**: Real-time events published via RabbitMQ for external systems

### Access Control
- **Generation**: Requires Warehouse Staff role or higher
- **Scanning**: Available to all authenticated users
- **Management**: Deactivation requires Branch Manager role or higher
- **Analytics**: Available based on branch access permissions

## Integration Examples

### Mobile App Scanning
```javascript
// React Native with camera scanning
import { BarCodeScanner } from 'expo-barcode-scanner';

const handleBarCodeScanned = async ({ type, data }) => {
  try {
    const response = await fetch('/api/barcode/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        barcodeIdentifier: data,
        scanLocation: 'Mobile-App',
        scanDevice: 'iPhone-12',
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      // Handle successful scan
      setScannedProduct(result.data.entityData);
    } else {
      // Handle scan failure
      showError(result.error);
    }
  } catch (error) {
    showError('Network error during scan');
  }
};
```

### POS System Integration
```javascript
// Point of Sale system integration
class POSBarcodeIntegration {
  async processProductScan(barcode) {
    try {
      const scanResult = await this.scanBarcode(barcode);
      
      if (scanResult.success) {
        const product = scanResult.data.entityData;
        const barcodeData = scanResult.data.barcodeData;
        
        // Add to cart with product details
        this.addToCart({
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: barcodeData.data.quantity || 1,
          batchNumber: barcodeData.data.batchNumber,
        });
        
        return { success: true, product };
      } else {
        return { success: false, error: scanResult.error };
      }
    } catch (error) {
      return { success: false, error: 'Scan processing failed' };
    }
  }
}
```

### Inventory Management Integration
```javascript
// Inventory receiving workflow
class InventoryReceiving {
  async processInventoryBarcode(barcode) {
    const scanResult = await this.scanBarcode(barcode);
    
    if (scanResult.success && scanResult.data.barcodeData.type === 'inventory_item') {
      const inventoryItem = scanResult.data.entityData;
      
      // Update stock levels
      await this.updateInventoryLocation(
        inventoryItem.id,
        this.currentLocation,
        this.currentUser.id
      );
      
      // Track movement
      await this.recordStockMovement({
        inventoryItemId: inventoryItem.id,
        movementType: 'RECEIVED',
        location: this.currentLocation,
        scannedBy: this.currentUser.id,
        barcodeId: scanResult.data.barcodeData.id,
      });
      
      return inventoryItem;
    }
    
    throw new Error('Invalid inventory barcode');
  }
}
```

## Performance Optimizations

### Database Indexing
- **Barcode ID**: Primary index for fast lookups
- **Code 128/EAN-13**: Separate indexes for alternative scan methods
- **Entity Lookups**: Composite index on (entity_id, entity_type)
- **Branch Filtering**: Index on branch_id for multi-tenant queries
- **JSONB Data**: GIN index for complex data queries

### Caching Strategy
- **Active Barcodes**: Redis cache for frequently scanned barcodes
- **Product Data**: Cache product information for quick entity lookups
- **Scan History**: Cache recent scan results for repeat operations

### Bulk Operations
- **Batch Generation**: Optimized for creating multiple barcodes simultaneously
- **Bulk Validation**: Efficient processing of large barcode sets
- **Background Processing**: Asynchronous generation for performance

## Monitoring and Maintenance

### Key Metrics
- **Scan Success Rate**: Percentage of successful vs. failed scans
- **Generation Rate**: Barcodes created per time period
- **Usage Patterns**: Most scanned products and locations
- **Error Rates**: Failed scans by type and reason

### Alerts and Notifications
- **High Error Rates**: Alert when scan failure rate exceeds threshold
- **Integrity Failures**: Immediate alerts for checksum validation failures
- **Usage Anomalies**: Unusual scanning patterns or volumes
- **System Performance**: Database query performance and response times

### Maintenance Tasks
- **Daily**: Clean up old scan records beyond retention period
- **Weekly**: Analyze scan patterns and generate usage reports
- **Monthly**: Review and optimize database indexes and queries
- **Quarterly**: Audit barcode integrity and deactivate unused barcodes

The barcode system provides a robust foundation for inventory tracking, product identification, and operational efficiency across the dried fruits business network.