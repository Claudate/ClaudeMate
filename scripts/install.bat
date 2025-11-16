@echo off
echo ========================================
echo Installing Claude Skills Dependencies
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

echo npm version:
npm --version
echo.

echo Installing dependencies...
echo This may take 3-5 minutes...
echo.

npm install

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Installation completed successfully!
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Run 'npm run dev' to start development
    echo 2. Or run 'dev.bat' for quick start
    echo.
) else (
    echo.
    echo ========================================
    echo Installation failed!
    echo ========================================
    echo Please check the error messages above
    echo.
)

pause
