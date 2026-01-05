# -*- coding: utf-8 -*-
"""
Test Search - Testiraj iskanje izdelkov
"""
import requests
import json
import time

CONVEX_URL = "https://vibrant-dolphin-871.convex.cloud"

def test_search(query):
    """Testiraj iskanje za določen query"""
    print(f"\nIskanje: '{query}'")

    start = time.time()

    try:
        response = requests.post(
            f"{CONVEX_URL}/api/query",
            json={
                "path": "products:search",
                "args": {
                    "query": query,
                    "isPremium": True
                },
                "format": "json"
            },
            headers={"Content-Type": "application/json"},
            timeout=10
        )

        elapsed = time.time() - start

        if response.status_code == 200:
            result = response.json()
            products = result.get("value", [])

            print(f"OK - Najdeno {len(products)} izdelkov v {elapsed:.2f}s")

            # Prikazi prvih 5 rezultatov
            stores_found = set()
            for i, product in enumerate(products[:5]):
                name = product.get("name", "?")
                prices = product.get("prices", [])

                print(f"  {i+1}. {name}")

                if len(prices) > 0:
                    for price_info in prices:
                        store = price_info.get("storeName", "?")
                        price = price_info.get("price", 0)
                        stores_found.add(store)
                        print(f"      - {store}: {price:.2f} EUR")
                else:
                    print(f"      - Ni cen!")

            print(f"\nTrgovine: {', '.join(sorted(stores_found))}")
            return True
        else:
            print(f"NAPAKA: HTTP {response.status_code}")
            print(f"   {response.text[:200]}")
            return False

    except Exception as e:
        print(f"NAPAKA: {e}")
        return False

print("=" * 80)
print("TEST ISKANJA - 3 Razlicni Izdelki")
print("=" * 80)

# Test 1: Mleko
test_search("mleko")

# Test 2: Kruh
test_search("kruh")

# Test 3: Cokolada
test_search("cokolada")

print("\n" + "=" * 80)
print("TEST ZAKLJUCEN")
print("=" * 80)
