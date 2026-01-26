import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ============ UPOKOJENEC DETECTION ============
const RETIREMENT_AGE = 65; // Slovenija standard

/**
 * Izračuna starost iz datuma rojstva
 */
function calculateAge(birthDate: { day: number; month: number; year: number }): number {
  const today = new Date();
  const birth = new Date(birthDate.year, birthDate.month - 1, birthDate.day);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

/**
 * Ali je uporabnik upokojenec (65+ let)
 */
function isPensioner(birthDate?: { day: number; month: number; year: number }): boolean {
  if (!birthDate) return false;
  return calculateAge(birthDate) >= RETIREMENT_AGE;
}

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

const isBlockedCouponCode = (code?: string) => {
  if (typeof code !== "string") return false;
  const upper = code.trim().toUpperCase();
  // Blokiraj znane izmišljene/promo kode, ki niso od trgovin
  if (upper === "PREMIUM15") return true;
  if (/^PREMIUM/.test(upper)) return true;
  return false;
};

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
    if (isBlockedCouponCode(c.code)) return false;
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
        if (isBlockedCouponCode(c.code)) return false;
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
      if (isBlockedCouponCode(c.code)) return false;
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

// ============ PAMETNO PRIPOROČANJE KUPONOV ============
// Predlaga prave kupone glede na profil uporabnika (upokojenec, kartica zvestobe, dan)
export const getRecommendedCoupons = query({
  args: {
    storeId: v.id("stores"),
    userId: v.optional(v.string()),
    // Če ni userId, lahko direktno pošlješ podatke
    birthDate: v.optional(v.object({
      day: v.number(),
      month: v.number(),
      year: v.number(),
    })),
    hasLoyaltyCard: v.boolean(),
    cartTotal: v.optional(v.number()), // Vrednost košarice
  },
  returns: v.object({
    todayCoupons: v.array(v.object({
      _id: v.id("coupons"),
      code: v.string(),
      description: v.string(),
      discountValue: v.number(),
      isRecommended: v.boolean(),
      recommendReason: v.optional(v.string()),
      requiresLoyaltyCard: v.boolean(),
      minPurchase: v.optional(v.number()),
      meetsMinPurchase: v.boolean(),
    })),
    userIsPensioner: v.boolean(),
    currentDay: v.string(),
    pensionerCouponAvailable: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = new Date();
    const currentDay = now.getDay(); // 0=nedelja, 1=ponedeljek, ...
    const dayNames = ["nedelja", "ponedeljek", "torek", "sreda", "četrtek", "petek", "sobota"];

    // Pridobi birthDate iz profila če je userId dan
    let birthDate = args.birthDate;
    if (args.userId && !birthDate) {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", args.userId!))
        .first();
      if (profile?.birthDate) {
        birthDate = profile.birthDate;
      }
    }

    const userIsPensioner = isPensioner(birthDate);
    const cartTotal = args.cartTotal || 0;

    // Pridobi kupone za to trgovino
    const coupons = await ctx.db
      .query("coupons")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect();

    const nowMs = Date.now();

    // Filtriraj veljavne kupone za danes
    const todayCoupons = coupons
      .filter((c) => {
        if (c.validUntil < nowMs) return false;
        if (c.validFrom && c.validFrom > nowMs) return false;
        if (c.validDays && c.validDays.length > 0 && !c.validDays.includes(currentDay)) return false;
        if (c.isActive === false) return false;
        return true;
      })
      .map((c) => {
        let isRecommended = false;
        let recommendReason: string | undefined;
        const meetsMinPurchase = !c.minPurchase || cartTotal >= c.minPurchase;

        // Priporoči kupon za upokojence če je uporabnik upokojenec
        if (c.code.includes("UPOK") || c.description.toLowerCase().includes("upokojen")) {
          if (userIsPensioner) {
            isRecommended = true;
            recommendReason = "Ste upokojenec - ta kupon je za vas!";
          }
        }
        // Priporoči 10% kupon če je dovolj velika košarica
        else if (c.couponType === "percentage_total" && c.minPurchase && cartTotal >= c.minPurchase) {
          isRecommended = true;
          recommendReason = `Vaš nakup (${cartTotal.toFixed(2)}€) presega minimum (${c.minPurchase}€)`;
        }
        // Priporoči 25%/30% kupon za en izdelek
        else if (c.couponType === "percentage_single_item" && c.discountValue >= 25) {
          isRecommended = true;
          recommendReason = "Uporabite na najdražji izdelek za največji prihranek!";
        }

        // Preveri ali uporabnik ima kartico
        if (c.requiresLoyaltyCard && !args.hasLoyaltyCard) {
          isRecommended = false;
          recommendReason = "Potrebna kartica zvestobe";
        }

        return {
          _id: c._id,
          code: c.code,
          description: c.description,
          discountValue: c.discountValue,
          isRecommended,
          recommendReason,
          requiresLoyaltyCard: c.requiresLoyaltyCard ?? false,
          minPurchase: c.minPurchase,
          meetsMinPurchase,
        };
      })
      // Razvrsti: najprej priporočeni, potem po popustu
      .sort((a, b) => {
        if (a.isRecommended && !b.isRecommended) return -1;
        if (!a.isRecommended && b.isRecommended) return 1;
        return b.discountValue - a.discountValue;
      });

    // Ali je danes na voljo kupon za upokojence?
    const pensionerCouponAvailable = coupons.some(
      (c) =>
        (c.code.includes("UPOK") || c.description.toLowerCase().includes("upokojen")) &&
        c.validDays?.includes(currentDay)
    );

    return {
      todayCoupons,
      userIsPensioner,
      currentDay: dayNames[currentDay],
      pensionerCouponAvailable,
    };
  },
});

// Dodaj vzorčne kupone za vse trgovine - AKTUALNI KUPONI
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

    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const store of stores) {
      const storeName = store.name.toLowerCase();

      // ========== SPAR - Kuponi in akcije vsak dan ==========
      // Vir: https://www.spar.si/promocije-in-projekti/aktualne-promocije
      if (storeName.includes("spar") || storeName === "špar") {
        // Ponedeljek & Torek: 25% na en izdelek po izbiri
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "SPAR25",
          description: "25% popust na en izdelek po vaši izbiri",
          couponType: "percentage_single_item",
          discountValue: 25,
          validDays: [1, 2], // Ponedeljek, Torek
          validUntil: now + oneWeek,
          excludeSaleItems: true, // Pri akcijskih se 25% odšteje od REDNE cene, NE od akcijske
          requiresLoyaltyCard: true, // Potrebna SPAR plus kartica
          canCombine: false,
          isPremiumOnly: false,
          maxUsesPerUser: 1, // Enkratna uporaba
          excludedProducts: [
            "tobak", "časopisi", "revije", "vinjete", "PAYSAFE", "Tchibo",
            "knjige (<6 mes)", "SIM kartice", "peleti", "darilne kartice",
            "Zvezdar", "Selectbox", "igre na srečo", "alkohol (razen pivo)",
            "peneča vina", "koktejli", "race", "gosi", "sušeni pršuti s kostjo",
            "Sodastream", "Urbana", "suši", "Joker Out puloverji"
          ],
          additionalNotes: "SPAR plus kartica obvezna. NE velja za: Noro znižanje, Gratis, Več je ceneje, Trajno znižano, Znižano, Točke zvestobe. Pri akcijskih izdelkih se 25% odšteje od REDNE cene. Max 5kg mesa ali 10kg sadje/zelenjave.",
        });

        // Sreda: 30% na en NEŽIVILSKI izdelek
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "SPAR30NF",
          description: "30% popust na en NEŽIVILSKI izdelek po vaši izbiri",
          couponType: "percentage_single_item",
          discountValue: 30,
          validDays: [3], // Sreda
          validUntil: now + oneWeek,
          excludeSaleItems: true, // Pri akcijskih se 30% odšteje od REDNE cene
          requiresLoyaltyCard: true, // Potrebna SPAR plus kartica
          canCombine: false,
          isPremiumOnly: false,
          maxUsesPerUser: 1,
          additionalNotes: "Samo NEŽIVILSKI izdelki (kozmetika, čistila, gospodinjstvo). Potrebna SPAR plus kartica.",
          applicableCategories: ["Neživila", "Kozmetika", "Čistila", "Gospodinjstvo", "Higiena"],
        });

        // Sreda: 10% za upokojence na celoten nakup
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "SPAR10UPOK",
          description: "10% popust za upokojence na celoten nakup",
          couponType: "percentage_total",
          discountValue: 10,
          minPurchase: 20, // Nakup nad 20 EUR
          validDays: [3], // Sreda
          validUntil: now + oneWeek,
          excludeSaleItems: false, // Velja tudi za akcijske
          requiresLoyaltyCard: true, // SPAR plus z urejenim statusom upokojenca
          canCombine: false,
          isPremiumOnly: false,
          additionalNotes: "Samo za upokojence s SPAR plus kartico z urejenim statusom. Min. nakup 20€. Max osnova 500€.",
        });

        // Sreda: 20% za upokojence na SPAR TO GO jedi
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "SPAR20TOGO",
          description: "20% popust na vse jedi SPAR TO GO (upokojenci)",
          couponType: "category_discount",
          discountValue: 20,
          validDays: [3, 4, 5, 6, 0, 1, 2], // Velja cel teden po prejemu
          validUntil: now + oneWeek,
          excludeSaleItems: false,
          requiresLoyaltyCard: true,
          canCombine: false,
          isPremiumOnly: false,
          additionalNotes: "Kupon prejmete v sredo, velja do naslednje srede. Samo Interspar in izbrani Spar.",
          applicableCategories: ["SPAR TO GO", "Pripravljene jedi"],
        });

        // Petek & Sobota: 10% na celoten nakup nad 30€
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "SPAR10",
          description: "10% popust na celoten nakup nad 30€",
          couponType: "percentage_total",
          discountValue: 10,
          minPurchase: 30, // Nakup nad 30 EUR
          validDays: [5, 6], // Petek, Sobota
          validUntil: now + oneWeek,
          excludeSaleItems: false, // VELJA tudi za izdelke v akciji!
          requiresLoyaltyCard: true, // Potrebna SPAR plus kartica
          canCombine: false,
          isPremiumOnly: false,
          additionalNotes: "Potrebna SPAR plus kartica. Min. nakup 30€. Velja TUDI za akcijske izdelke. Max osnova 500€.",
        });

        // Torek: Ribji torek - 20% na sveže in zamrznjene ribe
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "RIBJITOREK",
          description: "20% popust na sveže in zamrznjene ribe ter morske sadeže",
          couponType: "category_discount",
          discountValue: 20,
          validDays: [2], // Torek
          validUntil: now + oneWeek,
          excludeSaleItems: false,
          requiresLoyaltyCard: false,
          canCombine: false,
          isPremiumOnly: false,
          additionalNotes: "Velja za sveže ter zamrznjene postrežne ribe ter morske sadeže.",
          applicableCategories: ["Ribe", "Morski sadeži", "Zamrznjene ribe"],
        });

      }

      // ========== MERCATOR - Pika kartica kuponi ==========
      // Vir: https://www.mercator.si/akcije-in-ugodnosti/
      // Velja SAMO v fizičnih prodajalnah (živilske + franšizne), NE v spletni trgovini!
      if (storeName.includes("mercator")) {
        // Vikend: 25% popust na en izbrani izdelek
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "MERC25",
          description: "25% popust na en izbrani izdelek (vikend)",
          couponType: "percentage_single_item",
          discountValue: 25,
          minPurchase: 5, // Preostanek košarice mora biti nad 5€
          validDays: [5, 6], // Petek, Sobota
          validUntil: now + oneWeek,
          excludeSaleItems: false, // Lahko tudi akcijski izdelek
          requiresLoyaltyCard: true, // Pika kartica obvezna
          canCombine: false, // NE kombinira z 10% kuponom
          isPremiumOnly: false,
          maxUsesPerUser: 1,
          excludedProducts: [
            "tobak", "tobačni izdelki", "e-cigarete",
            "časopisi", "revije", "knjige", "alkoholne pijače",
            "darilne kartice", "položnice", "storitve", "vinjete",
            "polnitve za telefone", "SIM kartice", "igre na srečo"
          ],
          additionalNotes: "Pika kartica obvezna. Preostanek košarice mora biti nad 5€. NE kombinira z 10% kuponom - izbereš enega! Velja SAMO v fizičnih prodajalnah, NE v spletni trgovini.",
        });

        // Vikend: 10% popust na celoten nakup nad 30€
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "MERC10",
          description: "10% popust na celoten nakup nad 30€ (vikend)",
          couponType: "percentage_total",
          discountValue: 10,
          minPurchase: 30, // Minimalni nakup 30€
          validDays: [5, 6], // Petek, Sobota
          validUntil: now + oneWeek,
          excludeSaleItems: false, // VELJA tudi za akcijske izdelke!
          requiresLoyaltyCard: true, // Pika kartica obvezna
          canCombine: false, // NE kombinira z 25% kuponom
          isPremiumOnly: false,
          maxUsesPerUser: 1,
          excludedProducts: [
            "tobak", "tobačni izdelki", "e-cigarete",
            "časopisi", "revije", "knjige", "alkoholne pijače",
            "darilne kartice", "položnice", "storitve", "vinjete",
            "polnitve za telefone", "SIM kartice", "igre na srečo"
          ],
          additionalNotes: "Pika kartica obvezna. Min. nakup 30€. VELJA tudi za akcijske izdelke! NE kombinira z 25% kuponom - izbereš enega! Velja SAMO v fizičnih prodajalnah.",
        });

        // INFORMATIVNO (ne seštevamo):
        // - Super Pika kupon (12% za 300 pik) - uporabnik mora vedeti koliko pik ima
        // - Moja izbira - personalizirani znižani izdelki, ne kupon
      }

      // ========== TUŠ - Tedenski kuponi ==========
      // Vir: Tuš mobilna aplikacija
      // Tuš klub ali Diners Club Tuš kartica obvezna!
      // NE velja v spletnem supermarketu hitrinakup.com!
      if (storeName.includes("tuš") || storeName === "tus") {
        // 25% kupon za en izdelek
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "TUS25",
          description: "25% popust za en kos izdelka po vaši izbiri",
          couponType: "percentage_single_item",
          discountValue: 25,
          validDays: [2], // Torek (primer)
          validUntil: now + oneWeek,
          excludeSaleItems: false, // Pri akcijskih se unovči na REDNO ceno
          requiresLoyaltyCard: true, // Tuš klub ali Diners Club Tuš kartica
          canCombine: false,
          isPremiumOnly: false,
          maxUsesPerUser: 1,
          excludedProducts: [
            "Mojih 10", "STOP PODRAŽITVAM", "10 + 1 gratis", "BUM ponudba",
            "Tuš klub -50%", "ZA KRATEK ČAS", "odprodaja", "super cena",
            "znižano pred iztekom roka", "vina", "peneča vina", "žgane pijače",
            "pivo v steklenici", "pivo v sodih", "časopisi", "revije", "knjige",
            "cigarete", "tobačni izdelki", "SIM kartice", "začetne formule",
            "darilni boni", "položnice", "Zvezdar", "Select Box"
          ],
          additionalNotes: "Tuš klub ali Diners Club Tuš kartica obvezna. Enkratna uporaba (letak/e-obveščanje/aplikacija). Max 5 kg pri tehtanih izdelkih. Opozoriti blagajnika PRED zaključkom računa! Pri akcijskih izdelkih se 25% unovči na REDNO ceno. NE velja v hitrinakup.com.",
        });

        // 20% kupon za en izdelek (vikend)
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "TUS20",
          description: "20% popust za en kos izdelka po vaši izbiri (vikend)",
          couponType: "percentage_single_item",
          discountValue: 20,
          validDays: [5, 6], // Petek, Sobota
          validUntil: now + oneWeek,
          excludeSaleItems: false,
          requiresLoyaltyCard: true,
          canCombine: false,
          isPremiumOnly: false,
          maxUsesPerUser: 1,
          excludedProducts: [
            "Mojih 10", "STOP PODRAŽITVAM", "10 + 1 gratis", "BUM ponudba",
            "Tuš klub -50%", "ZA KRATEK ČAS", "odprodaja", "super cena",
            "vina", "peneča vina", "žgane pijače", "cigarete", "tobačni izdelki",
            "SIM kartice", "darilni boni", "položnice"
          ],
          additionalNotes: "Tuš klub kartica obvezna. Enkratna uporaba. Max 5 kg pri tehtanih izdelkih. Opozoriti blagajnika PRED zaključkom računa!",
        });

        // 15% kupon za en izdelek
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "TUS15",
          description: "15% popust za en kos izdelka po vaši izbiri",
          couponType: "percentage_single_item",
          discountValue: 15,
          validUntil: now + oneWeek,
          excludeSaleItems: false,
          requiresLoyaltyCard: true,
          canCombine: false,
          isPremiumOnly: false,
          maxUsesPerUser: 1,
          excludedProducts: [
            "Mojih 10", "STOP PODRAŽITVAM", "BUM ponudba", "Tuš klub -50%",
            "ZA KRATEK ČAS", "odprodaja", "super cena", "vina", "žgane pijače",
            "cigarete", "tobačni izdelki", "SIM kartice", "darilni boni", "položnice"
          ],
          additionalNotes: "Tuš klub kartica obvezna. Enkratna uporaba. Max 5 kg pri tehtanih izdelkih.",
        });

        // 11% kupon na celoten nakup nad 30€ (D*nar nazaj)
        await ctx.db.insert("coupons", {
          storeId: store._id,
          code: "TUS11",
          description: "11% popust na celoten nakup nad 30€ (D*nar nazaj)",
          couponType: "percentage_total",
          discountValue: 11,
          minPurchase: 30,
          validUntil: now + oneWeek,
          excludeSaleItems: false, // Velja tudi za akcijske
          requiresLoyaltyCard: true,
          canCombine: false,
          isPremiumOnly: false,
          maxUsesPerUser: 1,
          excludedProducts: [
            "Mojih 10", "STOP PODRAŽITVAM", "BUM ponudba", "Tuš klub -50%",
            "ZA KRATEK ČAS", "odprodaja", "super cena", "vina", "žgane pijače",
            "cigarete", "tobačni izdelki", "SIM kartice", "darilni boni", "položnice"
          ],
          additionalNotes: "Tuš klub kartica obvezna. Popust vam v obliki D*narja vrnemo na TK kartico. Nakup nad 30€.",
        });

        // INFORMATIVNO (ne seštevamo):
        // - Mojih 10 - personalizirani znižani izdelki, ne kupon
        // - D*NAR - zbiranje točk, uporabnik mora vedeti koliko ima
      }
    }

    return null;
  },
});
