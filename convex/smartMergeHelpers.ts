import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Pridobi izdelke s samo 1 trgovino
export const getSingleStoreProducts = internalMutation({
  args: { limit: v.number() },
  returns: v.array(v.object({
    _id: v.id("products"),
    name: v.string(),
    imageUrl: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const products = await ctx.db.query("products").take(args.limit * 5);

    const results = [];
    for (const product of products) {
      const prices = await ctx.db
        .query("prices")
        .withIndex("by_product", q => q.eq("productId", product._id))
        .collect();

      if (prices.length === 1) {
        results.push({
          _id: product._id,
          name: product.name,
          imageUrl: product.imageUrl,
        });
      }

      if (results.length >= args.limit) break;
    }

    return results;
  },
});

// Pridobi izdelke za primerjavo (brez cen za hitrejše branje)
export const getMultiStoreProducts = internalMutation({
  args: { limit: v.number() },
  returns: v.array(v.object({
    _id: v.id("products"),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    storeCount: v.number(),
  })),
  handler: async (ctx, args) => {
    // Preprosto vrni vse izdelke brez preverjanja cen (za hitrost)
    const products = await ctx.db.query("products").take(args.limit);

    return products.map(product => ({
      _id: product._id,
      name: product.name,
      imageUrl: product.imageUrl,
      storeCount: 1, // Privzeto 1, ker ne preverjamo
    }));
  },
});

// Pridobi izdelke iz določene trgovine (za primerjavo čez trgovine)
export const getProductsFromStore = internalMutation({
  args: {
    storeId: v.id("stores"),
    limit: v.number(),
    excludeIds: v.array(v.id("products")),
  },
  returns: v.array(v.object({
    _id: v.id("products"),
    name: v.string(),
    imageUrl: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const excludeSet = new Set(args.excludeIds.map(id => id.toString()));
    const products = await ctx.db.query("products").take(args.limit * 10);

    const results = [];
    for (const product of products) {
      if (excludeSet.has(product._id.toString())) continue;

      const price = await ctx.db
        .query("prices")
        .withIndex("by_product_and_store", q =>
          q.eq("productId", product._id).eq("storeId", args.storeId)
        )
        .first();

      if (price) {
        results.push({
          _id: product._id,
          name: product.name,
          imageUrl: product.imageUrl,
        });
        if (results.length >= args.limit) break;
      }
    }

    return results;
  },
});

// Združi dva izdelka
export const mergeProducts = internalMutation({
  args: {
    keepId: v.id("products"),
    mergeId: v.id("products"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (args.keepId === args.mergeId) return false;

    const keepProduct = await ctx.db.get(args.keepId);
    const mergeProduct = await ctx.db.get(args.mergeId);

    if (!keepProduct || !mergeProduct) return false;

    // Prenesi cene
    const pricesToMove = await ctx.db
      .query("prices")
      .withIndex("by_product", q => q.eq("productId", args.mergeId))
      .collect();

    for (const price of pricesToMove) {
      const existing = await ctx.db
        .query("prices")
        .withIndex("by_product_and_store", q =>
          q.eq("productId", args.keepId).eq("storeId", price.storeId)
        )
        .first();

      if (!existing) {
        await ctx.db.patch(price._id, { productId: args.keepId });
      } else {
        await ctx.db.delete(price._id);
      }
    }

    // Posodobi sliko če manjka
    if (!keepProduct.imageUrl && mergeProduct.imageUrl) {
      await ctx.db.patch(args.keepId, { imageUrl: mergeProduct.imageUrl });
    }

    // Pobriši merge produkt
    await ctx.db.delete(args.mergeId);

    return true;
  },
});
