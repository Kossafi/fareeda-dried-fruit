#!/usr/bin/env python3
"""
ระบบจัดการสต๊อคผลไม้อบแห้ง
Dried Fruit Inventory Management System

วิธีรัน:
python run.py
"""

import subprocess
import sys
import os

def install_requirements():
    """ติดตั้ง dependencies ที่จำเป็น"""
    print("🔧 กำลังติดตั้ง dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ ติดตั้ง dependencies เรียบร้อย")
        return True
    except subprocess.CalledProcessError:
        print("❌ เกิดข้อผิดพลาดในการติดตั้ง dependencies")
        print("💡 ลองรันคำสั่งนี้ด้วยตนเอง: pip install -r requirements.txt")
        return False

def check_python_version():
    """ตรวจสอบเวอร์ชัน Python"""
    if sys.version_info < (3, 7):
        print("❌ ต้องการ Python 3.7 หรือสูงกว่า")
        print(f"🐍 Python เวอร์ชันปัจจุบัน: {sys.version}")
        return False
    print(f"✅ Python เวอร์ชัน: {sys.version}")
    return True

def main():
    print("🥭 ระบบจัดการสต๊อคผลไม้อบแห้ง")
    print("=" * 50)
    
    # ตรวจสอบ Python version
    if not check_python_version():
        return
    
    # ตรวจสอบว่ามี requirements.txt หรือไม่
    if os.path.exists("requirements.txt"):
        # ถามผู้ใช้ว่าต้องการติดตั้ง dependencies หรือไม่
        install = input("🤔 ต้องการติดตั้ง dependencies หรือไม่? (y/n): ").lower().strip()
        if install in ['y', 'yes', 'ใช่', '']:
            if not install_requirements():
                return
    
    print("\n🚀 เริ่มต้นระบบ...")
    print("📱 เข้าถึงระบบได้ที่: http://localhost:8001")
    print("📊 แดชบอร์ด: http://localhost:8001/dashboard")
    print("📦 จัดการสต๊อค: http://localhost:8001/inventory")
    print("💰 ระบบขาย: http://localhost:8001/sales")
    print("🚚 ติดตามการจัดส่ง: http://localhost:8001/delivery")
    print("📈 รายงาน: http://localhost:8001/reports")
    print("📱 บาร์โค้ด: http://localhost:8001/barcode")
    print("🛒 จัดซื้อ: http://localhost:8001/purchase")
    print("\n⏹️  กด Ctrl+C เพื่อหยุดระบบ")
    print("=" * 50)
    
    # รันระบบ
    try:
        import uvicorn
        uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
    except ImportError:
        print("❌ ไม่พบ uvicorn กรุณาติดตั้ง dependencies ก่อน")
        print("💡 รันคำสั่ง: pip install -r requirements.txt")
    except KeyboardInterrupt:
        print("\n👋 ปิดระบบเรียบร้อยแล้ว")
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {e}")

if __name__ == "__main__":
    main()