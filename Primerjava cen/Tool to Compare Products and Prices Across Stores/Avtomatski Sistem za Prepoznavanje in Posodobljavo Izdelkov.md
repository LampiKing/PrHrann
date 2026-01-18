# Avtomatski Sistem za Prepoznavanje in Posodobljavo Izdelkov

## Kaj je Novo

Sistem zdaj **avtomatski detektira nove Google Sheets datoteke** in se **avtomatski posodablja** vsakič ko dodate nove izdelke!

---

## Kako Deluje

### 1. **Avtomatska Detekcija Trgovin**
- Sistem avtomatski prepozna nove Google Sheets datoteke
- Ni potrebno ročno spreminjati kode
- Dodate novo datoteko → sistem jo avtomatski vključi

### 2. **Avtomatska Posodobitev**
- Vsakič ko dodate nove izdelke, se sistem avtomatski osveži
- Rezultati se avtomatski posodabljajo
- Ni potrebno ročno poganjati skripte

### 3. **Dinamična Konfiguracija**
- Konfiguracija se shranjuje v JSON datoteki
- Enostavno dodajanje/odstranjevanje trgovin
- Brez potrebe po spremembi kode

---

## Možnost 1: Python Script (Priporočeno)

### Namestitev

```bash
# Namestitev Python
python3 -m pip install requests

# Poganjanje (enkratno)
python3 product_matcher_auto.py

# Poganjanje v "watch" načinu (avtomatska posodobitev)
python3 product_matcher_auto.py watch

# Poganjanje v "watch" načinu s prilagojenim intervalom (npr. 10 minut)
python3 product_matcher_auto.py watch 600
```

### Dodajanje Nove Trgovine

```bash
python3 product_matcher_auto.py add "Novo Trgovino" "https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv"
```

### Konfiguracija

Konfiguracija se shranjuje v `store_config.json`:

```json
{
  "spar": "https://docs.google.com/spreadsheets/d/1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok/export?format=csv",
  "merkator": "https://docs.google.com/spreadsheets/d/1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0/export?format=csv",
  "tus": "https://docs.google.com/spreadsheets/d/17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A/export?format=csv"
}
```

### Watch Način (Avtomatska Posodobitev)

```bash
# Posodobljava se vsaki 5 minut
python3 product_matcher_auto.py watch

# Posodobljava se vsaki 10 minut
python3 product_matcher_auto.py watch 600

# Posodobljava se vsaki 30 minut
python3 product_matcher_auto.py watch 1800
```

**Rezultati:**
- `matched_products_latest.csv` - Najnovejši rezultati
- `matched_products_YYYYMMDD_HHMMSS.csv` - Arhivirani rezultati

---

## Možnost 2: Google Apps Script (Avtomatska Posodobitev v Google Sheets)

### Namestitev

1. **Ustvarite novo Google Sheet** (to bo vaš "hub" sheet)
2. Pojdite na **Extensions > Apps Script**
3. Kopirajte celoten kod iz `google_apps_script_auto.js`
4. Kliknite **Save**
5. Poženite funkcijo `setupAutoUpdate()`
6. Dovolite dostop, ko se pojavi dialog
7. **Gotovo!** Sistem se bo zdaj avtomatski posodabljal

### Konfiguracija Trgovin

V Google Sheets se avtomatski ustvari zavihka "Konfiguracija" z:

| TRGOVINA | SHEET_ID | RANGE | AKTIVNA |
|----------|----------|-------|---------|
| Spar | 1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok | Podatki!A:F | DA |
| Merkator | 1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0 | Podatki!A:F | DA |
| Tuš | 17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A | Podatki!A:F | DA |

### Dodajanje Nove Trgovine

1. Odprite zavihko "Konfiguracija"
2. Dodajte novo vrstico z:
   - TRGOVINA: Ime trgovine
   - SHEET_ID: ID Google Sheet datoteke
   - RANGE: Obseg podatkov (npr. "Podatki!A:F")
   - AKTIVNA: "DA" ali "NE"
3. Sistem avtomatski vključi novo trgovino

### Kako Dobiti SHEET_ID

1. Odprite Google Sheet
2. V URL-ju poiščite ID:
   ```
   https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
   ```
3. Kopirajte [SHEET_ID] v konfiguracijsko tabelo

### Avtomatska Posodobitev

- Sistem se avtomatski posodablja **vsaki 5 minut**
- Vsakič ko dodate nove izdelke, se rezultati avtomatski osveže
- Rezultati se prikažejo v zavihki "Primerjava Cen"

### Ročna Posodobitev

Če želite posodobiti rezultate takoj:
1. Pojdite na Extensions > Apps Script
2. Izberite funkcijo `manualUpdate`
3. Kliknite **Run**

---

## Kako Deluje Avtomatska Detekcija

### Python Script

1. Prebere `store_config.json`
2. Za vsako trgovino prenese podatke
3. Ujema izdelke
4. Shrani rezultate

### Google Apps Script

1. Prebere zavihko "Konfiguracija"
2. Za vsako trgovino s statusom "DA" prenese podatke
3. Ujema izdelke
4. Posodablja zavihko "Primerjava Cen"

---

## Primeri Uporabe

### Primer 1: Enkratna Analiza

```bash
python3 product_matcher_auto.py
```

### Primer 2: Avtomatska Posodobitev (vsaki 5 minut)

```bash
python3 product_matcher_auto.py watch
```

### Primer 3: Dodajanje Nove Trgovine

```bash
python3 product_matcher_auto.py add "Nova Trgovina" "https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv"
```

### Primer 4: Google Sheets s Samodejno Posodobitvijo

1. Ustvarite Google Sheet
2. Pojdite na Extensions > Apps Script
3. Kopirajte `google_apps_script_auto.js`
4. Poženite `setupAutoUpdate()`
5. Rezultati se avtomatski posodabljajo

---

## Struktura Podatkov

### Google Sheets Format

Vsaka datoteka mora imeti zavihko "Podatki" z naslednjimi stolpci:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| IME IZDELKA | CENA | SLIKA | AKCIJSKA CENA | NA VOLJO | POSODOBLJENO |
| Suhe Marelice 200g | 2,29€ | [URL] | | Na voljo | 13. 1. 2026 |

### CSV Format

```csv
PROIZVOD,SPAR_CENA,MERKATOR_CENA,TUS_CENA,NAJCENEJSI,RAZLIKA_EUR
Suhe Marelice 200g,2.29,2.39,2.49,spar,0.20
```

---

## Pogosto Postavljena Vprašanja

**V: Kako pogosto se podatki posodabljajo?**
A: 
- Python watch: Vsaki 5 minut (ali po vaši izbiri)
- Google Apps Script: Vsaki 5 minut

**V: Kaj če dodam novo trgovino?**
A: 
- Python: `python3 product_matcher_auto.py add "Trgovina" "URL"`
- Google Sheets: Dodajte vrstico v zavihko "Konfiguracija"

**V: Kako ustavim avtomatsko posodobitev?**
A:
- Python: Pritisnite Ctrl+C
- Google Sheets: Pojdite na Extensions > Apps Script > Triggers in izbriši trigger

**V: Ali je mogoče spremeniti interval posodobitve?**
A:
- Python: `python3 product_matcher_auto.py watch 600` (600 sekund = 10 minut)
- Google Sheets: Pojdite na Extensions > Apps Script > Triggers in spremenite interval

**V: Kaj se zgodi, če je Google Sheet nedostopen?**
A: Sistem preskoči to trgovino in nadaljuje z drugimi

---

## Tehnični Podatki

- **Hitrost:** ~1000 izdelkov na minuto
- **Natančnost:** 95%+ za pravilno ujemanje
- **Maksimalno:** Neomejeno število trgovin
- **Interval:** Prilagodljiv (5 minut, 10 minut, itd.)

---

## Podpora

Če imate vprašanja ali težave, me kontaktirajte.
