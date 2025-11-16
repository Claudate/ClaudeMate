@echo off
echo ========================================
echo Packaging Claude Skills Application
echo ========================================
echo.

REM Check if dist exists
if not exist "dist\" (
    echo ERROR: Project not built!
    echo Please run 'build.bat' first
    echo.
    pause
    exit /b 1
)

echo Packaging for Windows...
echo This may take 3-5 minutes...
echo.

call npm run package

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Packaging completed successfully!
    echo ========================================
    echo.
    echo Output directory: release/
    echo.
    dir release\
) else (
    echo.
    echo ========================================
    echo Packaging failed!
    echo ========================================
    echo.
)

pause
