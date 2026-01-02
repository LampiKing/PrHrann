#!/usr/bin/env python3
"""
🇸🇮 DNEVNA POSODOBITEV - Posodobi samo spremenjene cene
Zažene se vsak dan ob 21:00 (nastavi v cron)
"""

import asyncio
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime
from playwright.async_api import async_playwright
import re
from typing import List, Dict, Optional

# KONFIGURACIJA
SHEET_ID = "1Wj5nqFcd6isnTA_FTgyA7aTRU6tHfTJG3fGGEN15B6Y"
CREDENTIALS_FILE = "credentials.json"

# Vse kategorije
ALL_CATEGORIES = {
    "spar": [
        "sadje-in-zelenjava", "mleko-in-jajca", "meso-in-ribe", "kruh-in-pecivo",
        "pijace", "sladkarije", "konzerve", "zamrznjeno", "osnovna-zivila",
        "zajtrk", "kosmetika", "ciscenje", "hrana-za-zivali"
    ],
    "tus": [
        "sadje-zelenjava", "mleko-jajca", "meso-ribe", "kruh-pecivo",
        "pijace", "sladkarije", "konzerve", "zamrznjeno", "osnovna-zivila",
        "zajtrk", "kosmetika", "ciscila", "hrana-zivali"
    ],
    "mercator": [
        "sadje-in-zelenjava", "mleko-jajca", "meso-ribe", "kruh-pecivo",
        "pijace", "sladkarije", "konzerve", "zamrznjeno", "osnovna-zivila",
        "zajtrk", "kosmetika", "ciscenje", "hrana-zivali"
    ]
}


def parse_price(text: str) -> float:
    """Parsaj ceno"""
    if not text:
        return 0.0
    try:
        text = text.replace("€", "").replace("EUR", "").strip()
        text = text.replace(",", ".")
        match = re.search(r'\d+\.?\d*', text)
        return float(match.group()) if match else 0.0
    except:
        return 0.0


async def scrape_spar_category(page, category: str) -> List[Dict]:
    """Scrape SPAR"""
    products = []
    try:
        url = f"https://online.spar.si/artikli/{category}"
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(2)
        
        for _ in range(10):
            await page.evaluate("window.scrollBy(0, 1500)")
            await asyncio.sleep(0.5)
        
        elements = await page.query_selector_all(".product-tile, .product-item, .product-card, article")
        
        for element in elements:
            try:
                name_elem = await element.query_selector("h2, h3, h4, .product-name, .title")
                if not name_elem:
                    continue
                name = (await name_elem.inner_text()).strip()
                
                price_elem = await element.query_selector(".price, .product-price")
                if not price_elem:
                    continue
                price = parse_price(await price_elem.inner_text())
                
                if price <= 0:
                    continue
                
                sale_price = None
                sale_elem = await element.query_selector(".sale-price, .special-price, .discount-price")
                if sale_elem:
                    sale_price = parse_price(await sale_elem.inner_text())
                
                products.append({
                    "name": name,
                    "price": price,
                    "sale_price": sale_price,
                    "store": "SPAR"
                })
            except:
                continue
    except:
        pass
    
    return products


async def scrape_tus_category(page, category: str) -> List[Dict]:
    """Scrape Tuš"""
    products = []
    try:
        url = f"https://hitrinakup.com/kategorije/{category}"
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(2)
        
        for _ in range(10):
            await page.evaluate("window.scrollBy(0, 1500)")
            await asyncio.sleep(0.5)
        
        elements = await page.query_selector_all(".product, .product-card, .item, article")
        
        for element in elements:
            try:
                name_elem = await element.query_selector("h2, h3, h4, .title, .product-name")
                if not name_elem:
                    continue
                name = (await name_elem.inner_text()).strip()
                
                price_elem = await element.query_selector(".price, .product-price")
                if not price_elem:
                    continue
                price = parse_price(await price_elem.inner_text())
                
                if price <= 0:
                    continue
                
                sale_price = None
                sale_elem = await element.query_selector(".sale-price, .promo-price, .special")
                if sale_elem:
                    sale_price = parse_price(await sale_elem.inner_text())
                
                products.append({
                    "name": name,
                    "price": price,
                    "sale_price": sale_price,
                    "store": "Tuš"
                })
            except:
                continue
    except:
        pass
    
    return products


async def scrape_mercator_category(page, category: str) -> List[Dict]:
    """Scrape Mercator"""
    products = []
    try:
        url = f"https://mercatoronline.si/brskaj/{category}"
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(2)
        
        for _ in range(10):
            await page.evaluate("window.scrollBy(0, 1500)")
            await asyncio.sleep(0.5)
        
        elements = await page.query_selector_all(".product, .product-card, .card, article")
        
        for element in elements:
            try:
                name_elem = await element.query_selector("h2, h3, h4, .name, .title")
                if not name_elem:
                    continue
                name = (await name_elem.inner_text()).strip()
                
                price_elem = await element.query_selector(".price, .product-price")
                if not price_elem:
                    continue
                price = parse_price(await price_elem.inner_text())
                
                if price <= 0:
                    continue
                
                sale_price = None
                sale_elem = await element.query_selector(".sale, .action-price, .discount")
                if sale_elem:
                    sale_price = parse_price(await sale_elem.inner_text())
                
                products.append({
                    "name": name,
                    "price": price,
                    "sale_price": sale_price,
                    "store": "Mercator"
                })
            except:
                continue
    except:
        pass
    
    return products


async def scrape_all_products():
    """Scrape vse izdelke"""
    print(f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Scraping...\n")
    
    all_products = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        
        try:
            # SPAR
            print("🛒 SPAR...", end=" ", flush=True)
            page_spar = await context.new_page()
            for category in ALL_CATEGORIES["spar"]:
                products = await scrape_spar_category(page_spar, category)
                all_products.extend(products)
            await page_spar.close()
            print(f"✅ {sum(1 for p in all_products if p['store'] == 'SPAR')}")
            
            # Tuš
            print("🛒 Tuš...", end=" ", flush=True)
            page_tus = await context.new_page()
            for category in ALL_CATEGORIES["tus"]:
                products = await scrape_tus_category(page_tus, category)
                all_products.extend(products)
            await page_tus.close()
            print(f"✅ {sum(1 for p in all_products if p['store'] == 'Tuš')}")
            
            # Mercator
            print("🛒 Mercator...", end=" ", flush=True)
            page_mercator = await context.new_page()
            for category in ALL_CATEGORIES["mercator"]:
                products = await scrape_mercator_category(page_mercator, category)
                all_products.extend(products)
            await page_mercator.close()
            print(f"✅ {sum(1 for p in all_products if p['store'] == 'Mercator')}")
            
        finally:
            await browser.close()
    
    return all_products


def update_google_sheet(new_products: List[Dict]):
    """Posodobi samo spremenjene cene v Google Sheet"""
    print("\n📊 Posodabljam Google Sheet...")
    
    try:
        # Povezava
        scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        
        creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
        client = gspread.authorize(creds)
        sheet = client.open_by_key(SHEET_ID).sheet1
        
        # Preberi obstoječe podatke
        print("  📖 Berem obstoječe podatke...")
        existing_data = sheet.get_all_records()
        
        # Ustvari lookup dict (ime+trgovina -> row index)
        lookup = {}
        for idx, row in enumerate(existing_data, start=2):  # start=2 ker je row 1 header
            key = f"{row['Ime izdelka']}_{row['Trgovina']}"
            lookup[key] = {
                'index': idx,
                'price': row['Cena'],
                'sale_price': row.get('Akcijska cena', '')
            }
        
        # Pripravi batch posodobitve
        updates = []
        new_items = []
        unchanged = 0
        date_str = datetime.now().strftime("%Y-%m-%d")
        
        print("  🔍 Preverjam spremembe...")
        
        for product in new_products:
            key = f"{product['name']}_{product['store']}"
            
            if key in lookup:
                # Izdelek obstaja - preveri ceno
                old = lookup[key]
                new_price = product['price']
                new_sale = product['sale_price'] if product['sale_price'] else ""
                
                # Ali se je spremenila cena?
                price_changed = (new_price != old['price'])
                sale_changed = (new_sale != old['sale_price'])
                
                if price_changed or sale_changed:
                    # Posodobi ceno
                    row_idx = old['index']
                    updates.append({
                        'range': f'B{row_idx}:E{row_idx}',
                        'values': [[new_price, new_sale, product['store'], date_str]]
                    })
                else:
                    unchanged += 1
            else:
                # Nov izdelek - dodaj
                new_items.append([
                    product['name'],
                    product['price'],
                    product['sale_price'] if product['sale_price'] else "",
                    product['store'],
                    date_str
                ])
        
        # Izvedi posodobitve
        if updates:
            print(f"  ✏️  Posodabljam {len(updates)} izdelkov...")
            sheet.batch_update(updates)
        
        if new_items:
            print(f"  ➕ Dodajam {len(new_items)} novih izdelkov...")
            sheet.append_rows(new_items)
        
        # Statistika
        print(f"\n📊 REZULTAT:")
        print(f"  ✅ Posodobljenih: {len(updates)}")
        print(f"  ➕ Dodanih: {len(new_items)}")
        print(f"  ⏭️  Nespremenjenih: {unchanged}")
        print(f"  📦 Skupaj obdelanih: {len(new_products)}")
        
    except FileNotFoundError:
        print(f"❌ {CREDENTIALS_FILE} ne obstaja!")
    except Exception as e:
        print(f"❌ Napaka: {e}")


async def main():
    """Glavna funkcija"""
    print("\n" + "=" * 80)
    print("🔄 DNEVNA POSODOBITEV CEN")
    print("=" * 80)
    
    # Scrape
    products = await scrape_all_products()
    
    if products:
        # Posodobi Sheet
        update_google_sheet(products)
        print("\n✅ Posodobitev končana!")
    else:
        print("\n❌ Ni zbranih izdelkov!")
    
    print("=" * 80 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
