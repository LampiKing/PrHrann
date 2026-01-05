#!/usr/bin/env python3
"""
Bulk Upload Script - Naloi vse izdelke iz CSV direktno v Convex preko CLI
Author: Claude
Date: 2026-01-05
"""

import csv
import json
import subprocess
import os
from datetime import datetime

BATCH_SIZE = 50  # Manji batch za CLI

def parse_price(price_str):
    """Parse ceno iz stringa"""
    if not price_str or price_str == "":
        return None
    try:
        # Odstrani  in whitespace, zamenjaj vejico z piko
        clean = str(price_str).replace("", "").replace(",", ".").strip()
        return float(clean)
    except:
        return None

def normalize_store_name(store):
    """Normaliziraj ime trgovine"""
    store = str(store).strip().lower()
    if "mercator" in store:
        return "Mercator"
    elif "spar" in store:
        return "Spar"
    elif "tu" in store or "tus" in store:
        return "Tu"
    else:
        return store.title()

def upload_batch(products_batch, batch_num):
    """Upload batch izdelkov v Convex preko CLI"""
    try:
        # Ustvari JSON args
        args_json = json.dumps({"products": products_batch})

        # Poenemo npx convex run products:bulkUpsert
        result = subprocess.run(
            ["npx", "convex", "run", "products:bulkUpsert", args_json],
            cwd="..",  # Go to project root
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode == 0:
            # Parse result
            try:
                output = result.stdout.strip()
                # Najdi JSON del
                if "{" in output:
                    json_start = output.index("{")
                    json_str = output[json_start:]
                    response = json.loads(json_str)
                    return True, response
                else:
                    return True, {"message": "Success but no JSON response"}
            except:
                return True, {"message": output}
        else:
            return False, f"Error: {result.stderr}"

    except subprocess.TimeoutExpired:
        return False, "Timeout (60s)"
    except Exception as e:
        return False, str(e)

def main():
    print("=" * 80)
    print("€ BULK UPLOAD - Nalaganje vseh izdelkov v Convex")
    print("=" * 80)

    # Poii CSV datoteko
    csv_files = [f for f in os.listdir('.') if f.endswith('.csv')]

    if not csv_files:
        print(" Ni CSV datotek v trenutnem direktoriju!")
        return

    csv_file = csv_files[0]
    print(f"„ Najdena datoteka: {csv_file}")

    # Preberi CSV
    products = []
    total_rows = 0
    skipped_rows = 0

    print(f"\n– Branje CSV datoteke...")

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            total_rows += 1

            # Parse podatke
            product_name = row.get('name', row.get('product_name', '')).strip()
            price = parse_price(row.get('price', ''))
            sale_price = parse_price(row.get('sale_price', ''))
            store = normalize_store_name(row.get('store', ''))

            # Skip e ni imena ali cene
            if not product_name or price is None:
                skipped_rows += 1
                continue

            # e ni sale_price, uporabi price
            if sale_price is None:
                sale_price = price

            products.append({
                "productName": product_name,
                "price": price,
                "salePrice": sale_price,
                "storeName": store,
                "lastUpdated": datetime.now().isoformat()
            })

            # Progress
            if total_rows % 1000 == 0:
                print(f"   Prebrano {total_rows} vrstic...")

    print(f"\n Prebrano skupaj: {total_rows} vrstic")
    print(f" Veljavnih izdelkov: {len(products)}")
    print(f"  Preskoeno: {skipped_rows} vrstic")

    if not products:
        print(" Ni veljavnih izdelkov za upload!")
        return

    # Upload v batch-ih
    print(f"\n¤ Zaetek uploada v Convex...")
    print(f"¦ Batch velikost: {BATCH_SIZE} izdelkov")

    total_batches = (len(products) + BATCH_SIZE - 1) // BATCH_SIZE
    total_uploaded = 0
    total_updated = 0
    total_failed = 0

    for i in range(0, len(products), BATCH_SIZE):
        batch = products[i:i+BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1

        print(f"\n¦ Batch {batch_num}/{total_batches} ({len(batch)} izdelkov)...", end=" ", flush=True)

        success, result = upload_batch(batch, batch_num)

        if success:
            if isinstance(result, dict):
                inserted = result.get('inserted', 0)
                updated = result.get('updated', 0)
                skipped = result.get('skipped', 0)
                total_uploaded += inserted
                total_updated += updated
                total_failed += skipped
                print(f" OK (inserted: {inserted}, updated: {updated}, skipped: {skipped})")
            else:
                print(f" OK")
        else:
            total_failed += len(batch)
            print(f" FAIL: {result}")

    # Summary
    print("\n" + "=" * 80)
    print("Š KONNI REZULTAT")
    print("=" * 80)
    print(f" Novo vstavljeno: {total_uploaded} izdelkov")
    print(f"„ Posodobljeno: {total_updated} izdelkov")
    print(f" Preskoeno/Neuspeno: {total_failed} izdelkov")
    print(f"Š Skupaj obdelano: {total_uploaded + total_updated + total_failed}")
    print("=" * 80)

if __name__ == "__main__":
    main()
