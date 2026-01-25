"""Inspect Mercator HTML to find correct selectors"""
import time
from playwright.sync_api import sync_playwright
from stores.mercator import MercatorScraper

print("=" * 60)
print("MERCATOR HTML INSPECTOR")
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

    print("\n[1] Odpiranje strani...")
    page.goto("https://mercatoronline.si/brskaj", wait_until="domcontentloaded", timeout=60000)
    time.sleep(5)

    print("[2] Zapiram popup...")
    scraper.wait_and_dismiss_popups(3.0)

    print("[3] Scrollam malo...")
    for i in range(5):
        page.evaluate("window.scrollBy(0, 1000)")
        time.sleep(1)

    print("\n[4] Iscem vse elemente ki vsebujejo 'product' v class...")

    # Najdi vse unikatne class-e
    classes_html = page.evaluate("""
        () => {
            const classes = new Set();
            document.querySelectorAll('*').forEach(el => {
                if (el.className && typeof el.className === 'string') {
                    el.className.split(' ').forEach(c => {
                        if (c.toLowerCase().includes('product') ||
                            c.toLowerCase().includes('item') ||
                            c.toLowerCase().includes('card') ||
                            c.toLowerCase().includes('tile') ||
                            c.toLowerCase().includes('grid')) {
                            classes.add(c);
                        }
                    });
                }
            });
            return Array.from(classes).slice(0, 50);
        }
    """)

    print(f"\n   Najdeni class-i:")
    for c in sorted(classes_html):
        print(f"   - {c}")

    print("\n[5] Iscem elemente z data atributi...")
    data_attrs = page.evaluate("""
        () => {
            const attrs = new Set();
            document.querySelectorAll('*').forEach(el => {
                for (let attr of el.attributes) {
                    if (attr.name.startsWith('data-')) {
                        attrs.add(attr.name);
                    }
                }
            });
            return Array.from(attrs).slice(0, 30);
        }
    """)

    print(f"   Data atributi:")
    for a in sorted(data_attrs):
        print(f"   - {a}")

    print("\n[6] Iscem slike izdelkov...")
    images = page.evaluate("""
        () => {
            const imgs = document.querySelectorAll('img');
            const result = [];
            for (let img of imgs) {
                const src = img.src || img.getAttribute('data-src') || '';
                const alt = img.alt || '';
                if (src && !src.includes('data:') && (alt.length > 5 || src.includes('product'))) {
                    result.push({src: src.substring(0, 100), alt: alt.substring(0, 50), class: img.className});
                }
            }
            return result.slice(0, 10);
        }
    """)

    print(f"   Slike:")
    for img in images:
        print(f"   - alt: {img.get('alt', '')}")
        print(f"     class: {img.get('class', '')}")
        print(f"     src: {img.get('src', '')[:80]}...")
        print()

    print("\n[7] HTML snippet prvega izdelka (ce najdem)...")
    first_product = page.evaluate("""
        () => {
            // Poskusi najti produkt po razlicnih nacinih
            const selectors = [
                '[class*="product"]',
                '[class*="Product"]',
                '[class*="item"]',
                '[class*="Item"]',
                '[class*="card"]',
                '[class*="Card"]',
                '[class*="tile"]',
                '[class*="Tile"]',
                'article',
                '[data-testid]',
            ];

            for (let sel of selectors) {
                const els = document.querySelectorAll(sel);
                for (let el of els) {
                    // Preveri da ima sliko in ceno
                    const hasImg = el.querySelector('img');
                    const text = el.innerText || '';
                    const hasPrice = text.includes('€') || text.includes('EUR');

                    if (hasImg && hasPrice && text.length > 10 && text.length < 500) {
                        return {
                            selector: sel,
                            tagName: el.tagName,
                            className: el.className,
                            text: text.substring(0, 300),
                            html: el.outerHTML.substring(0, 1000)
                        };
                    }
                }
            }
            return null;
        }
    """)

    if first_product:
        print(f"   Najden s selektorjem: {first_product.get('selector')}")
        print(f"   Tag: {first_product.get('tagName')}")
        print(f"   Class: {first_product.get('className')}")
        print(f"\n   Tekst:")
        print(f"   {first_product.get('text')[:200]}")
        print(f"\n   HTML (prvi 500 znakov):")
        print(f"   {first_product.get('html')[:500]}")
    else:
        print("   Ni najdenega izdelka!")

    print("\n[8] Cakam 5s...")
    time.sleep(5)
    browser.close()

print("\n" + "=" * 60)
print("INSPEKCIJA KONCANA!")
print("=" * 60)
