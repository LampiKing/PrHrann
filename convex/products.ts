import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
    if (!args.query.trim()) return [];

    const allProducts = await ctx.db.query("products").collect();
    const searchLower = args.query.toLowerCase();
    
    const matchedProducts = allProducts.filter(
      (p) => p.name.toLowerCase().includes(searchLower)
    );

    const stores = await ctx.db.query("stores").collect();
    const storeMap = new Map(stores.map((s) => [s._id, s]));

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

        const validPrices = pricesWithStores.map((p) => p.price);
        
        return {
          ...product,
          prices: pricesWithStores,
          lowestPrice: Math.min(...validPrices, 0),
          highestPrice: Math.max(...validPrices, 0),
        };
      })
    );

    return results.filter((r) => r.prices.length > 0);
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
      { name: "Kruh", category: "Pekovski izdelki", unit: "500g" },
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
