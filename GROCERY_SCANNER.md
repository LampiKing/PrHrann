# Grocery Scanner (Spar, Mercator, Hitri Nakup, Jager)

Ta skripta tedensko pobere cene iz spletnih trgovin in jih pošlje v Convex.

## 1) Namesti knjižnice

```bash
pip install requests beautifulsoup4
```

## 2) Nastavi okoljske spremenljivke

V `.env.local` ali v System Environment Variables dodaj:

```
PRHRAN_INGEST_URL=https://vibrant-dolphin-871.convex.site/api/ingest/grocery
PRHRAN_INGEST_TOKEN=USTVARI_DOLG_SKRIT_TOKEN
```

**Token mora biti isti v Convex okolju** (Environment Variables):

```
PRHRAN_INGEST_TOKEN=USTVARI_DOLG_SKRIT_TOKEN
```

## 3) Ročni zagon

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

## 4) Tedenski zagon (Windows Task Scheduler)

- Create Basic Task → Weekly → Sunday 06:00
- Action: Start a program
  - Program: `python`
  - Arguments: `grocery_scanner.py --upload`
  - Start in: `C:\Users\lampr\Desktop\PrHran`

## Opombe

- Tuš spletna trgovina = Hitri Nakup (`hitrinakup.com`)
- Hofer in Lidl nimata online trgovine → dodajanje ročno ali prek letakov.
