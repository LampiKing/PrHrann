"""Full test of Mercator scraper"""
import time
import json
from playwright.sync_api import sync_playwright
from stores.mercator import MercatorScraper

print("=" * 60)
print("MERCATOR FULL SCRAPER TEST")
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

    print("\n[1] Zacem scrape_all_simple() - odpre /brskaj ...")
    products = scraper.scrape_all_simple()

    print(f"\n[2] REZULTAT:")
    print(f"   Stevilo izdelkov: {len(products)}")

    if products:
        print(f"\n   Primeri izdelkov:")
        for i, p in enumerate(products[:5]):
            print(f"\n   {i+1}. {p['ime'][:50]}...")
            print(f"      Cena: {p['redna_cena']} EUR")
            if p.get('akcijska_cena'):
                print(f"      Akcija: {p['akcijska_cena']} EUR")
            print(f"      Kategorija: {p.get('kategorija', '-')[:30]}")

        # Shrani rezultat
        with open("mercator_full_test.json", "w", encoding="utf-8") as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        print(f"\n   Shranjeno v mercator_full_test.json")

    browser.close()

print("\n" + "=" * 60)
print("FULL TEST KONCAN!")
print("=" * 60)
