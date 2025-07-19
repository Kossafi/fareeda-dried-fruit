# Shipping and Delivery Order Management Service

A comprehensive shipping and delivery order management system for the dried fruits inventory platform, providing real-time tracking, driver assignment, and inventory integration.

## Features

### 🚚 Delivery Order Management
- Create and manage delivery orders between branches
- Track items with accurate quantity and unit measurements
- Real-time status updates throughout delivery process
- Support for multiple unit types (gram, keed, kilogram, pack, piece)

### 👨‍✈️ Driver Management
- Assign drivers to delivery orders
- Real-time GPS location tracking
- Performance analytics and delivery history
- Driver availability management
- Route optimization suggestions

### 📦 Inventory Integration
- Automatic stock reservation when creating orders
- Inventory transfer upon delivery confirmation
- Batch and expiration date tracking
- Barcode scanning integration

### 📊 Analytics & Reporting
- Delivery performance metrics
- On-time delivery rates
- Driver performance ratings
- Branch-wise delivery analytics

### 🔄 Real-time Features
- WebSocket-based live tracking
- GPS location updates
- Instant status notifications
- Real-time dashboard updates

## API Endpoints

### Delivery Orders
- `POST /api/orders/create` - Create new delivery order
- `GET /api/orders/:id` - Get delivery order details
- `PUT /api/orders/:id/status` - Update order status
- `PUT /api/orders/:id/assign-driver` - Assign driver to order
- `GET /api/orders/branch/:branchId` - Get orders by branch
- `GET /api/orders/driver/:driverId` - Get orders by driver
- `POST /api/orders/:id/confirm-items` - Confirm delivered items
- `GET /api/orders/attention` - Get orders requiring attention
- `GET /api/orders/analytics` - Get delivery analytics

### Drivers
- `GET /api/drivers/available` - Get available drivers
- `GET /api/drivers/:driverId` - Get driver details
- `PUT /api/drivers/:driverId/status` - Update driver status
- `PUT /api/drivers/:driverId/location` - Update driver location
- `GET /api/drivers/:driverId/history` - Get delivery history

### Shipping (Legacy)
- `POST /api/shipping/delivery-orders` - Create delivery order
- `GET /api/shipping/delivery-orders/:id` - Get order details
- `PUT /api/shipping/delivery-orders/:id/status` - Update status
- `GET /api/shipping/tracking/:orderNumber` - Track by order number

## WebSocket Events

### Client Events
- `track_delivery` - Subscribe to delivery updates
- `track_driver` - Subscribe to driver location updates
- `driver_location_update` - Send driver location update
- `delivery_status_update` - Send delivery status update

### Server Events
- `driver_location_updated` - Broadcast driver location
- `delivery_status_updated` - Broadcast delivery status
- `delivery_updated` - General delivery update
- `driver_updated` - General driver update

## Configuration

### Environment Variables
```env
# Server
PORT=3003
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=shipping_service
DB_PASSWORD=shipping_password
DB_NAME=dried_fruits_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=2

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# WebSocket
WEBSOCKET_PORT=3004
WEBSOCKET_CORS_ORIGIN=http://localhost:3000

# External Services
INVENTORY_SERVICE_URL=http://localhost:3002
AUTH_SERVICE_URL=http://localhost:3001

# Delivery Settings
MAX_ORDERS_PER_DRIVER=5
AUTO_ASSIGN_ENABLED=true
```

## Installation

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run tests
npm test
```

## Database Schema

### delivery_orders
- Order management with status tracking
- Scheduled pickup and delivery dates
- Driver and vehicle assignment
- Special requirements (refrigeration, signature)

### delivery_order_items
- Individual items in each order
- Quantity and unit tracking
- Batch and expiration date support
- Confirmation status

### delivery_tracking
- GPS location history
- Status change events
- Timestamps and notes

### drivers
- Driver profiles and status
- License information
- Current location tracking
- Performance metrics

## Integration Points

### Inventory Service
- Stock reservation on order creation
- Inventory transfer on delivery confirmation
- Product and batch information retrieval

### Auth Service
- User authentication and authorization
- Driver profile management
- Role-based access control

### Barcode Service
- Barcode scanning for item verification
- Quick item lookup during delivery

## Security

- JWT-based authentication
- Role-based access control
- Rate limiting on API endpoints
- Secure WebSocket connections
- Input validation with Joi schemas

## Performance Optimizations

- Redis caching for frequently accessed data
- Database indexes on critical queries
- Connection pooling for PostgreSQL
- Efficient WebSocket room management
- Batch processing for bulk operations
EOF < /dev/null