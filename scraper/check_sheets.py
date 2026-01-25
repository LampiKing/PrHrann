"""Preveri kaj je v Google Sheets"""
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

        # Header
        headers = ws.row_values(1)
        print(f"Stolpci: {headers}")

        # Prva vrstica podatkov
        if len(ws.get_all_values()) > 1:
            first_row = ws.row_values(2)
            print(f"\nPrimer (vrstica 2):")
            for i, h in enumerate(headers):
                val = first_row[i] if i < len(first_row) else ""
                print(f"  {h}: {val[:80]}..." if len(str(val)) > 80 else f"  {h}: {val}")
