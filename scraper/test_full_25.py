"""
POPOLN TEST - 25 domacih iskanj + blagovne znamke
==================================================
"""
import asyncio
from playwright.async_api import async_playwright
from datetime import datetime

# 25 DOMACIH ISKANJ
DOMACA_ISKANJA = [
    "jajca",
    "kruh",
    "mleko",
    "sir",
    "jogurt",
    "maslo",
    "moka",
    "sladkor",
    "sol",
    "olje",
    "riž",
    "testenine",
    "krompir",
    "čebula",
    "paradižnik",
    "banana",
    "jabolko",
    "piščanec",
    "salama",
    "šunka",
    "kava",
    "čaj",
    "sok",
    "voda",
    "pivo",
]

# SPECIFICNE BLAGOVNE ZNAMKE
BLAGOVNE_ZNAMKE = [
    "jaffa",
    "milka",
    "alpsko mleko",
    "kviki",
    "edamec",
    "nutella",
    "barilla",
    "coca cola",
    "union",
    "argeta",
    "ego jogurt",
    "activia",
    "pampers",
    "nivea",
    "ariel",
]

async def test_all():
    print("=" * 70)
    print("POPOLN TEST PRHRAN.COM")
    print(f"Cas: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1400, "height": 1000})
        page = await context.new_page()

        # === LOGIN ===
        print("\n[LOGIN]")
        await page.goto("https://www.prhran.com", wait_until="networkidle", timeout=60000)
        await asyncio.sleep(3)

        # Skip onboarding - try multiple selectors
        try:
            await page.click('text="Preskoči"', timeout=5000)
            print("  Onboarding preskocen (Preskoči)")
        except:
            try:
                await page.click('text="Preskoci"', timeout=3000)
                print("  Onboarding preskocen (Preskoci)")
            except:
                try:
                    # Click by position - top right corner
                    await page.click('button:has-text("Presko")', timeout=3000)
                    print("  Onboarding preskocen (button)")
                except:
                    print("  Onboarding skip ni uspel")
        await asyncio.sleep(2)

        # Wait for login page to load
        await asyncio.sleep(2)
        await page.screenshot(path="test25_debug_login_page.png")

        # Fill credentials
        print("  Vpisovanje credentials...")
        email = await page.query_selector('input[type="email"]')
        if email:
            await email.click()
            await asyncio.sleep(0.3)
            await page.keyboard.type("lamprett69@gmail.com", delay=30)
            print("    Email vnesen")
        else:
            print("    Email input NI NAJDEN!")

        await asyncio.sleep(0.5)

        pwd = await page.query_selector('input[type="password"]')
        if pwd:
            await pwd.click()
            await asyncio.sleep(0.3)
            await page.keyboard.type("Knndlbxym41!", delay=30)
            print("    Geslo vneseno")
        else:
            print("    Password input NI NAJDEN!")

        await asyncio.sleep(1)
        await page.screenshot(path="test25_debug_credentials.png")

        # Click login button - find the submit button
        print("  Klikam login gumb...")
        divs = await page.query_selector_all('div')
        prijava_buttons = []
        for div in divs:
            try:
                text = await div.inner_text()
                if text.strip() == "Prijava":
                    bbox = await div.bounding_box()
                    if bbox:
                        prijava_buttons.append((div, bbox['y']))
            except:
                continue

        # Sort by Y and click the lowest one (submit button)
        prijava_buttons.sort(key=lambda x: x[1], reverse=True)
        for div, y in prijava_buttons:
            if y > 400:
                await div.click()
                print(f"    Kliknil gumb na y={y}")
                break

        await asyncio.sleep(6)

        # Check if logged in
        url = page.url
        print(f"  URL: {url}")
        await page.screenshot(path="test25_debug_after_login.png")

        if "auth" in url:
            print("  NAPAKA: Login ni uspel!")
            await browser.close()
            return

        print("  Prijavljen!")

        # Find search - wait for page to load
        await asyncio.sleep(2)

        search = None
        selectors = [
            'input[placeholder*="Išči"]',
            'input[placeholder*="Isci"]',
            'input[placeholder*="iskanje"]',
            'input[placeholder*="Kaj"]',
            'input[type="text"]',
        ]

        for sel in selectors:
            try:
                search = await page.query_selector(sel)
                if search:
                    is_visible = await search.is_visible()
                    if is_visible:
                        print(f"  Search najden: {sel}")
                        break
                    else:
                        search = None
            except:
                continue

        if not search:
            inputs = await page.query_selector_all('input')
            print(f"  Najdenih {len(inputs)} input polj")
            for inp in inputs:
                ph = await inp.get_attribute('placeholder') or ""
                if ph:
                    print(f"    - placeholder: {ph}")
            if inputs:
                search = inputs[0]

        if not search:
            print("  NAPAKA: Search ni najden!")
            await browser.close()
            return

        # === TESTIRANJE ===
        all_results = []

        # Test domaca iskanja
        print("\n" + "=" * 70)
        print("DOMACA ISKANJA (25)")
        print("=" * 70)

        for i, query in enumerate(DOMACA_ISKANJA, 1):
            result = await test_search(page, search, query, i, "domace")
            all_results.append(result)
            print_result(result, i, len(DOMACA_ISKANJA))

        # Test blagovne znamke
        print("\n" + "=" * 70)
        print("BLAGOVNE ZNAMKE (15)")
        print("=" * 70)

        for i, query in enumerate(BLAGOVNE_ZNAMKE, 1):
            result = await test_search(page, search, query, i, "znamka")
            all_results.append(result)
            print_result(result, i, len(BLAGOVNE_ZNAMKE))

        # === POVZETEK ===
        print("\n" + "=" * 70)
        print("POVZETEK TESTOV")
        print("=" * 70)

        ok_count = sum(1 for r in all_results if r["status"] == "OK")
        problem_count = sum(1 for r in all_results if r["status"] == "PROBLEM")
        no_results_count = sum(1 for r in all_results if r["no_results"])
        no_images_count = sum(1 for r in all_results if r["images"] == 0)

        print(f"\nSkupaj testov: {len(all_results)}")
        print(f"  [OK]      {ok_count}")
        print(f"  [PROBLEM] {problem_count}")
        print(f"  [NI REZ.] {no_results_count}")
        print(f"  [NI SLIK] {no_images_count}")

        if problem_count > 0:
            print("\nPROBLEMI:")
            for r in all_results:
                if r["status"] == "PROBLEM":
                    print(f"  - '{r['query']}': {r['reason']}")

        if no_results_count > 0:
            print("\nBREZ REZULTATOV:")
            for r in all_results:
                if r["no_results"]:
                    print(f"  - '{r['query']}'")

        # ANALIZA PRVEGA REZULTATA
        print("\n" + "=" * 70)
        print("ANALIZA PRVEGA REZULTATA ZA VSAKO ISKANJE")
        print("=" * 70)

        for r in all_results:
            status_icon = "[OK]" if r["relevant"] else "[!!]"
            print(f"{status_icon} '{r['query']}' -> '{r['first_result'][:50]}...' " if len(r['first_result']) > 50 else f"{status_icon} '{r['query']}' -> '{r['first_result']}'")

        print("\n" + "=" * 70)
        print("SCREENSHOTI: scraper/test25_*.png")
        print("=" * 70)

        await asyncio.sleep(2)
        await browser.close()


async def test_search(page, search_input, query, num, category):
    """Test eno iskanje in vrni rezultat."""
    result = {
        "query": query,
        "category": category,
        "matches": 0,
        "images": 0,
        "prices": 0,
        "no_results": False,
        "first_result": "",
        "relevant": False,
        "status": "OK",
        "reason": ""
    }

    try:
        # Clear and search
        await search_input.click()
        await asyncio.sleep(0.2)
        await page.keyboard.press("Control+a")
        await page.keyboard.press("Backspace")
        await asyncio.sleep(0.2)
        await page.keyboard.type(query, delay=40)
        await page.keyboard.press("Enter")

        # Wait for results
        await asyncio.sleep(3)

        # Screenshot
        filename = f"test25_{category}_{num:02d}_{query.replace(' ', '_')}.png"
        await page.screenshot(path=filename)

        # Analyze
        content = await page.content()
        content_lower = content.lower()

        # Count matches
        query_words = query.lower().split()
        for word in query_words:
            result["matches"] += content_lower.count(word)

        # Check for no results
        if "ni rezultatov" in content_lower or "nismo nasli" in content_lower or "ni najdenih" in content_lower:
            result["no_results"] = True

        # Count images
        images = await page.query_selector_all('img')
        for img in images:
            src = await img.get_attribute('src') or ""
            if src and ("http" in src or "data:" in src):
                result["images"] += 1

        # Count prices
        result["prices"] = content.count("EUR") + content.count(" E ")

        # Get first result text
        try:
            # Look for product cards
            cards = await page.query_selector_all('[class*="product"], [class*="item"], [class*="card"]')
            if cards and len(cards) > 0:
                first_text = await cards[0].inner_text()
                result["first_result"] = first_text.split('\n')[0].strip()[:80]
        except:
            pass

        if not result["first_result"]:
            # Fallback - get text after "rezultatov"
            try:
                idx = content_lower.find("rezultatov")
                if idx > 0:
                    snippet = content[idx:idx+500]
                    lines = [l.strip() for l in snippet.split('\n') if len(l.strip()) > 10]
                    if lines:
                        result["first_result"] = lines[0][:80]
            except:
                result["first_result"] = "(ni podatka)"

        # Check relevance
        first_lower = result["first_result"].lower()
        query_lower = query.lower()

        # Simple relevance check - does first result contain any query word?
        relevant = False
        for word in query_words:
            if len(word) >= 3 and word in first_lower:
                relevant = True
                break

        # Special checks for brands
        brand_mappings = {
            "jaffa": ["jaffa"],
            "milka": ["milka"],
            "alpsko": ["alpsko", "alpsk"],
            "kviki": ["kviki"],
            "edamec": ["edamec", "edamer"],
            "nutella": ["nutella"],
            "barilla": ["barilla"],
            "coca cola": ["coca", "cola"],
            "union": ["union"],
            "argeta": ["argeta"],
            "ego": ["ego"],
            "activia": ["activia"],
            "pampers": ["pampers"],
            "nivea": ["nivea"],
            "ariel": ["ariel"],
        }

        for brand, keywords in brand_mappings.items():
            if brand in query_lower:
                for kw in keywords:
                    if kw in first_lower:
                        relevant = True
                        break

        result["relevant"] = relevant

        # Determine status
        if result["no_results"]:
            result["status"] = "PROBLEM"
            result["reason"] = "Ni rezultatov"
        elif result["matches"] < 2:
            result["status"] = "PROBLEM"
            result["reason"] = f"Premalo zadetkov ({result['matches']})"
        elif not result["relevant"] and result["first_result"]:
            result["status"] = "PROBLEM"
            result["reason"] = f"Nerelevanten prvi rezultat: {result['first_result'][:30]}"
        else:
            result["status"] = "OK"

    except Exception as e:
        result["status"] = "PROBLEM"
        result["reason"] = str(e)[:50]

    return result


def print_result(result, num, total):
    """Print result line."""
    status = "[OK]" if result["status"] == "OK" else "[X] "
    img_status = f"{result['images']} slik" if result['images'] > 0 else "NI SLIK"

    line = f"  {num:2d}/{total} {status} '{result['query']:<15}' -> {result['matches']:3d}x, {img_status}"

    if result["status"] != "OK":
        line += f" | {result['reason']}"

    print(line)


if __name__ == "__main__":
    asyncio.run(test_all())
