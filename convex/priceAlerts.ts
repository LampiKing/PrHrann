import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";

// Ustvari price alert
export const createAlert = mutation({
  args: {
    productId: v.id("products"),
    storeId: v.optional(v.id("stores")),
    targetPrice: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niste prijavljeni");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .first();

    if (!profile?.isPremium) {
      throw new Error("Price Alerts so na voljo samo za Premium uporabnike (1,99€/mesec)");
    }

    // Pridobi trenutno najnižjo ceno
    let prices;
    if (args.storeId) {
      prices = await ctx.db
        .query("prices")
        .withIndex("by_product_and_store", (q) => 
          q.eq("productId", args.productId).eq("storeId", args.storeId)
        )
        .collect();
    } else {
      prices = await ctx.db
        .query("prices")
        .withIndex("by_product", (q) => q.eq("productId", args.productId))
        .collect();
    }

    const currentPrice = prices.length > 0 
      ? Math.min(...prices.map(p => p.price))
      : 0;

    const alertId = await ctx.db.insert("priceAlerts", {
      userId: identity.subject,
      productId: args.productId,
      storeId: args.storeId,
      targetPrice: args.targetPrice,
      currentPrice,
      isActive: true,
      triggered: false,
      createdAt: Date.now(),
    });

    return { success: true, alertId };
  },
});

// Pridobi vse alerte uporabnika
export const getAlerts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const alerts = await ctx.db
      .query("priceAlerts")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    // Za vsak alert pridobi product in store details
    const alertsWithDetails = await Promise.all(
      alerts.map(async (alert) => {
        const product = await ctx.db.get(alert.productId);
        const store = alert.storeId ? await ctx.db.get(alert.storeId) : null;

        // Pridobi trenutno ceno
        let prices;
        if (alert.storeId) {
          prices = await ctx.db
            .query("prices")
            .withIndex("by_product_and_store", (q) => 
              q.eq("productId", alert.productId).eq("storeId", alert.storeId)
            )
            .collect();
        } else {
          prices = await ctx.db
            .query("prices")
            .withIndex("by_product", (q) => q.eq("productId", alert.productId))
            .collect();
        }

        const currentPrice = prices.length > 0 
          ? Math.min(...prices.map(p => p.price))
          : alert.currentPrice;

        return {
          ...alert,
          product,
          store,
          currentPrice,
          priceDropped: currentPrice <= alert.targetPrice,
        };
      })
    );

    return alertsWithDetails.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Izbriši alert
export const deleteAlert = mutation({
  args: {
    alertId: v.id("priceAlerts"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niste prijavljeni");

    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Alert ne obstaja");
    if (alert.userId !== identity.subject) throw new Error("Nimate dovoljenja");

    await ctx.db.delete(args.alertId);
    return { success: true };
  },
});

// Deaktiviraj/aktiviraj alert
export const toggleAlert = mutation({
  args: {
    alertId: v.id("priceAlerts"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niste prijavljeni");

    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Alert ne obstaja");
    if (alert.userId !== identity.subject) throw new Error("Nimate dovoljenja");

    await ctx.db.patch(args.alertId, {
      isActive: !alert.isActive,
      triggered: false, // Reset triggered status
    });

    return { success: true, isActive: !alert.isActive };
  },
});

// Posodobi target ceno
export const updateTargetPrice = mutation({
  args: {
    alertId: v.id("priceAlerts"),
    targetPrice: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niste prijavljeni");

    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Alert ne obstaja");
    if (alert.userId !== identity.subject) throw new Error("Nimate dovoljenja");

    await ctx.db.patch(args.alertId, {
      targetPrice: args.targetPrice,
      triggered: false, // Reset triggered status
    });

    return { success: true };
  },
});

// Check alerts periodically (to be called by cron job or manually)
export const checkAlerts = mutation({
  args: {},
  handler: async (ctx) => {
    const activeAlerts = await ctx.db
      .query("priceAlerts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter((q) => q.eq(q.field("triggered"), false))
      .collect();

    const triggeredAlerts = [];

    for (const alert of activeAlerts) {
      // Pridobi trenutno ceno
      let prices;
      if (alert.storeId) {
        prices = await ctx.db
          .query("prices")
          .withIndex("by_product_and_store", (q) => 
            q.eq("productId", alert.productId).eq("storeId", alert.storeId)
          )
          .collect();
      } else {
        prices = await ctx.db
          .query("prices")
          .withIndex("by_product", (q) => q.eq("productId", alert.productId))
          .collect();
      }

      const currentPrice = prices.length > 0 
        ? Math.min(...prices.map(p => p.price))
        : alert.currentPrice;

      // Posodobi trenutno ceno
      await ctx.db.patch(alert._id, {
        currentPrice,
      });

      // Če je cena dosegla ali padla pod target, sproži alert
      if (currentPrice <= alert.targetPrice) {
        await ctx.db.patch(alert._id, {
          triggered: true,
          triggeredAt: Date.now(),
        });

        const product = await ctx.db.get(alert.productId);
        const store = alert.storeId ? await ctx.db.get(alert.storeId) : null;

        triggeredAlerts.push({
          alert,
          product,
          store,
          oldPrice: alert.currentPrice,
          newPrice: currentPrice,
        });
      }
    }

    return { 
      checked: activeAlerts.length,
      triggered: triggeredAlerts.length,
      alerts: triggeredAlerts,
    };
  },
});
