#!/bin/bash

# 🍇 ระบบจัดการสต๊อคร้านผลไม้อบแห้ง - Branch Login System
# สคริปต์เริ่มต้นระบบ

# สีสำหรับแสดงผล
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ฟังก์ชันแสดงโลโก้
show_logo() {
    echo -e "${YELLOW}"
    echo "╔══════════════════════════════════════════════╗"
    echo "║     🍇 ระบบจัดการสต๊อคร้านผลไม้อบแห้ง        ║"
    echo "║         Branch Login & Lock System          ║"
    echo "║              🏢 เลือกสาขาประจำวัน             ║"
    echo "╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# ฟังก์ชันตรวจสอบระบบ
check_system() {
    echo -e "${CYAN}🔍 ตรวจสอบระบบ...${NC}"
    
    # ตรวจสอบ Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ ไม่พบ Node.js กรุณาติดตั้ง Node.js ก่อน${NC}"
        exit 1
    fi
    
    # ตรวจสอบ npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ ไม่พบ npm กรุณาติดตั้ง npm ก่อน${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
    echo -e "${GREEN}✅ npm: $(npm --version)${NC}"
}

# ฟังก์ชันหยุดเซิร์ฟเวอร์เก่า
stop_old_servers() {
    echo -e "${YELLOW}🛑 หยุดเซิร์ฟเวอร์เก่า...${NC}"
    
    # หยุดเซิร์ฟเวอร์ที่ port 3000-3010
    for port in {3000..3010}; do
        if lsof -ti:$port &> /dev/null; then
            echo -e "   📴 หยุดเซิร์ฟเวอร์ที่ port $port"
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
        fi
    done
    
    # หยุดเซิร์ฟเวอร์ vite ที่อาจจะรันอยู่
    pkill -f "vite.*dev" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    
    sleep 2
    echo -e "${GREEN}✅ หยุดเซิร์ฟเวอร์เก่าเรียบร้อย${NC}"
}

# ฟังก์ชันติดตั้ง dependencies
install_dependencies() {
    echo -e "${CYAN}📦 ติดตั้ง dependencies...${NC}"
    
    cd "frontend"
    
    if [ ! -d "node_modules" ]; then
        echo -e "   🔄 กำลังติดตั้ง packages..."
        npm install
    else
        echo -e "${GREEN}   ✅ node_modules พบแล้ว${NC}"
    fi
    
    cd ..
}

# ฟังก์ชันหา port ที่ว่าง
find_available_port() {
    for port in {3000..3010}; do
        if ! lsof -ti:$port &> /dev/null; then
            echo $port
            return
        fi
    done
    echo 3000
}

# ฟังก์ชันเริ่มเซิร์ฟเวอร์
start_server() {
    echo -e "${PURPLE}🚀 เริ่มเซิร์ฟเวอร์...${NC}"
    
    cd "frontend"
    
    # หา port ที่ว่าง
    PORT=$(find_available_port)
    
    # หา Network IP
    NETWORK_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
    
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════╗"
    echo "║               🎉 ระบบพร้อมใช้งาน!              ║"
    echo "║                                              ║"
    echo "║  💻 Desktop/Laptop:                         ║"
    echo "║     👉 http://localhost:$PORT                   ║"
    echo "║                                              ║"
    echo "║  📱 Mobile/Tablet:                          ║"
    echo "║     👉 http://$NETWORK_IP:$PORT                 ║"
    echo "║                                              ║"
    echo "║  🔄 กด Ctrl+C เพื่อหยุดเซิร์ฟเวอร์             ║"
    echo "╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo -e "${CYAN}📋 ฟีเจอร์ที่ทดสอบได้:${NC}"
    echo -e "   🔐 Branch Login System"
    echo -e "   🏢 Branch Selection (3 สาขา)"
    echo -e "   🔒 Daily Branch Lock"
    echo -e "   🔄 Branch Transfer Request"
    echo -e "   💰 Sales Recording (Manual Weight)"
    echo -e "   📦 Stock Management"
    echo -e "   📊 Analytics Dashboard"
    echo -e "   📱 Touch-Friendly Interface"
    echo ""
    
    # เซ็ต port และเริ่มเซิร์ฟเวอร์
    export PORT=$PORT
    npm run dev
}

# ฟังก์ชันแสดงขั้นตอนการใช้งาน
show_usage() {
    echo -e "${BLUE}"
    echo "📋 ขั้นตอนการทดสอบระบบ:"
    echo ""
    echo "1. 🔐 หน้า Login:"
    echo "   - ใส่ username/password ใดๆ"
    echo "   - กด 'เข้าสู่ระบบ'"
    echo ""
    echo "2. 🏢 หน้าเลือกสาขา:"
    echo "   - เลือกจาก 3 สาขา: สาขาหลัก, สาขาย่อย 1, สาขาย่อย 2"
    echo "   - กด 'เริ่มทำงาน'"
    echo "   - สาขาจะถูกล็อคตลอดวัน"
    echo ""
    echo "3. 🎯 ระบบหลัก:"
    echo "   - ดูข้อมูลสาขาปัจจุบันที่ Header"
    echo "   - ทดสอบ 'ขอย้ายสาขา' (ต้องอนุมัติ)"
    echo "   - ใช้ Sales Recording แบบชั่งน้ำหนัก Manual"
    echo "   - ดู Analytics กราฟที่เสถียร"
    echo ""
    echo "4. 📱 Mobile Testing:"
    echo "   - ใช้ QR Code หรือ URL บน WiFi เดียวกัน"
    echo "   - ทดสอบ Touch Interface"
    echo ""
    echo -e "${NC}"
}

# ฟังก์ชันหลัก
main() {
    clear
    show_logo
    
    echo -e "${CYAN}🔧 เริ่มต้นระบบ...${NC}"
    echo ""
    
    # ตรวจสอบว่าอยู่ในไดเรกทอรี่ที่ถูกต้อง
    if [ ! -d "frontend" ]; then
        echo -e "${RED}❌ ไม่พบโฟลเดอร์ 'frontend'${NC}"
        echo -e "${YELLOW}📁 กรุณารันสคริปต์นี้ในไดเรกทอรี่ที่มีโฟลเดอร์ 'frontend'${NC}"
        exit 1
    fi
    
    check_system
    echo ""
    
    stop_old_servers
    echo ""
    
    install_dependencies
    echo ""
    
    show_usage
    
    # รอให้ผู้ใช้พร้อม
    echo -e "${YELLOW}⏳ กด Enter เพื่อเริ่มเซิร์ฟเวอร์...${NC}"
    read -r
    
    start_server
}

# เรียกใช้ฟังก์ชันหลัก
main