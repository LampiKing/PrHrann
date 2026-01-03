import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { google } from "googleapis";

const ALLOWED_STORE_NAMES = new Set(["Spar", "Mercator", "Tus"]);

// Iskanje izdelkov
export const search = query({
  args: { 
    query: v.string(),
    isPremium: v.boolean(),
  },
  returns: v.array(
    v.object({
      _id: v.id("products"),
      _creationTime: v.number(),
      name: v.string(),
      category: v.string(),
      unit: v.string(),
      imageUrl: v.optional(v.string()),
      prices: v.array(
        v.object({
          storeId: v.id("stores"),
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
    // Validate query
    if (!args.query || !args.query.trim() || args.query.trim().length < 2) {
      return [];
    }

    const searchLower = args.query.toLowerCase().trim();
    
    // Use search index for better performance
    const matchedProducts = await ctx.db
      .query("products")
      .withSearchIndex("search_name", (q) => q.search("name", searchLower))
      .take(1000); // Limit to prevent overload, can increase if needed

    const stores = await ctx.db.query("stores").collect();
    const storeMap = new Map(
      stores
        .filter((store) => ALLOWED_STORE_NAMES.has(store.name))
        .map((store) => [store._id, store])
    );

    const results = await Promise.all(
      matchedProducts.map(async (product) => {
        const prices = await ctx.db
          .query("prices")
          .withIndex("by_product", (q) => q.eq("productId", product._id))
          .collect();

        const pricesWithStores = prices
          .map((price) => {
            const store = storeMap.get(price.storeId);
            if (!store) return null;
            // Če ni premium, skrij premium trgovine
            if (!args.isPremium && store.isPremium) return null;
            // Filtriraj neveljavne cene
            if (!Number.isFinite(price.price) || price.price <= 0) return null;
            return {
              storeId: price.storeId,
              storeName: store.name,
              storeColor: store.color,
              price: price.price,
              originalPrice: price.originalPrice,
              isOnSale: price.isOnSale,
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .sort((a, b) => a.price - b.price);

        // Če po filtriranju ni cen, preskoči izdelek
        if (pricesWithStores.length === 0) return null;

        const validPriceNumbers = pricesWithStores.map((p) => p.price);

        return {
          ...product,
          prices: pricesWithStores,
          lowestPrice: Math.min(...validPriceNumbers),
          highestPrice: Math.max(...validPriceNumbers),
        };
      })
    );

    // Odstrani izdelke brez veljavnih cen
    return results.filter((r): r is NonNullable<typeof r> => r !== null && r.prices.length > 0);
  },
});

// Pridobi izdelek po ID
export const getById = query({
  args: { productId: v.id("products") },
  returns: v.union(
    v.object({
      _id: v.id("products"),
      _creationTime: v.number(),
      name: v.string(),
      category: v.string(),
      unit: v.string(),
      imageUrl: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.productId);
  },
});

// Dodaj vzorčne izdelke
export const seedProducts = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const existingProducts = await ctx.db.query("products").collect();
    if (existingProducts.length > 0) return null;

    const stores = await ctx.db.query("stores").collect();
    if (stores.length === 0) return null;

    const products = [
      { name: "Mleko", category: "Mlečni izdelki", unit: "1L" },
      { name: "Kruh", category: "Kruh in pečivo", unit: "500g" },
      { name: "Jajca", category: "Mlečni izdelki", unit: "10 kom" },
      { name: "Maslo", category: "Mlečni izdelki", unit: "250g" },
      { name: "Sir Edamec", category: "Mlečni izdelki", unit: "200g" },
      { name: "Jogurt", category: "Mlečni izdelki", unit: "180g" },
      { name: "Piščančje prsi", category: "Meso", unit: "500g" },
      { name: "Mleto meso", category: "Meso", unit: "500g" },
      { name: "Banane", category: "Sadje in zelenjava", unit: "1kg" },
      { name: "Jabolka", category: "Sadje in zelenjava", unit: "1kg" },
      { name: "Paradižnik", category: "Sadje in zelenjava", unit: "500g" },
      { name: "Krompir", category: "Sadje in zelenjava", unit: "2kg" },
      { name: "Testenine", category: "Suhi izdelki", unit: "500g" },
      { name: "Riž", category: "Suhi izdelki", unit: "1kg" },
      { name: "Olje", category: "Suhi izdelki", unit: "1L" },
      { name: "Moka", category: "Suhi izdelki", unit: "1kg" },
      { name: "Sladkor", category: "Suhi izdelki", unit: "1kg" },
      { name: "Kava", category: "Pijače", unit: "250g" },
      { name: "Čaj", category: "Pijače", unit: "20 vrečk" },
      { name: "Sok pomaranča", category: "Pijače", unit: "1L" },
    ];

    // Generiraj naključne cene za vsak izdelek v vsaki trgovini
    const basePrices: Record<string, number> = {
      "Mleko": 1.29,
      "Kruh": 1.49,
      "Jajca": 2.99,
      "Maslo": 2.49,
      "Sir Edamec": 2.79,
      "Jogurt": 0.89,
      "Piščančje prsi": 6.99,
      "Mleto meso": 5.49,
      "Banane": 1.49,
      "Jabolka": 1.99,
      "Paradižnik": 2.29,
      "Krompir": 1.79,
      "Testenine": 1.19,
      "Riž": 1.89,
      "Olje": 2.99,
      "Moka": 1.29,
      "Sladkor": 1.49,
      "Kava": 4.99,
      "Čaj": 1.99,
      "Sok pomaranča": 1.79,
    };

    for (const product of products) {
      const productId = await ctx.db.insert("products", product);

      // Dodaj cene za vsako trgovino
      for (const store of stores) {
        const basePrice = basePrices[product.name] || 2.0;
        // Naključna variacija cene ±20%
        const variation = 0.8 + Math.random() * 0.4;
        const price = Math.round(basePrice * variation * 100) / 100;
        
        // 20% možnost, da je na akciji
        const isOnSale = Math.random() < 0.2;
        const originalPrice = isOnSale 
          ? Math.round(price * 1.25 * 100) / 100 
          : undefined;

        await ctx.db.insert("prices", {
          productId,
          storeId: store._id,
          price,
          originalPrice,
          isOnSale,
          lastUpdated: Date.now(),
        });
      }
    }
    return null;
  },
});

// Count products
export const countProducts = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    return products.length;
  },
});

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
        range: "Sheet1!A:Z", // ✅ Read all columns (not just A:E)
      });

      const rows = response.data.values || [];
      if (rows.length === 0) return [];

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

      return sorted;
    } catch (error) {
      console.error("Error in searchFromSheets:", error);
      return []; // Return empty on error
    }
  },
});
