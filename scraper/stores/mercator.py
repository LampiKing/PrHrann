"""
BULLETPROOF MERCATOR Scraper
https://mercatoronline.si/

NAVIGACIJA:
1. Odpri https://mercatoronline.si/brskaj (vsi izdelki)
2. Infinite scroll dol dokler ni vseh izdelkov
3. To je vse!

BULLETPROOF FEATURES:
- Retry z exponential backoff
- Več fallback selektorjev
- Data validation
- Anti-detection
- Progress saving
"""
import re
import time
from typing import Optional, Tuple
from playwright.sync_api import Page, ElementHandle

from .base import BulletproofScraper


class MercatorScraper(BulletproofScraper):
    """BULLETPROOF Scraper za Mercator Slovenija"""

    STORE_NAME = "Mercator"
    BASE_URL = "https://mercatoronline.si"
    ALL_PRODUCTS_URL = "https://mercatoronline.si/brskaj"

    # Mercator kategorije z dejanskimi ID-ji iz strani
    # Format: /brskaj#categories=ID
    CATEGORY_URLS = [
        ("Sadje in zelenjava", "https://mercatoronline.si/brskaj#categories=14535810"),
        ("Mlečni izdelki", "https://mercatoronline.si/brskaj#categories=14535405"),
        ("Meso in ribe", "https://mercatoronline.si/brskaj#categories=14535446"),
        ("Kruh in pecivo", "https://mercatoronline.si/brskaj#categories=14535463"),
        ("Delikatesa", "https://mercatoronline.si/brskaj#categories=14535481"),
        ("Zamrznjeni izdelki", "https://mercatoronline.si/brskaj#categories=14535512"),
        ("Shramba", "https://mercatoronline.si/brskaj#categories=14535548"),
        ("Zajtrk", "https://mercatoronline.si/brskaj#categories=14535588"),
        ("Pijače", "https://mercatoronline.si/brskaj#categories=14535612"),
        ("Testenine in riž", "https://mercatoronline.si/brskaj#categories=14535661"),
        ("Konzerve", "https://mercatoronline.si/brskaj#categories=14535681"),
        ("Čokolada in sladkarije", "https://mercatoronline.si/brskaj#categories=14535711"),
        ("Slani prigrizki", "https://mercatoronline.si/brskaj#categories=14535736"),
        ("Hrana za živali", "https://mercatoronline.si/brskaj#categories=14535768"),
        ("Otroci", "https://mercatoronline.si/brskaj#categories=14535837"),
        ("Higiena in lepota", "https://mercatoronline.si/brskaj#categories=14535864"),
        ("Čistila", "https://mercatoronline.si/brskaj#categories=14535906"),
        ("Dom in kuhinja", "https://mercatoronline.si/brskaj#categories=14535984"),
        ("Bio izdelki", "https://mercatoronline.si/brskaj#categories=16873196"),
    ]

    # BULLETPROOF selektorji - specifično za Mercator Online
    PRODUCT_SELECTORS = [
        # Mercator specifični - GLAVNI
        '.box.item.product',
        'div.product',
        '.product[data-item-id]',
        '[data-item-id]',
        # Fallback
        '.box.product',
        '[class*="product"]',
        '.item.product',
    ]

    NAME_SELECTORS = [
        # Mercator specifični
        '.lib-product-name',
        '.product-name',
        '.lib-product-url',
        # Iz data atributa
        '[data-analytics-object]',
        # Fallback
        '[class*="product-name"]',
        '[class*="name"]',
        'a[href*="/izdelek"]',
        'a[href*="/product"]',
    ]

    PRICE_SELECTORS = [
        # Mercator specifični
        '.lib-product-price',
        '.lib-product-normal-price',
        '.lib-product-pc30_price',
        '.lib-product-price-per-unit-main',
        '.product-price-holder',
        # Fallback
        '[class*="price"]',
    ]

    IMAGE_SELECTORS = [
        # Mercator specifični
        '.product-image img',
        'img[src*="mercatoronline.si/img/cache/products"]',
        'img[src*="mercator"]',
        # Fallback
        'img[src]',
    ]

    def __init__(self, page: Page):
        super().__init__(page)
        self.current_category = "Splošno"

    # ==================== POPUP HANDLING ====================

    def dismiss_delivery_popup(self) -> bool:
        """
        Zapri popup "Izbira načina prevzema izdelkov" - klikni X

        Ta popup se pojavi ko odpreš Mercator in vpraša za:
        - Dostava na dom
        - Prevzem v trgovini

        VEDNO klikni X gumb zgoraj desno!
        """
        try:
            # NAJPREJ: Počakaj da se popup ZARES pojavi
            try:
                self.page.wait_for_selector('[aria-label="close"], [aria-label="Close"], button[class*="close"]', timeout=3000)
            except:
                pass  # Če se ne pojavi, nadaljuj

            # MERCATOR SPECIFIČNI X GUMB - aria-label="close"
            # To je X gumb v zgornjem desnem kotu popup-a
            priority_selectors = [
                '[aria-label="close"]',
                '[aria-label="Close"]',
                'button[aria-label="close"]',
                'button[aria-label="Close"]',
                # SVG X ikona
                'button svg',
                # Pozicijsko - zgornji desni kot
                '[class*="Modal"] button:first-of-type',
                '[class*="modal"] button:first-of-type',
            ]

            for selector in priority_selectors:
                try:
                    btn = self.page.query_selector(selector)
                    if btn and btn.is_visible():
                        btn.click()
                        self.log(f"Popup 'Izbira nacina prevzema' ZAPRT s: {selector}", "SUCCESS")
                        time.sleep(0.5)
                        return True
                except:
                    continue

            # DRUGI SELEKTORJI za X gumb
            close_selectors = [
                # Mercator modal specifični
                '[class*="Modal"] button[class*="close"]',
                '[class*="modal"] button[class*="close"]',
                '[class*="Modal"] [class*="close"]',
                '[class*="modal"] [class*="close"]',
                'div[class*="Modal"] > button:first-child',
                # X button variants
                'button[class*="Close"]',
                'button[class*="close"]',
                '[class*="close-btn"]',
                '[class*="modal-close"]',
                # X znaki
                'button:has-text("×")',
                'button:has-text("✕")',
                'button:has-text("X")',
                # Aria labels (slovenski)
                '[aria-label="Zapri"]',
                '[aria-label="zapri"]',
            ]

            for selector in close_selectors:
                try:
                    btn = self.page.query_selector(selector)
                    if btn and btn.is_visible():
                        btn.click()
                        self.log(f"Popup zaprt s: {selector}", "SUCCESS")
                        time.sleep(0.5)
                        return True
                except:
                    continue

            # Fallback: Najdi modal in klikni prvi gumb (X je ponavadi prvi)
            try:
                modal = self.page.query_selector('[class*="Modal"], [class*="modal"], [role="dialog"]')
                if modal and modal.is_visible():
                    close_btn = modal.query_selector('button')
                    if close_btn and close_btn.is_visible():
                        close_btn.click()
                        self.log("Popup zaprt z prvim gumbom v modalu", "SUCCESS")
                        time.sleep(0.5)
                        return True
            except:
                pass

            # Escape tipka kot zadnja možnost
            try:
                self.page.keyboard.press("Escape")
                time.sleep(0.5)
                self.log("Popup zaprt z Escape", "SUCCESS")
                return True
            except:
                pass

            return False
        except:
            return False

    def dismiss_cookie_bar(self) -> bool:
        """
        Zapri cookie bar spodaj na strani.
        Mercator ima cookie notice z X gumbom.
        """
        try:
            cookie_close_selectors = [
                # Cookie bar X gumb
                '[class*="cookie"] button[class*="close"]',
                '[class*="Cookie"] button[class*="close"]',
                '[class*="cookie-bar"] button',
                '[class*="cookieBar"] button',
                '[class*="cookie-notice"] button',
                '[class*="cookieNotice"] button',
                # Privacy/GDPR
                '[class*="privacy"] button[class*="close"]',
                '[class*="gdpr"] button[class*="close"]',
                # Splošni "Sprejmi" gumbi
                'button:has-text("Sprejmi")',
                'button:has-text("V redu")',
                'button:has-text("OK")',
                # X gumb v cookie baru
                '[class*="cookie"] [aria-label="close"]',
                '[class*="cookie"] [aria-label="Close"]',
            ]

            for selector in cookie_close_selectors:
                try:
                    btn = self.page.query_selector(selector)
                    if btn and btn.is_visible():
                        btn.click()
                        self.log("Cookie bar zaprt", "SUCCESS")
                        time.sleep(0.3)
                        return True
                except:
                    continue

            return False
        except:
            return False

    def wait_and_dismiss_popups(self, wait_time: float = 2.0):
        """Počakaj in zapri vse popup-e - poskusi večkrat"""
        time.sleep(wait_time)

        # Poskusi 3x zapret popup (včasih se pojavi z zamikom)
        for attempt in range(3):
            if self.dismiss_delivery_popup():
                time.sleep(0.5)
            time.sleep(1.0)

    # ==================== NAVIGATION ====================

    def scroll_and_load_all(self, max_scrolls: int = 300):
        """
        BULLETPROOF infinite scroll za Mercator.
        Mercator ima najbolj enostavno navigacijo - samo scrollaj!
        """
        self.log("Začenjam infinite scroll...")

        last_height = self.page.evaluate("document.body.scrollHeight")
        last_product_count = 0
        no_change = 0
        scroll_count = 0

        while no_change < 10 and scroll_count < max_scrolls:
            # Scroll dol
            self.safe_scroll("down")
            scroll_count += 1

            # Mercator potrebuje daljšo pavzo za nalaganje
            self.random_delay(2.0, 3.0)

            # Poskusi klikniti "Naloži več" / "Load more"
            load_more_selectors = [
                'button[class*="load-more"]',
                'button[class*="LoadMore"]',
                'button[class*="loadMore"]',
                'button[class*="show-more"]',
                'button[class*="ShowMore"]',
                '[class*="loadMore"] button',
                'button:has-text("Naloži več")',
                'button:has-text("Prikaži več")',
                'button:has-text("Več izdelkov")',
                'button:has-text("Več")',
                'a:has-text("Naloži več")',
                'a[class*="load-more"]',
            ]

            for selector in load_more_selectors:
                try:
                    btn = self.page.query_selector(selector)
                    if btn and btn.is_visible():
                        btn.click()
                        self.random_delay(2.5, 3.5)
                        no_change = 0  # Reset counter
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

            # Progress log
            if scroll_count % 20 == 0:
                self.log(f"Scroll {scroll_count}: ~{current_products} izdelkov")

        self.log(f"Scroll končan po {scroll_count} scrollih (~{last_product_count} izdelkov)")

    # ==================== DATA EXTRACTION ====================

    def extract_mercator_prices(self, element: ElementHandle) -> Tuple[Optional[float], Optional[float]]:
        """
        BULLETPROOF ekstrakcija cen za Mercator.

        Mercator format (iz content.js):
        - Brez akcije: "1,29 € 3,23 €/ 1kg" -> regular=1,29€, sale=None
        - Z akcijo: "2,99 € 2,49 € 2,49 €/ 1kg" -> regular=2,99€, sale=2,49€

        PRAVILA:
        - Ignorira cene na enoto: "/ 1l", "/ 1kg", "/kg", "/kos", "/ 100g"
        - Če sta 2 RAZLIČNI ceni: PRVA = stara/redna, DRUGA = nova/akcijska
        """
        try:
            text = element.inner_text()

            # Najdi VSE cene s pozicijo
            pattern = r"(\d+)[,.](\d{2})\s*€"
            prices = []

            for match in re.finditer(pattern, text):
                pos = match.start()
                full_match = match.group(0)
                value = float(f"{match.group(1)}.{match.group(2)}")

                # Preveri ali je cena na enoto (ignoriramo!)
                # Ujame: "/ 1l", "/ 1kg", "/kg", "/kos", "/ 100g", itd
                after_text = text[pos + len(full_match):pos + len(full_match) + 30]
                is_per_unit = re.match(
                    r"^\s*/\s*\d*\s*(kg|kos|kom|kpl|pak|ml|cl|dl|mm|cm|m|g|l)\b",
                    after_text,
                    re.I
                )

                if is_per_unit:
                    continue  # Preskoči ceno na enoto

                if self.is_valid_price(value) and value not in [p["value"] for p in prices]:
                    prices.append({
                        "value": value,
                        "pos": pos,
                        "text": full_match
                    })

            # Preveri za popust badge
            has_discount = False
            discount_patterns = [r"-\s*\d+\s*%", r"akcij", r"popust", r"znižan"]
            for pattern in discount_patterns:
                if re.search(pattern, text, re.I):
                    has_discount = True
                    break

            # Preveri tudi CSS razrede
            if not has_discount:
                discount_selectors = [
                    '[class*="discount"]',
                    '[class*="Discount"]',
                    '[class*="akcij"]',
                    '[class*="popust"]',
                    '[class*="sale"]',
                    '[class*="Sale"]',
                    'del', 's', 'strike',
                ]
                for sel in discount_selectors:
                    if element.query_selector(sel):
                        has_discount = True
                        break

            # Sortiraj po poziciji (vrstni red na strani)
            prices.sort(key=lambda x: x["pos"])

            if not prices:
                return None, None

            if len(prices) == 1:
                # Samo ena cena = redna cena, ni akcije
                return prices[0]["value"], None

            # Več cen - preveri ali sta prvi dve RAZLIČNI
            if len(prices) >= 2:
                first = prices[0]["value"]
                second = prices[1]["value"]

                # Če sta ceni različni -> akcija!
                # Mercator: PRVA = stara/redna, DRUGA = nova/akcijska
                if first != second:
                    # Višja je redna, nižja je akcijska
                    if first > second:
                        return first, second
                    else:
                        return second, first

            # Ni akcije - vrni prvo ceno kot redno
            return prices[0]["value"], None

        except Exception as e:
            return None, None

    def extract_product_data(self, element: ElementHandle, category: str = "") -> Optional[dict]:
        """
        BULLETPROOF ekstrakcija podatkov izdelka za Mercator.

        Mercator ima data-analytics-object atribut z vsemi podatki v JSON!
        Format: {"item_id":"123","item_name":"Mleko","currency":"EUR","item_brand":"..."}
        """
        import json as json_module

        try:
            name = ""
            regular_price = None
            sale_price = None
            product_category = ""

            # ===== METODA 1: Uporabi data-analytics-object (NAJBOLJŠA) =====
            try:
                analytics_json = element.get_attribute("data-analytics-object")
                if analytics_json:
                    data = json_module.loads(analytics_json)
                    name = data.get("item_name", "")
                    product_category = data.get("item_category", "") or data.get("item_category2", "")

                    # Cena je v price polju
                    if "price" in data:
                        regular_price = float(data["price"])
            except:
                pass

            # ===== METODA 2: Fallback na DOM parsing =====
            if not name:
                for selector in self.NAME_SELECTORS:
                    try:
                        el = element.query_selector(selector)
                        if el:
                            tag_name = el.evaluate("el => el.tagName")

                            if tag_name == "IMG":
                                name = el.get_attribute("alt") or ""
                            elif tag_name == "A":
                                name = el.get_attribute("title") or el.inner_text()
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

            # Fallback: vzemi tekst pred ceno
            if not name:
                try:
                    all_text = element.inner_text()
                    all_text = re.sub(r"\s+", " ", all_text).strip()

                    if all_text:
                        parts = re.split(r"\d+[,.]\d{2}\s*€", all_text)
                        if parts and len(parts[0].strip()) > 3:
                            name = parts[0].strip()
                            name = re.sub(r"^razvrsti\s*(po)?:?\s*", "", name, flags=re.I)
                            name = re.sub(r"^kategorij[ae]:?\s*", "", name, flags=re.I)
                            name = re.sub(r"^filter:?\s*", "", name, flags=re.I)

                            if not self.is_valid_name(name):
                                name = ""
                except:
                    pass

            if not name:
                return None

            # ===== CENE (če še nimamo) =====
            if not regular_price:
                regular_price, sale_price = self.extract_mercator_prices(element)

            if not regular_price and not sale_price:
                return None

            # ===== SLIKA =====
            image = ""
            for selector in self.IMAGE_SELECTORS:
                try:
                    img = element.query_selector(selector)
                    if img:
                        src = (
                            img.get_attribute("data-src") or
                            img.get_attribute("data-lazy-src") or
                            img.get_attribute("data-original") or
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
            cat = product_category or category or self.current_category

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

    def scrape_category(self, category_name: str, url: str) -> list[dict]:
        """Scrapaj eno kategorijo"""
        self.current_category = category_name
        products = []

        self.log(f"=" * 50)
        self.log(f"KATEGORIJA: {category_name}")
        self.log(f"=" * 50)

        # Odpri kategorijo
        if not self.safe_goto(url, timeout=60000):
            self.log(f"Ne morem odpreti: {url}", "ERROR")
            return products

        # Sprejmi piškotke (če še niso)
        self.accept_cookies()
        self.close_popups()

        # POMEMBNO: Zapri popup "Izbira načina prevzema"
        self.wait_and_dismiss_popups(2.0)

        # Infinite scroll
        self.scroll_and_load_all(max_scrolls=150)

        # Scrapaj izdelke
        products = self.scrape_current_page(category_name)

        self.log(f"{category_name}: KONČANO - {len(products)} izdelkov", "SUCCESS")
        return products

    def scrape_all(self) -> list[dict]:
        """
        BULLETPROOF scraping vseh izdelkov.

        Lahko uporabiš 2 načina:
        1. scrape_all() - scrapa po kategorijah (bolj strukturirano)
        2. scrape_all_simple() - odpre /brskaj in scrollaj (hitreje, a manj kategorij)
        """
        self.start()

        # Odpri glavno stran za preverjanje
        self.log(f"Odpiranje: {self.BASE_URL}")
        if not self.safe_goto(self.BASE_URL, timeout=60000):
            self.log("Ne morem odpreti strani!", "ERROR")
            return []

        # Sprejmi piškotke
        self.accept_cookies()
        self.close_popups()

        # POMEMBNO: Zapri popup "Izbira načina prevzema"
        self.wait_and_dismiss_popups(3.0)

        # Scrapaj vsako kategorijo
        for i, (category_name, url) in enumerate(self.CATEGORY_URLS):
            self.log(f"\n[{i+1}/{len(self.CATEGORY_URLS)}] {category_name}")

            try:
                products = self.scrape_category(category_name, url)
                self.random_delay(1.5, 2.5)

            except Exception as e:
                self.log(f"Napaka pri {category_name}: {e}", "ERROR")
                self.stats["errors"] += 1

        self.finish()
        return self.products

    def scrape_all_simple(self) -> list[dict]:
        """
        Mercator /brskaj stran z infinite scroll - VSI IZDELKI.
        Timeout je zdaj 4 ure, kar bi moralo biti dovolj.
        """
        self.start()
        self.current_category = "Mercator"

        # Odpri stran z vsemi izdelki
        self.log(f"Odpiranje: {self.ALL_PRODUCTS_URL}")
        if not self.safe_goto(self.ALL_PRODUCTS_URL, timeout=60000):
            self.log("Ne morem odpreti strani!", "ERROR")
            return []

        # Sprejmi piškotke
        self.accept_cookies()
        self.close_popups()

        # ============ POPUP HANDLING ============
        self.log("Zapiram popup 'Izbira nacina prevzema'...")
        time.sleep(2)

        for attempt in range(5):
            if self.dismiss_delivery_popup():
                self.log("Popup zaprt!", "SUCCESS")
                break
            time.sleep(0.5)

        self.dismiss_cookie_bar()
        time.sleep(1)

        # ============ INFINITE SCROLL ============
        # Mercator /brskaj = ~90 scrollov za vse izdelke
        self.log("Zacem infinite scroll (~90 scrollov)...")
        self.scroll_and_load_all(max_scrolls=100)

        # Preveri popup še enkrat po scrollu
        self.dismiss_delivery_popup()
        self.dismiss_cookie_bar()

        # ============ SCRAPE IZDELKOV ============
        self.scrape_current_page("Mercator")

        self.finish()
        return self.products
