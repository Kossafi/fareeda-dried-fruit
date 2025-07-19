#!/bin/bash

# สคริปต์สำหรับรันระบบ Branch Login System
# ทำงานบน macOS และ Linux

echo "🚀 Starting Branch Login System..."
echo "================================"

# ตรวจสอบว่ามี Node.js หรือไม่
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# ตรวจสอบว่ามี npm หรือไม่
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ npm version: $(npm -v)"
echo ""

# Function to stop process on port
stop_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "⚠️  Stopping process on port $port (PID: $pid)..."
        kill -9 $pid 2>/dev/null
        sleep 1
    fi
}

# Function to start server
start_server() {
    local name=$1
    local dir=$2
    local port=$3
    
    echo "🔧 Starting $name..."
    cd "$dir"
    
    # ตรวจสอบว่ามี node_modules หรือไม่
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies for $name..."
        npm install
    fi
    
    # หยุด process เก่าที่ใช้ port นี้
    stop_port $port
    
    # เริ่ม server
    if [ "$name" == "Backend" ]; then
        npm run dev > ../logs/${name,,}.log 2>&1 &
    else
        npm run dev > ../logs/${name,,}.log 2>&1 &
    fi
    
    local pid=$!
    echo "$pid" > "../logs/${name,,}.pid"
    
    echo "✅ $name started (PID: $pid)"
    cd ..
}

# สร้างโฟลเดอร์ logs
mkdir -p logs

# หยุด servers เก่า
echo "🔍 Checking for existing servers..."
stop_port 5001  # Backend
stop_port 3001  # Frontend

# เริ่ม Backend
echo ""
echo "📡 Starting Backend Server..."
start_server "Backend" "backend" 5001

# รอให้ Backend พร้อม
echo "⏳ Waiting for Backend to be ready..."
sleep 3

# เริ่ม Frontend
echo ""
echo "🎨 Starting Frontend Server..."
start_server "Frontend" "frontend" 3001

# รอให้ Frontend พร้อม
echo "⏳ Waiting for Frontend to be ready..."
sleep 3

echo ""
echo "================================"
echo "✨ Branch Login System is ready!"
echo ""
echo "🌐 Frontend: http://localhost:3001"
echo "🔧 Backend API: http://localhost:5001/api"
echo ""
echo "📋 Demo Accounts:"
echo "  👤 Staff: staff001 / 123456"
echo "  👨‍💼 Manager: manager001 / 123456"
echo "  🔐 Admin: admin / admin123"
echo ""
echo "📊 Logs:"
echo "  - Backend: logs/backend.log"
echo "  - Frontend: logs/frontend.log"
echo ""
echo "To stop the system, run: ./stop-system.sh"
echo "================================"

# Keep script running
echo ""
echo "Press Ctrl+C to stop all servers..."

# Trap SIGINT (Ctrl+C) to stop all servers
trap 'echo ""; echo "Stopping all servers..."; ./stop-system.sh; exit' INT

# Wait indefinitely
while true; do
    sleep 1
done