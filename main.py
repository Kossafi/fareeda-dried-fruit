from fastapi import FastAPI, Request, HTTPException, Depends, status
import time
from fastapi.responses import HTMLResponse, FileResponse, Response, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn
import os
import jwt
import bcrypt
import sqlite3
import json
from datetime import datetime, timedelta
from typing import Optional, List
from pathlib import Path

app = FastAPI(title="ระบบจัดการสต๊อคผลไม้อบแห้ง", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
if os.path.exists("web"):
    app.mount("/static", StaticFiles(directory="web"), name="static")

# =========================================
# BRANCH LOGIN SYSTEM
# =========================================

# Configuration
JWT_SECRET = "your-secret-key-change-in-production-branch-login"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DELTA = timedelta(days=7)

# Security
security = HTTPBearer()

# Database initialization
DB_PATH = "branch_system.db"

def init_database():
    """Initialize SQLite database for branch login system"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            employee_id TEXT UNIQUE NOT NULL,
            email TEXT,
            phone TEXT,
            role TEXT NOT NULL,
            allowed_branches TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            avatar TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Branches table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS branches (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            manager_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Daily sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS daily_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            branch_id TEXT NOT NULL,
            branch_name TEXT NOT NULL,
            session_date DATE NOT NULL,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            is_locked BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (branch_id) REFERENCES branches (id)
        )
    ''')
    
    # Sales records table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sales_records (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            branch_id TEXT NOT NULL,
            branch_name TEXT NOT NULL,
            session_id TEXT,
            product_name TEXT NOT NULL,
            quantity DECIMAL(10,3) NOT NULL,
            unit TEXT NOT NULL DEFAULT 'กิโลกรัม',
            unit_price DECIMAL(10,2) NOT NULL,
            total_amount DECIMAL(10,2) NOT NULL,
            customer_type TEXT DEFAULT 'walk-in',
            payment_method TEXT DEFAULT 'cash',
            notes TEXT,
            sale_date DATE NOT NULL,
            sale_time TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (branch_id) REFERENCES branches (id),
            FOREIGN KEY (session_id) REFERENCES daily_sessions (id)
        )
    ''')
    
    # Insert demo data if not exists
    cursor.execute("SELECT COUNT(*) FROM branches")
    if cursor.fetchone()[0] == 0:
        demo_branches = [
            ('branch-central-ladprao', 'CLP', 'Central Ladprao', 'ชั้น 3 เซ็นทรัลลาดพร้าว'),
            ('branch-siam-paragon', 'SPG', 'Siam Paragon', 'ชั้น G สยามพารากอน'),
            ('branch-emquartier', 'EMQ', 'EmQuartier', 'ชั้น M เอ็มควอเทียร์'),
        ]
        cursor.executemany(
            "INSERT INTO branches (id, code, name, location) VALUES (?, ?, ?, ?)",
            demo_branches
        )
    
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        # Hash passwords
        def hash_password(password: str) -> str:
            return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        demo_users = [
            ('emp-001', 'staff001', hash_password('123456'), 'สมใจ', 'ใจดี', 'EMP001', 
             'somjai@example.com', '081-234-5678', 'STAFF', 
             '["branch-central-ladprao", "branch-siam-paragon"]', True, '👩'),
            ('emp-002', 'staff002', hash_password('123456'), 'มานะ', 'ขยัน', 'EMP002',
             'mana@example.com', '082-345-6789', 'STAFF',
             '["branch-siam-paragon", "branch-emquartier"]', True, '👨'),
            ('emp-003', 'staff003', hash_password('123456'), 'สุภา', 'รักงาน', 'EMP003',
             'supa@example.com', '083-456-7890', 'STAFF',
             '["branch-emquartier"]', True, '👩'),
            ('emp-004', 'manager001', hash_password('123456'), 'วิชัย', 'จัดการดี', 'MGR001',
             'wichai@example.com', '084-567-8901', 'MANAGER',
             '["branch-central-ladprao", "branch-siam-paragon", "branch-emquartier"]', True, '👨‍💼'),
            ('emp-005', 'manager002', hash_password('123456'), 'ปราณี', 'ผู้นำทีม', 'MGR002',
             'pranee@example.com', '085-678-9012', 'MANAGER',
             '["branch-siam-paragon", "branch-emquartier"]', True, '👩‍💼'),
            ('emp-006', 'admin', hash_password('admin123'), 'ธนา', 'ผู้ดูแล', 'ADM001',
             'admin@example.com', '086-789-0123', 'ADMIN',
             '["branch-central-ladprao", "branch-siam-paragon", "branch-emquartier"]', True, '👤'),
        ]
        cursor.executemany(
            """INSERT INTO users (id, username, password_hash, first_name, last_name, 
               employee_id, email, phone, role, allowed_branches, is_active, avatar) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            demo_users
        )
    
    conn.commit()
    conn.close()

# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    user: dict
    token: str
    needsBranchSelection: Optional[bool] = False

class BranchSelectionRequest(BaseModel):
    branchId: str

class SessionResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    message: Optional[str] = None

class SalesRecordRequest(BaseModel):
    productName: str
    quantity: float
    unit: str = "กิโลกรัม"
    unitPrice: float
    customerType: str = "walk-in"
    paymentMethod: str = "cash"
    notes: Optional[str] = None

class SalesRecord(BaseModel):
    id: str
    userId: str
    branchId: str
    branchName: str
    sessionId: Optional[str]
    productName: str
    quantity: float
    unit: str
    unitPrice: float
    totalAmount: float
    customerType: str
    paymentMethod: str
    notes: Optional[str]
    saleDate: str
    saleTime: str
    createdAt: str

class User(BaseModel):
    id: str
    username: str
    firstName: str
    lastName: str
    employeeId: str
    email: Optional[str]
    phone: Optional[str]
    role: str
    allowedBranches: List[str]
    isActive: bool
    avatar: Optional[str]
    createdAt: str
    updatedAt: str

class Branch(BaseModel):
    id: str
    code: str
    name: str
    location: str
    isActive: bool
    managerId: Optional[str]
    createdAt: str
    updatedAt: str

# Utility functions
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + JWT_EXPIRATION_DELTA
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_user_by_username(username: str) -> Optional[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def get_user_branches(user_id: str) -> List[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get user's allowed branches
    cursor.execute("SELECT allowed_branches FROM users WHERE id = ?", (user_id,))
    user_result = cursor.fetchone()
    if not user_result:
        conn.close()
        return []
    
    allowed_branch_ids = json.loads(user_result['allowed_branches'])
    
    # Get branch details
    placeholders = ','.join('?' * len(allowed_branch_ids))
    cursor.execute(f"SELECT * FROM branches WHERE id IN ({placeholders}) AND is_active = TRUE", 
                   allowed_branch_ids)
    branches = cursor.fetchall()
    conn.close()
    
    return [dict(branch) for branch in branches]

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = get_user_by_username(username)
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Initialize database
init_database()

# Branch Login API Endpoints
@app.post("/api/branch-auth/login")
async def branch_login(login_data: LoginRequest):
    """Branch login endpoint"""
    try:
        user = get_user_by_username(login_data.username)
        if not user or not verify_password(login_data.password, user['password_hash']):
            raise HTTPException(status_code=401, detail="ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
        
        if not user['is_active']:
            raise HTTPException(status_code=403, detail="บัญชีผู้ใช้ถูกระงับ")
        
        # Create access token
        access_token = create_access_token(data={"sub": user['username']})
        
        # Get user branches
        user_branches = get_user_branches(user['id'])
        
        # Prepare user data
        user_data = {
            "id": user['id'],
            "username": user['username'],
            "firstName": user['first_name'],
            "lastName": user['last_name'],
            "employeeId": user['employee_id'],
            "email": user['email'],
            "phone": user['phone'],
            "role": user['role'],
            "allowedBranches": json.loads(user['allowed_branches']),
            "isActive": user['is_active'],
            "avatar": user['avatar'],
            "createdAt": user['created_at'],
            "updatedAt": user['updated_at']
        }
        
        return {
            "success": True,
            "data": {
                "user": user_data,
                "token": access_token,
                "needsBranchSelection": len(user_branches) > 0
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในระบบ: {str(e)}")

@app.get("/api/branch-auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    user_branches = get_user_branches(current_user['id'])
    user_data = {
        "id": current_user['id'],
        "username": current_user['username'],
        "firstName": current_user['first_name'],
        "lastName": current_user['last_name'],
        "employeeId": current_user['employee_id'],
        "email": current_user['email'],
        "phone": current_user['phone'],
        "role": current_user['role'],
        "allowedBranches": json.loads(current_user['allowed_branches']),
        "isActive": current_user['is_active'],
        "avatar": current_user['avatar'],
        "createdAt": current_user['created_at'],
        "updatedAt": current_user['updated_at']
    }
    
    return {
        "success": True,
        "data": user_data
    }

@app.get("/api/branches/available")
async def get_available_branches(current_user: dict = Depends(get_current_user)):
    """Get user's available branches"""
    branches = get_user_branches(current_user['id'])
    return {
        "success": True,
        "data": branches
    }

@app.post("/api/branches/session/select")
async def select_daily_branch(branch_data: BranchSelectionRequest, current_user: dict = Depends(get_current_user)):
    """Select daily branch for work session"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if user has access to this branch
        allowed_branches = json.loads(current_user['allowed_branches'])
        if branch_data.branchId not in allowed_branches:
            raise HTTPException(status_code=403, detail="คุณไม่มีสิทธิ์เข้าถึงสาขานี้")
        
        # Get branch info
        cursor.execute("SELECT * FROM branches WHERE id = ?", (branch_data.branchId,))
        branch = cursor.fetchone()
        if not branch:
            raise HTTPException(status_code=404, detail="ไม่พบสาขาที่เลือก")
        
        # Check if user already has session today
        today = datetime.now().date()
        cursor.execute("""
            SELECT * FROM daily_sessions 
            WHERE user_id = ? AND session_date = ? AND is_locked = TRUE
        """, (current_user['id'], today))
        existing_session = cursor.fetchone()
        
        if existing_session:
            raise HTTPException(status_code=400, detail="คุณได้เลือกสาขาสำหรับวันนี้แล้ว")
        
        # Create new session
        session_id = f"session_{current_user['id']}_{int(datetime.now().timestamp())}"
        now = datetime.now()
        
        cursor.execute("""
            INSERT INTO daily_sessions (id, user_id, branch_id, branch_name, session_date, start_time, is_locked)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (session_id, current_user['id'], branch_data.branchId, branch[2], today, now, True))
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "data": {
                "id": session_id,
                "userId": current_user['id'],
                "branchId": branch_data.branchId,
                "branchName": branch[2],
                "sessionDate": today.isoformat(),
                "startTime": now.isoformat(),
                "isLocked": True
            },
            "message": f"เริ่มงานที่ {branch[2]} เรียบร้อยแล้ว"
        }
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในระบบ: {str(e)}")

@app.get("/api/branches/session")
async def get_current_session(current_user: dict = Depends(get_current_user)):
    """Get current daily session"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        today = datetime.now().date()
        cursor.execute("""
            SELECT * FROM daily_sessions 
            WHERE user_id = ? AND session_date = ? AND is_locked = TRUE
        """, (current_user['id'], today))
        
        session = cursor.fetchone()
        conn.close()
        
        if not session:
            raise HTTPException(status_code=404, detail="ไม่พบข้อมูลการทำงานสำหรับวันนี้")
        
        return {
            "success": True,
            "data": dict(session)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในระบบ: {str(e)}")

@app.post("/api/branches/session/end")
async def end_daily_session(current_user: dict = Depends(get_current_user)):
    """End daily work session"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        today = datetime.now().date()
        now = datetime.now()
        
        cursor.execute("""
            UPDATE daily_sessions 
            SET end_time = ?, is_locked = FALSE 
            WHERE user_id = ? AND session_date = ? AND is_locked = TRUE
        """, (now, current_user['id'], today))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="ไม่พบข้อมูลการทำงานสำหรับวันนี้")
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": "สิ้นสุดวันทำงานเรียบร้อยแล้ว"
        }
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในระบบ: {str(e)}")

# =========================================
# SALES RECORDING API ENDPOINTS
# =========================================

@app.post("/api/sales/record")
async def record_sale(sale_data: SalesRecordRequest, current_user: dict = Depends(get_current_user)):
    """Record a new sale"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get current session
        today = datetime.now().date()
        cursor.execute("""
            SELECT * FROM daily_sessions 
            WHERE user_id = ? AND session_date = ? AND is_locked = TRUE
        """, (current_user['id'], today))
        session = cursor.fetchone()
        
        if not session:
            raise HTTPException(status_code=400, detail="ไม่พบข้อมูลการทำงานสำหรับวันนี้ กรุณาเลือกสาขาก่อน")
        
        session_id, user_id, branch_id, branch_name = session[0], session[1], session[2], session[3]
        
        # Calculate total amount
        total_amount = sale_data.quantity * sale_data.unitPrice
        
        # Generate sale record ID
        now = datetime.now()
        sale_id = f"sale_{branch_id}_{int(now.timestamp())}"
        
        # Insert sale record
        cursor.execute("""
            INSERT INTO sales_records (
                id, user_id, branch_id, branch_name, session_id,
                product_name, quantity, unit, unit_price, total_amount,
                customer_type, payment_method, notes,
                sale_date, sale_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            sale_id, user_id, branch_id, branch_name, session_id,
            sale_data.productName, sale_data.quantity, sale_data.unit, 
            sale_data.unitPrice, total_amount, sale_data.customerType,
            sale_data.paymentMethod, sale_data.notes, today, now
        ))
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "data": {
                "id": sale_id,
                "totalAmount": total_amount,
                "branchName": branch_name,
                "saleTime": now.isoformat()
            },
            "message": f"บันทึกการขาย {sale_data.productName} เรียบร้อยแล้ว"
        }
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการบันทึกการขาย: {str(e)}")

@app.get("/api/sales/today")
async def get_today_sales(current_user: dict = Depends(get_current_user)):
    """Get today's sales for current user's branch"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get current session
        today = datetime.now().date()
        cursor.execute("""
            SELECT * FROM daily_sessions 
            WHERE user_id = ? AND session_date = ? AND is_locked = TRUE
        """, (current_user['id'], today))
        session = cursor.fetchone()
        
        if not session:
            return {
                "success": True,
                "data": {
                    "sales": [],
                    "summary": {
                        "totalAmount": 0,
                        "totalTransactions": 0,
                        "averageTransaction": 0
                    }
                }
            }
        
        branch_id = session['branch_id']
        
        # Get today's sales for this branch
        cursor.execute("""
            SELECT * FROM sales_records 
            WHERE branch_id = ? AND sale_date = ?
            ORDER BY sale_time DESC
        """, (branch_id, today))
        
        sales = [dict(row) for row in cursor.fetchall()]
        
        # Calculate summary
        total_amount = sum(sale['total_amount'] for sale in sales)
        total_transactions = len(sales)
        average_transaction = total_amount / total_transactions if total_transactions > 0 else 0
        
        conn.close()
        
        return {
            "success": True,
            "data": {
                "sales": sales,
                "summary": {
                    "totalAmount": total_amount,
                    "totalTransactions": total_transactions,
                    "averageTransaction": average_transaction
                }
            }
        }
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการดึงข้อมูลการขาย: {str(e)}")

@app.get("/api/sales/summary")
async def get_sales_summary(current_user: dict = Depends(get_current_user)):
    """Get sales summary for current user's branch"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get current session
        today = datetime.now().date()
        cursor.execute("""
            SELECT * FROM daily_sessions 
            WHERE user_id = ? AND session_date = ? AND is_locked = TRUE
        """, (current_user['id'], today))
        session = cursor.fetchone()
        
        if not session:
            return {
                "success": True,
                "data": {
                    "todaySales": 0,
                    "weekSales": 0,
                    "monthSales": 0,
                    "topProducts": []
                }
            }
        
        branch_id = session['branch_id']
        
        # Today's sales
        cursor.execute("""
            SELECT COALESCE(SUM(total_amount), 0) as total
            FROM sales_records 
            WHERE branch_id = ? AND sale_date = ?
        """, (branch_id, today))
        today_sales = cursor.fetchone()['total']
        
        # This week's sales (last 7 days)
        week_ago = today - timedelta(days=7)
        cursor.execute("""
            SELECT COALESCE(SUM(total_amount), 0) as total
            FROM sales_records 
            WHERE branch_id = ? AND sale_date >= ?
        """, (branch_id, week_ago))
        week_sales = cursor.fetchone()['total']
        
        # This month's sales (last 30 days)
        month_ago = today - timedelta(days=30)
        cursor.execute("""
            SELECT COALESCE(SUM(total_amount), 0) as total
            FROM sales_records 
            WHERE branch_id = ? AND sale_date >= ?
        """, (branch_id, month_ago))
        month_sales = cursor.fetchone()['total']
        
        # Top products this week
        cursor.execute("""
            SELECT product_name, 
                   SUM(quantity) as total_quantity,
                   SUM(total_amount) as total_amount,
                   COUNT(*) as transaction_count
            FROM sales_records 
            WHERE branch_id = ? AND sale_date >= ?
            GROUP BY product_name
            ORDER BY total_amount DESC
            LIMIT 5
        """, (branch_id, week_ago))
        top_products = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        return {
            "success": True,
            "data": {
                "todaySales": today_sales,
                "weekSales": week_sales,
                "monthSales": month_sales,
                "topProducts": top_products
            }
        }
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการดึงข้อมูลสรุปการขาย: {str(e)}")

@app.delete("/api/sales/{sale_id}")
async def delete_sale(sale_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a sale record (admin/manager only)"""
    try:
        # Check permissions
        if current_user['role'] not in ['ADMIN', 'MANAGER']:
            raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์ลบรายการขาย")
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if sale exists and belongs to user's accessible branches
        allowed_branches = json.loads(current_user['allowed_branches'])
        cursor.execute("""
            SELECT * FROM sales_records 
            WHERE id = ? AND branch_id IN ({})
        """.format(','.join('?' * len(allowed_branches))), [sale_id] + allowed_branches)
        
        sale = cursor.fetchone()
        if not sale:
            raise HTTPException(status_code=404, detail="ไม่พบรายการขายที่ต้องการลบ")
        
        # Delete the sale
        cursor.execute("DELETE FROM sales_records WHERE id = ?", (sale_id,))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="ไม่พบรายการขายที่ต้องการลบ")
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": "ลบรายการขายเรียบร้อยแล้ว"
        }
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการลบรายการขาย: {str(e)}")

# Branch Login Frontend Routes
@app.get("/branch-login", response_class=HTMLResponse)
async def branch_login_page():
    """Branch login page"""
    return HTMLResponse(content="""
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Branch Login - ระบบจัดการสต๊อคผลไม้อบแห้ง</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap');
            body { font-family: 'Kanit', sans-serif; }
        </style>
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div class="container mx-auto px-4 py-8">
            <div class="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8">
                <div class="text-center mb-8">
                    <div class="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <span class="text-2xl text-white">🏢</span>
                    </div>
                    <h1 class="text-2xl font-bold text-gray-900 mb-2">Branch Login</h1>
                    <p class="text-gray-600">ระบบจัดการสต๊อคผลไม้อบแห้ง</p>
                </div>
                
                <div id="error-alert" class="hidden mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p class="text-red-700 text-sm" id="error-message"></p>
                </div>
                
                <form id="login-form" class="space-y-6">
                    <div>
                        <label for="username" class="block text-sm font-medium text-gray-700 mb-2">ชื่อผู้ใช้</label>
                        <input type="text" id="username" name="username" required
                               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                               placeholder="กรอกชื่อผู้ใช้">
                    </div>
                    
                    <div>
                        <label for="password" class="block text-sm font-medium text-gray-700 mb-2">รหัสผ่าน</label>
                        <input type="password" id="password" name="password" required
                               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                               placeholder="กรอกรหัสผ่าน">
                    </div>
                    
                    <button type="submit" id="login-btn"
                            class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200">
                        เข้าสู่ระบบ
                    </button>
                </form>
                
                <div class="mt-8 pt-6 border-t border-gray-200">
                    <h3 class="text-sm font-medium text-gray-700 mb-3">Demo Accounts:</h3>
                    <div class="space-y-2 text-xs text-gray-600">
                        <div class="bg-gray-50 p-2 rounded">
                            <strong>Admin:</strong> admin / admin123
                        </div>
                        <div class="bg-gray-50 p-2 rounded">
                            <strong>Manager:</strong> manager001 / 123456
                        </div>
                        <div class="bg-gray-50 p-2 rounded">
                            <strong>Staff:</strong> staff001 / 123456
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <script>
            // Clear any existing session on page load
            localStorage.removeItem('branch_token');
            localStorage.removeItem('branch_user');
            localStorage.removeItem('branch_session');
            
            document.getElementById('login-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                const errorAlert = document.getElementById('error-alert');
                const errorMessage = document.getElementById('error-message');
                const loginBtn = document.getElementById('login-btn');
                
                // Hide error alert
                errorAlert.classList.add('hidden');
                
                // Show loading
                loginBtn.textContent = 'กำลังเข้าสู่ระบบ...';
                loginBtn.disabled = true;
                
                try {
                    const response = await fetch('/api/branch-auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ username, password })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Store token
                        localStorage.setItem('branch_token', data.data.token);
                        localStorage.setItem('branch_user', JSON.stringify(data.data.user));
                        
                        // Redirect to branch selection or dashboard
                        if (data.data.needsBranchSelection) {
                            window.location.href = '/branch-selection';
                        } else {
                            window.location.href = '/dashboard';
                        }
                    } else {
                        throw new Error(data.detail || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
                    }
                } catch (error) {
                    errorMessage.textContent = error.message;
                    errorAlert.classList.remove('hidden');
                } finally {
                    loginBtn.textContent = 'เข้าสู่ระบบ';
                    loginBtn.disabled = false;
                }
            });
        </script>
    </body>
    </html>
    """)

@app.get("/branch-selection", response_class=HTMLResponse)
async def branch_selection_page():
    """Branch selection page"""
    return HTMLResponse(content="""
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>เลือกสาขา - ระบบจัดการสต๊อคผลไม้อบแห้ง</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap');
            body { font-family: 'Kanit', sans-serif; }
        </style>
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div class="container mx-auto px-4 py-8">
            <div class="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
                <div class="text-center mb-8">
                    <div class="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <span class="text-2xl text-white">🏢</span>
                    </div>
                    <h1 class="text-2xl font-bold text-gray-900 mb-2">เลือกสาขาประจำวัน</h1>
                    <p class="text-gray-600">เลือกสาขาที่ต้องการทำงานในวันนี้</p>
                </div>
                
                <div id="user-info" class="mb-6 p-4 bg-blue-50 rounded-lg">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-lg" id="user-avatar">👤</div>
                        <div>
                            <h3 class="font-semibold text-gray-900" id="user-name">กำลังโหลด...</h3>
                            <p class="text-sm text-gray-600" id="user-role">กำลังโหลด...</p>
                        </div>
                    </div>
                </div>
                
                <div id="error-alert" class="hidden mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p class="text-red-700 text-sm" id="error-message"></p>
                </div>
                
                <div id="loading" class="text-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p class="mt-2 text-gray-600">กำลังโหลดข้อมูลสาขา...</p>
                </div>
                
                <div id="branches-container" class="hidden space-y-4">
                    <div id="branches-list"></div>
                    
                    <button id="confirm-btn" disabled
                            class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed">
                        เริ่มงานที่สาขานี้
                    </button>
                </div>
                
                <div class="text-center mt-6 space-y-2">
                    <button id="clear-session-btn" class="w-full text-orange-600 hover:text-orange-800 text-sm border border-orange-300 rounded-lg py-2 px-4 hover:bg-orange-50 transition duration-200">
                        ล้างข้อมูลการทำงานวันนี้ (เลือกสาขาใหม่)
                    </button>
                    <button id="logout-btn" class="text-gray-600 hover:text-gray-800 text-sm">
                        ออกจากระบบ
                    </button>
                </div>
            </div>
        </div>
        
        <script>
            let selectedBranchId = null;
            let currentUser = null;
            
            // Check authentication
            const token = localStorage.getItem('branch_token');
            const userStr = localStorage.getItem('branch_user');
            
            if (!token || !userStr) {
                window.location.href = '/branch-login';
            }
            
            currentUser = JSON.parse(userStr);
            
            // Update user info
            document.getElementById('user-avatar').textContent = currentUser.avatar || '👤';
            document.getElementById('user-name').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
            document.getElementById('user-role').textContent = getRoleDisplay(currentUser.role);
            
            function getRoleDisplay(role) {
                switch(role) {
                    case 'ADMIN': return 'ผู้ดูแลระบบ';
                    case 'MANAGER': return 'ผู้จัดการ';
                    case 'STAFF': return 'พนักงาน';
                    default: return role;
                }
            }
            
            // Load branches
            async function loadBranches() {
                try {
                    const response = await fetch('/api/branches/available', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        displayBranches(data.data);
                    } else {
                        throw new Error('ไม่สามารถโหลดข้อมูลสาขาได้');
                    }
                } catch (error) {
                    showError(error.message);
                }
            }
            
            function displayBranches(branches) {
                const container = document.getElementById('branches-list');
                const loading = document.getElementById('loading');
                const branchesContainer = document.getElementById('branches-container');
                
                container.innerHTML = '';
                
                branches.forEach(branch => {
                    const branchCard = document.createElement('div');
                    branchCard.className = 'border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors duration-200';
                    branchCard.innerHTML = `
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="font-semibold text-gray-900">${branch.name}</h3>
                                <p class="text-sm text-gray-600">${branch.location}</p>
                                <p class="text-xs text-blue-600 font-medium">รหัส: ${branch.code}</p>
                            </div>
                            <div class="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
                        </div>
                    `;
                    
                    branchCard.addEventListener('click', () => selectBranch(branch.id, branchCard));
                    container.appendChild(branchCard);
                });
                
                loading.classList.add('hidden');
                branchesContainer.classList.remove('hidden');
            }
            
            function selectBranch(branchId, cardElement) {
                // Clear previous selection
                document.querySelectorAll('#branches-list > div').forEach(card => {
                    card.classList.remove('border-blue-500', 'bg-blue-50');
                    card.classList.add('border-gray-200');
                    const radio = card.querySelector('.w-6.h-6');
                    radio.classList.remove('bg-blue-600', 'border-blue-600');
                    radio.classList.add('border-gray-300');
                    radio.innerHTML = '';
                });
                
                // Select new branch
                selectedBranchId = branchId;
                cardElement.classList.remove('border-gray-200');
                cardElement.classList.add('border-blue-500', 'bg-blue-50');
                const radio = cardElement.querySelector('.w-6.h-6');
                radio.classList.remove('border-gray-300');
                radio.classList.add('bg-blue-600', 'border-blue-600');
                radio.innerHTML = '<div class="w-2 h-2 bg-white rounded-full m-auto mt-1"></div>';
                
                document.getElementById('confirm-btn').disabled = false;
            }
            
            function showError(message) {
                const errorAlert = document.getElementById('error-alert');
                const errorMessage = document.getElementById('error-message');
                
                errorMessage.textContent = message;
                errorAlert.classList.remove('hidden');
            }
            
            // Confirm branch selection
            document.getElementById('confirm-btn').addEventListener('click', async () => {
                if (!selectedBranchId) return;
                
                const confirmBtn = document.getElementById('confirm-btn');
                confirmBtn.textContent = 'กำลังดำเนินการ...';
                confirmBtn.disabled = true;
                
                try {
                    const response = await fetch('/api/branches/session/select', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ branchId: selectedBranchId })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        localStorage.setItem('branch_session', JSON.stringify(data.data));
                        alert(data.message);
                        window.location.href = '/dashboard';
                    } else {
                        throw new Error(data.detail || 'เกิดข้อผิดพลาดในการเลือกสาขา');
                    }
                } catch (error) {
                    showError(error.message);
                    confirmBtn.textContent = 'เริ่มงานที่สาขานี้';
                    confirmBtn.disabled = false;
                }
            });
            
            // Clear daily session (allows reselecting branch)
            document.getElementById('clear-session-btn').addEventListener('click', async () => {
                if (!confirm('คุณต้องการล้างข้อมูลการทำงานวันนี้และเลือกสาขาใหม่หรือไม่?')) {
                    return;
                }
                
                try {
                    // Call API to end current session
                    const response = await fetch('/api/branches/session/end', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    // Clear local session data
                    localStorage.removeItem('branch_session');
                    
                    // Reload page to allow branch reselection
                    window.location.reload();
                } catch (error) {
                    console.error('Error clearing session:', error);
                    // Even if API fails, clear local data and reload
                    localStorage.removeItem('branch_session');
                    window.location.reload();
                }
            });
            
            // Logout
            document.getElementById('logout-btn').addEventListener('click', () => {
                if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
                    localStorage.removeItem('branch_token');
                    localStorage.removeItem('branch_user');
                    localStorage.removeItem('branch_session');
                    window.location.href = '/branch-login';
                }
            });
            
            // Check if user already has a session today
            async function checkExistingSession() {
                try {
                    const response = await fetch('/api/branches/session', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (response.status === 200) {
                        const data = await response.json();
                        if (data.success) {
                            // User already has a session
                            const session = data.data;
                            showExistingSession(session);
                            return true;
                        }
                    }
                    return false;
                } catch (error) {
                    console.log('No existing session found');
                    return false;
                }
            }
            
            function showExistingSession(session) {
                const loading = document.getElementById('loading');
                const branchesContainer = document.getElementById('branches-container');
                const branchesList = document.getElementById('branches-list');
                const confirmBtn = document.getElementById('confirm-btn');
                
                loading.classList.add('hidden');
                branchesContainer.classList.remove('hidden');
                
                branchesList.innerHTML = `
                    <div class="border-2 border-green-500 bg-green-50 rounded-lg p-6 text-center">
                        <div class="text-green-600 mb-4">
                            <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-semibold text-green-800 mb-2">✅ คุณได้เลือกสาขาแล้ว</h3>
                        <p class="text-green-700 mb-1"><strong>สาขา:</strong> ${session.branch_name}</p>
                        <p class="text-green-700 mb-1"><strong>เริ่มงานเมื่อ:</strong> ${new Date(session.start_time).toLocaleTimeString('th-TH')}</p>
                        <p class="text-green-700 mb-4"><strong>สถานะ:</strong> ${session.is_locked ? 'กำลังทำงาน' : 'สิ้นสุดแล้ว'}</p>
                        <button onclick="window.location.href='/dashboard'" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                            ไปยังแดชบอร์ด
                        </button>
                    </div>
                `;
                
                confirmBtn.style.display = 'none';
            }
            
            // Load branches or show existing session
            async function initializePage() {
                const hasSession = await checkExistingSession();
                if (!hasSession) {
                    loadBranches();
                }
            }
            
            // Initialize page
            initializePage();
        </script>
    </body>
    </html>
    """)

# =========================================
# END BRANCH LOGIN SYSTEM
# =========================================

# Routes
@app.get("/", response_class=HTMLResponse)
async def home():
    try:
        with open("web/index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="""
        <html>
            <head><title>ระบบจัดการสต๊อคผลไม้อบแห้ง</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>🥭 ระบบจัดการสต๊อคผลไม้อบแห้ง</h1>
                <p>ระบบกำลังเริ่มต้น...</p>
                <p><a href="/dashboard">ไปยังแดชบอร์ด</a></p>
            </body>
        </html>
        """)

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    try:
        with open("web/dashboard.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Dashboard - กำลังพัฒนา</h1>")

@app.get("/inventory", response_class=HTMLResponse)
async def inventory():
    try:
        with open("web/inventory.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Inventory - กำลังพัฒนา</h1>")

@app.get("/sales", response_class=HTMLResponse)
async def sales():
    return HTMLResponse(content="""
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ระบบขาย (POS)</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            .gradient-bg { background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%); }
        </style>
    </head>
    <body class="bg-gradient-to-br from-yellow-50 to-orange-50 min-h-screen">
        <nav class="gradient-bg shadow-lg">
            <div class="container mx-auto px-4">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-white hover:text-yellow-200"><i class="fas fa-home text-xl"></i></a>
                        <h1 class="text-white text-xl font-bold">ระบบขาย (POS)</h1>
                    </div>
                </div>
            </div>
        </nav>
        <div class="container mx-auto px-4 py-8">
            <div class="bg-white rounded-xl shadow-lg p-8 text-center">
                <i class="fas fa-cash-register text-6xl text-orange-500 mb-4"></i>
                <h2 class="text-3xl font-bold text-gray-800 mb-4">ระบบขาย (POS)</h2>
                <p class="text-gray-600 mb-6">ระบบขายสำหรับบันทึกการขายผลไม้อบแห้ง</p>
                <div class="text-orange-500 text-lg">🚧 กำลังพัฒนา...</div>
            </div>
        </div>
    </body>
    </html>
    """)

@app.get("/delivery", response_class=HTMLResponse)
async def delivery():
    return HTMLResponse(content="""
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ติดตามการจัดส่ง</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            .gradient-bg { background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%); }
        </style>
    </head>
    <body class="bg-gradient-to-br from-yellow-50 to-orange-50 min-h-screen">
        <nav class="gradient-bg shadow-lg">
            <div class="container mx-auto px-4">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-white hover:text-yellow-200"><i class="fas fa-home text-xl"></i></a>
                        <h1 class="text-white text-xl font-bold">ติดตามการจัดส่ง</h1>
                    </div>
                </div>
            </div>
        </nav>
        <div class="container mx-auto px-4 py-8">
            <div class="bg-white rounded-xl shadow-lg p-8 text-center">
                <i class="fas fa-truck text-6xl text-orange-500 mb-4"></i>
                <h2 class="text-3xl font-bold text-gray-800 mb-4">ติดตามการจัดส่ง</h2>
                <p class="text-gray-600 mb-6">ระบบติดตามการจัดส่งสินค้าไปยังสาขาต่างๆ</p>
                <div class="text-orange-500 text-lg">🚧 กำลังพัฒนา...</div>
            </div>
        </div>
    </body>
    </html>
    """)

@app.get("/reports", response_class=HTMLResponse)
async def reports():
    return HTMLResponse(content="""
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>รายงานและวิเคราะห์</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            .gradient-bg { background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%); }
        </style>
    </head>
    <body class="bg-gradient-to-br from-yellow-50 to-orange-50 min-h-screen">
        <nav class="gradient-bg shadow-lg">
            <div class="container mx-auto px-4">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-white hover:text-yellow-200"><i class="fas fa-home text-xl"></i></a>
                        <h1 class="text-white text-xl font-bold">รายงานและวิเคราะห์</h1>
                    </div>
                </div>
            </div>
        </nav>
        <div class="container mx-auto px-4 py-8">
            <div class="bg-white rounded-xl shadow-lg p-8 text-center">
                <i class="fas fa-chart-pie text-6xl text-orange-500 mb-4"></i>
                <h2 class="text-3xl font-bold text-gray-800 mb-4">รายงานและวิเคราะห์</h2>
                <p class="text-gray-600 mb-6">ระบบรายงานและวิเคราะห์ข้อมูลธุรกิจ</p>
                <div class="text-orange-500 text-lg">🚧 กำลังพัฒนา...</div>
            </div>
        </div>
    </body>
    </html>
    """)

@app.get("/barcode", response_class=HTMLResponse)
async def barcode():
    return HTMLResponse(content="""
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ระบบบาร์โค้ด</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            .gradient-bg { background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%); }
        </style>
    </head>
    <body class="bg-gradient-to-br from-yellow-50 to-orange-50 min-h-screen">
        <nav class="gradient-bg shadow-lg">
            <div class="container mx-auto px-4">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-white hover:text-yellow-200"><i class="fas fa-home text-xl"></i></a>
                        <h1 class="text-white text-xl font-bold">ระบบบาร์โค้ด</h1>
                    </div>
                </div>
            </div>
        </nav>
        <div class="container mx-auto px-4 py-8">
            <div class="bg-white rounded-xl shadow-lg p-8 text-center">
                <i class="fas fa-qrcode text-6xl text-orange-500 mb-4"></i>
                <h2 class="text-3xl font-bold text-gray-800 mb-4">ระบบบาร์โค้ด</h2>
                <p class="text-gray-600 mb-6">ระบบสแกนและสร้างบาร์โค้ดสินค้า</p>
                <div class="text-orange-500 text-lg">🚧 กำลังพัฒนา...</div>
            </div>
        </div>
    </body>
    </html>
    """)

@app.get("/purchase", response_class=HTMLResponse)
async def purchase():
    try:
        with open("web/purchase-form.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Purchase System - กำลังพัฒนา</h1>")

@app.get("/goods-receipt", response_class=HTMLResponse)
async def goods_receipt():
    try:
        with open("web/goods-receipt-form.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Goods Receipt - กำลังพัฒนา</h1>")

@app.get("/print-functions.js")
async def print_functions_js():
    try:
        with open("web/print-functions.js", "r", encoding="utf-8") as f:
            return Response(content=f.read(), media_type="application/javascript")
    except FileNotFoundError:
        return Response(content="// print-functions.js not found", media_type="application/javascript")

@app.get("/favicon.ico")
async def favicon():
    favicon_svg = """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
        <text x="2" y="12" font-size="12">🥭</text>
    </svg>"""
    return Response(content=favicon_svg, media_type="image/svg+xml")

# Branch Management
@app.get("/branch-management", response_class=HTMLResponse)
async def branch_management():
    try:
        with open("web/branch-management.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Branch Management - กำลังพัฒนา</h1>")

@app.get("/add-branch", response_class=HTMLResponse)
async def add_branch():
    try:
        with open("web/add-branch.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Add Branch - กำลังพัฒนา</h1>")

@app.get("/branch-details", response_class=HTMLResponse)
async def branch_details():
    try:
        with open("web/branch-details.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Branch Details - กำลังพัฒนา</h1>")

@app.get("/auto-branch-setup", response_class=HTMLResponse)
async def auto_branch_setup():
    try:
        with open("web/auto-branch-setup.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Auto Branch Setup - กำลังพัฒนา</h1>")

@app.get("/branch-approval", response_class=HTMLResponse)
async def branch_approval():
    try:
        with open("web/branch-approval.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Branch Approval - กำลังพัฒนา</h1>")

@app.get("/branch-delivery-routes", response_class=HTMLResponse)
async def branch_delivery_routes():
    try:
        with open("web/branch-delivery-routes.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Branch Delivery Routes - กำลังพัฒนา</h1>")

@app.get("/branch-inventory", response_class=HTMLResponse)
async def branch_inventory():
    try:
        with open("web/branch-inventory.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Branch Inventory - กำลังพัฒนา</h1>")

@app.get("/branch-analytics", response_class=HTMLResponse)
async def branch_analytics():
    try:
        with open("web/branch-analytics.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Branch Analytics - กำลังพัฒนา</h1>")

@app.get("/bulk-branch-operations", response_class=HTMLResponse)
async def bulk_branch_operations():
    try:
        with open("web/bulk-branch-operations.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Bulk Branch Operations - กำลังพัฒนา</h1>")

@app.get("/sales-pos", response_class=HTMLResponse)
async def sales_pos():
    try:
        with open("web/sales-pos.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Sales POS - กำลังพัฒนา</h1>")

@app.get("/sales-live-feed", response_class=HTMLResponse)
async def sales_live_feed():
    try:
        with open("web/sales-live-feed.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Sales Live Feed - กำลังพัฒนา</h1>")

# API Routes for Branch Analytics
@app.get("/api/analytics/kpis")
async def get_analytics_kpis(time_range: str = "month", group: str = "all"):
    try:
        # Sample KPI data based on time range
        kpis_data = {
            "today": { "score": 89.2, "revenue": 2.6, "profit": 19.5, "satisfaction": 4.4, "efficiency": 94.1, "stockout": 2.8 },
            "week": { "score": 88.7, "revenue": 2.5, "profit": 19.1, "satisfaction": 4.3, "efficiency": 93.5, "stockout": 3.1 },
            "month": { "score": 87.5, "revenue": 2.4, "profit": 18.2, "satisfaction": 4.3, "efficiency": 92.8, "stockout": 3.2 },
            "quarter": { "score": 86.8, "revenue": 2.3, "profit": 17.8, "satisfaction": 4.2, "efficiency": 91.9, "stockout": 3.5 },
            "year": { "score": 85.9, "revenue": 2.2, "profit": 17.1, "satisfaction": 4.1, "efficiency": 90.8, "stockout": 3.8 }
        }
        
        return {
            "success": True,
            "data": kpis_data.get(time_range, kpis_data["month"]),
            "timeRange": time_range,
            "group": group
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.get("/api/analytics/performance-trends")
async def get_performance_trends(time_range: str = "month", group: str = "all"):
    try:
        # Sample performance trend data
        trend_data = {
            "labels": ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
            "datasets": [
                {
                    "label": "คะแนนประสิทธิภาพเฉลี่ย",
                    "data": [82.1, 83.5, 85.2, 84.8, 86.1, 87.3, 88.5, 87.9, 89.2, 88.7, 90.1, 87.5]
                },
                {
                    "label": "เป้าหมาย",
                    "data": [85, 85, 85, 85, 85, 85, 85, 85, 85, 85, 85, 85]
                }
            ]
        }
        
        return {
            "success": True,
            "data": trend_data
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.get("/api/analytics/branch-rankings")
async def get_branch_rankings(group: str = "all", limit: int = 10):
    try:
        # Sample branch ranking data
        branches = [
            { "id": "BR001", "name": "สาขาเซ็นทรัลเวิลด์", "region": "ภาคกลาง", "score": 95.2, "revenue": 3200000, "profit": 22.5, "satisfaction": 4.8, "efficiency": 97.2, "trend": "up" },
            { "id": "BR002", "name": "สาขาเชียงใหม่นิมมาน", "region": "ภาคเหนือ", "score": 92.8, "revenue": 2800000, "profit": 24.1, "satisfaction": 4.7, "efficiency": 94.5, "trend": "up" },
            { "id": "BR003", "name": "สาขาภูเก็ตบิ๊กซี", "region": "ภาคใต้", "score": 90.1, "revenue": 2900000, "profit": 21.8, "satisfaction": 4.6, "efficiency": 93.2, "trend": "stable" },
            { "id": "BR004", "name": "สาขาขอนแก่นเซ็นทรัล", "region": "ภาคอีสาน", "score": 88.7, "revenue": 2400000, "profit": 20.3, "satisfaction": 4.5, "efficiency": 91.8, "trend": "up" },
            { "id": "BR005", "name": "สาขาหาดใหญ่ลี การ์เดน", "region": "ภาคใต้", "score": 86.3, "revenue": 2200000, "profit": 19.7, "satisfaction": 4.4, "efficiency": 89.5, "trend": "down" },
            { "id": "BR006", "name": "สาขาอุดรธานีซีคอน", "region": "ภาคอีสาน", "score": 84.9, "revenue": 2100000, "profit": 18.9, "satisfaction": 4.3, "efficiency": 87.2, "trend": "stable" },
            { "id": "BR007", "name": "สาขาสมุทรปราการเมกา", "region": "ภาคกลาง", "score": 83.5, "revenue": 2000000, "profit": 18.2, "satisfaction": 4.2, "efficiency": 85.8, "trend": "up" },
            { "id": "BR008", "name": "สาขานครราชสีมาเดอะมอลล์", "region": "ภาคอีสาน", "score": 82.1, "revenue": 1900000, "profit": 17.5, "satisfaction": 4.1, "efficiency": 84.3, "trend": "down" },
            { "id": "BR009", "name": "สาขาสุราษฎร์ธานีเซ็นทรัล", "region": "ภาคใต้", "score": 80.7, "revenue": 1800000, "profit": 16.8, "satisfaction": 4.0, "efficiency": 82.9, "trend": "stable" },
            { "id": "BR010", "name": "สาขาลพบุรีโรบินสัน", "region": "ภาคกลาง", "score": 79.3, "revenue": 1700000, "profit": 16.1, "satisfaction": 3.9, "efficiency": 81.5, "trend": "down" }
        ]
        
        # Apply group filter
        if group != "all":
            if group.startswith("region-"):
                region_map = {
                    "region-north": "ภาคเหนือ",
                    "region-central": "ภาคกลาง",
                    "region-northeast": "ภาคอีสาน",
                    "region-south": "ภาคใต้"
                }
                if group in region_map:
                    branches = [b for b in branches if b["region"] == region_map[group]]
        
        # Sort by score and limit results
        branches.sort(key=lambda x: x["score"], reverse=True)
        branches = branches[:limit]
        
        return {
            "success": True,
            "data": branches
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.get("/api/analytics/regional-comparison")
async def get_regional_comparison():
    try:
        regional_data = {
            "labels": ["ภาคกลาง", "ภาคเหนือ", "ภาคอีสาน", "ภาคใต้"],
            "datasets": [{
                "label": "คะแนนเฉลี่ย",
                "data": [88.5, 86.3, 84.2, 87.1],
                "revenue": [285000000, 240000000, 210000000, 260000000],
                "branches": [45, 32, 38, 35]
            }]
        }
        
        return {
            "success": True,
            "data": regional_data
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.get("/api/analytics/forecast")
async def get_forecast_data(months: int = 3):
    try:
        forecast_data = {
            "historical": {
                "labels": ["3 เดือนก่อน", "2 เดือนก่อน", "เดือนก่อน", "ปัจจุบัน"],
                "revenue": [220, 230, 235, 240],
                "performance": [84.2, 85.8, 86.5, 87.5]
            },
            "forecast": {
                "labels": ["เดือน 1", "เดือน 2", "เดือน 3"],
                "revenue": [252, 265, 278],
                "performance": [88.2, 89.1, 90.3],
                "confidence": [95.2, 92.1, 87.8]
            },
            "insights": {
                "growth_rate": 12.3,
                "risk_level": "medium",
                "confidence": 94.2,
                "key_factors": ["ขยายสาขาใหม่ 5 แห่ง", "เพิ่มผลิตภัณฑ์ใหม่", "ปรับปรุงกระบวนการจัดส่ง"]
            }
        }
        
        return {
            "success": True,
            "data": forecast_data
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.post("/api/analytics/export")
async def export_analytics_report(request: Request):
    try:
        data = await request.json()
        format_type = data.get("format", "pdf")
        time_range = data.get("timeRange", "month")
        group = data.get("group", "all")
        
        # Simulate export process
        filename = f"branch_analytics_{time_range}_{group}_{int(time.time())}"
        
        return {
            "success": True,
            "data": {
                "filename": f"{filename}.{format_type}",
                "downloadUrl": f"/downloads/{filename}.{format_type}",
                "size": "2.4 MB",
                "generatedAt": int(time.time())
            },
            "message": f"รายงานถูกส่งออกเรียบร้อยแล้วในรูปแบบ {format_type.upper()}"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "ระบบจัดการสต๊อคผลไม้อบแห้งทำงานปกติ"}

# API endpoints (mock data for now)
@app.get("/api/dashboard/stats")
async def dashboard_stats():
    return {
        "todaySales": 125450,
        "lowStockItems": 8,
        "pendingOrders": 23,
        "activeBranches": "147/150"
    }

@app.get("/api/inventory/products")
async def get_products():
    return {
        "success": True,
        "data": [
            {
                "id": "DF-MANGO-001",
                "name": "มะม่วงอบแห้ง",
                "sku": "DF-MANGO-001",
                "barcode": "8851234567890",
                "category": "DRIED_FRUIT",
                "stock": 5.2,
                "unit": "kg",
                "reorderPoint": 10,
                "sellingPrice": 2400,
                "status": "low"
            },
            {
                "id": "DF-PINE-001", 
                "name": "สับปะรดอบแห้ง",
                "sku": "DF-PINE-001",
                "barcode": "8851234567891",
                "category": "DRIED_FRUIT",
                "stock": 25.8,
                "unit": "kg",
                "reorderPoint": 15,
                "sellingPrice": 2100,
                "status": "normal"
            }
        ]
    }

# Purchase Order API endpoints
@app.get("/api/suppliers")
async def get_suppliers():
    return {
        "success": True,
        "data": [
            {
                "id": "supplier1",
                "name": "บริษัท ผลไม้ทองคำ จำกัด",
                "phone": "02-123-4567",
                "email": "info@goldenfruit.co.th",
                "address": "กรุงเทพมหานคร",
                "rating": 4.8,
                "productCount": 15,
                "isActive": True
            },
            {
                "id": "supplier2",
                "name": "เนเจอรัล ฟรุ๊ต เซ็นเตอร์",
                "phone": "02-234-5678",
                "email": "sales@naturalfruit.com",
                "address": "เชียงใหม่",
                "rating": 4.5,
                "productCount": 22,
                "isActive": True
            },
            {
                "id": "supplier3",
                "name": "ดอยผลไม้ เทรดดิ้ง",
                "phone": "053-345-6789",
                "email": "contact@doifruit.co.th",
                "address": "เชียงราย",
                "rating": 4.9,
                "productCount": 18,
                "isActive": True
            }
        ]
    }

@app.get("/api/suppliers/{supplier_id}/products")
async def get_supplier_products(supplier_id: str):
    supplier_products = {
        "supplier1": [
            {"id": "p1", "name": "มะม่วงอบแห้ง Premium", "price": 1800, "unit": "kg", "category": "mango", "minOrder": 5},
            {"id": "p2", "name": "สับปะรดอบแห้ง", "price": 1500, "unit": "kg", "category": "pineapple", "minOrder": 10},
            {"id": "p3", "name": "กล้วยอบแห้ง", "price": 1400, "unit": "kg", "category": "banana", "minOrder": 5},
            {"id": "p4", "name": "ลำไยอบแห้ง", "price": 2200, "unit": "kg", "category": "longan", "minOrder": 3},
            {"id": "p5", "name": "ผลไม้รวม Premium", "price": 1900, "unit": "kg", "category": "mixed", "minOrder": 5}
        ],
        "supplier2": [
            {"id": "p6", "name": "มะม่วงอบแห้งออร์แกนิค", "price": 2000, "unit": "kg", "category": "mango", "minOrder": 3},
            {"id": "p7", "name": "สับปะรดอบแห้งออร์แกนิค", "price": 1700, "unit": "kg", "category": "pineapple", "minOrder": 5},
            {"id": "p8", "name": "กล้วยหอมอบแห้ง", "price": 1600, "unit": "kg", "category": "banana", "minOrder": 5},
            {"id": "p9", "name": "มะละกออบแห้ง", "price": 1300, "unit": "kg", "category": "papaya", "minOrder": 10}
        ],
        "supplier3": [
            {"id": "p10", "name": "มะม่วงน้ำดอกไม้อบแห้ง", "price": 2500, "unit": "kg", "category": "mango", "minOrder": 2},
            {"id": "p11", "name": "ลิ้นจี่อบแห้ง", "price": 2800, "unit": "kg", "category": "lychee", "minOrder": 2},
            {"id": "p12", "name": "ลองกองอบแห้ง", "price": 2600, "unit": "kg", "category": "longan", "minOrder": 3}
        ]
    }
    
    return {
        "success": True,
        "data": supplier_products.get(supplier_id, [])
    }

@app.post("/api/purchase-orders")
async def create_purchase_order(request: Request):
    try:
        data = await request.json()
        
        # Generate PO ID
        po_id = f"PO{data['poNumber']}"
        
        # Mock response - in real implementation, save to database
        response_data = {
            "success": True,
            "data": {
                "id": po_id,
                "poNumber": data["poNumber"],
                "status": "PENDING_APPROVAL",
                "supplier": data["supplier"],
                "orderDate": data["orderDate"],
                "deliveryDate": data["deliveryDate"],
                "items": data["items"],
                "subtotal": data["subtotal"],
                "vat": data["vat"],
                "grandTotal": data["grandTotal"],
                "notes": data.get("notes", ""),
                "createdAt": "2024-07-18T10:30:00Z"
            },
            "message": "สร้างใบสั่งซื้อเรียบร้อยแล้ว"
        }
        
        return response_data
        
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.get("/api/purchase-orders")
async def get_purchase_orders():
    return {
        "success": True,
        "data": [
            {
                "id": "PO202407180001",
                "poNumber": "PO202407180001",
                "supplier": {
                    "name": "บริษัท ผลไม้ทองคำ จำกัด",
                    "phone": "02-123-4567"
                },
                "status": "PENDING_APPROVAL",
                "orderDate": "2024-07-18",
                "deliveryDate": "2024-07-25",
                "grandTotal": 25000,
                "createdAt": "2024-07-18T10:30:00Z"
            },
            {
                "id": "PO202407170001",
                "poNumber": "PO202407170001",
                "supplier": {
                    "name": "เนเจอรัล ฟรุ๊ต เซ็นเตอร์",
                    "phone": "02-234-5678"
                },
                "status": "APPROVED",
                "orderDate": "2024-07-17",
                "deliveryDate": "2024-07-24",
                "grandTotal": 18500,
                "createdAt": "2024-07-17T14:15:00Z"
            }
        ]
    }

@app.put("/api/purchase-orders/{po_id}/approve")
async def approve_purchase_order(po_id: str):
    return {
        "success": True,
        "message": f"อนุมัติใบสั่งซื้อ {po_id} เรียบร้อยแล้ว"
    }

@app.put("/api/purchase-orders/{po_id}/reject")
async def reject_purchase_order(po_id: str, request: Request):
    data = await request.json()
    return {
        "success": True,
        "message": f"ปฏิเสธใบสั่งซื้อ {po_id} เรียบร้อยแล้ว"
    }

# Goods Receipt API endpoints
@app.get("/api/purchase-orders/pending-receipt")
async def get_pending_receipt_pos():
    return {
        "success": True,
        "data": [
            {
                "poNumber": "PO202407180001",
                "supplier": "บริษัท ผลไม้ทองคำ จำกัด",
                "orderDate": "2024-07-18",
                "deliveryDate": "2024-07-25",
                "itemCount": 5,
                "totalValue": 25000,
                "status": "APPROVED"
            },
            {
                "poNumber": "PO202407170002",
                "supplier": "เนเจอรัล ฟรุ๊ต เซ็นเตอร์",
                "orderDate": "2024-07-17",
                "deliveryDate": "2024-07-24",
                "itemCount": 4,
                "totalValue": 18500,
                "status": "APPROVED"
            }
        ]
    }

@app.get("/api/purchase-orders/{po_number}/details")
async def get_po_details(po_number: str):
    po_details = {
        "PO202407180001": {
            "poNumber": "PO202407180001",
            "supplier": "บริษัท ผลไม้ทองคำ จำกัด",
            "orderDate": "2024-07-18",
            "deliveryDate": "2024-07-25",
            "items": [
                {"id": "p1", "name": "มะม่วงอบแห้ง Premium", "orderedQty": 10, "unit": "kg", "price": 1800},
                {"id": "p2", "name": "สับปะรดอบแห้ง", "orderedQty": 15, "unit": "kg", "price": 1500},
                {"id": "p3", "name": "กล้วยอบแห้ง", "orderedQty": 8, "unit": "kg", "price": 1400},
                {"id": "p4", "name": "ลำไยอบแห้ง", "orderedQty": 5, "unit": "kg", "price": 2200},
                {"id": "p5", "name": "ผลไม้รวม Premium", "orderedQty": 12, "unit": "kg", "price": 1900}
            ]
        },
        "PO202407170002": {
            "poNumber": "PO202407170002",
            "supplier": "เนเจอรัล ฟรุ๊ต เซ็นเตอร์",
            "orderDate": "2024-07-17",
            "deliveryDate": "2024-07-24",
            "items": [
                {"id": "p6", "name": "มะม่วงอบแห้งออร์แกนิค", "orderedQty": 6, "unit": "kg", "price": 2000},
                {"id": "p7", "name": "สับปะรดอบแห้งออร์แกนิค", "orderedQty": 10, "unit": "kg", "price": 1700},
                {"id": "p8", "name": "กล้วยหอมอบแห้ง", "orderedQty": 8, "unit": "kg", "price": 1600},
                {"id": "p9", "name": "มะละกออบแห้ง", "orderedQty": 15, "unit": "kg", "price": 1300}
            ]
        }
    }
    
    return {
        "success": True,
        "data": po_details.get(po_number, {})
    }

@app.post("/api/goods-receipts")
async def create_goods_receipt(request: Request):
    try:
        data = await request.json()
        
        # Generate GR ID
        gr_id = f"GR{data['grNumber']}"
        
        # Calculate totals
        total_ordered = len(data['items'])
        total_received = len([item for item in data['items'] if item['receivedQty'] > 0])
        total_discrepancies = len([item for item in data['items'] if item['difference'] != 0])
        
        # Mock response - in real implementation, save to database and update inventory
        response_data = {
            "success": True,
            "data": {
                "id": gr_id,
                "grNumber": data["grNumber"],
                "poNumber": data["poNumber"],
                "supplier": data["supplier"],
                "receiptDate": data["receiptDate"],
                "receivedBy": data["receivedBy"],
                "items": data["items"],
                "summary": {
                    "totalOrdered": total_ordered,
                    "totalReceived": total_received,
                    "totalDiscrepancies": total_discrepancies,
                    "hasDiscrepancies": total_discrepancies > 0
                },
                "notes": data.get("notes", ""),
                "status": "COMPLETED" if total_discrepancies == 0 else "COMPLETED_WITH_DISCREPANCIES",
                "createdAt": "2024-07-18T10:30:00Z"
            },
            "message": "รับสินค้าเข้าคลังเรียบร้อยแล้ว"
        }
        
        return response_data
        
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.get("/api/goods-receipts")
async def get_goods_receipts():
    return {
        "success": True,
        "data": [
            {
                "id": "GR202407180001",
                "grNumber": "GR202407180001",
                "poNumber": "PO202407160001",
                "supplier": "ดอยผลไม้ เทรดดิ้ง",
                "receiptDate": "2024-07-18T09:30:00Z",
                "receivedBy": "พนักงานคลังสินค้า",
                "status": "COMPLETED",
                "totalItems": 3,
                "discrepancies": 0
            },
            {
                "id": "GR202407170001",
                "grNumber": "GR202407170001",
                "poNumber": "PO202407150001",
                "supplier": "บริษัท ผลไม้ทองคำ จำกัด",
                "receiptDate": "2024-07-17T14:15:00Z",
                "receivedBy": "พนักงานคลังสินค้า",
                "status": "COMPLETED_WITH_DISCREPANCIES",
                "totalItems": 5,
                "discrepancies": 2
            }
        ]
    }

@app.get("/api/goods-receipts/{gr_id}")
async def get_goods_receipt_details(gr_id: str):
    return {
        "success": True,
        "data": {
            "id": gr_id,
            "grNumber": gr_id,
            "poNumber": "PO202407160001",
            "supplier": "ดอยผลไม้ เทรดดิ้ง",
            "receiptDate": "2024-07-18T09:30:00Z",
            "receivedBy": "พนักงานคลังสินค้า",
            "items": [
                {
                    "name": "มะม่วงน้ำดอกไม้อบแห้ง",
                    "orderedQty": 5,
                    "receivedQty": 5,
                    "unit": "kg",
                    "difference": 0,
                    "status": "match"
                },
                {
                    "name": "ลิ้นจี่อบแห้ง",
                    "orderedQty": 3,
                    "receivedQty": 3,
                    "unit": "kg",
                    "difference": 0,
                    "status": "match"
                }
            ],
            "summary": {
                "totalOrdered": 2,
                "totalReceived": 2,
                "totalDiscrepancies": 0,
                "hasDiscrepancies": False
            },
            "notes": "สินค้าอยู่ในสภาพดี บรรจุภัณฑ์สมบูรณ์",
            "status": "COMPLETED"
        }
    }

# Branch Management API endpoints
@app.get("/api/branches")
async def get_branches():
    return {
        "success": True,
        "data": [
            {
                "id": "BR-001",
                "name": "สาขาเซ็นทรัลปิ่นเกล้า",
                "type": "FLAGSHIP",
                "status": "ACTIVE",
                "address": "เซ็นทรัลปิ่นเกล้า ชั้น 2 เลขที่ 7/222 ถนนบรมราชชนนี แขวงบางบำหรุ เขตบางพลัด กรุงเทพมหานคร 10700",
                "province": "กรุงเทพมหานคร",
                "postcode": "10700",
                "phone": "02-884-8888",
                "email": "pinklao@driedfruits.co.th",
                "lat": 13.7878,
                "lng": 100.4832,
                "manager": "นางสาวกรรณิกา สมใส",
                "managerPhone": "081-234-5678",
                "managerEmail": "kannika@driedfruits.co.th",
                "deliveryZone": "ZONE_CENTRAL",
                "performanceScore": 95,
                "monthlyRevenue": 850000,
                "totalOrders": 2450,
                "createdAt": "2024-01-15T09:00:00Z",
                "openingDate": "2024-02-01"
            },
            {
                "id": "BR-002",
                "name": "สาขาเซียร์รังสิต",
                "type": "STANDARD",
                "status": "ACTIVE",
                "address": "ห้างสรรพสินค้าเซียร์รังสิต ชั้น 1 เลขที่ 99/19 ถนนพหลโยธิน ตำบลประชาธิปัตย์ อำเภอธัญบุรี ปทุมธานี 12130",
                "province": "ปทุมธานี",
                "postcode": "12130",
                "phone": "02-992-1234",
                "email": "rangsit@driedfruits.co.th",
                "lat": 14.0307,
                "lng": 100.6078,
                "manager": "นายพิษณุ อินทิรา",
                "managerPhone": "089-765-4321",
                "managerEmail": "pisanu@driedfruits.co.th",
                "deliveryZone": "ZONE_CENTRAL",
                "performanceScore": 88,
                "monthlyRevenue": 650000,
                "totalOrders": 1890,
                "createdAt": "2024-02-10T09:00:00Z",
                "openingDate": "2024-03-01"
            },
            {
                "id": "BR-003",
                "name": "สาขาเชียงใหม่ นิมมาน",
                "type": "STANDARD",
                "status": "ACTIVE",
                "address": "ถนนนิมมานเหมินท์ ซอย 9 ตำบลสุเทพ อำเภอเมืองเชียงใหม่ เชียงใหม่ 50200",
                "province": "เชียงใหม่",
                "postcode": "50200",
                "phone": "053-219-876",
                "email": "nimman@driedfruits.co.th",
                "lat": 18.8000,
                "lng": 98.9650,
                "manager": "นางสาวอาภัสรา ใจดี",
                "managerPhone": "095-123-4567",
                "managerEmail": "apatsara@driedfruits.co.th",
                "deliveryZone": "ZONE_NORTH",
                "performanceScore": 92,
                "monthlyRevenue": 580000,
                "totalOrders": 1650,
                "createdAt": "2024-03-05T09:00:00Z",
                "openingDate": "2024-04-01"
            },
            {
                "id": "BR-004",
                "name": "สาขาภูเก็ต ป่าตอง",
                "type": "EXPRESS",
                "status": "ACTIVE",
                "address": "ถนนราษฎร์อุทิศ 200 ปี ตำบลป่าตอง อำเภอกะทู้ ภูเก็ต 83150",
                "province": "ภูเก็ต",
                "postcode": "83150",
                "phone": "076-340-555",
                "email": "patong@driedfruits.co.th",
                "lat": 7.8964,
                "lng": 98.2964,
                "manager": "นายสมชาย ทะเลใส",
                "managerPhone": "087-456-7890",
                "managerEmail": "somchai@driedfruits.co.th",
                "deliveryZone": "ZONE_SOUTH",
                "performanceScore": 78,
                "monthlyRevenue": 420000,
                "totalOrders": 980,
                "createdAt": "2024-04-12T09:00:00Z",
                "openingDate": "2024-05-15"
            },
            {
                "id": "BR-005",
                "name": "สาขาขอนแก่น เซ็นทรัลพลาซ่า",
                "type": "STANDARD",
                "status": "PENDING",
                "address": "เซ็นทรัลพลาซ่าขอนแก่น ชั้น 1 เลขที่ 1/1 ถนนศรีจันทร์ ตำบลในเมือง อำเภอเมืองขอนแก่น ขอนแก่น 40000",
                "province": "ขอนแก่น",
                "postcode": "40000",
                "phone": "043-123-456",
                "email": "khonkaen@driedfruits.co.th",
                "lat": 16.4322,
                "lng": 102.8236,
                "manager": "นางวิไลวรรณ สุขใส",
                "managerPhone": "081-999-8888",
                "managerEmail": "wilaiwan@driedfruits.co.th",
                "deliveryZone": "ZONE_NORTHEAST",
                "performanceScore": 0,
                "monthlyRevenue": 0,
                "totalOrders": 0,
                "createdAt": "2024-07-10T09:00:00Z",
                "openingDate": null
            },
            {
                "id": "BR-006",
                "name": "สาขาสงขลา หาดใหญ่",
                "type": "STANDARD",
                "status": "PENDING",
                "address": "ถนนนิพัทธ์อุทิศ 3 ตำบลหาดใหญ่ อำเภอหาดใหญ่ สงขลา 90110",
                "province": "สงขลา",
                "postcode": "90110",
                "phone": "074-567-890",
                "email": "hatyai@driedfruits.co.th",
                "lat": 7.0187,
                "lng": 100.4685,
                "manager": "นายประเสริฐ รักดี",
                "managerPhone": "086-777-6666",
                "managerEmail": "prasert@driedfruits.co.th",
                "deliveryZone": "ZONE_SOUTH",
                "performanceScore": 0,
                "monthlyRevenue": 0,
                "totalOrders": 0,
                "createdAt": "2024-07-15T09:00:00Z",
                "openingDate": null
            },
            {
                "id": "BR-007",
                "name": "สาขาอุดรธานี เซ็นทรัลพลาซ่า",
                "type": "STANDARD",
                "status": "INACTIVE",
                "address": "เซ็นทรัลพลาซ่าอุดรธานี ชั้น 2 เลขที่ 777 ถนนโพศรี ตำบลหมากแข้ง อำเภอเมืองอุดรธานี อุดรธานี 41000",
                "province": "อุดรธานี",
                "postcode": "41000",
                "phone": "042-888-999",
                "email": "udon@driedfruits.co.th",
                "lat": 17.4139,
                "lng": 102.7864,
                "manager": "นายชัยวัฒน์ มีสุข",
                "managerPhone": "089-333-2222",
                "managerEmail": "chaiwat@driedfruits.co.th",
                "deliveryZone": "ZONE_NORTHEAST",
                "performanceScore": 65,
                "monthlyRevenue": 0,
                "totalOrders": 850,
                "createdAt": "2024-01-20T09:00:00Z",
                "openingDate": "2024-02-15"
            }
        ]
    }

@app.get("/api/branches/generate-id")
async def generate_branch_id():
    # In real implementation, get the next available ID from database
    import random
    next_id = f"BR-{random.randint(100, 999):03d}"
    return {"branchId": next_id}

@app.post("/api/branches")
async def create_branch(request: Request):
    try:
        data = await request.json()
        
        # Generate branch ID if not provided
        branch_id = data.get('branchId', f"BR-{len(await get_branches()) + 1:03d}")
        
        # Create branch data
        new_branch = {
            "id": branch_id,
            "name": data.get("branchName"),
            "type": data.get("branchType"),
            "status": "PENDING",  # New branches start as pending approval
            "address": data.get("branchAddress"),
            "province": data.get("branchProvince"),
            "postcode": data.get("branchPostcode"),
            "phone": data.get("branchPhone"),
            "email": data.get("branchEmail", ""),
            "lat": float(data.get("lat", 0)) if data.get("lat") else None,
            "lng": float(data.get("lng", 0)) if data.get("lng") else None,
            "manager": data.get("managerName"),
            "managerPhone": data.get("managerPhone"),
            "managerEmail": data.get("managerEmail"),
            "deliveryZone": data.get("deliveryZone"),
            "performanceScore": 0,
            "monthlyRevenue": 0,
            "totalOrders": 0,
            "createdAt": "2024-07-18T10:30:00Z",
            "openingDate": None,
            "initialStock": {
                "mango": int(data.get("stockMango", 0)),
                "pineapple": int(data.get("stockPineapple", 0)),
                "banana": int(data.get("stockBanana", 0)),
                "longan": int(data.get("stockLongan", 0)),
                "mixed": int(data.get("stockMixed", 0))
            }
        }
        
        # In real implementation:
        # 1. Save to database
        # 2. Create user account for manager
        # 3. Setup initial inventory
        # 4. Create delivery zone mapping
        # 5. Send notifications for approval
        
        return {
            "success": True,
            "data": {
                "branchId": branch_id,
                "status": "PENDING",
                "message": "สาขาใหม่ถูกส่งเข้าระบบอนุมัติเรียบร้อยแล้ว"
            },
            "message": "สร้างสาขาใหม่สำเร็จ"
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.get("/api/branches/zones")
async def get_delivery_zones():
    return {
        "success": True,
        "data": [
            {
                "id": "ZONE_NORTH",
                "name": "ภาคเหนือ",
                "provinces": ["เชียงใหม่", "เชียงราย", "ลำปาง", "ลำพูน", "แม่ฮ่องสอน", "น่าน", "พะเยา", "แพร่"],
                "activeBranches": 15,
                "coverage": "8 จังหวัด"
            },
            {
                "id": "ZONE_NORTHEAST", 
                "name": "ภาคอีสาน",
                "provinces": ["ขอนแก่น", "อุดรธานี", "นครราชสีมา", "บุรีรัมย์", "สุรินทร์", "ศรีสะเกษ", "อุบลราชธานี"],
                "activeBranches": 22,
                "coverage": "20 จังหวัด"
            },
            {
                "id": "ZONE_CENTRAL",
                "name": "ภาคกลาง",
                "provinces": ["กรุงเทพมหานคร", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "นครปฐม", "สมุทรสาคร"],
                "activeBranches": 45,
                "coverage": "22 จังหวัด"
            },
            {
                "id": "ZONE_EAST",
                "name": "ภาคตะวันออก",
                "provinces": ["ชลบุรี", "ระยอง", "จันทบุรี", "ตราด", "ฉะเชิงเทรา", "ปราจีนบุรี", "สระแก้ว"],
                "activeBranches": 18,
                "coverage": "7 จังหวัด"
            },
            {
                "id": "ZONE_WEST",
                "name": "ภาคตะวันตก",
                "provinces": ["กาญจนบุรี", "เพชรบุรี", "ประจวบคีรีขันธ์", "ราชบุรี", "สุพรรณบุรี", "ตาก"],
                "activeBranches": 12,
                "coverage": "6 จังหวัด"
            },
            {
                "id": "ZONE_SOUTH",
                "name": "ภาคใต้",
                "provinces": ["ภูเก็ต", "กระบี่", "ตรัง", "สงขลา", "นครศรีธรรมราช", "สุราษฎร์ธานี", "ชุมพร"],
                "activeBranches": 25,
                "coverage": "14 จังหวัด"
            }
        ]
    }

@app.put("/api/branches/{branch_id}")
async def update_branch(branch_id: str, request: Request):
    try:
        data = await request.json()
        
        # In real implementation, update branch in database
        
        return {
            "success": True,
            "message": f"อัพเดทข้อมูลสาขา {branch_id} เรียบร้อยแล้ว"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.delete("/api/branches/{branch_id}")
async def delete_branch(branch_id: str):
    try:
        # In real implementation, soft delete or deactivate branch
        
        return {
            "success": True,
            "message": f"ปิดสาขา {branch_id} เรียบร้อยแล้ว"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.post("/api/branches/{branch_id}/activate")
async def activate_branch(branch_id: str):
    try:
        # In real implementation:
        # 1. Update status to ACTIVE
        # 2. Enable inventory management
        # 3. Add to delivery routes
        # 4. Send welcome notifications
        
        return {
            "success": True,
            "message": f"เปิดใช้งานสาขา {branch_id} เรียบร้อยแล้ว"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

# Branch Approval Workflow API endpoints
@app.post("/api/branches/{branch_id}/approve")
async def approve_branch(branch_id: str, request: Request):
    try:
        data = await request.json() if request.headers.get('content-type') == 'application/json' else {}
        
        # In real implementation:
        # 1. Update branch status to ACTIVE
        # 2. Create user account for manager
        # 3. Initialize inventory system
        # 4. Add to delivery routes
        # 5. Send notifications
        # 6. Log approval activity
        
        # Mock approval process
        approval_data = {
            "branchId": branch_id,
            "approvedBy": "admin",  # In real app, get from auth token
            "approvedAt": "2024-07-18T10:30:00Z",
            "status": "ACTIVE",
            "setupRequired": True
        }
        
        return {
            "success": True,
            "data": approval_data,
            "message": f"อนุมัติสาขา {branch_id} เรียบร้อยแล้ว"
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.post("/api/branches/{branch_id}/reject")
async def reject_branch(branch_id: str, request: Request):
    try:
        data = await request.json()
        reason = data.get("reason", "")
        suggestion = data.get("suggestion", "")
        
        # In real implementation:
        # 1. Update branch status to REJECTED
        # 2. Log rejection with reason
        # 3. Send notification to applicant
        # 4. Archive application
        
        rejection_data = {
            "branchId": branch_id,
            "rejectedBy": "admin",  # In real app, get from auth token
            "rejectedAt": "2024-07-18T10:30:00Z",
            "reason": reason,
            "suggestion": suggestion,
            "status": "REJECTED"
        }
        
        return {
            "success": True,
            "data": rejection_data,
            "message": f"ปฏิเสธสาขา {branch_id} เรียบร้อยแล้ว"
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.get("/api/branches/pending")
async def get_pending_branches():
    return {
        "success": True,
        "data": [
            {
                "id": "BR-005",
                "name": "สาขาขอนแก่น เซ็นทรัลพลาซ่า",
                "type": "STANDARD",
                "status": "PENDING",
                "address": "เซ็นทรัลพลาซ่าขอนแก่น ชั้น 1 เลขที่ 1/1 ถนนศรีจันทร์ ตำบลในเมือง อำเภอเมืองขอนแก่น ขอนแก่น 40000",
                "manager": "นางวิไลวรรณ สุขใส",
                "managerPhone": "081-999-8888",
                "submittedDate": "2024-07-10T09:00:00Z",
                "priority": "high",
                "estimatedRevenue": 500000,
                "estimatedCost": 250000,
                "competition": "สูง",
                "marketPotential": "ดี",
                "urgentReason": "แข่งขันสูง ต้องเปิดก่อนคู่แข่ง"
            },
            {
                "id": "BR-006",
                "name": "สาขาสงขลา หาดใหญ่",
                "type": "STANDARD",
                "status": "PENDING",
                "address": "ถนนนิพัทธ์อุทิศ 3 ตำบลหาดใหญ่ อำเภอหาดใหญ่ สงขลา 90110",
                "manager": "นายประเสริฐ รักดี",
                "managerPhone": "086-777-6666",
                "submittedDate": "2024-07-15T09:00:00Z",
                "priority": "medium",
                "estimatedRevenue": 400000,
                "estimatedCost": 200000,
                "competition": "ปานกลาง",
                "marketPotential": "ดี",
                "urgentReason": None
            },
            {
                "id": "BR-007", 
                "name": "สาขาภูเก็ต ป่าตอง Express",
                "type": "EXPRESS",
                "status": "PENDING",
                "address": "ถนนบางลา ตำบลป่าตอง อำเภอกะทู้ ภูเก็ต 83150",
                "manager": "นางสาวศิริพร ใสใส",
                "managerPhone": "087-111-2222",
                "submittedDate": "2024-07-18T09:00:00Z",
                "priority": "urgent",
                "estimatedRevenue": 300000,
                "estimatedCost": 150000,
                "competition": "สูงมาก",
                "marketPotential": "ดีมาก",
                "urgentReason": "ฤดูกาลท่องเที่ยว ต้องเปิดทันที"
            }
        ]
    }

@app.post("/api/branches/bulk-approve")
async def bulk_approve_branches(request: Request):
    try:
        data = await request.json()
        branch_ids = data.get("branchIds", [])
        
        # In real implementation, approve all branches
        approved_count = len(branch_ids)
        
        return {
            "success": True,
            "data": {
                "approvedCount": approved_count,
                "branchIds": branch_ids
            },
            "message": f"อนุมัติ {approved_count} สาขาเรียบร้อยแล้ว"
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.post("/api/branches/bulk-reject")
async def bulk_reject_branches(request: Request):
    try:
        data = await request.json()
        branch_ids = data.get("branchIds", [])
        reason = data.get("reason", "")
        
        # In real implementation, reject all branches
        rejected_count = len(branch_ids)
        
        return {
            "success": True,
            "data": {
                "rejectedCount": rejected_count,
                "branchIds": branch_ids,
                "reason": reason
            },
            "message": f"ปฏิเสธ {rejected_count} สาขาเรียบร้อยแล้ว"
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.get("/api/approval/statistics")
async def get_approval_statistics():
    return {
        "success": True,
        "data": {
            "pendingCount": 3,
            "approvedToday": 12,
            "rejectedToday": 1,
            "avgApprovalTimeHours": 2.5,
            "totalApprovedThisMonth": 45,
            "totalRejectedThisMonth": 3,
            "approvalRate": 93.8
        }
    }

# Delivery Routes API endpoints
@app.get("/api/delivery/routes")
async def get_delivery_routes():
    return {
        "success": True,
        "data": [
            {
                "id": "route-central-a",
                "name": "เส้นทางภาคกลาง A",
                "zone": "ZONE_CENTRAL",
                "status": "active",
                "vehicle": "รถบรรทุก 6 ล้อ (BKK-001)",
                "driver": "สมชาย ใจดี",
                "branches": [
                    {"id": "BR-001", "name": "เซ็นทรัลปิ่นเกล้า", "lat": 13.7878, "lng": 100.4832, "order": 1, "distance": 15.2},
                    {"id": "BR-002", "name": "เซียร์รังสิต", "lat": 14.0307, "lng": 100.6078, "order": 2, "distance": 28.5},
                    {"id": "BR-008", "name": "เมกาบางนา", "lat": 13.6676, "lng": 100.6155, "order": 3, "distance": 22.8}
                ],
                "totalDistance": 66.5,
                "estimatedTime": 4.5,
                "optimizationScore": 94,
                "lastOptimized": "2024-07-18T05:30:00Z"
            },
            {
                "id": "route-north-a",
                "name": "เส้นทางภาคเหนือ",
                "zone": "ZONE_NORTH",
                "status": "planned",
                "vehicle": "รถบรรทุก 10 ล้อ (CNX-001)",
                "driver": "อานนท์ ภูเขียว",
                "branches": [
                    {"id": "BR-003", "name": "เชียงใหม่ นิมมาน", "lat": 18.8000, "lng": 98.9650, "order": 1, "distance": 695.2},
                    {"id": "BR-009", "name": "ลำปาง กาดกองต้า", "lat": 18.2888, "lng": 99.4919, "order": 2, "distance": 102.4},
                    {"id": "BR-010", "name": "แพร่ วิน", "lat": 18.1459, "lng": 100.1201, "order": 3, "distance": 78.9}
                ],
                "totalDistance": 876.5,
                "estimatedTime": 12.5,
                "optimizationScore": 89,
                "lastOptimized": "2024-07-18T05:30:00Z"
            },
            {
                "id": "route-south-a",
                "name": "เส้นทางภาคใต้ A",
                "zone": "ZONE_SOUTH",
                "status": "active",
                "vehicle": "รถบรรทุก 6 ล้อ (PKT-001)",
                "driver": "ประเสริฐ ทะเลใส",
                "branches": [
                    {"id": "BR-004", "name": "ภูเก็ต ป่าตอง", "lat": 7.8964, "lng": 98.2964, "order": 1, "distance": 862.1},
                    {"id": "BR-011", "name": "กระบี่ อ่าวนาง", "lat": 8.0348, "lng": 98.9067, "order": 2, "distance": 165.3},
                    {"id": "BR-012", "name": "ตรัง เซ็นทรัล", "lat": 7.5563, "lng": 99.6114, "order": 3, "distance": 145.8}
                ],
                "totalDistance": 1173.2,
                "estimatedTime": 16.5,
                "optimizationScore": 87,
                "lastOptimized": "2024-07-18T05:30:00Z"
            },
            {
                "id": "route-northeast-a",
                "name": "เส้นทางภาคอีสาน",
                "zone": "ZONE_NORTHEAST",
                "status": "delayed",
                "vehicle": "รถบรรทุก 10 ล้อ (KKC-001)",
                "driver": "วิไลวรรณ สุขใส",
                "branches": [
                    {"id": "BR-005", "name": "ขอนแก่น เซ็นทรัล", "lat": 16.4322, "lng": 102.8236, "order": 1, "distance": 449.2},
                    {"id": "BR-013", "name": "อุดรธานี เซ็นทรัล", "lat": 17.4139, "lng": 102.7864, "order": 2, "distance": 112.4},
                    {"id": "BR-014", "name": "หนองคาย วิลล่า", "lat": 17.8782, "lng": 102.7412, "order": 3, "distance": 67.8}
                ],
                "totalDistance": 629.4,
                "estimatedTime": 9.2,
                "optimizationScore": 78,
                "lastOptimized": "2024-07-17T05:30:00Z"
            }
        ]
    }

@app.post("/api/delivery/routes/{route_id}/optimize")
async def optimize_route(route_id: str):
    return {
        "success": True,
        "data": {
            "routeId": route_id,
            "optimizationScore": 95,
            "distanceSaved": 12.5,
            "timeSaved": 0.8,
            "fuelSaved": 2.1
        },
        "message": f"ปรับปรุงเส้นทาง {route_id} เรียบร้อยแล้ว"
    }

@app.post("/api/delivery/routes/optimize-all")
async def optimize_all_routes():
    return {
        "success": True,
        "data": {
            "optimizedRoutes": 6,
            "totalDistanceSaved": 85.4,
            "totalTimeSaved": 5.2,
            "totalFuelSaved": 14.8
        },
        "message": "ปรับปรุงเส้นทางทั้งหมดเรียบร้อยแล้ว"
    }

@app.get("/api/delivery/statistics")
async def get_delivery_statistics():
    return {
        "success": True,
        "data": {
            "totalRoutes": 6,
            "activeBranches": 147,
            "avgDeliveryTime": 4.2,
            "totalDistance": 2847,
            "onTimeDeliveryRate": 94.5,
            "fuelEfficiency": 87.3,
            "customerSatisfaction": 96.2
        }
    }

@app.get("/api/delivery/schedule")
async def get_delivery_schedule():
    return {
        "success": True,
        "data": [
            {
                "time": "06:00",
                "route": "เส้นทางภาคกลาง A",
                "description": "กรุงเทพฯ - นนทบุรี - ปทุมธานี",
                "status": "completed",
                "driver": "สมชาย ใจดี"
            },
            {
                "time": "08:30",
                "route": "เส้นทางภาคกลาง B",
                "description": "สมุทรปราการ - สมุทรสาคร",
                "status": "in_progress",
                "driver": "สมหญิง รักงาน"
            },
            {
                "time": "10:00",
                "route": "เส้นทางภาคเหนือ",
                "description": "เชียงใหม่ - ลำปาง - แพร่",
                "status": "preparing",
                "driver": "อานนท์ ภูเขียว"
            },
            {
                "time": "14:00",
                "route": "เส้นทางภาคอีสาน",
                "description": "ขอนแก่น - อุดรธานี - หนองคาย",
                "status": "waiting",
                "driver": "วิไลวรรณ สุขใส"
            }
        ]
    }

# API Routes for Bulk Branch Operations
@app.get("/api/bulk-operations/branches")
async def get_bulk_operation_branches(region: str = "all", size: str = "all", status: str = "all"):
    try:
        # Sample branch data
        branches = [
            { "id": "BR001", "name": "สาขาเซ็นทรัลเวิลด์", "region": "central", "size": "large", "status": "active", "revenue": 3200000, "performance": 95.2 },
            { "id": "BR002", "name": "สาขาเชียงใหม่นิมมาน", "region": "north", "size": "medium", "status": "active", "revenue": 2800000, "performance": 92.8 },
            { "id": "BR003", "name": "สาขาภูเก็ตบิ๊กซี", "region": "south", "size": "large", "status": "active", "revenue": 2900000, "performance": 90.1 },
            { "id": "BR004", "name": "สาขาขอนแก่นเซ็นทรัล", "region": "northeast", "size": "medium", "status": "active", "revenue": 2400000, "performance": 88.7 },
            { "id": "BR005", "name": "สาขาหาดใหญ่ลี การ์เดน", "region": "south", "size": "medium", "status": "active", "revenue": 2200000, "performance": 86.3 },
            { "id": "BR006", "name": "สาขาอุดรธานีซีคอน", "region": "northeast", "size": "small", "status": "active", "revenue": 2100000, "performance": 84.9 },
            { "id": "BR007", "name": "สาขาสมุทรปราการเมกา", "region": "central", "size": "medium", "status": "inactive", "revenue": 2000000, "performance": 83.5 },
            { "id": "BR008", "name": "สาขานครราชสีมาเดอะมอลล์", "region": "northeast", "size": "large", "status": "active", "revenue": 1900000, "performance": 82.1 },
            { "id": "BR009", "name": "สาขาสุราษฎร์ธานีเซ็นทรัล", "region": "south", "size": "small", "status": "active", "revenue": 1800000, "performance": 80.7 },
            { "id": "BR010", "name": "สาขาลพบุรีโรบินสัน", "region": "central", "size": "small", "status": "active", "revenue": 1700000, "performance": 79.3 }
        ]
        
        # Apply filters
        filtered_branches = branches
        
        if region != "all":
            filtered_branches = [b for b in filtered_branches if b["region"] == region]
        
        if size != "all":
            filtered_branches = [b for b in filtered_branches if b["size"] == size]
        
        if status != "all":
            filtered_branches = [b for b in filtered_branches if b["status"] == status]
        
        return {
            "success": True,
            "data": filtered_branches
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.post("/api/bulk-operations/execute")
async def execute_bulk_operation(request: Request):
    try:
        data = await request.json()
        operation_type = data.get("operationType")
        branch_ids = data.get("branchIds", [])
        operation_data = data.get("operationData", {})
        schedule_type = data.get("scheduleType", "immediate")
        
        # Simulate bulk operation execution
        results = []
        for branch_id in branch_ids:
            # Simulate processing with 90% success rate
            success = __import__('random').random() > 0.1
            
            results.append({
                "branchId": branch_id,
                "success": success,
                "message": "สำเร็จ" if success else "ล้มเหลว: ข้อผิดพลาดเชื่อมต่อ",
                "timestamp": int(time.time())
            })
        
        successful = len([r for r in results if r["success"]])
        failed = len([r for r in results if not r["success"]])
        
        return {
            "success": True,
            "data": {
                "operationId": f"OP{int(time.time())}",
                "operationType": operation_type,
                "totalBranches": len(branch_ids),
                "successful": successful,
                "failed": failed,
                "results": results,
                "scheduleType": schedule_type,
                "executedAt": int(time.time())
            },
            "message": f"ดำเนินการแล้วเสร็จ: {successful}/{len(branch_ids)} สาขา"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

# API Routes for Sales Recording System
@app.post("/api/sales")
async def record_sale(request: Request):
    try:
        data = await request.json()
        
        # Validate required fields
        required_fields = ['saleId', 'employeeName', 'branchName', 'items', 'totalAmount', 'timestamp']
        for field in required_fields:
            if field not in data:
                return {
                    "success": False,
                    "message": f"ข้อมูลไม่ครบถ้วน: ไม่พบ {field}"
                }
        
        # Simulate saving to database
        sale_record = {
            "id": data['saleId'],
            "employeeName": data['employeeName'],
            "branchName": data['branchName'],
            "items": data['items'],
            "totalAmount": data['totalAmount'],
            "timestamp": data['timestamp'],
            "type": data.get('type', 'RECORD_ONLY'),
            "status": "RECORDED",
            "createdAt": int(time.time())
        }
        
        # Store in global variable for demo (in real app, save to database)
        global recorded_sales
        if 'recorded_sales' not in globals():
            recorded_sales = []
        recorded_sales.append(sale_record)
        
        return {
            "success": True,
            "data": sale_record,
            "message": "บันทึกการขายสำเร็จ"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

@app.get("/api/sales/live")
async def get_live_sales():
    try:
        # Return sample sales data for demo
        sample_sales = [
            {
                "saleId": "SALE202501171430001",
                "employeeName": "นายสมชาย ใจดี",
                "branchName": "เซ็นทรัล เวสต์เกต",
                "items": [
                    {"name": "มะม่วงอบแห้ง", "quantity": 250, "unit": "กรัม", "total": 62.5}
                ],
                "totalAmount": 62.5,
                "timestamp": "2025-01-17T14:30:00Z"
            },
            {
                "saleId": "SALE202501171425002",
                "employeeName": "นางสาวมาลี รักงาน",
                "branchName": "สยาม พารากอน",
                "items": [
                    {"name": "กล้วยอบแห้ง", "quantity": 300, "unit": "กรัม", "total": 54.0},
                    {"name": "ถั่วผสม", "quantity": 150, "unit": "กรัม", "total": 45.0}
                ],
                "totalAmount": 99.0,
                "timestamp": "2025-01-17T14:25:00Z"
            },
            {
                "saleId": "SALE202501171420003",
                "employeeName": "นายวิชัย ขยัน",
                "branchName": "เอ็มควอเทียร์",
                "items": [
                    {"name": "สับปะรดอบแห้ง", "quantity": 200, "unit": "กรัม", "total": 40.0}
                ],
                "totalAmount": 40.0,
                "timestamp": "2025-01-17T14:20:00Z"
            }
        ]
        
        # Include recorded sales from global variable
        if 'recorded_sales' in globals():
            all_sales = recorded_sales + sample_sales
        else:
            all_sales = sample_sales
            
        # Sort by timestamp (newest first)
        all_sales.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return {
            "success": True,
            "data": all_sales[:50]  # Return latest 50 sales
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"เกิดข้อผิดพลาด: {str(e)}"
        }

if __name__ == "__main__":
    print("🥭 เริ่มต้นระบบจัดการสต๊อคผลไม้อบแห้ง...")
    print("📱 เข้าถึงระบบได้ที่: http://localhost:8001")
    print("📊 แดชบอร์ด: http://localhost:8001/dashboard")
    print("📦 จัดการสต๊อค: http://localhost:8001/inventory")
    print("💰 ระบบขาย: http://localhost:8001/sales")
    print("🚚 ติดตามการจัดส่ง: http://localhost:8001/delivery")
    print("📈 รายงาน: http://localhost:8001/reports")
    print("📱 บาร์โค้ด: http://localhost:8001/barcode")
    print("🛒 จัดซื้อ: http://localhost:8001/purchase")
    print("🏪 จัดการสาขา: http://localhost:8001/branch-management")
    print("✅ อนุมัติสาขา: http://localhost:8001/branch-approval")
    print("🚛 เส้นทางจัดส่ง: http://localhost:8001/branch-delivery-routes")
    print("📦 คลังสินค้าสาขา: http://localhost:8001/branch-inventory")
    print("📊 วิเคราะห์ประสิทธิภาพสาขา: http://localhost:8001/branch-analytics")
    print("🔄 จัดการสาขาแบบกลุ่ม: http://localhost:8001/bulk-branch-operations")
    print("💳 ระบบบันทึกการขาย POS: http://localhost:8001/sales-pos")
    print("📡 ฟีดการขายเรียลไทม์: http://localhost:8001/sales-live-feed")
    print("")
    print("🔐 BRANCH LOGIN SYSTEM:")
    print("🏢 Branch Login: http://localhost:8001/branch-login")
    print("🎯 Branch Selection: http://localhost:8001/branch-selection")
    print("🔑 API Login: http://localhost:8001/api/branch-auth/login")
    print("")
    print("👥 Demo Accounts:")
    print("   🔐 Admin: admin / admin123")
    print("   👨‍💼 Manager: manager001 / 123456")
    print("   👩‍💼 Manager: manager002 / 123456")
    print("   👤 Staff: staff001 / 123456")
    print("   👤 Staff: staff002 / 123456")
    print("   👤 Staff: staff003 / 123456")
    print("")
    print("🏢 Branches:")
    print("   🏬 Central Ladprao (CLP)")
    print("   🏬 Siam Paragon (SPG)")
    print("   🏬 EmQuartier (EMQ)")
    print("")
    print("⏹️  กด Ctrl+C เพื่อหยุดระบบ")
    print("=" * 70)
    
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)

@app.get("/product-management", response_class=HTMLResponse)
async def product_management():
    try:
        with open("web/product-management.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Product Management - กำลังพัฒนา</h1>")

@app.get("/employee-management", response_class=HTMLResponse)
async def employee_management():
    try:
        with open("web/employee-management.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Employee Management - กำลังพัฒนา</h1>")

@app.get("/mall-comparison", response_class=HTMLResponse)
async def mall_comparison():
    try:
        with open("web/mall-comparison.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Mall Comparison - กำลังพัฒนา</h1>")



@app.get("/sales-reports", response_class=HTMLResponse)
async def sales_reports():
    try:
        with open("web/sales-reports.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Sales Reports - กำลังพัฒนา</h1>")

