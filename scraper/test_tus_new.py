"""Test novega Tuš flow-a - podkategorije direktno"""
import time
from playwright.sync_api import sync_playwright
from stores.tus import TusScraper

print("=" * 60)
print("TUŠ NOVI FLOW TEST")
print("=" * 60)

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
    context.set_default_timeout(30000)
    page = context.new_page()

    scraper = TusScraper(page)

    # Test samo prvih 3 podkategorij
    test_subcats = [
        ("Zelenjava", "Sadje in zelenjava"),
        ("Sadje", "Sadje in zelenjava"),
        ("Mleko", "Mlečni izdelki in jajca"),
    ]

    total_products = 0

    for i, (subcat, maincat) in enumerate(test_subcats):
        print(f"\n[{i+1}/{len(test_subcats)}] {maincat} > {subcat}")

        # 1. Odpri /kategorije
        print("   Odpiranje /kategorije...")
        page.goto("https://hitrinakup.com/kategorije", wait_until="domcontentloaded", timeout=60000)
        time.sleep(3)

        # Zapri popupe
        scraper.accept_cookies()
        scraper.close_popups()
        time.sleep(1)

        # 2. Klikni podkategorijo
        print(f"   Klikam: {subcat}")
        clicked = scraper._click_subcategory_on_main_page(subcat)

        if clicked:
            print("   Podkategorija kliknjena!")
            time.sleep(3)

            # 3. Infinite scroll (samo 10x za test)
            print("   Scrollam (10x)...")
            for j in range(10):
                page.evaluate("window.scrollBy(0, 1500)")
                time.sleep(1)

            # 4. Prestej izdelke
            for sel in scraper.PRODUCT_SELECTORS:
                els = page.query_selector_all(sel)
                if els and len(els) > 3:
                    print(f"   Najdeno: {len(els)} izdelkov")
                    total_products += len(els)
                    break

        else:
            print("   [NAPAKA] Ne najdem podkategorije!")

        print(f"   Nazaj na /kategorije za naslednjo...")
        time.sleep(1)

    print(f"\n{'=' * 60}")
    print(f"SKUPAJ IZDELKOV: {total_products}")
    print(f"{'=' * 60}")

    time.sleep(5)
    browser.close()

print("\nTEST KONCAN!")
