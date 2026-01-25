"""
Direkten import iz progress/*.json v Convex
===========================================
Preskoči Google Sheets in uploada direktno iz lokalnih progress datotek.
"""

import os
import sys
import json
import requests
from datetime import datetime
from pathlib import Path

def log(msg):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {msg}")


def find_latest_progress_files(progress_dir: Path) -> dict:
    """Najdi najnovejše progress datoteke za vsako trgovino."""
    latest = {}

    for file in progress_dir.glob("*.json"):
        parts = file.stem.split("_")
        if len(parts) < 2:
            continue

        store = parts[0].lower()
        if store not in ["spar", "mercator", "tus"]:
            continue

        # Preveri če je novejša
        if store not in latest or file.stat().st_mtime > latest[store].stat().st_mtime:
            latest[store] = file

    return latest


def read_progress_file(file_path: Path) -> list:
    """Preberi izdelke iz progress datoteke."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Lahko ima products ali samo seznam
        if isinstance(data, dict):
            products = data.get("products", [])
        else:
            products = data

        return products
    except Exception as e:
        log(f"  Napaka pri branju {file_path}: {e}")
        return []


def upload_to_convex(items: list, convex_url: str, token: str) -> int:
    """Upload izdelkov v Convex."""
    log(f"Uploading {len(items)} izdelkov v Convex...")

    # Pošlji v batchih
    batch_size = 500
    total_uploaded = 0

    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]

        try:
            response = requests.post(
                f"{convex_url}/api/ingest/grocery",
                json={
                    "items": batch,
                    "clearFirst": False  # NE briši obstoječih!
                },
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                timeout=120
            )

            if response.status_code == 200:
                result = response.json()
                total_uploaded += len(batch)
                log(f"  Batch {i//batch_size + 1}: {len(batch)} OK - {result.get('createdProducts', 0)} ustvarjenih, {result.get('updatedProducts', 0)} posodobljenih")
            else:
                log(f"  Batch {i//batch_size + 1}: NAPAKA {response.status_code} - {response.text[:200]}")

        except Exception as e:
            log(f"  Batch {i//batch_size + 1}: NAPAKA {e}")

    return total_uploaded


def main():
    print("=" * 60)
    print("DIREKTEN IMPORT: progress/*.json -> Convex")
    print("=" * 60)

    # Convex konfiguracija
    env_path = Path(__file__).parent.parent / ".env.local"
    convex_url = os.getenv("CONVEX_URL", "")
    ingest_token = os.getenv("PRHRAN_INGEST_TOKEN", "")

    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith("EXPO_PUBLIC_CONVEX_SITE_URL="):
                    convex_url = convex_url or line.split("=", 1)[1].strip()
                elif line.startswith("PRHRAN_INGEST_TOKEN="):
                    ingest_token = ingest_token or line.split("=", 1)[1].strip()

    if not ingest_token or not convex_url:
        log("NAPAKA: PRHRAN_INGEST_TOKEN ali CONVEX_URL ni nastavljen!")
        return

    log(f"Convex URL: {convex_url}")

    # Najdi progress datoteke
    progress_dir = Path(__file__).parent / "progress"
    latest_files = find_latest_progress_files(progress_dir)

    if not latest_files:
        log("NAPAKA: Ni progress datotek!")
        return

    log(f"Najdene datoteke:")
    for store, file in latest_files.items():
        log(f"  {store}: {file.name}")

    # Preberi vse
    all_products = []
    images_count = 0

    for store, file in latest_files.items():
        log(f"\nBerem {store.upper()}...")
        products = read_progress_file(file)

        # Preštej slike
        for p in products:
            if p.get("slika"):
                images_count += 1

        log(f"  {len(products)} izdelkov, {sum(1 for p in products if p.get('slika'))} s slikami")
        all_products.extend(products)

    log(f"\n{'='*40}")
    log(f"SKUPAJ: {len(all_products)} izdelkov")
    log(f"SLIKE: {images_count}")
    log(f"{'='*40}")

    if images_count == 0:
        log("OPOZORILO: Ni slik v progress datotekah!")
        # Nadaljuj vseeno

    # Upload
    uploaded = upload_to_convex(all_products, convex_url, ingest_token)

    print("\n" + "=" * 60)
    print(f"KONČANO! Uploadanih: {uploaded}/{len(all_products)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
