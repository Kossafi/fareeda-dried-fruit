# Inventory Management Service with Repack System

Comprehensive inventory management service for the dried fruits system with advanced repack functionality for combining multiple products into new SKUs.

## Features

### Core Inventory Management
- **Multi-Unit Support**: Handle different units (gram, kilogram, piece, box, package)
- **Real-time Stock Tracking**: Live inventory updates with Redis caching
- **Stock Movements**: Complete audit trail of all stock changes
- **Automated Alerts**: Low stock and expiration alerts via RabbitMQ
- **Stock Reservation**: Reserve stock for orders with automatic release
- **Batch Management**: Track products by batch numbers and expiration dates
- **Location Tracking**: Warehouse location management (section, aisle, shelf, bin)
- **Branch Isolation**: Separate inventory management per branch
- **Cost Tracking**: Monitor product costs and average cost calculations

### Advanced Repack System
- **Multi-Product Combining**: Combine multiple source products into new target SKUs
- **Smart Cost Calculation**: Automatic cost calculation based on source item contributions
- **Efficiency Tracking**: Monitor repack efficiency and yield rates
- **Feasibility Validation**: Pre-repack validation of stock availability and requirements
- **Automated Suggestions**: AI-powered repack opportunity detection
- **Batch Processing**: Support for large-scale repack operations
- **Quality Control**: Track actual vs expected quantities for process improvement

## API Endpoints

### Inventory Management
- `POST /api/inventory/items` - Create inventory item
- `GET /api/inventory/items/:id` - Get inventory item details
- `PUT /api/inventory/items/:id` - Update inventory item
- `POST /api/inventory/items/:id/adjust` - Adjust stock levels
- `POST /api/inventory/items/:id/reserve` - Reserve stock
- `POST /api/inventory/items/:id/release` - Release reserved stock
- `GET /api/inventory/branches/:branchId/items` - Get branch inventory
- `GET /api/inventory/branches/:branchId/low-stock` - Get low stock items
- `POST /api/inventory/validate-stock` - Validate stock availability

### Repack System
- `POST /api/repack/orders` - Create repack order
- `GET /api/repack/orders/:id` - Get repack order details
- `POST /api/repack/orders/:id/start` - Start repack process
- `POST /api/repack/orders/:id/complete` - Complete repack with actual results
- `POST /api/repack/orders/:id/cancel` - Cancel repack order
- `GET /api/repack/orders/:id/validate` - Validate repack feasibility
- `GET /api/repack/branches/:branchId/orders` - Get branch repack orders
- `GET /api/repack/branches/:branchId/efficiency-report` - Get efficiency analytics
- `GET /api/repack/branches/:branchId/suggestions` - Get AI-powered suggestions
- `GET /api/repack/ready-for-processing` - Get orders ready for processing

## Repack System Workflow

### 1. Create Repack Order
```bash
curl -X POST http://localhost:3002/api/repack/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "branchId": "branch-123",
    "targetProductId": "mixed-fruits-1kg",
    "expectedQuantity": 50,
    "targetUnit": "kilogram",
    "sourceItems": [
      {
        "inventoryItemId": "dried-mango-item",
        "requiredQuantity": 15,
        "unit": "kilogram"
      },
      {
        "inventoryItemId": "dried-papaya-item", 
        "requiredQuantity": 20,
        "unit": "kilogram"
      },
      {
        "inventoryItemId": "dried-banana-item",
        "requiredQuantity": 15,
        "unit": "kilogram"
      }
    ],
    "scheduledDate": "2024-01-20T10:00:00Z",
    "notes": "Premium mixed fruit package for holiday season"
  }'
```

### 2. Start Repack Process
```bash
curl -X POST http://localhost:3002/api/repack/orders/repack-123/start \
  -H "Authorization: Bearer your-token" \
  -d '{
    "supervisedBy": "supervisor-user-id"
  }'
```

### 3. Complete Repack with Actual Results
```bash
curl -X POST http://localhost:3002/api/repack/orders/repack-123/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "actualQuantity": 48.5,
    "sourceItemActuals": [
      {
        "inventoryItemId": "dried-mango-item",
        "actualQuantity": 14.8
      },
      {
        "inventoryItemId": "dried-papaya-item",
        "actualQuantity": 19.2
      },
      {
        "inventoryItemId": "dried-banana-item",
        "actualQuantity": 14.5
      }
    ],
    "notes": "Excellent quality batch, minor weight loss during processing"
  }'
```

## Repack Order States

- **PLANNED**: Order created and scheduled
- **IN_PROGRESS**: Repack process has started
- **COMPLETED**: Successfully completed with actual results
- **CANCELLED**: Order cancelled before completion

## Smart Features

### Automatic Stock Reservation
When a repack order is created, the system automatically reserves the required source stock to prevent conflicts with other operations.

### Cost Calculation
The system calculates the cost of the target product based on:
- Source item costs and quantities used
- Weighted average cost per unit
- Processing overhead (configurable)

### Efficiency Tracking
- **Yield Efficiency**: (Actual output / Expected output) × 100
- **Cost Efficiency**: Cost per target unit vs. market rates
- **Time Efficiency**: Actual vs. planned processing time

### AI-Powered Suggestions
The system analyzes:
- Excess inventory levels
- Demand patterns
- Cost optimization opportunities
- Expiration dates
- Historical repack performance

## Background Jobs

### Repack Processor
- Runs hourly to check ready orders
- Validates feasibility before processing
- Detects overdue orders
- Generates optimization suggestions

### Alert System
- Low stock alerts for source materials
- Expiration warnings for time-sensitive repacks
- Efficiency anomaly detection
- Cost variance alerts

## Real-time Events

### RabbitMQ Events
- `repack.orders.created` - New repack order
- `repack.orders.started` - Process begun
- `repack.orders.completed` - Successfully finished
- `repack.orders.cancelled` - Order cancelled
- `repack.orders.overdue` - Past due date
- `repack.orders.suggestions_generated` - New opportunities

## Performance Analytics

### Efficiency Metrics
```bash
curl -X GET "http://localhost:3002/api/repack/branches/branch-123/efficiency-report?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer your-token"
```

Response:
```json
{
  "success": true,
  "data": {
    "totalOrders": 45,
    "completedOrders": 42,
    "cancelledOrders": 3,
    "averageEfficiency": 94.2,
    "totalCostSaved": 1250.00,
    "mostEfficientRepacks": [
      {
        "repackNumber": "RPK-001",
        "targetProductName": "Premium Mixed Fruits",
        "efficiency": 98.5,
        "costSaved": 45.20
      }
    ]
  }
}
```

## Validation and Safety

### Pre-Repack Validation
- Stock availability verification
- Expiration date checks
- Cross-contamination prevention
- Quality requirements validation

### Real-time Monitoring
- Weight variance detection
- Quality control checkpoints
- Process deviation alerts
- Compliance tracking

## Integration Points

### With Other Services
- **Sales Service**: Automatic repack for custom orders
- **Shipping Service**: Repack for specific delivery requirements  
- **Reporting Service**: Performance analytics and optimization
- **Notification Service**: Alerts and process updates

### External Systems
- **ERP Integration**: Cost accounting and financial reporting
- **Quality Management**: Compliance and audit trails
- **Production Planning**: Demand forecasting and scheduling

## Configuration

### Environment Variables
```env
# Repack Configuration
REPACK_MAX_BATCH_SIZE=100
REPACK_PROCESSING_TIME_MINUTES=30
REPACK_SETUP_TIME_MINUTES=15
REPACK_EFFICIENCY_THRESHOLD=85
REPACK_COST_VARIANCE_THRESHOLD=10

# Alert Thresholds
REPACK_OVERDUE_HOURS=24
REPACK_EFFICIENCY_WARNING=80
REPACK_COST_WARNING=20
```

### Business Rules
- Minimum 3 source items for complex repacks
- Maximum 20% cost variance tolerance
- Automatic cancellation after 48 hours overdue
- Quality approval required for efficiency < 80%

## Testing

```bash
# Run repack-specific tests
npm test -- --testPathPattern=repack

# Run integration tests
npm test -- --testPathPattern=integration

# Performance tests
npm run test:performance
```

## Monitoring and Maintenance

### Key Metrics to Monitor
- Repack completion rate
- Average processing time
- Cost variance trends
- Stock wastage rates
- Customer satisfaction scores

### Maintenance Tasks
- Weekly efficiency report review
- Monthly cost optimization analysis
- Quarterly process improvement assessment
- Annual system performance evaluation

The Repack System transforms your inventory management from simple tracking to intelligent product transformation, enabling flexible product offerings and optimal resource utilization.