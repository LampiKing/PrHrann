import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Počisti vse podatke
export const clearAllData = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Izbriši cene
    const prices = await ctx.db.query("prices").collect();
    for (const price of prices) {
      await ctx.db.delete(price._id);
    }
    
    // Izbriši kupone
    const coupons = await ctx.db.query("coupons").collect();
    for (const coupon of coupons) {
      await ctx.db.delete(coupon._id);
    }
    
    // Izbriši izdelke
    const products = await ctx.db.query("products").collect();
    for (const product of products) {
      await ctx.db.delete(product._id);
    }
    
    // Izbriši trgovine
    const stores = await ctx.db.query("stores").collect();
    for (const store of stores) {
      await ctx.db.delete(store._id);
    }
    
    // Izbriši košarico
    const cartItems = await ctx.db.query("cartItems").collect();
    for (const item of cartItems) {
      await ctx.db.delete(item._id);
    }
    
    return null;
  },
});

// Vnesi trgovine
export const insertStores = internalMutation({
  args: {
    stores: v.array(v.object({
      name: v.string(),
      color: v.string(),
      logo: v.string(),
      isPremium: v.boolean(),
    })),
  },
  returns: v.array(v.object({
    name: v.string(),
    id: v.id("stores"),
  })),
  handler: async (ctx, args) => {
    const storeIds: Array<{ name: string; id: Id<"stores"> }> = [];
    
    for (const store of args.stores) {
      const id = await ctx.db.insert("stores", {
        name: store.name,
        color: store.color,
        logo: store.logo || undefined,
        isPremium: store.isPremium,
      });
      storeIds.push({ name: store.name, id });
    }
    
    return storeIds;
  },
});

// Vnesi izdelke
export const insertProducts = internalMutation({
  args: {
    products: v.array(v.object({
      name: v.string(),
      category: v.string(),
      unit: v.string(),
      imageUrl: v.string(),
    })),
  },
  returns: v.array(v.object({
    name: v.string(),
    id: v.id("products"),
  })),
  handler: async (ctx, args) => {
    const productIds: Array<{ name: string; id: Id<"products"> }> = [];
    
    for (const product of args.products) {
      const id = await ctx.db.insert("products", {
        name: product.name,
        category: product.category,
        unit: product.unit,
        imageUrl: product.imageUrl || undefined,
      });
      productIds.push({ name: product.name, id });
    }
    
    return productIds;
  },
});

// Vnesi cene
export const insertPrices = internalMutation({
  args: {
    pricesData: v.record(v.string(), v.record(v.string(), v.object({
      price: v.number(),
      originalPrice: v.optional(v.number()),
      isOnSale: v.boolean(),
    }))),
    storeIds: v.array(v.object({
      name: v.string(),
      id: v.id("stores"),
    })),
    productIds: v.array(v.object({
      name: v.string(),
      id: v.id("products"),
    })),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    
    // Convert arrays to maps for lookup
    const storeMap = new Map(args.storeIds.map(s => [s.name, s.id]));
    const productMap = new Map(args.productIds.map(p => [p.name, p.id]));
    
    for (const [productName, storePrices] of Object.entries(args.pricesData)) {
      const productId = productMap.get(productName);
      if (!productId) continue;
      
      for (const [storeName, priceData] of Object.entries(storePrices)) {
        const storeId = storeMap.get(storeName);
        if (!storeId) continue;
        
        await ctx.db.insert("prices", {
          productId,
          storeId,
          price: priceData.price,
          originalPrice: priceData.originalPrice,
          isOnSale: priceData.isOnSale,
          lastUpdated: Date.now(),
        });
        count++;
      }
    }
    
    return count;
  },
});

// Vnesi kupone
export const insertCoupons = internalMutation({
  args: {
    coupons: v.array(v.object({
      storeName: v.string(),
      code: v.string(),
      description: v.string(),
      couponType: v.union(
        v.literal("percentage_total"),
        v.literal("percentage_single_item"),
        v.literal("fixed"),
        v.literal("category_discount")
      ),
      discountValue: v.number(),
      minPurchase: v.optional(v.number()),
      validDays: v.optional(v.array(v.number())),
      validUntil: v.number(),
      excludeSaleItems: v.optional(v.boolean()),
      requiresLoyaltyCard: v.optional(v.boolean()),
      canCombine: v.optional(v.boolean()),
      applicableCategories: v.optional(v.array(v.string())),
      isPremiumOnly: v.boolean(),
    })),
    storeIds: v.array(v.object({
      name: v.string(),
      id: v.id("stores"),
    })),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    
    // Convert array to map for lookup
    const storeMap = new Map(args.storeIds.map(s => [s.name, s.id]));
    
    for (const coupon of args.coupons) {
      const storeId = storeMap.get(coupon.storeName);
      if (!storeId) continue;
      
      await ctx.db.insert("coupons", {
        storeId,
        code: coupon.code,
        description: coupon.description,
        couponType: coupon.couponType,
        discountValue: coupon.discountValue,
        minPurchase: coupon.minPurchase,
        validDays: coupon.validDays,
        validUntil: coupon.validUntil,
        excludeSaleItems: coupon.excludeSaleItems,
        requiresLoyaltyCard: coupon.requiresLoyaltyCard,
        canCombine: coupon.canCombine,
        applicableCategories: coupon.applicableCategories,
        isPremiumOnly: coupon.isPremiumOnly,
      });
      count++;
    }
    
    return count;
  },
});
