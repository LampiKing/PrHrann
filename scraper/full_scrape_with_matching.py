"""
PR'HRAN - FULL SCRAPE + PRODUCT MATCHING
=========================================
1. Scrape VSE izdelke iz SPAR, MERCATOR, TUŠ
2. Image hashing za primerjavo slik
3. Product matching - poveži iste izdelke
4. Upload v Google Sheets
"""

import os
import sys
import json
import re
import hashlib
import requests
from datetime import datetime
from pathlib import Path
from collections import defaultdict
from difflib import SequenceMatcher

# Dodaj parent dir v path
sys.path.insert(0, str(Path(__file__).parent))

from playwright.sync_api import sync_playwright

# ============================================
# KONFIGURACIJA
# ============================================

STORES = ["spar", "mercator", "tus"]
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# ============================================
# UTILITY FUNKCIJE
# ============================================

def log(msg, level="INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {msg}")


def normalize_text(text: str) -> str:
    """Normaliziraj ime izdelka za primerjavo."""
    if not text:
        return ""

    # Lowercase
    text = text.lower().strip()

    # Odstrani posebne znake
    text = re.sub(r'[,\.\-\(\)\[\]\{\}\"\']+', ' ', text)

    # Normaliziraj enote
    text = re.sub(r'(\d+)\s*l\b', r'\1l', text)  # 1 l -> 1l
    text = re.sub(r'(\d+)\s*kg\b', r'\1kg', text)
    text = re.sub(r'(\d+)\s*g\b', r'\1g', text)
    text = re.sub(r'(\d+)\s*ml\b', r'\1ml', text)
    text = re.sub(r'(\d+)\s*cl\b', r'\1cl', text)

    # Normaliziraj decimalke
    text = re.sub(r'(\d+),(\d+)', r'\1.\2', text)

    # Odstrani večkratne presledke
    text = re.sub(r'\s+', ' ', text).strip()

    return text


def extract_brand_weight(text: str) -> dict:
    """Izvleči znamko in težo iz imena."""
    result = {
        "brand": None,
        "weight": None,
        "weight_normalized": None,
        "keywords": []
    }

    if not text:
        return result

    text_lower = text.lower()

    # Pogoste znamke
    brands = [
        "alpsko", "ljubljanske mlekarne", "z bregov", "mu", "ego",
        "pomurske", "celeia", "kranjska", "poli", "argeta", "droga kolinska",
        "natureta", "podravka", "vindija", "dukat", "meggle", "president",
        "zott", "müller", "danone", "activia", "milka", "lindt", "milka",
        "nutella", "barilla", "de cecco", "rio mare", "nivea", "dove",
        "head & shoulders", "pantene", "always", "pampers", "huggies",
        "coca cola", "coca-cola", "pepsi", "fanta", "sprite", "schweppes",
        "union", "laško", "heineken", "hofer", "s-budget", "spar", "mercator",
        "tuš", "clever", "chef select", "pilos", "milbona"
    ]

    for brand in brands:
        if brand in text_lower:
            result["brand"] = brand
            break

    # Teža - regex patterns
    weight_patterns = [
        (r'(\d+(?:[.,]\d+)?)\s*kg\b', 'kg', 1000),  # kg -> g
        (r'(\d+(?:[.,]\d+)?)\s*g\b', 'g', 1),
        (r'(\d+(?:[.,]\d+)?)\s*l\b', 'l', 1000),    # l -> ml
        (r'(\d+(?:[.,]\d+)?)\s*ml\b', 'ml', 1),
        (r'(\d+(?:[.,]\d+)?)\s*cl\b', 'cl', 10),    # cl -> ml
        (r'(\d+(?:[.,]\d+)?)\s*dl\b', 'dl', 100),   # dl -> ml
    ]

    for pattern, unit, multiplier in weight_patterns:
        match = re.search(pattern, text_lower)
        if match:
            value = float(match.group(1).replace(',', '.'))
            result["weight"] = f"{match.group(1)}{unit}"
            result["weight_normalized"] = value * multiplier
            break

    # Ključne besede
    keywords = text_lower.split()
    # Odstrani kratke besede in številke
    keywords = [w for w in keywords if len(w) > 2 and not w.replace('.', '').replace(',', '').isdigit()]
    result["keywords"] = keywords[:5]  # Max 5 keywords

    return result


def similarity_score(text1: str, text2: str) -> float:
    """Izračunaj podobnost med dvema tekstoma (0-1)."""
    if not text1 or not text2:
        return 0.0
    return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()


def get_image_hash(url: str, timeout: int = 5) -> str:
    """Pridobi hash slike za primerjavo."""
    if not url:
        return ""

    try:
        # Uporabi samo URL path za hitro primerjavo
        # (prava image hash bi zahtevala download slike)
        from urllib.parse import urlparse
        parsed = urlparse(url)

        # Vzemi ime datoteke
        filename = parsed.path.split('/')[-1].split('?')[0]

        # Odstrani velikost/variante (npr. _small, _medium, _thumb)
        filename = re.sub(r'_(small|medium|large|thumb|sm|md|lg)\b', '', filename, flags=re.I)
        filename = re.sub(r'_\d+x\d+', '', filename)

        return filename.lower()
    except:
        return ""


# ============================================
# SCRAPING
# ============================================

def scrape_store(store_name: str) -> list:
    """Scrape vse izdelke iz ene trgovine."""
    log(f"Začenjam scraping: {store_name.upper()}")

    with sync_playwright() as p:
        # Headless mode za CI/CD (GitHub Actions), headed za lokalno
        is_ci = os.getenv("CI", "false").lower() == "true" or os.getenv("GITHUB_ACTIONS", "false").lower() == "true"
        browser = p.chromium.launch(headless=is_ci)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            locale="sl-SI",
        )
        context.set_default_timeout(60000)
        page = context.new_page()

        try:
            if store_name == "spar":
                from stores.spar import SparScraper
                scraper = SparScraper(page)
                products = scraper.scrape_all()

            elif store_name == "mercator":
                from stores.mercator import MercatorScraper
                scraper = MercatorScraper(page)
                products = scraper.scrape_all_simple()

            elif store_name == "tus":
                from stores.tus import TusScraper
                scraper = TusScraper(page)
                products = scraper.scrape_all()
            else:
                products = []

            log(f"{store_name.upper()}: {len(products)} izdelkov", "SUCCESS")
            return products

        except Exception as e:
            log(f"{store_name.upper()}: NAPAKA - {e}", "ERROR")
            return []
        finally:
            browser.close()


def scrape_all_stores() -> dict:
    """Scrape vse trgovine."""
    all_products = {}

    for store in STORES:
        products = scrape_store(store)
        all_products[store] = products

        # Shrani vmesne rezultate
        output_file = OUTPUT_DIR / f"{store}_products.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        log(f"Shranjeno: {output_file}")

    return all_products


# ============================================
# PRODUCT MATCHING
# ============================================

def match_products(all_products: dict) -> list:
    """
    Poveži iste izdelke iz različnih trgovin.

    Vrne seznam "master" izdelkov z cenami iz vsake trgovine.
    """
    log("Začenjam product matching...")

    # 1. Pripravi vse izdelke z dodatnimi podatki
    all_items = []
    for store, products in all_products.items():
        for p in products:
            item = {
                "store": store,
                "original": p,
                "name": p.get("ime", ""),
                "name_normalized": normalize_text(p.get("ime", "")),
                "price": p.get("redna_cena"),
                "sale_price": p.get("akcijska_cena"),
                "image": p.get("slika", ""),
                "image_hash": get_image_hash(p.get("slika", "")),
                "category": p.get("kategorija", ""),
                **extract_brand_weight(p.get("ime", ""))
            }
            all_items.append(item)

    log(f"Skupaj {len(all_items)} izdelkov za matching")

    # 2. Grupiranje po image hash (najprej slike)
    image_groups = defaultdict(list)
    no_image_items = []

    for item in all_items:
        if item["image_hash"]:
            image_groups[item["image_hash"]].append(item)
        else:
            no_image_items.append(item)

    log(f"Image hash grup: {len(image_groups)}")

    # 3. Ustvari master izdelke
    master_products = []
    matched_items = set()

    # 3a. Najprej iz image hash grup
    for img_hash, items in image_groups.items():
        if len(items) >= 2:  # Vsaj 2 trgovini imata isto sliko
            # To je match!
            stores_in_group = set(item["store"] for item in items)

            if len(stores_in_group) >= 2:
                master = create_master_product(items)
                master_products.append(master)
                for item in items:
                    matched_items.add(id(item))

    log(f"Matched po sliki: {len(master_products)} izdelkov")

    # 3b. Za ostale poskusi text matching
    unmatched = [item for item in all_items if id(item) not in matched_items]

    # Grupiraj po trgovini
    by_store = defaultdict(list)
    for item in unmatched:
        by_store[item["store"]].append(item)

    # Primerjaj med trgovinami
    stores = list(by_store.keys())

    if len(stores) >= 2:
        base_store = stores[0]
        other_stores = stores[1:]

        for base_item in by_store[base_store]:
            if id(base_item) in matched_items:
                continue

            matches = [base_item]

            for other_store in other_stores:
                best_match = None
                best_score = 0

                for other_item in by_store[other_store]:
                    if id(other_item) in matched_items:
                        continue

                    score = calculate_match_score(base_item, other_item)

                    if score > best_score and score >= 0.7:  # Min 70% match
                        best_score = score
                        best_match = other_item

                if best_match:
                    matches.append(best_match)

            if len(matches) >= 2:  # Vsaj 2 trgovini
                master = create_master_product(matches)
                master_products.append(master)
                for item in matches:
                    matched_items.add(id(item))

    log(f"Skupaj matched: {len(master_products)} izdelkov")

    # 3c. Dodaj še neujete izdelke kot posamezne
    for item in all_items:
        if id(item) not in matched_items:
            master = create_master_product([item])
            master_products.append(master)

    log(f"Končno število master izdelkov: {len(master_products)}")

    return master_products


def calculate_match_score(item1: dict, item2: dict) -> float:
    """Izračunaj score ujemanja med dvema izdelkoma."""
    score = 0.0
    weights_total = 0

    # 1. Image hash (40% teže)
    if item1["image_hash"] and item2["image_hash"]:
        if item1["image_hash"] == item2["image_hash"]:
            score += 0.4 * 1.0
        weights_total += 0.4

    # 2. Brand match (20% teže)
    if item1["brand"] and item2["brand"]:
        if item1["brand"] == item2["brand"]:
            score += 0.2 * 1.0
        weights_total += 0.2

    # 3. Weight match (20% teže)
    if item1["weight_normalized"] and item2["weight_normalized"]:
        if item1["weight_normalized"] == item2["weight_normalized"]:
            score += 0.2 * 1.0
        weights_total += 0.2

    # 4. Name similarity (20% teže)
    name_sim = similarity_score(item1["name_normalized"], item2["name_normalized"])
    score += 0.2 * name_sim
    weights_total += 0.2

    # Normaliziraj score
    if weights_total > 0:
        return score / weights_total
    return 0.0


def create_master_product(items: list) -> dict:
    """Ustvari master izdelek iz skupine matchanih izdelkov."""

    # Izberi najboljše ime (najdaljše = najbolj opisno)
    best_name = max(items, key=lambda x: len(x["name"]))["name"]

    # Zberi cene po trgovinah
    prices = {}
    for item in items:
        store = item["store"]
        prices[store] = {
            "redna_cena": item["price"],
            "akcijska_cena": item["sale_price"],
            "ime_v_trgovini": item["name"],
            "slika": item["image"]
        }

    # Najdi najnižjo ceno
    all_prices = []
    for store, data in prices.items():
        effective_price = data["akcijska_cena"] or data["redna_cena"]
        if effective_price:
            all_prices.append((store, effective_price))

    cheapest = min(all_prices, key=lambda x: x[1]) if all_prices else (None, None)

    # Kategorija
    categories = [item["category"] for item in items if item["category"]]
    category = categories[0] if categories else ""

    # Slika (prva ki obstaja)
    images = [item["image"] for item in items if item["image"]]
    image = images[0] if images else ""

    return {
        "ime": best_name,
        "kategorija": category,
        "slika": image,
        "cene": prices,
        "najcenejsa_trgovina": cheapest[0],
        "najnizja_cena": cheapest[1],
        "stevilo_trgovin": len(prices)
    }


# ============================================
# CONVEX UPLOAD (za prikaz na strani)
# ============================================

def upload_to_convex(all_products: dict):
    """Upload v Convex bazo za prikaz na strani."""
    import os

    convex_url = os.getenv("CONVEX_URL", "")
    ingest_token = os.getenv("PRHRAN_INGEST_TOKEN", "")

    if not convex_url or not ingest_token:
        log("CONVEX_URL ali PRHRAN_INGEST_TOKEN ni nastavljen - preskakujem Convex upload", "WARN")
        return False

    # Pretvori v format za Convex
    items = []
    for store, products in all_products.items():
        for p in products:
            items.append({
                "ime": p.get("ime", ""),
                "redna_cena": p.get("redna_cena"),
                "akcijska_cena": p.get("akcijska_cena"),
                "kategorija": p.get("kategorija", ""),
                "enota": p.get("enota", ""),
                "trgovina": store.capitalize(),  # Spar, Mercator, Tus
                "slika": p.get("slika", ""),
            })

    log(f"Uploading {len(items)} izdelkov v Convex...")

    # Pošlji v batchih (max 500 naenkrat)
    batch_size = 500
    total_uploaded = 0

    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]

        try:
            response = requests.post(
                f"{convex_url}/api/ingest/grocery",
                json={
                    "items": batch,
                    "clearFirst": (i == 0)  # Počisti samo pri prvem batchu
                },
                headers={
                    "Authorization": f"Bearer {ingest_token}",
                    "Content-Type": "application/json"
                },
                timeout=60
            )

            if response.status_code == 200:
                total_uploaded += len(batch)
                log(f"  Batch {i//batch_size + 1}: {len(batch)} izdelkov OK")
            else:
                log(f"  Batch {i//batch_size + 1}: NAPAKA {response.status_code}", "ERROR")

        except Exception as e:
            log(f"  Batch {i//batch_size + 1}: NAPAKA {e}", "ERROR")

    log(f"Convex upload končan: {total_uploaded}/{len(items)} izdelkov", "SUCCESS")
    return True


# ============================================
# GOOGLE SHEETS UPLOAD
# ============================================

def upload_to_sheets(master_products: list, all_products: dict):
    """Upload v Google Sheets."""
    from google_sheets import GoogleSheetsManager

    log("Povezujem z Google Sheets...")
    gs = GoogleSheetsManager()
    if not gs.connect():
        log("Napaka pri povezavi z Google Sheets!", "ERROR")
        return

    # Upload posamezne trgovine (stari format)
    for store, products in all_products.items():
        log(f"Uploading {store.upper()}...")
        success = gs.clear_and_upload(store, products)
        if success:
            log(f"{store.upper()}: Uploaded {len(products)} izdelkov", "SUCCESS")

    log("Google Sheets upload končan!")


def save_master_products(master_products: list):
    """Shrani master izdelke v JSON."""
    output_file = OUTPUT_DIR / "master_products.json"

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(master_products, f, ensure_ascii=False, indent=2)

    log(f"Master products shranjeni: {output_file}")

    # Statistika
    matched = [p for p in master_products if p["stevilo_trgovin"] >= 2]
    single = [p for p in master_products if p["stevilo_trgovin"] == 1]

    log(f"=== STATISTIKA ===")
    log(f"Skupaj master izdelkov: {len(master_products)}")
    log(f"Matched (2+ trgovin): {len(matched)} ({100*len(matched)/len(master_products):.1f}%)")
    log(f"Samo 1 trgovina: {len(single)}")

    # Po trgovinah
    by_cheapest = defaultdict(int)
    for p in matched:
        if p["najcenejsa_trgovina"]:
            by_cheapest[p["najcenejsa_trgovina"]] += 1

    log(f"Najcenejša trgovina:")
    for store, count in sorted(by_cheapest.items(), key=lambda x: -x[1]):
        log(f"  {store.upper()}: {count}x najcenejši")


# ============================================
# MAIN
# ============================================

def main():
    print("=" * 70)
    print("PR'HRAN - FULL SCRAPE + PRODUCT MATCHING")
    print(f"Čas: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # 1. Scrape vse trgovine
    log("KORAK 1: Scraping vseh trgovin...")
    all_products = scrape_all_stores()

    total = sum(len(p) for p in all_products.values())
    log(f"Skupaj scraped: {total} izdelkov")

    # 2. Product matching
    log("KORAK 2: Product matching...")
    master_products = match_products(all_products)

    # 3. Shrani rezultate
    log("KORAK 3: Shranjevanje...")
    save_master_products(master_products)

    # 4. Upload v Convex (za prikaz na strani)
    log("KORAK 4: Upload v Convex...")
    upload_to_convex(all_products)

    # 5. Upload v Google Sheets (backup)
    log("KORAK 5: Upload v Google Sheets...")
    upload_to_sheets(master_products, all_products)

    print("=" * 70)
    print("KONČANO!")
    print("=" * 70)


if __name__ == "__main__":
    main()
