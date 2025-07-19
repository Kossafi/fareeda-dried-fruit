# Changelog

## [2.0.0] - 2025-07-19

### 🛒 Added - Sales Recording System
- **NEW**: Manual weight input system for disconnected scales
- **NEW**: Sales recording modal with comprehensive form fields
- **NEW**: Real-time total amount calculation
- **NEW**: Product selection dropdown (8 dried fruit varieties)
- **NEW**: Multiple payment methods (cash, card, transfer, QR Code)
- **NEW**: Customer type classification (walk-in, regular, wholesale)
- **NEW**: Optional notes field for transactions
- **NEW**: Session integration with branch system

### 📊 API Endpoints
- `POST /api/sales/record` - Record new sales transactions
- `GET /api/sales/today` - Get today's sales for current branch
- `GET /api/sales/summary` - Get sales analytics (today/week/month/top products)
- `DELETE /api/sales/{sale_id}` - Delete sales records (Admin/Manager only)

### 🗄️ Database
- **NEW**: `sales_records` table with comprehensive fields
- Added foreign key relationships to users, branches, and sessions
- Automatic timestamp tracking for audit trails

### 🎨 UI/UX Improvements
- Touch-friendly modal design for tablet use
- Real-time form validation and error handling
- Responsive design for various screen sizes
- Loading states and user feedback
- Keyboard accessibility (ESC to close modal)

### 📈 Dashboard Enhancements
- Real-time sales data integration
- Updated dashboard to show actual sales figures
- Improved chart stability and responsiveness
- Live data refresh after sales recording

## [1.0.0] - 2025-07-18

### 🏢 Initial Release - Branch Management System
- **Branch Login System**: Multi-branch authentication
- **Daily Session Management**: Branch selection and locking
- **Role-Based Access Control**: Staff, Manager, Admin roles
- **Demo Account System**: 6 pre-configured accounts
- **JWT Authentication**: Secure token-based auth
- **SQLite Database**: Lightweight data storage

### 🔐 Authentication Features
- Secure password hashing with bcrypt
- JWT token management
- Session-based branch selection
- Daily work session locking

### 📊 Dashboard
- Basic sales charts and statistics
- Branch performance monitoring
- Stock level indicators
- Real-time notifications

### 🏬 Branch Management
- 3 demo branches (Central Ladprao, Siam Paragon, EmQuartier)
- Branch-specific access permissions
- Daily session tracking
- Branch switching functionality

### 🔧 Technical Foundation
- FastAPI backend with Python
- SQLite database schema
- HTML/CSS/JavaScript frontend
- Tailwind CSS styling
- Chart.js integration
- Font Awesome icons

### 📱 Responsive Design
- Mobile-friendly interface
- Touch-optimized controls
- Cross-browser compatibility
- Accessibility features

---

## Versioning
This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

## Types of Changes
- 🛒 **Added**: New features
- 📊 **Changed**: Changes in existing functionality  
- 🗑️ **Deprecated**: Soon-to-be removed features
- ❌ **Removed**: Removed features
- 🐛 **Fixed**: Bug fixes
- 🔒 **Security**: Vulnerability fixes