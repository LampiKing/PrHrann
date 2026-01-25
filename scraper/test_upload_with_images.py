"""
TEST UPLOAD S SLIKAMI
=====================
Uploada 10 testnih izdelkov s slikami da preverimo če deluje.
"""

import json
from datetime import datetime
from pathlib import Path
from google_sheets import GoogleSheetsManager

def test_upload():
    print("=" * 70)
    print("TEST UPLOAD S SLIKAMI")
    print("=" * 70)

    # Naloži SPAR podatke iz progress
    progress_file = Path(__file__).parent / "progress" / "spar_20260123_104312.json"

    with open(progress_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    products = data.get('products', [])[:10]
    print(f"Naloženih {len(products)} izdelkov iz progress datoteke")

    # Prikaži izdelke
    print("\nIzdelki za upload:")
    for i, p in enumerate(products[:5], 1):
        print(f"\n  {i}. {p.get('ime', 'N/A')[:50]}")
        print(f"     Cena: {p.get('redna_cena', 0)}")
        print(f"     Akcijska: {p.get('akcijska_cena', '-')}")
        print(f"     SLIKA: {p.get('slika', 'NI!')[:60]}...")

    # Povežemo
    gs = GoogleSheetsManager()
    if not gs.connect():
        return

    # Upload v SPAR sheet
    print("\n" + "=" * 50)
    print("UPLOADING V SPAR SHEET...")
    print("=" * 50)

    sheet = gs.open_sheet("spar")
    if not sheet:
        return

    ws = sheet.sheet1

    # Najdi zadnjo vrstico
    all_values = ws.get_all_values()
    next_row = len(all_values) + 1

    # Pripravi testne podatke
    timestamp = datetime.now().strftime("%d. %m. %Y %H:%M")
    rows = []

    for p in products:
        cena = p.get("redna_cena", "")
        if cena:
            cena = f"{cena:.2f}€".replace(".", ",")

        akcijska = p.get("akcijska_cena", "")
        if akcijska:
            akcijska = f"{akcijska:.2f}€".replace(".", ",")

        slika = p.get("slika", "") or ""

        rows.append([
            f"[TEST SLIKA] {p.get('ime', '')}",  # IME IZDELKA
            cena,                                 # CENA
            slika,                                # SLIKA <-- TO MORA DELATI!
            akcijska,                             # AKCIJSKA CENA
            "Test",                               # NA VOLJO
            timestamp                             # POSODOBLJENO
        ])

    # Upload
    ws.update(f"A{next_row}", rows)
    print(f"\n[OK] Dodanih {len(rows)} vrstic na pozicijo {next_row}")

    # Preveri upload
    print("\nPREVERJAM UPLOAD...")
    uploaded = ws.get_all_values()[next_row-1:next_row+5]

    for i, row in enumerate(uploaded[:3]):
        print(f"\n  Vrstica {next_row + i}:")
        print(f"    IME: {row[0][:50]}...")
        print(f"    CENA: {row[1]}")
        print(f"    SLIKA: {row[2][:60] if row[2] else 'PRAZNO!'}")
        print(f"    AKCIJSKA: {row[3]}")

    print("\n" + "=" * 70)
    print("TEST KONČAN - Preveri Google Sheet!")
    print("=" * 70)


if __name__ == "__main__":
    test_upload()
