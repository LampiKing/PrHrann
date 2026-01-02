# 🇸🇮 Navodila za Avtomatski Scraper - www.prhran.com

## 📋 Kako Deluje

### **1. PRVI ZAGON** (`initial_scrape.py`)
- ⏱️ Traja: 30-60 minut
- 📦 Scrapa: ~15.000+ izdelkov
- 🛒 Trgovine: SPAR, Tuš, Mercator
- ✅ Akcija: Vpiše VSE v Google Sheet

### **2. DNEVNA POSODOBITEV** (`daily_update.py`)
- ⏱️ Traja: 30-60 minut
- 🔄 Kdaj: Vsak dan ob 21:00 (cron)
- ✅ Akcija: **SAMO posodobi spremenjene cene**
- 💡 Ne briše, ne dodaja - samo UPDATE

---

## 🚀 Nastavitev

### Korak 1: Namesti Pakete (2 min)

```bash
pip install playwright gspread oauth2client --break-system-packages
playwright install chromium
```

### Korak 2: Google API Setup (5 min)

#### A) Ustvari Service Account

1. Pojdi na: **https://console.cloud.google.com/**
2. Ustvari nov projekt (npr. "Prhran Scraper")
3. **APIs & Services** > **Library** > Omogoči:
   - Google Sheets API
   - Google Drive API
4. **APIs & Services** > **Credentials** > **Create Credentials** > **Service Account**
   - Name: `prhran-scraper`
   - Role: Editor
5. Klikni na Service Account > **Keys** > **Add Key** > **Create new key** > **JSON**
6. Prenesi datoteko in jo **preimenuj v `credentials.json`**
7. Daj jo v isti direktorij kot skripta

#### B) Deli Google Sheet

1. Odpri `credentials.json`
2. Kopiraj `"client_email"` (nekaj kot: `prhran-scraper@xxx.iam.gserviceaccount.com`)
3. Odpri svoj **Google Sheet**: https://docs.google.com/spreadsheets/d/1Wj5nqFcd6isnTA_FTgyA7aTRU6tHfTJG3fGGEN15B6Y/edit
4. Klikni **Share** ▶️ Prilepi Service Account email ▶️ **Editor** pravice

✅ **Zdaj je scraper povezan s tvojim Sheetom!**

---

## 📝 Uporaba

### PRVI ZAGON (Enkratno)

```bash
python initial_scrape.py
```

**To bo:**
1. Scrapalo ~15.000+ izdelkov (vse kategorije, vse trgovine)
2. Trajalo 30-60 minut
3. Vpisalo VSE v Google Sheet
4. Počistilo stare podatke

**Izhod:**
```
🇸🇮 PRVI ZAGON - SCRAPING VSEH IZDELKOV
══════════════════════════════════════════

🛒 SPAR
────────────────────────────────────────
  📂 SPAR/sadje-in-zelenjava... ✅ 245
  📂 SPAR/mleko-in-jajca... ✅ 189
  📂 SPAR/meso-in-ribe... ✅ 312
  ...
  ✅ SPAR skupaj: 4.521 izdelkov

🛒 TUŠ
────────────────────────────────────────
  ...
  ✅ Tuš skupaj: 4.892 izdelkov

🛒 MERCATOR
────────────────────────────────────────
  ...
  ✅ Mercator skupaj: 5.134 izdelkov

📊 STATISTIKA
──────────────────────────────────────
📦 Skupaj izdelkov: 14.547
   • SPAR: 4.521
   • Tuš: 4.892
   • Mercator: 5.134
🎁 Na akciji: 1.245

📊 PISANJE V GOOGLE SHEET
──────────────────────────────────────
🧹 Čistim obstoječe podatke...
📝 Pišem 14.547 izdelkov...
  ✅ 100/14547
  ✅ 200/14547
  ...
  ✅ 14547/14547

✅ USPEŠNO! Vpisanih 14.547 izdelkov v Google Sheet
🔗 https://docs.google.com/spreadsheets/d/1Wj5nqFcd6isnTA_FTgyA7aTRU6tHfTJG3fGGEN15B6Y/edit
```

---

### DNEVNA POSODOBITEV

```bash
python daily_update.py
```

**To bo:**
1. Scrapalo vse izdelke (30-60 min)
2. Primerjalo s Sheetom
3. **SAMO posodobilo spremenjene cene**
4. Dodalo nove izdelke (če jih najde)

**Izhod:**
```
🔄 DNEVNA POSODOBITEV CEN
══════════════════════════════════════

🕐 2026-01-02 21:00:15 - Scraping...

🛒 SPAR... ✅ 4.521
🛒 Tuš... ✅ 4.892
🛒 Mercator... ✅ 5.134

📊 Posodabljam Google Sheet...
  📖 Berem obstoječe podatke...
  🔍 Preverjam spremembe...
  ✏️  Posodabljam 234 izdelkov...
  ➕ Dodajam 12 novih izdelkov...

📊 REZULTAT:
  ✅ Posodobljenih: 234
  ➕ Dodanih: 12
  ⏭️  Nespremenjenih: 14.301
  📦 Skupaj obdelanih: 14.547

✅ Posodobitev končana!
```

---

## ⏰ Avtomatizacija (Cron)

### Linux/Mac

```bash
# Odpri crontab
crontab -e

# Dodaj vrstico (scraping vsak dan ob 21:00)
0 21 * * * cd /pot/do/projekta && python daily_update.py >> /var/log/prhran_scraper.log 2>&1
```

**Preveri:**
```bash
crontab -l
```

### Windows (Task Scheduler)

1. Odpri **Task Scheduler**
2. **Create Basic Task**
3. Name: "Prhran Daily Update"
4. Trigger: **Daily** at **21:00**
5. Action: **Start a program**
   - Program: `python`
   - Arguments: `C:\path\to\daily_update.py`
6. **Finish**

---

## 📁 Struktura Datotek

```
project/
├── initial_scrape.py       # Prvi zagon (~60 min)
├── daily_update.py         # Dnevna posodobitev (~60 min)
├── credentials.json        # Google Service Account (ustvari sam)
└── README_SETUP.md         # Ta dokument
```

---

## 🔧 Prilagoditve

### Dodaj/Odstrani Kategorije

V obeh skriptih poišči `ALL_CATEGORIES` in prilagodi:

```python
ALL_CATEGORIES = {
    "spar": [
        "sadje-in-zelenjava",
        "mleko-in-jajca",
        # Dodaj več...
    ],
    "tus": [...],
    "mercator": [...]
}
```

### Spremeni Čas Posodabljanja

V cron:
```bash
# Namesto 21:00, recimo 8:00
0 8 * * * cd /pot/do/projekta && python daily_update.py
```

---

## 🐛 Troubleshooting

### Problem: `FileNotFoundError: credentials.json`

**Rešitev:**
```bash
# Preveri, če datoteka obstaja
ls credentials.json

# Če ne obstaja, prenesi jo iz Google Cloud Console
# In jo daj v isti direktorij kot skript
```

### Problem: `gspread.exceptions.SpreadsheetNotFound`

**Rešitev:**
- Preveri, če si **"Share"**-al Sheet s Service Account emailom
- Email najdeš v `credentials.json` pod `"client_email"`
- Sheet mora imeti **Editor** pravice za Service Account

### Problem: Scraping traja predolgo

**Rešitev:**
- To je normalno - ~15.000 izdelkov traja 30-60 min
- Lahko zmanjšaš število kategorij v `ALL_CATEGORIES`
- Lahko zmanjšaš število scroll-ov (spremeni `range(10)` na `range(5)`)

### Problem: Nekateri izdelki manjkajo

**Rešitev:**
- Spletne strani se lahko spreminjajo
- Preveri HTML struktur trading strani
- Morda je treba prilagoditi CSS selectorje

---

## 📊 Google Sheet Format

Tvoj Sheet bo imel naslednje stolpce:

| Ime izdelka | Cena | Akcijska cena | Trgovina | Datum |
|-------------|------|---------------|----------|--------|
| Jabolka Gala | 2.99 | 1.99 | SPAR | 2026-01-02 |
| Banane | 2.49 | | Tuš | 2026-01-02 |
| Mleko 1L | 1.19 | 0.99 | Mercator | 2026-01-02 |

---

## ⚠️ Pomembno

1. **Prvi zagon traja 30-60 minut** - Ne prekini ga!
2. **Dnevna posodobitev tudi ~60 min** - Nastavi cron za ponoči
3. **Spoštuj rate limits** - Ne scrape prevečkrat (enkrat na dan je OK)
4. **Google API kvote** - Free tier ima limite, preveri če presežeš

---

## 📈 Naslednji Koraki

1. ✅ Zaženi `initial_scrape.py` (enkratno)
2. ✅ Preveri Google Sheet
3. ✅ Nastavi cron za `daily_update.py`
4. ✅ Testiraj po enem dnevu

---

## 💡 Nasveti

- **Log datoteke**: Dodaj `>> log.txt 2>&1` na koncu cron ukaza za debugging
- **Email obvestila**: Dodaj email notifikacije v cron za napake
- **Backup**: Google Sheets ima avtomatski version history
- **Monitoring**: Preveri logove vsak teden

---

**Vse pripravljeno! 🚀**

Če imaš vprašanja, javi! 😊
