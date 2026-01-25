# PrHran Scraper - BULLETPROOF Edition

Avtomatski scraper za slovenske trgovine z **BULLETPROOF** logiko - brez napak, vedno deluje!

## Features

### BULLETPROOF Logika
- **Retry z exponential backoff** - če nekaj ne uspe, poskusi znova s povečano zakasnitvijo
- **Več fallback selektorjev** - če en CSS selektor ne dela, poskusi drugega
- **Data validation** - vsak izdelek je validiran pred dodajanjem
- **Anti-detection** - piškotki, popupi, rate limiting
- **Progress saving** - shrani napredek, tako da lahko nadaljuješ če se prekine
- **Detailed logging** - jasno sporočanje kaj se dogaja

### Kaj dela?
1. **Scrapa izdelke** iz Spar, Mercator in Tuš
2. **BULLETPROOF ujema iste izdelke** med trgovinami
3. **Pošlje v Convex** za prikaz v aplikaciji

## Struktura

```
scraper/
├── scraper.py              # Glavni orchestrator
├── matcher.py              # BULLETPROOF ujemanje izdelkov ⭐
├── config.py               # Konfiguracija
├── requirements.txt        # Python dependencies
├── .env.example            # Primer konfiguracije
│
├── stores/
│   ├── __init__.py
│   ├── base.py             # BULLETPROOF base class ⭐
│   ├── spar.py             # SPAR specifična logika
│   ├── mercator.py         # Mercator specifična logika
│   └── tus.py              # Tuš specifična logika
│
└── progress/               # Shranjeni napredek scrapanja
```

## BULLETPROOF Base Class

Vsak scraper deduje od `BulletproofScraper` ki ima:

```python
class BulletproofScraper:
    # Retry z exponential backoff
    MAX_RETRIES = 3
    RETRY_DELAYS = [2, 5, 10]

    # Rate limiting
    MIN_DELAY = 0.5
    MAX_DELAY = 2.0

    # Validacija
    MIN_PRICE = 0.05
    MAX_PRICE = 5000

    def retry_on_failure(self, func, max_retries=3):
        """Izvedi funkcijo z retry logiko"""

    def accept_cookies(self):
        """20+ selektorjev za sprejem piškotkov"""

    def close_popups(self):
        """Zapri vse popup-e in modalna okna"""

    def safe_goto(self, url):
        """Varno nalaganje strani z retry"""

    def validate_product(self, product):
        """Validiraj ime, ceno, sliko"""

    def is_duplicate(self, product):
        """Deduplikacija z fingerprint"""

    def save_progress(self):
        """Shrani napredek v JSON"""
```

## Navigacija po trgovinah

### SPAR (spar.py)
```
1. Odpre https://www.spar.si/online
2. Klikne "Kategorije" gumb
3. Hover na kategorijo → Pojavi se podmeni
4. Klikne "Poglejte vse izdelke"
5. Scroll + paginacija
6. Ponovi za vsako od 14 kategorij
```

**Cene (iz content.js):**
- "Prej X,XX €" = stara/redna cena
- Ignorira "Prihranek" (ni cena!)
- Ignorira PC kode (PC30:1,39 €)
- Ignorira cene na enoto (/kg, /kos)

### Mercator (mercator.py)
```
1. Odpre kategorijo (npr. /mlecni-izdelki)
2. Infinite scroll dol
3. Ponovi za vsako od 16 kategorij
```

**Cene (iz content.js):**
- Če 2 različni ceni: PRVA = stara, DRUGA = akcijska
- Ignorira cene na enoto

### Tuš (tus.py)
```
1. Odpre https://hitrinakup.com/kategorije
2. Klikne glavno kategorijo
3. Pridobi podkategorije na levi
4. Klikne vsako podkategorijo
5. Infinite scroll
6. Ponovi za vseh 16 kategorij
```

**Cene (iz content.js):**
- `class*="dashed-price"` = redna cena (prečrtana)
- `class*="green"` = akcijska cena

## Kako deluje ujemanje? (matcher.py)

Problem: Isti izdelek ima različna imena v različnih trgovinah:
- Spar: "Alpsko mleko 3,5% m.m. 1L"
- Mercator: "Mleko ALPSKO polnomastno 3,5% 1 liter"
- Tuš: "ALPSKO MLEKO polnomastno 1l 3.5%"

### 1. Normalizacija
```python
"Alpsko mleko 3,5% m.m. 1L"
→ "alpsko mleko 3.5% 1l"
```
- Lowercase
- Odstrani šumnike (č → c, š → s)
- Poenoti enote (liter → l, gram → g)
- Odstrani odvečne besede (za, in, ali, premium, klasik)

### 2. Ekstrakcija lastnosti
```python
ProductFeatures(
    brand="alpsko",
    quantity=1000,  # ml
    unit="ml",
    fat_percent=3.5,
    product_type="mleko"
)
```

### 3. Signature
```python
"alpsko|mleko|1000ml|3.5%"
```

### 4. Fuzzy Matching
- Primerja podobnost besed z `rapidfuzz`
- Dovoli prerazporejene besede
- Prag: 75% podobnost = match

### 5. Validacija
- Ali se količina ujema (±10%)?
- Ali je ista vrsta izdelka?

## Uporaba

### Namestitev
```bash
cd scraper
pip install -r requirements.txt
playwright install chromium
```

### Konfiguracija
```bash
cp .env.example .env
# Uredi .env in nastavi CONVEX_URL ter PRHRAN_INGEST_TOKEN
```

### Zagon

**Vse trgovine:**
```bash
python scraper.py
```

**Samo ena trgovina:**
```bash
python scraper.py --store spar
python scraper.py --store mercator
python scraper.py --store tus
```

**Brez pošiljanja v Convex:**
```bash
python scraper.py --no-upload
```

**Z vidnim brskalnikom (debugging):**
```bash
python scraper.py --headful
```

## Output

Po scrapanju dobimo:
- `scraped_products_YYYYMMDD_HHMMSS.json` - backup vseh izdelkov
- `progress/` - napredek po trgovinah
- Vsak izdelek ima `match_id` za grupiranje

Primer:
```json
[
  {
    "ime": "Alpsko mleko 3,5% m.m. 1L",
    "redna_cena": 1.29,
    "akcijska_cena": null,
    "kategorija": "Hlajeni In Mlečni Izdelki",
    "enota": "1l",
    "trgovina": "Spar",
    "slika": "https://...",
    "match_id": "M000001"
  },
  {
    "ime": "Mleko ALPSKO polnomastno 3,5% 1 liter",
    "redna_cena": 1.35,
    "akcijska_cena": null,
    "kategorija": "Mlečni izdelki",
    "enota": "1l",
    "trgovina": "Mercator",
    "slika": "https://...",
    "match_id": "M000001"  // ISTI match_id!
  }
]
```

## GitHub Actions

Scraper se avtomatsko izvaja vsak dan ob 7:00 (slovenski čas).

Za aktivacijo:
1. V GitHub repo nastavitvah: Settings → Secrets → Actions
2. Dodaj: `CONVEX_URL` in `PRHRAN_INGEST_TOKEN`

Ročno sproženje:
1. GitHub → Actions → PrHran Scraper
2. Run workflow → Izberi trgovino

## Znane blagovne znamke

Matcher pozna 150+ blagovnih znamk za boljše ujemanje:
- Mlečni: Alpsko, MU, Ego, Activia, Danone...
- Pijače: Coca-Cola, Pepsi, Radenska, Union...
- Sladkarije: Milka, Nutella, Ferrero, Haribo...
- In še mnogo več!

## Statistika

Po scrapanju se izpiše:
```
============================================================
STATISTIKA SCRAPANJA
============================================================
  SPAR:        2500 izdelkov
  MERCATOR:    3200 izdelkov
  TUŠ:         2800 izdelkov
  ------------------------------
  SKUPAJ:      8500 izdelkov

  MATCHING:
  Skupin:      6000
  V 2+ trg:    2100

  Čas: 0:45:23
============================================================
```

`V 2+ trg: 2100` pomeni da je 2100 izdelkov našlo ujemanje v vsaj 2 trgovinah!

## Error Handling

Scraper ima robustno error handling:

```python
# Retry z exponential backoff
for attempt in range(MAX_RETRIES):
    try:
        result = scrape_page()
        break
    except Exception as e:
        delay = RETRY_DELAYS[attempt]  # 2s, 5s, 10s
        time.sleep(delay)

# Validacija
if not is_valid_name(name):
    stats["invalid_name"] += 1
    continue

if not is_valid_price(price):
    stats["invalid_price"] += 1
    continue

# Deduplikacija
fingerprint = f"{name.lower()}|{price}"
if fingerprint in seen:
    stats["duplicates"] += 1
    continue
```

## Logging

Podroben logging z emoji-ji:
```
[14:32:15] [Spar] Odpiranje: https://www.spar.si/online
[14:32:17] [Spar] ✅ Piškotki sprejeti
[14:32:18] [Spar] Odpiram meni kategorij...
[14:32:19] [Spar] ✅ Meni kategorij odprt
[14:32:20] [Spar] Hover na kategorijo: SADJE IN ZELENJAVA
[14:32:22] [Spar] ✅ Odprl kategorijo: SADJE IN ZELENJAVA
[14:32:25] [Spar] Stran 1...
[14:32:30] [Spar] Najdenih 48 elementov s selektorjem: [data-testid*="product"]
[14:32:35] [Spar] Stran 1: 45 izdelkov (skupaj: 45)
...
[14:35:00] [Spar] ✅ SADJE IN ZELENJAVA: KONČANO - 450 izdelkov
```

## Troubleshooting

### Scraper se ustavi
- Preverite internet povezavo
- Poskusi z `--headful` za debugging
- Poglej `progress/` mapo za shranjene podatke

### Ni izdelkov
- Verjetno se je spletna stran spremenila
- Preverite selektorje v browser DevTools
- Dodajte nove selektorje v PRODUCT_SELECTORS

### Slab matching
- Dodajte nove blagovne znamke v KNOWN_BRANDS
- Prilagodite MATCH_THRESHOLD (default: 75)
- Preverite normalizacijo v ProductNormalizer

## Requirements

```
requests>=2.31.0
beautifulsoup4>=4.12.0
lxml>=5.0.0
playwright>=1.40.0
python-dotenv>=1.0.0
schedule>=1.2.0
rapidfuzz>=3.5.0        # Hitro fuzzy string matching
unidecode>=1.3.0        # Odstrani šumnike (č->c, š->s)
regex>=2023.0.0         # Napredni regex
```
