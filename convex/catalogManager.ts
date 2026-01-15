import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Preveri in označi potekle akcije
 * Teče dnevno preko cron job-a
 */
export const checkExpiredSales = internalMutation({
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0]; // "2026-01-15"

    // Pridobi vse aktivne akcije
    const activeSales = await ctx.db
      .query("salePrices")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    let expiredCount = 0;
    let stillActiveCount = 0;

    for (const sale of activeSales) {
      // Preveri če je akcija potekla
      if (sale.validUntil < today) {
        // Označi kot neaktivno
        await ctx.db.patch(sale._id, { isActive: false });
        expiredCount++;

        // Posodobi ceno v prices tabeli če obstaja povezan izdelek
        if (sale.productId) {
          const price = await ctx.db
            .query("prices")
            .withIndex("by_product_and_store", (q) =>
              q.eq("productId", sale.productId!).eq("storeId", sale.storeId)
            )
            .first();

          if (price && price.isOnSale) {
            // Vrni na redno ceno
            await ctx.db.patch(price._id, {
              price: sale.originalPrice,
              originalPrice: undefined,
              isOnSale: false,
              saleValidFrom: undefined,
              saleValidUntil: undefined,
              catalogSource: undefined,
              lastUpdated: Date.now(),
            });
          }
        }
      } else {
        stillActiveCount++;
      }
    }

    // Preveri tudi prices tabelo za potekle akcije
    const pricesWithSales = await ctx.db
      .query("prices")
      .filter((q) => q.eq(q.field("isOnSale"), true))
      .collect();

    let pricesExpired = 0;
    for (const price of pricesWithSales) {
      if (price.saleValidUntil && price.saleValidUntil < today) {
        // Akcija je potekla - vrni na redno ceno
        await ctx.db.patch(price._id, {
          price: price.originalPrice ?? price.price,
          originalPrice: undefined,
          isOnSale: false,
          saleValidFrom: undefined,
          saleValidUntil: undefined,
          catalogSource: undefined,
          lastUpdated: Date.now(),
        });
        pricesExpired++;
      }
    }

    console.log(`[CatalogManager] Checked sales: ${activeSales.length} active, ${expiredCount} expired`);
    console.log(`[CatalogManager] Prices with expired sales: ${pricesExpired}`);

    return {
      checkedSales: activeSales.length,
      expiredSales: expiredCount,
      stillActive: stillActiveCount,
      pricesExpired,
    };
  },
});

/**
 * Pridobi aktivne akcije za prikaz
 */
export const getActiveSales = query({
  args: {
    storeId: v.optional(v.id("stores")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];

    let sales = await ctx.db
      .query("salePrices")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Filter po trgovini
    if (args.storeId) {
      sales = sales.filter((s) => s.storeId === args.storeId);
    }

    // Filter samo veljavne (za vsak slučaj)
    sales = sales.filter((s) => s.validUntil >= today);

    // Sortiraj po popustu (največji najprej)
    sales.sort((a, b) => b.discountPercentage - a.discountPercentage);

    // Limit
    if (args.limit) {
      sales = sales.slice(0, args.limit);
    }

    return sales;
  },
});

/**
 * Pridobi izdelke na akciji z najboljšimi popusti
 */
export const getBestDeals = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    const limit = args.limit ?? 20;

    // Pridobi vse aktivne akcije
    const sales = await ctx.db
      .query("salePrices")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Filter veljavne in sortiraj po popustu
    const validSales = sales
      .filter((s) => s.validUntil >= today)
      .sort((a, b) => b.discountPercentage - a.discountPercentage)
      .slice(0, limit);

    // Pridobi informacije o trgovinah
    const storeIds = [...new Set(validSales.map((s) => s.storeId))];
    const stores = await Promise.all(storeIds.map((id) => ctx.db.get(id)));
    const storeMap = new Map(stores.filter(Boolean).map((s) => [s!._id, s!]));

    return validSales.map((sale) => ({
      ...sale,
      store: storeMap.get(sale.storeId),
    }));
  },
});

/**
 * Statistika katalogov/akcij
 */
export const getCatalogStats = query({
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];

    const allSales = await ctx.db.query("salePrices").collect();
    const activeSales = allSales.filter(
      (s) => s.isActive && s.validUntil >= today
    );

    // Štej po trgovinah
    const byStore: Record<string, number> = {};
    for (const sale of activeSales) {
      const store = await ctx.db.get(sale.storeId);
      if (store) {
        byStore[store.name] = (byStore[store.name] || 0) + 1;
      }
    }

    // Povprečen popust
    const avgDiscount =
      activeSales.length > 0
        ? activeSales.reduce((sum, s) => sum + s.discountPercentage, 0) /
          activeSales.length
        : 0;

    // Najboljši popust
    const bestDeal = activeSales.sort(
      (a, b) => b.discountPercentage - a.discountPercentage
    )[0];

    return {
      totalActiveSales: activeSales.length,
      totalAllSales: allSales.length,
      byStore,
      avgDiscount: Math.round(avgDiscount),
      bestDiscount: bestDeal?.discountPercentage ?? 0,
      bestDealProduct: bestDeal?.productName ?? null,
    };
  },
});

/**
 * Uvozi akcije iz katalogov (za ročni uvoz ali API)
 */
export const importCatalogSales = mutation({
  args: {
    sales: v.array(
      v.object({
        productName: v.string(),
        storeName: v.string(),
        originalPrice: v.number(),
        salePrice: v.number(),
        discountPercentage: v.optional(v.number()),
        validFrom: v.string(),
        validUntil: v.string(),
        catalogSource: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const sale of args.sales) {
      // Najdi trgovino
      const store = await ctx.db
        .query("stores")
        .filter((q) =>
          q.eq(q.field("name"), sale.storeName)
        )
        .first();

      if (!store) {
        console.warn(`Store not found: ${sale.storeName}`);
        skipped++;
        continue;
      }

      // Izračunaj popust če ni podan
      const discountPercentage =
        sale.discountPercentage ??
        Math.round(
          ((sale.originalPrice - sale.salePrice) / sale.originalPrice) * 100
        );

      // Preveri če že obstaja
      const existing = await ctx.db
        .query("salePrices")
        .withIndex("by_product_name", (q) =>
          q.eq("productName", sale.productName)
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("storeId"), store._id),
            q.eq(q.field("validUntil"), sale.validUntil)
          )
        )
        .first();

      const isActive = new Date(sale.validUntil) >= new Date();

      if (existing) {
        // Posodobi obstoječo akcijo
        await ctx.db.patch(existing._id, {
          originalPrice: sale.originalPrice,
          salePrice: sale.salePrice,
          discountPercentage,
          validFrom: sale.validFrom,
          catalogSource: sale.catalogSource,
          isActive,
          scrapedAt: Date.now(),
        });
        updated++;
      } else {
        // Vstavi novo akcijo
        await ctx.db.insert("salePrices", {
          productName: sale.productName,
          productId: undefined,
          storeId: store._id,
          originalPrice: sale.originalPrice,
          salePrice: sale.salePrice,
          discountPercentage,
          validFrom: sale.validFrom,
          validUntil: sale.validUntil,
          catalogSource: sale.catalogSource,
          scrapedAt: Date.now(),
          isActive,
        });
        inserted++;
      }
    }

    return { inserted, updated, skipped };
  },
});
