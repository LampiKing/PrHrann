"""Pobriši testne vrstice iz Google Sheets"""
from google_sheets import GoogleSheetsManager

gs = GoogleSheetsManager()
gs.connect()

sheet = gs.open_sheet("spar")
if sheet:
    ws = sheet.sheet1

    # Preberi vse vrstice
    all_values = ws.get_all_values()
    print(f"Trenutno vrstic: {len(all_values)}")

    # Najdi testne vrstice
    test_rows = []
    for i, row in enumerate(all_values):
        if row and "[TEST" in row[0]:
            test_rows.append(i + 1)

    print(f"Testnih vrstic: {len(test_rows)}")

    # Pobriši od zadnje proti prvi (da se indeksi ne zamešajo)
    for row_num in reversed(test_rows):
        ws.delete_rows(row_num)
        print(f"  Pobrisana vrstica {row_num}")

    print(f"\n[OK] Pobrisanih {len(test_rows)} testnih vrstic")
    print(f"Zdaj vrstic: {len(ws.get_all_values())}")
