#!/usr/bin/env python3
"""Upload scraped products to PRODUCTION Convex"""

import json
import requests
from pathlib import Path

def main():
    # Find the latest products file
    temp_dir = Path('temp_output/scraped-products-21468722720')

    if not temp_dir.exists():
        print(f"Directory not found: {temp_dir}")
        return

    json_file = temp_dir / 'all_products_latest.json'
    if not json_file.exists():
        print(f"File not found: {json_file}")
        return

    # Load products
    with open(json_file, 'r', encoding='utf-8') as f:
        products = json.load(f)

    print(f'Loaded {len(products)} products')

    # Count per store
    stores = {}
    for p in products:
        store = p.get('trgovina', 'Unknown')
        stores[store] = stores.get(store, 0) + 1

    for store, count in stores.items():
        print(f'  {store}: {count}')

    # Clean products (remove null values - Convex doesn't accept null)
    # Handle both old format (ime, trgovina) and new format (productName, storeName)
    def clean_product(p):
        # Get name - try both formats
        name = p.get('ime') or p.get('productName') or ''
        store = p.get('trgovina') or p.get('storeName') or ''

        if not name or not store:
            return None

        item = {'ime': name, 'trgovina': store}

        # Regular price - try both formats
        redna = p.get('redna_cena') or p.get('originalPrice') or p.get('price')
        if redna is not None:
            item['redna_cena'] = redna

        # Sale price - try both formats
        akcijska = p.get('akcijska_cena') or p.get('salePrice')
        if akcijska is not None and akcijska != redna:
            item['akcijska_cena'] = akcijska

        # Image - try both formats
        slika = p.get('slika') or p.get('imageUrl')
        if slika:
            item['slika'] = slika

        # Category
        if p.get('kategorija'):
            item['kategorija'] = p['kategorija']

        # Unit
        if p.get('enota'):
            item['enota'] = p['enota']

        return item

    cleaned = [cp for p in products if (cp := clean_product(p)) is not None]
    print(f'Cleaned: {len(cleaned)} products')

    # Upload to PRODUCTION
    url = 'https://vibrant-dolphin-871.convex.site/api/ingest/grocery'
    token = 'prhran_4cca9698a89301cb31a410bb3f7068a2'

    batch_size = 200
    uploaded = 0
    errors = 0

    print('\nUploading to PRODUCTION...')
    for i in range(0, len(cleaned), batch_size):
        batch = cleaned[i:i+batch_size]
        try:
            resp = requests.post(url, json={'items': batch},
                headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
                timeout=180)
            if resp.status_code == 200:
                result = resp.json()
                uploaded += len(batch)
                created = result.get('createdProducts', 0)
                updated = result.get('updatedProducts', 0)
                print(f'  Batch {i//batch_size + 1}: +{created} new, {updated} updated')
            else:
                print(f'  Batch {i//batch_size + 1}: ERROR {resp.status_code} - {resp.text[:200]}')
                errors += 1
        except Exception as e:
            print(f'  Batch {i//batch_size + 1}: ERROR {e}')
            errors += 1

    print(f'\nDone! Uploaded {uploaded}/{len(cleaned)} products, {errors} errors')

if __name__ == '__main__':
    main()
