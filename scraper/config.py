"""
PrHran Scraper Configuration
Konfiguracija za avtomatski scraper
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Convex API
CONVEX_URL = os.getenv("CONVEX_URL", "")
INGEST_TOKEN = os.getenv("PRHRAN_INGEST_TOKEN", "")

# Store URLs - glavne kategorije
STORES = {
    "Spar": {
        "base_url": "https://www.spar.si",
        "categories": [
            "/online/sadje-in-zelenjava/c/F01",
            "/online/mlecni-izdelki-in-jajca/c/F02",
            "/online/meso-in-mesni-izdelki/c/F03",
            "/online/kruh-in-pecivo/c/F04",
            "/online/zamrznjeni-izdelki/c/F05",
            "/online/pijace/c/F06",
            "/online/osnovne-zivila/c/F07",
            "/online/prigrizki-in-sladkarije/c/F08",
            "/online/ciscenje-in-gospodinjstvo/c/F09",
            "/online/osebna-nega/c/F10",
        ],
    },
    "Mercator": {
        "base_url": "https://trgovina.mercator.si",
        "categories": [
            "/sadje-in-zelenjava",
            "/mlecni-izdelki",
            "/meso-ribe-delikatesa",
            "/kruh-in-pecivo",
            "/zamrznjeno",
            "/pijace",
            "/zivila",
            "/sladkarije-prigrizki",
            "/cistila-gospodinjstvo",
            "/osebna-nega",
        ],
    },
    "Tus": {
        "base_url": "https://www.hitrinakup.si",
        "categories": [
            "/kategorija/sadje-zelenjava",
            "/kategorija/mlecni-izdelki",
            "/kategorija/meso-ribe",
            "/kategorija/kruh-pecivo",
            "/kategorija/zamrznjeno",
            "/kategorija/pijace",
            "/kategorija/zivila",
            "/kategorija/sladkarije",
            "/kategorija/cistila",
            "/kategorija/osebna-nega",
        ],
    },
}

# Selektorji za vsako trgovino (iz content.js)
STORE_SELECTORS = {
    "Spar": [
        '[class*="product-tile"]',
        '[class*="product-card"]',
        '[class*="ProductTile"]',
        ".tileOffer",
        '[class*="offer"]',
        ".flyerItem",
        '[class*="flyer"]',
        '[class*="leaflet"]',
        'article[class*="product"]',
        ".product",
        "[data-product]",
        '[itemtype*="Product"]',
        "article",
        '[class*="card"]',
    ],
    "Mercator": [
        ".product-box",
        ".product-item",
        ".box.product",
        "[data-product-id]",
        "[data-sku]",
        ".grid-item",
        ".catalog-item",
        ".category-item",
        ".box:not(.banner):not(.delimiter)",
    ],
    "Tus": [
        '[class*="itemCardWrapper"]',
        'a[class*="itemCardWrapper"]',
        '[class*="ItemCardWrapper"]',
        '[class*="itemCard"]',
        '[class*="ItemCard"]',
    ],
}

# Selektorji za cene
PRICE_SELECTORS = [
    '[class*="price"]',
    '[class*="cena"]',
    ".price",
    ".cena",
    "[data-price]",
]

# Selektorji za slike
IMAGE_SELECTORS = [
    'img[src*="product"]',
    "img[data-src]",
    "img[src]",
    "img",
]

# Scraping settings
MAX_PAGES_PER_CATEGORY = 50
SCROLL_PAUSE_TIME = 1.5  # sekund
REQUEST_DELAY = 0.5  # sekund med requesti

# ==================== GOOGLE SHEETS ====================
# ID-ji so iz URL-ja: docs.google.com/spreadsheets/d/{ID}/edit

GOOGLE_SHEETS = {
    "mercator": "1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0",
    "spar": "1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok",
    "tus": "17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A",
}

# Credentials file za Google Sheets API
GOOGLE_CREDENTIALS_FILE = "credentials.json"
