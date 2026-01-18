#!/usr/bin/env python3
"""
Playwright-based Catalog Scraper for Slovenian Grocery Stores
Scrapes ALL products from Mercator, Spar, and Tuš online stores
Runs automatically via GitHub Actions
"""

import re
import json
import asyncio
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set
from playwright.async_api import async_playwright, Page, Browser
import os

class PlaywrightCatalogScraper:
    def __init__(self):
        self.convex_url = os.getenv('CONVEX_URL', 'https://vibrant-dolphin-871.convex.cloud')

    def parse_price(self, price_str: str) -> Optional[float]:
        """Parse price string to float"""
        if not price_str:
            return None
        cleaned = re.sub(r'[^\d,.]', '', price_str)
        if ',' in cleaned and '.' in cleaned:
            cleaned = cleaned.replace('.', '').replace(',', '.')
        else:
            cleaned = cleaned.replace(',', '.')
        try:
            value = float(cleaned)
            if 0.01 < value < 10000:
                return round(value, 2)
            return None
        except ValueError:
            return None

    async def scrape_mercator(self, page: Page) -> List[Dict]:
        """
        Scrape Mercator Online - https://mercatoronline.si/brskaj
        Just infinite scroll - all products on one page
        """
        products = []
        store_name = "Mercator"
        seen_names: Set[str] = set()

        print(f"\n{'='*60}")
        print(f"[{store_name}] Starting scrape...")
        print(f"{'='*60}")

        today = datetime.now()
        valid_from = today.strftime('%Y-%m-%d')
        valid_until = (today + timedelta(days=7)).strftime('%Y-%m-%d')

        try:
            print("Loading https://mercatoronline.si/brskaj ...")
            await page.goto('https://mercatoronline.si/brskaj', wait_until='networkidle', timeout=60000)
            await asyncio.sleep(3)

            # Infinite scroll to load products (optimized limit)
            print("Scrolling to load products...")
            last_count = 0
            no_change = 0
            scroll_count = 0
            max_scrolls = 80  # ~8000 products - good balance of speed vs coverage

            while no_change < 4 and scroll_count < max_scrolls:  # Wait for 4 unchanged scrolls
                scroll_count += 1
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(1.5)

                # Count products
                boxes = await page.query_selector_all('.box')
                current_count = len(boxes)

                if current_count == last_count:
                    no_change += 1
                else:
                    no_change = 0
                    last_count = current_count
                    print(f"  Scroll {scroll_count}: {current_count} products loaded", end='\r')

            print(f"\n  Total products loaded: {last_count}")

            # Extract all products
            boxes = await page.query_selector_all('.box')
            print(f"  Extracting data from {len(boxes)} product boxes...")

            for box in boxes:
                try:
                    text = await box.inner_text()
                    if not text or '€' not in text:
                        continue

                    lines = [l.strip() for l in text.split('\n') if l.strip()]
                    if len(lines) < 2:
                        continue

                    # First line is usually the product name
                    name = lines[0]

                    # Skip if too short or already seen
                    if len(name) < 3 or name.lower() in seen_names:
                        continue

                    # Find prices - look for X,XX € pattern
                    price_matches = re.findall(r'(\d+),(\d{2})\s*€', text)
                    if not price_matches:
                        continue

                    # First price is the current/sale price
                    current_price = float(f"{price_matches[0][0]}.{price_matches[0][1]}")

                    # Check for original price (if on sale)
                    original_price = None
                    sale_price = None
                    bulk_price = None  # For "Kupi 2" deals
                    bulk_quantity = None

                    # Check for "Kupi 2" or "2 za" deals
                    bulk_match = re.search(r'(?:kupi\s*(\d+)|(\d+)\s*za|(\d+)\s*kos)', text.lower())
                    if bulk_match:
                        qty = bulk_match.group(1) or bulk_match.group(2) or bulk_match.group(3)
                        if qty and int(qty) >= 2:
                            bulk_quantity = int(qty)
                            # The lower price might be the bulk price
                            if len(price_matches) >= 2:
                                prices_all = [float(f"{m[0]}.{m[1]}") for m in price_matches]
                                prices_sorted = sorted(set(prices_all))
                                if len(prices_sorted) >= 2:
                                    bulk_price = prices_sorted[0]  # Lower price for bulk
                                    original_price = prices_sorted[-1]  # Regular single price

                    # Look for "prej" indicator or crossed out price
                    if len(price_matches) >= 2 and not bulk_price:
                        # Multiple prices - might be sale + original, or price + per-kg price
                        # Per-kg prices have "/kg" or "/1kg" after them
                        non_per_kg_prices = []
                        for i, (eur, cents) in enumerate(price_matches):
                            # Check if this price is followed by /kg
                            price_text = f"{eur},{cents}"
                            idx = text.find(price_text)
                            after = text[idx:idx+20] if idx >= 0 else ""
                            if '/kg' not in after.lower() and '/1kg' not in after.lower() and '/kos' not in after.lower():
                                non_per_kg_prices.append(float(f"{eur}.{cents}"))

                        if len(non_per_kg_prices) >= 2:
                            # We have sale and original
                            prices_sorted = sorted(non_per_kg_prices)
                            sale_price = prices_sorted[0]
                            original_price = prices_sorted[-1]
                            if sale_price >= original_price:
                                # Not really a sale
                                original_price = None
                                sale_price = None

                    seen_names.add(name.lower())

                    product_data = {
                        'productName': name,
                        'storeName': store_name,
                        'price': current_price,
                        'originalPrice': original_price,
                        'salePrice': sale_price,
                        'validFrom': valid_from,
                        'validUntil': valid_until,
                        'catalogSource': f'{store_name} online {today.strftime("%d.%m.%Y")}'
                    }

                    # Add bulk pricing info (Kupi 2, etc.)
                    if bulk_price and bulk_quantity:
                        product_data['bulkPrice'] = bulk_price
                        product_data['bulkQuantity'] = bulk_quantity
                        product_data['bulkLabel'] = f'Kupi {bulk_quantity}'
                        # If no regular sale, use bulk as the effective sale
                        if not sale_price and original_price:
                            product_data['salePrice'] = bulk_price
                            product_data['discountPercentage'] = round((original_price - bulk_price) / original_price * 100)

                    # Calculate discount if on sale
                    if sale_price and original_price and 'discountPercentage' not in product_data:
                        product_data['discountPercentage'] = round((original_price - sale_price) / original_price * 100)

                    products.append(product_data)

                except Exception as e:
                    continue

        except Exception as e:
            print(f"[{store_name}] Error: {e}")

        print(f"[{store_name}] Total products extracted: {len(products)}")
        sale_count = sum(1 for p in products if p.get('salePrice'))
        print(f"[{store_name}] Products on sale: {sale_count}")

        return products

    async def scrape_spar_from_sheets(self) -> List[Dict]:
        """
        Get Spar data from Google Sheets (populated by Chrome extension)
        Fallback because Spar website doesn't support infinite scroll
        """
        products = []
        store_name = "Spar"
        seen_names: Set[str] = set()

        print(f"\n{'='*60}")
        print(f"[{store_name}] Loading from Google Sheets...")
        print(f"{'='*60}")

        today = datetime.now()
        valid_from = today.strftime('%Y-%m-%d')
        valid_until = (today + timedelta(days=7)).strftime('%Y-%m-%d')

        # Spar Google Sheets URL
        sheets_url = "https://docs.google.com/spreadsheets/d/1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok/export?format=csv"

        try:
            import csv
            from io import StringIO

            response = requests.get(sheets_url, timeout=30, allow_redirects=True)
            response.raise_for_status()

            reader = csv.DictReader(StringIO(response.text))

            for row in reader:
                try:
                    name = row.get('IME IZDELKA', '').strip()
                    if not name or name.lower() in seen_names:
                        continue

                    # Parse prices
                    price_str = row.get('CENA', '')
                    sale_price_str = row.get('AKCIJSKA CENA', '')

                    price = self.parse_price(price_str)
                    sale_price = self.parse_price(sale_price_str) if sale_price_str else None

                    if not price:
                        continue

                    seen_names.add(name.lower())

                    product_data = {
                        'productName': name,
                        'storeName': store_name,
                        'price': price,
                        'originalPrice': price if sale_price else None,
                        'salePrice': sale_price,
                        'validFrom': valid_from,
                        'validUntil': valid_until,
                        'catalogSource': f'{store_name} Google Sheets {today.strftime("%d.%m.%Y")}'
                    }

                    if sale_price and price:
                        product_data['discountPercentage'] = round((price - sale_price) / price * 100)

                    products.append(product_data)

                except Exception:
                    continue

        except Exception as e:
            print(f"[{store_name}] Error loading from sheets: {e}")

        print(f"[{store_name}] Total products from sheets: {len(products)}")
        sale_count = sum(1 for p in products if p.get('salePrice'))
        print(f"[{store_name}] Products on sale: {sale_count}")

        return products

    async def scrape_spar(self, page: Page) -> List[Dict]:
        """
        Scrape Spar Online - https://online.spar.si/
        Falls back to Google Sheets if web scraping doesn't work
        """
        products = []
        store_name = "Spar"
        seen_names: Set[str] = set()

        print(f"\n{'='*60}")
        print(f"[{store_name}] Starting scrape...")
        print(f"{'='*60}")

        today = datetime.now()
        valid_from = today.strftime('%Y-%m-%d')
        valid_until = (today + timedelta(days=7)).strftime('%Y-%m-%d')

        # Direct category URLs
        categories = [
            ("sadje-zelenjava", "https://online.spar.si/sadje-zelenjava"),
            ("meso-ribe", "https://online.spar.si/meso-ribe"),
            ("mlecni-izdelki", "https://online.spar.si/mlecni-izdelki-jajca"),
            ("kruh-pecivo", "https://online.spar.si/kruh-pecivo"),
            ("zamrznjeno", "https://online.spar.si/zamrznjeno"),
            ("pijace", "https://online.spar.si/pijace"),
            ("shramba", "https://online.spar.si/shramba"),
        ]

        try:
            # Accept cookies first
            print("Loading Spar and accepting cookies...")
            await page.goto('https://online.spar.si/', wait_until='networkidle', timeout=60000)
            await asyncio.sleep(2)
            try:
                await page.click('button:has-text("Dovoli izbor")', timeout=5000)
                await asyncio.sleep(2)
            except:
                pass

            for cat_name, category_url in categories:
                try:
                    print(f"\n  [{cat_name}]", end=" ", flush=True)

                    await page.goto(category_url, wait_until='networkidle', timeout=60000)
                    await asyncio.sleep(3)

                    # Scroll to load products
                    for _ in range(8):
                        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        await asyncio.sleep(1)

                    # Find product elements using multiple selectors
                    product_elements = await page.query_selector_all('div[class*="product"], article, [class*="tile"], [class*="card"]')

                    category_count = 0
                    for elem in product_elements:
                        try:
                            text = await elem.inner_text()

                            # Must have price and reasonable length
                            if '€' not in text or len(text) < 15 or len(text) > 400:
                                continue

                            lines = [l.strip() for l in text.split('\n') if l.strip()]
                            if len(lines) < 2:
                                continue

                            # Find product name (first line that's not a price/number)
                            name = None
                            for line in lines:
                                if len(line) > 5 and len(line) < 150:
                                    if not re.match(r'^[\d,.\s€%+-]+$', line):
                                        if 'prihranek' not in line.lower() and 'prej' not in line.lower():
                                            if 'dodaj' not in line.lower() and 'v košarico' not in line.lower():
                                                name = line
                                                break

                            if not name or name.lower() in seen_names:
                                continue

                            # Find prices - look for X,XX € pattern
                            price_matches = re.findall(r'(\d+),(\d{2})\s*€', text)
                            if not price_matches:
                                continue

                            prices = [float(f"{m[0]}.{m[1]}") for m in price_matches]
                            prices = [p for p in prices if 0.1 < p < 500]

                            if not prices:
                                continue

                            # Determine sale vs regular price
                            prices_sorted = sorted(set(prices))
                            current_price = prices_sorted[0]
                            original_price = prices_sorted[-1] if len(prices_sorted) > 1 and prices_sorted[-1] > prices_sorted[0] else None
                            sale_price = current_price if original_price else None

                            seen_names.add(name.lower())

                            product_data = {
                                'productName': name,
                                'storeName': store_name,
                                'price': current_price,
                                'originalPrice': original_price,
                                'salePrice': sale_price,
                                'validFrom': valid_from,
                                'validUntil': valid_until,
                                'catalogSource': f'{store_name} online {today.strftime("%d.%m.%Y")}'
                            }

                            if sale_price and original_price:
                                product_data['discountPercentage'] = round((original_price - sale_price) / original_price * 100)

                            products.append(product_data)
                            category_count += 1

                        except Exception:
                            continue

                    print(f"{category_count} products")

                except Exception as e:
                    print(f"Error: {e}")
                    continue

        except Exception as e:
            print(f"[{store_name}] Error: {e}")

        print(f"\n[{store_name}] Total products extracted: {len(products)}")
        sale_count = sum(1 for p in products if p.get('salePrice'))
        print(f"[{store_name}] Products on sale: {sale_count}")

        return products

    async def scrape_tus(self, page: Page) -> List[Dict]:
        """
        Scrape Tuš - https://hitrinakup.com/kategorije
        Navigation: Click each category/subcategory, scrape products
        """
        products = []
        store_name = "Tus"
        seen_names: Set[str] = set()

        print(f"\n{'='*60}")
        print(f"[{store_name}] Starting scrape (hitrinakup.com)...")
        print(f"{'='*60}")

        today = datetime.now()
        valid_from = today.strftime('%Y-%m-%d')
        valid_until = (today + timedelta(days=7)).strftime('%Y-%m-%d')

        # ALL subcategories to scrape - comprehensive list
        subcategories = [
            # Sadje in zelenjava
            "Zelenjava", "Sadje", "Sveže sadje", "Sveža zelenjava", "Solate", "Gobe",
            # Meso in ribe
            "Meso, delikatesa in ribe", "Ribe", "Goveje meso", "Svinjsko meso",
            "Piščančje meso", "Puranje meso", "Mesni izdelki", "Delikatesa",
            "Sveže meso", "Morski sadeži",
            # Mlečni izdelki
            "Hlajeni in mlečni izdelki", "Siri", "Jajca", "Mleko", "Jogurt",
            "Skuta", "Maslo", "Smetana", "Mlečni namazi",
            # Kruh
            "Kruh in pekovski izdelki", "Kruh", "Pecivo", "Toast", "Žemlje",
            # Shramba
            "Shramba", "Testenine", "Riž", "Moka", "Sladkor", "Olje", "Kis",
            "Konzerve", "Omake", "Začimbe", "Juhe", "Žita", "Kosmiči",
            # Pijače
            "Brezalkoholne pijače", "Vode", "Sokovi, nektarji in pijače",
            "Energijske pijače", "Čaji", "Kava", "Kakav",
            "Alkoholne pijače", "Pivo", "Vino",
            # Zamrznjeno
            "Zamrznjeno", "Zamrznjena zelenjava", "Zamrznjeno meso",
            "Sladoled", "Zamrznjene jedi",
            # Sladko in slano
            "Sladko in slano", "Slani prigrizki", "Sladki prigrizki",
            "Čokolada", "Bonboni", "Piškoti", "Čips",
            # Otroška hrana
            "Otroška hrana", "Mlečne formule", "Kašice",
            # Hrana za živali
            "Hrana za živali", "Hrana za pse", "Hrana za mačke",
            # Čistila
            "Čistila", "Pralni praški", "Mehčalci",
            # Osebna nega
            "Osebna nega", "Šamponi", "Mila", "Zobne paste",
            # BUM akcije
            "BUM", "Akcija", "Znižano",
        ]

        try:
            print("Loading https://hitrinakup.com/kategorije ...")
            await page.goto('https://hitrinakup.com/kategorije', wait_until='networkidle', timeout=60000)
            await asyncio.sleep(3)

            for subcat in subcategories:
                try:
                    print(f"\n  [{subcat}]")

                    # Go back to categories page
                    await page.goto('https://hitrinakup.com/kategorije', wait_until='networkidle', timeout=30000)
                    await asyncio.sleep(2)

                    # Find and click the subcategory
                    subcat_link = await page.query_selector(f'text="{subcat}"')
                    if not subcat_link:
                        # Try with partial matching
                        all_links = await page.query_selector_all('a')
                        for link in all_links:
                            try:
                                link_text = await link.inner_text()
                                if subcat.lower() in link_text.lower():
                                    subcat_link = link
                                    break
                            except:
                                continue

                    if not subcat_link:
                        print(f"    Subcategory not found, skipping")
                        continue

                    await subcat_link.click()
                    await asyncio.sleep(3)

                    # Scroll to load products
                    for _ in range(5):
                        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        await asyncio.sleep(1)

                    # Find product cards
                    cards = await page.query_selector_all('[class*="itemCard"], [class*="ItemCard"], [class*="product-card"]')

                    category_products = 0
                    for card in cards:
                        try:
                            # Get product name
                            name_elem = await card.query_selector('#item-name, [id="item-name"], [class*="itemProductTitle"], [class*="product-name"]')
                            if name_elem:
                                name = await name_elem.inner_text()
                            else:
                                text = await card.inner_text()
                                lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 3]
                                name = lines[0] if lines else None

                            if not name or len(name) < 3 or name.lower() in seen_names:
                                continue

                            # Get prices
                            card_text = await card.inner_text()
                            price_matches = re.findall(r'(\d+),(\d{2})\s*€?', card_text)
                            if not price_matches:
                                continue

                            prices = [float(f"{m[0]}.{m[1]}") for m in price_matches]
                            prices = [p for p in prices if 0.1 < p < 500]

                            if not prices:
                                continue

                            # Check for BUM price (Tuš special)
                            is_bum = False
                            bum_elem = await card.query_selector('[class*="bum"], [class*="BUM"], [class*="akci"]')
                            if bum_elem or 'bum' in card_text.lower() or 'BUM' in card_text:
                                is_bum = True

                            # Check for dashed (original) price
                            dashed_elem = await card.query_selector('[class*="dashed"], [class*="old-price"], del, s')
                            original_price = None
                            sale_price = None

                            if is_bum and len(prices) >= 1:
                                # BUM price - the displayed price is the BUM (sale) price
                                sale_price = min(prices)
                                # Try to find original price
                                if len(prices) >= 2:
                                    original_price = max(prices)
                                else:
                                    # Estimate original as ~20% higher if not shown
                                    original_price = round(sale_price * 1.2, 2)
                            elif dashed_elem:
                                dashed_text = await dashed_elem.inner_text()
                                orig_match = re.search(r'(\d+),(\d{2})', dashed_text)
                                if orig_match:
                                    original_price = float(f"{orig_match.group(1)}.{orig_match.group(2)}")
                                    sale_price = min(prices)
                            elif len(prices) >= 2:
                                prices_sorted = sorted(prices)
                                if prices_sorted[0] < prices_sorted[-1]:
                                    sale_price = prices_sorted[0]
                                    original_price = prices_sorted[-1]

                            current_price = sale_price if sale_price else prices[0]

                            seen_names.add(name.lower())

                            product_data = {
                                'productName': name,
                                'storeName': store_name,
                                'price': current_price,
                                'originalPrice': original_price,
                                'salePrice': sale_price,
                                'validFrom': valid_from,
                                'validUntil': valid_until,
                                'catalogSource': f'{store_name} online {today.strftime("%d.%m.%Y")}'
                            }

                            # Add BUM label if applicable
                            if is_bum:
                                product_data['promoLabel'] = 'BUM CENA'

                            if sale_price and original_price:
                                product_data['discountPercentage'] = round((original_price - sale_price) / original_price * 100)

                            products.append(product_data)
                            category_products += 1

                        except Exception:
                            continue

                    bum_count = sum(1 for p in products if p.get('promoLabel') == 'BUM CENA')
                    print(f"    Products: {category_products} (BUM: {bum_count})")

                except Exception as e:
                    print(f"    Error: {e}")
                    continue

        except Exception as e:
            print(f"[{store_name}] Error: {e}")

        print(f"\n[{store_name}] Total products extracted: {len(products)}")
        sale_count = sum(1 for p in products if p.get('salePrice'))
        print(f"[{store_name}] Products on sale: {sale_count}")

        return products

    def send_to_convex(self, products: List[Dict]) -> Dict:
        """Send product data to Convex"""
        if not products:
            print("No products to send")
            return {'inserted': 0, 'updated': 0, 'skipped': 0}

        # Filter to only sale items for the sales table
        sales = [p for p in products if p.get('salePrice') and p.get('originalPrice')]

        if not sales:
            print("No sale items to send")
            return {'inserted': 0, 'updated': 0, 'skipped': 0}

        url = f"{self.convex_url}/api/mutation"

        # Convert to the format expected by importCatalogSales
        formatted_sales = [{
            'productName': s['productName'],
            'storeName': s['storeName'],
            'originalPrice': s['originalPrice'],
            'salePrice': s['salePrice'],
            'discountPercentage': s.get('discountPercentage', 0),
            'validFrom': s['validFrom'],
            'validUntil': s['validUntil'],
            'catalogSource': s['catalogSource']
        } for s in sales]

        # Send in batches
        batch_size = 100
        total_inserted = 0
        total_updated = 0
        total_skipped = 0

        print(f"\nSending {len(formatted_sales)} sale items to Convex...")

        for i in range(0, len(formatted_sales), batch_size):
            batch = formatted_sales[i:i + batch_size]
            payload = {
                "path": "catalogManager:importCatalogSales",
                "args": {"sales": batch}
            }

            try:
                response = requests.post(url, json=payload, timeout=120)
                response.raise_for_status()
                result = response.json()
                value = result.get('value', {})
                total_inserted += value.get('inserted', 0)
                total_updated += value.get('updated', 0)
                total_skipped += value.get('skipped', 0)
                print(f"  Batch {i//batch_size + 1}: +{value.get('inserted', 0)} new, {value.get('updated', 0)} updated")
            except Exception as e:
                print(f"  Batch {i//batch_size + 1} error: {e}")

        return {'inserted': total_inserted, 'updated': total_updated, 'skipped': total_skipped}

    async def run(self):
        """Run the complete scraping pipeline"""
        print("=" * 70)
        print("PRHRAN - AVTOMATSKI SCRAPER")
        print(f"Datum: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("Trgovine: Mercator, Spar, Tuš")
        print("=" * 70)

        all_products = []

        async with async_playwright() as p:
            print("\nZaganjam brskalnik...")
            browser = await p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            )

            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                locale='sl-SI'
            )

            page = await context.new_page()

            # Scrape Mercator and Tuš (web scraping)
            for scraper_func, name in [
                (self.scrape_mercator, "Mercator"),
                (self.scrape_tus, "Tuš")
            ]:
                try:
                    store_products = await scraper_func(page)
                    all_products.extend(store_products)
                except Exception as e:
                    print(f"[{name}] Napaka: {e}")

            # Scrape Spar from Google Sheets (web doesn't support infinite scroll)
            try:
                spar_products = await self.scrape_spar_from_sheets()
                all_products.extend(spar_products)
            except Exception as e:
                print(f"[Spar] Napaka: {e}")

            await browser.close()

        # Summary
        print("\n" + "=" * 70)
        print("POVZETEK")
        print("=" * 70)

        by_store = {}
        sales_by_store = {}
        for p in all_products:
            store = p['storeName']
            by_store[store] = by_store.get(store, 0) + 1
            if p.get('salePrice'):
                sales_by_store[store] = sales_by_store.get(store, 0) + 1

        print(f"Skupaj izdelkov: {len(all_products)}")
        for store, count in by_store.items():
            sales = sales_by_store.get(store, 0)
            print(f"  {store}: {count} izdelkov ({sales} na akciji)")

        if all_products:
            # Save to JSON
            output_file = f'all_products_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(all_products, f, ensure_ascii=False, indent=2)
            print(f"\nShranjeno v {output_file}")

            with open('all_products_latest.json', 'w', encoding='utf-8') as f:
                json.dump(all_products, f, ensure_ascii=False, indent=2)
            print("Shranjeno v all_products_latest.json")

            # Send to Convex
            result = self.send_to_convex(all_products)
            print(f"\nConvex rezultat: {result}")

        print("\n" + "=" * 70)
        print("KONČANO!")
        print("=" * 70)

        return all_products


if __name__ == "__main__":
    scraper = PlaywrightCatalogScraper()
    asyncio.run(scraper.run())
