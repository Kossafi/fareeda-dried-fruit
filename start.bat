@echo off
chcp 65001 > nul
cls

REM 🍇 ระบบจัดการสต๊อคร้านผลไม้อบแห้ง - Branch Login System
REM สคริปต์เริ่มต้นระบบสำหรับ Windows

echo ╔══════════════════════════════════════════════╗
echo ║     🍇 ระบบจัดการสต๊อคร้านผลไม้อบแห้ง        ║
echo ║         Branch Login ^& Lock System          ║
echo ║              🏢 เลือกสาขาประจำวัน             ║
echo ╚══════════════════════════════════════════════╝
echo.

echo 🔍 ตรวจสอบระบบ...

REM ตรวจสอบ Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ไม่พบ Node.js กรุณาติดตั้ง Node.js ก่อน
    echo 👉 https://nodejs.org/
    pause
    exit /b 1
)

REM ตรวจสอบ npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ไม่พบ npm กรุณาติดตั้ง npm ก่อน
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo ✅ Node.js: %NODE_VERSION%
echo ✅ npm: %NPM_VERSION%
echo.

echo 🛑 หยุดเซิร์ฟเวอร์เก่า...
REM หยุดเซิร์ฟเวอร์ที่อาจจะรันอยู่
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo ✅ หยุดเซิร์ฟเวอร์เก่าเรียบร้อย
echo.

REM ตรวจสอบโฟลเดอร์ frontend
if not exist "frontend" (
    echo ❌ ไม่พบโฟลเดอร์ 'frontend'
    echo 📁 กรุณารันสคริปต์นี้ในไดเรกทอรี่ที่มีโฟลเดอร์ 'frontend'
    pause
    exit /b 1
)

echo 📦 ติดตั้ง dependencies...
cd frontend

if not exist "node_modules" (
    echo    🔄 กำลังติดตั้ง packages...
    npm install
) else (
    echo    ✅ node_modules พบแล้ว
)

echo.
echo 📋 ขั้นตอนการทดสอบระบบ:
echo.
echo 1. 🔐 หน้า Login:
echo    - ใส่ username/password ใดๆ
echo    - กด 'เข้าสู่ระบบ'
echo.
echo 2. 🏢 หน้าเลือกสาขา:
echo    - เลือกจาก 3 สาขา: สาขาหลัก, สาขาย่อย 1, สาขาย่อย 2
echo    - กด 'เริ่มทำงาน'
echo    - สาขาจะถูกล็อคตลอดวัน
echo.
echo 3. 🎯 ระบบหลัก:
echo    - ดูข้อมูลสาขาปัจจุบันที่ Header
echo    - ทดสอบ 'ขอย้ายสาขา' (ต้องอนุมัติ)
echo    - ใช้ Sales Recording แบบชั่งน้ำหนัก Manual
echo    - ดู Analytics กราฟที่เสถียร
echo.

echo ⏳ กด Enter เพื่อเริ่มเซิร์ฟเวอร์...
pause >nul

echo.
echo 🚀 เริ่มเซิร์ฟเวอร์...
echo.

REM หา Network IP
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set NETWORK_IP=%%i
    goto :found_ip
)
:found_ip
set NETWORK_IP=%NETWORK_IP: =%

echo ╔══════════════════════════════════════════════╗
echo ║               🎉 ระบบพร้อมใช้งาน!              ║
echo ║                                              ║
echo ║  💻 Desktop/Laptop:                         ║
echo ║     👉 http://localhost:3000                 ║
echo ║                                              ║
echo ║  📱 Mobile/Tablet:                          ║
echo ║     👉 http://%NETWORK_IP%:3000               ║
echo ║                                              ║
echo ║  🔄 กด Ctrl+C เพื่อหยุดเซิร์ฟเวอร์             ║
echo ╚══════════════════════════════════════════════╝
echo.

echo 📋 ฟีเจอร์ที่ทดสอบได้:
echo    🔐 Branch Login System
echo    🏢 Branch Selection (3 สาขา)
echo    🔒 Daily Branch Lock
echo    🔄 Branch Transfer Request
echo    💰 Sales Recording (Manual Weight)
echo    📦 Stock Management
echo    📊 Analytics Dashboard
echo    📱 Touch-Friendly Interface
echo.

REM เริ่มเซิร์ฟเวอร์
npm run dev

pause