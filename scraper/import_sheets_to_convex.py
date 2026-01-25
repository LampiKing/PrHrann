"""
Import izdelkov iz Google Sheets v Convex
=========================================
Prebere podatke iz obstoječih Google Sheets in jih uploada v Convex.
"""

import os
import sys
import json
import requests
from datetime import datetime
from pathlib import Path

# Dodaj parent dir
sys.path.insert(0, str(Path(__file__).parent))

from google_sheets import GoogleSheetsManager

def log(msg):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {msg}")


def read_sheet_products(gs, store: str) -> list:
    """Preberi izdelke iz Google Sheet."""
    log(f"Berem {store.upper()} sheet...")

    sheet = gs.open_sheet(store)
    if not sheet:
        log(f"  Napaka: ne morem odpreti {store}")
        return []

    ws = sheet.sheet1
    all_rows = ws.get_all_values()

    if len(all_rows) < 2:
        log(f"  Sheet je prazen")
        return []

    # Header je v prvi vrstici
    headers = all_rows[0]
    log(f"  Headers: {headers}")

    # Najdi indekse stolpcev
    col_map = {}
    for i, h in enumerate(headers):
        h_lower = h.lower().strip()
        if 'ime' in h_lower:
            col_map['ime'] = i
        elif 'cena' in h_lower and 'akcij' not in h_lower:
            col_map['cena'] = i
        elif 'akcij' in h_lower:
            col_map['akcijska'] = i
        elif 'slika' in h_lower:
            col_map['slika'] = i

    log(f"  Stolpci: {col_map}")

    products = []
    for row in all_rows[1:]:  # Preskoči header
        if len(row) < 2:
            continue

        ime = row[col_map.get('ime', 0)].strip() if col_map.get('ime') is not None else ""
        if not ime:
            continue

        # Cena - odstrani € in zamenjaj , z .
        cena_raw = row[col_map.get('cena', 1)] if col_map.get('cena') is not None and len(row) > col_map.get('cena', 1) else ""
        cena = None
        if cena_raw:
            try:
                cena = float(cena_raw.replace('€', '').replace(',', '.').strip())
            except:
                pass

        # Akcijska cena
        akcijska_raw = row[col_map.get('akcijska', 3)] if col_map.get('akcijska') is not None and len(row) > col_map.get('akcijska', 3) else ""
        akcijska = None
        if akcijska_raw:
            try:
                akcijska = float(akcijska_raw.replace('€', '').replace(',', '.').strip())
            except:
                pass

        # Slika
        slika = row[col_map.get('slika', 2)] if col_map.get('slika') is not None and len(row) > col_map.get('slika', 2) else ""

        # Sestavi produkt - IZPUSTI polja z null vrednostmi!
        product = {
            "ime": ime,
            "trgovina": store.capitalize(),
            "kategorija": "",
            "enota": "",
        }

        # Dodaj samo če ima vrednost
        if cena is not None:
            product["redna_cena"] = cena
        if akcijska is not None:
            product["akcijska_cena"] = akcijska
        if slika:
            product["slika"] = slika

        products.append(product)

    log(f"  Prebranih {len(products)} izdelkov")
    return products


def upload_to_convex(items: list, convex_url: str, token: str):
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
                    "clearFirst": (i == 0)  # Počisti samo pri prvem batchu
                },
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                timeout=60
            )

            if response.status_code == 200:
                total_uploaded += len(batch)
                log(f"  Batch {i//batch_size + 1}: {len(batch)} OK")
            else:
                log(f"  Batch {i//batch_size + 1}: NAPAKA {response.status_code} - {response.text[:200]}")

        except Exception as e:
            log(f"  Batch {i//batch_size + 1}: NAPAKA {e}")

    log(f"Uploaded: {total_uploaded}/{len(items)}")
    return total_uploaded


def main():
    print("=" * 60)
    print("IMPORT GOOGLE SHEETS -> CONVEX")
    print("=" * 60)

    # Convex konfiguracija - preberi iz .env.local
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
        log("Dodaj ju v .env.local")
        return

    log(f"Convex URL: {convex_url}")

    # Povežem z Google Sheets
    gs = GoogleSheetsManager()
    if not gs.connect():
        log("NAPAKA: Ne morem se povezati z Google Sheets")
        return

    # Preberi vse podatke
    all_products = []
    for store in ["spar", "mercator", "tus"]:
        products = read_sheet_products(gs, store)
        all_products.extend(products)

    log(f"Skupaj: {len(all_products)} izdelkov")

    # Upload v Convex
    upload_to_convex(all_products, convex_url, ingest_token)

    print("=" * 60)
    print("KONČANO!")
    print("=" * 60)


if __name__ == "__main__":
    main()
