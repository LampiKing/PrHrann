/**
 * SCRAPER ZA SLIKE IZDELKOV - VSE TRGOVINE
 * Pobere slike iz Spar, Mercator in Tuš in jih shrani v Convex
 */

const { chromium } = require('playwright');
const https = require('https');

const CONVEX_URL = "https://vibrant-dolphin-871.convex.cloud";
const BATCH_SIZE = 200; // Povečano za hitrejše scraping
const MAX_PRODUCTS = 1000; // Maksimalno število izdelkov na zagon

// HTTP request helper
function httpsRequest({ method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode || 0, data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// Pridobi izdelke brez slik iz Convexa
async function getProductsWithoutImages(limit = 100, offset = 0) {
  const url = `${CONVEX_URL}/api/query`;
  const payload = {
    path: "products:getProductsWithoutImages",
    args: { limit, offset }
  };

  try {
    const response = await httpsRequest({
      method: "POST",
      url,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = JSON.parse(response.data);
    return result.value || [];
  } catch (error) {
    console.error("Napaka pri pridobivanju izdelkov:", error.message);
    return [];
  }
}

// Posodobi slike v Convexu
async function updateImages(updates) {
  if (updates.length === 0) return { updated: 0, failed: 0 };

  const url = `${CONVEX_URL}/api/mutation`;
  const payload = {
    path: "products:batchUpdateImages",
    args: { updates }
  };

  try {
    const response = await httpsRequest({
      method: "POST",
      url,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = JSON.parse(response.data);
    return result.value || { updated: 0, failed: 0 };
  } catch (error) {
    console.error("Napaka pri posodabljanju slik:", error.message);
    return { updated: 0, failed: updates.length };
  }
}

// Ocisti ime izdelka za boljse iskanje
function cleanProductName(name) {
  return name
    .replace(/,?\s*(SPAR|S-BUDGET|NATUR\*PUR|MERCATOR|TUS|TUŠ)\s*,?/gi, '')
    .replace(/\d+[.,]?\d*\s*%\s*(M\.?M\.?)?/gi, '')
    .replace(/\d+[.,]?\d*\s*(G|KG|L|ML|DL|CL|KOS|X)\b/gi, '')
    .replace(/[,\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 40);
}

// === SPAR ===
async function setupSpar(page) {
  console.log("  Nalagam Spar in sprejemam piškotke...");
  await page.goto('https://www.spar.si/online', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Sprejmi piškotke - poskusi različne selektorje
  const cookieSelectors = [
    'button:has-text("Dovoli vse")',
    'button:has-text("Sprejmi vse")',
    'button:has-text("Dovoli izbor")',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '.CybotCookiebotDialogBodyButton',
    'button[data-action="accept"]',
  ];

  for (const selector of cookieSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        console.log("  Piškotki sprejeti (Spar)");
        await page.waitForTimeout(2000);
        break;
      }
    } catch { }
  }
}

async function searchSparImage(page, productName) {
  try {
    const cleanName = cleanProductName(productName);
    const searchUrl = `https://www.spar.si/online/iskanje/?q=${encodeURIComponent(cleanName)}`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Najdi sliko izdelka
    const imageUrl = await page.evaluate(() => {
      // Poišči product card slike
      const selectors = [
        '.product-card img',
        '.product-tile img',
        '[class*="product"] img',
        'article img',
        '.item img'
      ];

      for (const selector of selectors) {
        const imgs = document.querySelectorAll(selector);
        for (const img of imgs) {
          const src = img.src || img.dataset.src || img.getAttribute('data-lazy-src');
          if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('logo')) {
            // Preferiraj CDN slike
            if (src.includes('interspar') || src.includes('cdn') || src.includes('product')) {
              return src;
            }
          }
        }
      }

      // Fallback - katerakoli slika izdelka
      const allImgs = document.querySelectorAll('img');
      for (const img of allImgs) {
        const src = img.src;
        if (src && src.includes('interspar') && !src.includes('logo')) {
          return src;
        }
      }

      return null;
    });

    return imageUrl;
  } catch (error) {
    return null;
  }
}

// === MERCATOR ===
async function setupMercator(page) {
  console.log("  Nalagam Mercator in sprejemam piškotke...");
  await page.goto('https://mercatoronline.si', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Sprejmi piškotke
  const cookieSelectors = [
    'button:has-text("Sprejmi vse")',
    'button:has-text("Sprejmi")',
    'button:has-text("V redu")',
    '#onetrust-accept-btn-handler',
    '.accept-cookies',
  ];

  for (const selector of cookieSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        console.log("  Piškotki sprejeti (Mercator)");
        await page.waitForTimeout(2000);
        break;
      }
    } catch { }
  }
}

async function searchMercatorImage(page, productName) {
  try {
    const cleanName = cleanProductName(productName);
    const searchUrl = `https://mercatoronline.si/brskaj?query=${encodeURIComponent(cleanName)}`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);

    const imageUrl = await page.evaluate(() => {
      // Mercator product boxes
      const selectors = [
        '.box img',
        '.product-image img',
        '[class*="product"] img',
        '.card img'
      ];

      for (const selector of selectors) {
        const imgs = document.querySelectorAll(selector);
        for (const img of imgs) {
          const src = img.src || img.dataset.src;
          if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('logo')) {
            return src;
          }
        }
      }

      return null;
    });

    return imageUrl;
  } catch (error) {
    return null;
  }
}

// === TUS ===
async function setupTus(page) {
  console.log("  Nalagam Tuš in sprejemam piškotke...");
  await page.goto('https://www.tus.si', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Sprejmi piškotke
  const cookieSelectors = [
    'button:has-text("DOVOLIM VSE")',
    'button:has-text("Dovolim vse")',
    'button:has-text("Sprejmi vse")',
    'button:has-text("Sprejmi")',
    '.cookie-accept',
    '#accept-cookies',
  ];

  for (const selector of cookieSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        console.log("  Piškotki sprejeti (Tuš)");
        await page.waitForTimeout(2000);
        break;
      }
    } catch { }
  }
}

async function searchTusImage(page, productName) {
  try {
    const cleanName = cleanProductName(productName);

    // Tuš hitrinakup.com
    const searchUrl = `https://hitrinakup.com/iskanje?q=${encodeURIComponent(cleanName)}`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);

    const imageUrl = await page.evaluate(() => {
      const selectors = [
        '[class*="itemCard"] img',
        '[class*="ItemCard"] img',
        '.product-card img',
        '[class*="product"] img',
      ];

      for (const selector of selectors) {
        const imgs = document.querySelectorAll(selector);
        for (const img of imgs) {
          const src = img.src || img.dataset.src;
          if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('logo')) {
            return src;
          }
        }
      }

      return null;
    });

    return imageUrl;
  } catch (error) {
    return null;
  }
}

// === GLAVNI PROGRAM ===
async function main() {
  console.log('='.repeat(60));
  console.log('PRHRAN - SCRAPER SLIK IZDELKOV');
  console.log(`Datum: ${new Date().toLocaleString('sl-SI')}`);
  console.log('='.repeat(60));

  // Pridobi izdelke brez slik - več batchev
  console.log('\n📦 Pridobivam izdelke brez slik iz Convexa...');

  let allProducts = [];
  let offset = 0;

  while (allProducts.length < MAX_PRODUCTS) {
    const batch = await getProductsWithoutImages(BATCH_SIZE, offset);
    if (batch.length === 0) break;
    allProducts = allProducts.concat(batch);
    offset += BATCH_SIZE;
    console.log(`   Naloženo: ${allProducts.length} izdelkov...`);
  }

  const products = allProducts.slice(0, MAX_PRODUCTS);

  if (products.length === 0) {
    console.log('   Vsi izdelki imajo slike! Končano.');
    return;
  }

  console.log(`\n   📊 Skupaj: ${products.length} izdelkov brez slik\n`);

  // Zaženi brskalnik
  console.log('🌐 Zaganjam brskalnik...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'sl-SI'
  });

  // Ustvari strani za vsako trgovino
  const sparPage = await context.newPage();
  const mercatorPage = await context.newPage();
  const tusPage = await context.newPage();

  // Setup za vsako trgovino
  console.log('\n🔧 Pripravljam trgovine...');
  await setupSpar(sparPage);
  await setupMercator(mercatorPage);
  await setupTus(tusPage);

  console.log('\n🔍 Iščem slike za izdelke...\n');

  let found = 0;
  let notFound = 0;
  let totalUpdated = 0;
  let updates = [];
  const SAVE_EVERY = 25; // Shrani na Convex vsakih 25 najdenih slik

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const progress = `[${i + 1}/${products.length}]`;
    console.log(`${progress} ${product.name.substring(0, 50)}...`);

    let imageUrl = null;

    // Poskusi Spar
    imageUrl = await searchSparImage(sparPage, product.name);
    if (imageUrl) {
      console.log(`   ✅ Spar`);
    }

    // Če ni najdeno, poskusi Mercator
    if (!imageUrl) {
      imageUrl = await searchMercatorImage(mercatorPage, product.name);
      if (imageUrl) {
        console.log(`   ✅ Mercator`);
      }
    }

    // Če še vedno ni, poskusi Tuš
    if (!imageUrl) {
      imageUrl = await searchTusImage(tusPage, product.name);
      if (imageUrl) {
        console.log(`   ✅ Tuš`);
      }
    }

    if (imageUrl) {
      found++;
      updates.push({
        productId: product._id,
        imageUrl: imageUrl
      });

      // Periodično shranjevanje
      if (updates.length >= SAVE_EVERY) {
        console.log(`\n   💾 Shranjujem ${updates.length} slik...`);
        const result = await updateImages(updates);
        totalUpdated += result.updated;
        console.log(`   ✅ Shranjeno! Skupaj: ${totalUpdated} slik\n`);
        updates = [];
      }
    } else {
      console.log(`   ❌ Ni slike`);
      notFound++;
    }

    // Kratka pavza med zahtevki
    await sparPage.waitForTimeout(200);
  }

  await browser.close();

  // Shrani preostale
  if (updates.length > 0) {
    console.log(`\n💾 Shranjujem zadnjih ${updates.length} slik...`);
    const result = await updateImages(updates);
    totalUpdated += result.updated;
  }

  // Izpis rezultatov
  console.log('\n' + '='.repeat(60));
  console.log('📊 REZULTATI:');
  console.log(`   ✅ Najdene slike: ${found}`);
  console.log(`   💾 Shranjeno v Convex: ${totalUpdated}`);
  console.log(`   ❌ Brez slike: ${notFound}`);
  console.log(`   📈 Uspešnost: ${Math.round(found / products.length * 100)}%`);
  console.log('='.repeat(60));
  console.log('\n💡 Za naslednji batch poženi scraper znova!');
}

main().catch(console.error);
