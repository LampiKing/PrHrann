"""
HITER TEST GOOGLE SHEETS UPLOAD
===============================
Testira upload v Google Sheets z obstoječimi podatki.
"""

import json
from datetime import datetime
from pathlib import Path
from google_sheets import GoogleSheetsManager

def load_sample_products(store: str, count: int = 10):
    """Naloži vzorčne izdelke iz progress datotek"""
    progress_dir = Path(__file__).parent / "progress"

    # Najdi najnovejšo datoteko za trgovino
    files = list(progress_dir.glob(f"{store.lower()}_*.json"))
    if not files:
        print(f"[!] Ni progress datotek za {store}")
        return []

    # Sortiraj po datumu (najnovejša prva)
    files.sort(reverse=True)
    latest = files[0]

    print(f"[{store}] Berem iz: {latest.name}")

    with open(latest, 'r', encoding='utf-8') as f:
        data = json.load(f)

    products = data.get('products', [])[:count]
    print(f"[{store}] Naloženih {len(products)} izdelkov")

    return products


def test_upload():
    """Testiraj upload v Google Sheets"""
    print("=" * 70)
    print("HITER TEST - GOOGLE SHEETS UPLOAD")
    print(f"Čas: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # Povežemo se z Google Sheets
    try:
        gs = GoogleSheetsManager()
        if not gs.connect():
            print("[X] Povezava ni uspela!")
            return False
    except Exception as e:
        print(f"[X] Napaka: {e}")
        return False

    # Test za vsako trgovino
    for store in ["spar", "mercator", "tus"]:
        print(f"\n{'='*50}")
        print(f"TEST: {store.upper()}")
        print("=" * 50)

        # Naloži vzorčne podatke
        products = load_sample_products(store, count=5)

        if not products:
            print(f"[!] Preskakujem {store} - ni podatkov")
            continue

        # Prikaži vzorec
        print(f"\nVzorec izdelkov za upload:")
        for i, p in enumerate(products[:3], 1):
            ime = p.get('ime', 'N/A')[:40]
            cena = p.get('redna_cena', 0)
            akcijska = p.get('akcijska_cena', '')
            slika = p.get('slika', '')[:50] if p.get('slika') else 'NI SLIKE!'

            print(f"\n  {i}. {ime}...")
            print(f"     Cena: {cena}€")
            print(f"     Akcijska: {akcijska if akcijska else '-'}")
            print(f"     Slika: {slika}...")

        # Test upload (samo za preverjanje - ne bo počistil obstoječih podatkov)
        try:
            sheet = gs.open_sheet(store)
            if sheet:
                ws = sheet.sheet1

                # Preberi trenutno stanje
                all_values = ws.get_all_values()
                print(f"\n  Trenutno vrstic v sheetu: {len(all_values)}")

                # Preveri header
                if all_values:
                    headers = all_values[0]
                    print(f"  Header: {headers}")

                # Preveri ali ima slika stolpec podatke
                if len(all_values) > 1:
                    sample_row = all_values[1]
                    slika_idx = 2  # Tretji stolpec (0-indexed)
                    if len(sample_row) > slika_idx:
                        slika_val = sample_row[slika_idx]
                        if slika_val:
                            print(f"  ✅ SLIKA stolpec ima podatke: {slika_val[:60]}...")
                        else:
                            print(f"  ⚠️ SLIKA stolpec je PRAZEN!")

                print(f"\n[OK] {store.upper()} sheet je dostopen")

        except Exception as e:
            print(f"[X] Napaka: {e}")

    print("\n" + "=" * 70)
    print("TEST KONČAN")
    print("=" * 70)

    return True


if __name__ == "__main__":
    test_upload()
