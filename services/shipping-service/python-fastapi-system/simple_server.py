#!/usr/bin/env python3
"""
Simple FastAPI server for testing
"""
import sys
import os
sys.path.insert(0, os.getcwd())

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn
import json
import asyncio
from typing import List

# Simple FastAPI app
app = FastAPI(
    title="Dried Fruits Inventory System",
    description="ระบบจัดการสินค้าผลไม้แห้ง",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup templates
templates = Jinja2Templates(directory="templates")

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Remove disconnected clients
                self.active_connections.remove(connection)

manager = ConnectionManager()

# Import models
from app.models.user import User, UserRole
from app.models.product import Product, ProductCategory, Unit
from app.core.database import SessionLocal, get_db
from app.core.security import verify_password, create_access_token

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Root endpoint with HTML UI"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Dashboard page"""
    return templates.TemplateResponse("dashboard.html", {"request": request})

@app.get("/inventory", response_class=HTMLResponse)
async def inventory(request: Request):
    """Inventory management page"""
    return templates.TemplateResponse("inventory.html", {"request": request})

@app.get("/sales", response_class=HTMLResponse)
async def sales(request: Request):
    """Sales recording page"""
    return templates.TemplateResponse("sales.html", {"request": request})

@app.get("/barcode", response_class=HTMLResponse)
async def barcode(request: Request):
    """Barcode scanner page"""
    return templates.TemplateResponse("barcode.html", {"request": request})

@app.get("/delivery", response_class=HTMLResponse)
async def delivery(request: Request):
    """Delivery tracking page"""
    return templates.TemplateResponse("delivery.html", {"request": request})

@app.get("/reports", response_class=HTMLResponse)
async def reports(request: Request):
    """Reports and analytics page"""
    return templates.TemplateResponse("reports.html", {"request": request})

@app.get("/purchase", response_class=HTMLResponse)
async def purchase(request: Request):
    """Purchase order system page"""
    return templates.TemplateResponse("purchase.html", {"request": request})

@app.get("/goods-receipt", response_class=HTMLResponse)
async def goods_receipt(request: Request):
    """Goods receipt page"""
    return templates.TemplateResponse("goods-receipt.html", {"request": request})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Handle different message types
            if message_data.get("type") == "ping":
                await manager.send_personal_message(
                    json.dumps({"type": "pong", "timestamp": message_data.get("timestamp")}),
                    websocket
                )
            elif message_data.get("type") == "subscribe":
                # Subscribe to real-time updates
                await manager.send_personal_message(
                    json.dumps({"type": "subscribed", "channel": message_data.get("channel")}),
                    websocket
                )
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/api/broadcast")
async def broadcast_message(message: dict):
    """Broadcast message to all connected clients"""
    await manager.broadcast(json.dumps(message))
    return {"status": "broadcasted"}

# Background task for real-time updates simulation
async def simulate_realtime_updates():
    """Simulate real-time updates for demo purposes"""
    import random
    import time
    
    while True:
        await asyncio.sleep(10)  # Update every 10 seconds
        
        if len(manager.active_connections) > 0:
            # Simulate random events
            event_type = random.choice(['stock_update', 'new_sale', 'low_stock_alert', 'new_delivery'])
            
            if event_type == 'stock_update':
                products = ['มะม่วงแห้ง', 'ลูกเกดแห้ง', 'แอปเปิ้ลแห้ง', 'กล้วยแห้ง', 'สับปะรดแห้ง']
                product_name = random.choice(products)
                new_stock = random.randint(50, 500)
                
                message = {
                    "type": "stock_update",
                    "product": {
                        "name": product_name,
                        "unit": "กรัม"
                    },
                    "newStock": new_stock,
                    "timestamp": time.time()
                }
                
            elif event_type == 'new_sale':
                products = ['มะม่วงแห้ง', 'ลูกเกดแห้ง', 'แอปเปิ้ลแห้ง', 'กล้วยแห้ง', 'สับปะรดแห้ง']
                product_name = random.choice(products)
                quantity = random.randint(1, 10)
                
                message = {
                    "type": "new_sale",
                    "sale": {
                        "product": product_name,
                        "quantity": quantity,
                        "amount": random.randint(100, 1000)
                    },
                    "timestamp": time.time()
                }
                
            elif event_type == 'low_stock_alert':
                products = ['มะม่วงแห้ง', 'ลูกเกดแห้ง', 'แอปเปิ้ลแห้ง', 'กล้วยแห้ง', 'สับปะรดแห้ง']
                product_name = random.choice(products)
                
                message = {
                    "type": "low_stock_alert",
                    "product": {
                        "name": product_name,
                        "stock": random.randint(5, 20),
                        "unit": "กรัม"
                    },
                    "timestamp": time.time()
                }
                
            elif event_type == 'new_delivery':
                branches = ['สาขาสยาม', 'สาขาเซ็นทรัล', 'สาขาพรอมพ์ทอง', 'สาขาอโศก']
                branch_name = random.choice(branches)
                delivery_id = f"DEL{random.randint(1000, 9999)}"
                
                message = {
                    "type": "new_delivery",
                    "delivery": {
                        "id": delivery_id,
                        "customer": branch_name,
                        "status": "preparing"
                    },
                    "timestamp": time.time()
                }
            
            try:
                await manager.broadcast(json.dumps(message))
            except Exception as e:
                print(f"Error broadcasting message: {e}")

# Start background task
@app.on_event("startup")
async def startup_event():
    """Start background tasks"""
    asyncio.create_task(simulate_realtime_updates())

@app.get("/api")
async def api_root():
    """API root endpoint"""
    return {
        "message": "ยินดีต้อนรับสู่ระบบจัดการสินค้าผลไม้แห้ง! 🥭",
        "system": "Dried Fruits Inventory System",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }

@app.get("/favicon.ico")
async def favicon():
    """Favicon endpoint"""
    from fastapi.responses import Response
    # Simple emoji favicon
    favicon_svg = """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
        <text x="2" y="12" font-size="12">🥭</text>
    </svg>"""
    return Response(content=favicon_svg, media_type="image/svg+xml")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "system": "Dried Fruits Inventory System",
        "message": "ระบบทำงานปกติ"
    }

@app.post("/login")
async def login(username: str, password: str):
    """Simple login endpoint"""
    try:
        db = SessionLocal()
        user = db.query(User).filter(User.username == username).first()
        
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        access_token = create_access_token(data={"sub": user.username})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role.value
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.get("/products")
async def get_products():
    """Get all products"""
    try:
        db = SessionLocal()
        products = db.query(Product).all()
        
        result = []
        for product in products:
            result.append({
                "id": product.id,
                "name": product.product_name,
                "name_en": product.product_name_en,
                "sku": product.sku,
                "price": product.unit_price,
                "category": product.category.value,
                "unit": product.unit.value
            })
        
        return {
            "products": result,
            "total": len(result)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.get("/users")
async def get_users():
    """Get all users"""
    try:
        db = SessionLocal()
        users = db.query(User).all()
        
        result = []
        for user in users:
            result.append({
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role.value,
                "is_active": user.is_active
            })
        
        return {
            "users": result,
            "total": len(result)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 เริ่มเซิร์ฟเวอร์ Dried Fruits Inventory System")
    print("=" * 50)
    print("📊 API Documentation: http://localhost:8001/docs")
    print("🔍 ReDoc: http://localhost:8001/redoc")
    print("❤️ Health Check: http://localhost:8001/health")
    print("🔐 Login: POST /login")
    print("🥭 Products: GET /products")
    print("👥 Users: GET /users")
    print("=" * 50)
    print("🔐 ข้อมูลเข้าสู่ระบบ:")
    print("   Username: admin")
    print("   Password: admin123")
    print("=" * 50)
    
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")