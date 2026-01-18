# Hiter Začetek - Avtomatski Sistem za Primerjavo Cen

## 🚀 Kaj Ste Dobili

Avtomatski sistem, ki:
- ✅ Avtomatski prepozna iste izdelke iz različnih trgovin
- ✅ Avtomatski se posodablja ko dodate nove izdelke
- ✅ Avtomatski detektira nove Google Sheets datoteke
- ✅ Primerja cene in pokaže najcenejšo trgovino

---

## 📋 Tri Možnosti

### Opcija 1: Python Script (Najhitrejši Start)

```bash
# Enkratna analiza
python3 product_matcher_auto.py

# Avtomatska posodobitev (vsaki 5 minut)
python3 product_matcher_auto.py watch

# Dodajanje nove trgovine
python3 product_matcher_auto.py add "Novo Trgovino" "https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv"
```

**Rezultat:** CSV datoteka z ujemanji in primerjavo cen

---

### Opcija 2: Google Apps Script (Direktno v Google Sheets)

1. Ustvarite novo Google Sheet
2. **Extensions > Apps Script**
3. Kopirajte kod iz `google_apps_script_auto.js`
4. Poženite `setupAutoUpdate()`
5. **Gotovo!** Avtomatska posodobitev vsaki 5 minut

**Rezultat:** Avtomatska zavihka "Primerjava Cen" v Google Sheets

---

### Opcija 3: Ročna Analiza (Brez Avtomatizacije)

```bash
python3 product_matcher_final.py
```

---

## 🔧 Kako Dodati Novo Trgovino

### Python Script

```bash
python3 product_matcher_auto.py add "Novo Trgovino" "https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv"
```

### Google Apps Script

1. Odprite zavihko "Konfiguracija"
2. Dodajte novo vrstico:
   - TRGOVINA: Ime
   - SHEET_ID: ID datoteke
   - RANGE: Podatki!A:F
   - AKTIVNA: DA

---

## 📊 Kako Dobiti SHEET_ID

1. Odprite Google Sheet
2. V URL-ju poiščite ID:
   ```
   https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
   ```
3. Kopirajte [SHEET_ID]

---

## 🎯 Primer Delovanja

**Vhod:**
- Spar: "SUHE MARELICE SPAR, 200G" - 2,29€
- Tuš: "Suhe Marelice Natura 200g" - 2,49€
- Merkator: "Suhe marelice, OdliÄno, 200 g" - 2,39€

**Izhod:**
```
PROIZVOD,SPAR_CENA,MERKATOR_CENA,TUS_CENA,NAJCENEJSI,RAZLIKA_EUR
Suhe Marelice 200g,2.29,2.39,2.49,spar,0.20
```

---

## ⚙️ Konfiguracija

Konfiguracija je v `store_config.json`:

```json
{
  "spar": "https://docs.google.com/spreadsheets/d/...",
  "merkator": "https://docs.google.com/spreadsheets/d/...",
  "tus": "https://docs.google.com/spreadsheets/d/..."
}
```

---

## 🔄 Avtomatska Posodobitev

### Python Watch Način

```bash
# Vsaki 5 minut (privzeto)
python3 product_matcher_auto.py watch

# Vsaki 10 minut
python3 product_matcher_auto.py watch 600

# Vsaki 30 minut
python3 product_matcher_auto.py watch 1800
```

### Google Apps Script

- Avtomatska posodobitev **vsaki 5 minut**
- Ni potrebno ročno poganjati
- Rezultati se avtomatski osveže

---

## 📁 Datoteke

| Datoteka | Namen |
|----------|-------|
| `product_matcher_auto.py` | Glavni Python script |
| `google_apps_script_auto.js` | Google Apps Script |
| `store_config.json` | Konfiguracija trgovin |
| `matched_products_latest.csv` | Najnovejši rezultati |
| `AUTO_UPDATE_GUIDE.md` | Podrobna navodila |

---

## ❓ Pogosto Postavljena Vprašanja

**V: Kako hitro se posodablja?**
A: Vsaki 5 minut (prilagodljivo)

**V: Ali je potrebno kaj ročno?**
A: Ne! Samo dodate nove izdelke v Google Sheet, sistem se avtomatski posodablja

**V: Kaj če je datoteka nedostopna?**
A: Sistem preskoči to trgovino in nadaljuje z drugimi

**V: Kako ustavim avtomatsko posodobitev?**
A: Pritisnite Ctrl+C (Python) ali izbriši trigger (Google Apps Script)

---

## 🎉 Ste Pripravljeni!

Izberite eno od treh opcij in začnite:

1. **Python Script** - `python3 product_matcher_auto.py watch`
2. **Google Apps Script** - Kopirajte kod in poženite `setupAutoUpdate()`
3. **Ročna Analiza** - `python3 product_matcher_final.py`

Vprašanja? Preberite `AUTO_UPDATE_GUIDE.md` za več podrobnosti.
