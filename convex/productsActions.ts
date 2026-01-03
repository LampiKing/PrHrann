"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { google } from "googleapis";

const ALLOWED_STORE_KEYS = new Set(["spar", "mercator", "tus"]);
const STORE_LABELS: Record<string, string> = {
  spar: "SPAR",
  mercator: "MERCATOR",
  tus: "TU\u0160",
};
const STORE_COLORS: Record<string, string> = {
  spar: "#c8102e",
  mercator: "#d3003c",
  tus: "#0d8a3c",
};
const MAX_RESULTS = 20; // Optimal balance between results and speed

// CACHE: Reduce Google Sheets API calls - cache for 1 hour
let cachedSheetData: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const normalizeStoreKey = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const normalizeSearchText = (text: string) =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/,/g, ".")
    .replace(/[^a-z0-9.%]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(\d)\s+([a-z%])/g, "$1$2")
    .trim();

const normalizeProductToken = (token: string) => {
  let cleaned = token;
  if (/^[a-z.]+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "");
  }
  if (!cleaned || cleaned === "m" || cleaned === "mm") return "";
  if (/^\d+ml$/.test(cleaned)) {
    const ml = Number(cleaned.slice(0, -2));
    if (!Number.isFinite(ml) || ml <= 0) return token;
    const liters = ml / 1000;
    const litersText = Number.isInteger(liters) ? String(liters) : String(liters);
    return `${litersText}l`;
  }
  if (/^0\d+l$/.test(cleaned)) {
    return `0.${cleaned[1]}l`;
  }
  if (/^\d+(?:\.\d+)?l$/.test(cleaned)) return cleaned;
  return cleaned;
};

const normalizeProductKey = (text: string) => {
  const tokens = normalizeSearchText(text)
    .split(/\s+/)
    .map((token) => normalizeProductToken(token))
    .filter(Boolean);

  const tokenSet = new Set(tokens);
  if (tokenSet.has("polnomastno")) tokenSet.add("3.5%");
  if (tokenSet.has("polposneto") || tokenSet.has("slim")) tokenSet.add("1.5%");
  if (tokenSet.has("posneto")) tokenSet.add("0.5%");

  return Array.from(tokenSet).sort().join(" ");
};

const scoreDisplayName = (value: string) => {
  let score = 0;
  if (/\s/.test(value)) score += 2;
  if (/-/.test(value)) score -= 2;
  if (value.length > 12) score += 1;
  return score;
};

type StorePrice = {
  storeName: string;
  storeColor: string;
  price: number;
  originalPrice?: number;
  isOnSale: boolean;
};

type ProductAccumulator = {
  name: string;
  nameNormalized: string;
  category: string;
  unit: string;
  displayScore: number;
  pricesByStore: Map<string, StorePrice>;
};

// Search from Google Sheets (alternative to Convex DB)
export const searchFromSheets = action({
  args: {
    query: v.string(),
    isPremium: v.boolean(),
  },
  returns: v.array(
    v.object({
      name: v.string(),
      category: v.string(),
      unit: v.string(),
      prices: v.array(
        v.object({
          storeName: v.string(),
          storeColor: v.string(),
          price: v.number(),
          originalPrice: v.optional(v.number()),
          isOnSale: v.boolean(),
        })
      ),
      lowestPrice: v.number(),
      highestPrice: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    if (!args.query || args.query.trim().length < 2) {
      return [];
    }

    try {
      const now = Date.now();
      let rows: any[];

      // Use cache if available and fresh
      if (cachedSheetData && (now - cacheTimestamp) < CACHE_TTL_MS) {
        console.log(`[searchFromSheets] Using cached data (age: ${Math.floor((now - cacheTimestamp) / 1000)}s)`);
        rows = cachedSheetData;
      } else {
        // Fetch fresh data
        console.log("[searchFromSheets] Fetching fresh data from Google Sheets...");
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS!);
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });

        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = "1Wj5nqFcd6isnTA_FTgyA7aTRU6tHfTJG3fGGEN15B6Y";

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "List1!A:D",
        });

        rows = response.data.values || [];
        if (rows.length === 0) {
          console.log("[searchFromSheets] ERROR: No rows found in Google Sheets");
          return [];
        }

        // Update cache
        cachedSheetData = rows;
        cacheTimestamp = now;
        console.log(`[searchFromSheets] Cached ${rows.length} rows`);
      }

      console.log(`[searchFromSheets] Total rows: ${rows.length}`);

      // Parse rows (name, price, sale_price, store)
      const productsByKey = new Map<string, ProductAccumulator>();
      for (let i = 1; i < rows.length; i++) { // Skip header
        const row = rows[i];
        if (row.length < 4) continue;
        const rawName = row[0]?.toString().trim();
        const rawPrice = row[1]?.toString().replace(",", ".");
        const rawSalePrice = row[2]?.toString().replace(",", ".");
        const rawStore = row[3]?.toString().trim();

        const storeKey = rawStore ? normalizeStoreKey(rawStore) : "";
        const price = parseFloat(rawPrice || "0");
        const salePrice = rawSalePrice ? parseFloat(rawSalePrice) : undefined;

        if (!rawName || !storeKey || !Number.isFinite(price) || price <= 0) continue;
        if (!ALLOWED_STORE_KEYS.has(storeKey)) continue;

        const hasSale =
          salePrice !== undefined && Number.isFinite(salePrice) && salePrice > 0 && salePrice < price;
        const finalPrice = hasSale ? salePrice : price;

        const normalizedName = normalizeSearchText(rawName);
        const groupKey = normalizeProductKey(rawName);
        if (!normalizedName || !groupKey) continue;

        let product = productsByKey.get(groupKey);
        if (!product) {
          const displayScore = scoreDisplayName(rawName);
          product = {
            name: rawName,
            nameNormalized: normalizedName,
            category: "Neznana kategorija",
            unit: "1 kos",
            displayScore,
            pricesByStore: new Map<string, StorePrice>(),
          };
          productsByKey.set(groupKey, product);
        } else {
          const displayScore = scoreDisplayName(rawName);
          if (displayScore > product.displayScore) {
            product.name = rawName;
            product.nameNormalized = normalizedName;
            product.displayScore = displayScore;
          }
        }

        const existing = product.pricesByStore.get(storeKey);
        if (existing && existing.price <= finalPrice) continue;

        product.pricesByStore.set(storeKey, {
          storeName: STORE_LABELS[storeKey] || rawStore,
          storeColor: STORE_COLORS[storeKey] || "#64748b",
          price: finalPrice,
          originalPrice: hasSale ? price : undefined,
          isOnSale: hasSale,
        });
      }

      // SMART SEARCH - Match all words, but prioritize meaningful matches
      const searchNormalized = normalizeSearchText(args.query);
      const searchWords = searchNormalized.split(/\s+/).filter(Boolean);

      // Filter: ALL search words must appear in product name
      const filtered = Array.from(productsByKey.values()).filter((product) => {
        const productWords = product.nameNormalized.split(/\s+/);

        // ALL search words must match
        return searchWords.every((searchWord) => {
          // Each search word must either:
          // 1. Be an exact match to a product word, OR
          // 2. Be contained in a product word (for partial matches like "mleko" in "mleko123")
          return productWords.some((productWord) =>
            productWord === searchWord || productWord.includes(searchWord)
          );
        });
      });

      const hydrated = filtered
        .map((product) => {
          const prices = Array.from(product.pricesByStore.values()).sort(
            (a, b) => a.price - b.price
          );
          if (prices.length === 0) return null;
          return {
            name: product.name,
            nameNormalized: product.nameNormalized,
            category: product.category,
            unit: product.unit,
            prices,
            lowestPrice: prices[0].price,
            highestPrice: prices[prices.length - 1].price,
          };
        })
        .filter((product) => product !== null);

      // Sort by relevance first (exact match), then by lowest price
      const sorted = hydrated
        .sort((a, b) => {
          const aNameNorm = a.nameNormalized;
          const bNameNorm = b.nameNormalized;

          // Exact match gets priority
          const aExact = aNameNorm === searchNormalized ? 0 : 1;
          const bExact = bNameNorm === searchNormalized ? 0 : 1;
          if (aExact !== bExact) return aExact - bExact;

          // Then starts-with match
          const aStarts = aNameNorm.startsWith(searchNormalized) ? 0 : 1;
          const bStarts = bNameNorm.startsWith(searchNormalized) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;

          // Finally by price
          return a.lowestPrice - b.lowestPrice;
        })
        .slice(0, MAX_RESULTS)
        .map(({ nameNormalized, ...rest }) => rest);

      console.log(`[searchFromSheets] Query: "${args.query}" | Found: ${sorted.length} products`);
      return sorted;
    } catch (error) {
      console.error("Error in searchFromSheets:", error);
      return []; // Return empty on error
    }
  },
});

// Count total products in Google Sheets
export const countProductsInSheets = action({
  args: {},
  returns: v.object({
    totalRows: v.number(),
    validProducts: v.number(),
    sampleProducts: v.array(v.string()),
  }),
  handler: async () => {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS!);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });

      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetId = "1Wj5nqFcd6isnTA_FTgyA7aTRU6tHfTJG3fGGEN15B6Y";

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "List1!A:D", // Changed from Sheet1 to List1
      });

      const rows = response.data.values || [];
      const totalRows = rows.length - 1; // Exclude header

      const validProducts = new Set<string>();
      const sampleProducts: string[] = [];

      for (let i = 1; i < rows.length && i < 100; i++) {
        const row = rows[i];
        if (row.length < 4) continue;
        const name = row[0]?.trim();
        const price = parseFloat(row[1]?.toString().replace(",", ".") || "0");
        const store = row[3]?.trim();

        const storeKey = store ? normalizeStoreKey(store) : "";
        const groupKey = name ? normalizeProductKey(name) : "";
        if (name && storeKey && price > 0 && ALLOWED_STORE_KEYS.has(storeKey) && groupKey) {
          validProducts.add(groupKey);
          if (sampleProducts.length < 20) {
            sampleProducts.push(name);
          }
        }
      }

      return {
        totalRows,
        validProducts: validProducts.size,
        sampleProducts,
      };
    } catch (error) {
      console.error("Error in countProductsInSheets:", error);
      return {
        totalRows: 0,
        validProducts: 0,
        sampleProducts: [],
      };
    }
  },
});
