"""
KOMPLETNI TEST MERCATOR SCRAPERJA
- Preveri popup zapiranje
- Preveri infinite scroll
- Preveri ekstrakcijo izdelkov
"""
import time
import json
from playwright.sync_api import sync_playwright
from stores.mercator import MercatorScraper

print("=" * 60)
print("MERCATOR KOMPLETNI TEST")
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

    # ============== TEST 1: ODPIRANJE STRANI ==============
    print("\n[TEST 1] Odpiranje https://mercatoronline.si/brskaj ...")
    page.goto("https://mercatoronline.si/brskaj", wait_until="domcontentloaded", timeout=60000)
    time.sleep(3)
    print("   OK - Stran odprta")

    # ============== TEST 2: POPUP ZAPIRANJE ==============
    print("\n[TEST 2] Zapiram popup 'Izbira nacina prevzema'...")

    # Preveri ali je popup prisoten
    popup_visible_before = False
    try:
        modal = page.query_selector('[role="dialog"], [class*="Modal"], [class*="modal"]')
        if modal and modal.is_visible():
            popup_visible_before = True
            print("   Popup VIDEN pred zapiranjem")
    except:
        pass

    # Zapri popup
    for attempt in range(5):
        closed = scraper.dismiss_delivery_popup()
        if closed:
            print(f"   Popup ZAPRT (poskus {attempt + 1})")
            break
        time.sleep(1)

    # Preveri da je popup zaprt
    time.sleep(1)
    popup_visible_after = False
    try:
        modal = page.query_selector('[role="dialog"], [class*="Modal"], [class*="modal"]')
        if modal and modal.is_visible():
            # Preveri da ni to kaksen drug popup
            text = modal.inner_text()
            if "prevzem" in text.lower() or "dostava" in text.lower():
                popup_visible_after = True
    except:
        pass

    if popup_visible_after:
        print("   [NAPAKA] Popup se NI ZAPRL!")
    else:
        print("   [OK] Popup ZAPRT ali ni bil prisoten")

    # ============== TEST 3: INFINITE SCROLL ==============
    print("\n[TEST 3] Testiram infinite scroll...")

    # Prestej izdelke pred scrollom
    def count_products():
        for sel in scraper.PRODUCT_SELECTORS[:3]:
            els = page.query_selector_all(sel)
            if els and len(els) > 3:
                return len(els)
        return 0

    products_before = count_products()
    print(f"   Izdelkov pred scrollom: {products_before}")

    # Scroll 30x (to bo naložilo veliko izdelkov)
    print("   Scrollam...")
    for i in range(30):
        page.evaluate("window.scrollBy(0, 2000)")
        time.sleep(0.5)
        if (i + 1) % 10 == 0:
            current = count_products()
            print(f"   Scroll {i+1}/30 - izdelkov: {current}")

    products_after = count_products()
    print(f"   Izdelkov po scrollu: {products_after}")

    if products_after > products_before:
        print(f"   [OK] Infinite scroll DELA! (+{products_after - products_before} izdelkov)")
    else:
        print("   [NAPAKA] Infinite scroll NE DELA!")

    # ============== TEST 4: EKSTRAKCIJA IZDELKOV ==============
    print("\n[TEST 4] Testiram ekstrakcijo izdelkov...")

    products_els = page.query_selector_all('.box.item.product, div.product[data-item-id]')
    print(f"   Najdeno {len(products_els)} elementov")

    extracted = []
    errors = 0

    for el in products_els[:50]:  # Testiraj prvih 50
        try:
            product = scraper.extract_product_data(el, "Test")
            if product:
                extracted.append(product)
            else:
                errors += 1
        except Exception as e:
            errors += 1

    print(f"   Ekstrahiranih: {len(extracted)} izdelkov")
    print(f"   Napak: {errors}")

    if len(extracted) > 0:
        print(f"   [OK] Ekstrakcija DELA!")

        # Prikazi nekaj primerov
        print("\n   Primeri izdelkov:")
        for p in extracted[:3]:
            print(f"   - {p['ime'][:50]}... | {p['redna_cena']} EUR")

        # Shrani rezultate
        with open("mercator_test_results.json", "w", encoding="utf-8") as f:
            json.dump({
                "popup_closed": not popup_visible_after,
                "products_before_scroll": products_before,
                "products_after_scroll": products_after,
                "extracted_count": len(extracted),
                "sample_products": extracted[:10]
            }, f, ensure_ascii=False, indent=2)
        print("\n   Rezultati shranjeni v mercator_test_results.json")
    else:
        print("   [NAPAKA] Ekstrakcija NE DELA!")

    # ============== POVZETEK ==============
    print("\n" + "=" * 60)
    print("POVZETEK:")
    print(f"  - Popup zaprt: {'DA' if not popup_visible_after else 'NE'}")
    print(f"  - Infinite scroll: {'DA' if products_after > products_before else 'NE'} ({products_after} izdelkov)")
    print(f"  - Ekstrakcija: {'DA' if len(extracted) > 0 else 'NE'} ({len(extracted)} izdelkov)")
    print("=" * 60)

    print("\nCakam 5s...")
    time.sleep(5)
    browser.close()

print("\nTEST KONCAN!")
