"""Preveri SLIKA stolpec v Google Sheets"""
from google_sheets import GoogleSheetsManager

gs = GoogleSheetsManager()
gs.connect()

for store in ["spar", "mercator", "tus"]:
    print(f"\n{'='*50}")
    print(f"{store.upper()}")
    print('='*50)

    sheet = gs.open_sheet(store)
    if sheet:
        ws = sheet.sheet1

        # Preberi prvih 5 vrstic
        rows = ws.get_all_values()[:6]  # Header + 5

        print(f"Vrstic: {len(ws.get_all_values())}")
        print(f"Header: {rows[0]}")

        # Preveri SLIKA stolpec (index 2)
        print(f"\nSLIKA stolpec (prvih 5):")
        for i, row in enumerate(rows[1:6], 1):
            slika = row[2] if len(row) > 2 else ""
            if slika:
                print(f"  {i}. {slika[:70]}...")
            else:
                print(f"  {i}. PRAZNO!")
