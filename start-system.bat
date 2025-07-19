@echo off
REM สคริปต์สำหรับรันระบบ Branch Login System บน Windows

echo Starting Branch Login System...
echo ================================

REM ตรวจสอบว่ามี Node.js หรือไม่
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM ตรวจสอบว่ามี npm หรือไม่
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo Node.js version: 
node -v
echo npm version: 
npm -v
echo.

REM สร้างโฟลเดอร์ logs
if not exist logs mkdir logs

REM หยุด process เก่า
echo Checking for existing servers...
echo Stopping old processes...
taskkill /F /FI "WINDOWTITLE eq Branch Login Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Branch Login Frontend*" >nul 2>&1
netstat -ano | findstr :5001 >nul 2>&1
if %errorlevel% equ 0 (
    echo Stopping process on port 5001...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5001 ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)
netstat -ano | findstr :3001 >nul 2>&1
if %errorlevel% equ 0 (
    echo Stopping process on port 3001...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo.
echo Starting Backend Server...
cd backend
if not exist node_modules (
    echo Installing backend dependencies...
    call npm install
)
start "Branch Login Backend" /min cmd /c "npm run dev 2>&1 | tee ../logs/backend.log"

timeout /t 3 /nobreak >nul

echo.
echo Starting Frontend Server...
cd ..\frontend
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
)
start "Branch Login Frontend" /min cmd /c "npm run dev 2>&1 | tee ../logs/frontend.log"

timeout /t 3 /nobreak >nul

cd ..

echo.
echo ================================
echo Branch Login System is ready!
echo.
echo Frontend: http://localhost:3001
echo Backend API: http://localhost:5001/api
echo.
echo Demo Accounts:
echo   Staff: staff001 / 123456
echo   Manager: manager001 / 123456
echo   Admin: admin / admin123
echo.
echo Logs:
echo   - Backend: logs\backend.log
echo   - Frontend: logs\frontend.log
echo.
echo To stop the system, run: stop-system.bat
echo ================================
echo.
echo Press any key to exit...
pause >nul