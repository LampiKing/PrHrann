@echo off
echo ========================================
echo Pr'Hran - Primerjava cen izdelkov
echo ========================================
echo.

cd /d "%~dp0"

echo Prenasam podatke iz trgovin...
python product_matcher_intelligent.py

echo.
echo Rezultati shranjeni v:
echo   - matched_products_latest.csv
echo   - matched_products.json
echo.

:: Kopiraj v glavni projekt
copy /Y matched_products_latest.csv "..\..\matched_products.csv" >nul 2>&1
copy /Y matched_products.json "..\..\matched_products.json" >nul 2>&1

echo Datoteke kopirane v projekt.
echo.
pause
