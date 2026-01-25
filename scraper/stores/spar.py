"""
BULLETPROOF SPAR Scraper
https://www.spar.si/online/

NAVIGACIJA:
1. Klikni "Kategorije" gumb (levo zgoraj)
2. Hover na glavno kategorijo (npr. "SADJE IN ZELENJAVA")
3. Pojavi se podmeni - klikni "Poglejte vse izdelke"
4. Scroll + paginacija (puščica desno) dokler ni vseh izdelkov
5. Ponovi za vsako kategorijo

BULLETPROOF FEATURES:
- Retry z exponential backoff
- Več fallback selektorjev
- Data validation
- Anti-detection
- Progress saving
"""
import re
import time
from typing import Optional
from playwright.sync_api import Page, ElementHandle

from .base import BulletproofScraper


class SparScraper(BulletproofScraper):
    """BULLETPROOF Scraper za SPAR Slovenija"""

    STORE_NAME = "Spar"
    BASE_URL = "https://www.spar.si"
    ONLINE_URL = "https://www.spar.si/online"

    # Direktni URL-ji za kategorije (bypass menija!)
    CATEGORY_URLS = {
        "SADJE IN ZELENJAVA": "/online/sadje-in-zelenjava/c/F01",
        "HLAJENI IN MLEČNI IZDELKI": "/online/mlecni-izdelki-in-jajca/c/F02",
        "SVEŽE MESO, MESNI IZDELKI IN RIBE": "/online/meso-ribe-in-delikatesne-jedi/c/F03",
        "VSE ZA ZAJTRK": "/online/vse-za-zajtrk/c/F04",
        "PIJAČE": "/online/pijace/c/F05",
        "KRUH, PECIVO IN SLAŠČICE": "/online/kruh-pecivo-in-slascice/c/F06",
        "SHRAMBA": "/online/shramba/c/F07",
        "BIO IN DRUGA POSEBNA HRANA": "/online/bio-in-zdrava-prehrana/c/F08",
        "ZAMRZNJENI IZDELKI": "/online/zamrznjeni-izdelki/c/F09",
        "SLADKI IN SLANI PRIGRIZKI": "/online/prigrizki-in-sladkarije/c/F10",
        "VSE ZA OTROKA": "/online/vse-za-otroka/c/F11",
        "VSE ZA MALE ŽIVALI": "/online/hrana-za-zivali/c/F12",
        "OSEBNA NEGA": "/online/osebna-nega-in-zdravje/c/F13",
        "IZDELKI ZA DOM": "/online/dom-in-prosti-cas/c/F14",
    }

    # Glavne kategorije
    MAIN_CATEGORIES = list(CATEGORY_URLS.keys())

    # BULLETPROOF selektorji - več možnosti za vsak element
    PRODUCT_SELECTORS = [
        '[data-testid*="product"]',
        '[class*="product-tile"]',
        '[class*="ProductTile"]',
        '[class*="product-card"]',
        '[class*="ProductCard"]',
        '.tileOffer',
        'article[class*="product"]',
        '[data-product-id]',
        '[data-ga-action="click_product"]',
        'a[class*="lib-analytics-product"]',
        '.product-item',
        '.product',
    ]

    NAME_SELECTORS = [
        '.lib-analytics-product-link',
        '[data-ga-label]',
        '[data-testid*="name"]',
        '[class*="product-name"]',
        '[class*="ProductName"]',
        '[class*="product-title"]',
        '[class*="ProductTitle"]',
        '[class*="productName"]',
        '[class*="title"]',
        'h2 a', 'h3 a', 'h4 a',
        'h2', 'h3', 'h4',
        'a[title]',
    ]

    IMAGE_SELECTORS = [
        'img[data-testid*="product"]',
        'img[class*="product"]',
        'img[data-src*="product"]',
        'img[src*="product"]',
        'img[data-src]',
        'img[src]',
    ]

    PRICE_SELECTORS = [
        '[class*="price"]',
        '[data-testid*="price"]',
        '[class*="Price"]',
    ]

    def __init__(self, page: Page):
        super().__init__(page)
        self.current_category = ""

    # ==================== NAVIGATION ====================

    def open_categories_menu(self) -> bool:
        """BULLETPROOF odpiranje menija kategorij"""
        self.log("Odpiram meni kategorij...")

        menu_selectors = [
            'button:has-text("Kategorije")',
            '[data-testid*="categories"]',
            '[data-testid*="menu"]',
            '[class*="category-menu"] button',
            '[class*="CategoryMenu"] button',
            '[class*="categoryMenu"] button',
            'button[class*="category"]',
            'button[class*="Category"]',
            '[class*="navigation"] button:has-text("Kategorije")',
            'nav button:has-text("Kategorije")',
            'header button:has-text("Kategorije")',
            'button[aria-label*="kategorij"]',
            'button[aria-label*="menu"]',
        ]

        for selector in menu_selectors:
            try:
                btn = self.page.query_selector(selector)
                if btn and btn.is_visible():
                    btn.click()
                    self.random_delay(1.0, 1.5)
                    self.log("Meni kategorij odprt", "SUCCESS")
                    return True
            except Exception as e:
                continue

        # Fallback - poskusi text selector
        try:
            self.page.click('text="Kategorije"', timeout=5000)
            self.random_delay(1.0, 1.5)
            self.log("Meni kategorij odprt (text)", "SUCCESS")
            return True
        except:
            pass

        self.log("Ne najdem gumba Kategorije", "ERROR")
        return False

    def dismiss_popups(self) -> bool:
        """BULLETPROOF: Zapri vse popup-e (18+, dostava, itd.)"""
        dismissed = False

        # Poskusi večkrat (popup-i se včasih pojavijo z zamikom)
        for attempt in range(3):
            # 1. 18+ popup: "Da, potrjujem" - PRIORITETA!
            try:
                # Več selektorjev za 18+ gumb
                age_selectors = [
                    'button:has-text("Da, potrjujem")',
                    'text="Da, potrjujem"',
                    'button:has-text("potrjujem")',
                    '[class*="modal"] button:has-text("Da")',
                    '[role="dialog"] button:has-text("Da")',
                ]
                for selector in age_selectors:
                    try:
                        btn = self.page.query_selector(selector)
                        if btn and btn.is_visible():
                            btn.click()
                            self.log("18+ popup zaprt", "SUCCESS")
                            time.sleep(0.5)
                            dismissed = True
                            break
                    except:
                        continue
            except:
                pass

            # 2. Dostava popup: "Izberite način prevzema" - klikni X
            try:
                # Ant Design drawer close button
                close_selectors = [
                    '.ant-drawer-close',
                    '[class*="ant-drawer"] .anticon-close',
                    '[class*="ant-drawer"] button[class*="close"]',
                    '[class*="drawer"] svg[class*="close"]',
                    '.ant-modal-close',
                    '[class*="modal"] .anticon-close',
                ]
                for selector in close_selectors:
                    try:
                        btn = self.page.query_selector(selector)
                        if btn and btn.is_visible():
                            btn.click()
                            self.log("Dostava popup zaprt", "SUCCESS")
                            time.sleep(0.5)
                            dismissed = True
                            break
                    except:
                        continue
            except:
                pass

            # 3. Poskusi Escape tipko SAMO za drawer (ne za 18+ modal!)
            try:
                # Preveri ali je drawer odprt (ne modal za 18+!)
                drawer = self.page.query_selector('.ant-drawer-open, [class*="drawer"][class*="open"]')
                if drawer:
                    self.page.keyboard.press("Escape")
                    self.log("Drawer zaprt z Escape", "SUCCESS")
                    time.sleep(0.5)
                    dismissed = True
            except:
                pass

            # Če smo kaj zaprli, počakaj malo in preveri znova
            if dismissed:
                time.sleep(0.3)
                dismissed = False  # Reset za naslednji poskus
            else:
                break  # Ni bilo popup-ov

        return dismissed

    def wait_and_dismiss_popups(self, wait_time: float = 2.0):
        """Počakaj in zapri vse popup-e ki se pojavijo"""
        # Počakaj da se popup-i naložijo
        time.sleep(wait_time)
        # Zapri vse popup-e
        self.dismiss_popups()

    def dismiss_age_popup(self) -> bool:
        """Zapri vse popup-e (wrapper)"""
        return self.dismiss_popups()

    def hover_and_click_category(self, category_name: str) -> tuple[bool, str]:
        """
        BULLETPROOF: Hover na kategorijo + klik na 'Poglejte vse izdelke'
        Vrne (success, url) - url je prazen če ni bil pridobljen
        """
        self.log(f"Hover na kategorijo: {category_name}")

        # Normaliziraj ime kategorije za iskanje (odstrani posebne znake)
        search_name = category_name.upper()

        # 1. Poskusi najti kategorijo v ant-menu
        for attempt in range(3):
            try:
                # Najdi vse menu iteme
                menu_items = self.page.query_selector_all('.ant-menu-submenu-title, .ant-menu-item')

                for item in menu_items:
                    try:
                        item_text = item.inner_text().strip().upper()
                        # Preveri ali se ujema (partial match)
                        if search_name in item_text or item_text in search_name:
                            self.log(f"Najden menu item: {item_text}")

                            # Scroll do elementa
                            item.scroll_into_view_if_needed()
                            time.sleep(0.3)

                            # Hover z Playwright
                            item.hover()
                            self.log(f"Hover uspesen na: {item_text}")
                            time.sleep(2)  # Več časa za prikaz podmenija

                            # DEBUG: Poišči VSE elemente z besedo "poglej" kjerkoli na strani
                            try:
                                poglej_els = self.page.evaluate('''
                                    () => {
                                        const results = [];
                                        // Poišči VSE vidne elemente ki vsebujejo "poglej"
                                        const walker = document.createTreeWalker(
                                            document.body,
                                            NodeFilter.SHOW_TEXT,
                                            null,
                                            false
                                        );
                                        while(walker.nextNode()) {
                                            const text = walker.currentNode.textContent.toLowerCase();
                                            if (text.includes('poglej') || text.includes('vse izdelke')) {
                                                const parent = walker.currentNode.parentElement;
                                                if (parent && parent.offsetParent !== null) {
                                                    results.push({
                                                        text: walker.currentNode.textContent.trim().substring(0, 60),
                                                        tag: parent.tagName,
                                                        classes: parent.className.substring(0, 50)
                                                    });
                                                }
                                            }
                                        }
                                        return results.slice(0, 10);
                                    }
                                ''')
                                self.log(f"DEBUG elementi s 'poglej': {poglej_els}")
                            except Exception as e:
                                self.log(f"DEBUG error: {e}")

                            # Poskusi najti "Poglejte vse izdelke" BUTTON
                            # OPOMBA: Je BUTTON element z razredom LabelButton!
                            # Počakaj da se podmeni popolnoma naloži
                            time.sleep(1)

                            # Najprej poskusi JavaScript klik - najbolj zanesljivo
                            try:
                                clicked = self.page.evaluate('''
                                    () => {
                                        const buttons = document.querySelectorAll('button');
                                        for (const btn of buttons) {
                                            const text = btn.textContent.trim().toLowerCase();
                                            if (text.includes('poglejte vse') && btn.offsetParent !== null) {
                                                btn.click();
                                                return true;
                                            }
                                        }
                                        return false;
                                    }
                                ''')
                                if clicked:
                                    self.log(f"Kliknil gumb z JS: Poglejte vse izdelke")
                                    time.sleep(2)
                                    # Počakaj da se stran naloži
                                    try:
                                        self.page.wait_for_load_state("networkidle", timeout=10000)
                                    except:
                                        pass
                                    self.log(f"Odprl kategorijo: {category_name}", "SUCCESS")
                                    return (True, self.page.url)
                            except Exception as e:
                                self.log(f"JS klik ni uspel: {e}", "WARNING")

                            # Fallback na Playwright selektorje
                            show_all_selectors = [
                                'button:has-text("Poglejte vse izdelke")',
                                '[class*="LabelButton"]:has-text("Poglejte")',
                                'button:has-text("Poglejte vse")',
                            ]

                            for sel in show_all_selectors:
                                try:
                                    btn = self.page.wait_for_selector(sel, timeout=3000)
                                    if btn and btn.is_visible():
                                        self.log(f"Najden gumb ({sel})")
                                        btn.click()
                                        time.sleep(2)
                                        try:
                                            self.page.wait_for_load_state("networkidle", timeout=10000)
                                        except:
                                            pass
                                        self.log(f"Odprl kategorijo: {category_name}", "SUCCESS")
                                        return (True, self.page.url)
                                except:
                                    continue

                    except Exception as e:
                        continue

            except Exception as e:
                self.log(f"Poskus {attempt+1} ni uspel: {e}", "WARNING")

            time.sleep(0.5)

        # 2. Poskusi JavaScript hover z več metodami
        self.log("Poskusam JS hover...")
        try:
            hover_result = self.page.evaluate(f'''
                (() => {{
                    const searchName = "{search_name}";
                    const items = document.querySelectorAll('.ant-menu-submenu-title, .ant-menu-submenu > div, [class*="menu"] li');

                    for (const item of items) {{
                        const text = item.textContent.toUpperCase().trim();
                        if (text.includes(searchName) || searchName.includes(text.split('\\n')[0])) {{
                            // Scroll do elementa
                            item.scrollIntoView({{behavior: 'instant', block: 'center'}});

                            // Trigger vse možne hover evente
                            item.dispatchEvent(new MouseEvent('mouseenter', {{bubbles: true, cancelable: true}}));
                            item.dispatchEvent(new MouseEvent('mouseover', {{bubbles: true, cancelable: true}}));
                            item.dispatchEvent(new MouseEvent('mousedown', {{bubbles: true, cancelable: true}}));
                            item.dispatchEvent(new MouseEvent('mouseup', {{bubbles: true, cancelable: true}}));

                            // Focus za ant-design
                            if (item.focus) item.focus();

                            return true;
                        }}
                    }}
                    return false;
                }})()
            ''')

            if hover_result:
                time.sleep(2)
                # Poskusi JS klik na gumb
                try:
                    clicked = self.page.evaluate('''
                        () => {
                            const buttons = document.querySelectorAll('button');
                            for (const btn of buttons) {
                                const text = btn.textContent.trim().toLowerCase();
                                if (text.includes('poglejte vse') && btn.offsetParent !== null) {
                                    btn.click();
                                    return true;
                                }
                            }
                            return false;
                        }
                    ''')
                    if clicked:
                        self.log(f"Odprl kategorijo (JS hover + JS klik): {category_name}", "SUCCESS")
                        time.sleep(2)
                        try:
                            self.page.wait_for_load_state("networkidle", timeout=10000)
                        except:
                            pass
                        return (True, self.page.url)
                except:
                    pass
        except Exception as e:
            self.log(f"JS hover napaka: {e}", "WARNING")

        # 3. Fallback: Klikni direktno na kategorijo
        self.log("Poskusam direkten klik na kategorijo...")
        try:
            self.page.click(f'text="{category_name}"', timeout=3000)
            self.log(f"Kliknil na tekst kategorije: {category_name}", "SUCCESS")
            time.sleep(2)
            return (True, "")
        except:
            pass

        self.log(f"Ne morem odpreti kategorije: {category_name}", "ERROR")
        return (False, "")

    def scroll_and_load_all(self):
        """Scroll do dna strani za lazy loading - AGRESIVNO"""
        self.log("Scrollam do dna...")

        # Počakaj da se stran stabilizira
        time.sleep(1)

        # Scrollaj v manjših korakih dokler ne pridemo do dna
        for i in range(100):  # Max 100 scrollov
            # Scroll navzdol za 500px
            self.page.evaluate("window.scrollBy(0, 500)")
            time.sleep(0.3)

            # Na vsakih 10 scrollov preveri ali smo na dnu
            if i % 10 == 9:
                is_at_bottom = self.page.evaluate('''
                    () => {
                        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                        const scrollHeight = document.documentElement.scrollHeight;
                        const clientHeight = document.documentElement.clientHeight;
                        return scrollTop + clientHeight >= scrollHeight - 100;
                    }
                ''')
                if is_at_bottom:
                    self.log(f"Prišel do dna po {i+1} scrollih")
                    break

        # Končni scroll čisto na dno
        self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1)

        # Preštej izdelke
        products = self.page.query_selector_all('[data-testid*="product"]')
        self.log(f"Po scrollu: {len(products)} izdelkov na strani")

    def go_to_next_page(self) -> bool:
        """Klikni puščico naprej za naslednjo stran"""
        # SPAR specifični selektorji za paginacijo (ant-design)
        pagination_selectors = [
            # Ant design pagination
            '.ant-pagination-next:not(.ant-pagination-disabled)',
            '.ant-pagination-next button:not([disabled])',
            'li.ant-pagination-next:not(.ant-pagination-disabled) button',

            # Aria labels
            'button[aria-label="Next"]',
            'button[aria-label="next"]',
            'a[aria-label="Naslednja stran"]',

            # Puščice
            '[class*="pagination"] [class*="next"]:not([disabled])',
            'button:has-text("›"):not([disabled])',

            # Generic
            'a:has-text("Naprej")',
            'button:has-text("Naprej")',
        ]

        for selector in pagination_selectors:
            try:
                btn = self.page.query_selector(selector)
                if btn and btn.is_visible():
                    # Preveri da ni disabled
                    class_attr = btn.get_attribute("class") or ""
                    disabled_attr = btn.get_attribute("disabled")
                    aria_disabled = btn.get_attribute("aria-disabled")

                    if disabled_attr or aria_disabled == "true" or "disabled" in class_attr.lower():
                        continue

                    btn.click()
                    self.random_delay(2.0, 2.5)
                    return True
            except:
                continue

        return False

    # ==================== DATA EXTRACTION ====================

    def has_discount_badge(self, element: ElementHandle) -> bool:
        """Preveri ali ima izdelek oznako popusta"""
        try:
            text = element.inner_text().lower()

            # "Prihranek X,XX €"
            if re.search(r"prihran[ie]k\s*\d+[,.]\d{2}", text, re.I):
                return True

            # "Prej X,XX €"
            if re.search(r"prej\s+\d+[,.]\d{2}", text, re.I):
                return True

            # Procenti (-20%, -15%, itd)
            if re.search(r"-\s*\d{1,2}\s*%", text):
                return True

            # Besede za akcijo
            discount_words = ["akcija", "znižano", "popust", "trajno nizka", "super cena", "ugodno"]
            if any(w in text for w in discount_words):
                return True

            # CSS elementi za popust
            discount_selectors = [
                '[class*="discount"]',
                '[class*="Discount"]',
                '[class*="sale"]',
                '[class*="Sale"]',
                '[class*="promo"]',
                '[class*="action"]',
                '[class*="badge"]',
                'del', 's', 'strike',
                '[class*="old-price"]',
                '[class*="oldPrice"]',
            ]
            for sel in discount_selectors:
                el = element.query_selector(sel)
                if el:
                    return True

            return False
        except:
            return False

    def extract_product_data(self, element: ElementHandle, category: str = "") -> Optional[dict]:
        """
        BULLETPROOF ekstrakcija podatkov izdelka.

        SPAR SPECIFIČNO (iz content.js):
        - "Prej X,XX €" = stara/redna cena
        - Ignorira "Prihranek X,XX €" (to je prihranek, NE cena!)
        - Ignorira PC kode (PC30:1,39 €)
        - Ignorira cene na enoto (/kg, /kos, /l)
        """
        try:
            # ===== IME =====
            name = ""
            for selector in self.NAME_SELECTORS:
                try:
                    el = element.query_selector(selector)
                    if el:
                        # Poskusi title atribut najprej
                        name = el.get_attribute("title") or ""
                        if not name:
                            name = el.inner_text()

                        name = re.sub(r"\s+", " ", name).strip()

                        # Odstrani ceno iz imena če je
                        name = re.sub(r"\d+[,.]\d{2}\s*€.*", "", name).strip()

                        if self.is_valid_name(name):
                            break
                        else:
                            name = ""
                except:
                    continue

            if not name:
                return None

            # ===== CENE - SPAR SPECIFIČNO =====
            text = element.inner_text()
            has_discount = self.has_discount_badge(element)

            regular_price = None
            sale_price = None

            # 1. "Prej X,XX €" = stara/redna cena
            prej_match = re.search(r"prej\s+([\d]+)[,.](\d{2})\s*€?", text, re.I)
            if prej_match:
                regular_price = float(f"{prej_match.group(1)}.{prej_match.group(2)}")

            # 2. Očisti tekst - odstrani vse kar NI glavna cena
            clean = text

            # Odstrani "Prej X,XX €"
            clean = re.sub(r"prej\s+\d+[,.]\d{2}\s*€?", " ", clean, flags=re.I)

            # Odstrani "Prihranek X,XX €" (to je prihranek, NE cena!)
            clean = re.sub(r"prihran[ie]k\s+\d+[,.]\d{2}\s*€?", " ", clean, flags=re.I)

            # Odstrani PC kode in njihove cene (PC30:1,39 €, PC20 2,49€)
            clean = re.sub(r"PC\d+\s*:?\s*\d+[,.]\d{2}\s*€?", " ", clean, flags=re.I)

            # Odstrani cene na enoto
            clean = re.sub(r"\d+[,.]\d{2}\s*€?\s*/\s*\d*\s*(kg|kos|kom|l|ml|g|m)\b", " ", clean, flags=re.I)
            clean = re.sub(r"(kg|kos|kom|l)\s+za\s+\d+[,.]\d{2}\s*€?", " ", clean, flags=re.I)
            clean = re.sub(r"za\s+\d+[,.]\d{2}\s*€?\s*/?k?g", " ", clean, flags=re.I)

            # Odstrani teže (0.15KG, 500g, 1.5L, itd)
            clean = re.sub(r"\d+[,.]\d*\s*k?g\b", " ", clean, flags=re.I)
            clean = re.sub(r"\d+\s*g\b", " ", clean, flags=re.I)
            clean = re.sub(r"\d+[,.]\d*\s*m?l\b", " ", clean, flags=re.I)

            # 3. Najdi preostale cene
            prices = []
            for m in re.finditer(r"(\d+)[,.](\d{2})\s*€?", clean):
                val = float(f"{m.group(1)}.{m.group(2)}")
                if self.is_valid_price(val) and val not in prices:
                    prices.append(val)

            # 4. Določi katero ceno je katera
            if regular_price and prices:
                # Imamo "Prej" ceno (redna), najnižja preostala je akcijska
                sale_price = min(prices)
                # Preveri da akcijska ni višja od redne
                if sale_price >= regular_price:
                    sale_price = None
            elif len(prices) == 1:
                # Samo ena cena - to je redna cena, ni akcije
                regular_price = prices[0]
            elif len(prices) >= 2:
                # Več cen - sortiraj
                prices.sort()
                if has_discount:
                    # IMA AKCIJO: najvišja = redna, najnižja = akcijska
                    regular_price = max(prices)
                    sale_price = min(prices)
                    if sale_price == regular_price:
                        sale_price = None
                else:
                    # Ni akcije - vzemi najnižjo kot redno
                    regular_price = min(prices)

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

            # ===== ENOTA (iz imena) =====
            unit_match = re.search(r"(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|dl|kos|kom)\b", name, re.I)
            unit = ""
            if unit_match:
                unit = f"{unit_match.group(1)}{unit_match.group(2).lower()}"

            return {
                "ime": name,
                "redna_cena": regular_price,
                "akcijska_cena": sale_price,
                "kategorija": category or self.current_category,
                "enota": unit,
                "trgovina": self.STORE_NAME,
                "slika": image if image else None,
                "url": self.page.url,
            }

        except Exception as e:
            self.log(f"Napaka pri ekstrakciji: {e}", "WARNING")
            return None

    def scrape_current_page(self, category: str) -> list[dict]:
        """Scrapaj vse izdelke na trenutni strani"""
        products = []
        found_unavailable = False

        # Poskusi več selektorjev
        for selector in self.PRODUCT_SELECTORS:
            try:
                elements = self.page.query_selector_all(selector)
                if not elements or len(elements) < 3:
                    continue

                self.log(f"Najdenih {len(elements)} elementov s selektorjem: {selector}")

                for el in elements:
                    try:
                        # Preveri ali je izdelek "ni na voljo"
                        text = el.inner_text().lower()
                        if "ni na voljo" in text or "ni več na voljo" in text:
                            self.log("Najden izdelek ki ni na voljo - preskacem ostale")
                            found_unavailable = True
                            break

                        product = self.extract_product_data(el, category)
                        if product and self.add_product(product):
                            products.append(product)
                    except Exception as e:
                        continue

                if found_unavailable:
                    break

                if products:
                    break  # Našli smo izdelke, ne rabimo več selektorjev

            except Exception as e:
                continue

        # Če smo našli nedostopen izdelek, označimo da je konec te kategorije
        if found_unavailable:
            self.log("Konec kategorije - izdelki niso več na voljo")

        return products

    def scrape_category(self, category_name: str) -> list[dict]:
        """Scraping ene kategorije - HOVER + KLIK, z URL fallback"""
        products = []
        self.current_category = category_name.title()

        self.log(f"=" * 50)
        self.log(f"KATEGORIJA: {category_name}")
        self.log(f"=" * 50)

        category_opened = False
        category_url_from_menu = ""

        # Scroll na vrh strani
        self.page.evaluate("window.scrollTo(0, 0)")
        time.sleep(0.5)

        # Odpri meni Kategorije
        self.log("Odpiram meni kategorij...")
        try:
            self.page.click('button:has-text("Kategorije")', timeout=5000)
            time.sleep(1.5)

            # Hover na kategorijo + klik "Pokaži vse izdelke"
            success, url = self.hover_and_click_category(category_name)
            if success:
                category_opened = True
                if url:
                    category_url_from_menu = url
                    self.log(f"Pridobljen URL iz menija: {url}")
        except Exception as e:
            self.log(f"Ne najdem gumba Kategorije - poskusam direkten URL: {e}", "WARNING")

        # FALLBACK: Direkten URL za kategorijo
        if not category_opened:
            # Najprej poskusi URL ki smo ga dobili iz menija
            if category_url_from_menu:
                full_url = category_url_from_menu if category_url_from_menu.startswith("http") else f"{self.BASE_URL}{category_url_from_menu}"
                self.log(f"Fallback - URL iz menija: {full_url}")
                if self.safe_goto(full_url, wait_until="networkidle", timeout=30000):
                    category_opened = True
                    self.log(f"Odprl kategorijo z URL iz menija: {category_name}", "SUCCESS")

            # Potem poskusi preddefinirani URL
            if not category_opened and category_name in self.CATEGORY_URLS:
                category_url = f"{self.BASE_URL}{self.CATEGORY_URLS[category_name]}"
                self.log(f"Fallback - preddefinirani URL: {category_url}")
                if self.safe_goto(category_url, wait_until="networkidle", timeout=30000):
                    category_opened = True
                    self.log(f"Odprl kategorijo z direktnim URL: {category_name}", "SUCCESS")

        if not category_opened:
            self.log(f"Ne morem odpreti kategorije: {category_name}", "ERROR")
            return products

        # POMEMBNO: Počakaj in zapri VSE popup-e (18+, dostava, itd.)
        self.wait_and_dismiss_popups(3.0)

        # 3. Počakaj da se izdelki naložijo
        self.log("Cakam na izdelke...")
        try:
            self.page.wait_for_load_state("networkidle", timeout=15000)
        except:
            pass
        time.sleep(2)

        # Scrapaj vse strani
        page_num = 1
        max_pages = 50

        while page_num <= max_pages:
            self.log(f"Stran {page_num}...")

            # Scroll za lazy loading
            self.scroll_and_load_all()

            # Preveri ali so izdelki "ni na voljo"
            page_text = self.page.inner_text("body").lower()
            if "ni na voljo" in page_text and page_num > 1:
                # Preveri koliko izdelkov ni na voljo
                unavailable_count = page_text.count("ni na voljo")
                if unavailable_count > 5:
                    self.log(f"Najdenih {unavailable_count} nedostopnih izdelkov - koncujem kategorijo")
                    break

            # Scrapaj izdelke
            page_products = self.scrape_current_page(self.current_category)
            products.extend(page_products)

            self.log(f"Stran {page_num}: {len(page_products)} izdelkov (skupaj: {len(products)})")

            # Ce ni bilo novih izdelkov, konec
            if len(page_products) == 0:
                self.log("Ni novih izdelkov - koncujem")
                break

            # Pojdi na naslednjo stran
            if not self.go_to_next_page():
                self.log("Ni več strani")
                break

            page_num += 1

            try:
                self.page.wait_for_load_state("networkidle", timeout=10000)
            except:
                pass

            # POMEMBNO: Počakaj in zapri VSE popup-e (18+, dostava, itd.)
            self.wait_and_dismiss_popups(2.0)

            self.random_delay(0.5, 1.0)

        self.log(f"{category_name}: KONČANO - {len(products)} izdelkov", "SUCCESS")
        return products

    def scrape_all(self) -> list[dict]:
        """Scraping vseh kategorij"""
        self.start()

        # 1. Odpri SPAR online
        self.log(f"Odpiranje: {self.ONLINE_URL}")
        if not self.safe_goto(self.ONLINE_URL, wait_until="networkidle", timeout=30000):
            self.log("Ne morem odpreti SPAR!", "ERROR")
            return []

        # 2. Sprejmi piskotke
        self.log("Sprejemam piskotke...")
        self.accept_cookies()
        time.sleep(1)

        # 3. Počakaj in zapri vse popup-e (18+, dostava, itd.)
        self.wait_and_dismiss_popups(3.0)

        self.log(f"Kategorij: {len(self.MAIN_CATEGORIES)}")

        # 3. Scrapaj vsako kategorijo
        for i, category_name in enumerate(self.MAIN_CATEGORIES):
            self.log(f"\n[{i+1}/{len(self.MAIN_CATEGORIES)}] {category_name}")

            try:
                products = self.scrape_category(category_name)
                self.random_delay(1.0, 2.0)

                # Vrni se na glavno stran za naslednjo kategorijo
                self.safe_goto(self.ONLINE_URL, wait_until="networkidle")
                time.sleep(1)

            except Exception as e:
                self.log(f"Napaka pri {category_name}: {e}", "ERROR")
                self.take_screenshot(f"error_{category_name[:20]}", on_error=True)
                self.metrics.errors += 1

                # Vrni se na glavno stran
                try:
                    self.safe_goto(self.ONLINE_URL)
                except:
                    pass

        self.finish()
        return self.products
