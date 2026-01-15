#!/usr/bin/env python3
"""
Catalog Scraper for Slovenian Grocery Stores
Scrapes weekly catalogs and sends sale data to Convex
"""

import re
import json
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from bs4 import BeautifulSoup
import os

class CatalogScraper:
    def __init__(self):
        self.convex_url = os.getenv('CONVEX_URL', 'https://vibrant-dolphin-871.convex.cloud')
        self.sales_data: List[Dict] = []

    def parse_slovenian_date(self, date_str: str) -> Optional[str]:
        """Parse Slovenian date formats to ISO format"""
        if not date_str:
            return None

        date_str = date_str.strip()

        # Try ISO format first
        if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
            return date_str

        # Try "15.1.2026" or "15. 1. 2026"
        match = re.match(r'(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})', date_str)
        if match:
            d, m, y = match.groups()
            return f"{y}-{m.zfill(2)}-{d.zfill(2)}"

        # Try "15. januar 2026"
        months = {
            'januar': '01', 'february': '02', 'marec': '03', 'april': '04',
            'maj': '05', 'junij': '06', 'julij': '07', 'avgust': '08',
            'september': '09', 'oktober': '10', 'november': '11', 'december': '12'
        }
        for month_name, month_num in months.items():
            if month_name in date_str.lower():
                match = re.search(r'(\d{1,2})', date_str)
                year_match = re.search(r'(\d{4})', date_str)
                if match and year_match:
                    d = match.group(1)
                    y = year_match.group(1)
                    return f"{y}-{month_num}-{d.zfill(2)}"

        return None

    def parse_price(self, price_str: str) -> Optional[float]:
        """Parse price string to float"""
        if not price_str:
            return None

        # Remove currency symbols and whitespace
        cleaned = re.sub(r'[^\d,.]', '', price_str)
        # Replace comma with dot
        cleaned = cleaned.replace(',', '.')

        try:
            return float(cleaned)
        except ValueError:
            return None

    def scrape_mercator_catalog(self) -> List[Dict]:
        """Scrape Mercator weekly catalog"""
        sales = []

        try:
            # Mercator katalog URL
            url = "https://www.mercator.si/aktualno/katalogi/"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }

            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            # Find catalog items (this is a placeholder - actual structure may vary)
            catalog_items = soup.find_all('div', class_='catalog-item')

            for item in catalog_items:
                try:
                    name = item.find('h3') or item.find('span', class_='name')
                    price = item.find('span', class_='price')
                    old_price = item.find('span', class_='old-price')
                    valid_until = item.find('span', class_='valid-until')

                    if name and price:
                        sale_price = self.parse_price(price.text)
                        original_price = self.parse_price(old_price.text) if old_price else None

                        if sale_price and original_price:
                            discount = round((original_price - sale_price) / original_price * 100)

                            # Default validity: current week
                            today = datetime.now()
                            valid_from = today.strftime('%Y-%m-%d')
                            valid_end = (today + timedelta(days=7)).strftime('%Y-%m-%d')

                            if valid_until:
                                parsed_date = self.parse_slovenian_date(valid_until.text)
                                if parsed_date:
                                    valid_end = parsed_date

                            sales.append({
                                'productName': name.text.strip(),
                                'storeName': 'Mercator',
                                'originalPrice': original_price,
                                'salePrice': sale_price,
                                'discountPercentage': discount,
                                'validFrom': valid_from,
                                'validUntil': valid_end,
                                'catalogSource': f'Mercator katalog {today.strftime("%W/%Y")}'
                            })
                except Exception as e:
                    print(f"Error parsing Mercator item: {e}")
                    continue

        except Exception as e:
            print(f"Error scraping Mercator catalog: {e}")

        print(f"[Mercator] Found {len(sales)} sale items")
        return sales

    def scrape_spar_catalog(self) -> List[Dict]:
        """Scrape Spar weekly catalog"""
        sales = []

        try:
            # Spar katalog URL
            url = "https://www.spar.si/aktualne-akcije"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }

            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            # Find sale items (placeholder structure)
            sale_items = soup.find_all('div', class_='product-tile')

            today = datetime.now()
            valid_from = today.strftime('%Y-%m-%d')
            valid_end = (today + timedelta(days=7)).strftime('%Y-%m-%d')

            for item in sale_items:
                try:
                    name_elem = item.find('span', class_='product-name')
                    price_elem = item.find('span', class_='price')
                    old_price_elem = item.find('span', class_='was-price')

                    if name_elem and price_elem:
                        sale_price = self.parse_price(price_elem.text)
                        original_price = self.parse_price(old_price_elem.text) if old_price_elem else None

                        if sale_price and original_price and sale_price < original_price:
                            discount = round((original_price - sale_price) / original_price * 100)

                            sales.append({
                                'productName': name_elem.text.strip(),
                                'storeName': 'Spar',
                                'originalPrice': original_price,
                                'salePrice': sale_price,
                                'discountPercentage': discount,
                                'validFrom': valid_from,
                                'validUntil': valid_end,
                                'catalogSource': f'Spar akcije {today.strftime("%W/%Y")}'
                            })
                except Exception as e:
                    print(f"Error parsing Spar item: {e}")
                    continue

        except Exception as e:
            print(f"Error scraping Spar catalog: {e}")

        print(f"[Spar] Found {len(sales)} sale items")
        return sales

    def scrape_tus_catalog(self) -> List[Dict]:
        """Scrape Tus weekly catalog"""
        sales = []

        try:
            # Tus katalog URL
            url = "https://www.tus.si/aktualne-akcije/"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }

            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            today = datetime.now()
            valid_from = today.strftime('%Y-%m-%d')
            valid_end = (today + timedelta(days=7)).strftime('%Y-%m-%d')

            # Find sale items (placeholder structure)
            sale_items = soup.find_all('div', class_='product')

            for item in sale_items:
                try:
                    name_elem = item.find('h3') or item.find('span', class_='title')
                    price_elem = item.find('span', class_='akcijska-cena')
                    old_price_elem = item.find('span', class_='redna-cena')

                    if name_elem and price_elem:
                        sale_price = self.parse_price(price_elem.text)
                        original_price = self.parse_price(old_price_elem.text) if old_price_elem else None

                        if sale_price and original_price and sale_price < original_price:
                            discount = round((original_price - sale_price) / original_price * 100)

                            sales.append({
                                'productName': name_elem.text.strip(),
                                'storeName': 'Tus',
                                'originalPrice': original_price,
                                'salePrice': sale_price,
                                'discountPercentage': discount,
                                'validFrom': valid_from,
                                'validUntil': valid_end,
                                'catalogSource': f'Tus akcije {today.strftime("%W/%Y")}'
                            })
                except Exception as e:
                    print(f"Error parsing Tus item: {e}")
                    continue

        except Exception as e:
            print(f"Error scraping Tus catalog: {e}")

        print(f"[Tus] Found {len(sales)} sale items")
        return sales

    def scrape_from_google_sheets(self) -> List[Dict]:
        """Scrape sale data from existing Google Sheets (as fallback)"""
        sales = []

        sheets = {
            'Spar': 'https://docs.google.com/spreadsheets/d/1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok/export?format=csv',
            'Mercator': 'https://docs.google.com/spreadsheets/d/1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0/export?format=csv',
            'Tus': 'https://docs.google.com/spreadsheets/d/17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A/export?format=csv'
        }

        import csv
        from io import StringIO

        today = datetime.now()
        valid_from = today.strftime('%Y-%m-%d')
        valid_end = (today + timedelta(days=7)).strftime('%Y-%m-%d')

        for store_name, url in sheets.items():
            try:
                print(f"Downloading {store_name} sheet...", end=" ", flush=True)
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                response.encoding = 'utf-8'

                reader = csv.DictReader(StringIO(response.text))
                store_sales = 0

                for row in reader:
                    name = row.get('IME IZDELKA', '')
                    price_str = row.get('CENA', '')
                    sale_price_str = row.get('AKCIJSKA CENA', '')

                    if not name or not price_str:
                        continue

                    price = self.parse_price(price_str)
                    sale_price = self.parse_price(sale_price_str) if sale_price_str else None

                    # Only include if it's on sale
                    if price and sale_price and sale_price < price:
                        discount = round((price - sale_price) / price * 100)

                        sales.append({
                            'productName': name.strip(),
                            'storeName': store_name,
                            'originalPrice': price,
                            'salePrice': sale_price,
                            'discountPercentage': discount,
                            'validFrom': valid_from,
                            'validUntil': valid_end,
                            'catalogSource': f'{store_name} sheet {today.strftime("%d.%m.%Y")}'
                        })
                        store_sales += 1

                print(f"[OK] Found {store_sales} sale items")

            except Exception as e:
                print(f"[ERROR] {e}")

        return sales

    def send_to_convex(self, sales: List[Dict]) -> Dict:
        """Send sales data to Convex"""
        if not sales:
            print("No sales to send")
            return {'inserted': 0, 'updated': 0, 'skipped': 0}

        # Use Convex HTTP API
        url = f"{self.convex_url}/api/mutation"

        payload = {
            "path": "catalogManager:importCatalogSales",
            "args": {
                "sales": sales
            }
        }

        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            result = response.json()
            print(f"Convex response: {result}")
            return result.get('value', {})
        except Exception as e:
            print(f"Error sending to Convex: {e}")
            return {'error': str(e)}

    def run(self, use_google_sheets: bool = True):
        """Run the catalog scraper"""
        print("=" * 60)
        print("CATALOG SCRAPER")
        print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        print()

        all_sales = []

        if use_google_sheets:
            # Use Google Sheets as primary source (more reliable)
            print("Scraping from Google Sheets...")
            all_sales = self.scrape_from_google_sheets()
        else:
            # Scrape from store websites (may need adjustments)
            print("Scraping from store websites...")
            all_sales.extend(self.scrape_mercator_catalog())
            all_sales.extend(self.scrape_spar_catalog())
            all_sales.extend(self.scrape_tus_catalog())

        print()
        print(f"Total sale items found: {len(all_sales)}")
        print()

        if all_sales:
            # Save to JSON file
            output_file = f'catalog_sales_{datetime.now().strftime("%Y%m%d")}.json'
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(all_sales, f, ensure_ascii=False, indent=2)
            print(f"Saved to {output_file}")

            # Send to Convex
            print()
            print("Sending to Convex...")
            result = self.send_to_convex(all_sales)
            print(f"Result: {result}")

        print()
        print("=" * 60)
        print("DONE")
        print("=" * 60)

        return all_sales


if __name__ == "__main__":
    scraper = CatalogScraper()
    scraper.run(use_google_sheets=True)
