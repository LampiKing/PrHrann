"""
Test: Klikni Kategorije gumb na SPAR
"""
from playwright.sync_api import sync_playwright
import time

def test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            locale="sl-SI",
        )
        page = context.new_page()

        # 1. Odpri SPAR
        print("1. Odpiranje SPAR...")
        page.goto("https://www.spar.si/online", wait_until="networkidle", timeout=60000)
        time.sleep(2)

        # 2. Sprejmi piskotke
        print("2. Sprejemam piskotke...")
        try:
            page.click('text="Dovoli vse"', timeout=5000)
            print("   Piskotki sprejeti!")
            time.sleep(1)
        except:
            print("   Ni cookie popupa")

        # 3. Klikni KATEGORIJE gumb
        print("3. Klikam Kategorije gumb...")

        kategorije_selectors = [
            'button:has-text("Kategorije")',
            'a:has-text("Kategorije")',
            '[class*="category"] button',
            'text="Kategorije"',
            'button >> text=Kategorije',
        ]

        clicked = False
        for sel in kategorije_selectors:
            try:
                print(f"   Poskusam: {sel}")
                page.click(sel, timeout=3000)
                print(f"   KLIKNIL: {sel}")
                clicked = True
                break
            except Exception as e:
                print(f"   Ni uspelo: {e}")

        if not clicked:
            # Poskusi najti vse gumbe in izpisati
            print("\n   Ischem vse gumbe na strani...")
            buttons = page.query_selector_all('button')
            for i, btn in enumerate(buttons[:10]):
                try:
                    text = btn.inner_text()[:50]
                    print(f"   Gumb {i}: {text}")
                except:
                    pass

        time.sleep(2)

        # Screenshot
        page.screenshot(path="test_kategorije.png")
        print("\n4. Screenshot shranjen: test_kategorije.png")

        print("\nCakam 15s da vidis...")
        time.sleep(15)

        browser.close()

if __name__ == "__main__":
    test()
