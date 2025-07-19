#!/bin/bash

# สคริปต์สำหรับหยุดระบบ Branch Login System

echo "🛑 Stopping Branch Login System..."
echo "================================"

# Function to stop process by PID file
stop_by_pidfile() {
    local name=$1
    local pidfile="logs/${name}.pid"
    
    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        if kill -0 $pid 2>/dev/null; then
            echo "⚠️  Stopping $name (PID: $pid)..."
            kill -9 $pid 2>/dev/null
            rm "$pidfile"
            echo "✅ $name stopped"
        else
            echo "⚠️  $name process not found"
            rm "$pidfile"
        fi
    else
        echo "⚠️  No PID file for $name"
    fi
}

# Function to stop process on port
stop_port() {
    local port=$1
    local name=$2
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "⚠️  Stopping $name on port $port (PID: $pid)..."
        kill -9 $pid 2>/dev/null
        sleep 1
        echo "✅ $name stopped"
    else
        echo "⚠️  No process found on port $port"
    fi
}

# หยุดด้วย PID files
echo "Stopping servers by PID files..."
stop_by_pidfile "backend"
stop_by_pidfile "frontend"

echo ""

# หยุดด้วย ports (backup method)
echo "Checking ports..."
stop_port 5001 "Backend"
stop_port 3001 "Frontend"

echo ""
echo "================================"
echo "✅ All servers stopped"
echo "================================"