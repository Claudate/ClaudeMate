@echo off
echo ========================================
echo Building Claude Skills for Production
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

echo Step 1: Type checking...
call npm run type-check
if %ERRORLEVEL% NEQ 0 (
    echo Type check failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Linting...
call npm run lint
if %ERRORLEVEL% NEQ 0 (
    echo Lint check failed!
    pause
    exit /b 1
)

echo.
echo Step 3: Building...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo Output directory: dist/
echo.

pause
