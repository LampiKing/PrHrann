# Grocery Scanner (Spar, Mercator, Hitri Nakup)

Ta skripta tedensko pobere cene iz spletnih trgovin in jih poslje v Convex.

## Avtomatski Google Sheets scraper

Nova avtomatika je v `automated_scraper/`:
- `automated_scraper/README_SETUP.md`
- `automated_scraper/QUICKSTART_AUTOMATED.md`

Te skripte pisejo cene v Google Sheet (ne v Convex).
Za zagon najprej pojdi v mapo `automated_scraper/`.

## 1) Avtomatika (GitHub Actions)

V repozitorij je dodan workflow `.github/workflows/grocery-scan.yml`, ki teče
vsako nedeljo ob 21:00 UTC in sam pošlje podatke v Convex.

**Nujno nastavi GitHub Secrets:**

- `PRHRAN_INGEST_URL` = `https://vibrant-dolphin-871.convex.site/api/ingest/grocery`
- `PRHRAN_INGEST_TOKEN` = tvoj skrivni token

Nato dodaj isti `PRHRAN_INGEST_TOKEN` še v Convex okolje (Environment Variables).

## 2) Namesti knjižnice (samo če želiš ročno testirati lokalno)

```bash
pip install requests beautifulsoup4
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
python grocery_scanner.py --upload
```

Podatki se shranijo tudi lokalno v `cene_data/`:

```
cene_data/
  trenutne_cene.json
  zgodovina/
  spremembe/
```

## 5) Tedenski zagon (Windows Task Scheduler)

- Create Basic Task → Weekly → Sunday 06:00
- Action: Start a program
  - Program: `python`
  - Arguments: `grocery_scanner.py --upload`
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
