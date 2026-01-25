"""Inspect Tuš HTML to find correct selectors"""
import time
from playwright.sync_api import sync_playwright

print("=" * 60)
print("TUŠ HTML INSPECTOR")
print("=" * 60)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context(
        viewport={"width": 1920, "height": 1080},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        locale="sl-SI",
    )
    page = context.new_page()

    print("\n[1] Odpiranje strani...")
    page.goto("https://hitrinakup.com/kategorije", wait_until="domcontentloaded", timeout=60000)
    time.sleep(3)

    # Zapri popupe
    try:
        page.keyboard.press("Escape")
        time.sleep(1)
    except:
        pass

    print("[2] Klikam na kategorijo...")
    try:
        page.click('text="Sadje in zelenjava"', timeout=5000)
        time.sleep(3)
    except Exception as e:
        print(f"   Napaka: {e}")

    print("[3] Scrollam...")
    for i in range(5):
        page.evaluate("window.scrollBy(0, 1000)")
        time.sleep(1)

    print("\n[4] Iscem class-e ki vsebujejo 'item', 'product', 'card'...")
    classes = page.evaluate("""
        () => {
            const classes = new Set();
            document.querySelectorAll('*').forEach(el => {
                if (el.className && typeof el.className === 'string') {
                    el.className.split(' ').forEach(c => {
                        if (c.toLowerCase().includes('item') ||
                            c.toLowerCase().includes('product') ||
                            c.toLowerCase().includes('card') ||
                            c.toLowerCase().includes('price') ||
                            c.toLowerCase().includes('name') ||
                            c.toLowerCase().includes('title')) {
                            classes.add(c);
                        }
                    });
                }
            });
            return Array.from(classes).slice(0, 40);
        }
    """)

    print("   Najdeni class-i:")
    for c in sorted(classes):
        print(f"   - {c}")

    print("\n[5] Iscem prvi izdelek...")
    first_product = page.evaluate("""
        () => {
            // Poišči elemente ki izgledajo kot izdelki
            const selectors = [
                '[class*="itemCardWrapper"]',
                '[class*="ItemCardWrapper"]',
                '[class*="productCard"]',
                '[class*="ProductCard"]',
                'a[href*="/artikel/"]',
                'a[href*="/izdelek/"]',
            ];

            for (let sel of selectors) {
                const els = document.querySelectorAll(sel);
                for (let el of els) {
                    const text = el.innerText || '';
                    // Mora imeti ceno
                    if (text.includes('€') && text.length > 5 && text.length < 500) {
                        return {
                            selector: sel,
                            tagName: el.tagName,
                            className: el.className,
                            text: text.substring(0, 300),
                            html: el.outerHTML.substring(0, 1500)
                        };
                    }
                }
            }
            return null;
        }
    """)

    if first_product:
        print(f"   Najden s: {first_product.get('selector')}")
        print(f"   Tag: {first_product.get('tagName')}")
        print(f"   Class: {first_product.get('className')[:100]}")
        print(f"\n   Tekst:\n   {first_product.get('text')[:200]}")
        print(f"\n   HTML (prvi 800 znakov):\n   {first_product.get('html')[:800]}")
    else:
        print("   NI NAJDENEGA IZDELKA!")

        # Poskusi najti karkoli s ceno
        print("\n[6] Iscem karkoli s ceno...")
        any_price = page.evaluate("""
            () => {
                const all = document.querySelectorAll('*');
                for (let el of all) {
                    const text = el.innerText || '';
                    if (text.includes('€') && text.length > 10 && text.length < 300) {
                        const parent = el.parentElement;
                        if (parent) {
                            return {
                                tag: el.tagName,
                                class: el.className,
                                text: text.substring(0, 200),
                                parentClass: parent.className
                            };
                        }
                    }
                }
                return null;
            }
        """)

        if any_price:
            print(f"   Najdeno: {any_price}")

    print("\n[7] Cakam 10s da vidis stran...")
    time.sleep(10)
    browser.close()

print("\nINSPEKCIJA KONCANA!")
