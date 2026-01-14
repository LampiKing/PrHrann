/* eslint-disable no-console */
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");

const SHEET_ID = "1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0";

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

async function main() {
  const envFromFile = fs.existsSync(".env.local") ? readEnvFile(".env.local") : {};
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || envFromFile.GOOGLE_CREDENTIALS);
  const accessToken = await getAccessToken(credentials);

  const range = encodeURIComponent("'Podatki'!A2:F10");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueRenderOption=FORMULA`;
  const res = await httpsRequest({ method: "GET", url, headers: { Authorization: `Bearer ${accessToken}` } });
  const data = JSON.parse(res.data);

  console.log("Prvih 5 vrstic iz Mercator sheeta:\n");
  for (const row of (data.values || []).slice(0, 5)) {
    console.log("Ime:", row[0]);
    console.log("Cena:", row[1]);
    console.log("Slika (raw):", row[2]);
    console.log("---");
  }
}

main().catch(console.error);
