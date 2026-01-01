import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

const ALLOWED_STORE_NAMES = new Set(["Spar", "Mercator", "Tus"]);

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
    const stores = await ctx.db.query("stores").collect();
    return stores.filter((store) => ALLOWED_STORE_NAMES.has(store.name));
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
      { name: "Spar", color: "#FDB913", isPremium: false }, // Rumeno-rdeč
      { name: "Mercator", color: "#E31E24", isPremium: false }, // Belo-rdeč s pikicami
      { name: "Tus", color: "#1B5E20", isPremium: false }, // Temno zelen
    ];

    for (const store of stores) {
      await ctx.db.insert("stores", store);
    }
    return null;
  },
});

// Inicializiraj vse podatke iz seedData.ts
export const initializeAllData = action({
  args: {},
  returns: v.object({
    stores: v.number(),
    products: v.number(),
    prices: v.number(),
    coupons: v.number(),
  }),
  handler: async (ctx): Promise<{ stores: number; products: number; prices: number; coupons: number; }> => {
    // Preverimo če že imamo podatke
    const existingStores: any[] = await ctx.runQuery(api.stores.getAll);
    if (existingStores.length > 0) {
      return {
        stores: existingStores.length,
        products: 0,
        prices: 0,
        coupons: 0,
      };
    }
    
    // Kličemo seedDatabase funkcijo
    const result: { stores: number; products: number; prices: number; coupons: number; } = await ctx.runAction(internal.seedData.seedDatabase);
    return result;
  },
});

// Force reset in ponovno naloži podatke
export const resetAndSeedData = action({
  args: {},
  returns: v.object({
    stores: v.number(),
    products: v.number(),
    prices: v.number(),
    coupons: v.number(),
  }),
  handler: async (ctx): Promise<{ stores: number; products: number; prices: number; coupons: number; }> => {
    // Vedno resetiraj in ponovno naloži
    const result: { stores: number; products: number; prices: number; coupons: number; } = await ctx.runAction(internal.seedData.seedDatabase);
    return result;
  },
});
