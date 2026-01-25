"""
PR'HRAN FULL SCRAPE
===================
Scrapa VSE izdelke iz VSEH trgovin in uploada v Google Sheets.

Trgovine:
- SPAR (~10.000 izdelkov)
- Mercator (~10.000 izdelkov)
- Tuš (~10.000 izdelkov)

Po scrapanju avtomatsko uploada v Google Sheets.
"""

import time
from datetime import datetime
from playwright.sync_api import sync_playwright

from stores.spar import SparScraper
from stores.mercator import MercatorScraper
from stores.tus import TusScraper
from google_sheets import GoogleSheetsManager


def full_scrape():
    """Scrapa VSE in uploada v Google Sheets"""

    print("=" * 70)
    print("PR'HRAN FULL SCRAPE - VSE TRGOVINE")
    print(f"Čas: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    all_products = {
        "spar": [],
        "mercator": [],
        "tus": []
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,  # Headful da vidiš kaj se dogaja
            args=["--disable-blink-features=AutomationControlled"]
        )
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            locale="sl-SI",
        )
        context.set_default_timeout(60000)
        page = context.new_page()

        # ==================== SPAR ====================
        print("\n" + "=" * 70)
        print("[1/3] SCRAPING: SPAR")
        print("=" * 70)

        try:
            spar = SparScraper(page)
            spar_products = spar.scrape_all()
            all_products["spar"] = spar_products
            print(f"\n[SPAR] KONČANO: {len(spar_products)} izdelkov")
        except Exception as e:
            print(f"[SPAR] NAPAKA: {e}")

        time.sleep(3)

        # ==================== MERCATOR ====================
        print("\n" + "=" * 70)
        print("[2/3] SCRAPING: MERCATOR")
        print("=" * 70)

        try:
            mercator = MercatorScraper(page)
            mercator_products = mercator.scrape_all_simple()  # Uporabi /brskaj
            all_products["mercator"] = mercator_products
            print(f"\n[MERCATOR] KONČANO: {len(mercator_products)} izdelkov")
        except Exception as e:
            print(f"[MERCATOR] NAPAKA: {e}")

        time.sleep(3)

        # ==================== TUŠ ====================
        print("\n" + "=" * 70)
        print("[3/3] SCRAPING: TUŠ")
        print("=" * 70)

        try:
            tus = TusScraper(page)
            tus_products = tus.scrape_all()
            all_products["tus"] = tus_products
            print(f"\n[TUŠ] KONČANO: {len(tus_products)} izdelkov")
        except Exception as e:
            print(f"[TUŠ] NAPAKA: {e}")

        browser.close()

    # ==================== GOOGLE SHEETS UPLOAD ====================
    print("\n" + "=" * 70)
    print("UPLOAD V GOOGLE SHEETS")
    print("=" * 70)

    try:
        gs = GoogleSheetsManager()
        if gs.connect():
            for store, products in all_products.items():
                if products:
                    print(f"\n[{store.upper()}] Uploading {len(products)} izdelkov...")
                    gs.upload_products(store, products)
    except Exception as e:
        print(f"[NAPAKA] Google Sheets upload: {e}")

    # ==================== POVZETEK ====================
    print("\n" + "=" * 70)
    print("POVZETEK")
    print("=" * 70)
    total = 0
    for store, products in all_products.items():
        count = len(products)
        total += count
        print(f"  {store.upper()}: {count} izdelkov")
    print(f"\n  SKUPAJ: {total} izdelkov")
    print("=" * 70)

    return all_products


if __name__ == "__main__":
    full_scrape()
