/* eslint-disable no-console */
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");

// Iste konstante kot v publish-sheets-to-convex.js
const STORE_SHEETS = [
  {
    storeName: "Mercator",
    spreadsheetId: "1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0",
  },
  {
    storeName: "Spar",
    spreadsheetId: "1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok",
  },
  {
    storeName: "Tus",
    spreadsheetId: "17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A",
  },
];

const SHEET_RANGE = "'Podatki'!A2:F1000"; // Samo prvih 1000 za analizo

function readEnvFile(path) {
  const text = fs.readFileSync(path, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function httpsRequest({ method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        method,
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode || 0,
            data,
          })
        );
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getServiceAccountAccessToken(credentials, scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: credentials.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 60 * 60,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claimSet)
  )}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(credentials.private_key);
  const jwt = `${signingInput}.${base64url(signature)}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  }).toString();

  const res = await httpsRequest({
    method: "POST",
    url: "https://oauth2.googleapis.com/token",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
    },
    body,
  });

  if (res.status !== 200) {
    throw new Error(`Google token exchange failed: ${res.status} ${res.data}`);
  }
  const parsed = JSON.parse(res.data);
  return parsed.access_token;
}

function extractImageUrlFromCell(cellValue) {
  if (!cellValue) return undefined;
  const formula = String(cellValue).trim();
  if (!formula) return undefined;
  if (formula.startsWith("http")) return formula;
  const match = formula.match(/=IMAGE\s*\(\s*"([^"]+)"(?:\s*[;,]\s*[^)]*)?\)/i);
  if (match) return match[1];
  return undefined;
}

async function fetchSheetRows({ spreadsheetId, accessToken }) {
  const range = encodeURIComponent(SHEET_RANGE);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMULA`;
  const res = await httpsRequest({
    method: "GET",
    url,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status !== 200) {
    throw new Error(
      `Sheets read failed (${spreadsheetId}): ${res.status} ${res.data}`
    );
  }
  const json = JSON.parse(res.data);
  return Array.isArray(json.values) ? json.values : [];
}

// Normaliziraj ime za primerjavo
function normalizeForMatch(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const envFromFile = fs.existsSync(".env.local") ? readEnvFile(".env.local") : {};
  const googleCredentialsRaw =
    process.env.GOOGLE_CREDENTIALS || envFromFile.GOOGLE_CREDENTIALS;
  if (!googleCredentialsRaw) {
    throw new Error("Missing GOOGLE_CREDENTIALS");
  }
  const credentials = JSON.parse(googleCredentialsRaw);
  const accessToken = await getServiceAccountAccessToken(
    credentials,
    "https://www.googleapis.com/auth/spreadsheets.readonly"
  );

  console.log("Analiziram izdelke iz vseh 3 trgovin...\n");

  // Zberi vse izdelke
  const allProducts = [];

  for (const sheet of STORE_SHEETS) {
    console.log(`Berem ${sheet.storeName}...`);
    const rows = await fetchSheetRows({
      spreadsheetId: sheet.spreadsheetId,
      accessToken,
    });

    for (const row of rows) {
      const name = String(row?.[0] || "").trim();
      const imageUrl = extractImageUrlFromCell(row?.[2]);

      if (name) {
        allProducts.push({
          name,
          normalized: normalizeForMatch(name),
          imageUrl,
          store: sheet.storeName,
        });
      }
    }
    console.log(`  ${sheet.storeName}: ${rows.length} vrstic`);
  }

  console.log(`\nSkupaj: ${allProducts.length} izdelkov\n`);

  // Analiziraj slike
  const imageGroups = new Map();
  for (const product of allProducts) {
    if (product.imageUrl) {
      const existing = imageGroups.get(product.imageUrl) || [];
      existing.push(product);
      imageGroups.set(product.imageUrl, existing);
    }
  }

  // Poišči slike ki so v več trgovinah
  let sharedImages = 0;
  const examples = [];

  for (const [url, products] of imageGroups) {
    const stores = new Set(products.map(p => p.store));
    if (stores.size >= 2) {
      sharedImages++;
      if (examples.length < 5) {
        examples.push({ url, products });
      }
    }
  }

  console.log(`Slike ki se pojavijo v več trgovinah: ${sharedImages}`);
  console.log(`\nPrimeri skupnih slik:`);

  for (const example of examples) {
    console.log(`\nSlika: ${example.url.substring(0, 80)}...`);
    for (const p of example.products) {
      console.log(`  [${p.store}] ${p.name}`);
    }
  }

  // Poišči izdelke z istim normaliziranim imenom
  console.log(`\n${"=".repeat(60)}`);
  console.log("Izdelki z istim normaliziranim imenom:\n");

  const nameGroups = new Map();
  for (const product of allProducts) {
    const existing = nameGroups.get(product.normalized) || [];
    existing.push(product);
    nameGroups.set(product.normalized, existing);
  }

  let sharedNames = 0;
  const nameExamples = [];

  for (const [name, products] of nameGroups) {
    const stores = new Set(products.map(p => p.store));
    if (stores.size >= 2) {
      sharedNames++;
      if (nameExamples.length < 10) {
        nameExamples.push({ name, products });
      }
    }
  }

  console.log(`Imena ki se pojavijo v več trgovinah: ${sharedNames}`);
  console.log(`\nPrimeri:`);

  for (const example of nameExamples) {
    console.log(`\nNormalizirano: "${example.name}"`);
    for (const p of example.products) {
      console.log(`  [${p.store}] ${p.name}`);
    }
  }

  // Poišči "milka" izdelke za primer
  console.log(`\n${"=".repeat(60)}`);
  console.log("MILKA izdelki:\n");

  const milkaProducts = allProducts.filter(p =>
    p.normalized.includes("milka")
  ).slice(0, 30);

  for (const p of milkaProducts) {
    console.log(`[${p.store}] ${p.name}`);
    if (p.imageUrl) console.log(`       Slika: ${p.imageUrl.substring(0, 60)}...`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
