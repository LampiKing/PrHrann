"""
PrHran BULLETPROOF Avtomatski Scraper
=====================================
Scrapa izdelke iz Spar, Mercator in Tuš
Uporablja store-specifične scraperje z BULLETPROOF logiko

FEATURES:
- Retry z exponential backoff
- Več fallback selektorjev za vsak element
- Data validation in quality checks
- Anti-detection (cookies, popups, rate limiting)
- Progress saving (lahko nadaljuješ če se prekine)
- Detailed logging
- BULLETPROOF MATCHING za ujemanje istih izdelkov

UPORABA:
    python scraper.py                    # Vse trgovine
    python scraper.py --store spar       # Samo Spar
    python scraper.py --no-upload        # Brez pošiljanja v Convex
    python scraper.py --headful          # Prikaži browser
"""
import json
import time
import sys
import traceback
import requests
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

# Google Sheets upload
from google_sheets import upload_to_sheets, GoogleSheetsManager

from config import CONVEX_URL, INGEST_TOKEN

# Store-specific scrapers
from stores.spar import SparScraper
from stores.mercator import MercatorScraper
from stores.tus import TusScraper

# Product matcher
from matcher import ProductMatcher


class PrHranScraper:
    """BULLETPROOF glavni orchestrator za vse scraperje"""

    def __init__(self, headless: bool = True):
        self.headless = headless
        self.all_products = []
        self.stats = {
            "spar": 0,
            "mercator": 0,
            "tus": 0,
            "total": 0,
            "matched_groups": 0,
            "multi_store_matches": 0,
            "start_time": None,
            "end_time": None,
            "errors": [],
        }
        self.progress_dir = Path(__file__).parent / "progress"
        self.progress_dir.mkdir(exist_ok=True)

    def log(self, message: str, level: str = "INFO"):
        """Structured logging (Windows-safe)"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        prefix = f"[{timestamp}] [MAIN]"

        # Windows-safe symbols
        symbol = {
            "ERROR": "[X]",
            "WARNING": "[!]",
            "SUCCESS": "[OK]",
        }.get(level, "")

        log_line = f"{prefix} {symbol} {message}" if symbol else f"{prefix} {message}"

        try:
            print(log_line, flush=True)
        except UnicodeEncodeError:
            safe_line = log_line.encode('ascii', 'replace').decode('ascii')
            print(safe_line, flush=True)

    def scrape_spar(self, page) -> list[dict]:
        """Scrapaj SPAR z BULLETPROOF scraperjem"""
        self.log("=" * 60)
        self.log("SCRAPING: SPAR")
        self.log("=" * 60)

        try:
            scraper = SparScraper(page)
            products = scraper.scrape_all()
            self.stats["spar"] = len(products)
            self.log(f"SPAR KONČANO: {len(products)} izdelkov", "SUCCESS")
            return products
        except Exception as e:
            self.log(f"SPAR NAPAKA: {e}", "ERROR")
            self.stats["errors"].append({"store": "spar", "error": str(e)})
            traceback.print_exc()
            return []

    def scrape_mercator(self, page) -> list[dict]:
        """Scrapaj MERCATOR z BULLETPROOF scraperjem"""
        self.log("=" * 60)
        self.log("SCRAPING: MERCATOR")
        self.log("=" * 60)

        try:
            scraper = MercatorScraper(page)
            # Uporabi /brskaj URL z infinite scroll (vsi izdelki na eni strani)
            products = scraper.scrape_all_simple()
            self.stats["mercator"] = len(products)
            self.log(f"MERCATOR KONČANO: {len(products)} izdelkov", "SUCCESS")
            return products
        except Exception as e:
            self.log(f"MERCATOR NAPAKA: {e}", "ERROR")
            self.stats["errors"].append({"store": "mercator", "error": str(e)})
            traceback.print_exc()
            return []

    def scrape_tus(self, page) -> list[dict]:
        """Scrapaj TUŠ z BULLETPROOF scraperjem"""
        self.log("=" * 60)
        self.log("SCRAPING: TUŠ")
        self.log("=" * 60)

        try:
            scraper = TusScraper(page)
            products = scraper.scrape_all()
            self.stats["tus"] = len(products)
            self.log(f"TUŠ KONČANO: {len(products)} izdelkov", "SUCCESS")
            return products
        except Exception as e:
            self.log(f"TUŠ NAPAKA: {e}", "ERROR")
            self.stats["errors"].append({"store": "tus", "error": str(e)})
            traceback.print_exc()
            return []

    def scrape_all(self) -> list[dict]:
        """Scrapaj vse trgovine"""
        self.stats["start_time"] = datetime.now()
        self.all_products = []

        self.log("=" * 60)
        self.log("PrHran BULLETPROOF Scraper")
        self.log(f"Čas: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.log("=" * 60)

        with sync_playwright() as p:
            # Zaženi browser z optimiziranimi nastavitvami
            browser = p.chromium.launch(
                headless=self.headless,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-accelerated-2d-canvas",
                    "--no-first-run",
                    "--no-zygote",
                    "--disable-gpu",
                    "--disable-blink-features=AutomationControlled",
                ]
            )

            # Context z realističnimi nastavitvami
            context = browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale="sl-SI",
                timezone_id="Europe/Ljubljana",
                geolocation={"latitude": 46.0569, "longitude": 14.5058},  # Ljubljana
                permissions=["geolocation"],
            )

            # Nastavi timeout
            context.set_default_timeout(30000)

            page = context.new_page()

            # Scrapaj vsako trgovino posebej
            try:
                spar_products = self.scrape_spar(page)
                self.all_products.extend(spar_products)
                self.save_progress("spar", spar_products)
            except Exception as e:
                self.log(f"KRITIČNA NAPAKA pri SPAR: {e}", "ERROR")

            time.sleep(2)

            try:
                mercator_products = self.scrape_mercator(page)
                self.all_products.extend(mercator_products)
                self.save_progress("mercator", mercator_products)
            except Exception as e:
                self.log(f"KRITIČNA NAPAKA pri MERCATOR: {e}", "ERROR")

            time.sleep(2)

            try:
                tus_products = self.scrape_tus(page)
                self.all_products.extend(tus_products)
                self.save_progress("tus", tus_products)
            except Exception as e:
                self.log(f"KRITIČNA NAPAKA pri TUŠ: {e}", "ERROR")

            browser.close()

        self.stats["end_time"] = datetime.now()
        self.stats["total"] = len(self.all_products)

        # ============ GOOGLE SHEETS UPLOAD ============
        # Uploada scrapane podatke v Google Sheets
        self.log("=" * 60)
        self.log("UPLOAD V GOOGLE SHEETS...")
        self.log("=" * 60)

        try:
            # Razdeli po trgovinah in uploada
            gs = GoogleSheetsManager()
            if gs.connect():
                # SPAR
                spar_products = [p for p in self.all_products if p.get("trgovina", "").lower() == "spar"]
                if spar_products:
                    gs.upload_products("spar", spar_products)
                    self.log(f"SPAR: {len(spar_products)} izdelkov uploadanih", "SUCCESS")

                # Mercator
                mercator_products = [p for p in self.all_products if p.get("trgovina", "").lower() == "mercator"]
                if mercator_products:
                    gs.upload_products("mercator", mercator_products)
                    self.log(f"MERCATOR: {len(mercator_products)} izdelkov uploadanih", "SUCCESS")

                # Tuš
                tus_products = [p for p in self.all_products if "tuš" in p.get("trgovina", "").lower() or "tus" in p.get("trgovina", "").lower()]
                if tus_products:
                    gs.upload_products("tus", tus_products)
                    self.log(f"TUŠ: {len(tus_products)} izdelkov uploadanih", "SUCCESS")
        except Exception as e:
            self.log(f"Napaka pri Google Sheets uploadu: {e}", "ERROR")

        # MATCHING - poveži iste izdelke iz različnih trgovin
        if len(self.all_products) > 0:
            self.all_products = self.run_matching()

        return self.all_products

    def run_matching(self) -> list[dict]:
        """
        BULLETPROOF MATCHING
        Poveži iste izdelke iz različnih trgovin z istim match_id.
        """
        self.log("=" * 60)
        self.log("MATCHING IZDELKOV")
        self.log("=" * 60)

        try:
            matcher = ProductMatcher()
            matched_products = matcher.process_all(self.all_products)

            # Statistika
            grouped = matcher.get_grouped_products()
            multi_store = sum(1 for g in grouped.values() if len(g) > 1)

            self.stats["matched_groups"] = len(grouped)
            self.stats["multi_store_matches"] = multi_store

            self.log(f"Statistika matchinga:")
            self.log(f"  - Skupin izdelkov: {len(grouped)}")
            self.log(f"  - Izdelkov v več trgovinah: {multi_store}")
            if len(grouped) > 0:
                self.log(f"  - Procent ujemanja: {multi_store / len(grouped) * 100:.1f}%")

            return matched_products

        except Exception as e:
            self.log(f"Napaka pri matchingu: {e}", "ERROR")
            traceback.print_exc()
            # Če matching ne uspe, vrni originalne izdelke
            return self.all_products

    def scrape_single_store(self, store: str) -> list[dict]:
        """Scrapaj samo eno trgovino"""
        self.stats["start_time"] = datetime.now()
        self.all_products = []

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=self.headless,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-blink-features=AutomationControlled",
                ]
            )

            context = browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                locale="sl-SI",
            )
            context.set_default_timeout(30000)
            page = context.new_page()

            store_lower = store.lower()

            if store_lower == "spar":
                self.all_products = self.scrape_spar(page)
            elif store_lower == "mercator":
                self.all_products = self.scrape_mercator(page)
            elif store_lower in ["tus", "tuš", "hitri nakup"]:
                self.all_products = self.scrape_tus(page)
            else:
                self.log(f"Neznana trgovina: {store}", "ERROR")

            browser.close()

        self.stats["end_time"] = datetime.now()
        self.stats["total"] = len(self.all_products)

        return self.all_products

    def save_progress(self, store_name: str, products: list[dict]):
        """Shrani napredek za posamezno trgovino"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = self.progress_dir / f"{store_name}_{timestamp}.json"

        try:
            with open(filename, "w", encoding="utf-8") as f:
                json.dump({
                    "store": store_name,
                    "timestamp": timestamp,
                    "count": len(products),
                    "products": products
                }, f, ensure_ascii=False, indent=2)
            self.log(f"Progress shranjen: {filename}")
        except Exception as e:
            self.log(f"Napaka pri shranjevanju progress: {e}", "WARNING")

    def send_to_convex(self, products: list[dict] = None) -> bool:
        """Pošlji izdelke v Convex"""
        if products is None:
            products = self.all_products

        if not products:
            self.log("Ni izdelkov za pošiljanje", "WARNING")
            return False

        if not CONVEX_URL or not INGEST_TOKEN:
            self.log("Manjka CONVEX_URL ali PRHRAN_INGEST_TOKEN", "ERROR")
            self.log("  Nastavi environment variable-e ali .env datoteko")
            return False

        url = f"{CONVEX_URL}/api/ingest/grocery"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {INGEST_TOKEN}",
        }

        # Pripravi payload
        payload = {
            "items": products,
            "clearFirst": False,
        }

        self.log(f"Pošiljam {len(products)} izdelkov v Convex...")
        self.log(f"URL: {url}")

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=300)

            if response.status_code == 200:
                result = response.json()
                self.log("Uspešno poslano!", "SUCCESS")
                self.log(f"  - Ustvarjenih izdelkov: {result.get('createdProducts', 0)}")
                self.log(f"  - Posodobljenih izdelkov: {result.get('updatedProducts', 0)}")
                self.log(f"  - Ustvarjenih cen: {result.get('createdPrices', 0)}")
                self.log(f"  - Posodobljenih cen: {result.get('updatedPrices', 0)}")
                return True
            else:
                self.log(f"Napaka {response.status_code}: {response.text[:500]}", "ERROR")
                return False

        except requests.exceptions.Timeout:
            self.log("Timeout - poskusi z manj izdelki", "ERROR")
            return False
        except Exception as e:
            self.log(f"Napaka: {e}", "ERROR")
            return False

    def send_in_batches(self, batch_size: int = 500) -> bool:
        """Pošlji izdelke v batch-ih"""
        if not self.all_products:
            self.log("Ni izdelkov za pošiljanje", "WARNING")
            return False

        total = len(self.all_products)
        success = True
        sent = 0

        self.log(f"Pošiljam {total} izdelkov v batch-ih po {batch_size}...")

        for i in range(0, total, batch_size):
            batch = self.all_products[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total + batch_size - 1) // batch_size

            self.log(f"Batch {batch_num}/{total_batches}: {len(batch)} izdelkov")

            if not self.send_to_convex(batch):
                success = False
                self.log(f"Batch {batch_num} NAPAKA!", "ERROR")
            else:
                sent += len(batch)
                self.log(f"Batch {batch_num} OK! (skupaj poslano: {sent})")

            # Kratka pavza med batchi
            if i + batch_size < total:
                time.sleep(2)

        self.log(f"Končano: {sent}/{total} izdelkov poslanih")
        return success

    def save_to_file(self, filename: str = None) -> str:
        """Shrani izdelke v JSON datoteko"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"scraped_products_{timestamp}.json"

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(self.all_products, f, ensure_ascii=False, indent=2)

        self.log(f"Shranjeno v {filename}", "SUCCESS")
        return filename

    def print_stats(self):
        """Izpiši statistiko"""
        print("\n" + "=" * 60)
        print("STATISTIKA SCRAPANJA")
        print("=" * 60)
        print(f"  SPAR:     {self.stats['spar']:>6} izdelkov")
        print(f"  MERCATOR: {self.stats['mercator']:>6} izdelkov")
        print(f"  TUŠ:      {self.stats['tus']:>6} izdelkov")
        print(f"  " + "-" * 30)
        print(f"  SKUPAJ:   {self.stats['total']:>6} izdelkov")

        # Matching statistika
        if self.stats.get("matched_groups"):
            print(f"\n  MATCHING:")
            print(f"  Skupin:   {self.stats['matched_groups']:>6}")
            print(f"  V 2+ trg: {self.stats.get('multi_store_matches', 0):>6}")

        # Napake
        if self.stats.get("errors"):
            print(f"\n  NAPAKE: {len(self.stats['errors'])}")
            for err in self.stats["errors"]:
                print(f"    - {err['store']}: {err['error'][:50]}")

        if self.stats["start_time"] and self.stats["end_time"]:
            duration = self.stats["end_time"] - self.stats["start_time"]
            print(f"\n  Čas: {duration}")

        print("=" * 60 + "\n")


def main():
    """Glavni entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="PrHran BULLETPROOF Scraper")
    parser.add_argument(
        "--store", "-s",
        choices=["spar", "mercator", "tus", "all"],
        default="all",
        help="Katera trgovina (default: all)",
    )
    parser.add_argument(
        "--no-upload",
        action="store_true",
        help="Ne pošiljaj v Convex",
    )
    parser.add_argument(
        "--headful",
        action="store_true",
        help="Prikaži browser (za debugging)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Velikost batch-a za upload (default: 500)",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("PrHran BULLETPROOF Avtomatski Scraper")
    print(f"Čas: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    scraper = PrHranScraper(headless=not args.headful)

    # Scrapaj
    if args.store == "all":
        scraper.scrape_all()
    else:
        scraper.scrape_single_store(args.store)

    # Statistika
    scraper.print_stats()

    # Shrani lokalno
    if scraper.all_products:
        scraper.save_to_file()

    # Pošlji v Convex
    if not args.no_upload and scraper.all_products:
        print("\n" + "=" * 60)
        print("POŠILJANJE V CONVEX")
        print("=" * 60)
        scraper.send_in_batches(args.batch_size)


if __name__ == "__main__":
    main()
