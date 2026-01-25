"""
Google Sheets Integration za Pr'Hran
=====================================

Shrani scrapane podatke v Google Sheets.
Vsaka trgovina ima svoj sheet.

SHEETS:
- Mercator: 1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0
- SPAR: 1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok
- Tuš: 17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A

SETUP:
1. Pojdi na https://console.cloud.google.com/
2. Ustvari projekt "PrHran"
3. Omogoči "Google Sheets API" in "Google Drive API"
4. Ustvari Service Account → Prenesi credentials.json
5. V VSAKEM Google Sheet dodaj service account email kot Editor
   (email je v credentials.json pod "client_email")
"""

import json
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path

try:
    import gspread
    from google.oauth2.service_account import Credentials
    GSPREAD_AVAILABLE = True
except ImportError:
    GSPREAD_AVAILABLE = False
    print("[!] gspread ni instaliran. Zaženi: pip install gspread google-auth")

from config import GOOGLE_SHEETS, GOOGLE_CREDENTIALS_FILE


class GoogleSheetsManager:
    """Manager za Google Sheets - en sheet per trgovina"""

    SCOPES = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
    ]

    # Struktura sheetov - MORA UJEMATI OBSTOJEČE!
    # Stolpci: IME IZDELKA, CENA, SLIKA, AKCIJSKA CENA, NA VOLJO, POSODOBLJENO
    HEADERS = [
        "IME IZDELKA",
        "CENA",
        "SLIKA",
        "AKCIJSKA CENA",
        "NA VOLJO",
        "POSODOBLJENO"
    ]

    def __init__(self, credentials_file: str = None):
        """Inicializiraj manager"""
        self.credentials_file = credentials_file or self._find_credentials()
        self.client = None
        self.sheets = {}  # Cache za odprte sheete

        if not GSPREAD_AVAILABLE:
            raise ImportError("gspread ni instaliran!")

    def _find_credentials(self) -> str:
        """Najdi credentials.json"""
        possible_paths = [
            Path(__file__).parent / GOOGLE_CREDENTIALS_FILE,
            Path(__file__).parent / "credentials.json",
            Path(__file__).parent.parent / "credentials.json",
        ]

        for path in possible_paths:
            if path.exists():
                return str(path)

        raise FileNotFoundError(
            "credentials.json NI NAJDEN!\n\n"
            "NAVODILA:\n"
            "1. Pojdi na https://console.cloud.google.com/\n"
            "2. Ustvari projekt 'PrHran'\n"
            "3. Omogoči 'Google Sheets API' in 'Google Drive API'\n"
            "4. APIs & Services → Credentials → Create Service Account\n"
            "5. Ustvari key (JSON) in shrani kot 'credentials.json'\n"
            "6. Kopiraj 'client_email' iz JSON in ga dodaj kot Editor v vsak Sheet!"
        )

    def connect(self) -> bool:
        """Poveži se z Google API"""
        try:
            creds = Credentials.from_service_account_file(
                self.credentials_file,
                scopes=self.SCOPES
            )
            self.client = gspread.authorize(creds)

            # Preberi service account email
            with open(self.credentials_file) as f:
                cred_data = json.load(f)
                email = cred_data.get("client_email", "")

            print(f"[OK] Povezan z Google Sheets")
            print(f"    Service Account: {email}")
            print(f"\n    POMEMBNO: Ta email MORA biti dodan kot Editor v vsakem Sheet-u!")
            return True
        except Exception as e:
            print(f"[X] Napaka pri povezovanju: {e}")
            return False

    def open_sheet(self, store: str) -> Optional[gspread.Spreadsheet]:
        """Odpri sheet za določeno trgovino"""
        store_lower = store.lower()

        # Cache
        if store_lower in self.sheets:
            return self.sheets[store_lower]

        # Najdi ID
        sheet_id = GOOGLE_SHEETS.get(store_lower)
        if not sheet_id:
            print(f"[X] Ni sheet ID za: {store}")
            return None

        try:
            spreadsheet = self.client.open_by_key(sheet_id)
            self.sheets[store_lower] = spreadsheet
            print(f"[OK] Odprt sheet: {spreadsheet.title}")
            return spreadsheet
        except gspread.exceptions.SpreadsheetNotFound:
            print(f"[X] Sheet ni najden ali nimaš dostopa!")
            print(f"    Dodaj service account email kot Editor v sheet!")
            return None
        except Exception as e:
            print(f"[X] Napaka: {e}")
            return None

    def clear_and_upload(self, store: str, products: List[Dict]) -> bool:
        """
        Počisti sheet in naloži NOVE podatke.
        To se kliče pri vsakem scrapanju.
        """
        spreadsheet = self.open_sheet(store)
        if not spreadsheet:
            return False

        try:
            # Vzemi prvi worksheet
            ws = spreadsheet.sheet1

            # Počisti vse (razen headerja)
            ws.clear()

            # Dodaj header
            ws.update("A1:G1", [self.HEADERS])

            # Pripravi podatke - format: IME IZDELKA, CENA, SLIKA, AKCIJSKA CENA, NA VOLJO, POSODOBLJENO
            timestamp = datetime.now().strftime("%d. %m. %Y %H:%M")
            rows = []

            for p in products:
                # Cena - formatiraj kot "1,29€"
                cena = p.get("redna_cena", "")
                if cena:
                    cena = f"{cena:.2f}€".replace(".", ",")

                # Akcijska cena
                akcijska = p.get("akcijska_cena", "")
                if akcijska:
                    akcijska = f"{akcijska:.2f}€".replace(".", ",")

                # Slika URL
                slika = p.get("slika", "") or ""

                rows.append([
                    p.get("ime", ""),           # IME IZDELKA
                    cena,                        # CENA
                    slika,                       # SLIKA
                    akcijska,                    # AKCIJSKA CENA
                    "Na voljo",                  # NA VOLJO
                    timestamp                    # POSODOBLJENO
                ])

            # Batch upload
            if rows:
                # gspread limit je 50000 vrstic naenkrat
                batch_size = 10000
                for i in range(0, len(rows), batch_size):
                    batch = rows[i:i+batch_size]
                    start_row = i + 2  # +2 za header
                    ws.update(f"A{start_row}", batch)
                    print(f"    Naloženo {min(i+batch_size, len(rows))}/{len(rows)} izdelkov...")

            print(f"[OK] {store.upper()}: Naloženih {len(rows)} izdelkov")
            return True

        except Exception as e:
            print(f"[X] Napaka pri uploadu: {e}")
            return False

    def upload_products(self, store: str, products: List[Dict]) -> bool:
        """Alias za clear_and_upload"""
        return self.clear_and_upload(store, products)


def upload_to_sheets(all_products: List[Dict]):
    """
    Upload vseh izdelkov v ustrezne sheete.
    Razdeli po trgovinah in uploada.
    """
    print("\n" + "=" * 60)
    print("UPLOAD V GOOGLE SHEETS")
    print("=" * 60)

    # Inicializiraj manager
    try:
        gs = GoogleSheetsManager()
        if not gs.connect():
            return False
    except Exception as e:
        print(f"[X] {e}")
        return False

    # Razdeli po trgovinah
    by_store = {
        "spar": [],
        "mercator": [],
        "tus": []
    }

    for p in all_products:
        store = p.get("trgovina", "").lower()
        if "spar" in store:
            by_store["spar"].append(p)
        elif "mercator" in store:
            by_store["mercator"].append(p)
        elif "tuš" in store or "tus" in store:
            by_store["tus"].append(p)

    # Upload vsake trgovine
    for store, products in by_store.items():
        if products:
            print(f"\n[{store.upper()}] {len(products)} izdelkov...")
            gs.upload_products(store, products)

    print("\n" + "=" * 60)
    print("UPLOAD KONČAN!")
    print("=" * 60)
    return True


def test_connection():
    """Testiraj povezavo z Google Sheets"""
    print("=" * 60)
    print("TEST GOOGLE SHEETS POVEZAVE")
    print("=" * 60)

    try:
        gs = GoogleSheetsManager()
        if not gs.connect():
            return False

        print("\nTestiram dostop do sheetov...")

        for store in ["spar", "mercator", "tus"]:
            sheet = gs.open_sheet(store)
            if sheet:
                ws = sheet.sheet1
                # Preberi število vrstic
                rows = len(ws.get_all_values())
                print(f"  {store.upper()}: {rows} vrstic")

        print("\n[OK] Vse deluje!")
        return True

    except FileNotFoundError as e:
        print(f"\n{e}")
        return False
    except Exception as e:
        print(f"\n[X] Napaka: {e}")
        return False


if __name__ == "__main__":
    test_connection()
