@echo off
REM =====================================================
REM PR'HRAN DAILY SCRAPE
REM Zažene se vsak dan ob 5:00 zjutraj
REM =====================================================

cd /d "C:\Users\lampr\Desktop\PrHran\scraper"

echo =====================================================
echo PR'HRAN DAILY SCRAPE
echo Cas: %date% %time%
echo =====================================================

REM Aktiviraj Python environment če je potrebno
REM call venv\Scripts\activate

REM Zaženi scraper
python full_scrape.py >> logs\daily_scrape_%date:~-4,4%%date:~-7,2%%date:~-10,2%.log 2>&1

echo =====================================================
echo SCRAPE KONCAN: %time%
echo =====================================================
