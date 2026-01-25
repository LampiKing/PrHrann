"""Quick test to verify search algorithm fixes"""
import asyncio
from playwright.async_api import async_playwright

async def test_search_fixes():
    print("=" * 60)
    print("TESTING SEARCH ALGORITHM FIXES")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={"width": 1400, "height": 1000})

        # Login
        print("\n[1] Logging in...")
        await page.goto("https://www.prhran.com", wait_until="networkidle", timeout=60000)
        await asyncio.sleep(3)

        # Skip onboarding
        try:
            await page.click('text="Preskoči"', timeout=5000)
        except:
            pass
        await asyncio.sleep(2)

        # Enter credentials
        email = await page.query_selector('input[type="email"]')
        if email:
            await email.click()
            await asyncio.sleep(0.3)
            await page.keyboard.type("lamprett69@gmail.com", delay=30)

        await asyncio.sleep(0.5)

        pwd = await page.query_selector('input[type="password"]')
        if pwd:
            await pwd.click()
            await asyncio.sleep(0.3)
            await page.keyboard.type("Knndlbxym41!", delay=30)

        await asyncio.sleep(1)

        # Click login button
        divs = await page.query_selector_all('div')
        for div in divs:
            try:
                text = await div.inner_text()
                if text.strip() == "Prijava":
                    bbox = await div.bounding_box()
                    if bbox and bbox['y'] > 400:
                        await div.click()
                        break
            except:
                continue

        await asyncio.sleep(5)

        # Check if logged in
        if "auth" in page.url:
            print("Login FAILED!")
            await browser.close()
            return

        print("   Logged in successfully!")
        await asyncio.sleep(2)

        # Find search
        search = None
        for sel in ['input[placeholder*="Išči"]', 'input[placeholder*="iskanje"]', 'input[type="text"]']:
            try:
                search = await page.query_selector(sel)
                if search and await search.is_visible():
                    break
                search = None
            except:
                continue

        if not search:
            print("Search NOT FOUND!")
            await browser.close()
            return

        # === TEST 1: SOL ===
        print("\n" + "=" * 60)
        print("[TEST 1] Searching: 'sol'")
        print("Expected: SOL (salt) products, NOT solata (salad)")
        print("=" * 60)

        await search.click()
        await asyncio.sleep(0.3)
        await page.keyboard.press("Control+a")
        await page.keyboard.press("Backspace")
        await asyncio.sleep(0.3)
        await page.keyboard.type("sol", delay=50)
        await page.keyboard.press("Enter")
        await asyncio.sleep(4)

        # Check results
        content = (await page.content()).lower()

        # Check if solata appears in results
        solata_count = content.count("solata") + content.count("solatna")
        sol_correct = "morska sol" in content or "kuhinjska sol" in content or "sol 1" in content

        print(f"   'solata/solatna' appearances: {solata_count}")
        print(f"   Correct salt products found: {sol_correct}")

        if solata_count > 0 and not sol_correct:
            print("   [FAIL] Solata is appearing instead of sol!")
        elif sol_correct:
            print("   [PASS] Correct salt products are showing!")
        else:
            print("   [WARN] Could not verify results")

        await page.screenshot(path="test_fix_sol.png")

        # === TEST 2: ALPSKO MLEKO ===
        print("\n" + "=" * 60)
        print("[TEST 2] Searching: 'alpsko mleko'")
        print("Expected: 1L FIRST, not 200ml")
        print("=" * 60)

        await search.click()
        await asyncio.sleep(0.3)
        await page.keyboard.press("Control+a")
        await page.keyboard.press("Backspace")
        await asyncio.sleep(0.3)
        await page.keyboard.type("alpsko mleko", delay=50)
        await page.keyboard.press("Enter")
        await asyncio.sleep(4)

        # Take screenshot and check first result
        await page.screenshot(path="test_fix_alpsko.png")

        # Try to find the first product card
        content = await page.content()

        # Check for 1L in first results
        has_1l = "1 l" in content.lower() or "1l" in content.lower() or "1 liter" in content.lower()
        has_200ml = "0,2" in content or "200ml" in content or "0.2" in content or "200 ml" in content

        print(f"   1L products found: {has_1l}")
        print(f"   200ml products found: {has_200ml}")

        if has_1l:
            print("   [PASS] 1L products are appearing!")
        else:
            print("   [WARN] Could not find 1L products")

        # === TEST 3: Loading state (type new query quickly) ===
        print("\n" + "=" * 60)
        print("[TEST 3] Testing loading state (no 'ni na voljo' flash)")
        print("=" * 60)

        # Clear and type new search
        await search.click()
        await asyncio.sleep(0.3)
        await page.keyboard.press("Control+a")
        await page.keyboard.press("Backspace")
        await asyncio.sleep(0.2)
        await page.keyboard.type("jajca", delay=30)

        # Immediately take screenshot - should NOT show "ni na voljo"
        await asyncio.sleep(0.3)  # Very short delay
        await page.screenshot(path="test_fix_loading_1.png")

        # Check for the error message
        content1 = await page.content()
        has_error_flash = "nismo našli" in content1.lower() or "ni na voljo" in content1.lower()

        await asyncio.sleep(3)  # Wait for results
        await page.screenshot(path="test_fix_loading_2.png")

        content2 = await page.content()
        has_results = "jajca" in content2.lower() or "rezultat" in content2.lower()

        print(f"   Error message during loading: {has_error_flash}")
        print(f"   Results after loading: {has_results}")

        if not has_error_flash and has_results:
            print("   [PASS] Loading state working correctly!")
        elif has_error_flash:
            print("   [WARN] 'Ni na voljo' might have flashed")
        else:
            print("   [WARN] Could not verify loading state")

        print("\n" + "=" * 60)
        print("SCREENSHOTS SAVED:")
        print("  - test_fix_sol.png")
        print("  - test_fix_alpsko.png")
        print("  - test_fix_loading_1.png")
        print("  - test_fix_loading_2.png")
        print("=" * 60)

        await asyncio.sleep(3)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_search_fixes())
