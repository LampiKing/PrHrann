import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const ALLOWED_STORE_NAMES = new Set(["Spar", "Mercator", "Tus"]);

/**
 * FUZZY MATCHING - Inteligentno iskanje
 * Najde izdelke tudi če uporabnik napiše besede v napačnem vrstnem redu
 * Primer: "jagodna milka" najde "MILKA JAGODA"
 */
function fuzzyMatch(productName: string, searchQuery: string): number {
  const nameLower = productName.toLowerCase();
  const queryLower = searchQuery.toLowerCase();

  // Exact match - najvišji score
  if (nameLower === queryLower) return 1000;
  if (nameLower.includes(queryLower)) return 900;

  // Split query into words
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
  if (queryWords.length === 0) return 0;

  // Preveri koliko besed se ujema
  let matchCount = 0;
  let positionBonus = 0;

  for (const word of queryWords) {
    if (nameLower.includes(word)) {
      matchCount++;
      // Bonus če je beseda na začetku
      if (nameLower.startsWith(word)) positionBonus += 100;
    }
  }

  // Če se nobena beseda ne ujema, 0 score
  if (matchCount === 0) return 0;

  // Score = (matched words / total words) * 100 + position bonus
  const matchPercentage = (matchCount / queryWords.length) * 100;
  return matchPercentage + positionBonus;
}

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
      nameKey: v.optional(v.string()),
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
          saleValidFrom: v.optional(v.string()),
          saleValidUntil: v.optional(v.string()),
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

    const searchQuery = args.query.trim();

    // HYBRID SEARCH: Combine search index + fuzzy matching
    // 1. Use search index to get candidates (fast)
    const searchCandidates = await ctx.db
      .query("products")
      .withSearchIndex("search_name", (q) => q.search("name", searchQuery.toLowerCase()))
      .take(1000);

    // 2. If not enough results, fallback to scanning all products (for fuzzy)
    let allProducts = searchCandidates;
    if (searchCandidates.length < 20) {
      allProducts = await ctx.db.query("products").take(5000);
    }

    // 3. Score each product with fuzzy matching + brand/category boosts
    const qNorm = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const BRAND_KEYWORDS = [
      "milka", "alpsko", "barilla", "nutella", "kinder", "oreo",
      "argeta", "zdenka", "fructal", "radenska", "coca", "pepsi", "fanta",
      "spar", "mercator", "tus", "tuš"
    ];
    const CATEGORY_HINTS: Array<{ key: string; words: string[] }> = [
      { key: "sladkarije", words: ["čoko", "coko", "čokolad", "cokolad", "kinder", "milka", "oreo", "bonbon", "sladk"] },
      { key: "mlečni", words: ["mleko", "jogurt", "sir", "maslo", "skuta", "smetana", "alpsko"] },
      { key: "pijače", words: ["cola", "pepsi", "fanta", "voda", "sok", "juice"] },
      { key: "prigrizki", words: ["čips", "chips", "snack", "smoki", "flips"] },
    ];
    const hasBrand = BRAND_KEYWORDS.some((b) => qNorm.includes(b));
    const brandMatched = (name: string) => BRAND_KEYWORDS.some((b) => name.toLowerCase().includes(b));
    const categoryBoostFor = (name: string) => {
      const n = name.toLowerCase();
      let boost = 0;
      for (const hint of CATEGORY_HINTS) {
        if (hint.words.some((w) => qNorm.includes(w)) && (n.includes(hint.key) || n.includes("čokolad") || n.includes("cokolad"))) {
          boost += 120; // category hint boost
        }
      }
      return boost;
    };

    const scoredProducts = allProducts
      .map(product => {
        let score = fuzzyMatch(product.name, searchQuery);
        if (hasBrand && brandMatched(product.name)) score += 400; // brand boost
        score += categoryBoostFor(`${product.category} ${product.name}`);
        return { product, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(item => item.product);

    const stores = await ctx.db.query("stores").collect();
    const storeMap = new Map(
      stores
        .filter((store) => ALLOWED_STORE_NAMES.has(store.name))
        .map((store) => [store._id, store])
    );

    const results = await Promise.all(
      scoredProducts.map(async (product) => {
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
            // Filtriraj neveljavne cene (odstrani 0.01 ipd.)
            if (!Number.isFinite(price.price) || price.price < 0.05) return null;
            return {
              storeId: price.storeId,
              storeName: store.name,
              storeColor: store.color,
              price: price.price,
              originalPrice: price.originalPrice,
              isOnSale: price.isOnSale,
              saleValidFrom: price.saleValidFrom,
              saleValidUntil: price.saleValidUntil,
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
    const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null && r.prices.length > 0);

    // Funkcija za izračun "size score" - višji = bolj želena velikost
    const getSizeScore = (name: string, unit: string): number => {
      const text = `${name} ${unit}`.toLowerCase();

      // PRIORITETNE velikosti - kar ljudje dejansko kupujejo (NAJVIŠJI SCORE)
      if (/\b1\s*kg\b|\b1000\s*g\b/i.test(text)) return 100;                 // 1kg - NAJBOLJŠE
      if (/\b1\s*l\b|\b1000\s*ml\b|\b1\s*liter\b/i.test(text)) return 100;  // 1L - NAJBOLJŠE
      if (/\b500\s*g\b|\b0[,.]5\s*kg\b/i.test(text)) return 95;              // 500g
      if (/\b500\s*ml\b|\b0[,.]5\s*l\b/i.test(text)) return 95;              // 500ml
      if (/\b750\s*ml\b/i.test(text)) return 90;                              // 750ml (vino, sokovi)
      if (/\b1[,.]5\s*l\b|\b1500\s*ml\b/i.test(text)) return 90;             // 1.5L
      if (/\b2\s*l\b|\b2000\s*ml\b/i.test(text)) return 85;                  // 2L
      if (/\b250\s*g\b/i.test(text)) return 80;                               // 250g (maslo, kava)
      if (/\b400\s*g\b/i.test(text)) return 75;                               // 400g (konzerve)
      if (/\b330\s*ml\b/i.test(text)) return 70;                              // 330ml (pločevinke)
      if (/\b300\s*g\b/i.test(text)) return 65;                               // 300g

      // SREDNJE velikosti - uporabne ampak ne prioriteta
      if (/\b200\s*g\b/i.test(text)) return 50;                               // 200g
      if (/\b150\s*g\b/i.test(text)) return 45;                               // 150g
      if (/\b250\s*ml\b/i.test(text)) return 45;                              // 250ml

      // MAJHNA pakiranja - MOČNA penalizacija (ljudje ne kupujejo)
      if (/\b200\s*ml\b/i.test(text)) return 15;    // 200ml - premajhno
      if (/\b100\s*ml\b/i.test(text)) return 8;     // 100ml - vzorec
      if (/\b50\s*ml\b/i.test(text)) return 5;      // 50ml - vzorec
      if (/\b100\s*g\b/i.test(text)) return 20;     // 100g - majhno
      if (/\b80\s*g\b/i.test(text)) return 15;      // 80g - majhno
      if (/\b75\s*g\b/i.test(text)) return 15;      // 75g - majhno
      if (/\b50\s*g\b/i.test(text)) return 10;      // 50g - vzorec
      if (/\b40\s*g\b/i.test(text)) return 8;       // 40g - mini
      if (/\b30\s*g\b/i.test(text)) return 5;       // 30g - mini
      if (/\b25\s*g\b/i.test(text)) return 5;       // 25g - mini

      // Če ni zaznane velikosti, nizek score (penalizacija za neznano)
      return 25;
    };

    // Sortiraj: NAJPREJ po velikosti, nato po ceni
    return validResults.sort((a, b) => {
      const aSize = getSizeScore(a.name, a.unit);
      const bSize = getSizeScore(b.name, b.unit);

      // Če je razlika v velikosti >15 točk, velikost VEDNO prevlada
      if (Math.abs(aSize - bSize) > 15) {
        return bSize - aSize; // Višji score = prvi
      }

      // Pri podobnih velikostih: VEDNO najcenejši prvi
      // Kombiniraj: 60% velikost, 40% cena (več teže na ceno)
      const maxPrice = 20;
      const aPriceScore = 100 - Math.min(a.lowestPrice / maxPrice * 100, 100);
      const bPriceScore = 100 - Math.min(b.lowestPrice / maxPrice * 100, 100);

      const aTotal = aSize * 0.6 + aPriceScore * 0.4;
      const bTotal = bSize * 0.6 + bPriceScore * 0.4;

      return bTotal - aTotal;
    });
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
      nameKey: v.optional(v.string()),
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

/**
 * BULK UPSERT - Masovno nalaganje izdelkov
 * PRAVILNA struktura: products + prices tabeli ločeno!
 */
export const bulkUpsert = mutation({
  args: {
    products: v.array(
      v.object({
        productName: v.string(),
        price: v.number(),
        salePrice: v.number(),
        storeName: v.string(),
        lastUpdated: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const product of args.products) {
      try {
        // 1. Poišči/ustvari trgovino
        let store = await ctx.db
          .query("stores")
          .filter((q) => q.eq(q.field("name"), product.storeName))
          .first();

        if (!store) {
          // Ustvari trgovino če ne obstaja
          const storeId = await ctx.db.insert("stores", {
            name: product.storeName,
            color: "#8b5cf6",
            isPremium: false,
          });
          store = await ctx.db.get(storeId);
          if (!store) {
            skipped++;
            continue;
          }
        }

        // 2. Poišči/ustvari izdelek (samo ime, brez cene!)
        let existingProduct = await ctx.db
          .query("products")
          .filter((q) => q.eq(q.field("name"), product.productName))
          .first();

        let productId;
        if (!existingProduct) {
          // Ustvari nov izdelek
          productId = await ctx.db.insert("products", {
            name: product.productName,
            category: "Splošno",
            unit: "",
          });
          inserted++;
        } else {
          productId = existingProduct._id;
        }

        // 3. Poišči/ustvari ceno v prices tabeli
        const existingPrice = await ctx.db
          .query("prices")
          .withIndex("by_product_and_store", (q) =>
            q.eq("productId", productId).eq("storeId", store!._id)
          )
          .first();

        if (existingPrice) {
          // UPDATE cene
          await ctx.db.patch(existingPrice._id, {
            price: product.salePrice,
            originalPrice: product.price,
            isOnSale: product.salePrice < product.price,
            lastUpdated: Date.now(),
          });
          updated++;
        } else {
          // INSERT nove cene
          await ctx.db.insert("prices", {
            productId,
            storeId: store._id,
            price: product.salePrice,
            originalPrice: product.price,
            isOnSale: product.salePrice < product.price,
            lastUpdated: Date.now(),
          });
        }
      } catch (error) {
        skipped++;
        console.error(`Napaka pri izdelku ${product.productName}:`, error);
      }
    }

    return {
      success: true,
      inserted,
      updated,
      skipped,
      total: args.products.length,
    };
  },
});
