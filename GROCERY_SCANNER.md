# Grocery Scanner (Spar, Mercator, Hitri Nakup)

`grocery_scanner.py` je legacy scanner. Nova avtomatika je v `automated_scraper/`.

## Avtomatski Google Sheets scraper

Nova avtomatika je v `automated_scraper/`:
- `automated_scraper/README_SETUP.md`
- `automated_scraper/QUICKSTART_AUTOMATED.md`

Te skripte pisejo cene v Google Sheet in (z `--upload`) posljejo v Convex.
Za zagon najprej pojdi v mapo `automated_scraper/`.

## 1) Avtomatika (GitHub Actions)

V repozitorij je dodan workflow `.github/workflows/grocery-scan.yml`, ki tece
vsak dan ob 06:00 CET (05:00 UTC) in zazene `automated_scraper/daily_update.py --upload`.
Posodobi Google Sheet in poslje podatke v Convex.

**Nujno nastavi GitHub Secrets:**

- `GOOGLE_SHEETS_CREDENTIALS` = vsebina `credentials.json`
- `PRHRAN_INGEST_URL` = `https://vibrant-dolphin-871.convex.site/api/ingest/grocery`
- `PRHRAN_INGEST_TOKEN` = tvoj skrivni token
- (opcijsko) `PRHRAN_SHEET_ID` = ID Google Sheeta

Nato dodaj isti `PRHRAN_INGEST_TOKEN` še v Convex okolje (Environment Variables).

## 2) Namesti knjižnice (samo če želiš ročno testirati lokalno)

```bash
pip install -r automated_scraper/requirements_automated.txt
playwright install chromium
```

## 3) Nastavi okoljske spremenljivke (lokalno)

V `.env.local` ali v System Environment Variables dodaj:

```
PRHRAN_INGEST_URL=https://vibrant-dolphin-871.convex.site/api/ingest/grocery
PRHRAN_INGEST_TOKEN=USTVARI_DOLG_SKRIT_TOKEN
```

**Token mora biti isti v Convex okolju** (Environment Variables):

```
PRHRAN_INGEST_TOKEN=USTVARI_DOLG_SKRIT_TOKEN
```

## 4) Ročni zagon

```bash
python automated_scraper/initial_scrape.py
python automated_scraper/daily_update.py --upload
```

Podatki se shranijo v Google Sheet (poglej link v izpisu).

## 5) Dnevni zagon (Windows Task Scheduler)

- Create Basic Task -> Daily -> 06:00
- Action: Start a program
  - Program: `python`
  - Arguments: `automated_scraper\\daily_update.py --upload`
  - Start in: `C:\Users\lampr\Desktop\PrHran`

## Opombe

- Tuš spletna trgovina = Hitri Nakup (`hitrinakup.com`)

## Kategorije po trgovinah

Če želiš ročno kontrolirati kategorije (npr. "živila only"), uredi:

`grocery_categories.json`

Primer:
```json
{
  "spar": ["/sadje-in-zelenjava", "/kruh-pecivo-in-slascice"],
  "mercator": [],
  "hitri_nakup": []
}
```

Če je seznam prazen, se uporabi avtomatsko iskanje kategorij.

Opcijsko lahko omejiš skeniranje na eno trgovino ali kategorijo:

```bash
python grocery_scanner.py --store spar --category zelenjava --upload
```




