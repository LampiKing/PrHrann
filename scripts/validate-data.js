/* eslint-disable no-console */
const https = require("https");
const fs = require("fs");
const crypto = require("crypto");

// Convex configuration
const CONVEX_URL = "https://vibrant-dolphin-871.convex.cloud";

function readEnvFile(path) {
  if (!fs.existsSync(path)) return {};
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

async function convexQuery(functionPath, args = {}) {
  const body = JSON.stringify({
    path: functionPath,
    args,
    format: "json",
  });

  const res = await httpsRequest({
    method: "POST",
    url: `${CONVEX_URL}/api/query`,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
    body,
  });

  if (res.status !== 200) {
    throw new Error(`Query failed: ${res.status} ${res.data}`);
  }

  const parsed = JSON.parse(res.data);
  if (parsed.status === "error") {
    throw new Error(`Query error: ${parsed.errorMessage}`);
  }
  return parsed.value;
}

async function main() {
  console.log("🔍 Validacija podatkov v Convex bazi...\n");

  try {
    // 1. Get store counts
    console.log("📊 Pridobivam statistiko trgovin...");
    const storeCounts = await convexQuery("admin:getStoreCounts");

    console.log("\n=== TRGOVINE IN CENE ===");
    let totalPrices = 0;
    for (const store of storeCounts) {
      console.log(`  ${store.storeName}: ${store.priceCount} cen`);
      totalPrices += store.priceCount;
    }
    console.log(`  SKUPAJ: ${totalPrices} cen\n`);

    // 2. Test search functionality
    console.log("🔎 Testiram iskanje...");
    const testQueries = ["mleko", "kruh", "čokolada", "coca cola"];

    for (const query of testQueries) {
      try {
        const results = await convexQuery("products:search", {
          query,
          isPremium: false
        });
        const withImages = results.filter(r => r.imageUrl).length;
        const onSale = results.filter(r => r.prices.some(p => p.isOnSale)).length;
        console.log(`  "${query}": ${results.length} rezultatov (${withImages} s slikami, ${onSale} na akciji)`);
      } catch (err) {
        console.log(`  "${query}": NAPAKA - ${err.message}`);
      }
    }

    console.log("\n✅ Validacija končana!");

    // Summary
    console.log("\n=== POVZETEK ===");
    if (totalPrices > 1000) {
      console.log("✅ Dovolj podatkov v bazi (>1000 cen)");
    } else if (totalPrices > 100) {
      console.log("⚠️  Srednje količina podatkov (100-1000 cen)");
    } else {
      console.log("❌ Premalo podatkov v bazi (<100 cen)");
    }

  } catch (error) {
    console.error("❌ Napaka:", error.message);
    process.exitCode = 1;
  }
}

main();
