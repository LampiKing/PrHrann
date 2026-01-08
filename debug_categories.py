import asyncio
from grocery_scanner import SparScanner, MercatorScanner, HitriNakupScanner
from playwright.async_api import async_playwright

async def run_debug():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        
        print("\n--- SPAR ---")
        try:
            s = SparScanner()
            products = await s.scan(context)
            print(f"Found {len(products)} products")
            for p in products[:3]:
                print(f" - {p['ime']}: {p['redna_cena']}€")
        except Exception as e:
            print(f"Spar Error: {e}")
            
        print("\n--- MERCATOR ---")
        try:
            m = MercatorScanner()
            products = await m.scan(context)
            print(f"Found {len(products)} products")
            for p in products[:3]:
                print(f" - {p['ime']}: {p['redna_cena']}€")
        except Exception as e:
            print(f"Mercator Error: {e}")
            
        print("\n--- HITRI NAKUP ---")
        try:
            h = HitriNakupScanner()
            products = await h.scan(context)
            print(f"Found {len(products)} products")
            for p in products[:3]:
                print(f" - {p['ime']}: {p['redna_cena']}€")
        except Exception as e:
            print(f"Hitri Error: {e}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_debug())
