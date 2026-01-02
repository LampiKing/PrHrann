#!/usr/bin/env python3
"""
🇸🇮 PRVI ZAGON - Scrape VSE izdelke in vpiši v Google Sheet
Enkratna akcija - pridobi ~15.000+ izdelkov
"""

import argparse
import asyncio
import os
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime
from playwright.async_api import async_playwright
import re
import unicodedata
from typing import List, Dict, Optional
import requests

# KONFIGURACIJA
SHEET_ID = os.getenv("PRHRAN_SHEET_ID", "1Wj5nqFcd6isnTA_FTgyA7aTRU6tHfTJG3fGGEN15B6Y")
CREDENTIALS_FILE = os.getenv("PRHRAN_CREDENTIALS_FILE", "credentials.json")
INGEST_URL = os.getenv("PRHRAN_INGEST_URL")
INGEST_TOKEN = os.getenv("PRHRAN_INGEST_TOKEN")

# Vse kategorije za vse izdelke
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


def normalize_store(value: str) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized.lower()).strip()
    if "spar" in normalized:
        return "Spar"
    if "mercator" in normalized:
        return "Mercator"
    if "tus" in normalized or "hitri" in normalized or normalized.startswith("tu"):
        return "Tus"
    return value.strip()


def format_category(value: str) -> str:
    if not value:
        return "Neznana kategorija"
    return value.replace("-", " ").replace("_", " ").title()


def normalize_sale_price(price: float, sale_price: Optional[float]) -> Optional[float]:
    if sale_price is None:
        return None
    return sale_price if sale_price < price else None


class Product:
    def __init__(self, name: str, price: float, sale_price: Optional[float], 
                 store: str, category: str, date: str):
        self.name = name.strip()
        self.price = price
        self.sale_price = sale_price
        self.store = store
        self.category = category
        self.date = date
    
    def to_row(self) -> List:
        """Vrne vrstico za Google Sheet"""
        return [
            self.name,
            self.price,
            self.sale_price if self.sale_price else "",
            self.store,
            self.date
        ]

    def to_convex_item(self) -> Dict:
        """Vrne zapis za Convex ingest."""
        return {
            "ime": self.name,
            "redna_cena": self.price,
            "akcijska_cena": normalize_sale_price(self.price, self.sale_price),
            "kategorija": format_category(self.category),
            "trgovina": normalize_store(self.store),
        }


def parse_price(text: str) -> float:
    """Parsaj ceno iz teksta"""
    if not text:
        return 0.0
    try:
        text = text.replace("€", "").replace("EUR", "").strip()
        text = text.replace(",", ".")
        match = re.search(r'\d+\.?\d*', text)
        return float(match.group()) if match else 0.0
    except:
        return 0.0


async def scrape_spar_category(page, category: str) -> List[Product]:
    """Scrape SPAR kategorijo"""
    products = []
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    try:
        url = f"https://online.spar.si/artikli/{category}"
        print(f"  📂 SPAR/{category}...", end=" ", flush=True)
        
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(2)
        
        # Scroll za vse izdelke
        for _ in range(10):
            await page.evaluate("window.scrollBy(0, 1500)")
            await asyncio.sleep(0.5)
        
        # Pridobi vse elemente
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
                price_text = await price_elem.inner_text()
                price = parse_price(price_text)
                
                if price <= 0:
                    continue
                
                sale_price = None
                sale_elem = await element.query_selector(".sale-price, .special-price, .discount-price")
                if sale_elem:
                    sale_text = await sale_elem.inner_text()
                    sale_price = parse_price(sale_text)
                
                products.append(Product(name, price, sale_price, "Spar", category, date_str))
            except:
                continue
        
        print(f"✅ {len(products)}")
    except Exception as e:
        print(f"❌ {e}")
    
    return products


async def scrape_tus_category(page, category: str) -> List[Product]:
    """Scrape Tuš kategorijo"""
    products = []
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    try:
        url = f"https://hitrinakup.com/kategorije/{category}"
        print(f"  📂 Tuš/{category}...", end=" ", flush=True)
        
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
                
                products.append(Product(name, price, sale_price, "Tus", category, date_str))
            except:
                continue
        
        print(f"✅ {len(products)}")
    except Exception as e:
        print(f"❌ {e}")
    
    return products


async def scrape_mercator_category(page, category: str) -> List[Product]:
    """Scrape Mercator kategorijo"""
    products = []
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    try:
        url = f"https://mercatoronline.si/brskaj/{category}"
        print(f"  📂 Mercator/{category}...", end=" ", flush=True)
        
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
                
                products.append(Product(name, price, sale_price, "Mercator", category, date_str))
            except:
                continue
        
        print(f"✅ {len(products)}")
    except Exception as e:
        print(f"❌ {e}")
    
    return products


async def scrape_all_products():
    """Scrape VSE izdelke iz VSEH trgovin"""
    print("\n" + "=" * 80)
    print("🇸🇮 PRVI ZAGON - SCRAPING VSEH IZDELKOV")
    print("=" * 80)
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    print("⚠️  To bo trajalo 30-60 minut za ~15.000+ izdelkov!\n")
    
    all_products = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        
        try:
            # SPAR
            print("🛒 SPAR")
            print("-" * 80)
            page_spar = await context.new_page()
            for category in ALL_CATEGORIES["spar"]:
                products = await scrape_spar_category(page_spar, category)
                all_products.extend(products)
                await asyncio.sleep(2)
            await page_spar.close()
            print(f"  ✅ SPAR skupaj: {sum(1 for p in all_products if p.store == 'Spar')} izdelkov\n")
            
            # Tuš
            print("🛒 TUŠ")
            print("-" * 80)
            page_tus = await context.new_page()
            for category in ALL_CATEGORIES["tus"]:
                products = await scrape_tus_category(page_tus, category)
                all_products.extend(products)
                await asyncio.sleep(2)
            await page_tus.close()
            print(f"  ✅ Tuš skupaj: {sum(1 for p in all_products if p.store == 'Tus')} izdelkov\n")
            
            # Mercator
            print("🛒 MERCATOR")
            print("-" * 80)
            page_mercator = await context.new_page()
            for category in ALL_CATEGORIES["mercator"]:
                products = await scrape_mercator_category(page_mercator, category)
                all_products.extend(products)
                await asyncio.sleep(2)
            await page_mercator.close()
            print(f"  ✅ Mercator skupaj: {sum(1 for p in all_products if p.store == 'Mercator')} izdelkov\n")
            
        finally:
            await browser.close()
    
    return all_products


def write_to_google_sheet(products: List[Product]):
    """Vpiši vse izdelke v Google Sheet"""
    print("\n" + "=" * 80)
    print("📊 PISANJE V GOOGLE SHEET")
    print("=" * 80)
    
    try:
        # Povezava z Google Sheets
        scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        
        creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
        client = gspread.authorize(creds)
        
        # Odpri sheet
        sheet = client.open_by_key(SHEET_ID).sheet1
        
        # Počisti obstoječe podatke
        print("🧹 Čistim obstoječe podatke...")
        sheet.clear()
        
        # Header
        header = ["Ime izdelka", "Cena", "Akcijska cena", "Trgovina", "Datum"]
        sheet.append_row(header)
        
        # Formatiraj header
        sheet.format('A1:E1', {
            'textFormat': {'bold': True},
            'backgroundColor': {'red': 0.2, 'green': 0.4, 'blue': 0.8}
        })
        
        print(f"📝 Pišem {len(products)} izdelkov...")
        
        # Vpiši v batch-ih (100 vrstic naenkrat za hitrost)
        batch_size = 100
        for i in range(0, len(products), batch_size):
            batch = products[i:i+batch_size]
            rows = [p.to_row() for p in batch]
            sheet.append_rows(rows)
            print(f"  ✅ {min(i+batch_size, len(products))}/{len(products)}")
        
        print(f"\n✅ USPEŠNO! Vpisanih {len(products)} izdelkov v Google Sheet")
        print(f"🔗 https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit")
        
    except FileNotFoundError:
        print(f"❌ NAPAKA: {CREDENTIALS_FILE} ne obstaja!")
        print("\n📝 NAVODILA:")
        print("1. Pojdi na: https://console.cloud.google.com/")
        print("2. Ustvari Service Account")
        print("3. Prenesi credentials.json v ta direktorij")
        print("4. 'Share' Google Sheet s Service Account emailom")
    except Exception as e:
        print(f"❌ NAPAKA: {e}")


def build_convex_items(products: List[Product]) -> List[Dict]:
    items = []
    for product in products:
        item = product.to_convex_item()
        if not item.get("trgovina") or not item.get("redna_cena"):
            continue
        if item["redna_cena"] <= 0:
            continue
        items.append(item)
    return items


def upload_to_convex(items: List[Dict]) -> None:
    if not INGEST_URL or not INGEST_TOKEN:
        print("Upload preskocen: manjka PRHRAN_INGEST_URL ali PRHRAN_INGEST_TOKEN.")
        return
    if not items:
        print("Upload preskocen: ni izdelkov za poslati.")
        return
    try:
        response = requests.post(
            INGEST_URL,
            headers={
                "Authorization": f"Bearer {INGEST_TOKEN}",
                "Content-Type": "application/json",
            },
            json={"items": items},
            timeout=120,
        )
        response.raise_for_status()
        print(f"Upload OK: {response.status_code}")
    except Exception as e:
        print(f"Upload napaka: {e}")


def parse_args():
    parser = argparse.ArgumentParser(description="Prvi zagon scrapanja.")
    parser.add_argument("--upload", action="store_true", help="Poslji podatke v Convex.")
    return parser.parse_args()


async def main(upload: bool):
    """Glavna funkcija"""
    
    # Scrape vse izdelke
    products = await scrape_all_products()
    
    # Izpiši statistiko
    print("\n" + "=" * 80)
    print("📊 STATISTIKA")
    print("=" * 80)
    print(f"📦 Skupaj izdelkov: {len(products)}")
    print(f"   • SPAR: {sum(1 for p in products if p.store == 'Spar')}")
    print(f"   • Tuš: {sum(1 for p in products if p.store == 'Tus')}")
    print(f"   • Mercator: {sum(1 for p in products if p.store == 'Mercator')}")
    print(f"🎁 Na akciji: {sum(1 for p in products if p.sale_price)}")
    
    if products:
        # Vpiši v Google Sheet
        write_to_google_sheet(products)
        if upload:
            items = build_convex_items(products)
            upload_to_convex(items)
    else:
        print("\n❌ Ni zbranih izdelkov!")
    
    print("\n" + "=" * 80)
    print("✅ PRVI ZAGON KONČAN!")
    print("=" * 80)
    print("\n💡 Naslednji korak: Zaženi 'daily_update.py' za dnevno posodabljanje\n")


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(main(args.upload))
