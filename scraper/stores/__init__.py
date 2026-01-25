"""
BULLETPROOF Store Scrapers
Scraperji za slovenske trgovine z robustno logiko

- SparScraper: https://www.spar.si/online/
- MercatorScraper: https://mercatoronline.si/
- TusScraper: https://hitrinakup.com/

Vsak scraper ima:
- Retry z exponential backoff
- Več fallback selektorjev
- Data validation
- Anti-detection (cookies, popups, rate limiting)
- Progress saving
- Detailed logging
"""

from .base import BulletproofScraper, ScraperError
from .spar import SparScraper
from .mercator import MercatorScraper
from .tus import TusScraper

__all__ = [
    "BulletproofScraper",
    "ScraperError",
    "SparScraper",
    "MercatorScraper",
    "TusScraper",
]
