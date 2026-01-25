"""
ULTIMATE BULLETPROOF Base Scraper
=================================
Najpopolnejši možni scraper z vsemi izboljšavami!

FEATURES:
- Screenshot on error za debugging
- Network optimization - blokiraj nepotrebne requeste
- Smart waiting - čakaj na elemente, ne fiksni čas
- Self-healing selectors - avtomatsko poišči alternative
- Quality scoring - oceni kvaliteto podatkov
- Resume capability - nadaljuj od checkpointa
- Health checks - preveri stanje strani
- Structured logging z file output
- Metrics collection
- Adaptive delays glede na response time
"""
import re
import os
import time
import random
import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable, Any, List, Dict, Tuple
from dataclasses import dataclass, field, asdict
from playwright.sync_api import Page, ElementHandle, TimeoutError as PlaywrightTimeout, Response


class ScraperError(Exception):
    """Custom scraper exception"""
    pass


@dataclass
class ScrapingMetrics:
    """Metrike scrapanja za analizo"""
    start_time: datetime = None
    end_time: datetime = None
    pages_scraped: int = 0
    products_found: int = 0
    products_valid: int = 0
    products_invalid: int = 0
    duplicates: int = 0
    retries: int = 0
    errors: int = 0
    screenshots_taken: int = 0
    avg_page_load_time: float = 0.0
    avg_products_per_page: float = 0.0
    blocked_requests: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ProductQuality:
    """Ocena kvalitete podatkov izdelka"""
    has_name: bool = False
    has_price: bool = False
    has_image: bool = False
    has_category: bool = False
    has_unit: bool = False
    name_length_ok: bool = False
    price_reasonable: bool = False
    image_url_valid: bool = False

    @property
    def score(self) -> int:
        """Vrni score 0-100"""
        checks = [
            self.has_name * 20,
            self.has_price * 25,
            self.has_image * 20,
            self.has_category * 10,
            self.has_unit * 10,
            self.name_length_ok * 5,
            self.price_reasonable * 5,
            self.image_url_valid * 5,
        ]
        return sum(checks)

    @property
    def is_acceptable(self) -> bool:
        """Ali je kvaliteta sprejemljiva (min 50)"""
        return self.score >= 50


class BulletproofScraper:
    """ULTIMATE Base class za vse scraperje"""

    STORE_NAME = "Unknown"
    BASE_URL = ""

    # ==================== RETRY CONFIG ====================
    MAX_RETRIES = 5  # Povečano iz 3
    RETRY_DELAYS = [1, 2, 4, 8, 16]  # Exponential backoff

    # ==================== TIMING CONFIG ====================
    MIN_DELAY = 0.3
    MAX_DELAY = 1.5
    PAGE_LOAD_DELAY = 1.0
    SCROLL_DELAY = 0.8

    # Adaptive delays
    ADAPTIVE_DELAY_ENABLED = True
    SLOW_RESPONSE_THRESHOLD = 3.0  # sekund
    FAST_RESPONSE_THRESHOLD = 0.5

    # ==================== VALIDATION CONFIG ====================
    MIN_PRICE = 0.01
    MAX_PRICE = 9999
    MIN_NAME_LENGTH = 2
    MAX_NAME_LENGTH = 500
    MIN_QUALITY_SCORE = 45  # Minimalna kvaliteta za sprejem

    # ==================== NETWORK CONFIG ====================
    BLOCK_RESOURCES = False  # IZKLOPLJENO za debugging
    # NE blokiraj stylesheet-ov, potrebni so za pravilno delovanje!
    BLOCKED_RESOURCE_TYPES = []  # Nič ne blokiraj
    BLOCKED_URLS = [
        "google-analytics", "googletagmanager", "facebook", "doubleclick",
        "analytics", "tracking", "hotjar", "clarity", "mouseflow",
        "hubspot", "intercom", "crisp", "drift", "tawk",
        "ads", "advertising", "banner",
    ]

    # ==================== PROGRESS CONFIG ====================
    SAVE_PROGRESS_EVERY = 25  # Bolj pogosto shranjevanje
    CHECKPOINT_ENABLED = True

    # ==================== SCREENSHOT CONFIG ====================
    SCREENSHOT_ON_ERROR = True
    MAX_SCREENSHOTS = 50  # Max screenshots per run

    def __init__(self, page: Page, headless: bool = True):
        self.page = page
        self.headless = headless
        self.products = []
        self.seen = set()
        self.errors = []
        self.metrics = ScrapingMetrics()

        # Directories
        self.base_dir = Path(__file__).parent.parent
        self.progress_dir = self.base_dir / "progress"
        self.screenshots_dir = self.base_dir / "screenshots"
        self.logs_dir = self.base_dir / "logs"
        self.checkpoints_dir = self.base_dir / "checkpoints"

        # Create directories
        for d in [self.progress_dir, self.screenshots_dir, self.logs_dir, self.checkpoints_dir]:
            d.mkdir(exist_ok=True)

        # State
        self.start_time = None
        self.current_category = ""
        self.last_response_time = 1.0
        self.screenshot_count = 0
        self.page_load_times = []

        # Checkpoint
        self.checkpoint_file = None
        self.completed_categories = set()

        # Log file
        self.log_file = None

        # Setup network optimization
        if self.BLOCK_RESOURCES:
            self._setup_network_optimization()

    # ==================== NETWORK OPTIMIZATION ====================

    def _setup_network_optimization(self):
        """Blokiraj nepotrebne requeste za hitrejše nalaganje"""
        def handle_route(route):
            request = route.request
            resource_type = request.resource_type
            url = request.url.lower()

            # Block by resource type
            if resource_type in self.BLOCKED_RESOURCE_TYPES:
                self.metrics.blocked_requests += 1
                route.abort()
                return

            # Block by URL pattern
            for blocked in self.BLOCKED_URLS:
                if blocked in url:
                    self.metrics.blocked_requests += 1
                    route.abort()
                    return

            route.continue_()

        try:
            self.page.route("**/*", handle_route)
        except Exception as e:
            self.log(f"Network optimization setup failed: {e}", "WARNING")

    # ==================== LOGGING ====================

    def log(self, message: str, level: str = "INFO"):
        """Structured logging z file output (Windows-safe)"""
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        prefix = f"[{timestamp}] [{self.STORE_NAME}]"

        # Windows-safe symbols instead of emoji
        symbol = {
            "ERROR": "[X]",
            "WARNING": "[!]",
            "SUCCESS": "[OK]",
            "DEBUG": "[?]",
            "PROGRESS": "[#]",
        }.get(level, "")

        log_line = f"{prefix} {symbol} {message}" if symbol else f"{prefix} {message}"

        # Console output (safe for Windows)
        try:
            print(log_line, flush=True)
        except UnicodeEncodeError:
            # Fallback: remove problematic characters
            safe_line = log_line.encode('ascii', 'replace').decode('ascii')
            print(safe_line, flush=True)

        # File output
        if self.log_file:
            try:
                with open(self.log_file, "a", encoding="utf-8") as f:
                    f.write(log_line + "\n")
            except:
                pass

    def log_stats(self):
        """Izpiši podrobno statistiko"""
        m = self.metrics

        self.log("=" * 60)
        self.log(f"STATISTIKA {self.STORE_NAME}", "PROGRESS")
        self.log("-" * 60)
        self.log(f"  Strani:           {m.pages_scraped}")
        self.log(f"  Najdenih:         {m.products_found}")
        self.log(f"  Veljavnih:        {m.products_valid}")
        self.log(f"  Neveljavnih:      {m.products_invalid}")
        self.log(f"  Duplikatov:       {m.duplicates}")
        self.log(f"  Ponovitev:        {m.retries}")
        self.log(f"  Napak:            {m.errors}")
        self.log(f"  Screenshotov:     {m.screenshots_taken}")
        self.log(f"  Blokiranih req:   {m.blocked_requests}")

        if m.pages_scraped > 0:
            m.avg_products_per_page = m.products_valid / m.pages_scraped
            self.log(f"  Povp. izdelkov/stran: {m.avg_products_per_page:.1f}")

        if self.page_load_times:
            m.avg_page_load_time = sum(self.page_load_times) / len(self.page_load_times)
            self.log(f"  Povp. čas nalaganja: {m.avg_page_load_time:.2f}s")

        if m.start_time and m.end_time:
            duration = m.end_time - m.start_time
            self.log(f"  Trajanje:         {duration}")

        self.log("=" * 60)

    # ==================== SCREENSHOTS ====================

    def take_screenshot(self, name: str = None, on_error: bool = False) -> Optional[str]:
        """Naredi screenshot za debugging"""
        if on_error and not self.SCREENSHOT_ON_ERROR:
            return None

        if self.screenshot_count >= self.MAX_SCREENSHOTS:
            return None

        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            suffix = f"_error" if on_error else ""
            filename = f"{self.STORE_NAME.lower()}_{name or 'page'}_{timestamp}{suffix}.png"
            filepath = self.screenshots_dir / filename

            self.page.screenshot(path=str(filepath), full_page=True)
            self.screenshot_count += 1
            self.metrics.screenshots_taken += 1

            self.log(f"Screenshot: {filename}", "DEBUG")
            return str(filepath)
        except Exception as e:
            self.log(f"Screenshot failed: {e}", "WARNING")
            return None

    # ==================== SMART WAITING ====================

    def smart_wait(self, selector: str = None, timeout: int = 10000, state: str = "visible") -> bool:
        """
        Pametno čakanje - čakaj na element ali network idle.
        Boljše kot fiksni time.sleep()!
        """
        try:
            if selector:
                self.page.wait_for_selector(selector, timeout=timeout, state=state)
            else:
                self.page.wait_for_load_state("networkidle", timeout=timeout)
            return True
        except PlaywrightTimeout:
            return False
        except Exception as e:
            self.log(f"Smart wait error: {e}", "WARNING")
            return False

    def wait_for_products(self, selectors: List[str], timeout: int = 15000) -> Optional[str]:
        """Počakaj da se pojavijo izdelki - vrne prvi selector ki dela"""
        for selector in selectors:
            try:
                self.page.wait_for_selector(selector, timeout=timeout // len(selectors), state="visible")
                # Preveri da je vsaj 1 element
                elements = self.page.query_selector_all(selector)
                if elements and len(elements) > 0:
                    return selector
            except:
                continue
        return None

    def adaptive_delay(self):
        """Prilagodi zakasnitev glede na hitrost odziva"""
        if not self.ADAPTIVE_DELAY_ENABLED:
            self.random_delay()
            return

        # Če je stran počasna, čakaj dlje
        if self.last_response_time > self.SLOW_RESPONSE_THRESHOLD:
            delay = random.uniform(self.MAX_DELAY, self.MAX_DELAY * 2)
        elif self.last_response_time < self.FAST_RESPONSE_THRESHOLD:
            delay = random.uniform(self.MIN_DELAY, self.MIN_DELAY * 2)
        else:
            delay = random.uniform(self.MIN_DELAY, self.MAX_DELAY)

        time.sleep(delay)

    def random_delay(self, min_delay: float = None, max_delay: float = None):
        """Naključna zakasnitev"""
        if min_delay is None:
            min_delay = self.MIN_DELAY
        if max_delay is None:
            max_delay = self.MAX_DELAY
        time.sleep(random.uniform(min_delay, max_delay))

    # ==================== RETRY LOGIC ====================

    def retry_on_failure(
        self,
        func: Callable,
        *args,
        max_retries: int = None,
        screenshot_on_fail: bool = True,
        **kwargs
    ) -> Any:
        """
        ULTIMATE retry z exponential backoff, jitter, in screenshots.
        """
        if max_retries is None:
            max_retries = self.MAX_RETRIES

        last_error = None

        for attempt in range(max_retries + 1):
            try:
                start = time.time()
                result = func(*args, **kwargs)
                self.last_response_time = time.time() - start
                return result

            except Exception as e:
                last_error = e
                self.metrics.retries += 1

                if attempt < max_retries:
                    delay = self.RETRY_DELAYS[min(attempt, len(self.RETRY_DELAYS) - 1)]
                    # Dodaj jitter (±20%)
                    jitter = delay * random.uniform(-0.2, 0.2)
                    delay += jitter

                    self.log(f"Poskus {attempt + 1}/{max_retries + 1} ni uspel: {str(e)[:100]}", "WARNING")
                    self.log(f"Čakam {delay:.1f}s...", "WARNING")

                    time.sleep(delay)
                else:
                    self.log(f"Vsi poskusi spodleteli: {str(e)[:200]}", "ERROR")
                    self.metrics.errors += 1

                    # Screenshot on final failure
                    if screenshot_on_fail:
                        self.take_screenshot(f"error_{func.__name__}", on_error=True)

                    self.errors.append({
                        "function": func.__name__,
                        "error": str(e),
                        "timestamp": datetime.now().isoformat(),
                        "url": self.page.url,
                    })

        return None

    # ==================== HEALTH CHECKS ====================

    def health_check(self) -> Dict[str, bool]:
        """Preveri zdravje strani - ali je vse OK"""
        checks = {
            "page_loaded": False,
            "no_error_page": False,
            "has_content": False,
            "no_captcha": False,
            "no_blocked": False,
        }

        try:
            # Page loaded
            checks["page_loaded"] = self.page.url.startswith("http")

            # No error page
            title = self.page.title().lower()
            body_text = self.page.inner_text("body")[:1000].lower()

            error_indicators = ["404", "not found", "error", "napaka", "ni najdeno", "blocked", "access denied"]
            checks["no_error_page"] = not any(e in title or e in body_text for e in error_indicators)

            # Has content
            checks["has_content"] = len(body_text) > 500

            # No CAPTCHA
            captcha_indicators = ["captcha", "recaptcha", "hcaptcha", "robot", "verify"]
            checks["no_captcha"] = not any(c in body_text for c in captcha_indicators)

            # No blocked
            blocked_indicators = ["blocked", "forbidden", "access denied", "too many requests"]
            checks["no_blocked"] = not any(b in body_text for b in blocked_indicators)

        except Exception as e:
            self.log(f"Health check error: {e}", "WARNING")

        # Log issues
        failed = [k for k, v in checks.items() if not v]
        if failed:
            self.log(f"Health check issues: {failed}", "WARNING")
            self.take_screenshot("health_check_fail", on_error=True)

        return checks

    def is_healthy(self) -> bool:
        """Ali je stran v zdravem stanju"""
        checks = self.health_check()
        return all(checks.values())

    # ==================== SELF-HEALING SELECTORS ====================

    def find_elements_smart(self, selectors: List[str], min_count: int = 1) -> Tuple[List[ElementHandle], str]:
        """
        SELF-HEALING: Poskusi več selektorjev in vrni prvi ki dela.
        Če noben ne dela, poskusi najti podobne elemente.
        """
        # 1. Poskusi vse selektorje
        for selector in selectors:
            try:
                elements = self.page.query_selector_all(selector)
                if elements and len(elements) >= min_count:
                    return elements, selector
            except:
                continue

        # 2. Poskusi najti po atributih
        fallback_patterns = [
            '[data-testid]',
            '[data-product]',
            '[data-item]',
            '[class*="product"]',
            '[class*="item"]',
            '[class*="card"]',
            'article',
            '.product',
            '.item',
        ]

        for pattern in fallback_patterns:
            try:
                elements = self.page.query_selector_all(pattern)
                # Filtriraj - mora imeti ceno
                valid = []
                for el in elements:
                    text = el.inner_text()
                    if re.search(r"\d+[,.]\d{2}\s*€", text):
                        valid.append(el)

                if len(valid) >= min_count:
                    self.log(f"Self-healing: uporabil fallback {pattern}", "WARNING")
                    return valid, pattern
            except:
                continue

        self.log("Self-healing: ni našel elementov", "ERROR")
        return [], ""

    def extract_text_smart(self, element: ElementHandle, selectors: List[str]) -> str:
        """SELF-HEALING ekstrakcija teksta"""
        # 1. Poskusi vse selektorje
        for selector in selectors:
            try:
                el = element.query_selector(selector)
                if el:
                    text = el.get_attribute("title") or el.inner_text()
                    text = re.sub(r"\s+", " ", text).strip()
                    if len(text) > 2:
                        return text
            except:
                continue

        # 2. Fallback - vzemi prvi heading
        for tag in ['h1', 'h2', 'h3', 'h4', 'a[title]', 'a']:
            try:
                el = element.query_selector(tag)
                if el:
                    text = el.get_attribute("title") or el.inner_text()
                    text = re.sub(r"\s+", " ", text).strip()
                    # Odstrani cene
                    text = re.sub(r"\d+[,.]\d{2}\s*€.*", "", text).strip()
                    if 3 < len(text) < 200:
                        return text
            except:
                continue

        return ""

    # ==================== NAVIGATION ====================

    def safe_goto(self, url: str, wait_until: str = "domcontentloaded", timeout: int = 30000) -> bool:
        """ULTIMATE varno nalaganje strani"""
        def _goto():
            start = time.time()
            response = self.page.goto(url, wait_until=wait_until, timeout=timeout)
            load_time = time.time() - start
            self.page_load_times.append(load_time)
            self.last_response_time = load_time

            # Preveri response
            if response and response.status >= 400:
                raise ScraperError(f"HTTP {response.status}")

            return True

        result = self.retry_on_failure(_goto)

        if result:
            self.adaptive_delay()

            # NAJPREJ sprejmi piskotke (cookie popup blokira vse!)
            self.accept_cookies()

            # Nato zapri druge popupe
            self.close_popups()

            # Health check SELE PO sprejetju piskotkov
            # Ne obravnavamo kot napako ce ni "healthy" - nadaljujemo
            # if not self.is_healthy():
            #     self.log(f"Unhealthy page: {url}", "WARNING")

            return True
        return False

    def safe_click(self, selector: str, timeout: int = 5000) -> bool:
        """Varno klikanje"""
        def _click():
            el = self.page.wait_for_selector(selector, timeout=timeout, state="visible")
            if el:
                el.scroll_into_view_if_needed()
                el.click()
                return True
            return False

        return self.retry_on_failure(_click, max_retries=2) or False

    def safe_scroll(self, direction: str = "down", amount: int = None):
        """Varno scrollanje z adaptive delay"""
        try:
            if direction == "down":
                if amount:
                    self.page.evaluate(f"window.scrollBy(0, {amount})")
                else:
                    self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            elif direction == "up":
                self.page.evaluate("window.scrollTo(0, 0)")

            time.sleep(self.SCROLL_DELAY)
        except Exception as e:
            self.log(f"Scroll error: {e}", "WARNING")

    # ==================== ANTI-DETECTION ====================

    def accept_cookies(self) -> bool:
        """ULTIMATE sprejem piškotkov - 30+ selektorjev"""

        # Počakaj da se popup pojavi
        time.sleep(1.5)

        cookie_selectors = [
            # SPAR specifično - CookieBot
            '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
            '#CybotCookiebotDialogBodyButtonAccept',
            '#CybotCookiebotDialogBodyLevelButtonAccept',
            'a#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
            'a.CybotCookiebotDialogBodyLevelButton',
            '.CybotCookiebotDialogBodyButton',
            '[id*="CybotCookiebot"][id*="Allow"]',
            '[class*="CybotCookiebot"] a:has-text("Dovoli vse")',
            '[class*="CybotCookiebot"] button:has-text("Dovoli vse")',

            # OneTrust
            '#onetrust-accept-btn-handler',
            '#onetrust-accept-all-handler',
            '.onetrust-accept-btn',

            # Didomi
            '#didomi-notice-agree-button',
            '.didomi-continue-without-agreeing',

            # Generic class patterns
            'button[class*="cookie"][class*="accept"]',
            'button[class*="accept"][class*="cookie"]',
            'button[class*="consent"][class*="accept"]',
            'button[class*="accept"][class*="all"]',
            '[class*="cookie-banner"] button[class*="accept"]',
            '[class*="cookie-consent"] button[class*="accept"]',
            '[class*="cookie-notice"] button[class*="accept"]',
            '[class*="gdpr"] button[class*="accept"]',
            '[class*="privacy"] button[class*="accept"]',

            # ID patterns
            '#accept-cookies',
            '#acceptCookies',
            '#cookie-accept',
            '#cookieAccept',
            '#cookies-accept',

            # Slovenščina - več možnosti
            'button:has-text("Sprejmi vse")',
            'button:has-text("Sprejmi")',
            'button:has-text("Strinjam se")',
            'button:has-text("V redu")',
            'button:has-text("Dovoli vse")',
            'button:has-text("Dovoli")',
            'button:has-text("Potrdi")',
            'button:has-text("Soglašam")',
            'a:has-text("Dovoli vse")',
            'a:has-text("Sprejmi vse")',
            '*:has-text("Dovoli vse"):visible',

            # Angleščina
            'button:has-text("Accept all")',
            'button:has-text("Accept")',
            'button:has-text("Allow all")',
            'button:has-text("Allow")',
            'button:has-text("OK")',
            'button:has-text("I agree")',
            'button:has-text("Agree")',
            'button:has-text("Got it")',

            # Aria labels
            'button[aria-label*="accept"]',
            'button[aria-label*="Accept"]',
            'button[aria-label*="sprejmi"]',
            'button[aria-label*="cookie"]',
        ]

        # Poskusi večkrat
        for attempt in range(3):
            for selector in cookie_selectors:
                try:
                    btn = self.page.query_selector(selector)
                    if btn and btn.is_visible():
                        btn.click()
                        self.random_delay(0.5, 1.0)
                        self.log("Piskotki sprejeti", "SUCCESS")
                        return True
                except:
                    continue

            # Počakaj in poskusi znova
            time.sleep(0.5)

        # Fallback - klikni kjerkoli na "Dovoli vse"
        try:
            self.page.click('text="Dovoli vse"', timeout=3000)
            self.log("Piskotki sprejeti (text)", "SUCCESS")
            return True
        except:
            pass

        return False

    def close_popups(self):
        """ULTIMATE SMART zapiranje popup-ov - skenira in zapre VSE"""
        self._smart_close_all_popups()

    def _smart_close_all_popups(self, max_attempts: int = 5):
        """
        PAMETEN POPUP CLOSER - skenira stran za popup-e in jih zapre.
        Deluje kot pravi bot - išče modal/dialog elemente in najde X gumb.
        """
        closed_total = 0

        for attempt in range(max_attempts):
            closed_this_round = 0

            # KORAK 1: Najdi VSE vidne modale/dialoge/popupe
            modal_selectors = [
                '[role="dialog"]',
                '[role="alertdialog"]',
                '[class*="Modal"]',
                '[class*="modal"]',
                '[class*="Popup"]',
                '[class*="popup"]',
                '[class*="Dialog"]',
                '[class*="dialog"]',
                '[class*="Overlay"][class*="visible"]',
                '[class*="overlay"][class*="active"]',
                '[data-modal]',
                '[data-popup]',
                '[data-dialog]',
            ]

            for modal_sel in modal_selectors:
                try:
                    modals = self.page.query_selector_all(modal_sel)
                    for modal in modals:
                        if modal.is_visible():
                            if self._close_modal(modal):
                                closed_this_round += 1
                                time.sleep(0.3)
                except:
                    continue

            # KORAK 2: Poišči samostojne X gumbe (izven modalov)
            close_selectors = [
                '[aria-label="close"]',
                '[aria-label="Close"]',
                '[aria-label="zapri"]',
                '[aria-label="Zapri"]',
                'button[class*="close"]',
                'button[class*="Close"]',
                '[class*="close-button"]',
                '[class*="close-btn"]',
                '[class*="modal-close"]',
                'button:has-text("×")',
                'button:has-text("✕")',
                'button:has-text("✖")',
            ]

            for sel in close_selectors:
                try:
                    btns = self.page.query_selector_all(sel)
                    for btn in btns[:2]:
                        if btn.is_visible():
                            btn.click()
                            closed_this_round += 1
                            time.sleep(0.3)
                except:
                    continue

            closed_total += closed_this_round

            # Če nismo zaprli nič, končaj
            if closed_this_round == 0:
                break

            time.sleep(0.5)

        # KORAK 3: Escape kot fallback
        try:
            self.page.keyboard.press("Escape")
            time.sleep(0.3)
        except:
            pass

        if closed_total > 0:
            self.log(f"Smart popup closer: zaprtih {closed_total} popup-ov", "DEBUG")

    def _close_modal(self, modal) -> bool:
        """
        Zapri posamezni modal - najdi X gumb ZNOTRAJ modala.
        Vrne True če je uspešno zaprl.
        """
        try:
            # Selektorji za X gumb znotraj modala
            close_selectors = [
                '[aria-label="close"]',
                '[aria-label="Close"]',
                '[aria-label="zapri"]',
                'button[class*="close"]',
                '[class*="close-button"]',
                '[class*="close-btn"]',
                '[class*="modal-close"]',
                'button:first-child',  # X je pogosto prvi gumb
                'svg[class*="close"]',
                'button:has-text("×")',
                'button:has-text("✕")',
                'button:has-text("X")',
            ]

            for sel in close_selectors:
                try:
                    close_btn = modal.query_selector(sel)
                    if close_btn and close_btn.is_visible():
                        close_btn.click()
                        return True
                except:
                    continue

            # Poskusi kliknit prvi gumb (pogosto X)
            try:
                first_btn = modal.query_selector('button')
                if first_btn and first_btn.is_visible():
                    # Preveri da ni "submit" tipa
                    btn_type = first_btn.get_attribute('type') or ''
                    btn_text = first_btn.inner_text().strip()
                    if btn_type != 'submit' and len(btn_text) < 5:
                        first_btn.click()
                        return True
            except:
                pass

            return False
        except:
            return False

    # ==================== QUALITY SCORING ====================

    def assess_quality(self, product: dict) -> ProductQuality:
        """Oceni kvaliteto podatkov izdelka"""
        q = ProductQuality()

        name = product.get("ime", "")
        regular_price = product.get("redna_cena")
        sale_price = product.get("akcijska_cena")
        image = product.get("slika", "")
        category = product.get("kategorija", "")
        unit = product.get("enota", "")

        # Has name
        q.has_name = bool(name and len(name) > 1)

        # Has price
        q.has_price = bool(regular_price or sale_price)

        # Has image
        q.has_image = bool(image and image.startswith("http"))

        # Has category
        q.has_category = bool(category and len(category) > 2)

        # Has unit
        q.has_unit = bool(unit)

        # Name length OK
        q.name_length_ok = self.MIN_NAME_LENGTH < len(name) < self.MAX_NAME_LENGTH if name else False

        # Price reasonable
        price = regular_price or sale_price or 0
        q.price_reasonable = self.MIN_PRICE < price < self.MAX_PRICE if price else False

        # Image URL valid
        if image:
            bad_patterns = ["placeholder", "no-image", "noimage", "default", "loading", "blank", "1x1"]
            q.image_url_valid = not any(p in image.lower() for p in bad_patterns)

        return q

    # ==================== VALIDATION ====================

    def is_valid_name(self, name: str) -> bool:
        """Preveri ali je ime veljavno"""
        if not name:
            return False
        if len(name) < self.MIN_NAME_LENGTH or len(name) > self.MAX_NAME_LENGTH:
            return False

        # Bad patterns
        bad_patterns = [
            r"^(menu|nav|header|footer|košarica|cart|prijava|login|iskanje|search)$",
            r"^(kategorij[ea]|razvrsti|filter|išči|išci|sortir)$",
            r"^(vstavi|dodaj|izbriši|uredi|zapri|odpri)$",
            r"^(nalagam|čakaj|loading)\.{0,3}$",
            r"^\d+$",
            r"^€\s*\d",
            r"^[A-Z]{5,}$",  # Samo uppercase kratice
        ]
        name_lower = name.lower()
        for pattern in bad_patterns:
            if re.match(pattern, name_lower, re.I):
                return False

        return True

    def is_valid_price(self, price: float) -> bool:
        """Preveri ali je cena veljavna"""
        if price is None:
            return False
        if not isinstance(price, (int, float)):
            return False
        return self.MIN_PRICE < price < self.MAX_PRICE

    def is_valid_image_url(self, url: str) -> bool:
        """Preveri ali je URL slike veljaven"""
        if not url or not url.startswith("http"):
            return False

        bad_patterns = [
            "placeholder", "no-image", "noimage", "default", "loading",
            "spinner", "blank", "empty", "1x1", "pixel", "spacer",
            "transparent", "grey", "gray",
        ]
        url_lower = url.lower()
        return not any(p in url_lower for p in bad_patterns)

    def validate_product(self, product: dict) -> Tuple[bool, str, ProductQuality]:
        """
        ULTIMATE validacija izdelka.
        Vrne (is_valid, reason, quality_score)
        """
        quality = self.assess_quality(product)

        # Must have name
        if not quality.has_name:
            self.metrics.products_invalid += 1
            return False, "no_name", quality

        # Must have price
        if not quality.has_price:
            self.metrics.products_invalid += 1
            return False, "no_price", quality

        # Validate name
        if not self.is_valid_name(product.get("ime", "")):
            self.metrics.products_invalid += 1
            return False, "invalid_name", quality

        # Validate prices
        regular = product.get("redna_cena")
        sale = product.get("akcijska_cena")

        if regular and not self.is_valid_price(regular):
            self.metrics.products_invalid += 1
            return False, "invalid_regular_price", quality

        if sale and not self.is_valid_price(sale):
            self.metrics.products_invalid += 1
            return False, "invalid_sale_price", quality

        # Sale price should be lower
        if regular and sale and sale >= regular:
            # Auto-fix: swap them
            product["redna_cena"], product["akcijska_cena"] = sale, regular

        # Quality threshold
        if quality.score < self.MIN_QUALITY_SCORE:
            self.metrics.products_invalid += 1
            return False, f"low_quality_{quality.score}", quality

        return True, "ok", quality

    # ==================== DEDUPLICATION ====================

    def get_product_fingerprint(self, product: dict) -> str:
        """Unikaten fingerprint za izdelek"""
        name = product.get("ime", "").lower().strip()
        price = product.get("redna_cena") or product.get("akcijska_cena") or 0

        # Normalize name for fingerprint
        name = re.sub(r"[^a-zčšž0-9]", "", name)

        # Include store to avoid cross-store dedup at this level
        store = product.get("trgovina", "").lower()

        return f"{store}|{name}|{price:.2f}"

    def is_duplicate(self, product: dict) -> bool:
        """Preveri ali je duplikat"""
        fp = self.get_product_fingerprint(product)
        if fp in self.seen:
            self.metrics.duplicates += 1
            return True
        self.seen.add(fp)
        return False

    # ==================== CHECKPOINTS ====================

    def save_checkpoint(self, category: str = None):
        """Shrani checkpoint za resume"""
        if not self.CHECKPOINT_ENABLED:
            return

        if category:
            self.completed_categories.add(category)

        checkpoint = {
            "store": self.STORE_NAME,
            "timestamp": datetime.now().isoformat(),
            "completed_categories": list(self.completed_categories),
            "products_count": len(self.products),
            "metrics": self.metrics.to_dict(),
        }

        if not self.checkpoint_file:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.checkpoint_file = self.checkpoints_dir / f"{self.STORE_NAME.lower()}_{timestamp}.json"

        try:
            with open(self.checkpoint_file, "w", encoding="utf-8") as f:
                json.dump(checkpoint, f, ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            self.log(f"Checkpoint save error: {e}", "WARNING")

    def load_checkpoint(self, checkpoint_file: str = None) -> bool:
        """Naloži checkpoint za resume"""
        if checkpoint_file:
            path = Path(checkpoint_file)
        else:
            # Najdi najnovejši checkpoint
            checkpoints = list(self.checkpoints_dir.glob(f"{self.STORE_NAME.lower()}_*.json"))
            if not checkpoints:
                return False
            path = max(checkpoints, key=lambda p: p.stat().st_mtime)

        try:
            with open(path, "r", encoding="utf-8") as f:
                checkpoint = json.load(f)

            self.completed_categories = set(checkpoint.get("completed_categories", []))
            self.log(f"Loaded checkpoint: {len(self.completed_categories)} kategorij že končanih", "SUCCESS")
            return True
        except Exception as e:
            self.log(f"Checkpoint load error: {e}", "WARNING")
            return False

    def should_skip_category(self, category: str) -> bool:
        """Ali naj preskočimo kategorijo (že končana)"""
        return category in self.completed_categories

    # ==================== PROGRESS ====================

    def save_progress(self):
        """Shrani trenutni napredek"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = self.progress_dir / f"{self.STORE_NAME.lower()}_{timestamp}.json"

        progress = {
            "store": self.STORE_NAME,
            "timestamp": timestamp,
            "products_count": len(self.products),
            "metrics": self.metrics.to_dict(),
            "products": self.products[-100:],  # Zadnjih 100 za debugging
        }

        try:
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(progress, f, ensure_ascii=False, indent=2, default=str)
            self.log(f"Progress saved: {filename.name}", "DEBUG")
        except Exception as e:
            self.log(f"Progress save error: {e}", "WARNING")

    def maybe_save_progress(self):
        """Shrani progress če je dovolj novih izdelkov"""
        if len(self.products) % self.SAVE_PROGRESS_EVERY == 0:
            self.save_progress()

    # ==================== MAIN METHODS ====================

    def add_product(self, product: dict) -> bool:
        """Dodaj izdelek z ULTIMATE validacijo"""
        self.metrics.products_found += 1

        # Validacija
        is_valid, reason, quality = self.validate_product(product)
        if not is_valid:
            return False

        # Deduplikacija
        if self.is_duplicate(product):
            return False

        # Add quality score to product
        product["_quality_score"] = quality.score

        # Dodaj
        self.products.append(product)
        self.metrics.products_valid += 1

        # Progress
        self.maybe_save_progress()

        return True

    def start(self):
        """Začni scraping"""
        self.metrics.start_time = datetime.now()

        # Setup log file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file = self.logs_dir / f"{self.STORE_NAME.lower()}_{timestamp}.log"

        self.log("=" * 60)
        self.log(f"ZAČENJAM SCRAPING: {self.STORE_NAME}")
        self.log(f"Čas: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.log("=" * 60)

    def finish(self):
        """Zaključi scraping"""
        self.metrics.end_time = datetime.now()

        self.save_progress()
        self.save_checkpoint()
        self.log_stats()

        self.log(f"KONČANO: {self.metrics.products_valid} izdelkov", "SUCCESS")

    def scrape_all(self) -> list[dict]:
        """Override v podrazredu!"""
        raise NotImplementedError("Override scrape_all() in subclass")

    def extract_product_data(self, element: ElementHandle, category: str = "") -> Optional[dict]:
        """Override v podrazredu!"""
        raise NotImplementedError("Override extract_product_data() in subclass")
