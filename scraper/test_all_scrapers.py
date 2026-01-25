"""
TEST VSEH SCRAPERJEV
====================
Testiraj vsak scraper posebej da ni komplikacij.
"""

import time
from datetime import datetime
from playwright.sync_api import sync_playwright

from stores.spar import SparScraper
from stores.mercator import MercatorScraper
from stores.tus import TusScraper
from google_sheets import GoogleSheetsManager


def test_scraper(name, scraper_class, page, scrape_method="scrape_all", max_products=100):
    """Testiraj en scraper"""
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")

    try:
        scraper = scraper_class(page)

        # Uporabi pravo metodo
        if scrape_method == "scrape_all_simple":
            products = scraper.scrape_all_simple()
        else:
            products = scraper.scrape_all()

        print(f"\n[OK] {name}: {len(products)} izdelkov")

        # Preveri strukturo
        if products:
            p = products[0]
            print(f"\nPrimer izdelka:")
            print(f"  ime: {p.get('ime', 'MANJKA')[:50]}...")
            print(f"  redna_cena: {p.get('redna_cena', 'MANJKA')}")
            print(f"  akcijska_cena: {p.get('akcijska_cena', '-')}")
            print(f"  slika: {p.get('slika', 'MANJKA')[:60] if p.get('slika') else 'MANJKA'}...")
            print(f"  kategorija: {p.get('kategorija', 'MANJKA')[:40]}...")

            # Preveri ali ima sliko
            with_images = sum(1 for x in products if x.get('slika'))
            print(f"\n  Izdelkov s sliko: {with_images}/{len(products)} ({100*with_images//len(products)}%)")

        return products[:max_products]  # Vrni samo prvih N za test upload

    except Exception as e:
        print(f"\n[X] NAPAKA: {e}")
        import traceback
        traceback.print_exc()
        return []


def test_google_sheets_upload(store, products):
    """Testiraj upload v Google Sheets"""
    print(f"\n{'='*60}")
    print(f"TEST UPLOAD: {store.upper()}")
    print(f"{'='*60}")

    if not products:
        print("[!] Ni izdelkov za upload")
        return False

    try:
        gs = GoogleSheetsManager()
        if not gs.connect():
            return False

        # Upload prvih 10 za test
        test_products = products[:10]
        print(f"Uploading {len(test_products)} testnih izdelkov...")

        # NE POČISTI SHEETA - samo dodaj na konec za test
        sheet = gs.open_sheet(store)
        if sheet:
            ws = sheet.sheet1
            # Najdi zadnjo vrstico
            all_values = ws.get_all_values()
            next_row = len(all_values) + 1

            # Pripravi testne podatke
            timestamp = datetime.now().strftime("%d. %m. %Y %H:%M")
            rows = []
            for p in test_products:
                cena = p.get("redna_cena", "")
                if cena:
                    cena = f"{cena:.2f}€".replace(".", ",")
                akcijska = p.get("akcijska_cena", "")
                if akcijska:
                    akcijska = f"{akcijska:.2f}€".replace(".", ",")

                rows.append([
                    f"[TEST] {p.get('ime', '')}",
                    cena,
                    p.get("slika", "") or "",
                    akcijska,
                    "Test",
                    timestamp
                ])

            ws.update(f"A{next_row}", rows)
            print(f"[OK] Dodanih {len(rows)} testnih vrstic na pozicijo {next_row}")
            return True

    except Exception as e:
        print(f"[X] NAPAKA: {e}")
        return False


def main():
    print("=" * 70)
    print("PR'HRAN - TEST VSEH SCRAPERJEV")
    print(f"Čas: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled"]
        )
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            locale="sl-SI",
        )
        context.set_default_timeout(60000)
        page = context.new_page()

        # Test SPAR (samo prva kategorija za hitrost)
        print("\n[1/3] Testing SPAR...")
        spar_products = test_scraper("SPAR", SparScraper, page)
        results["spar"] = len(spar_products)

        time.sleep(2)

        # Test MERCATOR
        print("\n[2/3] Testing MERCATOR...")
        mercator_products = test_scraper("MERCATOR", MercatorScraper, page, "scrape_all_simple")
        results["mercator"] = len(mercator_products)

        time.sleep(2)

        # Test TUŠ (samo prvih 5 podkategorij)
        print("\n[3/3] Testing TUŠ...")
        tus_products = test_scraper("TUŠ", TusScraper, page)
        results["tus"] = len(tus_products)

        browser.close()

    # Test Google Sheets upload
    print("\n" + "=" * 70)
    print("TEST GOOGLE SHEETS UPLOAD")
    print("=" * 70)

    # Testiraj upload za vsako trgovino
    if spar_products:
        test_google_sheets_upload("spar", spar_products)
    if mercator_products:
        test_google_sheets_upload("mercator", mercator_products)
    if tus_products:
        test_google_sheets_upload("tus", tus_products)

    # Povzetek
    print("\n" + "=" * 70)
    print("POVZETEK TESTOV")
    print("=" * 70)
    for store, count in results.items():
        status = "[OK]" if count > 0 else "[X]"
        print(f"  {status} {store.upper()}: {count} izdelkov")

    all_ok = all(count > 0 for count in results.values())
    print(f"\n{'[OK] VSI TESTI USPEŠNI!' if all_ok else '[X] NEKATERI TESTI NISO USPELI!'}")

    return all_ok


if __name__ == "__main__":
    main()
