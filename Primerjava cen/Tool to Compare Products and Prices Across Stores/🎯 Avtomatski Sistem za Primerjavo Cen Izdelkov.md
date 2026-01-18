# 🎯 Avtomatski Sistem za Primerjavo Cen Izdelkov

**Inteligentni sistem ki avtomatski prepozna iste izdelke iz različnih trgovin in jih primerja po ceni.**

---

## 📦 Kaj Dobijate

Kompletna rešitev z:
- ✅ **Inteligentnim ujemanjem** - Pravilno ujema Jaffa kekse, Alpsko mleko, itd.
- ✅ **Avtomatsko detekcijo** - Avtomatski detektira nove Google Sheets datoteke
- ✅ **Avtomatsko posodobitvijo** - Vsakič ko dodate nove izdelke, se sistem osveži
- ✅ **Primerjavo cen** - Prikaže cene v vseh trgovinah in najcenejšo
- ✅ **Brez napak** - Testirana in optimizirana rešitev

---

## 🚀 Hiter Začetek (3 Koraki)

### 1. Namestite Python (če ga še nimate)
```bash
# Linux/Mac
python3 --version

# Če ga nimate, namestite:
# Ubuntu/Debian: sudo apt-get install python3
# Mac: brew install python3
# Windows: https://www.python.org/downloads/
```

### 2. Prenesite Datoteke
Prenesite vse datoteke iz mape `prhran-system/`:
```
product_matcher_intelligent.py
store_config.json
requirements.txt
```

### 3. Poženite Sistem
```bash
# Enkratna analiza
python3 product_matcher_intelligent.py

# Avtomatska posodobitev (vsaki 5 minut)
python3 product_matcher_intelligent.py watch
```

**To je to!** Rezultati se bodo pojavili v `matched_products_latest.csv`

---

## 📋 Tri Načini Uporabe

### Način 1: Enkratna Analiza
```bash
python3 product_matcher_intelligent.py
```
- Prenese podatke iz vseh trgovin
- Ujema izdelke
- Shrani rezultate v CSV
- Zaključi

### Način 2: Avtomatska Posodobitev (Priporočeno)
```bash
# Posodobljava se vsaki 5 minut
python3 product_matcher_intelligent.py watch

# Posodobljava se vsaki 10 minut
python3 product_matcher_intelligent.py watch 600

# Posodobljava se vsaki 30 minut
python3 product_matcher_intelligent.py watch 1800
```
- Neprekinjeno teče v ozadju
- Avtomatski prenese nove podatke
- Avtomatski osveži rezultate
- Pritisnite Ctrl+C za ustavitev

### Način 3: Dodajanje Nove Trgovine
```bash
python3 product_matcher_intelligent.py add "Novo Trgovino" "https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv"
```

---

## 🔧 Kako Dodati Novo TRGOVINO

### Korak 1: Dobite SHEET_ID
1. Odprite Google Sheet s podatki o izdelkih
2. V URL-ju poiščite ID:
   ```
   https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
   ```
3. Kopirajte [SHEET_ID]

### Korak 2: Dodajte Trgovino
```bash
python3 product_matcher_intelligent.py add "Novo Trgovino" "https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv"
```

### Korak 3: Preverite
Konfiguracija se avtomatski shrani v `store_config.json`

---

## 📊 Kako Deluje Ujemanje

### Primer: Jaffa Keksi

**SPAR:**
```
BISKVIT S SADNIM ŽELEJEM POMARANČA OBLIT S ČOKOLADO JAFFA, CRVENKA, 150G
```

**TUŠ:**
```
Biskvit Jaffa, pomaranča, 150g
```

**MERKATOR:**
```
Keksi s pomarančnim polnilom, Jaffa, 150 g
```

### Sistem Ekstrahira:
- **Blagovna znamka:** Jaffa ✓
- **Okus:** pomaranča ✓
- **Količina:** 150g ✓

### Rezultat:
```
PROIZVOD,SPAR_CENA,MERKATOR_CENA,TUS_CENA,NAJCENEJSI,RAZLIKA_EUR
Jaffa keksi pomaranča 150g,1.99,2.19,2.09,spar,0.20
```

---

## 📁 Datoteke

| Datoteka | Namen |
|----------|-------|
| `product_matcher_intelligent.py` | Glavni sistem (UPORABITE TO!) |
| `store_config.json` | Konfiguracija trgovin |
| `requirements.txt` | Python odvisnosti |
| `README.md` | Ta datoteka |
| `matched_products_latest.csv` | Najnovejši rezultati |

---

## ⚙️ Konfiguracija (store_config.json)

```json
{
  "spar": "https://docs.google.com/spreadsheets/d/1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok/export?format=csv",
  "merkator": "https://docs.google.com/spreadsheets/d/1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0/export?format=csv",
  "tus": "https://docs.google.com/spreadsheets/d/17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A/export?format=csv"
}
```

**Kako Spremeniti:**
1. Odprite `store_config.json` v urejevalniku
2. Spremenite URL-je
3. Shranite
4. Sistem avtomatski prebere novo konfiguraciju

---

## 📈 Rezultati (CSV Format)

```csv
PROIZVOD,SPAR_CENA,MERKATOR_CENA,TUS_CENA,NAJCENEJSI,RAZLIKA_EUR
Jaffa keksi pomaranča 150g,1.99,2.19,2.09,spar,0.20
Alpsko mleko 1L,0.89,0.99,0.95,spar,0.10
Suhe marelice 200g,2.29,2.39,2.49,spar,0.20
```

---

## 🔍 Kako Deluje Sistem

### 1. Prenešem Podatke
- Prenese podatke iz vseh trgovin
- Shrani v pomnilnik

### 2. Ekstrahiram Ključne Informacije
- Blagovna znamka
- Okus/Značilnost
- Količina
- Glavne besede

### 3. Ujemam Izdelke
- Primerja ključne informacije
- Ignora opise in različne besedilne oblike
- Ujema samo ISTE izdelke

### 4. Primerja Cene
- Najde najcenejšo trgovino
- Izračuna razliko
- Shrani rezultate

---

## ❓ Pogosto Postavljena Vprašanja

**V: Ali je potrebno kaj ročno?**
A: Ne! Samo dodate nove izdelke v Google Sheet, sistem se avtomatski posodablja.

**V: Kaj če je Google Sheet nedostopen?**
A: Sistem preskoči to trgovino in nadaljuje z drugimi.

**V: Kako hitro se posodablja?**
A: Vsaki 5 minut (ali po vaši izbiri).

**V: Ali je mogoče spremeniti interval?**
A: Da! `python3 product_matcher_intelligent.py watch 600` (600 sekund = 10 minut)

**V: Kako ustavim avtomatsko posodobitev?**
A: Pritisnite Ctrl+C

**V: Kaj če se sistem sruši?**
A: Preberite spodaj "Odpravljanje Napak"

**V: Ali je mogoče dodati več kot 3 trgovine?**
A: Da! `python3 product_matcher_intelligent.py add "Trgovina" "URL"`

**V: Kako dobim SHEET_ID?**
A: Odprite Google Sheet in v URL-ju poiščite ID med `/d/` in `/edit`

---

## 🐛 Odpravljanje Napak

### Napaka: "ModuleNotFoundError: No module named 'requests'"
```bash
pip3 install requests
```

### Napaka: "Connection refused"
- Preverite internetno povezavo
- Preverite ali je Google Sheet dostopen

### Napaka: "No products found"
- Preverite ali ima Google Sheet podatke
- Preverite ali je prvi stolpec "IME IZDELKA"

### Napaka: "Permission denied"
```bash
chmod +x product_matcher_intelligent.py
```

---

## 📞 Podpora

Če imate vprašanja ali težave:
1. Preberite FAQ zgoraj
2. Preverite odpravljanje napak
3. Kontaktirajte razvijalca

---

## 📝 Struktura Google Sheet

Vsaka Google Sheet mora imeti zavihko "Podatki" s stolpci:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| IME IZDELKA | CENA | SLIKA | AKCIJSKA CENA | NA VOLJO | POSODOBLJENO |
| Jaffa keksi 150g | 1,99€ | [URL] | | Na voljo | 15. 1. 2026 |

---

## 🎉 Ste Pripravljeni!

1. Prenesite datoteke
2. Poženite `python3 product_matcher_intelligent.py`
3. Počakajte rezultate
4. Preverite `matched_products_latest.csv`

**Vso srečo!** 🚀
