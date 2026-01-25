"""Test fixes for sol, banana, alpsko mleko"""
import asyncio
from playwright.async_api import async_playwright

async def main():
    print("Testing fixes...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={"width": 1400, "height": 1000})

        # Go to site
        print("Opening site...")
        await page.goto("https://www.prhran.com", wait_until="networkidle", timeout=60000)
        await asyncio.sleep(3)

        # Skip onboarding
        try:
            await page.click('text="Preskoči"', timeout=5000)
            print("Skipped onboarding")
        except:
            pass
        await asyncio.sleep(3)

        # Wait for login page to fully load
        await page.wait_for_selector('input[type="email"]', timeout=10000)
        print("Login page loaded")

        # Login
        print("Entering credentials...")
        email = await page.query_selector('input[type="email"]')
        if email:
            await email.click()
            await asyncio.sleep(0.5)
            await page.keyboard.type("lamprett69@gmail.com", delay=40)
            print("  Email entered")
        else:
            print("  Email input not found!")

        await asyncio.sleep(0.5)

        pwd = await page.query_selector('input[type="password"]')
        if pwd:
            await pwd.click()
            await asyncio.sleep(0.5)
            await page.keyboard.type("Knndlbxym41!", delay=40)
            print("  Password entered")
        else:
            print("  Password input not found!")

        await asyncio.sleep(1)
        await page.screenshot(path="FIX_credentials_entered.png")

        # Click login button - find all divs with "Prijava" and click the lower one
        print("Clicking login button...")
        divs = await page.query_selector_all('div')
        prijava_buttons = []
        for div in divs:
            try:
                text = await div.inner_text()
                if text.strip() == "Prijava":
                    bbox = await div.bounding_box()
                    if bbox:
                        prijava_buttons.append((div, bbox["y"]))
            except:
                continue

        prijava_buttons.sort(key=lambda x: x[1], reverse=True)
        clicked = False
        for div, y in prijava_buttons:
            if y > 400:
                await div.click()
                print(f"  Clicked button at y={y}")
                clicked = True
                break

        if not clicked:
            print("  Button not found, pressing Enter...")
            await page.keyboard.press("Enter")

        await asyncio.sleep(5)

        # Check if logged in
        url = page.url
        print(f"URL: {url}")

        if "auth" in url:
            print("Login failed!")
            await page.screenshot(path="FIX_login_fail.png")
            await browser.close()
            return

        print("Logged in!")

        # Wait for main page to load
        await asyncio.sleep(3)
        await page.screenshot(path="FIX_main_page.png")

        # Find search - try multiple selectors
        search = None
        for sel in ['input[placeholder*="Išči"]', 'input[placeholder*="iskanje"]', 'input[type="text"]']:
            try:
                search = await page.query_selector(sel)
                if search:
                    visible = await search.is_visible()
                    if visible:
                        print(f"Found search: {sel}")
                        break
                    search = None
            except:
                continue

        if search:
            tests = ["sol", "banana", "alpsko mleko"]

            for query in tests:
                print(f"\nTesting: {query}")

                await search.click()
                await asyncio.sleep(0.3)
                await page.keyboard.press("Control+a")
                await page.keyboard.press("Backspace")
                await asyncio.sleep(0.3)
                await page.keyboard.type(query, delay=50)
                await page.keyboard.press("Enter")

                await asyncio.sleep(4)

                filename = f"FIX_{query.replace(' ', '_')}.png"
                await page.screenshot(path=filename)
                print(f"  Screenshot: {filename}")
        else:
            print("Search not found!")

        await asyncio.sleep(3)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
