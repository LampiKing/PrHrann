import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Zabelež nakup in izračunaj prihranek
export const recordPurchase = mutation({
  args: {
    productId: v.id("products"),
    storeId: v.id("stores"),
    quantity: v.number(),
    pricePaid: v.number(), // Cena ki jo je plačal (z akcijo)
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niste prijavljeni");

    // Pridobi vse cene za ta produkt da najdemo "redno" ceno
    const prices = await ctx.db
      .query("prices")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();

    // Redna cena je povprečje vseh ne-akcijskih cen ali najvišja cena
    const nonSalePrices = prices.filter(p => !p.isOnSale);
    const regularPrice = nonSalePrices.length > 0
      ? Math.max(...nonSalePrices.map(p => p.price))
      : Math.max(...prices.map(p => p.price));

    const savedAmount = Math.max(0, (regularPrice - args.pricePaid) * args.quantity);

    await ctx.db.insert("purchases", {
      userId: identity.subject,
      productId: args.productId,
      storeId: args.storeId,
      quantity: args.quantity,
      pricePaid: args.pricePaid,
      regularPrice,
      savedAmount,
      purchaseDate: Date.now(),
    });

    // Posodobi user profile savings
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .first();

    if (profile) {
      const now = Date.now();
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      let monthlySavings = profile.monthlySavings || 0;
      
      // Reset mesečnih prihrankov če je nov mesec
      if (!profile.lastSavingsReset || profile.lastSavingsReset < monthStart.getTime()) {
        monthlySavings = 0;
      }

      await ctx.db.patch(profile._id, {
        totalSavings: (profile.totalSavings || 0) + savedAmount,
        monthlySavings: monthlySavings + savedAmount,
        lastSavingsReset: monthStart.getTime(),
      });
    }

    return { 
      success: true,
      savedAmount,
      message: savedAmount > 0 
        ? `Prihranili ste ${savedAmount.toFixed(2)}€!` 
        : undefined
    };
  },
});

// Pridobi statistics o prihrankih
export const getSavingsStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .first();

    if (!profile) return null;

    // Pridobi prihranke za trenutni mesec
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyPurchases = await ctx.db
      .query("purchases")
      .withIndex("by_date", (q) => 
        q.eq("userId", identity.subject).gte("purchaseDate", monthStart.getTime())
      )
      .collect();

    // Najdi top prihranek
    let topSaving = null;
    let maxSaved = 0;

    for (const purchase of monthlyPurchases) {
      if (purchase.savedAmount > maxSaved) {
        maxSaved = purchase.savedAmount;
        const product = await ctx.db.get(purchase.productId);
        const store = await ctx.db.get(purchase.storeId);
        topSaving = {
          product: product?.name,
          store: store?.name,
          savedAmount: purchase.savedAmount,
          percentage: ((purchase.savedAmount / (purchase.regularPrice * purchase.quantity)) * 100).toFixed(0),
        };
      }
    }

    // Pridobi letne prihranke
    const yearStart = new Date();
    yearStart.setMonth(0);
    yearStart.setDate(1);
    yearStart.setHours(0, 0, 0, 0);

    const yearlyPurchases = await ctx.db
      .query("purchases")
      .withIndex("by_date", (q) => 
        q.eq("userId", identity.subject).gte("purchaseDate", yearStart.getTime())
      )
      .collect();

    const yearlySavings = yearlyPurchases.reduce((sum, p) => sum + p.savedAmount, 0);

    // Najcenejša trgovina tega meseca
    const storeMap = new Map<string, { name: string; totalSaved: number; count: number }>();
    
    for (const purchase of monthlyPurchases) {
      const store = await ctx.db.get(purchase.storeId);
      if (!store) continue;

      const current = storeMap.get(store.name) || { name: store.name, totalSaved: 0, count: 0 };
      storeMap.set(store.name, {
        name: store.name,
        totalSaved: current.totalSaved + purchase.savedAmount,
        count: current.count + 1,
      });
    }

    const topStore = Array.from(storeMap.values())
      .sort((a, b) => b.totalSaved - a.totalSaved)[0] || null;

    return {
      totalSavings: profile.totalSavings || 0,
      monthlySavings: profile.monthlySavings || 0,
      yearlySavings,
      topSaving,
      topStore,
      monthlyPurchases: monthlyPurchases.length,
    };
  },
});

// Pridobi zgodovino nakupov
export const getPurchaseHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_date", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(args.limit || 50);

    const purchasesWithDetails = await Promise.all(
      purchases.map(async (purchase) => {
        const product = await ctx.db.get(purchase.productId);
        const store = await ctx.db.get(purchase.storeId);

        return {
          ...purchase,
          product,
          store,
        };
      })
    );

    return purchasesWithDetails;
  },
});

// Pridobi mesečni breakdown prihrankov
export const getMonthlySavingsBreakdown = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Pridobi prihranke za zadnjih 6 mesecev
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);

      const nextMonth = new Date(date);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const purchases = await ctx.db
        .query("purchases")
        .withIndex("by_date", (q) => 
          q.eq("userId", identity.subject)
           .gte("purchaseDate", date.getTime())
           .lt("purchaseDate", nextMonth.getTime())
        )
        .collect();

      const totalSaved = purchases.reduce((sum, p) => sum + p.savedAmount, 0);

      months.push({
        month: date.toLocaleDateString('sl-SI', { month: 'short', year: 'numeric' }),
        savings: totalSaved,
        purchases: purchases.length,
      });
    }

    return months;
  },
});
