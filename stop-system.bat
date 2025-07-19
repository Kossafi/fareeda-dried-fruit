@echo off
REM สคริปต์สำหรับหยุดระบบ Branch Login System บน Windows

echo Stopping Branch Login System...
echo ================================

REM หยุด process ด้วยชื่อ window
echo Stopping servers by window title...
taskkill /F /FI "WINDOWTITLE eq Branch Login Backend*" >nul 2>&1
if %errorlevel% equ 0 (
    echo Backend stopped
) else (
    echo Backend not found
)

taskkill /F /FI "WINDOWTITLE eq Branch Login Frontend*" >nul 2>&1
if %errorlevel% equ 0 (
    echo Frontend stopped
) else (
    echo Frontend not found
)

echo.
echo Checking ports...

REM หยุด process ที่ใช้ port 5001
netstat -ano | findstr :5001 >nul 2>&1
if %errorlevel% equ 0 (
    echo Stopping process on port 5001...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5001 ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    echo Port 5001 cleared
) else (
    echo No process found on port 5001
)

REM หยุด process ที่ใช้ port 3001
netstat -ano | findstr :3001 >nul 2>&1
if %errorlevel% equ 0 (
    echo Stopping process on port 3001...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    echo Port 3001 cleared
) else (
    echo No process found on port 3001
)

echo.
echo ================================
echo All servers stopped
echo ================================
echo.
pause