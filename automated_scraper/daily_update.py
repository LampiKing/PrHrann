#!/usr/bin/env python3
"""
🇸🇮 DNEVNA POSODOBITEV - Posodobi samo spremenjene cene
Zažene se vsak dan ob 21:00 (nastavi v cron)
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
if not os.path.exists(CREDENTIALS_FILE):
    fallback_credentials = os.path.join(os.path.dirname(__file__), "credentials.json")
    if os.path.exists(fallback_credentials):
        CREDENTIALS_FILE = fallback_credentials
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


def parse_price(text: str) -> float:
    """Parsaj ceno"""
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


def spar_fetch_products_for_category(category_ref: str, fallback_name: str) -> List[Dict]:
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
            name = normalize_product_name(str(item.get("name") or ""))
            price = parse_price(item.get("price"))
            if not name or price <= 0:
                continue
            products.append({
                "name": name,
                "price": price,
                "sale_price": None,
                "store": "Spar",
                "category": category_name,
            })
        pages = root.get("pagination", {}).get("pages") or 1
        if current_page >= pages:
            break
        current_page += 1
    return products


def scrape_spar_products() -> List[Dict]:
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


def tus_fetch_products_for_category(category_name: str, headers: Dict[str, str], store_date: str) -> List[Dict]:
    products: List[Dict] = []
    seen_item_ids: set[str] = set()
    skip = 0

    while True:
        variables = {
            "categoriesLimit": TUS_CATEGORIES_LIMIT,
            "categoryName": category_name,
            "cypherQuery": TUS_CYPHER_SUBCATEGORIES,
            "date": store_date,
            "limit": TUS_ITEMS_LIMIT,
            "skip": skip,
            "storeId": TUS_STORE_ID,
        }
        data = tus_graphql("getSubcategoriesWithItems", TUS_SUBCATEGORIES_ITEMS_QUERY, variables, headers)
        subcategories = data.get("getSubcategoriesWithItems") or []
        batch_added = 0

        for subcategory in subcategories:
            subcategory_name = subcategory.get("name") or category_name
            for item in subcategory.get("items") or []:
                item_id = str(item.get("itemId") or "").strip()
                if item_id and item_id in seen_item_ids:
                    continue
                name = normalize_product_name(item.get("displayName") or item.get("name") or "")
                price = parse_price(item.get("price"))
                sale_price = item.get("discountedPrice")
                sale_price = parse_price(sale_price) if sale_price is not None else None
                if not name or price <= 0:
                    continue
                if sale_price is not None and sale_price >= price:
                    sale_price = None
                if item_id:
                    seen_item_ids.add(item_id)
                products.append({
                    "name": name,
                    "price": price,
                    "sale_price": sale_price,
                    "store": "Tus",
                    "category": subcategory_name,
                })
                batch_added += 1

        if batch_added == 0:
            break
        skip += TUS_ITEMS_LIMIT

    return products


def scrape_tus_products() -> List[Dict]:
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
            )
            products.extend(category_products)
            print(len(category_products))
        except Exception as exc:
            print(f"error {exc}")
    return products


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

def normalize_product_name(value: str) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


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


async def get_mercator_categories(page) -> List[str]:
    """Poskusi dinamično prebrati vse Mercator kategorije; fallback na statični seznam."""
    try:
        await page.goto("https://mercatoronline.si/brskaj", wait_until="networkidle", timeout=60000)
        await asyncio.sleep(2)
        hrefs = await page.eval_on_selector_all(
            "a[href*='/brskaj/']",
            "els => els.map(e => e.getAttribute('href'))"
        )
        categories: List[str] = []
        for href in hrefs:
            if not href or "/brskaj/" not in href:
                continue
            slug = href.split("/brskaj/")[-1].split("?")[0].strip("/")
            if not slug or slug == "#":
                continue
            if slug not in categories:
                categories.append(slug)
        page_html = await page.content()
        for slug in re.findall(r"/brskaj/([a-z0-9-]+)", page_html, flags=re.IGNORECASE):
            slug = slug.strip().lower()
            if not slug or slug == "#":
                continue
            if slug not in categories:
                categories.append(slug)
        if categories:
            print(f"  Mercator kategorije: {len(categories)} najdenih (dinamicno)")
            merged = categories + [c for c in ALL_CATEGORIES.get("mercator", []) if c not in categories]
            return merged
    except Exception as e:
        print(f"  Mercator kategorije (fallback na statiko): {e}")
    return ALL_CATEGORIES.get("mercator", [])


async def scrape_mercator_category(page, category: str) -> List[Dict]:
    """Scrape Mercator – scroll until no new products are found."""
    products: List[Dict] = []
    seen_keys: set[str] = set()
    try:
        url = f"https://mercatoronline.si/brskaj/{category}"
        await page.goto(url, wait_until="networkidle", timeout=60000)
        await asyncio.sleep(2)

        async def collect_products():
            elements = await page.eval_on_selector_all(
                ".product",
                """
                els => els.map(el => {
                  const getText = (selector) => {
                    const node = el.querySelector(selector);
                    return node ? node.textContent : "";
                  };
                  const getAttr = (selector, attr) => {
                    const node = el.querySelector(selector);
                    return node ? node.getAttribute(attr) : "";
                  };
                  return {
                    name: getText(".lib-product-name, .product-name, .product__name, .product-card__name, .product-title"),
                    price: getText(".lib-product-price, .product-price-holder .price, .price, .product__price, .price__value, .product-price"),
                    oldPrice: getText(".price-old, .lib-product-normal-price, .price--old, .product__old-price"),
                    href: getAttr("a[href]", "href"),
                    sku: el.getAttribute("data-product-id") || el.getAttribute("data-id") || el.getAttribute("data-sku"),
                  };
                })
                """
            )
            added = 0
            for item in elements:
                name = normalize_product_name(str(item.get("name") or ""))
                if not name:
                    continue
                key = str(item.get("sku") or item.get("href") or name.lower()).strip()
                if not key or key in seen_keys:
                    continue
                base_price = parse_price(str(item.get("price") or ""))
                if base_price <= 0:
                    continue
                old_price = parse_price(str(item.get("oldPrice") or ""))
                if old_price and old_price > base_price:
                    price = old_price
                    sale_price = base_price
                else:
                    price = base_price
                    sale_price = None
                seen_keys.add(key)
                products.append({
                    "name": name,
                    "price": price,
                    "sale_price": sale_price,
                    "store": "Mercator",
                    "category": category,
                })
                added += 1
            return added

        await collect_products()
        stable_iterations = 0
        last_unique = len(seen_keys)
        for _ in range(60):
            await page.evaluate("window.scrollBy(0, 1800)")
            await asyncio.sleep(0.7)
            await collect_products()
            if len(seen_keys) <= last_unique:
                stable_iterations += 1
            else:
                stable_iterations = 0
            last_unique = len(seen_keys)
            if stable_iterations >= 4:
                break
    except Exception as e:
        print(f"  Mercator category '{category}' failed: {e}")

    return products


async def scrape_all_products(stores_filter: Optional[set[str]] = None):
    """Scrape vse izdelke; optional filter e.g. {'mercator'}."""
    print(f"Cas: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Scraping...\n")

    all_products: List[Dict] = []
    filter_active = bool(stores_filter)

    if not filter_active or "spar" in (stores_filter or set()):
        print("SPAR")
        spar_products = scrape_spar_products()
        all_products.extend(spar_products)
        print(f"  SPAR total: {len(spar_products)}")
    else:
        print("SPAR preskocen (filter)")

    if not filter_active or "tus" in (stores_filter or set()):
        print("TUS")
        tus_products = scrape_tus_products()
        all_products.extend(tus_products)
        print(f"  TUS total: {len(tus_products)}")
    else:
        print("TUS preskocen (filter)")

    if not filter_active or "mercator" in (stores_filter or set()):
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            )
            try:
                print("Mercator", end=" ", flush=True)
                page_mercator = await context.new_page()
                mercator_categories = await get_mercator_categories(page_mercator)
                mercator_products: List[Dict] = []
                for category in mercator_categories:
                    category_products = await scrape_mercator_category(page_mercator, category)
                    mercator_products.extend(category_products)
                all_products.extend(mercator_products)
                await page_mercator.close()
                print(f"{len(mercator_products)}")
            finally:
                await browser.close()
    else:
        print("Mercator preskocen (filter)")

    return all_products


def update_google_sheet(new_products: List[Dict]):
    """Posodobi samo spremenjene cene v Google Sheet"""
    print("\n📊 Posodabljam Google Sheet...")
    
    try:
        # Povezava
        scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        
        creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
        client = gspread.authorize(creds)
        sheet = client.open_by_key(SHEET_ID).sheet1
        
        # Preberi obstoječe podatke
        print("  📖 Berem obstoječe podatke...")
        existing_data = sheet.get_all_records()
        
        # Ustvari lookup dict (ime+trgovina -> row index)
        lookup = {}
        for idx, row in enumerate(existing_data, start=2):  # start=2 ker je row 1 header
            row_name = normalize_product_name(str(row.get("Ime izdelka", "")))
            row_store = normalize_store(str(row.get("Trgovina", "")))
            key = f"{row_name}_{row_store}"
            lookup[key] = {
                'index': idx,
                'price': row['Cena'],
                'sale_price': row.get('Akcijska cena', '')
            }
        
        # Pripravi batch posodobitve
        updates = []
        new_items = []
        unchanged = 0
        date_str = datetime.now().strftime("%Y-%m-%d")
        
        print("  🔍 Preverjam spremembe...")
        
        for product in new_products:
            store_name = normalize_store(product.get("store", ""))
            key = f"{product['name']}_{store_name}"
            
            if key in lookup:
                # Izdelek obstaja - preveri ceno
                old = lookup[key]
                new_price = product['price']
                new_sale = normalize_sale_price(new_price, product.get("sale_price")) or ""
                
                # Ali se je spremenila cena?
                price_changed = (new_price != old['price'])
                sale_changed = (new_sale != old['sale_price'])
                
                if price_changed or sale_changed:
                    # Posodobi ceno
                    row_idx = old['index']
                    updates.append({
                        'range': f'B{row_idx}:E{row_idx}',
                        'values': [[new_price, new_sale, store_name, date_str]]
                    })
                else:
                    unchanged += 1
            else:
                # Nov izdelek - dodaj
                new_items.append([
                    product['name'],
                    product['price'],
                    normalize_sale_price(product['price'], product.get('sale_price')) or "",
                    store_name,
                    date_str
                ])
        
        # Izvedi posodobitve
        if updates:
            print(f"  ✏️  Posodabljam {len(updates)} izdelkov...")
            sheet.batch_update(updates)
        
        if new_items:
            print(f"  ➕ Dodajam {len(new_items)} novih izdelkov...")
            sheet.append_rows(new_items)
        
        # Statistika
        print(f"\n📊 REZULTAT:")
        print(f"  ✅ Posodobljenih: {len(updates)}")
        print(f"  ➕ Dodanih: {len(new_items)}")
        print(f"  ⏭️  Nespremenjenih: {unchanged}")
        print(f"  📦 Skupaj obdelanih: {len(new_products)}")
        
    except FileNotFoundError:
        print(f"❌ {CREDENTIALS_FILE} ne obstaja!")
    except Exception as e:
        print(f"❌ Napaka: {e}")


def dedupe_items(items: List[Dict]) -> List[Dict]:
    deduped: Dict[str, Dict] = {}
    for item in items:
        name = normalize_product_name(str(item.get("name") or ""))
        store = normalize_store(str(item.get("store") or ""))
        if not name or not store:
            continue
        key = f"{name.lower()}::{store.lower()}"
        existing = deduped.get(key)
        if not existing:
            item["name"] = name
            item["store"] = store
            deduped[key] = item
            continue

        if not existing.get("sale_price") and item.get("sale_price"):
            existing["sale_price"] = item.get("sale_price")
        if (existing.get("category") in ("", "Unknown", "Neznana kategorija")) and item.get("category"):
            existing["category"] = item.get("category")
        if item.get("price") and item.get("price") > 0 and existing.get("price") != item.get("price"):
            existing["price"] = item.get("price")

    return list(deduped.values())


def build_convex_items(products: List[Dict]) -> List[Dict]:
    items = []
    for product in products:
        name = normalize_product_name(str(product.get("name", "")))
        if not name:
            continue
        store_name = normalize_store(product.get("store", ""))
        price = product.get("price")
        if not store_name or not price or price <= 0:
            continue
        sale_price = normalize_sale_price(price, product.get("sale_price"))
        items.append({
            "ime": name,
            "redna_cena": price,
            "akcijska_cena": sale_price,
            "kategorija": format_category(product.get("category", ""), name),  # ← Dodaj product name
            "trgovina": store_name,
        })
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
    parser = argparse.ArgumentParser(description="Dnevna posodobitev cen.")
    parser.add_argument("--no-upload", action="store_true", help="NE pošlji podatkov v Convex (samo Google Sheets).")
    parser.add_argument(
        "--stores",
        type=str,
        default="spar,tus,mercator",
        help="Seznam trgovin (comma). Primer: --stores=mercator ali --stores=spar,tus",
    )
    parser.add_argument(
        "--mercator-only",
        action="store_true",
        help="Bliznjica za --stores=mercator (za testiranje Mercator scraperja).",
    )
    return parser.parse_args()


async def main(upload: bool, stores: set[str]):
    """Glavna funkcija"""
    print("\n" + "=" * 80)
    print("DNEVNA POSODOBITEV CEN")
    print("=" * 80)

    # Scrape
    products = await scrape_all_products(stores)
    deduped_products = dedupe_items(products)
    if len(deduped_products) != len(products):
        print(f"Deduped products: {len(products)} -> {len(deduped_products)}")
    products = deduped_products
    
    if products:
        # Posodobi Sheet
        update_google_sheet(products)
        # Upload v Convex (privzeto vključeno)
        if not upload:
            items = build_convex_items(products)
            upload_to_convex(items)
        else:
            print("\n⚠️  Upload v Convex preskočen (--no-upload flag)")
        print("\n✅ Posodobitev končana!")
    else:
        print("\n❌ Ni zbranih izdelkov!")

    print("=" * 80 + "\n")


if __name__ == "__main__":
    args = parse_args()
    if args.mercator_only:
        stores_filter = {"mercator"}
    else:
        stores_filter = {store.strip().lower() for store in args.stores.split(",") if store.strip()}
    asyncio.run(main(args.no_upload, stores_filter))
