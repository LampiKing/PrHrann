import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Shrani ujemajoče izdelke za prikaz primerjave cen
 */
export const saveMatchedProducts = mutation({
  args: {
    matches: v.array(v.object({
      canonicalName: v.string(),
      sparPrice: v.optional(v.number()),
      mercatorPrice: v.optional(v.number()),
      tusPrice: v.optional(v.number()),
      cheapestStore: v.string(),
      priceDifference: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    // Počisti stare zapise
    const existing = await ctx.db.query("priceComparisons").collect();
    for (const item of existing) {
      await ctx.db.delete(item._id);
    }

    // Vstavi nove
    let inserted = 0;
    for (const match of args.matches) {
      await ctx.db.insert("priceComparisons", {
        canonicalName: match.canonicalName,
        sparPrice: match.sparPrice,
        mercatorPrice: match.mercatorPrice,
        tusPrice: match.tusPrice,
        cheapestStore: match.cheapestStore,
        priceDifference: match.priceDifference,
        updatedAt: Date.now(),
      });
      inserted++;
    }

    return { inserted };
  },
});

/**
 * Pridobi primerjave cen za prikaz
 */
export const getComparisons = query({
  args: {
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    minSavings: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let comparisons = await ctx.db.query("priceComparisons").collect();

    // Filter po iskanju
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      comparisons = comparisons.filter(c =>
        c.canonicalName.toLowerCase().includes(searchLower)
      );
    }

    // Filter po minimalnem prihranku
    if (args.minSavings !== undefined) {
      comparisons = comparisons.filter(c => c.priceDifference >= args.minSavings!);
    }

    // Sortiraj po prihranku (največji najprej)
    comparisons.sort((a, b) => b.priceDifference - a.priceDifference);

    // Omeji rezultate
    if (args.limit) {
      comparisons = comparisons.slice(0, args.limit);
    }

    return comparisons;
  },
});

/**
 * Pridobi statistiko primerjav
 */
export const getComparisonStats = query({
  handler: async (ctx) => {
    const comparisons = await ctx.db.query("priceComparisons").collect();

    const stats = {
      total: comparisons.length,
      withAllStores: 0,
      sparCheapest: 0,
      mercatorCheapest: 0,
      tusCheapest: 0,
      avgSavings: 0,
      maxSavings: 0,
    };

    let totalSavings = 0;
    for (const c of comparisons) {
      // Štej koliko ima vse 3 trgovine
      if (c.sparPrice && c.mercatorPrice && c.tusPrice) {
        stats.withAllStores++;
      }

      // Štej najcenejše
      if (c.cheapestStore.toLowerCase().includes('spar')) stats.sparCheapest++;
      else if (c.cheapestStore.toLowerCase().includes('mer')) stats.mercatorCheapest++;
      else if (c.cheapestStore.toLowerCase().includes('tu')) stats.tusCheapest++;

      totalSavings += c.priceDifference;
      if (c.priceDifference > stats.maxSavings) {
        stats.maxSavings = c.priceDifference;
      }
    }

    stats.avgSavings = comparisons.length > 0 ? totalSavings / comparisons.length : 0;

    return stats;
  },
});

/**
 * Uvozi matched products iz JSON (kliče se iz GitHub Action)
 */
export const importMatchedProducts = action({
  handler: async (ctx) => {
    // Ta funkcija se kliče iz GitHub Action
    // JSON se prebere lokalno in pošlje kot argument
    console.log("Import triggered - use saveMatchedProducts mutation with parsed data");
    return { success: true, message: "Use saveMatchedProducts with parsed JSON data" };
  },
});
