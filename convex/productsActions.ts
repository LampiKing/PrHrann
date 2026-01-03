"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { google } from "googleapis";

const ALLOWED_STORE_NAMES = new Set(["Spar", "Mercator", "Tus"]);

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
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS!);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });

      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetId = "1Wj5nqFcd6isnTA_FTgyA7aTRU6tHfTJG3fGGEN15B6Y"; // From scraper

      // Read ALL data from sheet (all 45000+ products, all columns)
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "List1!A:Z", // ✅ Changed from Sheet1 to List1 (actual sheet name)
      });

      const rows = response.data.values || [];
      if (rows.length === 0) {
        console.log("[searchFromSheets] ERROR: No rows found in Google Sheets");
        return [];
      }

      console.log(`[searchFromSheets] Total rows in sheet: ${rows.length}`);
      console.log(`[searchFromSheets] Header row: ${JSON.stringify(rows[0])}`);
      console.log(`[searchFromSheets] Sample row 1: ${JSON.stringify(rows[1])}`);
      console.log(`[searchFromSheets] Sample row 2: ${JSON.stringify(rows[2])}`);

      // Parse rows (assuming headers: name, price, sale_price, store, date)
      const products: any[] = [];
      for (let i = 1; i < rows.length; i++) { // Skip header
        const row = rows[i];
        if (row.length < 4) continue;
        const name = row[0]?.trim();
        const price = parseFloat(row[1]?.toString().replace(",", ".") || "0");
        const salePrice = row[2] ? parseFloat(row[2].toString().replace(",", ".")) : undefined;
        const store = row[3]?.trim();

        if (!name || !store || !price || price <= 0) continue;
        if (!ALLOWED_STORE_NAMES.has(store)) continue;

        // Find or create product entry
        let product = products.find(p => p.name === name);
        if (!product) {
          product = {
            name,
            category: "Neznana kategorija",
            unit: "1 kos",
            prices: [],
            lowestPrice: Infinity,
            highestPrice: 0,
          };
          products.push(product);
        }

        const isOnSale = salePrice !== undefined && salePrice < price;
        const finalPrice = salePrice ?? price;
        const storeColor = store === "Spar" ? "#c8102e" : store === "Mercator" ? "#d3003c" : "#0d8a3c";

        product.prices.push({
          storeName: store,
          storeColor,
          price: finalPrice,
          originalPrice: isOnSale ? price : undefined,
          isOnSale,
        });

        product.lowestPrice = Math.min(product.lowestPrice, finalPrice);
        product.highestPrice = Math.max(product.highestPrice, finalPrice);
      }

      // NORMALIZE TEXT - handle Slovenian characters (č, š, ž, etc.)
      const normalizeText = (text: string): string => {
        return text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
          .replace(/[čć]/g, 'c')
          .replace(/[š]/g, 's')
          .replace(/[ž]/g, 'z')
          .replace(/[đ]/g, 'd')
          .replace(/[ö]/g, 'o')
          .replace(/[ä]/g, 'a')
          .replace(/[ü]/g, 'u')
          .trim();
      };

      // DEEP SEARCH - Match anywhere in name, very flexible
      const searchNormalized = normalizeText(args.query);
      const searchWords = searchNormalized.split(/\s+/); // Split by whitespace

      const filtered = products.filter(p => {
        const nameNormalized = normalizeText(p.name);
        // Match if ALL search words are found in the product name (in any order)
        return searchWords.every(word => nameNormalized.includes(word));
      });

      // Sort by relevance first (exact match), then by lowest price
      const sorted = filtered.sort((a, b) => {
        const aNameNorm = normalizeText(a.name);
        const bNameNorm = normalizeText(b.name);

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
      }).slice(0, 500); // ✅ SLICE AFTER SORT! Increased to 500 for better coverage

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
        range: "List1!A:Z", // ✅ Changed from Sheet1 to List1
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

        if (name && store && price > 0 && ALLOWED_STORE_NAMES.has(store)) {
          validProducts.add(name);
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
