@echo off
echo ========================================
echo Starting Claude Skills Development
echo ========================================
echo.

REM Kill any existing processes on port 5173
echo Checking for existing processes on port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    if not "%%a"=="0" (
        echo Killing process %%a...
        taskkill /PID %%a /F >nul 2>&1
    )
)

echo Waiting for port to be released...
timeout /t 3 /nobreak >nul

echo.
echo Starting development server...
echo.

cd /d %~dp0
npm run dev
