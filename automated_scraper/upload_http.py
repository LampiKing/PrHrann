# -*- coding: utf-8 -*-
"""
HTTP Upload - Naloži izdelke direktno preko Convex HTTP API
"""
import csv
import json
import requests
import time

CONVEX_URL = "https://vibrant-dolphin-871.convex.cloud"
BATCH_SIZE = 100

def parse_price(price_str):
    if not price_str or price_str == "":
        return None
    try:
        clean = str(price_str).replace("EUR", "").replace(",", ".").strip()
        return float(clean)
    except:
        return None

def normalize_store(store):
    store = str(store).strip().lower()
    if "mercator" in store:
        return "Mercator"
    elif "spar" in store:
        return "Spar"
    elif "tus" in store:
        return "Tus"
    else:
        return store.title()

def upload_batch(products_batch, batch_num):
    """Upload batch preko HTTP API"""
    try:
        response = requests.post(
            f"{CONVEX_URL}/api/mutation",
            json={
                "path": "products:bulkUpsert",
                "args": {
                    "products": products_batch
                },
                "format": "json"
            },
            headers={"Content-Type": "application/json"},
            timeout=60
        )

        if response.status_code == 200:
            result = response.json()
            return True, result.get("value", {})
        else:
            return False, f"HTTP {response.status_code}: {response.text[:100]}"
    except Exception as e:
        return False, str(e)

print("=" * 80)
print("BULK UPLOAD - Nalaganje izdelkov preko HTTP")
print("=" * 80)
print(f"Convex URL: {CONVEX_URL}")
print("")

# Najdi CSV
import os
csv_files = [f for f in os.listdir('.') if f.endswith('.csv')]
if not csv_files:
    print("Ni CSV datotek!")
    exit(1)

csv_file = csv_files[0]
print(f"Datoteka: {csv_file}")

# Preberi CSV
products = []
total_rows = 0
skipped = 0

print("\nBranje CSV...")
with open(csv_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        total_rows += 1
        name = row.get('name', '').strip()
        price = parse_price(row.get('price', ''))
        sale_price = parse_price(row.get('sale_price', ''))
        store = normalize_store(row.get('store', ''))

        if not name or price is None:
            skipped += 1
            continue

        if sale_price is None:
            sale_price = price

        products.append({
            "productName": name,
            "price": price,
            "salePrice": sale_price,
            "storeName": store,
            "lastUpdated": "2026-01-04T21:30:00Z"
        })

        if total_rows % 5000 == 0:
            print(f"  Prebrano {total_rows} vrstic...")

print(f"\nSkupaj vrstic: {total_rows}")
print(f"Veljavnih izdelkov: {len(products)}")
print(f"Preskoceno: {skipped}")

if not products:
    print("Ni izdelkov!")
    exit(1)

# Upload v batch-ih
print(f"\nUpload v batch-ih ({BATCH_SIZE} izdelkov)...")
total_batches = (len(products) + BATCH_SIZE - 1) // BATCH_SIZE
total_inserted = 0
total_updated = 0
total_failed = 0

start_time = time.time()

for i in range(0, len(products), BATCH_SIZE):
    batch = products[i:i+BATCH_SIZE]
    batch_num = (i // BATCH_SIZE) + 1

    print(f"Batch {batch_num}/{total_batches} ({len(batch)} izdelkov)...", end=" ", flush=True)

    success, result = upload_batch(batch, batch_num)

    if success and isinstance(result, dict):
        inserted = result.get('inserted', 0)
        updated = result.get('updated', 0)
        failed = result.get('skipped', 0)
        total_inserted += inserted
        total_updated += updated
        total_failed += failed
        print(f"OK (ins:{inserted} upd:{updated} skip:{failed})")
    elif success:
        print("OK")
    else:
        total_failed += len(batch)
        print(f"FAIL: {result}")

    # Kratka pavza da ne overloadamo server
    if batch_num % 10 == 0:
        time.sleep(0.5)

elapsed = time.time() - start_time

print("\n" + "=" * 80)
print("REZULTAT")
print("=" * 80)
print(f"Novo vstavljeno: {total_inserted}")
print(f"Posodobljeno: {total_updated}")
print(f"Preskoceno/Neuspesno: {total_failed}")
print(f"Skupaj obdelano: {total_inserted + total_updated + total_failed}")
print(f"Cas: {elapsed:.1f}s")
print(f"Hitrost: {(total_inserted + total_updated) / elapsed:.1f} izdelkov/s")
print("=" * 80)
