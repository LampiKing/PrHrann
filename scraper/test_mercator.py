"""Quick test for Mercator scraper"""
import time
import sys
from playwright.sync_api import sync_playwright
from stores.mercator import MercatorScraper

print("=" * 60)
print("MERCATOR SCRAPER TEST")
print("=" * 60)

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=False,  # Headful za debug
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

    print("[2] Cakam na nalaganje (5s)...")
    time.sleep(5)

    print("[3] Zapiram popup 'Izbira nacina prevzema'...")
    scraper.wait_and_dismiss_popups(3.0)

    print("[4] Scrollam dol (15x)...")
    for i in range(15):
        page.evaluate("window.scrollBy(0, 1500)")
        time.sleep(0.8)
        if (i + 1) % 5 == 0:
            print(f"   Scroll {i+1}/15")

    print("\n[5] Prestevam izdelke...")
    found = False
    for selector in scraper.PRODUCT_SELECTORS[:8]:
        els = page.query_selector_all(selector)
        if els and len(els) > 5:
            print(f"   NAJDENO: {len(els)} izdelkov s selektorjem: {selector}")
            found = True
            break

    if not found:
        print("   OPOZORILO: Ni najdenih izdelkov!")

    print("\n[6] Cakam 5s da vidis rezultat...")
    time.sleep(5)

    browser.close()

print("\n" + "=" * 60)
print("TEST KONCAN!")
print("=" * 60)
