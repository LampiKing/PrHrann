"""
Test PrHran website functionality - with proper login
"""
import asyncio
from playwright.async_api import async_playwright

async def test_website():
    print("=" * 60)
    print("TESTIRANJE PRHRAN WEBSITE")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        # 1. Open website
        print("\n[1] Odpiranje localhost:8081...")
        await page.goto("http://localhost:8081", wait_until="networkidle", timeout=60000)
        await asyncio.sleep(3)

        # 2. Skip onboarding
        print("\n[2] Preskakujem onboarding...")
        try:
            await page.click('text="Preskoči"', timeout=5000)
            print("    Kliknil 'Preskoci'")
            await asyncio.sleep(2)
        except:
            print("    Onboarding preskocen ali ni najden")

        await page.screenshot(path="test_01_after_skip.png")

        # 3. Login
        print("\n[3] Prijava...")

        # Make sure Prijava tab is selected (not Registracija)
        try:
            # Find all elements with Prijava text and click the tab one
            tabs = await page.query_selector_all('[role="tab"], [data-state]')
            for tab in tabs:
                text = await tab.inner_text()
                if 'Prijava' in text:
                    await tab.click()
                    print("    Kliknil Prijava tab")
                    break
        except Exception as e:
            print(f"    Tab error: {e}")

        await asyncio.sleep(1)

        # Fill email
        print("    Vnaasam credentials...")
        email_input = await page.query_selector('input[type="email"]')
        if email_input:
            await email_input.fill("lamprett69@gmail.com")
            print("    Email vnesen")

        # Fill password
        password_input = await page.query_selector('input[type="password"]')
        if password_input:
            await password_input.fill("Knndlbxym41!")
            print("    Geslo vneseno")

        await page.screenshot(path="test_02_credentials.png")

        # Wait a moment for form validation
        await asyncio.sleep(1)

        # Find login submit button - it's a gradient button with "Prijava" text
        # The button is NOT the tab, it's the submit button at the bottom of the form
        print("    Iscem submit gumb...")

        # Method 1: Look for button-like element with gradient containing "Prijava"
        # The submit button should be after the password field and checkboxes
        login_clicked = False

        # Try clicking using different methods
        try:
            # Find all clickable elements with Prijava text
            elements = await page.query_selector_all('div, span, button')
            for el in elements:
                try:
                    text = await el.inner_text()
                    class_name = await el.get_attribute('class') or ""

                    # The submit button has a gradient and "Prijava" text
                    # It should be near the bottom of the form
                    if text.strip() == "Prijava" and ("gradient" in class_name.lower() or "button" in class_name.lower()):
                        bbox = await el.bounding_box()
                        if bbox and bbox['y'] > 400:  # Lower on the page = submit button
                            await el.click()
                            login_clicked = True
                            print(f"    Kliknil submit gumb (y={bbox['y']})")
                            break
                except:
                    continue
        except Exception as e:
            print(f"    Napaka pri iskanju gumba: {e}")

        if not login_clicked:
            # Method 2: Just press Enter after filling password
            print("    Poskusam Enter...")
            await password_input.press("Enter")
            login_clicked = True

        await asyncio.sleep(5)
        await page.screenshot(path="test_03_after_login.png")
        print("    Screenshot: test_03_after_login.png")

        # Check current URL
        current_url = page.url
        print(f"    URL: {current_url}")

        # 4. Check if logged in
        content = await page.content()

        if "Dobrodošli nazaj" in content and "Registracija" in content:
            print("\n    PROBLEM: Se vedno na login strani!")

            # Look for specific error messages
            if "napačn" in content.lower():
                print("    Napaka: Napačno geslo ali email")
            elif "ne obstaja" in content.lower():
                print("    Napaka: Račun ne obstaja")

            # Take debug screenshot
            await page.screenshot(path="test_debug_login_fail.png", full_page=True)
        else:
            print("    Uspesno prijavljen!")

            # 5. Now search for products
            print("\n[5] Iskanje izdelkov...")
            await asyncio.sleep(2)

            # Find search input
            search_selectors = [
                'input[placeholder*="Išči"]',
                'input[placeholder*="iskanje"]',
                'input[placeholder*="Kaj"]',
            ]

            search_input = None
            for selector in search_selectors:
                try:
                    el = await page.query_selector(selector)
                    if el and await el.is_visible():
                        search_input = el
                        print(f"    Najden search: {selector}")
                        break
                except:
                    continue

            if search_input:
                # Test 1: Search "mleko"
                print("\n[6] Test: iskanje 'mleko'...")
                await search_input.click()
                await search_input.fill("mleko")
                await page.keyboard.press("Enter")
                await asyncio.sleep(4)
                await page.screenshot(path="test_search_mleko.png")

                content = await page.content()
                mleko_count = content.lower().count("mleko")
                testo_count = content.lower().count("testo") + content.lower().count("listnato")
                print(f"    'mleko': {mleko_count}x, 'testo': {testo_count}x")

                if mleko_count > 5 and testo_count < 3:
                    print("    OK - Relevantni rezultati!")
                else:
                    print("    PREVERI screenshot!")

                # Test 2: Search "kruh"
                print("\n[7] Test: iskanje 'kruh'...")
                await search_input.fill("")
                await search_input.fill("kruh")
                await page.keyboard.press("Enter")
                await asyncio.sleep(4)
                await page.screenshot(path="test_search_kruh.png")

                # Test 3: Search "jajca"
                print("\n[8] Test: iskanje 'jajca'...")
                await search_input.fill("")
                await search_input.fill("jajca")
                await page.keyboard.press("Enter")
                await asyncio.sleep(4)
                await page.screenshot(path="test_search_jajca.png")

                print("\n    Vsi testi koncani!")
            else:
                print("    Search polje ni najdeno")
                await page.screenshot(path="test_no_search.png", full_page=True)

        print("\n" + "=" * 60)
        print("SCREENSHOTI V: scraper/test_*.png")
        print("=" * 60)

        await asyncio.sleep(3)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_website())
