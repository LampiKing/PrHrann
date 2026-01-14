/* eslint-disable no-console */
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");

const CONVEX_INGEST_URL = process.env.PRHRAN_INGEST_URL || "https://vibrant-dolphin-871.convex.site/api/ingest/grocery";
const CONVEX_INGEST_TOKEN = process.env.PRHRAN_INGEST_TOKEN || "prhran-scraper-2024";

const STORE_SHEETS = [
  { storeName: "Mercator", spreadsheetId: "1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0" },
  { storeName: "Spar", spreadsheetId: "1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok" },
  { storeName: "Tus", spreadsheetId: "17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A" },
];

const SHEET_RANGE = "'Podatki'!A2:F50000";
const UPLOAD_BATCH_SIZE = 300;

// Znane blagovne znamke
const BRANDS = [
  "milka", "kinder", "nutella", "ferrero", "oreo", "barilla", "knorr",
  "alpsko", "mu", "ego", "zott", "danone", "activia", "actimel",
  "argeta", "podravka", "vegeta", "cedevita", "cockta", "radenska", "donat",
  "coca cola", "coca-cola", "pepsi", "fanta", "sprite", "schweppes",
  "red bull", "monster", "hell", "guarana",
  "manner", "lindt", "toblerone", "raffaello", "kras", "kraš",
  "spar", "mercator", "tus", "tuš", "hofer", "lidl",
  "dr oetker", "dr. oetker", "natureta", "eta", "delamaris",
  "nivea", "dove", "palmolive", "colgate", "oral-b", "signal",
  "fairy", "jar", "pur", "ajax", "cillit", "vanish", "persil", "ariel",
  "pampers", "huggies", "libero", "always", "kotex",
  "nescafe", "jacobs", "lavazza", "illy", "barcaffe",
  "lipton", "pickwick", "teekanne",
  "lotus", "biscoff",
  "haribo", "m&m", "twix", "snickers", "mars", "bounty", "kitkat",
  "pringles", "lay's", "lays", "chio", "estrella",
  "heinz", "hellmann", "hellmans",
  "presidente", "grana padano", "parmigiano",
  "philadelphia", "president", "bridel",
  "vindija", "dukat", "meggle", "z'bregov", "pomurske mlekarne",
  "poli", "zlato polje", "perutnina", "panvita", "celjske mesnine",
  "mercator", "spar premium", "s-budget",
];

const CATEGORIES = {
  cokolada: ["čokolada", "cokolada", "chocolate", "čoko", "coko"],
  piskoti: ["piškoti", "piskoti", "keksi", "keks", "biscuit", "wafer", "napolitanke"],
  mleko: ["mleko", "milk", "trajno mleko", "sveže mleko"],
  jogurt: ["jogurt", "yogurt", "skyr", "kefir"],
  sir: ["sir", "cheese", "edamer", "gouda", "parmezan", "mozzarella", "mascarpone"],
  meso: ["meso", "piščanec", "piscancje", "goveje", "svinjina", "puranje", "salama", "hrenovka"],
  kruh: ["kruh", "bread", "žemlja", "zemlja", "toast", "bageta"],
  testenine: ["testenine", "pasta", "špageti", "spageti", "makaroni", "lazanja"],
  pijaca: ["sok", "juice", "voda", "water", "pijača", "pijaca", "gazirano"],
  sladkarije: ["bonboni", "sladkarije", "lizika", "gumi", "žele", "zele"],
  cips: ["čips", "cips", "chips", "snack", "prigrizek", "smoki", "flips"],
  kava: ["kava", "coffee", "espresso", "cappuccino"],
  caj: ["čaj", "caj", "tea"],
  olje: ["olje", "oil", "olivno", "soncnicno", "sončnično"],
  kis: ["kis", "vinegar", "balzamicni", "balzamični"],
  omaka: ["omaka", "sauce", "ketchup", "kecap", "majoneza", "mayo", "gorčica"],
  konzerva: ["konzerva", "tuna", "sardina", "fižol", "fizol", "grah", "koruza"],
};

function readEnvFile(path) {
  const text = fs.readFileSync(path, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function httpsRequest({ method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ method, hostname: u.hostname, path: u.pathname + u.search, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode || 0, data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const claimSet = { iss: credentials.client_email, scope: "https://www.googleapis.com/auth/spreadsheets.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const signingInput = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify(claimSet))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const jwt = `${signingInput}.${base64url(signer.sign(credentials.private_key))}`;
  const body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }).toString();
  const res = await httpsRequest({ method: "POST", url: "https://oauth2.googleapis.com/token", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) }, body });
  return JSON.parse(res.data).access_token;
}

function extractImageUrl(cellValue) {
  if (!cellValue) return undefined;
  const formula = String(cellValue).trim();
  if (formula.startsWith("http")) return formula;
  const match = formula.match(/=IMAGE\s*\(\s*"([^"]+)"/i);
  return match ? match[1] : undefined;
}

function parsePriceValue(input) {
  if (input === null || input === undefined) return undefined;
  if (typeof input === "number") return Number.isFinite(input) && input > 0 ? input : undefined;
  const text = String(input).replace(/\s+/g, " ").trim();
  const match = text.match(/(\d+(?:[,.]\d+)?)/);
  if (!match) return undefined;
  const value = parseFloat(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function fetchSheetRows({ spreadsheetId, accessToken }) {
  const range = encodeURIComponent(SHEET_RANGE);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMULA`;
  const res = await httpsRequest({ method: "GET", url, headers: { Authorization: `Bearer ${accessToken}` } });
  return res.status === 200 ? JSON.parse(res.data).values || [] : [];
}

function extractComponents(name) {
  const lower = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  let brand = null;
  for (const b of BRANDS) {
    if (lower.includes(b)) { brand = b; break; }
  }

  let category = null;
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(k => lower.includes(k))) { category = cat; break; }
  }

  const quantityMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|dl|kom|kos|x)\b/i);
  let quantity = null;
  if (quantityMatch) {
    let value = parseFloat(quantityMatch[1].replace(",", "."));
    const unit = quantityMatch[2].toLowerCase();
    if (unit === "g") { value = value / 1000; quantity = `${value}kg`; }
    else if (unit === "ml") { value = value / 1000; quantity = `${value}l`; }
    else if (unit === "cl") { value = value / 100; quantity = `${value}l`; }
    else if (unit === "dl") { value = value / 10; quantity = `${value}l`; }
    else { quantity = `${value}${unit}`; }
  }

  const flavorKeywords = ["mlecna", "mlečna", "temna", "bela", "oreo", "lešnik", "lesnik", "karamel", "jagod", "vanilja", "cokolad", "čokolad"];
  const flavors = flavorKeywords.filter(f => lower.includes(f));

  return { brand, category, quantity, flavors };
}

function createProductKey(components) {
  const parts = [];
  if (components.brand) parts.push(components.brand);
  if (components.category) parts.push(components.category);
  if (components.quantity) parts.push(components.quantity);
  if (components.flavors.length > 0) parts.push(components.flavors.sort().join("-"));
  return parts.join("|") || null;
}

function createNiceName(products) {
  const scored = products.map(p => {
    let score = 0;
    if (p.name.length >= 10 && p.name.length <= 60) score += 20;
    if (p.name !== p.name.toUpperCase()) score += 15;
    if (/^[A-ZČŠŽ][a-zčšž]/.test(p.name)) score += 10;
    return { name: p.name, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].name.replace(/,?\s*(mercator|spar|tus|tuš)\s*$/i, "").trim();
}

async function uploadBatch({ items, clearFirst }) {
  const body = JSON.stringify({ items, clearFirst });
  const res = await httpsRequest({
    method: "POST",
    url: CONVEX_INGEST_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONVEX_INGEST_TOKEN}`,
      "Content-Length": Buffer.byteLength(body),
    },
    body,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Convex ingest failed: ${res.status} ${res.data}`);
  }
  return JSON.parse(res.data);
}

async function main() {
  const envFromFile = fs.existsSync(".env.local") ? readEnvFile(".env.local") : {};
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || envFromFile.GOOGLE_CREDENTIALS);
  const accessToken = await getAccessToken(credentials);

  console.log("🔄 Berem podatke iz Google Sheets...\n");

  // Zberi vse izdelke
  const allProducts = [];

  for (const sheet of STORE_SHEETS) {
    console.log(`📊 Berem ${sheet.storeName}...`);
    const rows = await fetchSheetRows({ spreadsheetId: sheet.spreadsheetId, accessToken });
    console.log(`   ${rows.length} vrstic`);

    for (const row of rows) {
      const name = String(row?.[0] || "").trim();
      const regularPrice = parsePriceValue(row?.[1]);
      const imageUrl = extractImageUrl(row?.[2]);
      const salePrice = parsePriceValue(row?.[3]);

      if (!name || !regularPrice) continue;

      const components = extractComponents(name);
      const key = createProductKey(components);

      allProducts.push({
        name, regularPrice,
        salePrice: salePrice && salePrice < regularPrice ? salePrice : undefined,
        imageUrl, store: sheet.storeName, key,
      });
    }
  }

  console.log(`\n📦 Skupaj: ${allProducts.length} izdelkov\n`);

  // Grupiraj po ključu
  const groups = new Map();
  for (const product of allProducts) {
    if (!product.key) continue;
    const existing = groups.get(product.key) || [];
    existing.push(product);
    groups.set(product.key, existing);
  }

  // Izdelki ki so v več trgovinah
  const multiStoreProducts = [];
  // Izdelki ki so samo v eni trgovini
  const singleStoreProducts = [];

  for (const [key, products] of groups) {
    const stores = new Set(products.map(p => p.store));
    if (stores.size >= 2) {
      // Združi v en izdelek z več cenami
      const byStore = new Map();
      for (const p of products) {
        const existing = byStore.get(p.store);
        if (!existing || p.regularPrice < existing.regularPrice) {
          byStore.set(p.store, p);
        }
      }
      const niceName = createNiceName(products);
      const bestImage = products.find(p => p.imageUrl)?.imageUrl;

      // Dodaj ločene vnose za vsako trgovino (z istim imenom!)
      for (const [store, product] of byStore) {
        multiStoreProducts.push({
          ime: niceName,
          redna_cena: product.regularPrice,
          akcijska_cena: product.salePrice,
          trgovina: store,
          slika: bestImage,
        });
      }
    } else {
      // Samo ena trgovina
      for (const product of products) {
        singleStoreProducts.push({
          ime: product.name,
          redna_cena: product.regularPrice,
          akcijska_cena: product.salePrice,
          trgovina: product.store,
          slika: product.imageUrl,
        });
      }
    }
  }

  // Izdelki brez ključa (ni brand/kategorija/količina)
  for (const product of allProducts) {
    if (product.key) continue;
    singleStoreProducts.push({
      ime: product.name,
      redna_cena: product.regularPrice,
      akcijska_cena: product.salePrice,
      trgovina: product.store,
      slika: product.imageUrl,
    });
  }

  console.log(`🔗 Združeni izdelki (več trgovin): ${multiStoreProducts.length} vnosov`);
  console.log(`📝 Samostojni izdelki: ${singleStoreProducts.length} vnosov`);

  // Združi vse za uvoz
  const allItems = [...multiStoreProducts, ...singleStoreProducts];
  console.log(`\n📤 Uvažam ${allItems.length} izdelkov v Convex...\n`);

  let batch = [];
  let firstUpload = true;
  let totals = { createdProducts: 0, updatedProducts: 0, createdPrices: 0, updatedPrices: 0 };

  const flush = async () => {
    if (batch.length === 0) return;
    const result = await uploadBatch({ items: batch, clearFirst: firstUpload });
    firstUpload = false;
    totals.createdProducts += result.createdProducts || 0;
    totals.updatedProducts += result.updatedProducts || 0;
    totals.createdPrices += result.createdPrices || 0;
    totals.updatedPrices += result.updatedPrices || 0;
    console.log(`   ✅ Batch: +${result.createdProducts || 0} izdelkov, +${result.createdPrices || 0} cen`);
    batch = [];
  };

  for (const item of allItems) {
    batch.push(item);
    if (batch.length >= UPLOAD_BATCH_SIZE) {
      await flush();
    }
  }
  await flush();

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ KONČANO!`);
  console.log(`   Ustvarjeni izdelki: ${totals.createdProducts}`);
  console.log(`   Posodobljeni izdelki: ${totals.updatedProducts}`);
  console.log(`   Ustvarjene cene: ${totals.createdPrices}`);
  console.log(`   Posodobljene cene: ${totals.updatedPrices}`);
}

main().catch(console.error);
