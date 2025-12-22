import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Pridobi vse trgovine
export const getAll = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("stores"),
      _creationTime: v.number(),
      name: v.string(),
      logo: v.optional(v.string()),
      color: v.string(),
      isPremium: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("stores").collect();
  },
});

// Inicializiraj trgovine (za začetne podatke)
export const seedStores = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const existingStores = await ctx.db.query("stores").collect();
    if (existingStores.length > 0) return null;

    const stores = [
      { name: "Spar", color: "#00843D", isPremium: false },
      { name: "Mercator", color: "#E31E24", isPremium: false },
      { name: "Tus", color: "#FF6B00", isPremium: false },
      { name: "Lidl", color: "#0050AA", isPremium: false },
      { name: "Hofer", color: "#00529B", isPremium: true },
      { name: "Jager", color: "#8B4513", isPremium: true },
    ];

    for (const store of stores) {
      await ctx.db.insert("stores", store);
    }
    return null;
  },
});
