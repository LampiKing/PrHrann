import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Tip za rezultat izračuna kupona
interface CouponCalculation {
  couponId: Id<"coupons">;
  code: string;
  description: string;
  couponType: "percentage_total" | "percentage_single_item" | "fixed" | "category_discount";
  discountValue: number;
  savings: number;
  appliedTo: string; // Opis kam se je uporabil
  conditionMet: boolean;
  conditionDescription: string;
  requiresLoyaltyCard: boolean;
}

// Helper za pridobitev tipa kupona (podpira legacy in nove kupone)
function getCouponType(coupon: {
  couponType?: "percentage_total" | "percentage_single_item" | "fixed" | "category_discount";
  discountType?: string;
}): "percentage_total" | "percentage_single_item" | "fixed" | "category_discount" {
  // Validate coupon object
  if (!coupon || (typeof coupon !== 'object')) {
    return "percentage_total"; // Safe default
  }

  if (coupon.couponType) return coupon.couponType;
  // Legacy support
  if (coupon.discountType === "percentage") return "percentage_total";
  if (coupon.discountType === "fixed") return "fixed";
  return "percentage_total"; // Default
}

// Helper function for calculating stacked coupons (can be called from other modules)
export async function calculateStackedCouponsHelper(
  ctx: any,
  args: {
    storeId: Id<"stores">;
    items: Array<{
      productId: Id<"products">;
      productName: string;
      category: string;
      price: number;
      quantity: number;
      isOnSale: boolean;
    }>;
    isPremium: boolean;
    hasLoyaltyCard: boolean;
  }
): Promise<{
  stackedCoupons: Array<{
    couponId: Id<"coupons">;
    code: string;
    description: string;
    couponType: "percentage_total" | "percentage_single_item" | "fixed" | "category_discount";
    discountValue: number;
    savings: number;
    appliedTo: string;
  }>;
  totalSavings: number;
  originalTotal: number;
  finalTotal: number;
  stackingStrategy: string;
} | null> {
  // Only available for premium users
  if (!args.isPremium) return null;
  if (args.items.length === 0) return null;

  const coupons = await ctx.db
    .query("coupons")
    .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
    .collect();

  const now = Date.now();
  const currentDay = new Date().getDay();

  // Filter valid combinable coupons
  const validCoupons = coupons.filter((c: any) => {
    if (c.validUntil < now) return false;
    if (c.validFrom && c.validFrom > now) return false;
    if (c.validDays && c.validDays.length > 0 && !c.validDays.includes(currentDay)) return false;
    if (c.isPremiumOnly && !args.isPremium) return false;
    if (c.isActive === false) return false;
    if (c.requiresLoyaltyCard && !args.hasLoyaltyCard) return false;
    if (!c.canCombine) return false; // Only combinable coupons
    return true;
  });

  if (validCoupons.length === 0) return null;

  const originalTotal = args.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Calculate best stacking strategy
  const categoryCoupons: any[] = [];
  const itemCoupons: any[] = [];
  const totalCoupons: any[] = [];

  for (const coupon of validCoupons) {
    const couponType = getCouponType(coupon);
    if (coupon.minPurchase && originalTotal < coupon.minPurchase) continue;

    if (couponType === "category_discount") categoryCoupons.push(coupon);
    else if (couponType === "percentage_single_item") itemCoupons.push(coupon);
    else totalCoupons.push(coupon);
  }

  const appliedCoupons: any[] = [];
  let runningTotal = originalTotal;
  let runningItems = [...args.items];

  // 1. Apply category discounts first (most specific)
  for (const coupon of categoryCoupons) {
    const excludeSaleItems = coupon.excludeSaleItems ?? false;
    let eligibleItems = runningItems;
    if (excludeSaleItems) {
      eligibleItems = runningItems.filter(item => !item.isOnSale);
    }

    if (!coupon.applicableCategories || coupon.applicableCategories.length === 0) continue;
    const categoryItems = eligibleItems.filter(item =>
      coupon.applicableCategories!.includes(item.category)
    );
    if (categoryItems.length === 0) continue;

    const categoryTotal = categoryItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const savings = categoryTotal * (coupon.discountValue / 100);

    appliedCoupons.push({
      couponId: coupon._id,
      code: coupon.code,
      description: coupon.description,
      couponType: getCouponType(coupon),
      discountValue: coupon.discountValue,
      savings: Math.round(savings * 100) / 100,
      appliedTo: `kategorija: ${coupon.applicableCategories.join(", ")}`,
    });

    runningTotal -= savings;
  }

  // 2. Apply single item discounts (medium specificity)
  for (const coupon of itemCoupons) {
    const excludeSaleItems = coupon.excludeSaleItems ?? false;
    let eligibleItems = runningItems;
    if (excludeSaleItems) {
      eligibleItems = runningItems.filter(item => !item.isOnSale);
    }

    if (eligibleItems.length === 0) continue;

    const sortedItems = [...eligibleItems].sort((a, b) => b.price - a.price);
    const bestItem = sortedItems[0];
    const savings = bestItem.price * (coupon.discountValue / 100);

    appliedCoupons.push({
      couponId: coupon._id,
      code: coupon.code,
      description: coupon.description,
      couponType: getCouponType(coupon),
      discountValue: coupon.discountValue,
      savings: Math.round(savings * 100) / 100,
      appliedTo: bestItem.productName,
    });

    runningTotal -= savings;
  }

  // 3. Apply total discounts last (least specific)
  for (const coupon of totalCoupons) {
    const excludeSaleItems = coupon.excludeSaleItems ?? false;
    let eligibleItems = runningItems;
    if (excludeSaleItems) {
      eligibleItems = runningItems.filter(item => !item.isOnSale);
    }

    const couponType = getCouponType(coupon);
    let savings = 0;

    if (couponType === "percentage_total") {
      const eligibleTotal = eligibleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      savings = eligibleTotal * (coupon.discountValue / 100);
    } else if (couponType === "fixed") {
      savings = Math.min(coupon.discountValue, runningTotal);
    }

    if (savings > 0) {
      appliedCoupons.push({
        couponId: coupon._id,
        code: coupon.code,
        description: coupon.description,
        couponType,
        discountValue: coupon.discountValue,
        savings: Math.round(savings * 100) / 100,
        appliedTo: "celoten nakup",
      });

      runningTotal -= savings;
    }
  }

  if (appliedCoupons.length === 0) return null;

  const totalSavings = appliedCoupons.reduce((sum, c) => sum + c.savings, 0);

  return {
    stackedCoupons: appliedCoupons,
    totalSavings: Math.round(totalSavings * 100) / 100,
    originalTotal: Math.round(originalTotal * 100) / 100,
    finalTotal: Math.round((originalTotal - totalSavings) * 100) / 100,
    stackingStrategy: `Uporabljeno ${appliedCoupons.length} kuponov: ${appliedCoupons.map(c => c.code).join(", ")}`,
  };
}

// Pridobi vse aktivne kupone za trgovino
export const getByStore = query({
  args: { 
    storeId: v.id("stores"),
    isPremium: v.boolean(),
  },
  returns: v.array(
    v.object({
      _id: v.id("coupons"),
      _creationTime: v.number(),
      storeId: v.id("stores"),
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
      validFrom: v.optional(v.number()),
      validUntil: v.number(),
      excludeSaleItems: v.boolean(),
      requiresLoyaltyCard: v.boolean(),
      canCombine: v.boolean(),
      applicableCategories: v.optional(v.array(v.string())),
      isPremiumOnly: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const coupons = await ctx.db
      .query("coupons")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect();

    const now = Date.now();
    const currentDay = new Date().getDay();

    return coupons
      .filter((c) => {
        // Preveri veljavnost
        if (c.validUntil < now) return false;
        if (c.validFrom && c.validFrom > now) return false;
        // Preveri dan v tednu
        if (c.validDays && c.validDays.length > 0 && !c.validDays.includes(currentDay)) return false;
        // Preveri premium
        if (c.isPremiumOnly && !args.isPremium) return false;
        // Preveri ali je aktiven
        if (c.isActive === false) return false;
        return true;
      })
      .map((c) => ({
        _id: c._id,
        _creationTime: c._creationTime,
        storeId: c.storeId,
        code: c.code,
        description: c.description,
        couponType: getCouponType(c),
        discountValue: c.discountValue,
        minPurchase: c.minPurchase,
        validDays: c.validDays,
        validFrom: c.validFrom,
        validUntil: c.validUntil,
        excludeSaleItems: c.excludeSaleItems ?? false,
        requiresLoyaltyCard: c.requiresLoyaltyCard ?? false,
        canCombine: c.canCombine ?? false,
        applicableCategories: c.applicableCategories,
        maxUsesPerUser: c.maxUsesPerUser,
        additionalNotes: c.additionalNotes,
        isPremiumOnly: c.isPremiumOnly,
      }));
  },
});

// Izračunaj najboljši kupon za košarico - GLAVNI ALGORITEM
export const calculateBestCoupon = query({
  args: {
    storeId: v.id("stores"),
    items: v.array(v.object({
      productId: v.id("products"),
      productName: v.string(),
      category: v.string(),
      price: v.number(),
      quantity: v.number(),
      isOnSale: v.boolean(),
    })),
    isPremium: v.boolean(),
    hasLoyaltyCard: v.boolean(),
  },
  returns: v.union(
    v.object({
      bestCoupon: v.object({
        couponId: v.id("coupons"),
        code: v.string(),
        description: v.string(),
        couponType: v.union(
          v.literal("percentage_total"),
          v.literal("percentage_single_item"),
          v.literal("fixed"),
          v.literal("category_discount")
        ),
        discountValue: v.number(),
        savings: v.number(),
        appliedTo: v.string(),
        conditionMet: v.boolean(),
        conditionDescription: v.string(),
        requiresLoyaltyCard: v.boolean(),
      }),
      alternativeCoupons: v.array(v.object({
        code: v.string(),
        description: v.string(),
        potentialSavings: v.number(),
        reason: v.string(),
      })),
      originalTotal: v.number(),
      finalTotal: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    if (args.items.length === 0) return null;

    const coupons = await ctx.db
      .query("coupons")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect();

    const now = Date.now();
    const currentDay = new Date().getDay();

    // Filtriraj veljavne kupone
    const validCoupons = coupons.filter((c) => {
      if (c.validUntil < now) return false;
      if (c.validFrom && c.validFrom > now) return false;
      if (c.validDays && c.validDays.length > 0 && !c.validDays.includes(currentDay)) return false;
      if (c.isPremiumOnly && !args.isPremium) return false;
      if (c.isActive === false) return false; // Preveri aktivnost
      const requiresLoyalty = c.requiresLoyaltyCard ?? false;
      if (requiresLoyalty && !args.hasLoyaltyCard) return false;
      return true;
    });

    if (validCoupons.length === 0) return null;

    // Izračunaj skupno vrednost
    const originalTotal = args.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Izračunaj prihranek za vsak kupon
    const calculations: CouponCalculation[] = [];

    for (const coupon of validCoupons) {
      let savings = 0;
      let appliedTo = "";
      let conditionMet = true;
      let conditionDescription = "";

      const couponType = getCouponType(coupon);
      const excludeSaleItems = coupon.excludeSaleItems ?? false;
      const requiresLoyaltyCard = coupon.requiresLoyaltyCard ?? false;

      // Preveri minimalni znesek
      if (coupon.minPurchase && originalTotal < coupon.minPurchase) {
        conditionMet = false;
        conditionDescription = `Minimalni znesek ${coupon.minPurchase.toFixed(2)}€ ni dosežen`;
        calculations.push({
          couponId: coupon._id,
          code: coupon.code,
          description: coupon.description,
          couponType,
          discountValue: coupon.discountValue,
          savings: 0,
          appliedTo: "",
          conditionMet,
          conditionDescription,
          requiresLoyaltyCard,
        });
        continue;
      }

      // Filtriraj izdelke glede na omejitve
      let eligibleItems = args.items;
      if (excludeSaleItems) {
        eligibleItems = args.items.filter(item => !item.isOnSale);
      }

      switch (couponType) {
        case "percentage_total": {
          // Odstotek na celoten nakup
          const eligibleTotal = eligibleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
          savings = eligibleTotal * (coupon.discountValue / 100);
          appliedTo = "celoten nakup";
          conditionDescription = coupon.minPurchase 
            ? `Nakup nad ${coupon.minPurchase.toFixed(2)}€ ✓`
            : "Brez minimalnega zneska";
          break;
        }

        case "percentage_single_item": {
          // Odstotek na en izdelek - izberi najdražjega
          if (eligibleItems.length === 0) {
            conditionMet = false;
            conditionDescription = "Ni primernih izdelkov (vsi so na akciji)";
            break;
          }
          const sortedItems = [...eligibleItems].sort((a, b) => b.price - a.price);
          const bestItem = sortedItems[0];
          savings = bestItem.price * (coupon.discountValue / 100);
          appliedTo = bestItem.productName;
          conditionDescription = `Uporabljen na najdražji izdelek`;
          break;
        }

        case "fixed": {
          // Fiksni popust
          savings = Math.min(coupon.discountValue, originalTotal);
          appliedTo = "celoten nakup";
          conditionDescription = coupon.minPurchase 
            ? `Nakup nad ${coupon.minPurchase.toFixed(2)}€ ✓`
            : "Brez minimalnega zneska";
          break;
        }

        case "category_discount": {
          // Popust na kategorijo
          if (!coupon.applicableCategories || coupon.applicableCategories.length === 0) break;
          const categoryItems = eligibleItems.filter(item => 
            coupon.applicableCategories!.includes(item.category)
          );
          if (categoryItems.length === 0) {
            conditionMet = false;
            conditionDescription = "Ni izdelkov iz ustrezne kategorije";
            break;
          }
          const categoryTotal = categoryItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
          savings = categoryTotal * (coupon.discountValue / 100);
          appliedTo = `kategorija: ${coupon.applicableCategories.join(", ")}`;
          conditionDescription = `${categoryItems.length} izdelkov v kategoriji`;
          break;
        }
      }

      calculations.push({
        couponId: coupon._id,
        code: coupon.code,
        description: coupon.description,
        couponType,
        discountValue: coupon.discountValue,
        savings: Math.round(savings * 100) / 100,
        appliedTo,
        conditionMet,
        conditionDescription,
        requiresLoyaltyCard,
      });
    }

    // Filtriraj samo tiste, ki izpolnjujejo pogoje
    const validCalculations = calculations.filter(c => c.conditionMet && c.savings > 0);
    
    if (validCalculations.length === 0) {
      // Vrni informacije o alternativah
      const alternatives = calculations
        .filter(c => !c.conditionMet)
        .map(c => ({
          code: c.code,
          description: c.description,
          potentialSavings: c.discountValue,
          reason: c.conditionDescription,
        }));

      if (alternatives.length === 0) return null;

      return null; // Ni veljavnih kuponov
    }

    // Razvrsti po prihranku
    validCalculations.sort((a, b) => b.savings - a.savings);
    const best = validCalculations[0];

    // Pripravi alternative
    const alternatives = validCalculations.slice(1, 4).map(c => ({
      code: c.code,
      description: c.description,
      potentialSavings: c.savings,
      reason: `Prihranek: ${c.savings.toFixed(2)}€`,
    }));

    // Dodaj tudi neveljavne kot potencialne
    const invalidAlternatives = calculations
      .filter(c => !c.conditionMet)
      .slice(0, 2)
      .map(c => ({
        code: c.code,
        description: c.description,
        potentialSavings: 0,
        reason: c.conditionDescription,
      }));

    return {
      bestCoupon: best,
      alternativeCoupons: [...alternatives, ...invalidAlternatives].slice(0, 3),
      originalTotal: Math.round(originalTotal * 100) / 100,
      finalTotal: Math.round((originalTotal - best.savings) * 100) / 100,
    };
  },
});

// PREMIUM FEATURE: Stack multiple compatible coupons (internal only)
export const calculateStackedCoupons = query({
  args: {
    storeId: v.id("stores"),
    items: v.array(v.object({
      productId: v.id("products"),
      productName: v.string(),
      category: v.string(),
      price: v.number(),
      quantity: v.number(),
      isOnSale: v.boolean(),
    })),
    isPremium: v.boolean(),
    hasLoyaltyCard: v.boolean(),
  },
  returns: v.union(
    v.object({
      stackedCoupons: v.array(v.object({
        couponId: v.id("coupons"),
        code: v.string(),
        description: v.string(),
        couponType: v.union(
          v.literal("percentage_total"),
          v.literal("percentage_single_item"),
          v.literal("fixed"),
          v.literal("category_discount")
        ),
        discountValue: v.number(),
        savings: v.number(),
        appliedTo: v.string(),
      })),
      totalSavings: v.number(),
      originalTotal: v.number(),
      finalTotal: v.number(),
      stackingStrategy: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await calculateStackedCouponsHelper(ctx, args);
  },
});

// Dodaj vzorčne kupone za vse trgovine
export const seedCoupons = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Počisti obstoječe kupone
    const existingCoupons = await ctx.db.query("coupons").collect();
    for (const coupon of existingCoupons) {
      await ctx.db.delete(coupon._id);
    }

    const stores = await ctx.db.query("stores").collect();
    if (stores.length === 0) return null;

    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const store of stores) {
      const storeName = store.name.toLowerCase();

      // ========== SPAR - Brezplačni kuponi ==========
      if (storeName.includes("spar") || storeName === "špar") {
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "SPAR10",
          description: "10% popust na celoten nakup",
          couponType: "percentage_total",
          discountValue: 10,
          minPurchase: 30,
          validDays: [4, 5, 6, 0], // Četrtek - Nedelja
          validUntil: now + oneMonth,
          excludeSaleItems: true,
          requiresLoyaltyCard: false,
          canCombine: false,
          isPremiumOnly: false,
        });

        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "SPAR25",
          description: "25% popust na en izdelek",
          couponType: "percentage_single_item",
          discountValue: 25,
          validUntil: now + oneMonth,
          excludeSaleItems: true,
          requiresLoyaltyCard: false,
          canCombine: false,
          isPremiumOnly: false,
        });

        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "SPAR15VIP",
          description: "15% popust na celoten nakup (Premium)",
          couponType: "percentage_total",
          discountValue: 15,
          minPurchase: 25,
          validUntil: now + oneMonth,
          excludeSaleItems: false,
          requiresLoyaltyCard: false,
          canCombine: false,
          isPremiumOnly: true,
        });
      }

      // ========== MERCATOR - Brezplačni kuponi (zahteva Pika kartico) ==========
      if (storeName.includes("mercator")) {
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "MERC10",
          description: "10% popust na celoten nakup (s Pika kartico)",
          couponType: "percentage_total",
          discountValue: 10,
          minPurchase: 30,
          validUntil: now + oneMonth,
          excludeSaleItems: false,
          requiresLoyaltyCard: true,
          canCombine: false,
          isPremiumOnly: false,
        });

        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "MERC25",
          description: "25% popust na en izdelek (s Pika kartico)",
          couponType: "percentage_single_item",
          discountValue: 25,
          validUntil: now + oneMonth,
          excludeSaleItems: false,
          requiresLoyaltyCard: true,
          canCombine: false,
          isPremiumOnly: false,
        });

        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "MERCVIKEND",
          description: "20% popust na en izdelek (vikend)",
          couponType: "percentage_single_item",
          discountValue: 20,
          validDays: [5, 6], // Petek, Sobota
          validUntil: now + oneMonth,
          excludeSaleItems: false,
          requiresLoyaltyCard: true,
          canCombine: false,
          isPremiumOnly: false,
        });
      }

      // ========== TUŠ - Brezplačni kuponi ==========
      if (storeName.includes("tuš") || storeName === "tus") {
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "TUS10",
          description: "10% popust na celoten nakup",
          couponType: "percentage_total",
          discountValue: 10,
          minPurchase: 25,
          validUntil: now + oneMonth,
          excludeSaleItems: true,
          requiresLoyaltyCard: false,
          canCombine: false,
          isPremiumOnly: false,
        });

        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "TUSSREDA",
          description: "15% popust na celoten nakup (sreda)",
          couponType: "percentage_total",
          discountValue: 15,
          minPurchase: 30,
          validDays: [3], // Sreda
          validUntil: now + oneMonth,
          excludeSaleItems: true,
          requiresLoyaltyCard: false,
          canCombine: false,
          isPremiumOnly: false,
        });

        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "TUS20VIP",
          description: "20% popust na en izdelek (Premium)",
          couponType: "percentage_single_item",
          discountValue: 20,
          validUntil: now + oneMonth,
          excludeSaleItems: false,
          requiresLoyaltyCard: false,
          canCombine: false,
          isPremiumOnly: true,
        });
      }

    }

    return null;
  },
});
