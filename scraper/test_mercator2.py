"""Test Mercator scraper z novimi selektorji"""
import time
import json
from playwright.sync_api import sync_playwright
from stores.mercator import MercatorScraper

print("=" * 60)
print("MERCATOR SCRAPER TEST 2 - Z NOVIMI SELEKTORJI")
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

    scraper = MercatorScraper(page)

    print("\n[1] Odpiranje https://mercatoronline.si/brskaj ...")
    page.goto("https://mercatoronline.si/brskaj", wait_until="domcontentloaded", timeout=60000)
    time.sleep(5)

    print("[2] Zapiram popup...")
    scraper.wait_and_dismiss_popups(3.0)

    print("[3] Scrollam (20x)...")
    for i in range(20):
        page.evaluate("window.scrollBy(0, 1500)")
        time.sleep(0.6)
        if (i + 1) % 5 == 0:
            print(f"   Scroll {i+1}/20")

    print("\n[4] Prestevam izdelke z novimi selektorji...")

    for selector in scraper.PRODUCT_SELECTORS:
        els = page.query_selector_all(selector)
        count = len(els) if els else 0
        print(f"   {selector}: {count} elementov")
        if count > 5:
            break

    print("\n[5] Testiram ekstrakcijo na prvih 5 izdelkih...")

    # Najdi izdelke
    products_els = page.query_selector_all('.box.item.product, div.product[data-item-id], [data-item-id]')
    print(f"   Najdeno {len(products_els)} elementov")

    extracted = []
    for i, el in enumerate(products_els[:10]):
        try:
            product = scraper.extract_product_data(el, "Test")
            if product:
                extracted.append(product)
                if len(extracted) <= 5:
                    print(f"\n   Izdelek {len(extracted)}:")
                    print(f"     Ime: {product['ime'][:50]}...")
                    print(f"     Cena: {product['redna_cena']} EUR")
                    print(f"     Akcija: {product.get('akcijska_cena', '-')}")
                    print(f"     Kategorija: {product.get('kategorija', '-')[:30]}")
        except Exception as e:
            print(f"   Napaka: {e}")

    print(f"\n   SKUPAJ EKSTRAHIRANIH: {len(extracted)} izdelkov")

    if extracted:
        # Shrani vzorec
        with open("mercator_sample.json", "w", encoding="utf-8") as f:
            json.dump(extracted[:10], f, ensure_ascii=False, indent=2)
        print("   Vzorec shranjen v mercator_sample.json")

    print("\n[6] Cakam 5s...")
    time.sleep(5)
    browser.close()

print("\n" + "=" * 60)
print("TEST 2 KONCAN!")
print("=" * 60)
