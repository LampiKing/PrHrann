# -*- coding: utf-8 -*-
"""
Check Database - Preveri stanje baze
"""
import requests
import json

CONVEX_URL = "https://vibrant-dolphin-871.convex.cloud"

print("=" * 80)
print("PREVERJANJE STANJA BAZE")
print("=" * 80)

# Query za sample izdelek
print("\n1. Test: Poišči izdelek 'mleko'")
response = requests.post(
    f"{CONVEX_URL}/api/query",
    json={
        "path": "products:search",
        "args": {
            "query": "mleko",
            "isPremium": True
        },
        "format": "json"
    },
    headers={"Content-Type": "application/json"},
    timeout=10
)

if response.status_code == 200:
    result = response.json()
    products = result.get("value", [])
    print(f"Najdeno: {len(products)} izdelkov")

    if len(products) > 0:
        p = products[0]
        print(f"\nPrvi izdelek:")
        print(f"  Ime: {p.get('name')}")
        print(f"  Cene: {len(p.get('prices', []))} trgovin")

        if len(p.get('prices', [])) > 0:
            for price in p['prices']:
                print(f"    - {price['storeName']}: {price['price']} EUR")
        else:
            print("    NAPAKA: Ni cen!")

        print(f"\n  Podrobnosti celega objekta:")
        print(f"  {json.dumps(p, indent=2, ensure_ascii=False)}")
else:
    print(f"NAPAKA: {response.status_code}")

print("\n" + "=" * 80)
