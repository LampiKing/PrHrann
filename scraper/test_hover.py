"""
Test: HOVER na kategorijo, cakaj podmeni, klikni "Prikazi vse izdelke"
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
        page.click('button:has-text("Kategorije")', timeout=5000)
        time.sleep(1.5)

        # 4. HOVER na kategorijo "SADJE IN ZELENJAVA"
        print("4. HOVER na SADJE IN ZELENJAVA...")

        # Poisci element
        category_el = page.query_selector('text="SADJE IN ZELENJAVA"')
        if category_el:
            category_el.hover()
            print("   Hover uspesen!")
            time.sleep(2)  # Cakaj da se podmeni odpre

            # Screenshot podmeni
            page.screenshot(path="test_hover_submenu.png")
            print("   Screenshot: test_hover_submenu.png")

            # 5. Klikni "Poglejte vse izdelke" ali podobno
            print("5. Iscem 'Poglejte vse izdelke'...")

            view_all_selectors = [
                'text="Poglejte vse izdelke"',
                'text="Poglej vse izdelke"',
                'text="Prikaži vse"',
                'text="Vsi izdelki"',
                'a:has-text("Poglejte vse")',
                'a:has-text("vse izdelke")',
            ]

            clicked = False
            for sel in view_all_selectors:
                try:
                    page.click(sel, timeout=2000)
                    print(f"   Kliknil: {sel}")
                    clicked = True
                    break
                except:
                    pass

            if not clicked:
                # Izpisi vse linke v podmeniju
                print("   Ischem vse linke...")
                links = page.query_selector_all('a')
                for link in links[:20]:
                    try:
                        text = link.inner_text()
                        if "vse" in text.lower() or "izdelk" in text.lower():
                            print(f"   Link: {text}")
                    except:
                        pass
        else:
            print("   Ne najdem kategorije!")

        time.sleep(3)

        # Screenshot
        page.screenshot(path="test_hover_result.png")
        print("\n6. Screenshot: test_hover_result.png")

        print("\nCakam 15s...")
        time.sleep(15)

        browser.close()

if __name__ == "__main__":
    test()
