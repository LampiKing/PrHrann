"""
Preprost test za SPAR z cookie sprejetjem
"""
from playwright.sync_api import sync_playwright
import time

def test_spar():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled"]
        )

        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="sl-SI",
        )

        page = context.new_page()

        print("Nalagam SPAR...")
        url = "https://www.spar.si/online/sadje-in-zelenjava/c/F01"

        try:
            page.goto(url, wait_until="networkidle", timeout=60000)
            print("Stran nalozena!")
        except Exception as e:
            print(f"Napaka: {e}")
            return

        # Pocakaj na cookie popup
        print("Cakam na cookie popup...")
        time.sleep(2)

        # Sprejmi piskotke
        print("Sprejemam piskotke...")
        try:
            # CookieBot selektor
            page.click('text="Dovoli vse"', timeout=5000)
            print("Piskotki sprejeti!")
        except Exception as e:
            print(f"Ni uspelo s text: {e}")
            try:
                page.click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', timeout=3000)
                print("Piskotki sprejeti (ID)!")
            except:
                print("Piskotki NE sprejeti")

        # Pocakaj
        time.sleep(2)

        # Screenshot po sprejetju piskotkov
        page.screenshot(path="test_spar_after_cookies.png")
        print("Screenshot shranjen: test_spar_after_cookies.png")

        # Iscemo izdelke
        print("\nIscemo izdelke...")
        product_selectors = [
            '[data-testid*="product"]',
            '[class*="product-tile"]',
            '[class*="ProductTile"]',
            '.tileOffer',
            'article[class*="product"]',
        ]

        for sel in product_selectors:
            try:
                products = page.query_selector_all(sel)
                if products:
                    print(f"Najdeno {len(products)} izdelkov s selektorjem: {sel}")
                    # Prikazi prvih 3 imena
                    for i, p in enumerate(products[:3]):
                        try:
                            name = p.query_selector('a[title]') or p.query_selector('h2') or p.query_selector('h3')
                            if name:
                                print(f"  {i+1}. {name.inner_text()[:50]}")
                        except:
                            pass
                    break
            except Exception as e:
                print(f"Napaka s {sel}: {e}")

        print("\nCakam 10s da vidis browser...")
        time.sleep(10)

        browser.close()
        print("Koncano!")

if __name__ == "__main__":
    test_spar()
