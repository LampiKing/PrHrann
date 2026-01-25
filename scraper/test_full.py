"""
Polni test www.prhran.com - 15 različnih iskanj
"""
import asyncio
from playwright.async_api import async_playwright

TEST_SEARCHES = [
    "mleko",
    "kruh",
    "jajca",
    "sir",
    "maslo",
    "jogurt",
    "banana",
    "jabolko",
    "piščanec",
    "riž",
    "testenine",
    "čokolada",
    "kava",
    "pivo",
    "voda"
]

async def test_full():
    print("=" * 60)
    print("POLNI TEST www.prhran.com")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1280, "height": 1000})
        page = await context.new_page()

        # 1. Login
        print("\n[1] Prijava...")
        await page.goto("https://www.prhran.com", wait_until="networkidle", timeout=60000)
        await asyncio.sleep(4)

        # Skip onboarding
        try:
            await page.click('text="Preskoči"', timeout=5000)
            print("    Onboarding preskocen")
            await asyncio.sleep(2)
        except:
            print("    Onboarding ni bil prikazan")

        # Fill email
        print("    Vpisovujem email...")
        email_input = await page.query_selector('input[type="email"]')
        if email_input:
            await email_input.click()
            await asyncio.sleep(0.5)
            await page.keyboard.type("lamprett69@gmail.com", delay=30)
            print("    Email vnesen")
        else:
            print("    Email input ni najden!")

        await asyncio.sleep(0.5)

        # Fill password
        print("    Vpisovujem geslo...")
        password_input = await page.query_selector('input[type="password"]')
        if password_input:
            await password_input.click()
            await asyncio.sleep(0.5)
            await page.keyboard.type("Knndlbxym41!", delay=30)
            print("    Geslo vneseno")
        else:
            print("    Password input ni najden!")

        await asyncio.sleep(1)
        await page.screenshot(path="test_01_credentials.png")

        # Find and click login button
        print("    Klikam Prijava gumb...")

        # Scroll down
        await page.evaluate("window.scrollBy(0, 200)")
        await asyncio.sleep(1)

        # Find the submit button
        clicked = False
        elements = await page.query_selector_all('div')
        prijava_buttons = []

        for el in elements:
            try:
                text = await el.inner_text()
                if text.strip() == "Prijava":
                    bbox = await el.bounding_box()
                    if bbox:
                        prijava_buttons.append((el, bbox['y']))
            except:
                continue

        print(f"    Najdenih {len(prijava_buttons)} Prijava elementov")

        # Sort by Y - get the lowest one (submit button)
        prijava_buttons.sort(key=lambda x: x[1], reverse=True)

        for el, y in prijava_buttons:
            if y > 400:
                await el.click()
                clicked = True
                print(f"    Kliknil na y={y}")
                break

        if not clicked:
            print("    Prijava gumb ni najden, pritiskam Enter...")
            await page.keyboard.press("Enter")

        # Wait for login to complete
        print("    Cakam na prijavo...")
        await asyncio.sleep(6)

        # Check if logged in
        current_url = page.url
        print(f"    URL: {current_url}")

        await page.screenshot(path="test_02_after_login.png")

        if "auth" in current_url:
            print("    LOGIN NI USPEL!")
            await page.screenshot(path="test_login_failed.png", full_page=True)
            await browser.close()
            return

        print("    Prijavljen!")

        # Wait for main page to fully load
        await asyncio.sleep(3)
        await page.screenshot(path="test_03_main_page.png")

        # 2. Find search
        print("\n[2] Iscem search...")

        search_input = None

        # Try different selectors
        selectors = [
            'input[placeholder*="Išči"]',
            'input[placeholder*="iskanje"]',
            'input[placeholder*="Kaj"]',
            'input[type="text"]',
        ]

        for sel in selectors:
            try:
                inp = await page.query_selector(sel)
                if inp:
                    is_visible = await inp.is_visible()
                    if is_visible:
                        search_input = inp
                        print(f"    Najden: {sel}")
                        break
            except:
                continue

        if not search_input:
            # List all inputs
            all_inputs = await page.query_selector_all('input')
            print(f"    Najdenih {len(all_inputs)} input polj:")
            for inp in all_inputs:
                ph = await inp.get_attribute('placeholder') or ""
                t = await inp.get_attribute('type') or ""
                print(f"      - type={t}, placeholder={ph}")

            if all_inputs:
                search_input = all_inputs[0]

        if not search_input:
            print("    NAPAKA: Search ni najden!")
            await page.screenshot(path="test_full_no_search.png", full_page=True)
            await browser.close()
            return

        # 3. Test searches
        print("\n[3] Testiram 15 iskanj...\n")

        results_summary = []

        for i, query in enumerate(TEST_SEARCHES, 1):
            print(f"[{i}/15] Iskanje '{query}'...")

            # Clear and type
            await search_input.click()
            await asyncio.sleep(0.3)

            # Select all and delete
            await page.keyboard.press("Control+a")
            await page.keyboard.press("Backspace")
            await asyncio.sleep(0.3)

            # Type query
            await page.keyboard.type(query, delay=50)
            await page.keyboard.press("Enter")

            # Wait for results
            await asyncio.sleep(4)

            # Screenshot
            filename = f"test_search_{i:02d}_{query}.png"
            await page.screenshot(path=filename)

            # Analyze results
            content = await page.content()

            # Count query matches
            query_count = content.lower().count(query.lower())

            # Check for images (count img tags with src)
            images = await page.query_selector_all('img')
            img_count = 0
            for img in images:
                src = await img.get_attribute('src') or ""
                if src and ("http" in src or "data:" in src):
                    img_count += 1

            # Check for "ni rezultatov"
            no_results = "ni rezultatov" in content.lower() or "nismo našli" in content.lower()

            # Check for prices
            price_count = content.count("EUR") + content.count("€")

            # Summary
            status = "OK" if query_count > 3 and not no_results else "PROBLEM"
            img_status = "DA" if img_count > 5 else "NE"

            result = {
                "query": query,
                "matches": query_count,
                "images": img_count,
                "prices": price_count,
                "no_results": no_results,
                "status": status,
                "img_status": img_status
            }
            results_summary.append(result)

            status_icon = "[OK]" if status == "OK" else "[X]"
            img_icon = "[IMG]" if img_status == "DA" else "[NO IMG]"

            print(f"    {status_icon} '{query}': {query_count}x najdeno, {img_count} slik {img_icon}, {price_count} cen")

            if no_results:
                print(f"       OPOZORILO: 'Ni rezultatov' prikazano!")

        # 4. Summary
        print("\n" + "=" * 60)
        print("POVZETEK TESTOV")
        print("=" * 60)

        problems = [r for r in results_summary if r["status"] == "PROBLEM"]
        no_images = [r for r in results_summary if r["img_status"] == "NE"]

        print(f"\nTesti s PROBLEMI ({len(problems)}/15):")
        if problems:
            for r in problems:
                print(f"  - {r['query']}: samo {r['matches']}x najdeno")
        else:
            print("  Vsi OK!")

        print(f"\nBrez SLIK ({len(no_images)}/15):")
        if no_images:
            for r in no_images:
                print(f"  - {r['query']}: {r['images']} slik")
        else:
            print("  Vsi imajo slike!")

        if len(problems) == 0 and len(no_images) == 0:
            print("\n*** VSE DELUJE PRAVILNO! ***")
        else:
            print(f"\n*** POPRAVITI: {len(problems)} iskanj + {len(no_images)} brez slik ***")

        print("\n" + "=" * 60)
        print("SCREENSHOTI: test_search_*.png")
        print("=" * 60)

        await asyncio.sleep(2)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_full())
