import asyncio
from playwright.async_api import async_playwright

async def dump_html():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print("Loading Spar...")
        try:
            await page.goto("https://online.spar.si/sadje-in-zelenjava", timeout=60000)
            await page.wait_for_timeout(5000) # Wait for hydration
            
            # Print title
            print(f"Title: {await page.title()}")
            
            # Dump first 5000 chars of body
            content = await page.content()
            
            # Try to find any class looking like a product
            print("\nSearching for product-like classes...")
            # Simple heuristic check
            if "product-item" in content: print("Found .product-item")
            if "product-card" in content: print("Found .product-card")
            
            # Save to file
            with open("spar_dump.html", "w", encoding="utf-8") as f:
                f.write(content)
            print("Saved spar_dump.html")
            
        except Exception as e:
            print(f"Error: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(dump_html())
