/**
 * SCRAPER ZA SLIKE IZDELKOV
 * Išče slike na Spar.si in Tus.si
 */

const { chromium } = require('playwright');

// Testni izdelki brez slik
const TEST_PRODUCTS = [
  { name: "JOGURT BOROVNICA SPAR, 500G", store: "Spar" },
  { name: "mleko", store: "Tus" },
  { name: "jogurt", store: "Tus" },
  { name: "PAŠTETA DIVJAČINSKA KODILA, 150G", store: "Spar" },
];

async function searchSpar(page, productName) {
  try {
    // Spar.si iskanje
    const searchUrl = `https://www.spar.si/online/iskanje/?q=${encodeURIComponent(productName)}`;
    console.log(`  🔍 Iščem na Spar: ${productName}`);

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Poišči prvo sliko izdelka
    const imageUrl = await page.evaluate(() => {
      const img = document.querySelector('.product-box img, .product-image img, [class*="product"] img');
      return img ? img.src : null;
    });

    if (imageUrl) {
      console.log(`  ✅ Najdena slika: ${imageUrl.substring(0, 60)}...`);
    } else {
      console.log(`  ❌ Ni slike`);
    }

    return imageUrl;
  } catch (error) {
    console.log(`  ❌ Napaka: ${error.message}`);
    return null;
  }
}

async function searchTus(page, productName) {
  try {
    // Tuš iskanje - uporabi hitri nakup
    const searchUrl = `https://www.tus.si/hitri-nakup/iskanje?q=${encodeURIComponent(productName)}`;
    console.log(`  🔍 Iščem na Tuš: ${productName}`);

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000); // Počakaj na JS

    // Shrani screenshot za debug
    await page.screenshot({ path: `tus-debug-${Date.now()}.png` });
    console.log(`  📸 Screenshot shranjen`);

    // Poišči sliko izdelka
    const imageUrl = await page.evaluate(() => {
      // Poišči vse slike
      const allImgs = Array.from(document.querySelectorAll('img'));
      const imgInfo = allImgs.map(img => ({
        src: img.src,
        dataSrc: img.dataset.src,
        alt: img.alt,
        className: img.className,
        parentClass: img.parentElement?.className
      })).filter(i => i.src && i.src.startsWith('http'));

      console.log('Found images:', imgInfo);

      // Poišči sliko izdelka
      for (const img of allImgs) {
        const src = img.src || img.dataset.src || '';
        if (src.includes('produkt') || src.includes('artikel') || src.includes('product')) {
          return src;
        }
      }

      // Poišči sliko v product kartici
      const productCard = document.querySelector('[class*="product"], [class*="artikel"], .item');
      if (productCard) {
        const img = productCard.querySelector('img');
        if (img && img.src && img.src.startsWith('http')) {
          return img.src;
        }
      }

      return null;
    });

    if (imageUrl && !imageUrl.includes('bg-fresh') && !imageUrl.includes('theme')) {
      console.log(`  ✅ Najdena slika: ${imageUrl.substring(0, 60)}...`);
    } else {
      console.log(`  ❌ Ni prave slike izdelka`);
      return null;
    }

    return imageUrl;
  } catch (error) {
    console.log(`  ❌ Napaka: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Zaganjam scraper za slike...\n');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  console.log('📊 Testiram iskanje slik...\n');

  for (const product of TEST_PRODUCTS) {
    console.log(`\n📦 ${product.name}`);

    if (product.store === 'Spar') {
      await searchSpar(page, product.name);
    } else if (product.store === 'Tus') {
      await searchTus(page, product.name);
    }
  }

  await browser.close();
  console.log('\n✅ Test končan!');
}

main().catch(console.error);
