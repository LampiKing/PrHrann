"""Quick test for Tuš scraper"""
import time
import json
from playwright.sync_api import sync_playwright
from stores.tus import TusScraper

print("=" * 60)
print("TUŠ SCRAPER TEST")
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

    print("\n[1] Odpiranje https://hitrinakup.com/kategorije ...")
    page.goto("https://hitrinakup.com/kategorije", wait_until="domcontentloaded", timeout=60000)
    time.sleep(5)

    print("[2] Zapiram popup-e...")
    scraper.accept_cookies()
    scraper.close_popups()
    time.sleep(2)

    print("\n[3] Iscem kategorije na strani...")

    # Poišči glavne kategorije
    categories = page.evaluate("""
        () => {
            const links = document.querySelectorAll('a');
            const cats = [];
            for (let link of links) {
                const text = link.innerText.trim();
                if (text.includes('Sadje') || text.includes('Meso') || text.includes('Mlečni') ||
                    text.includes('Kruh') || text.includes('Zamrznjeni') || text.includes('Pijače')) {
                    cats.push({
                        text: text.substring(0, 50),
                        href: link.href
                    });
                }
            }
            return cats.slice(0, 10);
        }
    """)

    print(f"   Najdene kategorije:")
    for cat in categories[:6]:
        print(f"   - {cat.get('text', '')}")

    print("\n[4] Klikam na 'Sadje in zelenjava'...")
    try:
        if scraper.click_main_category("Sadje in zelenjava"):
            time.sleep(3)
            print("   Kategorija kliknjena!")

            # Scroll
            print("\n[5] Scrollam...")
            for i in range(10):
                page.evaluate("window.scrollBy(0, 1000)")
                time.sleep(0.8)
                if (i + 1) % 5 == 0:
                    print(f"   Scroll {i+1}/10")

            # Preštej izdelke
            print("\n[6] Prestevam izdelke...")
            for selector in scraper.PRODUCT_SELECTORS:
                els = page.query_selector_all(selector)
                count = len(els) if els else 0
                if count > 3:
                    print(f"   Najdeno {count} izdelkov s: {selector}")
                    break

            # Ekstrahiraj par izdelkov
            print("\n[7] Testiram ekstrakcijo...")
            products_els = page.query_selector_all(scraper.PRODUCT_SELECTORS[0])

            extracted = []
            for el in products_els[:5]:
                try:
                    product = scraper.extract_product_data(el, "Sadje in zelenjava")
                    if product:
                        extracted.append(product)
                        print(f"\n   {len(extracted)}. {product['ime'][:40]}...")
                        print(f"      Cena: {product['redna_cena']} EUR")
                except Exception as e:
                    print(f"   Napaka: {e}")

            print(f"\n   Ekstrahiranih: {len(extracted)} izdelkov")

        else:
            print("   Ne najdem kategorije!")
    except Exception as e:
        print(f"   Napaka: {e}")

    print("\n[8] Cakam 5s...")
    time.sleep(5)
    browser.close()

print("\n" + "=" * 60)
print("TUS TEST KONCAN!")
print("=" * 60)
