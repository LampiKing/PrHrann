import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const ALLOWED_STORE_NAMES = new Set(["Spar", "Mercator", "Tus"]);

/**
 * Izračun velikosti izdelka - KRITIČNO za razvrščanje
 * Večji paketi (1L, 1kg, 500g) imajo veliko prednost
 */
function getSizeScore(name: string, unit: string): number {
  const text = `${name} ${unit}`.toLowerCase();

  // PRIORITETNE velikosti - kar ljudje dejansko kupujejo
  if (/\b1\s*kg\b|\b1000\s*g\b/i.test(text)) return 100;
  if (/\b1\s*l\b|\b1000\s*ml\b|\b1\s*liter\b/i.test(text)) return 100;
  if (/\b500\s*g\b|\b0[,.]5\s*kg\b/i.test(text)) return 95;
  if (/\b500\s*ml\b|\b0[,.]5\s*l\b/i.test(text)) return 95;
  if (/\b750\s*ml\b/i.test(text)) return 90;
  if (/\b1[,.]5\s*l\b|\b1500\s*ml\b/i.test(text)) return 90;
  if (/\b2\s*l\b|\b2000\s*ml\b/i.test(text)) return 85;
  if (/\b250\s*g\b/i.test(text)) return 80;
  if (/\b400\s*g\b/i.test(text)) return 75;
  if (/\b330\s*ml\b/i.test(text)) return 70;
  if (/\b300\s*g\b/i.test(text)) return 65;

  // SREDNJE velikosti
  if (/\b200\s*g\b/i.test(text)) return 50;
  if (/\b150\s*g\b/i.test(text)) return 45;
  if (/\b250\s*ml\b/i.test(text)) return 40;

  // MAJHNA pakiranja - MOČNA penalizacija
  if (/\b200\s*ml\b/i.test(text)) return 15;
  if (/\b100\s*ml\b/i.test(text)) return 8;
  if (/\b50\s*ml\b/i.test(text)) return 5;
  if (/\b100\s*g\b/i.test(text)) return 20;
  if (/\b90\s*g\b/i.test(text)) return 18;
  if (/\b80\s*g\b/i.test(text)) return 15;
  if (/\b75\s*g\b/i.test(text)) return 15;
  if (/\b70\s*g\b/i.test(text)) return 12;
  if (/\b50\s*g\b/i.test(text)) return 10;
  if (/\b40\s*g\b/i.test(text)) return 8;
  if (/\b30\s*g\b/i.test(text)) return 5;

  return 25; // neznana velikost
}

/**
 * PAMETNO ISKANJE - Prioritizira enostavne izdelke
 * "mleko" -> najprej "Mleko 1L", šele nato "Čokoladno mleko z vanilijo"
 */
function smartMatch(productName: string, searchQuery: string, unit: string): number {
  const nameLower = productName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const queryLower = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);

  if (queryWords.length === 0) return 0;

  // Besede v imenu izdelka (brez števil in enot)
  const nameWords = nameLower
    .replace(/\d+[,.]?\d*\s*(kg|g|l|ml|cl|dl|kos|kom|%)/gi, "")
    .split(/[\s,]+/)
    .filter(w => w.length > 1);

  // 1. Preveri če se vse iskane besede ujemajo
  let matchedWords = 0;
  for (const qWord of queryWords) {
    if (nameWords.some(nw => nw.includes(qWord) || qWord.includes(nw))) {
      matchedWords++;
    }
  }

  // Če se ne ujema nobena beseda, 0
  if (matchedWords === 0) return 0;

  // Če se ne ujemajo VSE iskane besede, nizek score
  const matchRatio = matchedWords / queryWords.length;
  if (matchRatio < 1) return matchRatio * 50;

  // 2. ENOSTAVNOST - manj besed = boljše
  // "Mleko" (1 beseda) > "Čokoladno mleko" (2 besedi) > "Čokoladno mleko z vanilijo" (4 besede)
  const simplicityScore = Math.max(0, 100 - (nameWords.length - queryWords.length) * 25);

  // 3. POZICIJA - če iskana beseda je na začetku, bonus
  let positionBonus = 0;
  if (nameWords.length > 0 && queryWords.some(qw => nameWords[0].includes(qw))) {
    positionBonus = 50;
  }

  // 4. VELIKOST - velik paket = boljše
  const sizeScore = getSizeScore(productName, unit);

  // 5. PENALIZACIJA za "okuse" ki jih uporabnik NI iskal
  const FLAVOR_WORDS = [
    "cokolad", "cokolada", "cokoladni", "cokoladna", "cokoladno",
    "vanilij", "jagod", "lesnik", "karamel", "banana", "visnja",
    "jagodna", "lesnikova", "karamelna", "bananina", "visnjeva",
    "orehov", "mandljev", "pistacij", "kokos",
    "sladka", "slana", "pecena", "prazen"
  ];

  let flavorPenalty = 0;
  for (const flavor of FLAVOR_WORDS) {
    // Če je okus v imenu ampak NI v iskalni poizvedbi
    if (nameLower.includes(flavor) && !queryLower.includes(flavor)) {
      flavorPenalty += 30;
    }
  }

  // Končni score: enostavnost + pozicija + velikost - penalizacija
  const finalScore = simplicityScore + positionBonus + sizeScore - flavorPenalty;

  return Math.max(10, finalScore); // minimum 10 če se ujema
}

// Iskanje izdelkov - PAMETNO razvrščanje
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
    if (!args.query || !args.query.trim() || args.query.trim().length < 2) {
      return [];
    }

    const searchQuery = args.query.trim();

    // 1. Pridobi kandidate iz search indexa
    const searchCandidates = await ctx.db
      .query("products")
      .withSearchIndex("search_name", (q) => q.search("name", searchQuery.toLowerCase()))
      .take(500);

    // 2. Fallback če premalo rezultatov
    let allProducts = searchCandidates;
    if (searchCandidates.length < 50) {
      allProducts = await ctx.db.query("products").take(3000);
    }

    // 3. Oceni vsak izdelek s PAMETNIM algoritmom
    const scoredProducts = allProducts
      .map(product => ({
        product,
        score: smartMatch(product.name, searchQuery, product.unit),
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 100) // Več kandidatov
      .map(item => item.product);

    // 4. Pridobi trgovine
    const stores = await ctx.db.query("stores").collect();
    const storeMap = new Map(
      stores
        .filter((store) => ALLOWED_STORE_NAMES.has(store.name))
        .map((store) => [store._id, store])
    );

    // 5. Pridobi cene za vsak izdelek
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
            if (!args.isPremium && store.isPremium) return null;
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

    // 6. Filtriraj in končno razvrsti
    const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null && r.prices.length > 0);

    // Končno razvrščanje: VELIKOST > ENOSTAVNOST > CENA
    return validResults.sort((a, b) => {
      const aSize = getSizeScore(a.name, a.unit);
      const bSize = getSizeScore(b.name, b.unit);
      const aSmart = smartMatch(a.name, searchQuery, a.unit);
      const bSmart = smartMatch(b.name, searchQuery, b.unit);

      // Kombiniran score: 50% pametnost, 40% velikost, 10% cena
      const maxPrice = 30;
      const aPriceScore = 100 - Math.min(a.lowestPrice / maxPrice * 100, 100);
      const bPriceScore = 100 - Math.min(b.lowestPrice / maxPrice * 100, 100);

      const aTotal = aSmart * 0.5 + aSize * 0.4 + aPriceScore * 0.1;
      const bTotal = bSmart * 0.5 + bSize * 0.4 + bPriceScore * 0.1;

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
