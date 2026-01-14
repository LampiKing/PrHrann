/* eslint-disable no-console */
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");

const STORE_SHEETS = [
  { storeName: "Mercator", spreadsheetId: "1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0" },
  { storeName: "Spar", spreadsheetId: "1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok" },
  { storeName: "Tus", spreadsheetId: "17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A" },
];

const SHEET_RANGE = "'Podatki'!A2:F50000";

// Znane blagovne znamke
const BRANDS = [
  "milka", "kinder", "nutella", "ferrero", "oreo", "barilla", "knorr",
  "alpsko", "mu", "ego", "zott", "danone", "activia", "actimel",
  "argeta", "podravka", "vegeta", "cedevita", "cockta", "radenska", "donat",
  "coca cola", "coca-cola", "pepsi", "fanta", "sprite", "schweppes",
  "red bull", "monster", "hell", "guarana",
  "manner", "lindt", "toblerone", "raffaello", "kras", "kraš",
  "spar", "mercator", "tus", "tuš", "hofer", "lidl",
  "dr oetker", "dr. oetker", "podravka", "natureta", "eta", "delamaris",
  "nivea", "dove", "palmolive", "colgate", "oral-b", "signal",
  "fairy", "jar", "pur", "ajax", "cillit", "vanish", "persil", "ariel",
  "pampers", "huggies", "libero", "always", "kotex",
  "nescafe", "jacobs", "lavazza", "illy", "barcaffe",
  "lipton", "pickwick", "teekanne",
  "nutella", "lotus", "biscoff",
  "haribo", "m&m", "twix", "snickers", "mars", "bounty", "kitkat",
  "pringles", "lay's", "lays", "chio", "estrella",
  "heinz", "hellmann", "hellmans",
  "presidente", "grana padano", "parmigiano",
  "philadelphia", "president", "bridel",
  "vindija", "dukat", "meggle", "z'bregov", "pomurske mlekarne",
  "poli", "zlato polje", "perutnina", "panvita", "celjske mesnine",
  "mercator", "spar premium", "s-budget",
];

// Kategorije izdelkov
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
  const claimSet = { iss: credentials.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
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

// Izloči komponente iz imena izdelka
function extractComponents(name) {
  const lower = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  // Najdi brand
  let brand = null;
  for (const b of BRANDS) {
    if (lower.includes(b)) {
      brand = b;
      break;
    }
  }

  // Najdi kategorijo
  let category = null;
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(k => lower.includes(k))) {
      category = cat;
      break;
    }
  }

  // Izloči količino (npr. 300g, 1L, 500ml)
  const quantityMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|dl|kom|kos|x)\b/i);
  let quantity = null;
  if (quantityMatch) {
    let value = parseFloat(quantityMatch[1].replace(",", "."));
    const unit = quantityMatch[2].toLowerCase();
    // Normaliziraj v osnovno enoto
    if (unit === "g") { value = value / 1000; quantity = `${value}kg`; }
    else if (unit === "ml") { value = value / 1000; quantity = `${value}l`; }
    else if (unit === "cl") { value = value / 100; quantity = `${value}l`; }
    else if (unit === "dl") { value = value / 10; quantity = `${value}l`; }
    else { quantity = `${value}${unit}`; }
  }

  // Izloči dodatne ključne besede (okus, varianta)
  const flavorKeywords = ["mlecna", "mlečna", "temna", "bela", "oreo", "lešnik", "lesnik", "karamel", "jagod", "vanilja", "cokolad", "čokolad"];
  const flavors = flavorKeywords.filter(f => lower.includes(f));

  return { brand, category, quantity, flavors, original: name, normalized: lower };
}

// Ustvari ključ za grupiranje
function createProductKey(components) {
  const parts = [];
  if (components.brand) parts.push(components.brand);
  if (components.category) parts.push(components.category);
  if (components.quantity) parts.push(components.quantity);
  if (components.flavors.length > 0) parts.push(components.flavors.sort().join("-"));
  return parts.join("|") || null;
}

// Ustvari lepo ime izdelka
function createNiceName(products) {
  // Uporabi najbolj "normalno" ime (ne vse caps, srednja dolžina)
  const scored = products.map(p => {
    let score = 0;
    if (p.name.length >= 10 && p.name.length <= 60) score += 20;
    if (p.name !== p.name.toUpperCase()) score += 15;
    if (/^[A-ZČŠŽ][a-zčšž]/.test(p.name)) score += 10;
    return { name: p.name, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // Poenostavi ime
  let name = scored[0].name;
  // Odstrani ", XYZ" na koncu če je to trgovina
  name = name.replace(/,?\s*(mercator|spar|tus|tuš)\s*$/i, "");
  return name.trim();
}

async function main() {
  const envFromFile = fs.existsSync(".env.local") ? readEnvFile(".env.local") : {};
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || envFromFile.GOOGLE_CREDENTIALS);
  const accessToken = await getAccessToken(credentials);

  console.log("Berem podatke iz Google Sheets...\n");

  // Zberi vse izdelke
  const allProducts = [];

  for (const sheet of STORE_SHEETS) {
    console.log(`Berem ${sheet.storeName}...`);
    const rows = await fetchSheetRows({ spreadsheetId: sheet.spreadsheetId, accessToken });
    console.log(`  ${rows.length} vrstic`);

    for (const row of rows) {
      const name = String(row?.[0] || "").trim();
      const regularPrice = parsePriceValue(row?.[1]);
      const imageUrl = extractImageUrl(row?.[2]);
      const salePrice = parsePriceValue(row?.[3]);

      if (!name || !regularPrice) continue;

      const components = extractComponents(name);
      const key = createProductKey(components);

      allProducts.push({
        name,
        regularPrice,
        salePrice: salePrice && salePrice < regularPrice ? salePrice : undefined,
        imageUrl,
        store: sheet.storeName,
        components,
        key,
      });
    }
  }

  console.log(`\nSkupaj: ${allProducts.length} izdelkov`);

  // Grupiraj po ključu
  const groups = new Map();
  for (const product of allProducts) {
    if (!product.key) continue;
    const existing = groups.get(product.key) || [];
    existing.push(product);
    groups.set(product.key, existing);
  }

  // Poišči grupe z izdelki iz več trgovin
  const multiStoreGroups = [];
  for (const [key, products] of groups) {
    const stores = new Set(products.map(p => p.store));
    if (stores.size >= 2) {
      multiStoreGroups.push({ key, products, storeCount: stores.size });
    }
  }

  console.log(`\nGrupe z izdelki iz več trgovin: ${multiStoreGroups.length}`);

  // Pripravi podatke za uvoz v Convex
  const mergedProducts = [];

  for (const group of multiStoreGroups) {
    const byStore = new Map();
    for (const p of group.products) {
      // Vzemi najcenejšega za vsako trgovino
      const existing = byStore.get(p.store);
      if (!existing || p.regularPrice < existing.regularPrice) {
        byStore.set(p.store, p);
      }
    }

    const niceName = createNiceName(group.products);
    const bestImage = group.products.find(p => p.imageUrl)?.imageUrl;

    mergedProducts.push({
      name: niceName,
      imageUrl: bestImage,
      prices: Array.from(byStore.values()).map(p => ({
        store: p.store,
        regularPrice: p.regularPrice,
        salePrice: p.salePrice,
      })),
    });
  }

  console.log(`\nZdruženih izdelkov: ${mergedProducts.length}`);

  // Pokaži primere
  console.log(`\n${"=".repeat(60)}`);
  console.log("Primeri združenih izdelkov:\n");

  for (const product of mergedProducts.slice(0, 20)) {
    console.log(`📦 ${product.name}`);
    for (const price of product.prices) {
      const priceStr = price.salePrice
        ? `${price.salePrice.toFixed(2)}€ (redna: ${price.regularPrice.toFixed(2)}€)`
        : `${price.regularPrice.toFixed(2)}€`;
      console.log(`   [${price.store}] ${priceStr}`);
    }
    console.log();
  }

  // Shrani za uvoz
  const outputPath = "merged-products.json";
  fs.writeFileSync(outputPath, JSON.stringify(mergedProducts, null, 2));
  console.log(`\n✅ Shranjeno v ${outputPath}`);
  console.log(`   ${mergedProducts.length} izdelkov pripravljenih za uvoz`);
}

main().catch(console.error);
