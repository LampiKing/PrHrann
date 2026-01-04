#!/usr/bin/env python3
"""
Bulk Upload Script - Naloži vse izdelke iz CSV direktno v Convex
Author: Claude
Date: 2026-01-05
"""

import csv
import requests
import os
from datetime import datetime

# Convex deployment URL
CONVEX_URL = os.getenv("CONVEX_DEPLOYMENT_URL", "https://fair-mole-058.convex.cloud")
BATCH_SIZE = 100  # Upload v batch-ih po 100 izdelkov

def parse_price(price_str):
    """Parse ceno iz stringa"""
    if not price_str or price_str == "":
        return None
    try:
        # Odstrani € in whitespace, zamenjaj vejico z piko
        clean = price_str.replace("€", "").replace(",", ".").strip()
        return float(clean)
    except:
        return None

def normalize_store_name(store):
    """Normaliziraj ime trgovine"""
    store = store.strip().lower()
    if "mercator" in store:
        return "Mercator"
    elif "spar" in store:
        return "Spar"
    elif "tuš" in store or "tus" in store:
        return "Tuš"
    else:
        return store.title()

def upload_batch(products_batch):
    """Upload batch izdelkov v Convex"""
    try:
        response = requests.post(
            f"{CONVEX_URL}/api/mutation",
            json={
                "path": "products:bulkUpsert",
                "args": {
                    "products": products_batch
                }
            },
            headers={"Content-Type": "application/json"}
        )

        if response.status_code == 200:
            return True, None
        else:
            return False, f"HTTP {response.status_code}: {response.text}"
    except Exception as e:
        return False, str(e)

def main():
    print("=" * 80)
    print("🚀 BULK UPLOAD - Nalaganje vseh izdelkov v Convex")
    print("=" * 80)

    # Poišči CSV datoteko
    csv_files = [f for f in os.listdir('.') if f.endswith('.csv')]

    if not csv_files:
        print("❌ Ni CSV datotek v trenutnem direktoriju!")
        return

    csv_file = csv_files[0]
    print(f"📄 Najdena datoteka: {csv_file}")

    # Preberi CSV
    products = []
    total_rows = 0
    skipped_rows = 0

    print(f"\n📖 Branje CSV datoteke...")

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            total_rows += 1

            # Parse podatke
            product_name = row.get('product_name', '').strip()
            price = parse_price(row.get('price', ''))
            sale_price = parse_price(row.get('sale_price', ''))
            store = normalize_store_name(row.get('store', ''))

            # Skip če ni imena ali cene
            if not product_name or price is None:
                skipped_rows += 1
                continue

            # Če ni sale_price, uporabi price
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
                print(f"  ✓ Prebrano {total_rows} vrstic...")

    print(f"\n✅ Prebrano skupaj: {total_rows} vrstic")
    print(f"✅ Veljavnih izdelkov: {len(products)}")
    print(f"⚠️  Preskočeno: {skipped_rows} vrstic")

    if not products:
        print("❌ Ni veljavnih izdelkov za upload!")
        return

    # Upload v batch-ih
    print(f"\n📤 Začetek uploada v Convex...")
    print(f"📦 Batch velikost: {BATCH_SIZE} izdelkov")

    total_batches = (len(products) + BATCH_SIZE - 1) // BATCH_SIZE
    uploaded = 0
    failed = 0

    for i in range(0, len(products), BATCH_SIZE):
        batch = products[i:i+BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1

        print(f"\n📦 Batch {batch_num}/{total_batches} ({len(batch)} izdelkov)...", end=" ")

        success, error = upload_batch(batch)

        if success:
            uploaded += len(batch)
            print(f"✅ OK")
        else:
            failed += len(batch)
            print(f"❌ FAIL")
            print(f"   Napaka: {error}")

    # Summary
    print("\n" + "=" * 80)
    print("📊 KONČNI REZULTAT")
    print("=" * 80)
    print(f"✅ Uspešno naloženo: {uploaded} izdelkov")
    print(f"❌ Neuspešno: {failed} izdelkov")
    print(f"📈 Uspešnost: {(uploaded/len(products)*100):.1f}%")
    print("=" * 80)

if __name__ == "__main__":
    main()
