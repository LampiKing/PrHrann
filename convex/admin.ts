import { query } from "./_generated/server";

export const getStoreCounts = query({
  args: {},
  handler: async (ctx) => {
    const prices = await ctx.db.query("prices").collect();
    const stores = await ctx.db.query("stores").collect();

    const storeMap = new Map(stores.map(s => [s._id, s.name]));
    const counts: Record<string, number> = {};

    // Initialize
    for (const s of stores) {
      counts[s.name] = 0;
    }

    for (const p of prices) {
      const sName = storeMap.get(p.storeId);
      if (sName) {
        counts[sName] = (counts[sName] || 0) + 1;
      }
    }

    return counts;
  }
});
