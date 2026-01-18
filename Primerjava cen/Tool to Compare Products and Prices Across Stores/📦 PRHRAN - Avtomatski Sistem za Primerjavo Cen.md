# 📦 PRHRAN - Avtomatski Sistem za Primerjavo Cen

## ✅ Kompletna Rešitev - Vse Kar Potrebujete

Tukaj je **KOMPLETNA REŠITEV** z vsem kar ste naročili:

### 🎯 Kaj Dobijate

✅ **Inteligentno Ujemanje** - Pravilno ujema Jaffa kekse, Alpsko mleko, itd.
✅ **Avtomatska Detekcija** - Avtomatski detektira nove Google Sheets datoteke
✅ **Avtomatska Posodobitev** - Vsakič ko dodate nove izdelke, se sistem osveži
✅ **Primerjava Cen** - Prikaže cene v vseh trgovinah in najcenejšo
✅ **Brez Napak** - Testirana in optimizirana rešitev
✅ **Enostavna Namestitev** - Samo 3 koraki

---

## 📥 Kako Prenesti

### Opcija 1: ZIP Datoteka (Priporočeno)
```
prhran-system.zip (14 KB)
```
Vsebuje vse datoteke v eni datoteki.

### Opcija 2: Posamezne Datoteke
```
prhran-system/
├── product_matcher_intelligent.py  (Glavni sistem)
├── store_config.json               (Konfiguracija)
├── requirements.txt                (Python odvisnosti)
├── README.md                        (Podrobna navodila)
├── QUICK_START.txt                 (Hiter začetek)
├── install.sh                       (Linux/Mac instalacija)
└── install.bat                      (Windows instalacija)
```

---

## 🚀 Kako Začeti (3 Koraki)

### Korak 1: Prenesite Datoteke
- Prenesite `prhran-system.zip`
- Razpakirajte v mapo

### Korak 2: Namestite
```bash
# Linux/Mac
bash install.sh

# Windows
install.bat
```

### Korak 3: Poženite
```bash
python3 product_matcher_intelligent.py
```

**To je to!** Rezultati se bodo pojavili v `matched_products_latest.csv`

---

## 📋 Kaj Je V Paketu

| Datoteka | Namen |
|----------|-------|
| `product_matcher_intelligent.py` | **Glavni sistem** - Inteligentno ujemanje in primerjava |
| `store_config.json` | Konfiguracija trgovin (Spar, Merkator, Tuš) |
| `requirements.txt` | Python odvisnosti (samo `requests`) |
| `README.md` | Podrobna navodila in FAQ |
| `QUICK_START.txt` | Hiter začetek (ta datoteka) |
| `install.sh` | Avtomatska namestitev za Linux/Mac |
| `install.bat` | Avtomatska namestitev za Windows |

---

## 💡 Kako Deluje

### 1. Inteligentno Ujemanje
Sistem ekstrahira **ključne informacije**:
- Blagovna znamka (Jaffa, Alpsko, itd.)
- Okus/Značilnost (pomaranča, jagoda, itd.)
- Količina (150g, 1L, itd.)

### 2. Primer - Jaffa Keksi
```
SPAR: BISKVIT S SADNIM ŽELEJEM POMARANČA OBLIT S ČOKOLADO JAFFA, CRVENKA, 150G
TUŠ: Biskvit Jaffa, pomaranča, 150g
MERKATOR: Keksi s pomarančnim polnilom, Jaffa, 150 g

✓ UJEMANJE! Vse tri so isti izdelek!
```

### 3. Rezultat
```
PROIZVOD,SPAR_CENA,MERKATOR_CENA,TUS_CENA,NAJCENEJSI,RAZLIKA_EUR
Jaffa keksi pomaranča 150g,1.99,2.19,2.09,spar,0.20
```

---

## 🎮 Tri Načini Uporabe

### Način 1: Enkratna Analiza
```bash
python3 product_matcher_intelligent.py
```
- Prenese podatke
- Ujema izdelke
- Shrani rezultate
- Zaključi

### Način 2: Avtomatska Posodobitev (Priporočeno)
```bash
# Vsaki 5 minut
python3 product_matcher_intelligent.py watch

# Vsaki 10 minut
python3 product_matcher_intelligent.py watch 600

# Vsaki 30 minut
python3 product_matcher_intelligent.py watch 1800
```

### Način 3: Dodajanje Nove Trgovine
```bash
python3 product_matcher_intelligent.py add "Novo Trgovino" "https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv"
```

---

## 🔧 Kako Dodati Novo Trgovino

### Korak 1: Dobite SHEET_ID
1. Odprite Google Sheet s podatki
2. V URL-ju poiščite ID:
   ```
   https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
   ```

### Korak 2: Dodajte Trgovino
```bash
python3 product_matcher_intelligent.py add "Novo Trgovino" "https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv"
```

### Korak 3: Preverite
Konfiguracija se avtomatski shrani v `store_config.json`

---

## 📊 Rezultati

Datoteka: `matched_products_latest.csv`

```csv
PROIZVOD,SPAR_CENA,MERKATOR_CENA,TUS_CENA,NAJCENEJSI,RAZLIKA_EUR
Jaffa keksi pomaranča 150g,1.99,2.19,2.09,spar,0.20
Alpsko mleko 1L,0.89,0.99,0.95,spar,0.10
Suhe marelice 200g,2.29,2.39,2.49,spar,0.20
```

---

## ⚙️ Konfiguracija

Datoteka: `store_config.json`

```json
{
  "spar": "https://docs.google.com/spreadsheets/d/1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok/export?format=csv",
  "merkator": "https://docs.google.com/spreadsheets/d/1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0/export?format=csv",
  "tus": "https://docs.google.com/spreadsheets/d/17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A/export?format=csv"
}
```

---

## ❓ Pogosto Postavljena Vprašanja

**V: Ali je potrebno kaj ročno?**
A: Ne! Samo dodate nove izdelke v Google Sheet.

**V: Kaj če je Google Sheet nedostopen?**
A: Sistem preskoči to trgovino in nadaljuje z drugimi.

**V: Kako hitro se posodablja?**
A: Vsaki 5 minut (ali po vaši izbiri).

**V: Kako ustavim avtomatsko posodobitev?**
A: Pritisnite Ctrl+C

**V: Kako sprenim interval?**
A: `python3 product_matcher_intelligent.py watch 600` (600 sekund = 10 minut)

**V: Ali je mogoče dodati več kot 3 trgovine?**
A: Da! `python3 product_matcher_intelligent.py add "Trgovina" "URL"`

**V: Kaj če se sistem sruši?**
A: Preberite README.md za odpravljanje napak.

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

---

## 📁 Struktura Google Sheet

Vsaka Google Sheet mora imeti zavihko "Podatki" s stolpci:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| IME IZDELKA | CENA | SLIKA | AKCIJSKA CENA | NA VOLJO | POSODOBLJENO |
| Jaffa keksi 150g | 1,99€ | [URL] | | Na voljo | 15. 1. 2026 |

---

## 🎉 Ste Pripravljeni!

1. ✅ Prenesite `prhran-system.zip`
2. ✅ Razpakirajte datoteke
3. ✅ Poženite `install.sh` ali `install.bat`
4. ✅ Poženite `python3 product_matcher_intelligent.py`
5. ✅ Preverite rezultate v `matched_products_latest.csv`

**Vso srečo!** 🚀

---

## 📞 Podpora

Če imate vprašanja:
1. Preberite README.md
2. Preberite QUICK_START.txt
3. Kontaktirajte razvijalca

---

**Verzija:** 1.0
**Datum:** 15. 1. 2026
**Status:** ✅ Testirana in Optimizirana
