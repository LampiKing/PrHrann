@echo off
REM Installation script for prhran product matching system
REM Usage: install.bat

echo ================================
echo PRHRAN System Installation
echo ================================
echo.

REM Check if Python is installed
echo Checking Python installation...
python3 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python 3 is not installed
    echo Please install Python 3 from https://www.python.org/downloads/
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python3 --version 2^>^&1') do set PYTHON_VERSION=%%i
echo Python %PYTHON_VERSION% found
echo.

REM Install requirements
echo Installing Python dependencies...
pip3 install -r requirements.txt

if %errorlevel% neq 0 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo Dependencies installed successfully
echo.
echo ================================
echo Installation Complete!
echo ================================
echo.
echo Next steps:
echo 1. Run: python3 product_matcher_intelligent.py
echo 2. Check results in: matched_products_latest.csv
echo.
echo For continuous updates:
echo python3 product_matcher_intelligent.py watch
echo.
pause
