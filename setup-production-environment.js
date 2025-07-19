#!/usr/bin/env node

/**
 * Production Environment Setup Script
 * Sets up the complete dried fruits inventory management system
 * with realistic demo data and production-ready configuration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🥭 Setting up Dried Fruits Inventory Management System');
console.log('======================================================');

// Configuration
const config = {
  nodeEnv: 'production',
  port: 3000,
  dbHost: 'localhost',
  dbPort: 5432,
  dbName: 'dried_fruits_inventory',
  dbUser: 'postgres',
  redisHost: 'localhost',
  redisPort: 6379,
  jwtSecret: 'your_super_secure_jwt_secret_here_change_in_production',
  rabbitMqUrl: 'amqp://localhost:5672'
};

// Step 1: Check Prerequisites
console.log('\n📋 Step 1: Checking Prerequisites...');

function checkPrerequisites() {
  const checks = [
    { cmd: 'node --version', name: 'Node.js' },
    { cmd: 'npm --version', name: 'npm' },
    { cmd: 'psql --version', name: 'PostgreSQL' },
    { cmd: 'redis-cli --version', name: 'Redis' }
  ];

  checks.forEach(check => {
    try {
      const version = execSync(check.cmd, { encoding: 'utf8' }).trim();
      console.log(`✅ ${check.name}: ${version}`);
    } catch (error) {
      console.log(`❌ ${check.name}: Not found or not accessible`);
      console.log(`   Please install ${check.name} and ensure it's in your PATH`);
      process.exit(1);
    }
  });
}

checkPrerequisites();

// Step 2: Setup Environment Variables
console.log('\n🔧 Step 2: Creating Environment Configuration...');

function createEnvironmentFiles() {
  const envContent = `# Dried Fruits Inventory Management System
# Production Environment Configuration

# Node Environment
NODE_ENV=${config.nodeEnv}
PORT=${config.port}

# Database Configuration
DB_HOST=${config.dbHost}
DB_PORT=${config.dbPort}
DB_NAME=${config.dbName}
DB_USER=${config.dbUser}
DB_PASSWORD=your_secure_password_here

# Redis Configuration
REDIS_HOST=${config.redisHost}
REDIS_PORT=${config.redisPort}
REDIS_PASSWORD=your_redis_password_here

# JWT Configuration
JWT_SECRET=${config.jwtSecret}
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# RabbitMQ Configuration
RABBITMQ_URL=${config.rabbitMqUrl}

# File Storage Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf,xlsx,csv

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@driedfruits.com

# SMS Configuration (for notifications)
SMS_PROVIDER=twilio
SMS_ACCOUNT_SID=your_twilio_sid
SMS_AUTH_TOKEN=your_twilio_token
SMS_FROM_NUMBER=+1234567890

# Push Notification Configuration
FCM_SERVER_KEY=your_fcm_server_key
FCM_PROJECT_ID=your_fcm_project_id

# System Configuration
DEFAULT_TIMEZONE=Asia/Bangkok
DEFAULT_CURRENCY=THB
DEFAULT_LANGUAGE=th

# Monitoring and Logging
LOG_LEVEL=info
LOG_DIR=./logs
ENABLE_REQUEST_LOGGING=true

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Cache Configuration
CACHE_TTL_MINUTES=60
CACHE_MAX_SIZE_MB=256

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
`;

  // Write to services/inventory-service/.env
  const inventoryServiceEnvPath = path.join(__dirname, 'services', 'inventory-service', '.env');
  fs.mkdirSync(path.dirname(inventoryServiceEnvPath), { recursive: true });
  fs.writeFileSync(inventoryServiceEnvPath, envContent);
  console.log(`✅ Created ${inventoryServiceEnvPath}`);

  // Write to services/shipping-service/.env
  const shippingServiceEnvPath = path.join(__dirname, 'services', 'shipping-service', '.env');
  fs.mkdirSync(path.dirname(shippingServiceEnvPath), { recursive: true });
  fs.writeFileSync(shippingServiceEnvPath, envContent);
  console.log(`✅ Created ${shippingServiceEnvPath}`);

  // Create main .env
  fs.writeFileSync('.env', envContent);
  console.log('✅ Created main .env file');
}

createEnvironmentFiles();

// Step 3: Setup Database
console.log('\n🗄️  Step 3: Setting up PostgreSQL Database...');

function setupDatabase() {
  try {
    console.log('Creating database...');
    execSync(`createdb ${config.dbName}`, { stdio: 'inherit' });
    console.log('✅ Database created successfully');
  } catch (error) {
    console.log('⚠️  Database might already exist, continuing...');
  }

  console.log('Running database migrations...');
  const sqlFiles = [
    '01_initial_schema.sql',
    '02_products_and_categories.sql',
    '03_inventory_management.sql',
    '04_sales_system.sql',
    '05_barcode_system.sql',
    '06_repack_system.sql',
    '07_delivery_system.sql',
    '08_users_and_auth.sql',
    '09_indexes_and_constraints.sql',
    '10_low_stock_alerts_schema.sql',
    '11_sampling_management_schema.sql',
    '12_procurement_schema.sql',
    '13_reporting_analytics_schema.sql',
    '14_comprehensive_seed_data.sql',
    '15_historical_transactions.sql'
  ];

  sqlFiles.forEach(file => {
    const filePath = path.join(__dirname, 'database', 'init', file);
    if (fs.existsSync(filePath)) {
      console.log(`  Executing ${file}...`);
      execSync(`psql -d ${config.dbName} -f "${filePath}"`, { stdio: 'inherit' });
      console.log(`  ✅ ${file} completed`);
    } else {
      console.log(`  ⚠️  ${file} not found, skipping...`);
    }
  });

  console.log('✅ Database setup completed');
}

setupDatabase();

// Step 4: Install Dependencies
console.log('\n📦 Step 4: Installing Dependencies...');

function installDependencies() {
  const services = ['inventory-service', 'shipping-service'];
  
  services.forEach(service => {
    const servicePath = path.join(__dirname, 'services', service);
    if (fs.existsSync(path.join(servicePath, 'package.json'))) {
      console.log(`Installing dependencies for ${service}...`);
      execSync('npm install', { cwd: servicePath, stdio: 'inherit' });
      console.log(`✅ ${service} dependencies installed`);
    }
  });

  // Install root dependencies if package.json exists
  if (fs.existsSync('package.json')) {
    console.log('Installing root dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Root dependencies installed');
  }
}

installDependencies();

// Step 5: Create Management Scripts
console.log('\n📝 Step 5: Creating Management Scripts...');

function createManagementScripts() {
  // Create startup script
  const startupScript = `#!/bin/bash
# Dried Fruits Inventory Management System Startup Script

echo "🥭 Starting Dried Fruits Inventory Management System..."

# Start PostgreSQL (if not running)
if ! pgrep -x "postgres" > /dev/null; then
    echo "Starting PostgreSQL..."
    sudo systemctl start postgresql
fi

# Start Redis (if not running)
if ! pgrep -x "redis-server" > /dev/null; then
    echo "Starting Redis..."
    redis-server --daemonize yes
fi

# Start RabbitMQ (if not running)
if ! pgrep -x "beam.smp" > /dev/null; then
    echo "Starting RabbitMQ..."
    sudo systemctl start rabbitmq-server
fi

# Start Inventory Service
echo "Starting Inventory Service..."
cd services/inventory-service
npm run start:prod &
INVENTORY_PID=$!

# Start Shipping Service
echo "Starting Shipping Service..."
cd ../shipping-service
npm run start:prod &
SHIPPING_PID=$!

echo "✅ All services started successfully!"
echo "📊 Inventory Service: http://localhost:3000"
echo "🚚 Shipping Service: http://localhost:3001"
echo ""
echo "To stop services, run: ./stop-system.sh"

# Save PIDs for cleanup
echo $INVENTORY_PID > inventory.pid
echo $SHIPPING_PID > shipping.pid
`;

  fs.writeFileSync('start-system.sh', startupScript);
  execSync('chmod +x start-system.sh');
  console.log('✅ Created start-system.sh');

  // Create stop script
  const stopScript = `#!/bin/bash
# Stop Dried Fruits Inventory Management System

echo "🛑 Stopping Dried Fruits Inventory Management System..."

# Stop services by PID
if [ -f "inventory.pid" ]; then
    kill \$(cat inventory.pid) 2>/dev/null
    rm inventory.pid
    echo "✅ Inventory Service stopped"
fi

if [ -f "shipping.pid" ]; then
    kill \$(cat shipping.pid) 2>/dev/null
    rm shipping.pid
    echo "✅ Shipping Service stopped"
fi

echo "✅ All services stopped"
`;

  fs.writeFileSync('stop-system.sh', stopScript);
  execSync('chmod +x stop-system.sh');
  console.log('✅ Created stop-system.sh');

  // Create backup script
  const backupScript = `#!/bin/bash
# Database Backup Script

BACKUP_DIR="./backups"
TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="dried_fruits_backup_\${TIMESTAMP}.sql"

mkdir -p \$BACKUP_DIR

echo "📥 Creating database backup..."
pg_dump ${config.dbName} > "\$BACKUP_DIR/\$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup created: \$BACKUP_DIR/\$BACKUP_FILE"
    
    # Compress backup
    gzip "\$BACKUP_DIR/\$BACKUP_FILE"
    echo "✅ Backup compressed: \$BACKUP_DIR/\$BACKUP_FILE.gz"
    
    # Clean old backups (keep last 30 days)
    find \$BACKUP_DIR -name "*.gz" -mtime +30 -delete
    echo "✅ Old backups cleaned"
else
    echo "❌ Backup failed"
    exit 1
fi
`;

  fs.writeFileSync('backup-database.sh', backupScript);
  execSync('chmod +x backup-database.sh');
  console.log('✅ Created backup-database.sh');

  // Create health check script
  const healthCheckScript = `#!/bin/bash
# System Health Check Script

echo "🔍 Dried Fruits Inventory Management System Health Check"
echo "======================================================="

# Check database connection
echo "Checking PostgreSQL connection..."
if psql -d ${config.dbName} -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ PostgreSQL: Connected"
else
    echo "❌ PostgreSQL: Connection failed"
fi

# Check Redis connection
echo "Checking Redis connection..."
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: Connected"
else
    echo "❌ Redis: Connection failed"
fi

# Check services
echo "Checking service health..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Inventory Service: Healthy"
else
    echo "❌ Inventory Service: Not responding"
fi

if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Shipping Service: Healthy"
else
    echo "❌ Shipping Service: Not responding"
fi

# Check disk space
echo "Checking disk space..."
DISK_USAGE=\$(df -h . | awk 'NR==2 {print \$5}' | sed 's/%//')
if [ \$DISK_USAGE -lt 90 ]; then
    echo "✅ Disk Space: \${DISK_USAGE}% used"
else
    echo "⚠️  Disk Space: \${DISK_USAGE}% used (warning)"
fi

echo "======================================================="
echo "Health check completed at \$(date)"
`;

  fs.writeFileSync('health-check.sh', healthCheckScript);
  execSync('chmod +x health-check.sh');
  console.log('✅ Created health-check.sh');
}

createManagementScripts();

// Step 6: Create Documentation
console.log('\n📚 Step 6: Creating Documentation...');

function createDocumentation() {
  const readmeContent = `# Dried Fruits Inventory Management System

A comprehensive inventory management system for dried fruits retail operations with multiple branches, real-time monitoring, and advanced analytics.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- PostgreSQL 12+
- Redis 6+
- RabbitMQ 3.8+

### Installation & Setup

1. **Clone and Setup**
   \`\`\`bash
   git clone <repository-url>
   cd fareedadriedfruits-hub-store
   \`\`\`

2. **Run Setup Script**
   \`\`\`bash
   node setup-production-environment.js
   \`\`\`

3. **Start System**
   \`\`\`bash
   ./start-system.sh
   \`\`\`

4. **Access System**
   - Inventory Service: http://localhost:3000
   - Shipping Service: http://localhost:3001
   - API Documentation: http://localhost:3000/api-docs

## 🏗️ System Architecture

### Services
- **Inventory Service** (Port 3000): Core inventory management, sales, alerts, sampling, procurement, reporting
- **Shipping Service** (Port 3001): Delivery tracking, route optimization, driver management

### Databases
- **PostgreSQL**: Primary data storage with comprehensive schemas
- **Redis**: Caching, session storage, real-time data
- **RabbitMQ**: Message queuing for async processing

## 📊 Features

### Core Functionality
- **Multi-Branch Inventory Management**: Real-time stock tracking across 12+ branches
- **Product Management**: 25+ premium dried fruit products with categories
- **Sales Recording**: POS-style sales with discounts, multiple payment methods
- **Barcode System**: Generate and scan product barcodes
- **Repack System**: Combine products into new SKUs

### Advanced Features
- **Low Stock Alerts**: Automated monitoring with multi-channel notifications
- **Sampling Management**: Weight-precise sampling with cost tracking and ROI analysis
- **Procurement System**: Purchase orders with multi-level approval workflow
- **Analytics & Reporting**: Comprehensive business intelligence with caching
- **Real-time Dashboard**: Live KPIs and operational metrics

### Management Features
- **User Management**: Role-based access (Admin, Manager, Staff, Driver)
- **Branch Management**: Multi-location operations support
- **Supplier Management**: Vendor relationship and performance tracking
- **Delivery Management**: Route optimization and tracking

## 🗄️ Database Schema

The system uses 15+ comprehensive database schemas:
- Core entities (branches, products, users)
- Inventory management with movement tracking
- Sales system with detailed analytics
- Advanced features (alerts, sampling, procurement)
- Reporting with materialized views

## 🔧 Management Scripts

- **Start System**: \`./start-system.sh\`
- **Stop System**: \`./stop-system.sh\`
- **Health Check**: \`./health-check.sh\`
- **Database Backup**: \`./backup-database.sh\`

## 📈 Demo Data

The system includes 6 months of realistic historical data:
- **12 Branches**: Different types (premium, shopping center, community, express)
- **25+ Products**: Premium Thai dried fruits with complete details
- **50+ Users**: Complete organizational structure
- **8 Suppliers**: Comprehensive supplier network
- **Historical Transactions**: 6 months of sales, sampling, and procurement data

## 🔐 Authentication

Default login credentials (change in production):
- **Admin**: \`chairman@driedfruits.com\` / \`password123\`
- **Manager**: \`central.mgr@driedfruits.com\` / \`password123\`
- **Staff**: \`staff.spc001.1@driedfruits.com\` / \`password123\`

## 📱 API Endpoints

### Core APIs
- \`GET /api/health\` - Service health check
- \`POST /api/auth/login\` - User authentication
- \`GET /api/inventory/stocks\` - Inventory levels
- \`POST /api/sales\` - Record sales transaction

### Advanced APIs
- \`GET /api/alerts\` - Stock alerts
- \`POST /api/sampling/sessions\` - Record sampling
- \`GET /api/procurement/orders\` - Purchase orders
- \`GET /api/reports/sales-analytics\` - Sales reports

## 🔔 Monitoring & Alerts

- **Health Monitoring**: Service and database health checks
- **Stock Alerts**: Automated low stock notifications
- **Performance Monitoring**: Real-time KPI tracking
- **Error Tracking**: Comprehensive logging system

## 📊 Business Intelligence

### Reports Available
- Sales Analytics by branch/product/time
- Inventory Movement and Turnover
- Branch Performance Comparison
- Product Ranking and Trends
- Sampling ROI Analysis
- Procurement Analysis
- Financial Summary

### Export Formats
- PDF, Excel, CSV, JSON
- Real-time dashboard data
- Chart-ready data formats

## 🚀 Production Deployment

### Environment Variables
Configure \`.env\` files for:
- Database connections
- Redis configuration
- JWT secrets
- Email/SMS providers
- Security settings

### Security Considerations
- Change default passwords
- Configure proper JWT secrets
- Setup SSL/TLS certificates
- Configure firewall rules
- Enable audit logging

### Performance Optimization
- Database indexing configured
- Redis caching implemented
- Materialized views for analytics
- Connection pooling enabled

## 🧪 Testing

### Running Tests
\`\`\`bash
npm test                    # Unit tests
npm run test:integration    # Integration tests
npm run test:e2e           # End-to-end tests
\`\`\`

### Load Testing
\`\`\`bash
npm run test:load          # Performance testing
\`\`\`

## 📞 Support

For technical support or questions:
- Email: support@driedfruits.com
- Documentation: http://localhost:3000/docs
- API Documentation: http://localhost:3000/api-docs

## 📝 License

Copyright © 2024 Fareeda Dried Fruits Hub & Store. All rights reserved.
`;

  fs.writeFileSync('README.md', readmeContent);
  console.log('✅ Created comprehensive README.md');

  // Create API documentation
  const apiDocsContent = `# API Documentation

## Authentication

All API endpoints require authentication except health checks and some public endpoints.

### Login
\`\`\`
POST /api/auth/login
Content-Type: application/json

{
  "email": "chairman@driedfruits.com",
  "password": "password123"
}
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "user": { ... },
    "permissions": [ ... ]
  }
}
\`\`\`

## Core Endpoints

### Health Check
\`\`\`
GET /api/health
\`\`\`

### Inventory Management
\`\`\`
GET /api/inventory/stocks?branchId=uuid&productId=uuid
POST /api/inventory/movements
PUT /api/inventory/stocks/:id
\`\`\`

### Sales
\`\`\`
GET /api/sales?branchId=uuid&dateFrom=date&dateTo=date
POST /api/sales
GET /api/sales/:id
\`\`\`

### Products
\`\`\`
GET /api/products
POST /api/products
PUT /api/products/:id
DELETE /api/products/:id
\`\`\`

### Alerts
\`\`\`
GET /api/alerts
POST /api/alerts/:id/acknowledge
POST /api/alerts/:id/resolve
\`\`\`

### Sampling
\`\`\`
GET /api/sampling/sessions
POST /api/sampling/sessions
POST /api/sampling/records
\`\`\`

### Procurement
\`\`\`
GET /api/procurement/orders
POST /api/procurement/orders
PUT /api/procurement/orders/:id/approve
\`\`\`

### Reports
\`\`\`
GET /api/reports/sales-analytics
GET /api/reports/inventory-movement
GET /api/reports/branch-performance
POST /api/reports/export
\`\`\`

## Error Handling

All endpoints return consistent error responses:

\`\`\`json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error messages"]
}
\`\`\`

## Rate Limiting

API requests are limited to 100 requests per 15 minutes per IP address.
`;

  fs.writeFileSync('API_DOCS.md', apiDocsContent);
  console.log('✅ Created API_DOCS.md');
}

createDocumentation();

// Final Setup Summary
console.log('\n🎉 Setup Complete!');
console.log('==================');
console.log('');
console.log('✅ Environment configured');
console.log('✅ Database setup with realistic demo data');
console.log('✅ Dependencies installed');
console.log('✅ Management scripts created');
console.log('✅ Documentation generated');
console.log('');
console.log('🚀 Next Steps:');
console.log('1. Review and update .env files with your production settings');
console.log('2. Start the system: ./start-system.sh');
console.log('3. Access the system at http://localhost:3000');
console.log('4. Login with: chairman@driedfruits.com / password123');
console.log('5. Run health check: ./health-check.sh');
console.log('');
console.log('📊 System Features Ready:');
console.log('• 12 Branches with different operational profiles');
console.log('• 25+ Premium dried fruit products');
console.log('• 6 months of realistic transaction history');
console.log('• Multi-level user hierarchy (50+ users)');
console.log('• Complete supplier network (8 suppliers)');
console.log('• Real-time stock monitoring and alerts');
console.log('• Sampling management with ROI tracking');
console.log('• Procurement with approval workflows');
console.log('• Comprehensive reporting and analytics');
console.log('');
console.log('📚 Documentation:');
console.log('• README.md - Complete system overview');
console.log('• API_DOCS.md - API endpoint documentation');
console.log('• Management scripts for daily operations');
console.log('');
console.log('🔧 Management Commands:');
console.log('• ./start-system.sh - Start all services');
console.log('• ./stop-system.sh - Stop all services');
console.log('• ./health-check.sh - System health check');
console.log('• ./backup-database.sh - Create database backup');
console.log('');
console.log('Have a great experience with the Dried Fruits Inventory Management System! 🥭');