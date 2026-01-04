#!/usr/bin/env python3
"""
🇸🇮 PRVI ZAGON - Scrape VSE izdelke in vpiši v Google Sheet
Enkratna akcija - pridobi ~15.000+ izdelkov
"""

import argparse
import asyncio
import os
import sys
import uuid
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime
from playwright.async_api import async_playwright
import re
import unicodedata
from typing import List, Dict, Optional
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# KONFIGURACIJA
SHEET_ID = os.getenv("PRHRAN_SHEET_ID", "1Wj5nqFcd6isnTA_FTgyA7aTRU6tHfTJG3fGGEN15B6Y")
CREDENTIALS_FILE = os.getenv("PRHRAN_CREDENTIALS_FILE", "credentials.json")
INGEST_URL = os.getenv("PRHRAN_INGEST_URL")
INGEST_TOKEN = os.getenv("PRHRAN_INGEST_TOKEN")
SITE_URL = os.getenv("SITE_URL")
if not INGEST_URL and SITE_URL:
    INGEST_URL = f"{SITE_URL.rstrip('/')}/api/ingest/grocery"

SPAR_API_URL = os.getenv("SPAR_API_URL", "https://deadpool.unified-jennet.instaleap.io/api/v3")
SPAR_CLIENT_ID = os.getenv("SPAR_CLIENT_ID", "SPAR_SLOVENIA")
SPAR_STORE_REFERENCE = os.getenv("SPAR_STORE_REFERENCE", "81701")
SPAR_PAGE_SIZE = int(os.getenv("SPAR_PAGE_SIZE", "200"))

TUS_API_URL = os.getenv("TUS_API_URL", "https://hitrinakup.com/graphql")
TUS_STORE_ID = os.getenv("TUS_STORE_ID", "5861")
TUS_APP_VERSION = os.getenv("TUS_APP_VERSION", "0.4.32")
TUS_CYPHER_CATEGORIES = os.getenv("TUS_CYPHER_CATEGORIES", "2d078df3-117a-4b05-be35-cfb99105fb77")
TUS_CYPHER_SUBCATEGORIES = os.getenv("TUS_CYPHER_SUBCATEGORIES", "3a4d5cb9-52a9-4446-8d2b-6a8f93282934")
TUS_CATEGORIES_LIMIT = int(os.getenv("TUS_CATEGORIES_LIMIT", "200"))
TUS_ITEMS_LIMIT = int(os.getenv("TUS_ITEMS_LIMIT", "500"))

SPAR_CATEGORY_QUERY = """
query getCategory($getCategoryInput: GetCategoryInput!) {
  getCategory(getCategoryInput: $getCategoryInput) {
    name
    reference
    slug
    path
    subCategories {
      name
      reference
      slug
      path
      subCategories {
        name
        reference
        slug
        path
        subCategories {
          name
          reference
          slug
          path
          subCategories {
            name
            reference
            slug
            path
          }
        }
      }
    }
  }
}
"""

SPAR_PRODUCTS_QUERY = """
query getProductsByCategory($getProductsByCategoryInput: GetProductsByCategoryInput!) {
  getProductsByCategory(getProductsByCategoryInput: $getProductsByCategoryInput) {
    category {
      name
      products {
        name
        price
        unit
      }
    }
    pagination {
      pages
    }
  }
}
"""

TUS_API_VERSION_QUERY = "query getApiVersion { getApiVersion }"

TUS_CREATE_SESSION_MUTATION = """
mutation createSession($userId: String!, $uri: String!, $agent: String!, $url: String, $prevSessionId: String, $code: String, $version: String) {
  createSession(
    userId: $userId
    uri: $uri
    agent: $agent
    url: $url
    prevSessionId: $prevSessionId
    code: $code
    version: $version
  ) {
    id
    date
    agent
    __typename
  }
}
"""

TUS_CATEGORIES_QUERY = """
query getCategories($userId: String, $limit: Int, $cypherQuery: String) {
  getCategories(userId: $userId, limit: $limit, cypherQuery: $cypherQuery) {
    name
    key
    image
    children {
      name
      key
      children {
        name
        key
        __typename
      }
      __typename
    }
    __typename
  }
}
"""

TUS_SUBCATEGORIES_ITEMS_QUERY = """
query getSubcategoriesWithItems($categoriesLimit: Int, $categoryName: String, $cypherQuery: String, $date: String, $limit: Int, $skip: Int, $storeId: String) {
  getSubcategoriesWithItems(
    categoriesLimit: $categoriesLimit
    categoryName: $categoryName
    cypherQuery: $cypherQuery
    date: $date
    limit: $limit
    skip: $skip
    storeId: $storeId
  ) {
    name
    items {
      itemId
      name
      displayName
      price
      discountedPrice
    }
  }
}
"""

# Vse kategorije za vse trgovine
ALL_CATEGORIES = {
    "spar": [
        "sadje-zelenjava", "mleko-mlecni-izdelki", "meso-ribe", "kruh-pecivo",
        "pijace", "sladkarije-prigrizki", "konzervirano", "zamrznjeno", "osnovna-zivila",
        "zajtrk-kosmiči", "brezalkoholne-pijace", "alkoholne-pijace"
    ],
    "tus": [
        "sadje-zelenjava", "mleko-jajca", "meso-mesni-izdelki", "pecivo-kruh",
        "pijace", "sladkarije", "konzerve", "zamrznjeni-izdelki", "zivila",
        "zajtrk", "higiena", "ciscila"
    ],
    "mercator": [
        "sadje-in-zelenjava", "mleko-jajca", "meso-ribe", "kruh-pecivo",
        "pijace", "sladkarije", "konzerve", "zamrznjeno", "osnovna-zivila",
        "zajtrk", "kosmetika", "ciscenje", "hrana-zivali"
    ]
}


def normalize_store(value: str) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized.lower()).strip()
    if "spar" in normalized:
        return "Spar"
    if "mercator" in normalized:
        return "Mercator"
    if "tus" in normalized or "hitri" in normalized or normalized.startswith("tu"):
        return "Tus"
    return value.strip()


def format_category(value: str, product_name: str = "") -> str:
    """
    Formatira kategorijo in poskuša ugotoviti kategorijo iz imena izdelka,
    če kategorija ni podana.
    """
    if value:
        # Če imamo kategorijo, jo samo formatiraj
        return value.replace("-", " ").replace("_", " ").title()

    # Če kategorija manjka, poskusi ugotoviti iz imena izdelka
    name_lower = product_name.lower()

    # MLEČNI IZDELKI
    if any(word in name_lower for word in ["mleko", "jogurt", "sir", "maslo", "skuta", "smetana", "kefir", "ml milk", "cheese", "butter", "cream"]):
        return "Mlečni izdelki"

    # ČOKOLADA IN SLADKARIJE
    if any(word in name_lower for word in ["čokolada", "milka", "nutella", "kinder", "chocolate", "bonbon", "gumi", "sweet", "candy", "kokice"]):
        return "Sladkarije"

    # MESO
    if any(word in name_lower for word in ["meso", "piščanec", "govedina", "svinjina", "prsut", "salama", "meat", "chicken", "beef", "pork", "salami"]):
        return "Meso in mesni izdelki"

    # SADJE IN ZELENJAVA
    if any(word in name_lower for word in ["banana", "jabolko", "pomaranča", "paradižnik", "krompir", "solata", "paprika", "fruit", "vegetable", "sadje", "zelenjava"]):
        return "Sadje in zelenjava"

    # KRUH IN PEČIVO
    if any(word in name_lower for word in ["kruh", "bread", "žemlja", "toast", "burek", "croissant", "pekov"]):
        return "Kruh in pečivo"

    # PIJAČE
    if any(word in name_lower for word in ["sok", "juice", "cola", "pepsi", "fanta", "voda", "water", "pivo", "beer", "vino", "wine", "čaj", "tea", "kava", "coffee"]):
        return "Pijače"

    # KOSMIČI IN ZAJTRK
    if any(word in name_lower for word in ["kosmiči", "cereals", "müsli", "muesli", "ovseni"]):
        return "Kosmiči in zajtrk"

    # TESTENINE IN RIŽ
    if any(word in name_lower for word in ["testenine", "pasta", "špageti", "riž", "rice", "makaroni"]):
        return "Testenine in riž"

    # KONZERVE
    if any(word in name_lower for word in ["konzerva", "tuna", "fižol", "grah", "paradižnik", "canned"]):
        return "Konzervirani izdelki"

    # ZAMRZNJENI IZDELKI
    if any(word in name_lower for word in ["zmrzal", "frozen", "sladoled", "ice cream", "pica"]):
        return "Zamrznjeni izdelki"

    # SNACKS
    if any(word in name_lower for word in ["čips", "chips", "smoki", "flips", "snack"]):
        return "Prigrizki"

    # HIGIENA
    if any(word in name_lower for word in ["šampon", "gel", "zobna", "pasta", "milo", "soap", "shampoo"]):
        return "Higiena"

    # ČISTILA
    if any(word in name_lower for word in ["čistilo", "detergent", "pralno", "mehčalec", "cleaner"]):
        return "Čistila"

    # Default če ne najdemo nič
    return "Ostalo"


def normalize_sale_price(price: float, sale_price: Optional[float]) -> Optional[float]:
    if sale_price is None:
        return None
    return sale_price if sale_price < price else None


class Product:
    def __init__(self, name: str, price: float, sale_price: Optional[float], 
                 store: str, category: str, date: str):
        self.name = name.strip()
        self.price = price
        self.sale_price = sale_price
        self.store = store
        self.category = category
        self.date = date
    
    def to_row(self) -> List:
        """Vrne vrstico za Google Sheet"""
        return [
            self.name,
            self.price,
            self.sale_price if self.sale_price else "",
            self.store,
            self.date
        ]

    def to_convex_item(self) -> Dict:
        """Vrne zapis za Convex ingest."""
        return {
            "ime": self.name,
            "redna_cena": self.price,
            "akcijska_cena": normalize_sale_price(self.price, self.sale_price),
            "kategorija": format_category(self.category, self.name),  # ← Dodaj product name
            "trgovina": normalize_store(self.store),
        }


def parse_price(text: str) -> float:
    """Parsaj ceno iz teksta"""
    if isinstance(text, (int, float)):
        return float(text)
    if not text:
        return 0.0
    try:
        text = text.replace("€", "").replace("EUR", "").strip()
        text = text.replace(",", ".")
        match = re.search(r'\d+\.?\d*', text)
        return float(match.group()) if match else 0.0
    except:
        return 0.0


def spar_graphql(query: str, variables: Dict) -> Dict:
    response = requests.post(
        SPAR_API_URL,
        json={"query": query, "variables": variables},
        timeout=60,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("errors"):
        raise RuntimeError(payload["errors"])
    return payload.get("data") or {}


def spar_fetch_leaf_categories() -> List[Dict[str, str]]:
    variables = {
        "getCategoryInput": {
            "clientId": SPAR_CLIENT_ID,
            "storeReference": SPAR_STORE_REFERENCE,
        }
    }
    data = spar_graphql(SPAR_CATEGORY_QUERY, variables)
    categories = data.get("getCategory") or []
    leaves = []
    stack = list(categories)
    while stack:
        category = stack.pop()
        subcategories = category.get("subCategories") or []
        if subcategories:
            stack.extend(subcategories)
            continue
        reference = category.get("reference")
        name = category.get("name")
        if reference and name:
            leaves.append({"reference": reference, "name": name})
    return leaves


def spar_fetch_products_for_category(category_ref: str, fallback_name: str, date_str: str) -> List[Product]:
    products = []
    current_page = 1
    while True:
        variables = {
            "getProductsByCategoryInput": {
                "clientId": SPAR_CLIENT_ID,
                "storeReference": SPAR_STORE_REFERENCE,
                "categoryReference": category_ref,
                "pageSize": SPAR_PAGE_SIZE,
                "currentPage": current_page,
            }
        }
        data = spar_graphql(SPAR_PRODUCTS_QUERY, variables)
        root = data.get("getProductsByCategory") or {}
        category = root.get("category") or {}
        category_name = category.get("name") or fallback_name
        items = category.get("products") or []
        for item in items:
            name = str(item.get("name") or "").strip()
            price = parse_price(item.get("price"))
            if not name or price <= 0:
                continue
            products.append(Product(name, price, None, "Spar", category_name, date_str))
        pages = root.get("pagination", {}).get("pages") or 1
        if current_page >= pages:
            break
        current_page += 1
    return products


def scrape_spar_products(date_str: str) -> List[Product]:
    products = []
    try:
        categories = spar_fetch_leaf_categories()
    except Exception as exc:
        print(f"  SPAR categories error: {exc}")
        return products
    seen = set()
    for category in categories:
        ref = category.get("reference")
        if not ref or ref in seen:
            continue
        seen.add(ref)
        name = category.get("name") or "Unknown"
        safe_name = name.encode("ascii", "ignore").decode("ascii") or "Category"
        print(f"  -> SPAR/{safe_name}...", end=" ", flush=True)
        try:
            category_products = spar_fetch_products_for_category(
                category["reference"],
                name,
                date_str,
            )
            products.extend(category_products)
            print(len(category_products))
        except Exception as exc:
            print(f"error {exc}")
    return products


def tus_graphql(operation_name: str, query: str, variables: Dict, headers: Optional[Dict] = None) -> Dict:
    payload = {
        "operationName": operation_name,
        "query": query,
        "variables": variables,
    }
    response = requests.post(
        TUS_API_URL,
        json=payload,
        headers=headers,
        timeout=60,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("errors"):
        raise RuntimeError(payload["errors"])
    return payload.get("data") or {}


def tus_get_api_version() -> str:
    data = tus_graphql("getApiVersion", TUS_API_VERSION_QUERY, {})
    return data.get("getApiVersion") or ""


def tus_create_session() -> str:
    variables = {
        "userId": str(uuid.uuid4()),
        "uri": "hitrinakup.com",
        "agent": "Mozilla/5.0",
        "url": "https://hitrinakup.com/",
        "prevSessionId": None,
        "code": None,
        "version": TUS_APP_VERSION,
    }
    data = tus_graphql("createSession", TUS_CREATE_SESSION_MUTATION, variables)
    session = data.get("createSession") or {}
    return session.get("id") or ""


def tus_build_headers(session_id: str, api_version: str, store_date: str) -> Dict[str, str]:
    headers = {
        "sessionId": session_id,
        "apiVersion": api_version,
    }
    if store_date:
        headers["cookie"] = f"storeID={TUS_STORE_ID}; storeDate={store_date}"
    return headers


def tus_fetch_categories(headers: Dict[str, str]) -> List[Dict]:
    variables = {
        "userId": "",
        "limit": 0,
        "cypherQuery": TUS_CYPHER_CATEGORIES,
    }
    data = tus_graphql("getCategories", TUS_CATEGORIES_QUERY, variables, headers)
    return data.get("getCategories") or []


def tus_fetch_products_for_category(
    category_name: str,
    headers: Dict[str, str],
    store_date: str,
    date_str: str,
) -> List[Product]:
    variables = {
        "categoriesLimit": TUS_CATEGORIES_LIMIT,
        "categoryName": category_name,
        "cypherQuery": TUS_CYPHER_SUBCATEGORIES,
        "date": store_date,
        "limit": TUS_ITEMS_LIMIT,
        "skip": 0,
        "storeId": TUS_STORE_ID,
    }
    data = tus_graphql("getSubcategoriesWithItems", TUS_SUBCATEGORIES_ITEMS_QUERY, variables, headers)
    subcategories = data.get("getSubcategoriesWithItems") or []
    products = []
    for subcategory in subcategories:
        subcategory_name = subcategory.get("name") or category_name
        for item in subcategory.get("items") or []:
            name = item.get("displayName") or item.get("name")
            name = str(name or "").strip()
            price = parse_price(item.get("price"))
            sale_price = item.get("discountedPrice")
            sale_price = parse_price(sale_price) if sale_price is not None else None
            if not name or price <= 0:
                continue
            if sale_price is not None and sale_price >= price:
                sale_price = None
            products.append(Product(name, price, sale_price, "Tus", subcategory_name, date_str))
    return products


def scrape_tus_products(date_str: str) -> List[Product]:
    products = []
    try:
        api_version = tus_get_api_version()
        session_id = tus_create_session()
        store_date = datetime.now().strftime("%a %b %d %Y")
        headers = tus_build_headers(session_id, api_version, store_date)
        categories = tus_fetch_categories(headers)
    except Exception as exc:
        print(f"  TUS setup error: {exc}")
        return products

    seen = set()
    for category in categories:
        name = category.get("name")
        if not name or name in seen:
            continue
        seen.add(name)
        safe_name = name.encode("ascii", "ignore").decode("ascii") or "Category"
        print(f"  -> TUS/{safe_name}...", end=" ", flush=True)
        try:
            category_products = tus_fetch_products_for_category(
                name,
                headers,
                store_date,
                date_str,
            )
            products.extend(category_products)
            print(len(category_products))
        except Exception as exc:
            print(f"error {exc}")
    return products


async def scrape_mercator_category(page, category: str) -> List[Product]:
    """Scrape Mercator kategorijo"""
    products = []
    date_str = datetime.now().strftime("%Y-%m-%d")

    try:
        url = f"https://mercatoronline.si/brskaj/{category}"
        print(f"  📂 Mercator/{category}...", end=" ", flush=True)

        await page.goto(url, wait_until="networkidle", timeout=60000)
        await asyncio.sleep(2)

        for _ in range(10):
            await page.evaluate("window.scrollBy(0, 1500)")
            await asyncio.sleep(0.5)

        elements = await page.query_selector_all(".product")

        for element in elements:
            try:
                name_elem = await element.query_selector(".lib-product-name, .product-name")
                if not name_elem:
                    continue
                name = (await name_elem.inner_text()).strip()

                price_elem = await element.query_selector(".lib-product-price")
                if not price_elem:
                    price_elem = await element.query_selector(".product-price-holder .price")
                if not price_elem:
                    price_elem = await element.query_selector(".price")
                if not price_elem:
                    continue
                base_price = parse_price(await price_elem.inner_text())

                if base_price <= 0:
                    continue

                sale_price = None
                old_price = None
                sale_elem = await element.query_selector(".price-old, .lib-product-normal-price")
                if sale_elem:
                    old_price = parse_price(await sale_elem.inner_text())
                if old_price and old_price > base_price:
                    price = old_price
                    sale_price = base_price
                else:
                    price = base_price

                products.append(Product(name, price, sale_price, "Mercator", category, date_str))
            except:
                continue

        print(f"✅ {len(products)}")
    except Exception as e:
        print(f"❌ {e}")

    return products


async def scrape_all_products():
    """Scrape VSE izdelke iz VSEH trgovin"""
    print("\n" + "=" * 80)
    print("PRHRAN PRVI ZAGON - SCRAPING VSEH IZDELKOV")
    print("=" * 80)
    print(f"Cas: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    print("To bo trajalo 30-60 minut za ~15.000+ izdelkov!\n")

    all_products = []
    date_str = datetime.now().strftime("%Y-%m-%d")

    print("SPAR")
    print("-" * 80)
    spar_products = scrape_spar_products(date_str)
    all_products.extend(spar_products)
    print(f"  SPAR total: {len(spar_products)} products\n")

    print("TUS")
    print("-" * 80)
    tus_products = scrape_tus_products(date_str)
    all_products.extend(tus_products)
    print(f"  TUS total: {len(tus_products)} products\n")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        try:
            print("MERCATOR")
            print("-" * 80)
            page_mercator = await context.new_page()
            for category in ALL_CATEGORIES["mercator"]:
                products = await scrape_mercator_category(page_mercator, category)
                all_products.extend(products)
                await asyncio.sleep(2)
            await page_mercator.close()
            print(f"  Mercator total: {sum(1 for p in all_products if p.store == 'Mercator')} products\n")
        finally:
            await browser.close()

    return all_products


def write_to_google_sheet(products: List[Product]):
    """Vpiši vse izdelke v Google Sheet"""
    print("\n" + "=" * 80)
    print("📊 PISANJE V GOOGLE SHEET")
    print("=" * 80)
    
    try:
        # Povezava z Google Sheets
        scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        
        creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
        client = gspread.authorize(creds)
        
        # Odpri sheet
        sheet = client.open_by_key(SHEET_ID).sheet1
        
        # Počisti obstoječe podatke
        print("🧹 Čistim obstoječe podatke...")
        sheet.clear()
        
        # Header
        header = ["Ime izdelka", "Cena", "Akcijska cena", "Trgovina", "Datum"]
        values = [header] + [p.to_row() for p in products]
        total_rows = len(values)
        sheet.resize(rows=total_rows, cols=len(header))
        
        # Formatiraj header
        sheet.format('A1:E1', {
            'textFormat': {'bold': True},
            'backgroundColor': {'red': 0.2, 'green': 0.4, 'blue': 0.8}
        })
        
        print(f"📝 Pišem {len(products)} izdelkov...")
        
        # Vpiši v batch-ih (100 vrstic naenkrat za hitrost)
        max_rows_per_update = 5000
        for start in range(0, total_rows, max_rows_per_update):
            chunk = values[start:start + max_rows_per_update]
            start_row = start + 1
            sheet.update(
                range_name=f"A{start_row}",
                values=chunk,
                value_input_option="USER_ENTERED",
            )
            if total_rows > max_rows_per_update:
                print(f"  Wrote {min(start + max_rows_per_update, total_rows)}/{total_rows} rows")
        
        print(f"\n✅ USPEŠNO! Vpisanih {len(products)} izdelkov v Google Sheet")
        print(f"🔗 https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit")
        
    except FileNotFoundError:
        print(f"❌ NAPAKA: {CREDENTIALS_FILE} ne obstaja!")
        print("\n📝 NAVODILA:")
        print("1. Pojdi na: https://console.cloud.google.com/")
        print("2. Ustvari Service Account")
        print("3. Prenesi credentials.json v ta direktorij")
        print("4. 'Share' Google Sheet s Service Account emailom")
    except Exception as e:
        print(f"❌ NAPAKA: {e}")


def build_convex_items(products: List[Product]) -> List[Dict]:
    items = []
    for product in products:
        item = product.to_convex_item()
        if not item.get("trgovina") or not item.get("redna_cena"):
            continue
        if item["redna_cena"] <= 0:
            continue
        items.append(item)
    return items


def upload_to_convex(items: List[Dict]) -> None:
    if not INGEST_URL or not INGEST_TOKEN:
        print("Upload preskocen: manjka PRHRAN_INGEST_URL ali PRHRAN_INGEST_TOKEN.")
        return
    if not items:
        print("Upload preskocen: ni izdelkov za poslati.")
        return
    try:
        batch_size = int(os.getenv("PRHRAN_INGEST_BATCH_SIZE", "200"))
        total = len(items)
        for start in range(0, total, batch_size):
            batch = items[start:start + batch_size]
            response = requests.post(
                INGEST_URL,
                headers={
                    "Authorization": f"Bearer {INGEST_TOKEN}",
                    "Content-Type": "application/json",
                },
                json={"items": batch},
                timeout=120,
            )
            if not response.ok:
                detail = response.text[:300].replace('\n', ' ')
                print(f"Upload napaka (status {response.status_code}): {detail}")
                response.raise_for_status()
            if total > batch_size:
                print(f"  Uploaded {min(start + batch_size, total)}/{total}")
        print(f"Upload OK: {total}")
    except Exception as e:
        print(f"Upload napaka: {e}")


def parse_args():
    parser = argparse.ArgumentParser(description="Prvi zagon scrapanja.")
    parser.add_argument("--no-upload", action="store_true", help="NE pošlji podatkov v Convex (samo Google Sheets).")
    return parser.parse_args()


async def main(upload: bool):
    """Glavna funkcija"""
    
    # Scrape vse izdelke
    products = await scrape_all_products()
    
    # Izpiši statistiko
    print("\n" + "=" * 80)
    print("📊 STATISTIKA")
    print("=" * 80)
    print(f"📦 Skupaj izdelkov: {len(products)}")
    print(f"   • SPAR: {sum(1 for p in products if p.store == 'Spar')}")
    print(f"   • Tuš: {sum(1 for p in products if p.store == 'Tus')}")
    print(f"   • Mercator: {sum(1 for p in products if p.store == 'Mercator')}")
    print(f"🎁 Na akciji: {sum(1 for p in products if p.sale_price)}")
    
    if products:
        # Vpiši v Google Sheet
        write_to_google_sheet(products)
        # Upload v Convex (privzeto vključeno)
        if not upload:
            items = build_convex_items(products)
            upload_to_convex(items)
        else:
            print("\n⚠️  Upload v Convex preskočen (--no-upload flag)")
    else:
        print("\n❌ Ni zbranih izdelkov!")

    print("\n" + "=" * 80)
    print("✅ PRVI ZAGON KONČAN!")
    print("=" * 80)
    print("\n💡 Naslednji korak: Zaženi 'daily_update.py' za dnevno posodabljanje\n")


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(main(args.no_upload))
