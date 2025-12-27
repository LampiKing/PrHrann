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

      // ========== JAGER - Samo Premium kuponi ==========
      if (storeName.includes("jager")) {
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "JAGER10",
          description: "10% popust na celoten nakup (Premium)",
          couponType: "percentage_total",
          discountValue: 10,
          minPurchase: 20,
          validUntil: now + oneMonth,
          excludeSaleItems: false,
          requiresLoyaltyCard: true, // Zahteva Jager kartico
          canCombine: false,
          isPremiumOnly: true,
        });

        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "JAGER15",
          description: "15% popust na en izdelek (Premium)",
          couponType: "percentage_single_item",
          discountValue: 15,
          validUntil: now + oneMonth,
          excludeSaleItems: false,
          requiresLoyaltyCard: true,
          canCombine: false,
          isPremiumOnly: true,
        });

        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "JAGERVIKEND",
          description: "20% popust na celoten nakup (vikend, Premium)",
          couponType: "percentage_total",
          discountValue: 20,
          minPurchase: 40,
          validDays: [5, 6, 0], // Petek, Sobota, Nedelja
          validUntil: now + oneMonth,
          excludeSaleItems: false,
          requiresLoyaltyCard: true,
          canCombine: false,
          isPremiumOnly: true,
        });
      }

      // ========== LIDL - Samo Premium kuponi ==========
      if (storeName.includes("lidl")) {
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "LIDL10",
          description: "10% popust na celoten nakup (Premium)",
          couponType: "percentage_total",
          discountValue: 10,
          minPurchase: 25,
          validUntil: now + oneMonth,
          excludeSaleItems: false,
          requiresLoyaltyCard: true, // Zahteva Lidl Plus
          canCombine: false,
          isPremiumOnly: true,
        });

        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "LIDL20",
          description: "20% popust na en izdelek (Premium)",
          couponType: "percentage_single_item",
          discountValue: 20,
          validUntil: now + oneMonth,
          excludeSaleItems: false,
          requiresLoyaltyCard: true,
          canCombine: false,
          isPremiumOnly: true,
        });

        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "LIDLPONEDELJEK",
          description: "15% popust na celoten nakup (ponedeljek, Premium)",
          couponType: "percentage_total",
          discountValue: 15,
          minPurchase: 30,
          validDays: [1], // Ponedeljek
          validUntil: now + oneMonth,
          excludeSaleItems: false,
          requiresLoyaltyCard: true,
          canCombine: false,
          isPremiumOnly: true,
        });
      }

      // ========== HOFER - Brez kuponov (nima programa zvestobe) ==========
      // Hofer nima programa zvestobe, zato ni kuponov
    }

    return null;
  },
});
