import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Helper funkcija za izračun števila tedna v letu (ISO 8601)
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper funkcija za pridobitev datumov tedna (ponedeljek-nedelja)
function getWeekDates(weekNumber: number, year: number) {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const firstMonday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  const weekStart = new Date(firstMonday.getTime() + (weekNumber - 1) * 7 * 86400000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  
  return {
    start: weekStart.getTime(),
    end: weekEnd.getTime(),
  };
}

// AKTUALNI SPAR KUPONI - Posodobi vsako nedeljo!
// Vir: https://www.spar.si/promocije-in-projekti/aktualne-promocije
export const updateSparWeeklyCoupons = mutation({
  args: {
    // Parametri za ročno posodabljanje
    weekNumber: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    addedCount: v.number(),
    deactivatedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = new Date();
    const currentWeek = args.weekNumber ?? getWeekNumber(now);
    const currentYear = args.year ?? now.getFullYear();
    const weekDates = getWeekDates(currentWeek, currentYear);

    // Pridobi SPAR trgovino
    const sparStore = await ctx.db.query("stores").filter(q => q.eq(q.field("name"), "Spar")).first();
    if (!sparStore) {
      return { success: false, message: "SPAR trgovina ne obstaja", addedCount: 0, deactivatedCount: 0 };
    }

    // 1. DEAKTIVIRAJ stare SPAR kupone
    const oldCoupons = await ctx.db
      .query("coupons")
      .withIndex("by_store", (q) => q.eq("storeId", sparStore._id))
      .filter((q) => q.or(
        q.lt(q.field("validUntil"), now.getTime()),
        q.and(
          q.neq(q.field("weekNumber"), currentWeek),
          q.neq(q.field("weekNumber"), undefined)
        )
      ))
      .collect();

    let deactivatedCount = 0;
    for (const coupon of oldCoupons) {
      await ctx.db.patch(coupon._id, { isActive: false });
      deactivatedCount++;
    }

    // 2. DODAJ NOVE KUPONE ZA TEDNO
    // TODO: Tukaj boš posodabljal kupone vsako nedeljo iz SPAR strani
    
    const newCoupons = [
      // GLAVNI SPAR PLUS KUPON - Velja ponedeljek-sreda
      {
        storeId: sparStore._id,
        code: `SPARPLUS-W${currentWeek}`,
        description: "-25% na en izdelek po izbiri",
        couponType: "percentage_single_item" as const,
        discountValue: 25,
        validFrom: weekDates.start,
        validUntil: weekDates.end,
        validDays: [1, 2, 3], // Ponedeljek, torek, sreda
        requiresLoyaltyCard: true, // Potrebna SPAR plus kartica!
        maxUsesPerUser: 1, // ENKRATNA uporaba
        excludedProducts: ["postreženo meso"], // Ne velja na postreženo meso
        additionalNotes: "Kupona ni mogoče unovčiti na postreženo meso nekaterih franšiz. Velja samo ob predložitvi SPAR plus kartice.",
        excludeSaleItems: false,
        canCombine: false,
        weekNumber: currentWeek,
        isActive: true,
        isPremiumOnly: false,
      },
      
      // 10% KUPON - Velja PETEK in SOBOTA
      {
        storeId: sparStore._id,
        code: `SPAR10-PETSOB-W${currentWeek}`,
        description: "10% popust na celoten nakup",
        couponType: "percentage_total" as const,
        discountValue: 10,
        minPurchase: 30, // Ob nakupu nad 30€
        validFrom: weekDates.start,
        validUntil: weekDates.end,
        validDays: [5, 6], // PETEK in SOBOTA
        requiresLoyaltyCard: true, // SPAR plus kartica + fizični kupon
        maxUsesPerUser: 1, // Enkratna uporaba
        excludedProducts: [
          "Joker Out × Spar",
          "tobačni izdelki",
          "časopisi",
          "revije",
          "nove knjige",
          "povratna embalaža",
          "vinjete",
          "PAYSAFE kartice",
          "začetne formule",
          "zaščitne maske",
          "peleti za ogrevanje",
          "izdelki suši",
          "Sodastream polnitve",
          "Tchibo",
          "kartica Urbana",
          "polnitve za mobilne telefone",
          "SIM kartice",
          "igre na srečo",
          "darilne kartice",
          "darilni paketi",
          "Joke našega Egona",
          "Lotus"
        ],
        additionalNotes: "Velja vsak petek in soboto. Maksimalna osnova za popust: 500€. Popusti se ne seštevajo. Ne velja v spletni trgovini SPAR ONLINE. Potrebna SPAR plus kartica in fizični kupon.",
        excludeSaleItems: false, // Velja tudi za akcijske izdelke!
        canCombine: false, // Popusti se ne seštevajo
        weekNumber: currentWeek,
        isActive: true,
        isPremiumOnly: false,
      },
      
      // SPAROVI DNEVI ZA MLADE - Vsak torek
      {
        storeId: sparStore._id,
        code: `SPAR-MLADE-TOREK-W${currentWeek}`,
        description: "10% popust za mlade (EYCA kartica)",
        couponType: "percentage_total" as const,
        discountValue: 10,
        minPurchase: 0,
        validFrom: weekDates.start,
        validUntil: weekDates.end,
        validDays: [2], // Vsak TOREK
        requiresLoyaltyCard: true, // SPAR plus + EYCA kartica
        maxUsesPerUser: undefined, // Lahko uporabljaš vsak torek
        excludedProducts: [
          "tobačni izdelki",
          "časopisi",
          "revije",
          "križanke",
          "nove knjige (manj kot 6 mesecev v prodaji)",
          "povratna embalaža",
          "vinjete",
          "SPAR darilne kartice",
          "PAYSAFE kartice",
          "začetne formule",
          "zaščitne maske",
          "peleti za ogrevanje",
          "izdelki suši",
          "Sodastream polnitve",
          "Tchibo",
          "kartica Urbana",
          "polnitve za mobilne telefone",
          "SIM kartice",
          "darilne kartice",
          "darilni paketi (Zvezdar, Selectbox)",
          "igre na srečo",
          "knjige Lotus in Egmont"
        ],
        additionalNotes: "Velja VSAK TOREK za imetnike Evropske mladinske kartice (EYCA) in SPAR plus kartice. Potrebna EAN koda iz EYCA mobilne aplikacije. Maksimalna osnova za popust: 500€. Popusti se ne seštevajo. Ne velja v SPAR Online, SPAR Partner trgovinah in trafikah.",
        excludeSaleItems: false, // Velja tudi za akcijske izdelke
        canCombine: false,
        weekNumber: currentWeek,
        isActive: true,
        isPremiumOnly: false,
      },
      
      // Dodatni SPAR kuponi (posodobi iz strani)
      // Primer:
      // {
      //   storeId: sparStore._id,
      //   code: `SPAR-MLEKO-W${currentWeek}`,
      //   description: "-20% na mlečne izdelke",
      //   couponType: "category_discount" as const,
      //   discountValue: 20,
      //   applicableCategories: ["Mlečni izdelki", "Mleko", "Jogurt", "Siri"],
      //   validFrom: weekDates.start,
      //   validUntil: weekDates.end,
      //   requiresLoyaltyCard: false,
      //   weekNumber: currentWeek,
      //   isActive: true,
      //   isPremiumOnly: false,
      // },
    ];

    let addedCount = 0;
    for (const coupon of newCoupons) {
      await ctx.db.insert("coupons", coupon as any);
      addedCount++;
    }

    return {
      success: true,
      message: `SPAR kuponi posodobljeni za teden ${currentWeek}/${currentYear}. Deaktiviranih: ${deactivatedCount}, Dodanih: ${addedCount}`,
      addedCount,
      deactivatedCount,
    };
  },
});

// TUŠ WEEKLY COUPONS
export const updateTusWeeklyCoupons = mutation({
  args: {
    weekNumber: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    addedCount: v.number(),
    deactivatedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = new Date();
    const currentWeek = args.weekNumber ?? getWeekNumber(now);
    const currentYear = args.year ?? now.getFullYear();
    const weekDates = getWeekDates(currentWeek, currentYear);

    // Pridobi TUŠ trgovino
    const tusStore = await ctx.db.query("stores").filter(q => q.eq(q.field("name"), "Tus")).first();
    if (!tusStore) {
      return { success: false, message: "TUŠ trgovina ne obstaja", addedCount: 0, deactivatedCount: 0 };
    }

    // 1. DEAKTIVIRAJ stare TUŠ kupone
    const oldCoupons = await ctx.db
      .query("coupons")
      .withIndex("by_store", (q) => q.eq("storeId", tusStore._id))
      .filter((q) => q.or(
        q.lt(q.field("validUntil"), now.getTime()),
        q.and(
          q.neq(q.field("weekNumber"), currentWeek),
          q.neq(q.field("weekNumber"), undefined)
        )
      ))
      .collect();

    let deactivatedCount = 0;
    for (const coupon of oldCoupons) {
      await ctx.db.patch(coupon._id, { isActive: false });
      deactivatedCount++;
    }

    // 2. DODAJ NOVE TUŠ KUPONE
    const newCoupons = [
      // 10-99% vrnitev kot D*nar
      {
        storeId: tusStore._id,
        code: `TUS-DNAR-W${currentWeek}`,
        description: "10-99% vrnitev nakupa kot D*nar",
        couponType: "percentage_total" as const,
        discountValue: 10, // Minimalna vrnitev
        minPurchase: 20, // Ob nakupu nad 20€
        validFrom: weekDates.start,
        validUntil: weekDates.end,
        validDays: [1, 5, 6], // PONEDELJEK, PETEK, SOBOTA
        requiresLoyaltyCard: true, // TUŠ klub kartica
        maxUsesPerUser: undefined, // Lahko uporabljaš več krat
        excludedProducts: [],
        additionalNotes: "Vrnitev od 10% do 99% nakupa kot D*nar na TUŠ klub kartico. Velja ponedeljek, petek in soboto. Pogoj: nakup nad 20€. D*nar se pripiše na kartico ob nakupu.",
        excludeSaleItems: false, // Velja tudi za akcijske izdelke
        canCombine: false,
        weekNumber: currentWeek,
        isActive: true,
        isPremiumOnly: false,
      },
      
      // 25% popust na en izdelek - Torek in Četrtek
      {
        storeId: tusStore._id,
        code: `TUS-25-TORČET-W${currentWeek}`,
        description: "25% popust na en izdelek po izbiri",
        couponType: "percentage_single_item" as const,
        discountValue: 25,
        minPurchase: undefined,
        validFrom: weekDates.start,
        validUntil: weekDates.end,
        validDays: [2, 4], // TOREK in ČETRTEK
        requiresLoyaltyCard: true, // TUŠ klub kartica
        maxUsesPerUser: undefined, // Lahko uporabljaš več krat
        excludedProducts: [],
        additionalNotes: "25% popust na en izdelek po tvoji izbiri. Velja vsak torek in četrtek. Potrebna TUŠ klub kartica.",
        excludeSaleItems: false, // Velja tudi za akcijske izdelke
        canCombine: false,
        weekNumber: currentWeek,
        isActive: true,
        isPremiumOnly: false,
      },
    ];

    let addedCount = 0;
    for (const coupon of newCoupons) {
      await ctx.db.insert("coupons", coupon as any);
      addedCount++;
    }

    return {
      success: true,
      message: `TUŠ kuponi posodobljeni za teden ${currentWeek}/${currentYear}. Deaktiviranih: ${deactivatedCount}, Dodanih: ${addedCount}`,
      addedCount,
      deactivatedCount,
    };
  },
});

// MERCATOR WEEKLY COUPONS
export const updateMercatorWeeklyCoupons = mutation({
  args: {
    weekNumber: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    addedCount: v.number(),
    deactivatedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = new Date();
    const currentWeek = args.weekNumber ?? getWeekNumber(now);
    const currentYear = args.year ?? now.getFullYear();
    const weekDates = getWeekDates(currentWeek, currentYear);

    // Pridobi Mercator trgovino
    const mercatorStore = await ctx.db.query("stores").filter(q => q.eq(q.field("name"), "Mercator")).first();
    if (!mercatorStore) {
      return { success: false, message: "Mercator trgovina ne obstaja", addedCount: 0, deactivatedCount: 0 };
    }

    // 1. DEAKTIVIRAJ stare Mercator kupone
    const oldCoupons = await ctx.db
      .query("coupons")
      .withIndex("by_store", (q) => q.eq("storeId", mercatorStore._id))
      .filter((q) => q.or(
        q.lt(q.field("validUntil"), now.getTime()),
        q.and(
          q.neq(q.field("weekNumber"), currentWeek),
          q.neq(q.field("weekNumber"), undefined)
        )
      ))
      .collect();

    let deactivatedCount = 0;
    for (const coupon of oldCoupons) {
      await ctx.db.patch(coupon._id, { isActive: false });
      deactivatedCount++;
    }

    // 2. DODAJ NOVE MERCATOR KUPONE
    const newCoupons = [
      // 25% na en izdelek (preostala košarica nad 5€)
      {
        storeId: mercatorStore._id,
        code: `MERC-25-PETSOB-W${currentWeek}`,
        description: "25% popust na en izdelek po izbiri",
        couponType: "percentage_single_item" as const,
        discountValue: 25,
        minPurchase: 5, // Preostali del košarice nad 5€
        validFrom: weekDates.start,
        validUntil: weekDates.end,
        validDays: [5, 6], // PETEK in SOBOTA
        requiresLoyaltyCard: true, // Pika kartica
        maxUsesPerUser: undefined,
        excludedProducts: [],
        additionalNotes: "25% popust na en izdelek po tvoji izbiri. Pogoj: preostali del košarice v vrednosti nad 5€. Velja petek in soboto.",
        excludeSaleItems: false,
        canCombine: false,
        weekNumber: currentWeek,
        isActive: true,
        isPremiumOnly: false,
      },
      
      // 10% na celoten nakup (nad 30€)
      {
        storeId: mercatorStore._id,
        code: `MERC-10-PETSOB-W${currentWeek}`,
        description: "10% popust na celoten nakup",
        couponType: "percentage_total" as const,
        discountValue: 10,
        minPurchase: 30, // Nad 30€
        validFrom: weekDates.start,
        validUntil: weekDates.end,
        validDays: [5, 6], // PETEK in SOBOTA
        requiresLoyaltyCard: true, // Pika kartica
        maxUsesPerUser: undefined,
        excludedProducts: [],
        additionalNotes: "10% popust na celoten nakup v vrednosti nad 30€. Vključuje tudi izdelke v akciji. Velja petek in soboto.",
        excludeSaleItems: false, // Velja tudi za akcijske izdelke
        canCombine: false,
        weekNumber: currentWeek,
        isActive: true,
        isPremiumOnly: false,
      },
    ];

    let addedCount = 0;
    for (const coupon of newCoupons) {
      await ctx.db.insert("coupons", coupon as any);
      addedCount++;
    }

    return {
      success: true,
      message: `Mercator kuponi posodobljeni za teden ${currentWeek}/${currentYear}. Deaktiviranih: ${deactivatedCount}, Dodanih: ${addedCount}`,
      addedCount,
      deactivatedCount,
    };
  },
});

/**
 * MUTATION: Kreiraj kupone iz AI analize
 * Kličejo ga iz UI ko uporabnik uploada sliko
 */
export const createCouponsFromAI = mutation({
  args: {
    parsedCoupons: v.array(v.object({
      description: v.string(),
      discountType: v.union(
        v.literal("percentage_total"), 
        v.literal("percentage_single_item"), 
        v.literal("fixed"),
        v.literal("category_discount")
      ),
      discountValue: v.number(),
      minPurchase: v.optional(v.number()),
      validDays: v.array(v.number()),
      validDates: v.optional(v.object({
        from: v.string(),
        until: v.string(),
      })),
      requiresLoyaltyCard: v.boolean(),
      maxUsesPerUser: v.optional(v.number()),
      excludedProducts: v.array(v.string()),
      additionalNotes: v.string(),
      excludeSaleItems: v.boolean(),
      canCombine: v.boolean(),
    })),
    storeName: v.optional(v.string()), // Default: "Spar"
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const currentWeek = getWeekNumber(now);

    // Pridobi trgovino
    const storeName = args.storeName || "Spar";
    const store = await ctx.db.query("stores").filter(q => q.eq(q.field("name"), storeName)).first();
    
    if (!store) {
      throw new Error(`Trgovina ${storeName} ne obstaja`);
    }

    let addedCount = 0;
    
    for (const parsed of args.parsedCoupons) {
      // Pretvori datum string v timestamp
      let validFrom = now.getTime();
      let validUntil = now.getTime() + 7 * 24 * 60 * 60 * 1000; // Default 7 dni

      if (parsed.validDates) {
        validFrom = new Date(parsed.validDates.from).getTime();
        validUntil = new Date(parsed.validDates.until).getTime();
      }

      // Generiraj unikatno kodo
      const code = `${storeName.toUpperCase()}-AI-W${currentWeek}-${addedCount + 1}`;

      await ctx.db.insert("coupons", {
        storeId: store._id,
        code,
        description: parsed.description,
        couponType: parsed.discountType,
        discountValue: parsed.discountValue,
        minPurchase: parsed.minPurchase,
        validFrom,
        validUntil,
        validDays: parsed.validDays,
        requiresLoyaltyCard: parsed.requiresLoyaltyCard,
        maxUsesPerUser: parsed.maxUsesPerUser,
        excludedProducts: parsed.excludedProducts,
        additionalNotes: parsed.additionalNotes,
        excludeSaleItems: parsed.excludeSaleItems,
        canCombine: parsed.canCombine,
        weekNumber: currentWeek,
        isActive: true,
        isPremiumOnly: false,
      });

      addedCount++;
    }

    return {
      success: true,
      message: `Uspešno dodanih ${addedCount} kuponov iz AI analize`,
      addedCount,
    };
  },
});

// Helper mutation za dodajanje kuponov - uporabnik lahko to kliče iz konzole
export const seedCoupons = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Pridobi vse trgovine
    const stores = await ctx.db.query("stores").collect();
    
    const now = Date.now();
    const oneMonthFromNow = now + 30 * 24 * 60 * 60 * 1000;

    // Primer kuponov za vsako trgovino
    const sampleCoupons = [
      // SPAR kuponi
      {
        storeId: stores.find(s => s.name === "Spar")?._id,
        code: "SPAR10",
        description: "10% popust na celoten nakup",
        couponType: "percentage_total" as const,
        discountValue: 10,
        minPurchase: 20,
        validUntil: oneMonthFromNow,
        excludeSaleItems: false,
        requiresLoyaltyCard: false,
        canCombine: false,
        isPremiumOnly: false,
      },
      {
        storeId: stores.find(s => s.name === "Spar")?._id,
        code: "SPARDRAGI",
        description: "25% popust na en izdelek",
        couponType: "percentage_single_item" as const,
        discountValue: 25,
        validUntil: oneMonthFromNow,
        excludeSaleItems: true,
        requiresLoyaltyCard: false,
        canCombine: false,
        isPremiumOnly: false,
      },
      {
        storeId: stores.find(s => s.name === "Spar")?._id,
        code: "SPARMLEKO",
        description: "15% popust na mlečne izdelke",
        couponType: "category_discount" as const,
        discountValue: 15,
        applicableCategories: ["Mlečni izdelki", "Mleko"],
        validUntil: oneMonthFromNow,
        excludeSaleItems: false,
        requiresLoyaltyCard: true,
        canCombine: false,
        isPremiumOnly: false,
      },

      // MERCATOR kuponi
      {
        storeId: stores.find(s => s.name === "Mercator")?._id,
        code: "MERCATOR15",
        description: "15% popust na celoten nakup",
        couponType: "percentage_total" as const,
        discountValue: 15,
        minPurchase: 30,
        validUntil: oneMonthFromNow,
        excludeSaleItems: false,
        requiresLoyaltyCard: true,
        canCombine: false,
        isPremiumOnly: false,
      },
      {
        storeId: stores.find(s => s.name === "Mercator")?._id,
        code: "MERCFIKSNI",
        description: "5€ popust",
        couponType: "fixed" as const,
        discountValue: 5,
        minPurchase: 40,
        validUntil: oneMonthFromNow,
        excludeSaleItems: false,
        requiresLoyaltyCard: false,
        canCombine: false,
        isPremiumOnly: false,
      },
      {
        storeId: stores.find(s => s.name === "Mercator")?._id,
        code: "MERCPREMIUM",
        description: "30% popust na en izdelek (Premium)",
        couponType: "percentage_single_item" as const,
        discountValue: 30,
        validUntil: oneMonthFromNow,
        excludeSaleItems: true,
        requiresLoyaltyCard: false,
        canCombine: false,
        isPremiumOnly: true,
      },

      // TUŠ kuponi
      {
        storeId: stores.find(s => s.name === "Tus")?._id,
        code: "TUS12",
        description: "12% popust na celoten nakup",
        couponType: "percentage_total" as const,
        discountValue: 12,
        minPurchase: 25,
        validUntil: oneMonthFromNow,
        excludeSaleItems: false,
        requiresLoyaltyCard: false,
        canCombine: false,
        isPremiumOnly: false,
      },
      {
        storeId: stores.find(s => s.name === "Tus")?._id,
        code: "TUSDRAGI",
        description: "20% popust na najdražji izdelek",
        couponType: "percentage_single_item" as const,
        discountValue: 20,
        validUntil: oneMonthFromNow,
        excludeSaleItems: false,
        requiresLoyaltyCard: true,
        canCombine: false,
        isPremiumOnly: false,
      },

    ];

    // Vstavi kupone
    for (const coupon of sampleCoupons) {
      if (coupon.storeId) {
        await ctx.db.insert("coupons", coupon as any);
      }
    }

    console.log(`✅ Dodanih ${sampleCoupons.length} kuponov`);
    return null;
  },
});

// Funkcija za čiščenje kuponov (če želimo pobrisati vse)
export const clearAllCoupons = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const coupons = await ctx.db.query("coupons").collect();
    for (const coupon of coupons) {
      await ctx.db.delete(coupon._id);
    }
    console.log(`🗑️ Izbrisanih ${coupons.length} kuponov`);
    return null;
  },
});

// Query za prikaz trenutno aktivnih SPAR kuponov
export const getActiveSparCoupons = mutation({
  args: {},
  returns: v.array(
    v.object({
      code: v.string(),
      description: v.string(),
      validDays: v.optional(v.array(v.number())),
      weekNumber: v.optional(v.number()),
      isActive: v.optional(v.boolean()),
      requiresLoyaltyCard: v.optional(v.boolean()),
      maxUsesPerUser: v.optional(v.number()),
      additionalNotes: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const sparStore = await ctx.db.query("stores").filter(q => q.eq(q.field("name"), "Spar")).first();
    if (!sparStore) return [];

    const coupons = await ctx.db
      .query("coupons")
      .withIndex("by_store", (q) => q.eq("storeId", sparStore._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return coupons.map(c => ({
      code: c.code,
      description: c.description,
      validDays: c.validDays,
      weekNumber: c.weekNumber,
      isActive: c.isActive,
      requiresLoyaltyCard: c.requiresLoyaltyCard,
      maxUsesPerUser: c.maxUsesPerUser,
      additionalNotes: c.additionalNotes,
    }));
  },
});

