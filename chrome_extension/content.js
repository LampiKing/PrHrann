// PrHran Chrome Extension - Product Scraper with Auto-Pagination
// Scrapes products (name, price, image, sale price) and handles pagination/infinite scroll

if (window.prHranScraperLoaded) {
  console.log('PrHran script already loaded, skipping...');
} else {

console.log('CONTENT SCRIPT LOADING...');

window.prHranScraperLoaded = true;

// Global state
window.scrapingState = {
  isActive: false,
  shouldStop: false,
  totalProducts: 0,
  currentPage: 0,
  seenFingerprints: new Set(),
  products: [],
  store: null
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function isExtensionValid() {
  try {
    return chrome.runtime && chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

function updateIndicator(text) {
  try {
    if (isExtensionValid()) {
      chrome.runtime.sendMessage({
        action: 'progress',
        message: text,
        count: window.scrapingState.totalProducts,
        timestamp: Date.now()
      }).catch(() => {});
    }
  } catch (e) {}
}

function saveProductsToStorage() {
  try {
    if (isExtensionValid() && window.scrapingState.products.length > 0) {
      const store = window.scrapingState.store || 'Unknown';
      const key = `products_${store}`;
      chrome.storage.local.set({
        [key]: window.scrapingState.products,
        [`${key}_count`]: window.scrapingState.totalProducts,
        [`${key}_timestamp`]: Date.now()
      }).catch(() => {});
      console.log(`[Storage] Saved ${window.scrapingState.products.length} products to storage`);
    }
  } catch (e) {
    console.warn('[Storage] Save error:', e);
  }
}

async function loadProductsFromStorage() {
  try {
    if (isExtensionValid()) {
      const store = window.scrapingState.store || 'Unknown';
      const key = `products_${store}`;
      const data = await chrome.storage.local.get([key, `${key}_count`]);
      if (data[key] && data[key].length > 0) {
        console.log(`[Storage] Loaded ${data[key].length} products from storage`);
        return data[key];
      }
    }
  } catch (e) {
    console.warn('[Storage] Load error:', e);
  }
  return [];
}

function detectStore() {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes('spar')) return 'Spar';
  if (hostname.includes('mercator')) return 'Mercator';
  if (hostname.includes('hitrinakup') || hostname.includes('tus')) return 'Tus';
  if (hostname.includes('hofer')) return 'Hofer';
  if (hostname.includes('lidl')) return 'Lidl';
  if (hostname.includes('eurospin')) return 'Eurospin';
  if (hostname.includes('jager')) return 'Jager';

  return 'Unknown';
}

function getCurrentDate() {
  const now = new Date();
  return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
}

function getText(element) {
  if (!element) return '';
  return (element.textContent || element.innerText || '').trim().replace(/\s+/g, ' ');
}

function createFingerprint(name, price, image) {
  let normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
  normalized = normalized.replace(/\b\d+[,.]\d{2}\s*€?/gi, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  let fingerprint = normalized;
  if (price) fingerprint += `|${price}`;
  if (image && image.startsWith('http')) {
    const imgName = image.split('/').pop().split('?')[0];
    if (imgName.length > 5) fingerprint += `|${imgName}`;
  }

  return fingerprint;
}

// ============================================
// STORE-SPECIFIC SELECTORS
// ============================================

const STORE_SELECTORS = {
  'Spar': [
    '[class*="product-tile"]', '[class*="product-card"]', '[class*="ProductTile"]',
    '.tileOffer', '[class*="offer"]', '.flyerItem', '[class*="flyer"]',
    '[class*="leaflet"]', 'article[class*="product"]', '.product',
    '[data-product]', '[itemtype*="Product"]', 'article', '[class*="card"]'
  ],
  'Mercator': [
    // Mercator Online specifični selektorji
    '.product-box', '.product-item', '.box.product',
    '[data-product-id]', '[data-sku]',
    // Grid sistem
    '.grid-item', '.catalog-item', '.category-item',
    // Generični box selektorji - ZADNJI ker so preširoki
    '.box:not(.banner):not(.delimiter)'
  ],
  'Hofer': [
    '[class*="product"]', '[class*="article"]', '[data-sku]', '[data-product]',
    'article', '.product', '.c-product-tile', '[class*="ProductTile"]'
  ],
  'Lidl': [
    '[class*="product"]', '[data-product]', 'article[class*="product"]',
    '[class*="product-grid-box"]', '[class*="ret-o-card"]', '.product'
  ],
  'Tus': [
    // Hitri Nakup - glavni product card wrapper
    '[class*="itemCardWrapper"]',
    'a[class*="itemCardWrapper"]',
    '[class*="ItemCardWrapper"]',
    // Alternativni selektorji
    '[class*="itemCard"]',
    '[class*="ItemCard"]'
  ],
  'Eurospin': [
    '[class*="product"]', '[class*="item"]', '.product', '.offer-item'
  ],
  'Jager': [
    '[class*="product"]', '[class*="item"]', '.product', 'article'
  ],
  'Unknown': [
    '[class*="product-item"]', '[class*="product-card"]', '[class*="product-tile"]',
    '[class*="product"]', '.product', '.item', 'article', '[data-product]'
  ]
};

// ============================================
// PRODUCT EXTRACTION
// ============================================

function extractProductName(container) {
  const selectors = [
    '.lib-analytics-product-link', '[data-ga-label]', '.product-name',
    '.product-title', '[class*="product-title"]', '[class*="product-name"]',
    '[class*="title"]', '[class*="name"]', 'h1', 'h2', 'h3', 'h4',
    '.title', '.name', '[data-title]', '[data-name]', 'a[title]', 'a'
  ];

  for (const selector of selectors) {
    try {
      const el = container.querySelector(selector);
      if (el) {
        let text = getText(el);
        if (selector === 'a[title]' && el.hasAttribute('title')) {
          text = el.getAttribute('title').trim();
        }
        if (text && text.length > 2 && text.length < 300) {
          const badKeywords = ['menu', 'kosara', 'prijava', 'nav', 'header', 'footer'];
          if (!badKeywords.some(kw => text.toLowerCase().includes(kw))) {
            return text;
          }
        }
      }
    } catch (e) {}
  }

  const containerText = getText(container);
  if (containerText && containerText.length > 3 && containerText.length < 300) {
    return containerText.substring(0, 200).trim();
  }

  return '';
}

// ============================================
// SMART PRICE EXTRACTION (za Spar in druge)
// ============================================

// Preveri ali ima izdelek oznako za popust
function hasDiscountBadge(container) {
  const text = getText(container).toLowerCase();

  // SPAR: Prihranek X,XX € badge
  if (/prihran[ie]k\s*\d+[,.]\d{2}\s*€?/i.test(text)) {
    return true;
  }

  // Trajno znizano, znizana cena
  if (text.includes('trajno zni') || text.includes('znizana cena') || text.includes('znižana cena')) {
    return true;
  }

  // Procenti: -16%, -10%, 29% popust
  if (/-\s*\d{1,2}\s*%/.test(text) || /\d{1,2}\s*%\s*(popust|off)/i.test(text)) {
    return true;
  }

  // Besede za popust
  const discountWords = [
    'akcija', 'akcijska', 'znizano', 'znižano', 'popust', 'prihranek',
    'ugodneje', 'sale', 'promo', 'special', 'super cena', 'nova cena'
  ];
  for (const word of discountWords) {
    if (text.includes(word)) return true;
  }

  // Precrtana cena (del, s, strike elementi)
  const strikeEl = container.querySelector('del, s, strike, [class*="old-price"], [class*="crossed"]');
  if (strikeEl && /\d+[,.]\d{2}/.test(getText(strikeEl))) {
    return true;
  }

  // Element z discount/badge class
  const badgeEl = container.querySelector('[class*="discount"], [class*="sale"], [class*="akcij"], [class*="badge"], [class*="promo"]');
  if (badgeEl) {
    const badgeText = getText(badgeEl);
    if (badgeText.includes('%') || /prihran|popust|akcij|znizan/i.test(badgeText)) {
      return true;
    }
  }

  return false;
}

// Najdi VSE cene v tekstu, IGNORIRAJ cene na enoto
function findAllPrices(text) {
  if (!text) return [];

  // Najprej ODSTRANI cene na enoto in teze izdelkov
  const removePatterns = [
    // Teze izdelkov (0.15KG, 500g, 1.5L)
    /\d+[,.]\d*\s*kg\b/gi,
    /\d+[,.]\d*\s*g\b/gi,
    /\d+\s*g\b/gi,
    /\d+\s*kg\b/gi,
    /\d+[,.]\d*\s*m?l\b/gi,
    /\d+\s*ml\b/gi,

    // Cene na enoto (2,49 €/kg, 1,99 €/kos, 3,49 €/l)
    /\d+[,.]\d{2}\s*€?\s*\/\s*\d*\s*k?g\b/gi,
    /\d+[,.]\d{2}\s*€?\s*\/\s*\d*\s*kos\b/gi,
    /\d+[,.]\d{2}\s*€?\s*\/\s*\d*\s*l\b/gi,
    /\d+[,.]\d{2}\s*€?\s*\/\s*\d*\s*ml\b/gi,
    /\d+[,.]\d{2}\s*€?\s*\/\s*\d*\s*kom\b/gi,
    /\d+[,.]\d{2}\s*€?\s*\/\s*\d*\s*m\b/gi,

    // SPAR PC kode (PC30:1,39 €, PC20 2,49€)
    /PC\d+\s*:?\s*\d+[,.]\d{2}\s*€?/gi,

    // "KG za 15,27 €" format
    /k?g\s+za\s+\d+[,.]\d{2}\s*€?/gi,
    /za\s+\d+[,.]\d{2}\s*€?\s*\/?\s*k?g/gi,

    // Cena v oklepaju z enoto
    /\([^)]*\d+[,.]\d{2}\s*€?\s*\/[^)]*\)/gi,
    /\([^)]*\/\s*k?g[^)]*\)/gi
  ];

  let cleanText = text;
  for (const pattern of removePatterns) {
    cleanText = cleanText.replace(pattern, ' ');
  }

  // Zdaj poisci preostale cene
  const prices = [];
  const pricePattern = /(\d+)[,.](\d{2})\s*€?/g;
  let match;

  while ((match = pricePattern.exec(cleanText)) !== null) {
    const value = parseFloat(`${match[1]}.${match[2]}`);
    if (value > 0.1 && value < 10000) {
      // Preveri da ni teza (0.15, 0.5, itd pod 1€ so pogosto teze)
      if (value >= 0.5 || match[0].includes('€')) {
        prices.push({
          text: `${match[1]},${match[2]} €`,
          value: value
        });
      }
    }
  }

  // Odstrani duplikate
  const uniquePrices = [];
  const seenValues = new Set();
  for (const price of prices) {
    if (!seenValues.has(price.value)) {
      seenValues.add(price.value);
      uniquePrices.push(price);
    }
  }

  return uniquePrices;
}

// Glavna funkcija za ekstrakcijo cen
// CENA = originalna/redna cena
// AKCIJSKA CENA = znizana cena (ce je akcija)
function extractPrices(container) {
  const allText = getText(container);
  const hasDiscount = hasDiscountBadge(container);

  // Rezultat
  let regularPrice = '';   // Redna/originalna cena -> gre v stolpec CENA
  let salePrice = '';      // Akcijska/znizana cena -> gre v stolpec AKCIJSKA CENA

  // =============================================
  // SPAR SPECIFIČNO: Išči "Prej X,XX €" za staro ceno
  // =============================================
  const prejMatch = allText.match(/prej\s+(\d+)[,.](\d{2})\s*€?/i);
  if (prejMatch) {
    regularPrice = `${prejMatch[1]},${prejMatch[2]} €`;
    console.log(`[Price] Found "Prej" price: ${regularPrice}`);
  }

  // =============================================
  // Poisci glavno ceno (ne Prej, ne Prihranek, ne PC, ne /kg)
  // =============================================

  // Odstrani vse kar NI glavna cena
  let cleanText = allText;

  // Odstrani "Prej X,XX €"
  cleanText = cleanText.replace(/prej\s+\d+[,.]\d{2}\s*€?/gi, ' ');

  // Odstrani "Prihranek X,XX €" (to je prihranek, ne cena!)
  cleanText = cleanText.replace(/prihran[ie]k\s+\d+[,.]\d{2}\s*€?/gi, ' ');

  // Odstrani PC kode in njihove cene
  cleanText = cleanText.replace(/PC\d+\s*:?\s*\d+[,.]\d{2}\s*€?/gi, ' ');

  // Odstrani cene na enoto
  cleanText = cleanText.replace(/\d+[,.]\d{2}\s*€?\s*\/\s*\w+/gi, ' ');  // X,XX €/kg
  cleanText = cleanText.replace(/k?g\s+za\s+\d+[,.]\d{2}\s*€?/gi, ' ');   // KG za X,XX €
  cleanText = cleanText.replace(/za\s+\d+[,.]\d{2}\s*€?\s*\/?\s*k?g/gi, ' ');
  cleanText = cleanText.replace(/\(\s*k?g\s+za[^)]+\)/gi, ' ');  // (KG za X,XX €)
  cleanText = cleanText.replace(/\(\s*PC\d+[^)]+\)/gi, ' ');     // (PC30 KG za ...)

  // Odstrani teze
  cleanText = cleanText.replace(/\d+[,.]\d*\s*k?g\b/gi, ' ');
  cleanText = cleanText.replace(/\d+\s*g\b/gi, ' ');
  cleanText = cleanText.replace(/\d+[,.]\d*\s*m?l\b/gi, ' ');

  // Najdi preostale cene
  const pricePattern = /(\d+)[,.](\d{2})\s*€/g;
  let match;
  const foundPrices = [];

  while ((match = pricePattern.exec(cleanText)) !== null) {
    const value = parseFloat(`${match[1]}.${match[2]}`);
    if (value >= 0.10 && value < 1000) {
      foundPrices.push({
        text: `${match[1]},${match[2]} €`,
        value: value
      });
    }
  }

  // Odstrani duplikate
  const uniquePrices = [];
  const seenValues = new Set();
  for (const p of foundPrices) {
    if (!seenValues.has(p.value)) {
      seenValues.add(p.value);
      uniquePrices.push(p);
    }
  }

  console.log(`[Price] Found ${uniquePrices.length} prices after filtering:`, uniquePrices.map(p => p.text));

  // =============================================
  // Doloci katero ceno je katera
  // =============================================

  if (regularPrice && uniquePrices.length >= 1) {
    // Imamo "Prej" ceno, prva preostala cena je akcijska
    salePrice = uniquePrices[0].text;
    console.log(`[Price] Has "Prej", so sale price is: ${salePrice}`);
  } else if (uniquePrices.length === 1) {
    // Samo ena cena - to je redna cena, ni akcije
    regularPrice = uniquePrices[0].text;
    salePrice = '';
  } else if (uniquePrices.length >= 2) {
    // Vec cen - sortiraj po vrednosti
    uniquePrices.sort((a, b) => a.value - b.value);

    if (hasDiscount) {
      // IMA AKCIJO:
      regularPrice = uniquePrices[uniquePrices.length - 1].text;  // Najvišja = redna
      salePrice = uniquePrices[0].text;                            // Najnižja = akcijska

      if (uniquePrices[0].value === uniquePrices[uniquePrices.length - 1].value) {
        salePrice = '';
      }
    } else {
      regularPrice = uniquePrices[0].text;
      salePrice = '';
    }
  }

  console.log(`[Price] FINAL: regularPrice=${regularPrice}, salePrice=${salePrice}`);
  return { regularPrice, salePrice };
}

// Wrapper funkciji za kompatibilnost
// extractPrice -> vrne REDNO ceno (gre v stolpec CENA)
function extractPrice(container) {
  const { regularPrice } = extractPrices(container);
  return regularPrice;
}

// extractSalePrice -> vrne AKCIJSKO ceno (gre v stolpec AKCIJSKA CENA)
function extractSalePrice(container) {
  const { salePrice } = extractPrices(container);
  return salePrice;
}

// ============================================
// AVAILABILITY DETECTION (na voljo / ni na voljo)
// ============================================

function extractAvailability(container) {
  const text = getText(container).toLowerCase();
  const html = container.innerHTML ? container.innerHTML.toLowerCase() : '';

  // =============================================
  // VZORCI ZA "NI NA VOLJO" - VSE TRGOVINE
  // =============================================
  const unavailablePatterns = [
    // Slovenski - splosno
    'ni na voljo',
    'ni na zalogi',
    'razprodano',
    'trenutno ni na voljo',
    'ni vec na voljo',
    'ni več na voljo',
    'prazna zaloga',
    'brez zaloge',
    'zmanjkalo',
    'ni mozno kupiti',
    'ni mogoče kupiti',
    'zacasno ni na voljo',
    'začasno ni na voljo',

    // Gumbi
    'obvestite me',      // "Obvestite me ko je na voljo"
    'obvesti me',
    'notify me',
    'email me',

    // SPAR specifično
    'artikel ni na voljo',
    'izdelek ni na voljo',

    // MERCATOR specifično
    'tega izdelka trenutno ni',
    'ni v ponudbi',

    // HOFER / ALDI specifično (nemško)
    'nicht verfügbar',
    'ausverkauft',
    'nicht lieferbar',
    'zur zeit nicht',

    // LIDL specifično
    'leider ausverkauft',
    'nicht erhältlich',
    'vorübergehend nicht',

    // TUS specifično
    'ni v prodaji',
    'ni na razpolago',

    // Angleski - splosno
    'out of stock',
    'sold out',
    'unavailable',
    'not available',
    'currently unavailable',
    'temporarily unavailable',
    'no longer available',
    'not in stock',
    'stock: 0',
    'qty: 0',
    'quantity: 0'
  ];

  // Preveri tekst za "ni na voljo" vzorce
  for (const pattern of unavailablePatterns) {
    if (text.includes(pattern)) {
      console.log(`[Availability] Found unavailable pattern: "${pattern}"`);
      return { available: false, status: 'Ni na voljo' };
    }
  }

  // =============================================
  // CSS RAZREDI ZA "NI NA VOLJO"
  // =============================================
  const unavailableClasses = [
    // Splosni
    'out-of-stock', 'outofstock', 'out_of_stock',
    'sold-out', 'soldout', 'sold_out',
    'unavailable', 'not-available', 'not_available',
    'no-stock', 'nostock', 'no_stock',
    'disabled', 'inactive', 'hidden-product',

    // Slovenski
    'ni-na-voljo', 'ni_na_voljo', 'ninavoljo',
    'razprodano', 'brez-zaloge',

    // Trgovine
    'product-unavailable',
    'item-unavailable',
    'stock-none',
    'availability-false',
    'not-buyable',
    'cannot-buy'
  ];

  // Preveri sam container
  const containerClass = (container.className || '').toLowerCase();
  for (const cls of unavailableClasses) {
    if (containerClass.includes(cls)) {
      console.log(`[Availability] Found unavailable class on container: "${cls}"`);
      return { available: false, status: 'Ni na voljo' };
    }
  }

  // Preveri otroke za unavailable elemente
  for (const cls of unavailableClasses) {
    try {
      const unavailableEl = container.querySelector(`[class*="${cls}"]`);
      if (unavailableEl) {
        console.log(`[Availability] Found unavailable child element with class: "${cls}"`);
        return { available: false, status: 'Ni na voljo' };
      }
    } catch (e) {}
  }

  // =============================================
  // DATA ATRIBUTI
  // =============================================
  const dataAttrs = ['data-available', 'data-in-stock', 'data-stock', 'data-availability'];
  for (const attr of dataAttrs) {
    const value = container.getAttribute(attr);
    if (value !== null) {
      const v = value.toLowerCase();
      if (v === 'false' || v === '0' || v === 'no' || v === 'out' || v === 'unavailable') {
        console.log(`[Availability] Found unavailable data attribute: ${attr}="${value}"`);
        return { available: false, status: 'Ni na voljo' };
      }
    }
  }

  // =============================================
  // VIZUALNI INDIKATORJI
  // =============================================

  // Preveri za "grayed out" / disabled style
  const style = container.getAttribute('style') || '';
  if (style.includes('opacity: 0.5') || style.includes('opacity:0.5') ||
      style.includes('opacity: 0.4') || style.includes('opacity:0.4') ||
      style.includes('grayscale') || style.includes('pointer-events: none')) {
    console.log(`[Availability] Found grayed out style`);
    return { available: false, status: 'Ni na voljo' };
  }

  // Preveri za disabled gumb "Dodaj v kosaro"
  const cartBtnSelectors = [
    'button[class*="cart"]', 'button[class*="kosara"]', 'button[class*="kosarica"]',
    '[class*="add-to-cart"]', '[class*="addtocart"]', '[class*="add_to_cart"]',
    '[class*="dodaj"]', '[class*="kupi"]', '[class*="buy"]',
    'button[type="submit"]', '.btn-cart', '.cart-btn'
  ];

  for (const selector of cartBtnSelectors) {
    try {
      const btn = container.querySelector(selector);
      if (btn) {
        if (btn.disabled ||
            btn.classList.contains('disabled') ||
            btn.classList.contains('inactive') ||
            btn.hasAttribute('aria-disabled') ||
            btn.getAttribute('aria-disabled') === 'true') {
          console.log(`[Availability] Found disabled cart button`);
          return { available: false, status: 'Ni na voljo' };
        }
      }
    } catch (e) {}
  }

  // Preveri za "Obvestite me" gumb namesto "Dodaj v kosaro"
  const notifySelectors = [
    '[class*="notify"]', '[class*="obvestite"]', '[class*="obvesti"]',
    '[class*="waitlist"]', '[class*="waiting-list"]', '[class*="back-in-stock"]'
  ];

  for (const selector of notifySelectors) {
    try {
      const notifyBtn = container.querySelector(selector);
      if (notifyBtn) {
        // Preveri da res ni "dodaj v kosaro" gumba
        let hasCartBtn = false;
        for (const cartSel of cartBtnSelectors) {
          if (container.querySelector(cartSel)) {
            hasCartBtn = true;
            break;
          }
        }
        if (!hasCartBtn) {
          console.log(`[Availability] Found notify button without cart button`);
          return { available: false, status: 'Ni na voljo' };
        }
      }
    } catch (e) {}
  }

  // =============================================
  // DEFAULT: NA VOLJO
  // =============================================
  // Ce ni nobenega indikatorja za "ni na voljo", je NA VOLJO
  return { available: true, status: 'Na voljo' };
}

function extractImage(container) {
  const imgSelectors = ['img[src*="product"]', 'img[data-src]', 'img[src]', 'img'];

  for (const selector of imgSelectors) {
    try {
      const img = container.querySelector(selector);
      if (img) {
        const candidates = [
          img.getAttribute('data-src'),
          img.getAttribute('data-original'),
          img.getAttribute('data-lazy'),
          img.currentSrc,
          img.src,
          img.getAttribute('src'),
        ].filter(Boolean);

        for (const rawCandidate of candidates) {
          let src = String(rawCandidate).trim();
          if (!src) continue;

          // Resolve relative URLs
          try {
            if (src.startsWith('//')) src = `${window.location.protocol}${src}`;
            else if (src.startsWith('/')) src = `${window.location.origin}${src}`;
            else if (!src.startsWith('http') && !src.startsWith('data:')) {
              src = new URL(src, window.location.href).href;
            }
          } catch (e) {}

          if (
            src &&
            src.startsWith('http') &&
            !src.includes('placeholder') &&
            !src.includes('logo')
          ) {
            return src;
          }
        }
      }
    } catch (e) {}
  }

  // Try background image
  try {
    const divs = container.querySelectorAll('[style*="background"]');
    for (const div of divs) {
      const style = div.getAttribute('style') || '';
      const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
      if (match) {
        let src = match[1];
        if (!src || src.startsWith('data:')) continue;

        // Resolve relative URLs
        try {
          if (src.startsWith('//')) src = `${window.location.protocol}${src}`;
          else if (src.startsWith('/')) src = `${window.location.origin}${src}`;
          else if (!src.startsWith('http')) src = new URL(src, window.location.href).href;
        } catch (e) {}

        if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('logo')) {
          return src;
        }
      }
    }
  } catch (e) {}

  return '';
}

// ============================================
// MERCATOR SPECIFIC EXTRACTION
// ============================================

function extractMercatorProductName(container) {
  // Mercator Online ima posebno strukturo
  // Poskusi vec selektorjev specificnih za Mercator
  const mercatorSelectors = [
    '.product-name', '.item-name', '.name',
    '[class*="product-name"]', '[class*="item-name"]',
    '[class*="title"]', '.title',
    'h1', 'h2', 'h3', 'h4',
    'a[title]', 'a[href*="/product"]', 'a[href*="/izdelek"]',
    'img[alt]', // Pogosto ima slika alt text z imenom
    '.description', '[class*="desc"]'
  ];

  for (const selector of mercatorSelectors) {
    try {
      const el = container.querySelector(selector);
      if (el) {
        let text = '';

        // Za img element vzemi alt
        if (el.tagName === 'IMG' && el.alt) {
          text = el.alt.trim();
        }
        // Za link vzemi title ali text
        else if (el.tagName === 'A') {
          text = el.getAttribute('title') || getText(el);
        }
        else {
          text = getText(el);
        }

        // Odstrani ceno in kar sledi (€, /kg, kos, itd)
        text = text.split(/\d+[,.]\d{2}\s*€/)[0].trim();

        if (text && text.length > 2 && text.length < 300) {
          // Filtriraj slabe besede
          const badKeywords = ['menu', 'kosara', 'košarica', 'prijava', 'nav', 'header', 'footer', 'isci', 'išči', 'kategorij', 'razvrsti'];
          if (!badKeywords.some(kw => text.toLowerCase().includes(kw))) {
            console.log(`[Mercator] Found name: "${text.substring(0, 50)}..." with selector: ${selector}`);
            return text;
          }
        }
      }
    } catch (e) {}
  }

  // Fallback: poisci kateri koli tekst v containerju
  const allText = getText(container);
  if (allText && allText.length > 3) {
    // Vzemi samo prvi del (pred ceno) - Mercator format
    // "Kisla smetana, Mercator, 20 % m.m., 400 g 1,29 € 3,23 €/ 1kg kos 1"
    const parts = allText.split(/\d+[,.]\d{2}\s*€/);
    if (parts[0] && parts[0].trim().length > 3) {
      let name = parts[0].trim();
      // Odstrani "Razvrsti po:" in podobno
      name = name.replace(/^razvrsti\s*(po)?:?\s*/i, '');
      if (name.length > 3 && name.length < 200) {
        console.log(`[Mercator] Fallback name: "${name.substring(0, 50)}..."`);
        return name;
      }
    }
  }

  console.log(`[Mercator] No name found in:`, container.className);
  return '';
}

function extractMercatorPrices(container) {
  // Vrne { regular: "X,XX €", sale: "Y,YY €" }
  // Mercator format:
  // Brez akcije: "1,29 € 3,23 €/ 1kg" -> regular=1,29€, sale=""
  // Z akcijo: "2,99 € 2,49 € 2,49 €/ 1kg" -> regular=2,99€, sale=2,49€

  const allText = getText(container);

  // Najdi VSE cene (ignorira cene na enoto)
  const pricePattern = /(\d+)[,.](\d{2})\s*€/g;
  const prices = [];
  let match;

  while ((match = pricePattern.exec(allText)) !== null) {
    const fullMatch = match[0];
    const position = match.index;
    const value = parseFloat(`${match[1]}.${match[2]}`);

    // Preveri ali je to cena na enoto (ima /kg, /kos, /1l, /1kg za sabo)
    const afterPrice = allText.substring(position + fullMatch.length, position + fullMatch.length + 20);
    // Ujame VSE enote: "/ 1l", "/ 1kg", "/kg", "/kos", "/ 100g", itd.
    const isPerUnit = /^\s*\/\s*\d*\s*(kg|kos|kom|kpl|pak|ml|cl|dl|mm|cm|m|g|l)\b/i.test(afterPrice);

    if (isPerUnit) {
      console.log(`[Mercator] Ignoring per-unit price: ${match[0]} (${afterPrice.trim()})`);
    }

    if (!isPerUnit && value > 0.1 && value < 10000) {
      prices.push({
        text: `${match[1]},${match[2]} €`,
        value: value,
        position: position
      });
    }
  }

  // Preveri ali ima popust badge (-16%, akcija, itd)
  const hasDiscountBadge = /-\s*\d+\s*%/.test(allText) ||
    container.querySelector('[class*="discount"], [class*="akcij"], [class*="popust"], [class*="sale"]');

  // Sortiraj po poziciji
  prices.sort((a, b) => a.position - b.position);

  console.log(`[Mercator] Found ${prices.length} prices:`, prices.map(p => p.text), 'hasDiscount:', !!hasDiscountBadge);

  if (prices.length === 0) {
    return { regular: '', sale: '' };
  }

  if (prices.length === 1) {
    // Samo ena cena = redna cena, ni akcije
    return { regular: prices[0].text, sale: '' };
  }

  // Vec cen - preveri ali sta prvi dve RAZLICNI
  if (prices.length >= 2) {
    const firstPrice = prices[0];
    const secondPrice = prices[1];

    // Ce sta ceni razlicni IN ima discount badge -> akcija!
    if (firstPrice.value !== secondPrice.value) {
      // Mercator: PRVA = stara/redna, DRUGA = nova/akcijska
      console.log(`[Mercator] SALE detected: ${firstPrice.text} -> ${secondPrice.text}`);
      return {
        regular: firstPrice.text,   // Stara cena
        sale: secondPrice.text      // Nova/akcijska cena
      };
    }
  }

  // Ni akcije - vrni prvo ceno kot redno
  return { regular: prices[0].text, sale: '' };
}

function extractMercatorPrice(container) {
  const { regular } = extractMercatorPrices(container);
  return regular;
}

function extractMercatorSalePrice(container) {
  const { sale } = extractMercatorPrices(container);
  return sale;
}

// ============================================
// TUŠ / HITRI NAKUP SPECIFIC EXTRACTION
// ============================================

// Tuš HTML struktura:
// - Ime: id="item-name" ali class*="itemProductTitle"
// - Akcijska cena (zelena): id="price" + class*="green"
// - Originalna cena (prečrtana): id="price" + class*="dashed-price"
// - Redna cena (brez akcije): id="price" (brez green/dashed)

function extractTusProductName(container) {
  // Tuš ima ime v elementu z id="item-name"
  const nameEl = container.querySelector('#item-name, [id="item-name"], [class*="itemProductTitle"]');
  if (nameEl) {
    const name = getText(nameEl).trim();
    if (name && name.length > 1) {
      return name;
    }
  }
  return '';
}

function extractTusPrice(container) {
  // Originalna/redna cena:
  // 1. Če je akcija: element s class*="dashed-price"
  // 2. Če ni akcije: element s id="price" (brez green)

  // Najprej preveri če obstaja prečrtana cena (pomeni da je akcija)
  const dashedEl = container.querySelector('[class*="dashed-price"]');
  if (dashedEl) {
    const text = getText(dashedEl);
    const match = text.match(/(\d+)[,.](\d{2})/);
    if (match) {
      return `${match[1]},${match[2]} €`;
    }
  }

  // Ni akcije - vzemi ceno iz #price ki NI zelena
  const priceEls = container.querySelectorAll('#price, [id="price"]');
  for (const el of priceEls) {
    const className = el.className || '';
    // Preskoči zeleno ceno (to je akcijska)
    if (className.includes('green')) continue;
    // Preskoči prečrtano (to smo že obdelali)
    if (className.includes('dashed')) continue;

    const text = getText(el);
    const match = text.match(/(\d+)[,.](\d{2})/);
    if (match) {
      return `${match[1]},${match[2]} €`;
    }
  }

  return '';
}

function extractTusSalePrice(container) {
  // Akcijska cena: element s class*="green" ali class*="price-discount"
  const saleEl = container.querySelector('[class*="green"][class*="price"], [class*="price-discount"]');
  if (saleEl) {
    const text = getText(saleEl);
    const match = text.match(/(\d+)[,.](\d{2})/);
    if (match) {
      return `${match[1]},${match[2]} €`;
    }
  }
  return '';
}

// ============================================
// SCRAPE CURRENT PAGE
// ============================================

function scrapeCurrentPage() {
  console.log('===== SCRAPING START =====');
  updateIndicator('Skeniram stran...');

  const store = detectStore();
  console.log('[DEBUG] Detected store:', store);
  console.log('[DEBUG] Current URL:', window.location.href);

  const selectors = STORE_SELECTORS[store] || STORE_SELECTORS['Unknown'];
  console.log('[DEBUG] Using selectors:', selectors);

  const currentDate = getCurrentDate();
  let newProducts = 0;

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`[DEBUG] Selector "${selector}" found ${elements.length} elements`);

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const elText = getText(el);

        // Preskoči prevelike elemente (verjetno parent container z več produkti)
        if (elText.length > 1000) {
          continue;
        }

        // Preskoči elemente brez cene
        if (!elText.includes('€')) {
          continue;
        }

        // Za vsako trgovino uporabi posebno ekstrakcijo
        let name = '';
        let price = '';
        let salePrice = '';

        if (store === 'Mercator') {
          name = extractMercatorProductName(el);
          price = extractMercatorPrice(el);
          salePrice = extractMercatorSalePrice(el);
        } else if (store === 'Tus') {
          name = extractTusProductName(el);
          price = extractTusPrice(el);
          salePrice = extractTusSalePrice(el);
        } else {
          name = extractProductName(el);
          price = extractPrice(el);
          salePrice = extractSalePrice(el);
        }

        if (!name || name.length < 3) {
          continue;
        }

        // Validacija: preskoči če ni veljavne cene (verjetno napačen element)
        if (!price || !price.includes('€')) {
          continue;
        }

        const image = extractImage(el);

        console.log(`[DEBUG] Product: "${name.substring(0, 30)}..." Price: ${price} Sale: ${salePrice || 'none'}`);
        const availability = extractAvailability(el);

        // Create fingerprint to avoid duplicates
        const fingerprint = createFingerprint(name, price, image);
        if (window.scrapingState.seenFingerprints.has(fingerprint)) {
          continue;
        }

        window.scrapingState.seenFingerprints.add(fingerprint);
        window.scrapingState.products.push({
          name,
          price,
          salePrice,
          image,
          store,
          date: currentDate,
          url: window.location.href,
          available: availability.available,
          statusText: availability.status
        });

        newProducts++;
        window.scrapingState.totalProducts++;

        // Shrani v storage vsakih 500 izdelkov
        if (window.scrapingState.totalProducts % 500 === 0) {
          saveProductsToStorage();
        }
      }

      if (newProducts > 0) {
        console.log(`Found ${newProducts} new products with selector: ${selector}`);
        break; // Use first successful selector
      }
    } catch (e) {
      console.warn(`Error with selector ${selector}:`, e);
    }
  }

  console.log(`Total products now: ${window.scrapingState.totalProducts}`);
  updateIndicator(`Najdeno: ${window.scrapingState.totalProducts} izdelkov`);

  return newProducts;
}

// ============================================
// PAGINATION DETECTION & HANDLING
// ============================================

function findNextButton() {
  const nextSelectors = [
    // =============================================
    // SPAR KATALOG / LETAK SPECIFIČNO
    // =============================================
    '[class*="leaflet"] [class*="next"]',
    '[class*="leaflet"] [class*="right"]',
    '[class*="leaflet"] [class*="arrow"]',
    '[class*="flyer"] [class*="next"]',
    '[class*="flyer"] [class*="right"]',
    '[class*="catalog"] [class*="next"]',
    '[class*="katalog"] [class*="next"]',
    '[class*="page-nav"] [class*="next"]',
    '[class*="page-nav"] [class*="right"]',

    // Puscice v katalogu
    '[class*="nav-arrow"][class*="right"]',
    '[class*="nav-arrow"]:last-child',
    '[class*="arrow"][class*="forward"]',
    'button[class*="right-arrow"]',
    'button[class*="arrow-right"]',
    'a[class*="right-arrow"]',
    'a[class*="arrow-right"]',

    // Ikone puscic (SVG inside button)
    'button:has(svg[class*="right"])',
    'button:has([class*="icon-right"])',
    'button:has([class*="chevron-right"])',

    // =============================================
    // SPLOSNI NEXT GUMBI
    // =============================================
    'button[class*="next"]:not([disabled])',
    'a[class*="next"]',
    '[class*="next-page"]',
    '[class*="btn-next"]',
    '.next:not(.disabled)',

    // Arrows
    '[class*="arrow-right"]:not([disabled])',
    '[class*="chevron-right"]:not([disabled])',
    '[class*="right-arrow"]:not([disabled])',
    '[class*="icon-arrow-right"]',
    '[class*="icon-chevron-right"]',

    // Slovenian
    '[aria-label*="nasledn" i]',
    '[aria-label*="Naprej" i]',
    '[title*="nasledn" i]',
    '[title*="Naprej" i]',
    '[aria-label*="desno" i]',

    // ARIA
    'a[aria-label*="next" i]',
    'button[aria-label*="next" i]',
    'a[rel="next"]',
    '[aria-label*="right" i]',

    // Pagination
    '[class*="pagination"] [class*="next"]',
    '.pagination .next',
    '.pager .next',

    // Sliders/carousels
    '[class*="slick-next"]',
    '[class*="swiper-button-next"]',
    '[class*="carousel-next"]',
    '[class*="slider-next"]',
    '[class*="gallery-next"]'
  ];

  for (const selector of nextSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (!el.disabled && !el.classList.contains('disabled') && !el.hasAttribute('aria-disabled')) {
            console.log(`Found next button: ${selector}`);
            return el;
          }
        }
      }
    } catch (e) {}
  }

  // Fallback: look for text-based buttons
  const allButtons = document.querySelectorAll('button, a, [role="button"]');
  for (const btn of allButtons) {
    const text = (btn.textContent || '').trim().toLowerCase();
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

    if (text === '>' || text === '›' || text === '→' || text === '»' ||
        text === 'next' || text === 'naprej' || text === 'naslednja' ||
        ariaLabel.includes('next') || ariaLabel.includes('nasledn')) {
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && !btn.disabled) {
        console.log(`Found next button by text: "${text || ariaLabel}"`);
        return btn;
      }
    }
  }

  return null;
}

function hasInfiniteScroll() {
  // Check for infinite scroll indicators
  const indicators = [
    '[class*="infinite"]',
    '[class*="load-more"]',
    '[data-infinite]',
    '[class*="lazy-load"]'
  ];

  for (const selector of indicators) {
    if (document.querySelector(selector)) {
      return true;
    }
  }

  return false;
}

async function handleInfiniteScroll() {
  console.log('Handling infinite scroll...');
  updateIndicator('Scrollam za vec izdelkov...');

  let lastHeight = document.body.scrollHeight;
  let noChangeCount = 0;
  const maxNoChange = 5;

  while (!window.scrapingState.shouldStop && noChangeCount < maxNoChange) {
    // Scroll down
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Scrape new products
    const newProducts = scrapeCurrentPage();

    // Check if page height changed
    const newHeight = document.body.scrollHeight;
    if (newHeight === lastHeight && newProducts === 0) {
      noChangeCount++;
      console.log(`No change (${noChangeCount}/${maxNoChange})`);
    } else {
      noChangeCount = 0;
      lastHeight = newHeight;
    }

    // Try clicking "Load More" button if exists
    try {
      const loadMoreBtn = document.querySelector('[class*="load-more"]:not([disabled]), button[class*="more"]:not([disabled])');
      if (loadMoreBtn) {
        const rect = loadMoreBtn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          console.log('Clicking load more button...');
          loadMoreBtn.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (e) {}
  }

  console.log('Infinite scroll handling complete');
}

async function handlePagination() {
  console.log('Handling pagination...');

  let pageCount = 0;
  const maxPages = 50;

  while (!window.scrapingState.shouldStop && pageCount < maxPages) {
    pageCount++;
    updateIndicator(`Stran ${pageCount}... (${window.scrapingState.totalProducts} izdelkov)`);

    // Scrape current page
    scrapeCurrentPage();

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check for STOP
    if (window.scrapingState.shouldStop) {
      console.log('Stop requested during pagination');
      break;
    }

    // Find and click next button
    const nextBtn = findNextButton();
    if (!nextBtn) {
      console.log('No more pages (next button not found)');
      break;
    }

    console.log(`Clicking next (page ${pageCount + 1})...`);
    nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 300));
    nextBtn.click();

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2500));
  }

  console.log(`Pagination complete: ${pageCount} pages`);
}

// ============================================
// MAIN SCRAPING FUNCTION
// ============================================

async function startScraping() {
  console.log('=== STARTING FULL SCRAPE ===');

  window.scrapingState.isActive = true;
  window.scrapingState.shouldStop = false;
  window.scrapingState.products = [];
  window.scrapingState.seenFingerprints = new Set();
  window.scrapingState.totalProducts = 0;
  window.scrapingState.store = detectStore();

  updateIndicator('Zacinam skeniranje...');

  try {
    // =============================================
    // 1. NAJPREJ SCROLLAJ DOL da se nalozijo vsi izdelki
    // =============================================
    console.log('Step 1: Scrolling down to load all products...');
    updateIndicator('Scrollam dol...');

    let lastHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 20;

    while (scrollAttempts < maxScrollAttempts && !window.scrapingState.shouldStop) {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // SKENIRAJ IZDELKE MED SCROLLANJEM
      const newProductsThisScroll = scrapeCurrentPage();
      updateIndicator(`Scrollam... ${window.scrapingState.totalProducts} izdelkov`);

      const newHeight = document.body.scrollHeight;
      if (newHeight === lastHeight && newProductsThisScroll === 0) {
        scrollAttempts++;
        if (scrollAttempts >= 3) break;  // 3x enaka visina in ni novih izdelkov = konec
      } else {
        scrollAttempts = 0;
        lastHeight = newHeight;
      }

      // Klikni "Load more" ce obstaja
      try {
        const loadMoreBtn = document.querySelector(
          '[class*="load-more"]:not([disabled]), ' +
          '[class*="loadMore"]:not([disabled]), ' +
          '[class*="LoadMore"]:not([disabled]), ' +
          'button[class*="more"]:not([disabled]), ' +
          '[class*="show-more"]:not([disabled]), ' +
          '[class*="showMore"]:not([disabled]), ' +
          '[class*="prikazi-vec"]:not([disabled]), ' +
          '[class*="prikaziVec"]:not([disabled]), ' +
          '[class*="see-more"]:not([disabled]), ' +
          '[class*="view-more"]:not([disabled])'
        );
        if (loadMoreBtn && loadMoreBtn.offsetHeight > 0) {
          console.log('Clicking load more button...');
          loadMoreBtn.click();
          await new Promise(resolve => setTimeout(resolve, 1500));
          scrapeCurrentPage(); // Skeniraj po load more
        }
      } catch (e) {
        console.log('Load more button check skipped');
      }
    }

    // Vrni se na vrh
    window.scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 500));

    // =============================================
    // 2. SKENIRAJ TRENUTNO STRAN
    // =============================================
    console.log('Step 2: Scraping current view...');
    scrapeCurrentPage();

    if (window.scrapingState.shouldStop) {
      return getResults();
    }

    // =============================================
    // 3. ISCI PAGINACIJO ALI KATALOG NAVIGACIJO
    // =============================================
    console.log('Step 3: Looking for pagination/navigation...');

    let pageCount = 1;
    const maxPages = 100;
    let consecutiveNoNewProducts = 0;

    while (pageCount < maxPages && !window.scrapingState.shouldStop) {
      // Poisci next gumb
      const nextBtn = findNextButton();

      if (!nextBtn) {
        console.log('No next button found, done.');
        break;
      }

      // Preveri da je gumb viden
      const rect = nextBtn.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.log('Next button not visible, done.');
        break;
      }

      pageCount++;
      updateIndicator(`Stran ${pageCount}... (${window.scrapingState.totalProducts} izdelkov)`);
      console.log(`Clicking next button for page ${pageCount}...`);

      // Klikni next
      nextBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 200));
      nextBtn.click();

      // Cakaj da se stran nalozi
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Scrolla dol na novi strani
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(resolve => setTimeout(resolve, 500));
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Skeniraj
      const beforeCount = window.scrapingState.totalProducts;
      scrapeCurrentPage();
      const newProducts = window.scrapingState.totalProducts - beforeCount;

      console.log(`Page ${pageCount}: found ${newProducts} new products`);

      if (newProducts === 0) {
        consecutiveNoNewProducts++;
        if (consecutiveNoNewProducts >= 3) {
          console.log('3 consecutive pages with no new products, stopping.');
          break;
        }
      } else {
        consecutiveNoNewProducts = 0;
      }
    }

    console.log(`Scraping complete: ${window.scrapingState.totalProducts} total products`);
    updateIndicator(`KONCANO! Najdenih ${window.scrapingState.totalProducts} izdelkov`);

  } catch (error) {
    console.error('Scraping error:', error);
    updateIndicator(`Napaka: ${error.message}`);
  }

  window.scrapingState.isActive = false;

  // Shrani v storage
  saveProductsToStorage();

  // Poslji rezultate v popup
  try {
    if (isExtensionValid()) {
      const productCount = window.scrapingState.products.length;
      const sendProducts = productCount > 5000 ? [] : window.scrapingState.products;

      chrome.runtime.sendMessage({
        action: 'scrapeComplete',
        products: sendProducts,
        productsFound: window.scrapingState.totalProducts,
        store: window.scrapingState.store,
        readFromStorage: productCount > 5000
      }).catch(() => {});
      console.log('Sent scrapeComplete message with', window.scrapingState.totalProducts, 'products (readFromStorage:', productCount > 5000, ')');
    }
  } catch (e) {
    console.log('Could not send completion message:', e);
  }

  return getResults();
}

function getResults() {
  return {
    success: true,
    products: window.scrapingState.products,
    productsFound: window.scrapingState.totalProducts,
    store: window.scrapingState.store
  };
}

// ============================================
// MESSAGE LISTENER
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.action);

  if (message.action === 'ping') {
    sendResponse({ pong: true, version: 'full-scraper-v1' });
    return true;
  }

  if (message.action === 'scrape') {
    // Start scraping in background and return immediately
    if (window.scrapingState.isActive) {
      sendResponse({
        success: true,
        started: true,
        store: detectStore(),
        message: 'Scraping already in progress'
      });
      return true;
    }

    // Start async scraping
    window.scrapingState.isActive = true;
    sendResponse({
      success: true,
      started: true,
      store: detectStore()
    });

    // Run scraping in background
    startScraping().then(result => {
      console.log('Scraping completed:', result.productsFound, 'products');
    });

    return true;
  }

  if (message.action === 'stop') {
    console.log('STOP requested');
    console.log('Current state:', {
      isActive: window.scrapingState.isActive,
      totalProducts: window.scrapingState.totalProducts,
      productsArrayLength: window.scrapingState.products ? window.scrapingState.products.length : 'undefined'
    });

    window.scrapingState.shouldStop = true;
    window.scrapingState.isActive = false;

    // Shrani v storage pred posiljanjem
    saveProductsToStorage();

    // Kopiraj products array da preprecimo reference issues
    const productsCopy = window.scrapingState.products ? [...window.scrapingState.products] : [];

    console.log('Sending response with', productsCopy.length, 'products');

    // Ce je prevec izdelkov, poslji samo stevilo in reci popup-u naj prebere iz storage
    if (productsCopy.length > 5000) {
      console.log('Too many products, telling popup to read from storage');
      sendResponse({
        stopped: true,
        products: [], // prazno, popup bo prebral iz storage
        productsFound: window.scrapingState.totalProducts,
        store: window.scrapingState.store,
        readFromStorage: true
      });
    } else {
      sendResponse({
        stopped: true,
        products: productsCopy,
        productsFound: window.scrapingState.totalProducts,
        store: window.scrapingState.store
      });
    }
    return true;
  }

  if (message.action === 'getStatus') {
    sendResponse({
      isActive: window.scrapingState.isActive,
      productsFound: window.scrapingState.totalProducts,
      store: window.scrapingState.store
    });
    return true;
  }

  return false;
});

console.log('PrHran Scraper ready! Store:', detectStore());

} // end if not already loaded
