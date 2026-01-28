"""
BULLETPROOF TUŠ / HITRI NAKUP Scraper
https://hitrinakup.com/

NAVIGACIJA:
1. Odpri https://hitrinakup.com/kategorije
2. Klikni na glavno kategorijo (npr. "Sadje in zelenjava")
3. Odpre se stran s podkategorijami na levi
4. Klikni vsako podkategorijo, scrapa vse (infinite scroll)
5. Ko končaš vse podkategorije, nazaj na /kategorije
6. Naslednja glavna kategorija, ponovi

BULLETPROOF FEATURES:
- Retry z exponential backoff
- Več fallback selektorjev
- Data validation
- Anti-detection
- Progress saving
"""
import re
import time
from typing import Optional, List
from playwright.sync_api import Page, ElementHandle

from .base import BulletproofScraper


class TusScraper(BulletproofScraper):
    """BULLETPROOF Scraper za Tuš / Hitri Nakup Slovenija"""

    STORE_NAME = "Tuš"
    BASE_URL = "https://hitrinakup.com"
    CATEGORIES_URL = "https://hitrinakup.com/kategorije"

    # DIREKTNI URL-ji za kategorije - iz sitemap.xml
    # Format: (ime_kategorije, URL)
    CATEGORY_URLS = [
        ("Sadje in zelenjava", "https://hitrinakup.com/kategorije/Sadje%20in%20zelenjava"),
        ("Meso, delikatesa in ribe", "https://hitrinakup.com/kategorije/Meso,%20delikatesa%20in%20ribe"),
        ("Hlajeni in mlečni izdelki", "https://hitrinakup.com/kategorije/Hlajeni%20in%20mle%C4%8Dni%20izdelki"),
        ("Kruh in pekovski izdelki", "https://hitrinakup.com/kategorije/Kruh%20in%20pekovski%20izdelki"),
        ("Zamrznjeno", "https://hitrinakup.com/kategorije/Zamrznjeno"),
        ("Shramba", "https://hitrinakup.com/kategorije/Shramba"),
        ("Alkoholne pijače", "https://hitrinakup.com/kategorije/Alkoholne%20pija%C4%8De"),
        ("Brezalkoholne pijače", "https://hitrinakup.com/kategorije/Brezalkoholne%20pija%C4%8De"),
        ("Sladko in slano", "https://hitrinakup.com/kategorije/Sladko%20in%20slano"),
        ("Osebna nega", "https://hitrinakup.com/kategorije/Osebna%20nega"),
        ("Dom", "https://hitrinakup.com/kategorije/Dom"),
        ("Dojenčki in otroci", "https://hitrinakup.com/kategorije/Dojen%C4%8Dki%20in%20otroci"),
        ("Male živali", "https://hitrinakup.com/kategorije/Male%20%C5%BEivali"),
        ("Mednarodna hrana", "https://hitrinakup.com/kategorije/Mednarodna%20hrana"),
    ]

    # Stare podkategorije - ohrani za kompatibilnost
    SUBCATEGORIES = [
        ("Zelenjava", "Sadje in zelenjava"),
        ("Sadje", "Sadje in zelenjava"),
        ("Mleko", "Mlečni izdelki"),
        ("Jogurti", "Mlečni izdelki"),
        ("Siri", "Mlečni izdelki"),
        ("Kruh", "Kruh in pecivo"),
        ("Pecivo", "Kruh in pecivo"),
    ]

    # TUŠ SPECIFIČNI selektorji (iz HTML inspekcije)
    PRODUCT_SELECTORS = [
        # Primarni - HorizontalScrollingItems
        '[class*="itemCardWrapper"]',
        'a[class*="itemCardWrapper"]',
        # Fallback
        '[class*="ItemCard"]',
        '[class*="itemCard"]',
        'a[href*="/izdelki/"]',
    ]

    # TUŠ specifični selektorji za ime
    NAME_SELECTORS = [
        # Primarni - HorizontalScrollingItems
        '[class*="itemProductTitle"]',
        '[class*="ItemProductTitle"]',
        # Fallback
        'img[alt]',  # Ime je v alt atributu slike!
        '[class*="productTitle"]',
        '[class*="title"]',
    ]

    # TUŠ specifični selektorji za cene
    PRICE_SELECTORS = [
        # Zelena cena (akcijska)
        '[class*="green"][class*="price"]',
        '[class*="price-discount"]',
        # Redna cena
        '[class*="price"]:not([class*="dashed"]):not([class*="green"])',
        # Prečrtana (stara) cena
        '[class*="dashed-price"]',
        '[class*="dashedPrice"]',
    ]

    # TUŠ specifični selektorji za slike
    IMAGE_SELECTORS = [
        'img[class*="itemCardThumbnail"]',
        'img[class*="ItemCardThumbnail"]',
        'img[alt]',
        'img[src]',
    ]

    def __init__(self, page: Page):
        super().__init__(page)
        self.current_category = ""
        self.current_subcategory = ""

    # ==================== NAVIGATION ====================

    def click_main_category(self, category_name: str) -> bool:
        """BULLETPROOF klik na glavno kategorijo"""
        self.log(f"Klikam kategorijo: {category_name}")

        category_selectors = [
            f'a:has-text("{category_name}")',
            f'[class*="category"] a:has-text("{category_name}")',
            f'[class*="Category"] a:has-text("{category_name}")',
            f'div:has-text("{category_name}") a',
            f'[class*="categoryCard"]:has-text("{category_name}")',
            f'[class*="CategoryCard"]:has-text("{category_name}")',
        ]

        for selector in category_selectors:
            try:
                els = self.page.query_selector_all(selector)
                for el in els:
                    if el.is_visible():
                        text = el.inner_text().strip()
                        # Preveri da je pravo ujemanje
                        if category_name.lower() in text.lower():
                            el.click()
                            self.random_delay(2.0, 2.5)
                            self.log(f"Kliknil kategorijo: {category_name}", "SUCCESS")
                            return True
            except:
                continue

        # Fallback - text selector
        try:
            self.page.click(f'text="{category_name}"', timeout=5000)
            self.random_delay(2.0, 2.5)
            self.log(f"Kliknil kategorijo (text): {category_name}", "SUCCESS")
            return True
        except:
            pass

        self.log(f"Ne najdem kategorije: {category_name}", "ERROR")
        return False

    def get_subcategories(self) -> List[dict]:
        """BULLETPROOF pridobivanje podkategorij na levi strani"""
        subcategories = []

        subcategory_selectors = [
            '[class*="sidebar"] a',
            '[class*="Sidebar"] a',
            '[class*="category-list"] a',
            '[class*="CategoryList"] a',
            '[class*="subcategory"] a',
            '[class*="Subcategory"] a',
            '[class*="filter"] a[href*="/kategorije/"]',
            '[class*="Filter"] a[href*="/kategorije/"]',
            'nav[class*="category"] a',
            'aside a[href*="/kategorije/"]',
            '[class*="leftMenu"] a',
            '[class*="left-menu"] a',
            '.categories a',
        ]

        for selector in subcategory_selectors:
            try:
                links = self.page.query_selector_all(selector)
                if not links:
                    continue

                for link in links:
                    try:
                        text = link.inner_text().strip()
                        href = link.get_attribute("href") or ""

                        # Filtriraj - samo veljavne podkategorije
                        if not text or len(text) < 2 or len(text) > 100:
                            continue

                        # Ignoriraj "Vse", "Kategorije", itd
                        skip_words = ["vse", "vse kategorije", "kategorije", "domov", "nazaj"]
                        if text.lower() in skip_words:
                            continue

                        # Preveri da ni duplikat
                        if text not in [s["name"] for s in subcategories]:
                            subcategories.append({
                                "name": text,
                                "href": href
                            })
                    except:
                        continue

                if subcategories:
                    break
            except:
                continue

        self.log(f"Najdenih {len(subcategories)} podkategorij")
        return subcategories

    def click_subcategory(self, subcategory: dict) -> bool:
        """BULLETPROOF klik na podkategorijo"""
        name = subcategory["name"]
        href = subcategory.get("href", "")

        self.log(f"Klikam podkategorijo: {name}")

        subcategory_selectors = [
            f'[class*="sidebar"] a:has-text("{name}")',
            f'[class*="Sidebar"] a:has-text("{name}")',
            f'a:has-text("{name}")',
            f'[class*="category"] a:has-text("{name}")',
        ]

        for selector in subcategory_selectors:
            try:
                el = self.page.query_selector(selector)
                if el and el.is_visible():
                    el.click()
                    self.random_delay(2.0, 2.5)
                    self.log(f"Kliknil podkategorijo: {name}", "SUCCESS")
                    return True
            except:
                continue

        # Fallback - poskusi href
        if href:
            try:
                full_url = href if href.startswith("http") else f"{self.BASE_URL}{href}"
                self.safe_goto(full_url)
                self.log(f"Navigiral na podkategorijo: {name}", "SUCCESS")
                return True
            except:
                pass

        self.log(f"Ne najdem podkategorije: {name}", "WARNING")
        return False

    def scroll_and_load_all(self, max_scrolls: int = 100):
        """BULLETPROOF infinite scroll za Tuš"""
        self.log("Infinite scroll...")

        last_height = self.page.evaluate("document.body.scrollHeight")
        last_product_count = 0
        no_change = 0
        scroll_count = 0

        # Tuš ima infinite scroll - traja da naloži
        while no_change < 8 and scroll_count < max_scrolls:
            # Scroll dol
            self.safe_scroll("down")
            scroll_count += 1

            # Tuš potrebuje daljšo pavzo
            self.random_delay(2.5, 3.5)

            # Poskusi klikniti "Naloži več" / "Več izdelkov"
            load_more_selectors = [
                'button[class*="load-more"]',
                'button[class*="LoadMore"]',
                'button[class*="loadMore"]',
                'button[class*="show-more"]',
                '[class*="loadMore"] button',
                'button:has-text("Naloži več")',
                'button:has-text("Prikaži več")',
                'button:has-text("Več izdelkov")',
                'a:has-text("Več izdelkov")',
                'a:has-text("Naloži več")',
            ]

            for selector in load_more_selectors:
                try:
                    btn = self.page.query_selector(selector)
                    if btn and btn.is_visible():
                        btn.click()
                        self.random_delay(3.0, 4.0)
                        no_change = 0  # Reset
                        break
                except:
                    continue

            # Preveri ali je nova vsebina
            new_height = self.page.evaluate("document.body.scrollHeight")

            # Preštej izdelke
            current_products = 0
            for selector in self.PRODUCT_SELECTORS[:3]:
                try:
                    els = self.page.query_selector_all(selector)
                    if els:
                        current_products = max(current_products, len(els))
                        break
                except:
                    continue

            if new_height == last_height and current_products == last_product_count:
                no_change += 1
            else:
                no_change = 0
                last_height = new_height
                last_product_count = current_products

            if scroll_count % 10 == 0:
                self.log(f"Scroll {scroll_count}: ~{current_products} izdelkov")

        self.log(f"Scroll končan po {scroll_count} scrollih")

    # ==================== DATA EXTRACTION ====================

    def has_discount_badge(self, element: ElementHandle) -> bool:
        """Preveri ali ima izdelek oznako popusta"""
        try:
            text = element.inner_text().lower()

            # Procenti
            if re.search(r"-\s*\d{1,2}\s*%", text):
                return True

            # Besede za akcijo
            discount_words = ["akcija", "znižano", "popust", "super cena", "ugodno", "prihrani"]
            if any(w in text for w in discount_words):
                return True

            # CSS elementi
            discount_selectors = [
                '[class*="discount"]',
                '[class*="Discount"]',
                '[class*="sale"]',
                '[class*="Sale"]',
                '[class*="akcij"]',
                '[class*="promo"]',
                '[class*="green"][class*="price"]',
                '[class*="dashed"]',
                'del', 's', 'strike',
                '[class*="old"]',
                '[class*="regular"]',
            ]

            for sel in discount_selectors:
                if element.query_selector(sel):
                    return True

            return False
        except:
            return False

    def extract_product_data(self, element: ElementHandle, category: str = "") -> Optional[dict]:
        """
        BULLETPROOF ekstrakcija podatkov izdelka za Tuš / Hitri Nakup.

        TUŠ SPECIFIČNO (iz HTML inspekcije):
        - Ime: img[alt] atribut (najbolj zanesljivo!)
        - Akcijska cena (zelena): class*="green"
        - Redna cena (prečrtana): class*="dashed-price"
        - Redna cena (brez akcije): class*="price" (ki ni green/dashed)
        """
        try:
            # ===== IME =====
            name = ""

            # NAJPREJ: Vzemi ime iz img[alt] - najbolj zanesljivo za Tuš!
            try:
                img = element.query_selector('img[alt]')
                if img:
                    alt = img.get_attribute("alt") or ""
                    alt = alt.strip()
                    if self.is_valid_name(alt):
                        name = alt
            except:
                pass

            # Fallback: itemProductTitle class
            if not name:
                for selector in self.NAME_SELECTORS:
                    try:
                        el = element.query_selector(selector)
                        if el:
                            # Za img vzemi alt
                            if el.evaluate("el => el.tagName") == "IMG":
                                name = el.get_attribute("alt") or ""
                            else:
                                name = el.inner_text()

                            name = re.sub(r"\s+", " ", name).strip()
                            name = re.sub(r"\d+[,.]\d{2}\s*€.*", "", name).strip()

                            if self.is_valid_name(name):
                                break
                            else:
                                name = ""
                    except:
                        continue

            if not name:
                return None

            # ===== CENE - TUŠ SPECIFIČNO =====
            regular_price = None
            sale_price = None

            # 1. Prečrtana cena (dashed-price) = REDNA cena (če je akcija)
            dashed_selectors = [
                '[class*="dashed-price"]',
                '[class*="dashedPrice"]',
                '[class*="DashedPrice"]',
                '[class*="old-price"]',
                '[class*="oldPrice"]',
                '[class*="regular-price"]',
                '[class*="regularPrice"]',
                'del', 's', 'strike',
            ]

            for sel in dashed_selectors:
                try:
                    el = element.query_selector(sel)
                    if el:
                        text = el.inner_text()
                        match = re.search(r"(\d+)[,.](\d{2})", text)
                        if match:
                            regular_price = float(f"{match.group(1)}.{match.group(2)}")
                            break
                except:
                    continue

            # 2. Zelena cena (green) = AKCIJSKA cena
            green_selectors = [
                '[class*="green"][class*="price"]',
                '[class*="Green"][class*="Price"]',
                '[class*="price-discount"]',
                '[class*="priceDiscount"]',
                '[class*="PriceDiscount"]',
                '[class*="sale-price"]',
                '[class*="salePrice"]',
                '[class*="SalePrice"]',
                '[class*="akcijska"]',
                '[class*="nova-cena"]',
            ]

            for sel in green_selectors:
                try:
                    el = element.query_selector(sel)
                    if el:
                        text = el.inner_text()
                        match = re.search(r"(\d+)[,.](\d{2})", text)
                        if match:
                            sale_price = float(f"{match.group(1)}.{match.group(2)}")
                            break
                except:
                    continue

            # 3. Če ni zelene/dashed cene - vzemi #price ki NI zelena/dashed
            if not regular_price and not sale_price:
                price_selectors = [
                    '#price',
                    '[id="price"]',
                    '[class*="price"]:not([class*="green"]):not([class*="dashed"]):not([class*="old"])',
                    '[class*="Price"]:not([class*="Green"]):not([class*="Dashed"]):not([class*="Old"])',
                ]

                for sel in price_selectors:
                    try:
                        els = element.query_selector_all(sel)
                        for el in els:
                            class_name = (el.get_attribute("class") or "").lower()
                            # Preskoči zeleno in dashed
                            if "green" in class_name or "dashed" in class_name or "old" in class_name:
                                continue

                            text = el.inner_text()
                            match = re.search(r"(\d+)[,.](\d{2})", text)
                            if match:
                                regular_price = float(f"{match.group(1)}.{match.group(2)}")
                                break

                        if regular_price:
                            break
                    except:
                        continue

            # 4. Fallback - generično iskanje cen
            if not regular_price and not sale_price:
                text = element.inner_text()
                has_discount = self.has_discount_badge(element)

                # Odstrani cene na enoto
                clean = re.sub(r"\d+[,.]\d{2}\s*€?\s*/\s*(kg|kos|kom|l|ml|g)\b", " ", text, flags=re.I)

                prices = []
                for m in re.finditer(r"(\d+)[,.](\d{2})\s*€?", clean):
                    val = float(f"{m.group(1)}.{m.group(2)}")
                    if self.is_valid_price(val) and val not in prices:
                        prices.append(val)

                if prices:
                    if len(prices) == 1:
                        regular_price = prices[0]
                    elif has_discount:
                        regular_price = max(prices)
                        sale_price = min(prices)
                        if sale_price == regular_price:
                            sale_price = None
                    else:
                        regular_price = min(prices)

            if not regular_price and not sale_price:
                return None

            # Preveri da je akcijska nižja od redne
            if regular_price and sale_price and sale_price >= regular_price:
                # Zamenjaj
                regular_price, sale_price = sale_price, regular_price

            # ===== SLIKA =====
            image = ""
            for selector in self.IMAGE_SELECTORS:
                try:
                    img = element.query_selector(selector)
                    if img:
                        src = (
                            img.get_attribute("data-src") or
                            img.get_attribute("data-lazy-src") or
                            img.get_attribute("src") or
                            ""
                        )

                        if src and not src.startswith("data:"):
                            if src.startswith("//"):
                                src = f"https:{src}"
                            elif src.startswith("/"):
                                src = f"{self.BASE_URL}{src}"

                            if self.is_valid_image_url(src):
                                image = src
                                break
                except:
                    continue

            # ===== KATEGORIJA =====
            cat = category or self.current_category
            if self.current_subcategory:
                cat = f"{self.current_category} > {self.current_subcategory}"

            # ===== ENOTA (iz imena) =====
            unit_match = re.search(r"(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|dl|kos|kom)\b", name, re.I)
            unit = ""
            if unit_match:
                unit = f"{unit_match.group(1)}{unit_match.group(2).lower()}"

            return {
                "ime": name,
                "redna_cena": regular_price,
                "akcijska_cena": sale_price,
                "kategorija": cat,
                "enota": unit,
                "trgovina": self.STORE_NAME,
                "slika": image if image else None,
                "url": self.page.url,
            }

        except Exception as e:
            self.log(f"Napaka pri ekstrakciji: {e}", "WARNING")
            return None

    def scrape_current_page(self, category: str = "") -> list[dict]:
        """Scrapaj vse izdelke na trenutni strani"""
        products = []

        # Poskusi več selektorjev
        for selector in self.PRODUCT_SELECTORS:
            try:
                elements = self.page.query_selector_all(selector)
                if not elements or len(elements) < 3:
                    continue

                self.log(f"Najdenih {len(elements)} elementov s selektorjem: {selector}")

                for el in elements:
                    try:
                        product = self.extract_product_data(el, category)
                        if product and self.add_product(product):
                            products.append(product)
                    except:
                        continue

                if products:
                    break

            except:
                continue

        return products

    def scrape_subcategory(self, subcategory: dict, main_category: str) -> list[dict]:
        """Scrapaj vse izdelke iz ene podkategorije"""
        self.current_subcategory = subcategory["name"]
        products = []

        self.log(f"  Podkategorija: {subcategory['name']}")

        # Klikni podkategorijo
        if not self.click_subcategory(subcategory):
            return products

        # Počakaj da se stran naloži
        try:
            self.page.wait_for_load_state("networkidle", timeout=15000)
        except:
            pass

        # Infinite scroll
        self.scroll_and_load_all(max_scrolls=80)

        # Scrapaj izdelke
        category = f"{main_category} > {subcategory['name']}"
        products = self.scrape_current_page(category)

        self.log(f"  {subcategory['name']}: {len(products)} izdelkov")
        return products

    def scrape_main_category(self, category_name: str) -> list[dict]:
        """BULLETPROOF scraping ene glavne kategorije"""
        self.current_category = category_name
        self.current_subcategory = ""
        products = []

        self.log(f"=" * 50)
        self.log(f"KATEGORIJA: {category_name}")
        self.log(f"=" * 50)

        # Pojdi na stran kategorij
        if not self.safe_goto(self.CATEGORIES_URL):
            return products

        # Scroll da se pokažejo kategorije
        self.safe_scroll("down", 500)
        self.random_delay(1.0, 1.5)

        # Klikni na glavno kategorijo
        if not self.click_main_category(category_name):
            return products

        # Počakaj da se stran naloži
        try:
            self.page.wait_for_load_state("networkidle", timeout=15000)
        except:
            pass
        self.random_delay(1.5, 2.0)

        # Pridobi podkategorije
        subcategories = self.get_subcategories()

        if not subcategories:
            # Če ni podkategorij, scrapa direktno
            self.log("Ni podkategorij, scrapam direktno")
            self.scroll_and_load_all(max_scrolls=80)
            products = self.scrape_current_page(category_name)
        else:
            # Scrapaj vsako podkategorijo
            for i, subcat in enumerate(subcategories):
                try:
                    self.log(f"  [{i+1}/{len(subcategories)}] {subcat['name']}")
                    subcat_products = self.scrape_subcategory(subcat, category_name)
                    products.extend(subcat_products)
                    self.random_delay(1.0, 1.5)
                except Exception as e:
                    self.log(f"  Napaka pri podkategoriji {subcat['name']}: {e}", "WARNING")
                    continue

        self.log(f"{category_name}: KONČANO - {len(products)} izdelkov", "SUCCESS")
        return products

    def scrape_all(self) -> list[dict]:
        """
        NOVI FLOW z DIREKTNIMI URL-ji:
        1. Pojdi direktno na URL kategorije (brez klikanja!)
        2. Infinite scroll - poberi VSE izdelke
        3. Ponovi za vsako kategorijo

        Veliko hitrejše in zanesljivejše kot klikanje!
        """
        self.start()

        total = len(self.CATEGORY_URLS)
        self.log(f"Scrapajem {total} kategorij z DIREKTNIMI URL-ji...")

        first_page = True
        for i, (cat_name, cat_url) in enumerate(self.CATEGORY_URLS):
            self.log(f"\n[{i+1}/{total}] {cat_name}")
            self.current_category = cat_name
            self.current_subcategory = ""

            try:
                # 1. Odpri kategorijo DIREKTNO (brez klikanja!)
                self.log(f"Odpiranje: {cat_url}")
                if not self.safe_goto(cat_url, timeout=60000):
                    self.log(f"Ne morem odpreti: {cat_name}", "ERROR")
                    continue

                # Samo na prvi strani sprejmi piškotke
                if first_page:
                    self.accept_cookies()
                    self.close_popups()
                    first_page = False
                    time.sleep(2)
                else:
                    time.sleep(1)

                # 2. Počakaj da se stran naloži
                try:
                    self.page.wait_for_load_state("networkidle", timeout=15000)
                except:
                    pass

                # 3. Infinite scroll - poberi VSE izdelke
                self.log("Infinite scroll...")
                self.scroll_and_load_all(max_scrolls=200)  # Več scrollov za več izdelkov

                # 4. Scrapaj izdelke
                products = self.scrape_current_page(cat_name)
                self.log(f"{cat_name}: {len(products)} izdelkov", "SUCCESS")

                # Kratka pavza pred naslednjo kategorijo
                self.random_delay(1.0, 2.0)

            except Exception as e:
                self.log(f"Napaka pri {cat_name}: {e}", "ERROR")
                self.metrics.errors += 1

        self.finish()
        return self.products

    def _click_subcategory_on_main_page(self, subcat_name: str) -> bool:
        """
        Klikni na podkategorijo direktno na /kategorije strani.
        Podkategorije so prikazane pod glavnimi kategorijami.
        """
        # Scroll dol da se pokažejo vse kategorije
        self.safe_scroll("down", 500)
        time.sleep(1)

        # Selektorji za podkategorijo
        selectors = [
            f'a:has-text("{subcat_name}")',
            f'text="{subcat_name}"',
            f'div:has-text("{subcat_name}") >> nth=0',
        ]

        for selector in selectors:
            try:
                # Najdi in klikni
                el = self.page.query_selector(selector)
                if el and el.is_visible():
                    el.click()
                    self.log(f"Kliknil: {subcat_name}", "SUCCESS")
                    return True
            except:
                continue

        # Fallback - poskusi page.click
        try:
            self.page.click(f'text="{subcat_name}"', timeout=5000)
            self.log(f"Kliknil (text): {subcat_name}", "SUCCESS")
            return True
        except:
            pass

        return False
