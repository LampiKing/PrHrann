import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getStoreCounts = query({
  args: {},
  returns: v.array(
    v.object({
      storeId: v.id("stores"),
      storeName: v.string(),
      priceCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    const stores = await ctx.db.query("stores").collect();
    const countsById = new Map<string, number>();

    const prices = await ctx.db.query("prices").collect();
    for (const price of prices) {
      const key = String(price.storeId);
      countsById.set(key, (countsById.get(key) ?? 0) + 1);
    }

    return stores.map((store) => ({
      storeId: store._id,
      storeName: store.name,
      priceCount: countsById.get(String(store._id)) ?? 0,
    }));
  }
});
