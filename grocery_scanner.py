#!/usr/bin/env python3
"""
Slovenian Grocery Price Scanner
Skeniraj cene iz: Spar Online, Mercator Online, Hitri Nakup
"""

import argparse
import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime
from typing import Dict, List, Optional
import time
import re
from urllib.parse import urljoin
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DATA_DIR = "cene_data"
CURRENT_FILE = os.path.join(DATA_DIR, "trenutne_cene.json")
HISTORY_DIR = os.path.join(DATA_DIR, "zgodovina")
CHANGES_DIR = os.path.join(DATA_DIR, "spremembe")

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept-Language': 'sl-SI,sl;q=0.9,en;q=0.8',
}


class GroceryScanner:
    def __init__(self, name: str, base_url: str):
        self.name = name
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.products = []
    
    def get_page(self, url: str, delay: float = 1.0) -> Optional[BeautifulSoup]:
        try:
            time.sleep(delay)
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            return BeautifulSoup(response.text, 'html.parser')
        except Exception as e:
            logger.error(f"Napaka pri prenosu {url}: {e}")
            return None
    
    def parse_price(self, price_str: str) -> Optional[float]:
        if not price_str:
            return None
        price_str = re.sub(r'[^\d,.]', '', price_str).replace(',', '.')
        try:
            return float(price_str)
        except:
            return None


class SparScanner(GroceryScanner):
    def __init__(self):
        super().__init__("Spar Online", "https://online.spar.si")
    
    def get_categories(self) -> List[Dict]:
        categories = []
        known = ['/sadje-in-zelenjava', '/hlajeni-in-mlecni-izdelki', '/sveze-meso-mesni-izdelki-in-ribe',
                 '/vse-za-zajtrk', '/pijace', '/kruh-pecivo-in-slascice', '/shramba',
                 '/bio-in-druga-posebna-hrana', '/zamrznjeni-izdelki', '/sladki-in-slani-prigrizki']
        for cat in known:
            categories.append({'name': cat.strip('/').replace('-', ' ').title(), 'url': f"{self.base_url}{cat}"})
        return categories
    
    def scan_category(self, category: Dict) -> List[Dict]:
        products = []
        page = 1
        while True:
            soup = self.get_page(f"{category['url']}?page={page}")
            if not soup:
                break
            items = soup.select('.product-item, .product-card, [data-product]')
            if not items:
                break
            for item in items:
                name_el = item.select_one('.product-name, .product-title, h2, h3')
                if not name_el:
                    continue
                name = name_el.get_text(strip=True)
                price_el = item.select_one('.price, .product-price')
                price = self.parse_price(price_el.get_text() if price_el else '')
                sale_el = item.select_one('.old-price, .sale-price')
                if sale_el:
                    old = self.parse_price(sale_el.get_text())
                    regular, sale = (old, price) if old and price and old > price else (price, None)
                else:
                    regular, sale = price, None
                link = item.select_one('a')
                products.append({
                    'ime': name, 'redna_cena': regular, 'akcijska_cena': sale,
                    'kategorija': category['name'], 'trgovina': self.name,
                    'url': urljoin(self.base_url, link.get('href', '')) if link else None
                })
            if not soup.select_one('.pagination .next:not(.disabled)'):
                break
            page += 1
        return products
    
    def scan(self) -> List[Dict]:
        logger.info(f"Skeniram: {self.name}")
        for cat in self.get_categories():
            self.products.extend(self.scan_category(cat))
            logger.info(f"  {cat['name']}: {len(self.products)} izdelkov skupaj")
        return self.products


class MercatorScanner(GroceryScanner):
    def __init__(self):
        super().__init__("Mercator Online", "https://mercatoronline.si")
    
    def get_categories(self) -> List[Dict]:
        categories = []
        soup = self.get_page(f"{self.base_url}/brskaj")
        if soup:
            for item in soup.select('[href*="/brskaj/"]'):
                href, name = item.get('href', ''), item.get_text(strip=True)
                if href and name:
                    categories.append({'name': name, 'url': urljoin(self.base_url, href)})
        return categories
    
    def scan_category(self, category: Dict) -> List[Dict]:
        products = []
        page = 1
        while True:
            soup = self.get_page(f"{category['url']}?page={page}")
            if not soup:
                break
            items = soup.select('.product-card, .product-item, .product')
            if not items:
                break
            for item in items:
                name_el = item.select_one('.product-name, .title, h2, h3')
                if not name_el:
                    continue
                name = name_el.get_text(strip=True)
                price = self.parse_price(item.select_one('.price').get_text() if item.select_one('.price') else '')
                sale_el = item.select_one('.old-price')
                regular = self.parse_price(sale_el.get_text()) if sale_el else price
                sale = price if sale_el else None
                link = item.select_one('a')
                products.append({
                    'ime': name, 'redna_cena': regular, 'akcijska_cena': sale,
                    'kategorija': category['name'], 'trgovina': self.name,
                    'url': urljoin(self.base_url, link.get('href', '')) if link else None
                })
            if not soup.select_one('.pagination .next:not(.disabled)'):
                break
            page += 1
        return products
    
    def scan(self) -> List[Dict]:
        logger.info(f"Skeniram: {self.name}")
        for cat in self.get_categories():
            self.products.extend(self.scan_category(cat))
        return self.products


class HitriNakupScanner(GroceryScanner):
    def __init__(self):
        super().__init__("Hitri Nakup", "https://hitrinakup.com")
    
    def get_categories(self) -> List[Dict]:
        categories = []
        soup = self.get_page(self.base_url)
        if soup:
            for item in soup.select('.category a, .nav-link, .menu-item a'):
                href, name = item.get('href', ''), item.get_text(strip=True)
                if href and name:
                    categories.append({'name': name, 'url': urljoin(self.base_url, href)})
        return categories
    
    def scan_category(self, category: Dict) -> List[Dict]:
        products = []
        soup = self.get_page(category['url'])
        if soup:
            for item in soup.select('.product-card, .product-item, .product'):
                name_el = item.select_one('.product-name, .title, h2, h3')
                if not name_el:
                    continue
                name = name_el.get_text(strip=True)
                price = self.parse_price(item.select_one('.price').get_text() if item.select_one('.price') else '')
                sale_el = item.select_one('.old-price')
                regular = self.parse_price(sale_el.get_text()) if sale_el else price
                sale = price if sale_el else None
                link = item.select_one('a')
                products.append({
                    'ime': name, 'redna_cena': regular, 'akcijska_cena': sale,
                    'kategorija': category['name'], 'trgovina': self.name,
                    'url': urljoin(self.base_url, link.get('href', '')) if link else None
                })
        return products
    
    def scan(self) -> List[Dict]:
        logger.info(f"Skeniram: {self.name}")
        for cat in self.get_categories():
            self.products.extend(self.scan_category(cat))
        return self.products


class JagerScanner(GroceryScanner):
    def __init__(self):
        super().__init__("Trgovine Jager", "https://www.trgovinejager.com")
    
    def get_categories(self) -> List[Dict]:
        categories = []
        soup = self.get_page(f"{self.base_url}/zivila/")
        if not soup:
            return categories
        seen = set()
        for item in soup.select('a[href*="/zivila/"]'):
            href, name = item.get('href', ''), item.get_text(strip=True)
            if not href:
                continue
            url = urljoin(self.base_url, href)
            if "/zivila/" not in url:
                continue
            if url.rstrip("/") == f"{self.base_url}/zivila":
                continue
            if url in seen:
                continue
            seen.add(url)
            categories.append({'name': name or "Živila", 'url': url})
        return categories
    
    def scan_category(self, category: Dict) -> List[Dict]:
        products = []
        page = 1
        while True:
            url = category['url']
            page_url = f"{url}?page={page}"
            soup = self.get_page(page_url)
            if not soup:
                break
            items = soup.select('.product, .product-item, .product-card, li.product, .item')
            if not items:
                break
            for item in items:
                name_el = item.select_one('.product-name, .product-title, .woocommerce-loop-product__title, h2, h3')
                if not name_el:
                    continue
                name = name_el.get_text(strip=True)
                price_el = item.select_one('.price, .product-price, .woocommerce-Price-amount')
                price = self.parse_price(price_el.get_text() if price_el else '')
                sale_el = item.select_one('.old-price, del .woocommerce-Price-amount, .sale-price')
                if sale_el:
                    old = self.parse_price(sale_el.get_text())
                    regular, sale = (old, price) if old and price and old > price else (price, None)
                else:
                    regular, sale = price, None
                link = item.select_one('a')
                products.append({
                    'ime': name, 'redna_cena': regular, 'akcijska_cena': sale,
                    'kategorija': category['name'], 'trgovina': self.name,
                    'url': urljoin(self.base_url, link.get('href', '')) if link else None
                })
            if not soup.select_one('.pagination .next:not(.disabled)'):
                break
            page += 1
        return products
    
    def scan(self) -> List[Dict]:
        logger.info(f"Skeniram: {self.name}")
        for cat in self.get_categories():
            self.products.extend(self.scan_category(cat))
        return self.products


def ensure_dirs():
    for d in [DATA_DIR, HISTORY_DIR, CHANGES_DIR]:
        os.makedirs(d, exist_ok=True)


def load_previous_data() -> Dict:
    if os.path.exists(CURRENT_FILE):
        with open(CURRENT_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_data(data: Dict):
    with open(CURRENT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    date_str = datetime.now().strftime('%Y-%m-%d')
    with open(os.path.join(HISTORY_DIR, f"cene_{date_str}.json"), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def compare_and_save_changes(old_data: Dict, new_data: Dict):
    changes = {'datum': datetime.now().isoformat(), 'novi_izdelki': [], 'odstranjeni_izdelki': [],
               'spremembe_cen': [], 'nove_akcije': [], 'konec_akcij': []}
    old_products = {f"{p['trgovina']}|{p['ime']}": p for p in old_data.get('izdelki', [])}
    new_products = {f"{p['trgovina']}|{p['ime']}": p for p in new_data.get('izdelki', [])}
    
    for key, p in new_products.items():
        if key not in old_products:
            changes['novi_izdelki'].append(p)
        else:
            old = old_products[key]
            if old.get('redna_cena') != p.get('redna_cena'):
                changes['spremembe_cen'].append({'izdelek': p, 'stara': old.get('redna_cena'), 'nova': p.get('redna_cena')})
            if not old.get('akcijska_cena') and p.get('akcijska_cena'):
                changes['nove_akcije'].append(p)
            if old.get('akcijska_cena') and not p.get('akcijska_cena'):
                changes['konec_akcij'].append(p)
    
    for key in old_products:
        if key not in new_products:
            changes['odstranjeni_izdelki'].append(old_products[key])
    
    date_str = datetime.now().strftime('%Y-%m-%d')
    with open(os.path.join(CHANGES_DIR, f"spremembe_{date_str}.json"), 'w', encoding='utf-8') as f:
        json.dump(changes, f, ensure_ascii=False, indent=2)
    
    with open(os.path.join(CHANGES_DIR, f"porocilo_{date_str}.txt"), 'w', encoding='utf-8') as f:
        f.write(f"POROCILO - {date_str}\n{'='*40}\n")
        f.write(f"Novi izdelki: {len(changes['novi_izdelki'])}\n")
        f.write(f"Spremembe cen: {len(changes['spremembe_cen'])}\n")
        f.write(f"Nove akcije: {len(changes['nove_akcije'])}\n")
        f.write(f"Konec akcij: {len(changes['konec_akcij'])}\n")
    
    return changes


def upload_to_convex(data: Dict) -> bool:
    ingest_url = os.getenv("PRHRAN_INGEST_URL")
    token = os.getenv("PRHRAN_INGEST_TOKEN")
    if not ingest_url or not token:
        logger.info("Upload preskocen: manjka PRHRAN_INGEST_URL ali PRHRAN_INGEST_TOKEN.")
        return False

    try:
        response = requests.post(
            ingest_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=data,
            timeout=60,
        )
        response.raise_for_status()
        logger.info(f"Upload OK: {response.status_code} {response.text}")
        return True
    except Exception as e:
        logger.error(f"Napaka pri uploadu: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Tedenski skener cen.")
    parser.add_argument("--upload", action="store_true", help="Poslji rezultate v Convex.")
    args = parser.parse_args()

    ensure_dirs()
    old_data = load_previous_data()
    all_products = []
    
    for Scanner in [SparScanner, MercatorScanner, HitriNakupScanner, JagerScanner]:
        try:
            all_products.extend(Scanner().scan())
        except Exception as e:
            logger.error(f"Napaka: {e}")
    
    new_data = {
        'datum_skeniranja': datetime.now().isoformat(),
        'stevilo_izdelkov': len(all_products),
        'statistika': {
            'spar': len([p for p in all_products if 'Spar' in p['trgovina']]),
            'mercator': len([p for p in all_products if 'Mercator' in p['trgovina']]),
            'hitri_nakup': len([p for p in all_products if 'Hitri' in p['trgovina']]),
            'jager': len([p for p in all_products if 'Jager' in p['trgovina']])
        },
        'izdelki': all_products
    }
    
    save_data(new_data)
    
    if old_data:
        changes = compare_and_save_changes(old_data, new_data)
        logger.info(f"Spremembe: {len(changes['spremembe_cen'])} cen, {len(changes['nove_akcije'])} novih akcij")
    
    if args.upload:
        upload_to_convex(new_data)
    
    logger.info(f"Koncano! {len(all_products)} izdelkov")


if __name__ == "__main__":
    main()
