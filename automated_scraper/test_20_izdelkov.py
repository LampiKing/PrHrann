# -*- coding: utf-8 -*-
"""
TEST 20 RAZLICNIH IZDELKOV - Performance test
"""
import requests
import time

CONVEX_URL = "https://vibrant-dolphin-871.convex.cloud"

# 20 razlicnih izdelkov za test
IZDELKI = [
    "mleko", "kruh", "cokolada", "sir", "jajca",
    "jogurt", "maslo", "kava", "caj", "pivo",
    "vino", "sok", "voda", "moka", "sladkor",
    "olje", "paradiznik", "krompir", "banana", "jabolko"
]

def test_search(query):
    """Testiraj iskanje"""
    try:
        start = time.time()

        response = requests.post(
            f"{CONVEX_URL}/api/query",
            json={
                "path": "products:search",
                "args": {"query": query, "isPremium": True},
                "format": "json"
            },
            headers={"Content-Type": "application/json"},
            timeout=10
        )

        elapsed = time.time() - start

        if response.status_code == 200:
            result = response.json()
            products = result.get("value", [])

            stores = set()
            prices = []

            for product in products:
                for price_info in product.get("prices", []):
                    stores.add(price_info.get("storeName"))
                    prices.append(price_info.get("price", 0))

            lowest = min(prices) if prices else 0
            highest = max(prices) if prices else 0

            return {
                "query": query,
                "found": len(products),
                "time": elapsed,
                "stores": len(stores),
                "store_names": sorted(stores),
                "lowest_price": lowest,
                "highest_price": highest,
                "price_diff": highest - lowest
            }
        else:
            return None

    except Exception as e:
        return None

print("=" * 80)
print("TEST 20 RAZLICNIH IZDELKOV")
print("=" * 80)

results = []
total_start = time.time()

for izdelek in IZDELKI:
    result = test_search(izdelek)
    if result:
        results.append(result)
        print(f"{izdelek:15} | {result['found']:3} izdelkov | {result['time']*1000:6.0f}ms | {result['stores']} trgovin | {result['lowest_price']:.2f}-{result['highest_price']:.2f} EUR")

total_elapsed = time.time() - total_start

print("\n" + "=" * 80)
print("STATISTIKA")
print("=" * 80)

avg_time = sum(r['time'] for r in results) / len(results) if results else 0
avg_found = sum(r['found'] for r in results) / len(results) if results else 0
min_time = min(r['time'] for r in results) if results else 0
max_time = max(r['time'] for r in results) if results else 0

print(f"Skupaj testov: {len(results)}/20")
print(f"Celoten cas: {total_elapsed:.1f}s")
print(f"Povprecen cas: {avg_time*1000:.0f}ms")
print(f"Min cas: {min_time*1000:.0f}ms")
print(f"Max cas: {max_time*1000:.0f}ms")
print(f"Povprecno najdeno: {avg_found:.1f} izdelkov")

print("\nTrgovine v rezultatih:")
all_stores = set()
for r in results:
    all_stores.update(r['store_names'])
print(f"  {', '.join(sorted(all_stores))}")

print("\nNajvecje cenovne razlike:")
sorted_by_diff = sorted(results, key=lambda x: x['price_diff'], reverse=True)
for r in sorted_by_diff[:5]:
    if r['price_diff'] > 0:
        print(f"  {r['query']:15} | {r['price_diff']:.2f} EUR razlike ({r['lowest_price']:.2f} - {r['highest_price']:.2f})")

print("=" * 80)
