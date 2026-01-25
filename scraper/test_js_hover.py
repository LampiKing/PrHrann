"""
Test z JavaScript hover
"""
from playwright.sync_api import sync_playwright
import time

def test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        print("1. Odpiranje SPAR...")
        page.goto("https://www.spar.si/online", wait_until="networkidle")
        time.sleep(2)

        print("2. Piskotki...")
        try:
            page.click('text="Dovoli vse"', timeout=3000)
        except:
            pass
        time.sleep(1)

        print("3. Kategorije gumb...")
        page.click('button:has-text("Kategorije")')
        time.sleep(1.5)

        print("4. Hover z JS na SADJE IN ZELENJAVA...")
        # Uporabi JavaScript za hover
        page.evaluate('''
            const items = document.querySelectorAll('.ant-menu-submenu-title, .ant-menu-item');
            for (const item of items) {
                if (item.textContent.includes('SADJE IN ZELENJAVA')) {
                    const event = new MouseEvent('mouseenter', {bubbles: true});
                    item.dispatchEvent(event);
                    item.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
                    console.log('Hover na:', item.textContent);
                    break;
                }
            }
        ''')
        time.sleep(2)

        page.screenshot(path="test_js_hover.png")
        print("Screenshot: test_js_hover.png")

        # Iscemo "Poglejte vse izdelke"
        print("5. Iscem podmeni...")
        try:
            page.click('text="Poglejte vse izdelke"', timeout=3000)
            print("   Kliknil Poglejte vse izdelke!")
        except:
            print("   Ni najdeno, iscem druge moznosti...")
            # Poskusimo klikniti direktno na kategorijo
            try:
                page.click('text="SADJE IN ZELENJAVA"')
                print("   Kliknil direktno na kategorijo")
            except:
                pass

        time.sleep(3)
        page.screenshot(path="test_js_hover_result.png")

        print("\nCakam 10s...")
        time.sleep(10)
        browser.close()

if __name__ == "__main__":
    test()
