/**
 * SCRAPER ZA SLIKE IZDELKOV - SPAR
 * Pobere slike iz Spar.si in jih shrani v Convex
 */

const { chromium } = require('playwright');
const https = require('https');

const CONVEX_URL = "https://vibrant-dolphin-871.convex.cloud";
const BATCH_SIZE = 10; // Število izdelkov naenkrat

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
async function getProductsWithoutImages() {
  // Ta funkcija bi morala klicati Convex, ampak za zdaj uporabimo hardkodirane teste
  // V produkciji bi morali dodati Convex endpoint
  return [
    { id: "test1", name: "jogurt", store: "Spar" },
  ];
}

// Očisti ime izdelka za boljše iskanje
function cleanProductName(name) {
  return name
    .replace(/,?\s*(SPAR|S-BUDGET|NATUR\*PUR)\s*,?/gi, '')  // Odstrani blagovne znamke trgovine
    .replace(/\d+[.,]?\d*\s*%\s*(M\.?M\.?)?/gi, '')         // Odstrani % maščobe
    .replace(/\d+[.,]?\d*\s*(G|KG|L|ML|DL|CL|KOS|X)\b/gi, '') // Odstrani velikosti
    .replace(/[,\.]+/g, ' ')                                 // Vejice in pike v presledke
    .replace(/\s+/g, ' ')                                    // Več presledkov v enega
    .trim()
    .substring(0, 50);                                       // Omeji dolžino
}

// Išči sliko na Spar.si
async function searchSparImage(page, productName, index) {
  try {
    // Očisti ime za iskanje
    const cleanName = cleanProductName(productName);
    const searchUrl = `https://www.spar.si/online/iskanje/?q=${encodeURIComponent(cleanName)}`;
    console.log(`  🔍 Iščem: "${cleanName}"`);

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);

    // Debug screenshot
    await page.screenshot({ path: `spar-debug-${index}.png` });

    // Poišči sliko izdelka
    const result = await page.evaluate(() => {
      const allImgs = Array.from(document.querySelectorAll('img'));
      const imgData = allImgs
        .filter(img => img.src && img.src.startsWith('http'))
        .map(img => img.src)
        .slice(0, 10);

      // Poišči CDN sliko
      for (const src of imgData) {
        if (src.includes('interspar') || src.includes('cdn1')) {
          return { found: src, all: imgData };
        }
      }

      return { found: null, all: imgData };
    });

    console.log(`  📸 Najdene slike: ${result.all.length}`);
    if (result.all.length > 0) {
      console.log(`  📷 Prva: ${result.all[0].substring(0, 60)}...`);
    }

    return result.found;
  } catch (error) {
    console.log(`  ❌ Napaka: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 SPAR IMAGE SCRAPER\n');
  console.log('=' .repeat(50));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // Pridobi izdelke brez slik
  console.log('\n📦 Pridobivam izdelke brez slik...');
  const products = await getProductsWithoutImages();
  console.log(`   Najdenih: ${products.length} izdelkov\n`);

  let found = 0;
  let notFound = 0;
  const results = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`\n[${i + 1}/${products.length}] ${product.name}`);

    const imageUrl = await searchSparImage(page, product.name, i);

    if (imageUrl) {
      console.log(`  ✅ ${imageUrl.substring(0, 70)}...`);
      found++;
      results.push({ id: product.id, name: product.name, imageUrl });
    } else {
      console.log(`  ❌ Slika ni najdena`);
      notFound++;
    }

    // Kratka pavza med zahtevki
    await page.waitForTimeout(500);
  }

  await browser.close();

  // Izpis rezultatov
  console.log('\n' + '='.repeat(50));
  console.log('📊 REZULTATI:');
  console.log(`   ✅ Najdene slike: ${found}`);
  console.log(`   ❌ Ni slike: ${notFound}`);
  console.log('='.repeat(50));

  if (results.length > 0) {
    console.log('\n📸 Najdene slike:');
    results.forEach(r => {
      console.log(`   - ${r.name.substring(0, 40)}...`);
      console.log(`     ${r.imageUrl}`);
    });
  }

  // TODO: Posodobi Convex bazo s slikami
  // await updateConvexImages(results);
}

main().catch(console.error);
