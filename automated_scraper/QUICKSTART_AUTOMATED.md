# 🚀 HITRA NAVODILA - 5 Korakov do Delujočega Scrapanja

## ✅ Korak 1: Namesti (2 min)

```bash
pip install playwright gspread oauth2client --break-system-packages
playwright install chromium
```

## ✅ Korak 2: Google Service Account (5 min)

1. **https://console.cloud.google.com/** → Ustvari projekt
2. **APIs & Services** → Omogoči **Google Sheets API**
3. **Create Service Account** → Prenesi **credentials.json**
4. Kopiraj **client_email** iz credentials.json
5. **Share Google Sheet** s tem emailom (Editor pravice)

Sheet URL: https://docs.google.com/spreadsheets/d/1Wj5nqFcd6isnTA_FTgyA7aTRU6tHfTJG3fGGEN15B6Y/edit

## ✅ Korak 3: Prvi Zagon (60 min)

```bash
python initial_scrape.py
```

To bo:
- ✅ Scrapalo ~15.000+ izdelkov
- ✅ Trajalo 30-60 minut
- ✅ Vpisalo VSE v Google Sheet

**Rezultat:**
```
✅ USPEŠNO! Vpisanih 14.547 izdelkov
```

## ✅ Korak 4: Testiraj Dnevno Posodobitev (60 min)

```bash
python daily_update.py
```

To bo:
- ✅ Scrapalo vse izdelke
- ✅ Posodobilo samo spremenjene cene
- ✅ Dodalo nove izdelke

**Rezultat:**
```
✅ Posodobljenih: 234
➕ Dodanih: 12
⏭️  Nespremenjenih: 14.301
```

## ✅ Korak 5: Avtomatiziraj (2 min)

### Linux/Mac

```bash
crontab -e

# Dodaj vrstico (vsak dan ob 21:00)
0 21 * * * cd /pot/do/projekta && python daily_update.py
```

### Windows

**Task Scheduler** → Daily at 21:00 → Run `python daily_update.py`

---

## 🎯 To Je To!

Tvoj Google Sheet bo **avtomatsko posodobljen vsak dan ob 21:00**! 🎉

---

## 📊 Kaj Dobiš

- **~15.000+ izdelkov** iz 3 trgovin
- **Dnevno posodabljanje** cen
- **Avtomatsko** - brez ročnega dela
- **Direktno v Google Sheet** - takoj dostopno

---

## 🐛 Če Kaj Ne Dela

### credentials.json ne obstaja
→ Prenesi iz Google Cloud Console

### SpreadsheetNotFound
→ Share Sheet s Service Account emailom (iz credentials.json)

### Traja predolgo
→ To je normalno - 15k izdelkov = 30-60 min

---

**Vprašanja? Preveri README_SETUP.md za podrobnosti!** 📖
