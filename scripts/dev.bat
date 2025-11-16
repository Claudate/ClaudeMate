@echo off
echo ========================================
echo Starting Claude Skills Development
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo ERROR: Dependencies not installed!
    echo Please run 'install.bat' first
    echo.
    pause
    exit /b 1
)

echo Starting Vite + Electron...
echo.
echo Press Ctrl+C to stop
echo.

npm run dev
