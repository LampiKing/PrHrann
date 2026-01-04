# -*- coding: utf-8 -*-
import csv
import json
import subprocess
import os

BATCH_SIZE = 50

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

def upload_batch(products_batch):
    args_json = json.dumps({"products": products_batch})
    result = subprocess.run(
        ["npx", "convex", "run", "products:bulkUpsert", args_json],
        cwd="..",
        capture_output=True,
        text=True,
        timeout=60
    )
    if result.returncode == 0:
        try:
            output = result.stdout.strip()
            if "{" in output:
                json_start = output.index("{")
                json_str = output[json_start:]
                return True, json.loads(json_str)
            return True, {"message": "OK"}
        except:
            return True, {"message": "OK"}
    else:
        return False, result.stderr

print("=" * 80)
print("BULK UPLOAD - Nalaganje izdelkov")
print("=" * 80)

csv_files = [f for f in os.listdir('.') if f.endswith('.csv')]
if not csv_files:
    print("Ni CSV datotek!")
    exit(1)

csv_file = csv_files[0]
print(f"Datoteka: {csv_file}")

products = []
total_rows = 0
skipped = 0

print("Branje CSV...")
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
            "lastUpdated": "2026-01-04"
        })

        if total_rows % 1000 == 0:
            print(f"  Prebrano {total_rows} vrstic...")

print(f"\nSkupaj vrstic: {total_rows}")
print(f"Veljavnih izdelkov: {len(products)}")
print(f"Preskoceno: {skipped}")

if not products:
    print("Ni izdelkov!")
    exit(1)

print(f"\nUpload v batch-ih ({BATCH_SIZE} izdelkov)...")
total_batches = (len(products) + BATCH_SIZE - 1) // BATCH_SIZE
total_inserted = 0
total_updated = 0
total_failed = 0

for i in range(0, len(products), BATCH_SIZE):
    batch = products[i:i+BATCH_SIZE]
    batch_num = (i // BATCH_SIZE) + 1

    print(f"\nBatch {batch_num}/{total_batches} ({len(batch)} izdelkov)...", end=" ")

    success, result = upload_batch(batch)

    if success and isinstance(result, dict):
        inserted = result.get('inserted', 0)
        updated = result.get('updated', 0)
        failed = result.get('skipped', 0)
        total_inserted += inserted
        total_updated += updated
        total_failed += failed
        print(f"OK (ins: {inserted}, upd: {updated}, skip: {failed})")
    elif success:
        print("OK")
    else:
        total_failed += len(batch)
        print(f"FAIL: {result}")

print("\n" + "=" * 80)
print("REZULTAT")
print("=" * 80)
print(f"Novo vstavljeno: {total_inserted}")
print(f"Posodobljeno: {total_updated}")
print(f"Preskoceno: {total_failed}")
print(f"Skupaj: {total_inserted + total_updated + total_failed}")
print("=" * 80)
