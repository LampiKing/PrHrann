/* eslint-disable no-console */
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");

const CONVEX_INGEST_URL =
  process.env.PRHRAN_INGEST_URL ||
  "https://vibrant-dolphin-871.convex.site/api/ingest/grocery";
const CONVEX_INGEST_TOKEN =
  process.env.PRHRAN_INGEST_TOKEN || "prhran-scraper-2024";

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

const SHEET_RANGE = "'Podatki'!A2:F50000";
const UPLOAD_BATCH_SIZE = 300;

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

function parsePriceValue(input) {
  if (input === null || input === undefined) return undefined;
  if (typeof input === "number") {
    return Number.isFinite(input) && input > 0 ? input : undefined;
  }
  const text = String(input).replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  const match = text.match(/(\d+(?:[,.]\d+)?)/);
  if (!match) return undefined;
  const normalized = match[1].replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
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
  const googleCredentialsRaw =
    process.env.GOOGLE_CREDENTIALS || envFromFile.GOOGLE_CREDENTIALS;
  if (!googleCredentialsRaw) {
    throw new Error(
      "Missing GOOGLE_CREDENTIALS (set env var or put it in .env.local)"
    );
  }
  const credentials = JSON.parse(googleCredentialsRaw);
  const accessToken = await getServiceAccountAccessToken(
    credentials,
    "https://www.googleapis.com/auth/spreadsheets.readonly"
  );

  console.log("Reading sheets...");

  let batch = [];
  let firstUpload = true;
  let totals = {
    createdProducts: 0,
    updatedProducts: 0,
    createdPrices: 0,
    updatedPrices: 0,
    skipped: 0,
    unknownStores: 0,
  };

  const flush = async () => {
    if (batch.length === 0) return;
    const result = await uploadBatch({ items: batch, clearFirst: firstUpload });
    firstUpload = false;
    batch = [];
    totals = {
      createdProducts: totals.createdProducts + (result.createdProducts || 0),
      updatedProducts: totals.updatedProducts + (result.updatedProducts || 0),
      createdPrices: totals.createdPrices + (result.createdPrices || 0),
      updatedPrices: totals.updatedPrices + (result.updatedPrices || 0),
      skipped: totals.skipped + (result.skipped || 0),
      unknownStores: totals.unknownStores + (result.unknownStores || 0),
    };
    console.log(
      `Uploaded batch. +${result.createdProducts || 0} products, +${
        result.createdPrices || 0
      } prices.`
    );
  };

  for (const sheet of STORE_SHEETS) {
    console.log(`Fetching ${sheet.storeName}...`);
    const rows = await fetchSheetRows({
      spreadsheetId: sheet.spreadsheetId,
      accessToken,
    });

    console.log(`${sheet.storeName}: ${rows.length} rows`);

    for (const row of rows) {
      const name = String(row?.[0] || "").trim();
      const regularPrice = parsePriceValue(row?.[1]);
      const imageUrl = extractImageUrlFromCell(row?.[2]);
      const salePrice = parsePriceValue(row?.[3]);

      if (!name || !regularPrice) continue;

      const shouldIncludeSale =
        salePrice !== undefined &&
        Number.isFinite(salePrice) &&
        salePrice > 0 &&
        salePrice < regularPrice;

      batch.push({
        ime: name,
        redna_cena: regularPrice,
        akcijska_cena: shouldIncludeSale ? salePrice : undefined,
        trgovina: sheet.storeName,
        slika: imageUrl || undefined,
      });

      if (batch.length >= UPLOAD_BATCH_SIZE) {
        await flush();
      }
    }
  }

  await flush();

  console.log("Done.");
  console.log(JSON.stringify(totals, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

