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
const MAX_MATCHES_TO_PROCESS = 100; // Early termination for performance

// COSMETICS/BODY CARE BLACKLIST - Exclude these from food searches
const COSMETICS_KEYWORDS = new Set([
  "za", "telo", "koza", "kozo", "nega", "nege", "krem", "krema",
  "losjon", "balzam", "sampon", "gel", "pena", "milo", "mydlo",
  "kozmetika", "toaletna", "toaletni", "kopel", "tus", "prha",
  "obraz", "ustnice", "lase", "lasje", "nohte", "nohti", "zobe",
  "deo", "deodorant", "parfum", "mirisna", "sprej"
]);

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
  if (/\d/.test(value)) score += 1;
  if (value.length > 12) score += 1;
  if (value.length > 18) score += 1;
  if (value.length < 6) score -= 1;
  return score;
};

// Check if product is cosmetics/body care (not food)
const isCosmeticsProduct = (nameNormalized: string): boolean => {
  const words = nameNormalized.split(/\s+/);
  // Check if product name contains cosmetics keywords
  return words.some((word) => COSMETICS_KEYWORDS.has(word));
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
        rows = cachedSheetData;
      } else {
        // Fetch fresh data
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
          return [];
        }

        // Update cache
        cachedSheetData = rows;
        cacheTimestamp = now;
      }

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

      // OPTIMIZED FILTERING with EARLY TERMINATION and COSMETICS EXCLUSION
      const filtered: ProductAccumulator[] = [];
      const isSingleWordSearch = searchWords.length === 1;

      for (const product of productsByKey.values()) {
        // Early termination for performance - stop after finding enough matches
        if (filtered.length >= MAX_MATCHES_TO_PROCESS) break;

        const productWords = product.nameNormalized.split(/\s+/);

        // EXCLUDE COSMETICS/BODY CARE for food searches
        const isCosmetics = isCosmeticsProduct(product.nameNormalized);
        if (isCosmetics) continue;

        // For single-word searches (like "mleko"), require EXACT or STARTS-WITH match
        // This prevents "mleko" from matching "mleko za telo"
        if (isSingleWordSearch) {
          const searchWord = searchWords[0];
          const matches = productWords.some(
            (productWord) =>
              productWord === searchWord || productWord.startsWith(searchWord)
          );
          if (matches) {
            filtered.push(product);
          }
        } else {
          // For multi-word searches, ALL search words must match
          const allMatch = searchWords.every((searchWord) => {
            return productWords.some(
              (productWord) =>
                productWord === searchWord || productWord.includes(searchWord)
            );
          });
          if (allMatch) {
            filtered.push(product);
          }
        }
      }

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

      // Helper: Extract volume/size score (higher = more relevant for normal products)
      const getSizeScore = (nameNorm: string): number => {
        // Extract volume in liters OR milliliters
        const literMatch = nameNorm.match(/(\d+(?:\.\d+)?)l(?![a-z])/);
        if (literMatch) {
          const liters = parseFloat(literMatch[1]);
          // Prioritize 1L > 0.5L > 2L > 0.2L (normal sizes first)
          if (liters >= 0.9 && liters <= 1.1) return 100; // 1L is ideal
          if (liters >= 0.4 && liters <= 0.6) return 90;  // 0.5L common
          if (liters >= 1.8 && liters <= 2.2) return 85;  // 2L family size
          if (liters >= 0.15 && liters <= 0.3) return 50; // Small bottles like 0.2L/200ml
          if (liters < 0.15) return 30; // Tiny bottles
          return 70; // Other sizes
        }
        
        // Extract milliliters (in case it wasn't converted to liters)
        const mlMatch = nameNorm.match(/(\d+)ml(?![a-z])/);
        if (mlMatch) {
          const ml = parseInt(mlMatch[1]);
          if (ml >= 900 && ml <= 1100) return 100; // ~1L
          if (ml >= 400 && ml <= 600) return 90;   // ~0.5L
          if (ml >= 150 && ml <= 300) return 50;   // Small bottles
          if (ml < 150) return 30; // Tiny bottles
          return 70;
        }
        
        // Extract weight in kg/g
        const kgMatch = nameNorm.match(/(\d+(?:\.\d+)?)kg/);
        if (kgMatch) {
          const kg = parseFloat(kgMatch[1]);
          if (kg >= 0.9 && kg <= 1.1) return 100;
          if (kg >= 0.4 && kg <= 0.6) return 90;
          return 80;
        }
        
        const gMatch = nameNorm.match(/(\d+)g(?![a-z])/);
        if (gMatch) {
          const g = parseInt(gMatch[1]);
          if (g >= 400 && g <= 600) return 95;
          if (g >= 200 && g <= 300) return 85;
          if (g >= 100 && g <= 150) return 75;
          return 70;
        }
        
        // No clear size = lower priority
        return 60;
      };

      // AI-like relevance scorer: How relevant is this product for the search query?
      const getRelevanceScore = (productNameNorm: string, searchQuery: string): number => {
        let score = 100; // Start with perfect score

        const searchTokens = searchQuery.split(/\s+/).filter(Boolean);
        const productTokens = productNameNorm.split(/\s+/).filter(Boolean);

        // 1. Check how many search tokens are in product name (word overlap)
        const matchedTokens = searchTokens.filter(st => 
          productTokens.some(pt => pt.includes(st) || st.includes(pt))
        );
        const overlapRatio = matchedTokens.length / searchTokens.length;
        if (overlapRatio < 0.5) score -= 30; // Less than half words match = penalty

        // 2. STRONG FILTER: Penalize "variant" products when searching for base product
        // Example: searching "mleko" should HEAVILY deprioritize "čokoladno mleko", "šampon", etc.
        const variantKeywords = [
          "cokolad", "jagod", "banan", "vanilij", "karamel", // flavors
          "sojin", "ovseni", "kokos", "rizen", "mandljev", // alternatives
          "sampon", "gel", "krem", "losjon", "milo", "zobna", "paste", // non-food
          "cistil", "prasek", "detergen", "mehcalec", // cleaning
          "za telo", "za lase", "za obraz", "za kozo", // body care
        ];
        
        // If search is simple (1-2 words) but product has variant keywords = BIG penalty
        if (searchTokens.length <= 2) {
          const hasVariantKeyword = variantKeywords.some(vk => productNameNorm.includes(vk));
          if (hasVariantKeyword) {
            // Check if variant keyword is in search query - if not, HEAVY penalize
            const isIntentional = variantKeywords.some(vk => searchQuery.includes(vk));
            if (!isIntentional) {
              score -= 80; // MASSIVE penalty - variants go to bottom
            }
          }
        }

        // 3. Bonus for exact/starts-with already handled in main sort, but reinforce here
        if (productNameNorm.startsWith(searchQuery)) score += 20;
        if (productNameNorm === searchQuery) score += 30;

        return Math.max(0, score); // Never go below 0
      };

      // Sort by relevance first (exact match), then by lowest price
      const sorted = hydrated
        .sort((a, b) => {
          const aNameNorm = a.nameNormalized;
          const bNameNorm = b.nameNormalized;

          // Deprioritize cosmetics (safety check - shouldn't appear due to filter)
          const aIsCosmetics = isCosmeticsProduct(aNameNorm);
          const bIsCosmetics = isCosmeticsProduct(bNameNorm);
          if (aIsCosmetics && !bIsCosmetics) return 1;
          if (!aIsCosmetics && bIsCosmetics) return -1;

          // Exact match gets priority
          const aExact = aNameNorm === searchNormalized ? 0 : 1;
          const bExact = bNameNorm === searchNormalized ? 0 : 1;
          if (aExact !== bExact) return aExact - bExact;

          // Then starts-with match
          const aStarts = aNameNorm.startsWith(searchNormalized) ? 0 : 1;
          const bStarts = bNameNorm.startsWith(searchNormalized) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;

          // AI-LIKE RELEVANCE SCORING (replaces hardcoded "mleko" check)
          const aRelevance = getRelevanceScore(aNameNorm, searchNormalized);
          const bRelevance = getRelevanceScore(bNameNorm, searchNormalized);
          if (aRelevance !== bRelevance) return bRelevance - aRelevance; // Higher relevance first

          // PRICE FIRST - cheapest is always best after relevance filtering
          if (a.lowestPrice !== b.lowestPrice) return a.lowestPrice - b.lowestPrice;

          // Size/volume relevance (prioritize normal sizes like 1L over small 200ml)
          const aSizeScore = getSizeScore(aNameNorm);
          const bSizeScore = getSizeScore(bNameNorm);
          if (aSizeScore !== bSizeScore) return bSizeScore - aSizeScore; // Higher score first

          // If everything else is equal, maintain original order
          return 0;
        })
        .slice(0, MAX_RESULTS)
        .map(({ nameNormalized, ...rest }) => rest);

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
