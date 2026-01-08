#!/usr/bin/env python3
"""
Slovenian Grocery Price Scanner (Playwright Edition)
Skeniraj cene iz: Spar Online, Mercator Online, Hitri Nakup
"""

import asyncio
import argparse
import json
import os
import re
import logging
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import urljoin
from playwright.async_api import async_playwright, Page, BrowserContext

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DATA_DIR = "cene_data"
CURRENT_FILE = os.path.join(DATA_DIR, "trenutne_cene.json")
HISTORY_DIR = os.path.join(DATA_DIR, "zgodovina")
CHANGES_DIR = os.path.join(DATA_DIR, "spremembe")

class HeadlessScanner:
    def __init__(self, name: str, base_url: str):
        self.name = name
        self.base_url = base_url
        self.products = []
        self.store_key = ""

    async def scan(self, context: BrowserContext) -> List[Dict]:
        """Base scan method to be implemented by subclasses"""
        return []

    async def auto_scroll(self, page: Page):
        """Scrolls down to trigger infinite scroll loading"""
        logger.info("  Scrolling...")
        previous_height = await page.evaluate("document.body.scrollHeight")
        while True:
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(2000)
            new_height = await page.evaluate("document.body.scrollHeight")
            if new_height == previous_height:
                break
            previous_height = new_height

    def pars_price(self, price_str: str) -> Optional[float]:
        if not price_str:
            return None
        # Remove non-numeric except , and .
        clean = re.sub(r'[^\d,.]', '', price_str)
        # 1.234,56 -> 1234.56
        # 12,34 -> 12.34
        if ',' in clean and '.' in clean:
            clean = clean.replace('.', '').replace(',', '.')
        elif ',' in clean:
            clean = clean.replace(',', '.')
        
        try:
            return float(clean)
        except:
            return None

    async def extract_unit(self, item_element) -> Optional[str]:
        """Attempts to find unit/quantity in the product card"""
        try:
            # Common selectors for unit/quantity
            text_content = await item_element.inner_text()
            # Look for patterns like "1 l", "500 g", "10/1"
            # Regex for quantity: number + space? + unit
            match = re.search(r'(\d+(?:[.,]\d+)?)\s*(l|ml|g|kg|kos|kom)', text_content, re.IGNORECASE)
            if match:
                return f"{match.group(1).replace(',', '.').strip()}{match.group(2).lower()}"
            return None
        except:
            return None

class SparScanner(HeadlessScanner):
    def __init__(self):
        super().__init__("Spar Online", "https://online.spar.si")
        self.store_key = "spar"

    async def scan(self, context: BrowserContext) -> List[Dict]:
        logger.info(f"Scanning {self.name}...")
        page = await context.new_page()
        
        # Spar usually has a few main categories exposed or searches.
        # For full scan, we might need to visit main categories.
        # Let's try searching for "mleko" first or visiting a known category to prove it works.
        # Better: Visit "Vsi izdelki" or similar if possible. Spar structure is complex.
        # Let's try a few robust categories.
        categories = [
            "/blagovne-znamke-in-posebna-prehrana/bio-in-druga-posebna-prehrana",
            "/sadje-in-zelenjava",
            "/mlecni-izdelki-in-jajca/mleko",
            "/kruh-pecivo-in-slascice/kruh",
             # add more logic to discover later
        ]

        for cat in categories:
            url = f"{self.base_url}{cat}"
            logger.info(f"  Visiting {url}")
            try:
                await page.goto(url, timeout=60000)
                
                # Accept Cookies
                try:
                    await page.click("#onetrust-accept-btn-handler", timeout=5000)
                    logger.info("  Cookies accepted")
                except:
                    pass

                # Wait for products
                try:
                    await page.wait_for_selector(".product-item, .product-card", timeout=10000)
                except:
                    logger.warning("  No products found on basic load")
                    continue

                await self.auto_scroll(page)
                
                # Extract
                # Update selectors based on dump analysis - trying stid and generic class
                items = await page.query_selector_all('[data-testid*="productCard"], [stid*="productCard"], [class*="productCard"], .product-item, .product-card')
                logger.info(f"  Found {len(items)} elements, parsing...")
                
                if not items:
                    logger.warning("  No items found in DOM")
                    await page.screenshot(path=f"debug_spar_no_items_{cat.replace('/', '_')}.png")
                
                for item in items:
                    try:
                        # Try multiple selectors for name. Image alt is often a good backup.
                        name_el = await item.query_selector("h4, .product-title, .title, a.title, .product-name, [data-testid='product-title']")
                        if name_el:
                            name = await name_el.inner_text()
                        else:
                            # Fallback to image alt
                            img_el = await item.query_selector("img")
                            if img_el:
                                name = await img_el.get_attribute("alt")
                            else:
                                continue
                                
                        if not name: continue
                        
                        # Try multiple selectors for price including looking for text with €
                        price_el = await item.query_selector(".price-value, .price, .current-price, .product-price, [data-testid='price']")
                        price_text = await price_el.inner_text() if price_el else ""
                        price = self.pars_price(price_text)
                        
                        unit = await self.extract_unit(item)
                        
                        self.products.append({
                            "ime": name.strip(),
                            "redna_cena": price,
                            "akcijska_cena": None,
                            "trgovina": self.name,
                            "kategorija": cat,
                            "enota": unit
                        })
                    except Exception as e:
                        continue
                logger.info(f"  Parsed {len(self.products)} products so far")
                # Save incrementally for debugging
                try:
                    with open("cene_data/trenutne_cene.json", "w", encoding="utf-8") as f:
                        json.dump(self.products, f, ensure_ascii=False, indent=2)
                except:
                    pass
                        
            except Exception as e:
                logger.error(f"  Error scanning {cat}: {e}")

        await page.close()
        return self.products

class MercatorScanner(HeadlessScanner):
    def __init__(self):
        super().__init__("Mercator Online", "https://trgovina.mercator.si")
        self.store_key = "mercator"

    async def scan(self, context: BrowserContext) -> List[Dict]:
        logger.info(f"Scanning {self.name}...")
        page = await context.new_page()
        
        # Mercator requires navigating through "Izdelki"
        start_urls = [
            "https://trgovina.mercator.si/market/browse" 
        ]

        # For validation, let's hit a specific deep link that usually works
        # Mercator is tricky, often redirects to login or postcode entry.
        # We might need to set a cookie or postcode.
        
        await page.goto("https://trgovina.mercator.si", timeout=60000)
        
        # Cookie helper
        try:
            await page.get_by_text("Sprejmi vse").click(timeout=5000)
        except:
            pass

        # Try to search for "mleko" to guarantee items
        await page.goto("https://trgovina.mercator.si/market/products?searchbox=mleko", timeout=60000)
        
        await self.auto_scroll(page)
        
        items = await page.query_selector_all("app-product-card, .product-item")
        logger.info(f"  Found {len(items)} items")
        
        for item in items:
            try:
                name_el = await item.query_selector(".product-name, h2, h3, a.name")
                if not name_el: continue
                name = await name_el.inner_text()
                
                price_el = await item.query_selector(".price, .current-price")
                price_text = await price_el.inner_text() if price_el else ""
                price = self.pars_price(price_text)
                
                unit = await self.extract_unit(item)

                self.products.append({
                    "ime": name.strip(),
                    "redna_cena": price,
                    "trgovina": self.name,
                    "kategorija": "Search: mleko",
                    "enota": unit
                })
            except:
                pass
                
        await page.close()
        return self.products

class HitriNakupScanner(HeadlessScanner):
    def __init__(self):
        super().__init__("Hitri Nakup", "https://hitrinakup.com")
        self.store_key = "hitri_nakup"

    async def scan(self, context: BrowserContext) -> List[Dict]:
        logger.info(f"Scanning {self.name}...")
        page = await context.new_page()
        
        # Hitri Nakup is easier usually
        await page.goto("https://hitrinakup.com/izdelki", timeout=60000)
        
        try:
            await page.click(".cc-btn.cc-allow", timeout=5000)
        except:
            pass
            
        await self.auto_scroll(page)
        
        items = await page.query_selector_all(".product-layout, .product-thumb")
        logger.info(f"  Found {len(items)} items")
        
        for item in items:
            try:
                name_el = await item.query_selector("h4 a, .name a")
                if not name_el: continue
                name = await name_el.inner_text()
                
                price_el = await item.query_selector(".price-new, .price-normal")
                price_text = await price_el.inner_text() if price_el else ""
                price = self.pars_price(price_text)
                
                unit = await self.extract_unit(item)
                
                self.products.append({
                    "ime": name.strip(),
                    "redna_cena": price,
                    "trgovina": self.name,
                    "kategorija": "General",
                    "enota": unit
                })
            except:
                pass

        await page.close()
        return self.products

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true", help="Run quick test")
    args = parser.parse_args()

    ensure_dirs()
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        scanners = [SparScanner(), MercatorScanner(), HitriNakupScanner()]
        all_products = []
        
        for scanner in scanners:
            try:
                products = await scanner.scan(context)
                all_products.extend(products)
            except Exception as e:
                logger.error(f"Failed scanner {scanner.name}: {e}")
        
        await browser.close()
        
        # Save results
        new_data = {
            'datum_skeniranja': datetime.now().isoformat(),
            'stevilo_izdelkov': len(all_products),
            'izdelki': all_products
        }
        
        save_data(new_data)
        logger.info(f"Saved {len(all_products)} products.")

def ensure_dirs():
    for d in [DATA_DIR, HISTORY_DIR, CHANGES_DIR]:
        os.makedirs(d, exist_ok=True)

def save_data(data: Dict):
    with open(CURRENT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    asyncio.run(main())
