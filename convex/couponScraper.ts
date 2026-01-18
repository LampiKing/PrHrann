import { v } from "convex/values";
import { action, mutation, query, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * SPAR KUPON PRAVILA - TRAJNO SHRANJENO
 * Vir: https://www.spar.si/promocije-in-projekti/aktualne-promocije
 *
 * Ta pravila se NE spreminjajo - samo dnevi veljavnosti se posodabljajo tedensko
 */
const SPAR_COUPON_TEMPLATES = {
  kupon25: {
    code: "SPAR25",
    description: "25% popust na en izdelek po vaši izbiri",
    couponType: "percentage_single_item" as const,
    discountValue: 25,
    excludeSaleItems: true, // Pri akcijskih se odšteje od REDNE cene
    requiresLoyaltyCard: true, // SPAR plus kartica
    canCombine: false,
    maxUsesPerUser: 1,
    excludedProducts: [
      "tobak", "časopisi", "revije", "vinjete", "PAYSAFE", "Tchibo",
      "knjige (<6 mes)", "Egmont", "Lotus", "SIM kartice", "peleti", "briketi",
      "darilne kartice (SPAR, Supercard)", "Zvezdar", "Selectbox",
      "sličice za albume", "igre na srečo",
      "brezalkoholna vina", "peneča vina", "koktejli", "brezalkoholne žgane pijače",
      "alkohol (RAZEN pivo v nepovratni embalaži)",
      "race", "gosi", "sušeni pršuti s kostjo",
      "zaščitne maske", "Sodastream polnitve",
      "polnitve za mobilne telefone", "Urbana",
      "suši", "Joker Out x Spar puloverji"
    ],
    excludedPromotions: [
      "Noro znižanje", "Gratis", "Več je ceneje", "Trajno znižano",
      "Znižano", "Točke zvestobe", "kuponi s črtno kodo"
    ],
    additionalNotes: "SPAR plus kartica obvezna. Pri akcijskih izdelkih se 25% odšteje od REDNE cene. Max 5kg mesa ali 10kg sadje/zelenjave. Ne velja za pravne osebe/s.p.",
  },

  kupon30nf2: {
    code: "SPAR30NF",
    description: "30% popust na en NEŽIVILSKI izdelek po vaši izbiri",
    couponType: "percentage_single_item" as const,
    discountValue: 30,
    excludeSaleItems: true,
    requiresLoyaltyCard: true,
    canCombine: false,
    maxUsesPerUser: 1,
    applicableCategories: ["Neživila", "Kozmetika", "Čistila", "Gospodinjstvo", "Higiena"],
    excludedProducts: [
      "tobak", "časopisi", "revije", "sličice za albume", "igre na srečo",
      "vinjete", "PAYSAFE", "Tchibo", "nega za obutev",
      "polnitve za mobilne telefone", "SIM kartice",
      "darilne kartice", "Zvezdar", "Selectbox",
      "Urbana", "zaščitne maske",
      "knjige (<6 mes)", "Lotus", "Egmont", "Sodastream polnitve",
      "Joker Out x Spar puloverji"
    ],
    excludedPromotions: [
      "Noro znižanje", "Gratis", "Več je ceneje", "Trajno znižano",
      "Znižano", "Točke zvestobe", "kuponi s črtno kodo"
    ],
    additionalNotes: "Samo NEŽIVILSKI izdelki. SPAR plus kartica obvezna. Pri akcijskih se 30% odšteje od REDNE cene.",
  },

  kupon10: {
    code: "SPAR10",
    description: "10% popust na celoten nakup nad 30€",
    couponType: "percentage_total" as const,
    discountValue: 10,
    minPurchase: 30,
    excludeSaleItems: false, // VELJA tudi za akcijske izdelke!
    requiresLoyaltyCard: true,
    canCombine: false,
    maxUsesPerUser: 1,
    maxDiscountBase: 500, // Max osnova za popust
    excludedProducts: [
      "tobak", "časopisi", "revije", "knjige (<6 mes)",
      "vinjete", "PAYSAFE", "začetne formule", "zaščitne maske",
      "peleti za ogrevanje", "suši", "Sodastream polnitve",
      "Tchibo", "Urbana", "polnitve za mobilne telefone",
      "SIM kartice", "igre na srečo",
      "darilne kartice", "Zvezdar", "Selectbox",
      "Točke zvestobe izdelki", "Egmont", "Lotus",
      "Joker Out x Spar puloverji"
    ],
    additionalNotes: "SPAR plus kartica obvezna. Min. nakup 30€. VELJA tudi za akcijske izdelke! Max osnova 500€. Ne velja za pravne osebe/s.p.",
  },

  kupon10upokojenci: {
    code: "SPAR10UPOK",
    description: "10% popust za upokojence na celoten nakup nad 20€",
    couponType: "percentage_total" as const,
    discountValue: 10,
    minPurchase: 20,
    excludeSaleItems: false,
    requiresLoyaltyCard: true, // SPAR plus z urejenim statusom upokojenca
    canCombine: false,
    maxDiscountBase: 500,
    excludedProducts: [
      "tobak", "časopisi", "revije", "križanke", "igre na srečo",
      "knjige (<6 mes)", "vinjete", "PAYSAFE", "začetne formule",
      "zaščitne maske", "peleti za ogrevanje", "suši", "Sodastream polnitve",
      "Tchibo", "Urbana", "polnitve za mobilne telefone",
      "SIM kartice", "darilne kartice", "Zvezdar", "Selectbox",
      "Lotus", "Egmont"
    ],
    additionalNotes: "Samo za upokojence s SPAR plus kartico z UREJENIM statusom upokojenca. Min. nakup 20€. Max osnova 500€.",
  },

  ribjitorek: {
    code: "RIBJITOREK",
    description: "20% popust na sveže in zamrznjene ribe ter morske sadeže",
    couponType: "category_discount" as const,
    discountValue: 20,
    excludeSaleItems: false,
    requiresLoyaltyCard: false, // Ne potrebuje kartice
    canCombine: false,
    applicableCategories: ["Ribe", "Morski sadeži", "Zamrznjene ribe", "Postrežne ribe"],
    additionalNotes: "Vsak TOREK. Velja za sveže ter zamrznjene postrežne ribe ter morske sadeže.",
  },

  // Posebne promocije (niso kuponi, samo info)
  szt: {
    code: "SZT",
    description: "Super začetek tedna - posebne ponudbe",
    couponType: "percentage_single_item" as const,
    discountValue: 0, // Različni popusti
    excludeSaleItems: false,
    requiresLoyaltyCard: false,
    canCombine: false,
    additionalNotes: "Posebne ponudbe ob začetku tedna (ponedeljek, torek).",
  },

  skt: {
    code: "SKT",
    description: "Super konec tedna - posebne ponudbe",
    couponType: "percentage_single_item" as const,
    discountValue: 0,
    excludeSaleItems: false,
    requiresLoyaltyCard: false,
    canCombine: false,
    additionalNotes: "Posebne ponudbe ob koncu tedna (petek, sobota).",
  },
};

/**
 * MERCATOR KUPON PRAVILA - TRAJNO SHRANJENO
 * Vir: https://www.mercator.si/akcije-in-ugodnosti/
 *
 * Mercator ima strukturiran sistem kuponov povezan s Pika kartico.
 * Vikend kuponi veljajo samo določene vikende (petek + sobota).
 * NE velja v spletni trgovini - samo v živilskih in franšiznih prodajalnah!
 */
const MERCATOR_COUPON_TEMPLATES = {
  vikend25: {
    code: "MERC25",
    description: "25% popust na en izbrani izdelek",
    couponType: "percentage_single_item" as const,
    discountValue: 25,
    minPurchaseForRest: 5, // Preostanek košarice (brez izbranega izdelka) mora biti nad 5€
    excludeSaleItems: false, // Lahko tudi akcijski izdelek
    requiresLoyaltyCard: true, // Pika kartica obvezna
    canCombine: false, // NE moreš kombinirati z 10% kuponom
    maxUsesPerUser: 1,
    excludedProducts: [
      "tobak", "tobačni izdelki", "e-cigarete",
      "časopisi", "revije", "knjige",
      "alkoholne pijače",
      "darilne kartice", "darilni boni",
      "položnice", "storitve",
      "vinjete",
      "polnitve za telefone", "SIM kartice",
      "igre na srečo", "loterija"
    ],
    additionalNotes: "Pika kartica obvezna. Preostanek košarice mora biti nad 5€ (brez izbranega izdelka). NE kombinira z 10% kuponom - izbereš enega! Velja SAMO v fizičnih prodajalnah (živilske + franšizne), NE v spletni trgovini.",
    validDays: [5, 6], // Petek, Sobota - samo določeni vikendi
    onlyPhysicalStores: true,
  },

  vikend10: {
    code: "MERC10",
    description: "10% popust na celoten nakup nad 30€",
    couponType: "percentage_total" as const,
    discountValue: 10,
    minPurchase: 30, // Minimalni nakup 30€
    excludeSaleItems: false, // VELJA tudi za izdelke v akciji!
    requiresLoyaltyCard: true, // Pika kartica obvezna
    canCombine: false, // NE moreš kombinirati z 25% kuponom
    maxUsesPerUser: 1,
    excludedProducts: [
      "tobak", "tobačni izdelki", "e-cigarete",
      "časopisi", "revije", "knjige",
      "alkoholne pijače",
      "darilne kartice", "darilni boni",
      "položnice", "storitve",
      "vinjete",
      "polnitve za telefone", "SIM kartice",
      "igre na srečo", "loterija"
    ],
    additionalNotes: "Pika kartica obvezna. Min. nakup 30€. VELJA tudi za akcijske izdelke! NE kombinira z 25% kuponom - izbereš enega! Velja SAMO v fizičnih prodajalnah, NE v spletni trgovini.",
    validDays: [5, 6], // Petek, Sobota - samo določeni vikendi
    onlyPhysicalStores: true,
  },

  // ============ INFORMATIVNO (ne računamo prihranka) ============
  // Super Pika kupon - potrebuje 300 pik (uporabnik mora sam vedeti koliko ima)
  // Moja izbira - personalizirani znižani izdelki, ne kupon
};

/**
 * TUŠ KUPON PRAVILA - TRAJNO SHRANJENO
 * Vir: Tuš mobilna aplikacija + https://www.tus.si/
 *
 * Tuš kuponi so na voljo v letakih, e-obveščanju in mobilni aplikaciji.
 * Tuš klub kartica ali Diners Club Tuš kartica je potrebna.
 * NE velja v spletnem supermarketu hitrinakup.com!
 */
const TUS_COUPON_TEMPLATES = {
  kupon25: {
    code: "TUS25",
    description: "25% popust za en kos izdelka po vaši izbiri",
    couponType: "percentage_single_item" as const,
    discountValue: 25,
    maxWeight: 5, // Pri tehtanih izdelkih max 5 kg
    excludeSaleItems: false, // Lahko tudi akcijski izdelek - se unovči na REDNO ceno
    requiresLoyaltyCard: true, // Tuš klub kartica ali Diners Club Tuš kartica
    canCombine: false, // NE sešteva z drugimi popusti
    maxUsesPerUser: 1, // Enkratna uporaba (ali iz letaka ali iz e-obveščanja ali iz aplikacije)
    excludedProducts: [
      // Akcije in promocije
      "Mojih 10", "STOP PODRAŽITVAM", "10 + 1 gratis", "BUM ponudba",
      "Tuš klub -50%", "ZA KRATEK ČAS", "IN ponudbe Diners Club",
      "lojalnostni programi", "odprodaja", "super cena",
      "znižano pred iztekom roka", "promocijski materiali brez dodatnih ugodnosti",
      // Pijače
      "promocijska pakiranja piva in mleka", "vina", "peneča vina",
      "pivo v steklenici", "pivo v sodih", "žgane pijače",
      // Ostalo
      "kristalni sladkor 25 kg", "časopisi", "revije", "knjige",
      "cigarete", "tobačni izdelki", "tobačni pripomočki",
      "SIM kartice", "predplačniški paketi mobilnih operaterjev",
      "začetne formule", "vrednostnice za mobilne telefone",
      "darilni boni", "vrednostne kartice", "povratna embalaža",
      "položnice", "darilni paketi Zvezdar", "Select Box",
      "plin v plinskih jeklenkah", "plinske jeklenke"
    ],
    additionalNotes: "Tuš klub ali Diners Club Tuš kartica obvezna. Enkratna uporaba (letak/e-obveščanje/aplikacija). Max 5 kg pri tehtanih izdelkih. Opozoriti blagajnika PRED zaključkom računa! Pri akcijskih izdelkih se 25% unovči na REDNO ceno. NE velja v hitrinakup.com. NE velja za pravne osebe/s.p.",
    validDays: [2], // Torek (primer: 20.1. je bil torek)
    onlyPhysicalStores: true,
  },

  kupon20: {
    code: "TUS20",
    description: "20% popust za en kos izdelka po vaši izbiri",
    couponType: "percentage_single_item" as const,
    discountValue: 20,
    maxWeight: 5,
    excludeSaleItems: false,
    requiresLoyaltyCard: true,
    canCombine: false,
    maxUsesPerUser: 1,
    excludedProducts: [
      "Mojih 10", "STOP PODRAŽITVAM", "10 + 1 gratis", "BUM ponudba",
      "Tuš klub -50%", "ZA KRATEK ČAS", "IN ponudbe Diners Club",
      "lojalnostni programi", "odprodaja", "super cena",
      "znižano pred iztekom roka", "vina", "peneča vina",
      "pivo v steklenici", "pivo v sodih", "žgane pijače",
      "časopisi", "revije", "knjige", "cigarete", "tobačni izdelki",
      "SIM kartice", "začetne formule", "darilni boni", "položnice",
      "darilni paketi Zvezdar", "Select Box"
    ],
    additionalNotes: "Tuš klub kartica obvezna. Enkratna uporaba. Max 5 kg pri tehtanih izdelkih. Opozoriti blagajnika PRED zaključkom računa!",
    validDays: [5, 6], // Vikend
    onlyPhysicalStores: true,
  },

  kupon15: {
    code: "TUS15",
    description: "15% popust za en kos izdelka po vaši izbiri",
    couponType: "percentage_single_item" as const,
    discountValue: 15,
    maxWeight: 5,
    excludeSaleItems: false,
    requiresLoyaltyCard: true,
    canCombine: false,
    maxUsesPerUser: 1,
    excludedProducts: [
      "Mojih 10", "STOP PODRAŽITVAM", "10 + 1 gratis", "BUM ponudba",
      "Tuš klub -50%", "ZA KRATEK ČAS", "IN ponudbe Diners Club",
      "lojalnostni programi", "odprodaja", "super cena",
      "znižano pred iztekom roka", "vina", "peneča vina",
      "pivo v steklenici", "pivo v sodih", "žgane pijače",
      "časopisi", "revije", "knjige", "cigarete", "tobačni izdelki",
      "SIM kartice", "začetne formule", "darilni boni", "položnice"
    ],
    additionalNotes: "Tuš klub kartica obvezna. Enkratna uporaba. Max 5 kg pri tehtanih izdelkih.",
    validDays: [1, 2, 3, 4, 5, 6], // Odvisno od letaka
    onlyPhysicalStores: true,
  },

  // 11% popust na celoten nakup nad 30€
  kupon11: {
    code: "TUS11",
    description: "11% popust na celoten nakup nad 30€",
    couponType: "percentage_total" as const,
    discountValue: 11,
    minPurchase: 30, // Ob nakupu nad 30 EUR
    excludeSaleItems: false, // Velja tudi za akcijske
    requiresLoyaltyCard: true, // Tuš klub kartica (TK kartico)
    canCombine: false,
    maxUsesPerUser: 1,
    excludedProducts: [
      "Mojih 10", "STOP PODRAŽITVAM", "BUM ponudba", "Tuš klub -50%",
      "ZA KRATEK ČAS", "odprodaja", "super cena",
      "vina", "peneča vina", "žgane pijače",
      "cigarete", "tobačni izdelki", "SIM kartice",
      "darilni boni", "položnice"
    ],
    additionalNotes: "Tuš klub kartica obvezna. Popust vam v obliki D*narja vrnemo na TK kartico. Nakup nad 30€.",
    validDays: [0, 1, 2, 3, 4, 5, 6], // Odvisno od letaka
    onlyPhysicalStores: true,
    returnAsDnar: true, // Popust se vrne kot D*nar na kartico
  },

  // ============ INFORMATIVNO (ne računamo prihranka) ============
  // Mojih 10 - personalizirani znižani izdelki, ne kupon
  // D*NAR - zbiranje točk, uporabnik mora sam vedeti koliko ima
};

// Dnevi v tednu (0 = nedelja, 1 = ponedeljek, ...)
const DAY_NAMES = ["nedelja", "ponedeljek", "torek", "sreda", "četrtek", "petek", "sobota"];

/**
 * Pridobi trenutni teden v letu
 */
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Fetch SPAR JSON za določen teden (internal - za cron)
 */
export const fetchSparWeeklyData = internalAction({
  args: {
    weekNumber: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      success: v.boolean(),
      weekNumber: v.number(),
      year: v.number(),
      promocije: v.array(v.array(v.string())),
      error: v.optional(v.string()),
    }),
    v.object({
      success: v.boolean(),
      error: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const now = new Date();
    const year = args.year || now.getFullYear();
    const weekNumber = args.weekNumber || getWeekNumber(now);

    const url = `https://www.sparslovenija.si/spar-koledar-ugodnosti/${year}/teden-${weekNumber}.json`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: Ni mogoče pridobiti podatkov za teden ${weekNumber}`,
        };
      }

      const data = await response.json();

      if (!data.promocije || !Array.isArray(data.promocije)) {
        return {
          success: false,
          error: "Napačna struktura JSON - manjka 'promocije' array",
        };
      }

      // Shrani v bazo
      await ctx.runMutation(internal.couponScraper.saveSparWeeklyData, {
        weekNumber,
        year,
        promocije: data.promocije,
      });

      return {
        success: true,
        weekNumber,
        year,
        promocije: data.promocije,
      };
    } catch (error) {
      return {
        success: false,
        error: `Napaka pri fetchanju: ${error instanceof Error ? error.message : "Neznana napaka"}`,
      };
    }
  },
});

/**
 * Shrani SPAR tedenske podatke in posodobi kupone
 */
export const saveSparWeeklyData = internalMutation({
  args: {
    weekNumber: v.number(),
    year: v.number(),
    promocije: v.array(v.array(v.string())),
  },
  returns: v.object({
    success: v.boolean(),
    updatedCoupons: v.number(),
  }),
  handler: async (ctx, args) => {
    // Pridobi SPAR store
    const stores = await ctx.db.query("stores").collect();
    const sparStore = stores.find(s => s.name.toLowerCase().includes("spar"));

    if (!sparStore) {
      return { success: false, updatedCoupons: 0 };
    }

    // Počisti obstoječe SPAR kupone
    const existingCoupons = await ctx.db
      .query("coupons")
      .withIndex("by_store", (q) => q.eq("storeId", sparStore._id))
      .collect();

    for (const coupon of existingCoupons) {
      await ctx.db.delete(coupon._id);
    }

    // Mapiranje JSON ključev na dneve (0=ponedeljek v JSONu, ampak 1=ponedeljek v JS)
    // JSON: [0]=pon, [1]=tor, [2]=sre, [3]=čet, [4]=pet, [5]=sob
    // JS Day: 0=ned, 1=pon, 2=tor, 3=sre, 4=čet, 5=pet, 6=sob
    const jsonToDayMap: Record<number, number> = {
      0: 1, // Ponedeljek
      1: 2, // Torek
      2: 3, // Sreda
      3: 4, // Četrtek
      4: 5, // Petek
      5: 6, // Sobota
    };

    // Zberi katere kupone so veljavni na katere dneve
    const couponDays: Record<string, number[]> = {};

    for (let jsonDay = 0; jsonDay < args.promocije.length; jsonDay++) {
      const dayPromotions = args.promocije[jsonDay];
      const jsDay = jsonToDayMap[jsonDay];

      for (const promo of dayPromotions) {
        if (!couponDays[promo]) {
          couponDays[promo] = [];
        }
        couponDays[promo].push(jsDay);
      }
    }

    // Ustvari kupone z pravilnimi dnevi
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let updatedCoupons = 0;

    for (const [promoKey, days] of Object.entries(couponDays)) {
      const template = SPAR_COUPON_TEMPLATES[promoKey as keyof typeof SPAR_COUPON_TEMPLATES];

      if (!template || template.discountValue === 0) {
        // Preskoči promocije ki niso pravi kuponi (szt, skt)
        continue;
      }

      await ctx.db.insert("coupons", {
        storeId: sparStore._id,
        code: template.code,
        description: template.description,
        couponType: template.couponType,
        discountValue: template.discountValue,
        minPurchase: "minPurchase" in template ? template.minPurchase : undefined,
        validDays: days,
        validUntil: now + oneWeek,
        excludeSaleItems: template.excludeSaleItems,
        requiresLoyaltyCard: template.requiresLoyaltyCard,
        canCombine: template.canCombine,
        isPremiumOnly: false,
        maxUsesPerUser: "maxUsesPerUser" in template ? template.maxUsesPerUser : undefined,
        excludedProducts: "excludedProducts" in template ? template.excludedProducts : undefined,
        applicableCategories: "applicableCategories" in template ? template.applicableCategories : undefined,
        additionalNotes: template.additionalNotes,
        weekNumber: args.weekNumber,
        isActive: true,
      });

      updatedCoupons++;
    }

    return { success: true, updatedCoupons };
  },
});

/**
 * Ročno posodobi SPAR kupone (za admina)
 */
export const updateSparCouponsManually = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    weekNumber: v.optional(v.number()),
    updatedCoupons: v.optional(v.number()),
  }),
  handler: async (ctx): Promise<{
    success: boolean;
    message: string;
    weekNumber?: number;
    updatedCoupons?: number;
  }> => {
    const now = new Date();
    const year = now.getFullYear();
    const weekNumber = getWeekNumber(now);
    const url = `https://www.sparslovenija.si/spar-koledar-ugodnosti/${year}/teden-${weekNumber}.json`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}: Ni mogoče pridobiti podatkov za teden ${weekNumber}`,
        };
      }

      const data = await response.json();

      if (!data.promocije || !Array.isArray(data.promocije)) {
        return {
          success: false,
          message: "Napačna struktura JSON - manjka 'promocije' array",
        };
      }

      // Shrani v bazo
      await ctx.runMutation(internal.couponScraper.saveSparWeeklyData, {
        weekNumber,
        year,
        promocije: data.promocije,
      });

      return {
        success: true,
        message: `SPAR kuponi posodobljeni za teden ${weekNumber}/${year}`,
        weekNumber,
        updatedCoupons: data.promocije.length,
      };
    } catch (error) {
      return {
        success: false,
        message: `Napaka: ${error instanceof Error ? error.message : "Neznana napaka"}`,
      };
    }
  },
});

/**
 * Pridobi SPAR kupon template (za prikaz pravil)
 */
export const getSparCouponRules = query({
  args: {},
  returns: v.array(
    v.object({
      code: v.string(),
      description: v.string(),
      discountValue: v.number(),
      requiresLoyaltyCard: v.boolean(),
      additionalNotes: v.string(),
    })
  ),
  handler: async () => {
    return Object.values(SPAR_COUPON_TEMPLATES)
      .filter(t => t.discountValue > 0)
      .map(t => ({
        code: t.code,
        description: t.description,
        discountValue: t.discountValue,
        requiresLoyaltyCard: t.requiresLoyaltyCard,
        additionalNotes: t.additionalNotes,
      }));
  },
});
