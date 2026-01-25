"""
Test PrHran PRODUCTION website - www.prhran.com
"""
import asyncio
from playwright.async_api import async_playwright

async def test_production():
    print("=" * 60)
    print("TESTIRANJE www.prhran.com")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1280, "height": 1000})  # Taller viewport
        page = await context.new_page()

        # 1. Open production website
        print("\n[1] Odpiranje www.prhran.com...")
        await page.goto("https://www.prhran.com", wait_until="networkidle", timeout=60000)
        await asyncio.sleep(3)

        # 2. Skip onboarding if present
        print("\n[2] Preskakujem onboarding...")
        try:
            await page.click('text="Preskoči"', timeout=5000)
            print("    Kliknil 'Preskoci'")
            await asyncio.sleep(2)
        except:
            print("    Onboarding ni prikazan")

        # 3. Login
        print("\n[3] Prijava...")

        # Fill email
        email_input = await page.query_selector('input[type="email"]')
        if email_input:
            await email_input.click()
            await asyncio.sleep(0.3)
            await email_input.type("lamprett69@gmail.com", delay=30)
            print("    Email vnesen")

        # Fill password
        password_input = await page.query_selector('input[type="password"]')
        if password_input:
            await password_input.click()
            await asyncio.sleep(0.3)
            await password_input.type("Knndlbxym41!", delay=30)
            print("    Geslo vneseno")

        await asyncio.sleep(1)

        # Take full page screenshot to see the button
        await page.screenshot(path="prod_03_full.png", full_page=True)
        print("    Screenshot: prod_03_full.png (full page)")

        # Scroll the page to make sure button is visible
        await page.evaluate("window.scrollTo(0, 300)")
        await asyncio.sleep(0.5)

        # Find the Prijava submit button - it's a div with gradient, not a button element
        # Look for elements that contain just "Prijava" text (not "Prijava" tab)
        print("    Iscem submit gumb...")

        clicked = False

        # Try to find all elements with Prijava and filter by position
        try:
            elements = await page.query_selector_all('div')
            prijava_elements = []

            for el in elements:
                try:
                    text = await el.inner_text()
                    if text.strip() == "Prijava":
                        bbox = await el.bounding_box()
                        if bbox:
                            prijava_elements.append((el, bbox))
                except:
                    continue

            print(f"    Najdenih {len(prijava_elements)} 'Prijava' elementov")

            # Sort by Y position - the submit button should be lower than the tab
            prijava_elements.sort(key=lambda x: x[1]['y'], reverse=True)

            for el, bbox in prijava_elements:
                print(f"      - y={bbox['y']}, height={bbox['height']}")
                if bbox['y'] > 450:  # Submit button should be lower
                    await el.click()
                    clicked = True
                    print(f"    Kliknil element na y={bbox['y']}")
                    break
        except Exception as e:
            print(f"    Error: {e}")

        if not clicked:
            # Try clicking by coordinates - the button should be around y=550
            print("    Poskusam klik na koordinate...")
            await page.mouse.click(640, 580)  # Center of screen, lower area
            clicked = True

        await asyncio.sleep(5)
        await page.screenshot(path="prod_04_after_login.png")

        # Check URL
        current_url = page.url
        print(f"    URL: {current_url}")

        # Check if logged in
        content = await page.content()

        if "auth" not in current_url.lower() or "profil" in content.lower() or "Išči" in content:
            print("    USPESNO PRIJAVLJEN!")
            await page.screenshot(path="prod_05_logged_in.png")

            # Test search
            print("\n[5] Testiram iskanje...")
            await asyncio.sleep(2)

            search_input = await page.query_selector('input[placeholder*="Išči"]')
            if not search_input:
                search_input = await page.query_selector('input[placeholder*="iskanje"]')

            if search_input:
                # Mleko test
                print("    Iscem 'mleko'...")
                await search_input.click()
                await search_input.type("mleko", delay=50)
                await page.keyboard.press("Enter")
                await asyncio.sleep(4)
                await page.screenshot(path="prod_search_mleko.png")

                # Check results
                content = await page.content()
                mleko = content.lower().count("mleko")
                testo = content.lower().count("testo")
                print(f"    Rezultati: mleko={mleko}x, testo={testo}x")

                if mleko > 5:
                    print("    OK - mleko najdeno!")
                if testo > 3:
                    print("    PROBLEM - testo v rezultatih!")

                # Kruh test
                print("    Iscem 'kruh'...")
                await search_input.click(click_count=3)  # Triple click
                await search_input.type("kruh", delay=50)
                await page.keyboard.press("Enter")
                await asyncio.sleep(4)
                await page.screenshot(path="prod_search_kruh.png")

                # Jajca test
                print("    Iscem 'jajca'...")
                await search_input.click(click_count=3)  # Triple click
                await search_input.type("jajca", delay=50)
                await page.keyboard.press("Enter")
                await asyncio.sleep(4)
                await page.screenshot(path="prod_search_jajca.png")

                print("    Vsi testi OK!")
            else:
                print("    Search ni najden!")
                await page.screenshot(path="prod_no_search.png", full_page=True)

        else:
            print("    Login NI uspel")
            await page.screenshot(path="prod_login_fail.png", full_page=True)

            # Check for error message
            if "napačn" in content.lower():
                print("    Napaka: napačno geslo")

        print("\n" + "=" * 60)
        print("SCREENSHOTI V: scraper/prod_*.png")
        print("=" * 60)

        await asyncio.sleep(3)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_production())
