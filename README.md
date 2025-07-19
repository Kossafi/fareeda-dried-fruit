# 🥭 ระบบจัดการสต๊อคผลไม้อบแห้ง

ระบบจัดการสต๊อคและการขายสำหรับธุรกิจผลไม้อบแห้งที่มีสาขาหลายแห่ง

## ✨ ฟีเจอร์หลัก

- 🏪 ระบบจัดการหลายสาขา
- 📦 จัดการสต๊อคสินค้า
- 🛒 บันทึกการขาย
- 📊 รายงานและวิเคราะห์
- 🚚 ติดตามการจัดส่ง
- 📱 รองรับ Mobile/Tablet

## 🚀 การติดตั้ง

### ใช้ Python (FastAPI)
```bash
pip install -r requirements.txt
python main.py
```

### วิธีการรันระบบ (Alternative)

#### สำหรับ macOS/Linux:
```bash
./start-system.sh
```

#### สำหรับ Windows:
```batch
start-system.bat
```

## 🛑 วิธีหยุดระบบ

### สำหรับ macOS/Linux:
```bash
./stop-system.sh
```

### สำหรับ Windows:
```batch
stop-system.bat
```

## 🌐 URLs และหน้าเว็บ

### หลัก
- **🔐 Branch Login**: http://localhost:8001/branch-login
- **🎯 Branch Selection**: http://localhost:8001/branch-selection  
- **📊 Dashboard**: http://localhost:8001/dashboard
- **🔑 API**: http://localhost:8001/api/

### ระบบต่างๆ
- **📦 จัดการสต๊อค**: http://localhost:8001/inventory
- **💰 ระบบขาย**: http://localhost:8001/sales
- **🚚 ติดตามการจัดส่ง**: http://localhost:8001/delivery
- **📈 รายงาน**: http://localhost:8001/reports
- **🏪 จัดการสาขา**: http://localhost:8001/branch-management

## 👥 Demo Accounts

### พนักงานขาย (Staff)
- **Username**: staff001 / **Password**: 123456
  - สาขา: Central Ladprao, Siam Paragon
- **Username**: staff002 / **Password**: 123456
  - สาขา: Siam Paragon, EmQuartier
- **Username**: staff003 / **Password**: 123456
  - สาขา: EmQuartier

### ผู้จัดการ (Manager)
- **Username**: manager001 / **Password**: 123456
  - สาขา: ทุกสาขา
- **Username**: manager002 / **Password**: 123456
  - สาขา: Siam Paragon, EmQuartier

### ผู้ดูแลระบบ (Admin)
- **Username**: admin / **Password**: admin123
  - สาขา: ทุกสาขา

## 🏢 สาขาที่มี

1. **Central Ladprao** (CLP)
   - ชั้น 3 เซ็นทรัลลาดพร้าว
   
2. **Siam Paragon** (SPG)
   - ชั้น G สยามพารากอน
   
3. **EmQuartier** (EMQ)
   - ชั้น M เอ็มควอเทียร์

## 🎯 วิธีใช้งานระบบบันทึกการขาย

### ขั้นตอนการใช้งาน
1. **เข้าสู่ระบบ**: ไปที่ http://localhost:8001/branch-login
2. **เลือกสาขา**: เลือกสาขาที่ต้องการทำงาน
3. **เข้าแดชบอร์ด**: จะถูกพาไปที่หน้า Dashboard
4. **บันทึกการขาย**: คลิกปุ่ม "บันทึกการขาย" ในแถบเมนู
5. **กรอกข้อมูล**:
   - เลือกสินค้า (มะม่วงอบแห้ง, สับปะรดอบแห้ง, etc.)
   - ชั่งน้ำหนักและกรอกตัวเลข
   - กรอกราคาต่อหน่วย
   - เลือกวิธีการชำระเงิน
   - เพิ่มหมายเหตุ (ถ้ามี)
6. **ยืนยัน**: ระบบจะคำนวณราคารวมและบันทึกข้อมูล

### สินค้าที่รองรับ
- มะม่วงอบแห้ง, สับปะรดอบแห้ง, กล้วยอบแห้ง
- ลำไยอบแห้ง, ทุเรียนอบแห้ง, แอปเปิ้ลอบแห้ง
- ลูกพรุนอบแห้ง, มะขามอบแห้ง

## 📁 โครงสร้างโปรเจค

```
fareedadriedfruits Hub&Store/
├── main.py                 # FastAPI Application (Main Server)
├── requirements.txt        # Python Dependencies  
├── branch_system.db       # SQLite Database
├── web/                   # Frontend Files
│   ├── dashboard.html     # Main Dashboard (with Sales Recording)
│   ├── index.html         # Home Page
│   ├── inventory.html     # Inventory Management
│   ├── sales-reports.html # Sales Reports
│   └── ...               # Other HTML pages
├── frontend/              # React + TypeScript Frontend (Alternative)
├── backend/               # Node.js + Express Backend (Alternative)
├── services/              # Microservices Architecture
│   ├── auth-service/      # Authentication Service
│   ├── inventory-service/ # Inventory Management
│   ├── sales-service/     # Sales Management  
│   └── shipping-service/  # Shipping & Delivery
├── start-system.sh        # macOS/Linux Start Script
├── stop-system.sh         # macOS/Linux Stop Script  
├── start-system.bat       # Windows Start Script
├── stop-system.bat        # Windows Stop Script
└── test_branch_login.py   # Testing Script
```

## 🔧 Technical Stack

### Frontend
- React 18 + TypeScript
- Vite (Build Tool)
- React Router v6
- Tailwind CSS
- Axios
- React Hook Form
- React Hot Toast
- Recharts

### Backend
- Node.js + Express
- TypeScript
- JWT Authentication
- bcrypt (Password Hashing)
- Winston (Logging)
- Socket.IO (Real-time)

## 📋 Features Details

### 🛒 Sales Recording System (NEW!)
- **Manual Weight Input**: ระบบชั่งน้ำหนักแบบ Manual สำหรับสาขาที่ไม่มีเครื่องชั่งเชื่อมต่อ
- **Product Selection**: เลือกสินค้าผลไม้อบแห้ง 8 ชนิด
- **Real-time Calculation**: คำนวณราคารวมแบบ Real-time
- **Payment Methods**: รองรับการชำระเงินหลายรูปแบบ (เงินสด, บัตร, QR Code, โอนเงิน)
- **Customer Types**: แยกประเภทลูกค้า (เดินเข้า, ประจำ, ค้าส่ง)
- **Session Integration**: เชื่อมโยงกับระบบ Branch Session

### 🏢 Branch Management System
- **Branch Selection**: เลือกสาขาประจำวัน
- **Daily Lock**: ล็อคการทำงานประจำวัน
- **Branch Transfer**: ขอย้ายสาขาระหว่างวัน
- **Multi-Branch Support**: รองรับการทำงานหลายสาขา

### 👥 User Management & Security
- **Role-Based Access Control**: 
  - **Staff**: เข้าถึงเฉพาะสาขาที่ได้รับอนุญาต
  - **Manager**: จัดการหลายสาขา
  - **Admin**: เข้าถึงทุกสาขาและฟังก์ชันพิเศษ
- **JWT Authentication**: ระบบ Token-based authentication
- **Password Encryption**: เข้ารหัสรหัสผ่านด้วย bcrypt

### 📊 Dashboard & Analytics
- **Real-time Charts**: กราฟยอดขายและสินค้าขายดี
- **Sales Summary**: สรุปยอดขายรายวัน/สัปดาห์/เดือน
- **Stock Alerts**: แจ้งเตือนสินค้าใกล้หมด
- **Branch Performance**: เปรียบเทียบประสิทธิภาพสาขา
- **Live Updates**: อัปเดตข้อมูลแบบ Real-time

## 🐛 Troubleshooting

### Port ถูกใช้งานอยู่
```bash
# macOS/Linux
lsof -ti:3001 | xargs kill -9
lsof -ti:5001 | xargs kill -9

# Windows
netstat -ano | findstr :3001
taskkill /F /PID <PID>
```

### ติดตั้ง Dependencies ใหม่
```bash
# Frontend
cd frontend && npm install

# Backend
cd backend && npm install
```

## 📝 API Endpoints

### 🔐 Branch Authentication
- `POST /api/branch-auth/login` - Branch login
- `GET /api/branch-auth/me` - Get current user info

### 🏢 Branch Management
- `GET /api/branches/available` - Get user's available branches
- `GET /api/branches/session` - Get current session
- `POST /api/branches/session/select` - Select daily branch
- `POST /api/branches/session/end` - End daily session

### 🛒 Sales Recording (NEW!)
- `POST /api/sales/record` - Record new sale
- `GET /api/sales/today` - Get today's sales for current branch
- `GET /api/sales/summary` - Get sales summary (today/week/month)
- `DELETE /api/sales/{sale_id}` - Delete sale record (Admin/Manager only)

## 🔧 Tech Stack

### Backend (FastAPI + Python)
- **FastAPI**: Modern, fast web framework
- **SQLite**: Lightweight database
- **JWT**: JSON Web Tokens for auth
- **bcrypt**: Password hashing
- **Pydantic**: Data validation
- **uvicorn**: ASGI server

### Frontend (Vanilla HTML/CSS/JS)
- **HTML5**: Modern markup
- **Tailwind CSS**: Utility-first CSS framework
- **Chart.js**: Interactive charts
- **Font Awesome**: Icons
- **Vanilla JavaScript**: No framework dependencies

### Database Schema
- **users**: User accounts and permissions
- **branches**: Branch information
- **daily_sessions**: Daily work sessions
- **sales_records**: Sales transaction records