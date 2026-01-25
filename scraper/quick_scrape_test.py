"""
HITER TEST SCRAPERJEV
=====================
Testiraj vsak scraper z malo izdelki za hitro preverjanje.
"""

import time
from datetime import datetime
from playwright.sync_api import sync_playwright

def test_spar():
    """Test SPAR - samo prva kategorija"""
    from stores.spar import SparScraper

    print("\n" + "=" * 60)
    print("[SPAR] HITER TEST")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            locale="sl-SI",
        )
        context.set_default_timeout(60000)
        page = context.new_page()

        try:
            scraper = SparScraper(page)
            # Samo 1 kategorija za hiter test
            scraper.MAIN_CATEGORIES = scraper.MAIN_CATEGORIES[:1]
            products = scraper.scrape_all()

            print(f"\n[SPAR] {len(products)} izdelkov")
            if products:
                p = products[0]
                print(f"  Ime: {p.get('ime', 'N/A')[:50]}")
                print(f"  Cena: {p.get('redna_cena', 'N/A')}")
                print(f"  Slika: {p.get('slika', 'NI!')[:60]}...")

                # Koliko ima slik
                with_images = sum(1 for x in products if x.get('slika'))
                print(f"  S slikami: {with_images}/{len(products)}")

            return products

        finally:
            browser.close()


def test_mercator():
    """Test MERCATOR - samo prvih N izdelkov"""
    from stores.mercator import MercatorScraper

    print("\n" + "=" * 60)
    print("[MERCATOR] HITER TEST")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            locale="sl-SI",
        )
        context.set_default_timeout(60000)
        page = context.new_page()

        try:
            scraper = MercatorScraper(page)
            # Modificiraj da naredi samo 10 scrollov za test
            original_scroll = scraper.scroll_and_load_all

            def limited_scroll(max_scrolls=10):
                return original_scroll(max_scrolls=10)

            scraper.scroll_and_load_all = limited_scroll
            products = scraper.scrape_all_simple()

            print(f"\n[MERCATOR] {len(products)} izdelkov")
            if products:
                p = products[0]
                print(f"  Ime: {p.get('ime', 'N/A')[:50]}")
                print(f"  Cena: {p.get('redna_cena', 'N/A')}")
                print(f"  Slika: {p.get('slika', 'NI!')[:60] if p.get('slika') else 'NI!'}...")

                # Koliko ima slik
                with_images = sum(1 for x in products if x.get('slika'))
                print(f"  S slikami: {with_images}/{len(products)}")

            return products

        finally:
            browser.close()


def test_tus():
    """Test TUŠ - samo prva podkategorija"""
    from stores.tus import TusScraper

    print("\n" + "=" * 60)
    print("[TUŠ] HITER TEST")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            locale="sl-SI",
        )
        context.set_default_timeout(60000)
        page = context.new_page()

        try:
            scraper = TusScraper(page)
            # Samo 1 podkategorija za test
            scraper.SUBCATEGORIES = scraper.SUBCATEGORIES[:1]
            products = scraper.scrape_all()

            print(f"\n[TUŠ] {len(products)} izdelkov")
            if products:
                p = products[0]
                print(f"  Ime: {p.get('ime', 'N/A')[:50]}")
                print(f"  Cena: {p.get('redna_cena', 'N/A')}")
                print(f"  Slika: {p.get('slika', 'NI!')[:60] if p.get('slika') else 'NI!'}...")

                # Koliko ima slik
                with_images = sum(1 for x in products if x.get('slika'))
                print(f"  S slikami: {with_images}/{len(products)}")

            return products

        finally:
            browser.close()


if __name__ == "__main__":
    print("=" * 70)
    print("HITER TEST - VSEH 3 SCRAPERJEV")
    print(f"Čas: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    results = {}

    # Test vsake trgovine
    try:
        results["spar"] = test_spar()
    except Exception as e:
        print(f"[SPAR] NAPAKA: {e}")
        results["spar"] = []

    time.sleep(2)

    try:
        results["mercator"] = test_mercator()
    except Exception as e:
        print(f"[MERCATOR] NAPAKA: {e}")
        results["mercator"] = []

    time.sleep(2)

    try:
        results["tus"] = test_tus()
    except Exception as e:
        print(f"[TUŠ] NAPAKA: {e}")
        results["tus"] = []

    # Povzetek
    print("\n" + "=" * 70)
    print("POVZETEK")
    print("=" * 70)
    for store, products in results.items():
        count = len(products)
        with_images = sum(1 for p in products if p.get('slika')) if products else 0
        status = "OK" if count > 0 else "FAIL"
        print(f"  [{status}] {store.upper()}: {count} izdelkov, {with_images} s slikami")
