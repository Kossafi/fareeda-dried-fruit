# 🥭 Dried Fruits Inventory Management System

A comprehensive FastAPI-based system for managing dried fruits inventory, sales, shipping, and business analytics.

## 🌟 Features

### 📦 Core Modules
- **Product Management** - Complete product catalog with categories, pricing, and barcodes
- **Inventory Control** - Real-time stock tracking, movements, and automated alerts
- **Sales Recording** - Point-of-sale transactions with customer management
- **Shipping & Delivery** - Fleet management and shipment tracking
- **Analytics & Reports** - Business intelligence and performance metrics
- **Multi-Branch Support** - Centralized management for multiple store locations

### 🔐 Security & Authentication
- JWT-based authentication with role-based access control
- Multiple user roles: Admin, Manager, Sales, Inventory, Delivery
- API rate limiting and request validation
- Secure password hashing with bcrypt

### 📊 Business Intelligence
- Real-time KPI dashboard
- Sales analytics and trend analysis
- Inventory optimization insights
- Customer behavior analysis
- Fleet performance metrics
- Automated report generation

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL 14+
- Redis 6+ (optional, for caching)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd python-fastapi-system
   ```

2. **Install dependencies**
   ```bash
   make install
   # or
   poetry install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Generate demo data**
   ```bash
   make demo-data
   # or
   python scripts/generate_demo_data.py
   ```

5. **Start the server**
   ```bash
   make start
   # or
   python scripts/start_server.py
   ```

6. **Access the application**
   - API Documentation: http://localhost:8000/docs
   - ReDoc Documentation: http://localhost:8000/redoc
   - Health Check: http://localhost:8000/health

## 📋 Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Manager | manager1 | manager123 |
| Sales | user1 | user123 |

## 🛠️ Development

### Available Commands

```bash
make help          # Show available commands
make install       # Install dependencies
make start         # Start the development server
make demo-data     # Generate demo data
make test          # Run system tests
make clean         # Clean up temporary files
```

### Project Structure

```
python-fastapi-system/
├── app/
│   ├── api/            # API endpoints
│   │   ├── v1/
│   │   │   ├── endpoints/
│   │   │   └── api.py
│   │   └── dependencies.py
│   ├── core/           # Core configuration
│   │   ├── config.py
│   │   ├── database.py
│   │   └── security.py
│   ├── crud/           # Database operations
│   ├── models/         # SQLAlchemy models
│   ├── schemas/        # Pydantic schemas
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   └── main.py         # FastAPI application
├── scripts/            # Management scripts
├── tests/              # Test files
├── pyproject.toml      # Dependencies
├── Makefile           # Development commands
└── README.md          # This file
```

### Key Technologies

- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - Database ORM
- **PostgreSQL** - Primary database
- **Redis** - Caching and sessions
- **JWT** - Authentication tokens
- **Pydantic** - Data validation
- **Uvicorn** - ASGI server

## 📊 API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - User logout

### Products
- `GET /api/v1/products/` - List products
- `POST /api/v1/products/` - Create product
- `GET /api/v1/products/{id}` - Get product details
- `PUT /api/v1/products/{id}` - Update product

### Inventory
- `GET /api/v1/inventory/` - List inventory
- `POST /api/v1/inventory/movements` - Record stock movement
- `GET /api/v1/inventory/alerts` - Get stock alerts

### Sales
- `GET /api/v1/customers/` - List customers
- `POST /api/v1/sales/transactions` - Create transaction
- `GET /api/v1/sales/transactions` - List transactions

### Shipping
- `GET /api/v1/fleet/vehicles/` - List vehicles
- `GET /api/v1/fleet/drivers/` - List drivers
- `POST /api/v1/shipping/shipments` - Create shipment

### Analytics
- `GET /api/v1/analytics/dashboard` - KPI dashboard
- `GET /api/v1/analytics/sales` - Sales analytics
- `GET /api/v1/analytics/inventory` - Inventory analytics
- `GET /api/v1/analytics/trends/{metric}` - Trend analysis

## 🧪 Testing

### System Tests
```bash
make test
# or
python scripts/test_system.py
```

### Unit Tests
```bash
pytest tests/
```

### API Testing
Use the interactive API documentation at `/docs` to test endpoints, or use tools like:
- Postman
- curl
- HTTPie

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost/db` |
| `SECRET_KEY` | JWT secret key | Auto-generated |
| `DEBUG` | Enable debug mode | `False` |
| `CORS_ORIGINS` | Allowed CORS origins | `["*"]` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |

### Database Configuration
The system uses PostgreSQL with SQLAlchemy. Tables are created automatically on startup.

## 📈 Analytics & Reports

### Available Analytics
- **Sales Performance** - Revenue, transactions, top products
- **Inventory Health** - Stock levels, movements, alerts
- **Customer Insights** - Behavior, segmentation, retention
- **Fleet Efficiency** - Delivery performance, route optimization
- **Business KPIs** - Growth metrics, trends, forecasts

### Report Formats
- PDF reports with charts
- Excel exports with multiple sheets
- CSV data exports
- JSON API responses

## 🚀 Deployment

### Docker Deployment
```bash
docker build -t dried-fruits-api .
docker run -p 8000:8000 dried-fruits-api
```

### Production Considerations
- Use PostgreSQL for production database
- Configure Redis for caching and sessions
- Set up proper logging and monitoring
- Use environment-specific settings
- Enable SSL/TLS for security
- Set up load balancing for high availability

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run the test suite
6. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the API documentation at `/docs`
- Review the system tests in `scripts/test_system.py`
- Open an issue in the repository

## 🔄 Changelog

### v1.0.0
- Initial release with full feature set
- Complete inventory management system
- Sales and customer management
- Shipping and fleet management
- Comprehensive analytics and reports
- Multi-branch support
- Role-based authentication

---

Made with ❤️ for dried fruits businesses everywhere! 🥭🍇🍊