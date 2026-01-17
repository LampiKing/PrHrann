import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const ALLOWED_STORE_NAMES = new Set(["Spar", "Mercator", "Tus"]);

/**
 * Ekstrahiraj velikost iz besedila (npr. "1l", "500g", "1.5l")
 */
function extractSize(text: string): { value: number; unit: string } | null {
  const match = text.match(/(\d+[,.]?\d*)\s*(kg|g|l|ml|cl|dl|liter|litrov)/i);
  if (!match) return null;

  let value = parseFloat(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();

  // Normaliziraj na osnovne enote (g, ml)
  if (unit === "kg") value *= 1000;
  if (unit === "l" || unit === "liter" || unit === "litrov") value *= 1000;
  if (unit === "cl") value *= 10;
  if (unit === "dl") value *= 100;

  const baseUnit = (unit === "kg" || unit === "g") ? "g" : "ml";
  return { value, unit: baseUnit };
}

/**
 * Izračun velikosti izdelka - KRITIČNO za razvrščanje
 * Večji paketi (1L, 1kg, 500g) imajo veliko prednost
 */
function getSizeScore(name: string, unit: string): number {
  const text = `${name} ${unit}`.toLowerCase();

  // PRIORITETNE velikosti - kar ljudje dejansko kupujejo
  if (/\b1\s*kg\b|\b1000\s*g\b/i.test(text)) return 100;
  if (/\b1\s*l\b|\b1000\s*ml\b|\b1\s*liter\b/i.test(text)) return 100;
  if (/\b1[,.]5\s*l\b|\b1500\s*ml\b/i.test(text)) return 98; // 1.5L je zelo pogost
  if (/\b2\s*l\b|\b2000\s*ml\b/i.test(text)) return 95;
  if (/\b500\s*g\b|\b0[,.]5\s*kg\b/i.test(text)) return 90;
  if (/\b500\s*ml\b|\b0[,.]5\s*l\b/i.test(text)) return 90;
  if (/\b750\s*ml\b/i.test(text)) return 85;
  if (/\b250\s*g\b/i.test(text)) return 80;
  if (/\b400\s*g\b/i.test(text)) return 75;
  if (/\b330\s*ml\b/i.test(text)) return 70;
  if (/\b300\s*g\b/i.test(text)) return 65;

  // SREDNJE velikosti
  if (/\b200\s*g\b/i.test(text)) return 50;
  if (/\b150\s*g\b/i.test(text)) return 45;
  if (/\b250\s*ml\b/i.test(text)) return 40;

  // MAJHNA pakiranja - MOČNA penalizacija
  if (/\b200\s*ml\b/i.test(text)) return 15;
  if (/\b100\s*ml\b/i.test(text)) return 8;
  if (/\b50\s*ml\b/i.test(text)) return 5;
  if (/\b100\s*g\b/i.test(text)) return 20;
  if (/\b90\s*g\b/i.test(text)) return 18;
  if (/\b80\s*g\b/i.test(text)) return 15;
  if (/\b75\s*g\b/i.test(text)) return 15;
  if (/\b70\s*g\b/i.test(text)) return 12;
  if (/\b50\s*g\b/i.test(text)) return 10;
  if (/\b40\s*g\b/i.test(text)) return 8;
  if (/\b30\s*g\b/i.test(text)) return 5;

  // Zelo majhna pakiranja - zelo nizko
  if (/\b2[02]\s*ml\b|\b0[,.]2\s*l\b/i.test(text)) return 3;

  return 25; // neznana velikost
}

/**
 * Slovnične končnice za slovenščino - za normalizacijo besed
 */
function getStemRoot(word: string): string {
  const w = word.toLowerCase();
  // Odstrani pogoste slovenske končnice
  if (w.endsWith("ov") || w.endsWith("ev")) return w.slice(0, -2);
  if (w.endsWith("ni") || w.endsWith("na") || w.endsWith("no")) return w.slice(0, -2);
  if (w.endsWith("ski") || w.endsWith("ški")) return w.slice(0, -3);
  if (w.endsWith("en") || w.endsWith("an")) return w.slice(0, -2);
  if (w.endsWith("a") || w.endsWith("e") || w.endsWith("i") || w.endsWith("o")) return w.slice(0, -1);
  return w;
}

/**
 * Ali je beseda pridevnik (modifier) ali samostalnik (base product)
 * "čokoladni" je pridevnik, "čokolada" je samostalnik
 */
function isAdjective(word: string): boolean {
  const w = word.toLowerCase();
  // Tipične slovenske pridevniške končnice
  return w.endsWith("ni") || w.endsWith("na") || w.endsWith("no") ||
         w.endsWith("ski") || w.endsWith("ški") || w.endsWith("ov") ||
         w.endsWith("ev") || w.endsWith("en") || w.endsWith("an") ||
         w.endsWith("ast") || w.endsWith("at");
}

/**
 * PAMETNO ISKANJE - Prioritizira TOČNE izdelke
 *
 * PRAVILA:
 * 1. "jabolko" → Jabolko Golden, NE "jabolčni sok"
 * 2. "čokolada" → Čokolada Milka, NE "čokoladni preliv"
 * 3. "mleko" → Mleko 1L, NE "Čokoladno mleko"
 * 4. "plenice" → Baby plenice, NE "Plenice za odrasle"
 * 5. "1l mleko" → TOČNO 1L mleko
 * 6. "krema za dojenčke" → Baby kreme
 */
function smartMatch(productName: string, searchQuery: string, unit: string): number {
  const nameLower = productName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const queryLower = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Odstrani velikosti iz query za iskanje besed (vključno s %, kos, kom)
  const queryWithoutSize = queryLower.replace(/\d+[,.]?\d*\s*(%|kg|g|l|ml|cl|dl|liter|litrov|kos|kom)/gi, "").trim();
  const queryWords = queryWithoutSize.split(/\s+/).filter(w => w.length > 1);

  if (queryWords.length === 0) return 0;

  // Besede v imenu izdelka (brez števil in enot)
  const nameWithoutSize = nameLower.replace(/\d+[,.]?\d*\s*(kg|g|l|ml|cl|dl|kos|kom|%)/gi, "");
  const nameWords = nameWithoutSize.split(/[\s,\-\/]+/).filter(w => w.length > 1);

  // Pridobi korenine besed
  const queryRoots = queryWords.map(w => getStemRoot(w));
  const nameRoots = nameWords.map(w => getStemRoot(w));

  // 1. Preveri TOČNO ujemanje (ali korena)
  let exactMatches = 0;
  let rootMatches = 0;
  let matchedAsAdjective = false;

  for (const qWord of queryWords) {
    const qRoot = getStemRoot(qWord);

    for (let i = 0; i < nameWords.length; i++) {
      const nWord = nameWords[i];
      const nRoot = nameRoots[i];

      if (nWord === qWord) {
        exactMatches++;
        break;
      }
      else if (nRoot === qRoot || nWord.includes(qRoot) || qWord.includes(nRoot)) {
        rootMatches++;
        if (isAdjective(nWord) && !isAdjective(qWord)) {
          matchedAsAdjective = true;
        }
        break;
      }
    }
  }

  const totalMatches = exactMatches + rootMatches;
  if (totalMatches === 0) return 0;

  const matchRatio = totalMatches / queryWords.length;
  if (matchRatio < 1) return matchRatio * 20;

  // === PENALIZACIJA za pridevnike ===
  let adjectivePenalty = 0;
  if (matchedAsAdjective && exactMatches === 0) {
    adjectivePenalty = 150;
  }

  // === BONUS ZA TOČNO UJEMANJE ===
  let exactMatchBonus = exactMatches * 100;

  // === BONUS ZA VELIKOST ===
  let sizeMatchBonus = 0;
  const querySize = extractSize(queryLower);
  const productSize = extractSize(`${productName} ${unit}`);

  if (querySize && productSize && querySize.unit === productSize.unit) {
    const sizeDiff = Math.abs(querySize.value - productSize.value);
    if (sizeDiff === 0) {
      sizeMatchBonus = 200;
    } else if (sizeDiff <= querySize.value * 0.1) {
      sizeMatchBonus = 100;
    } else if (sizeDiff <= querySize.value * 0.5) {
      sizeMatchBonus = 20;
    } else {
      sizeMatchBonus = -80;
    }
  }

  // === ENOSTAVNOST ===
  const extraWords = nameWords.length - queryWords.length;
  const simplicityScore = Math.max(0, 120 - extraWords * 35);

  // === POZICIJA ===
  let positionBonus = 0;
  if (nameWords.length > 0) {
    const firstWordRoot = getStemRoot(nameWords[0]);
    for (const qw of queryWords) {
      const qRoot = getStemRoot(qw);
      if (nameWords[0] === qw || firstWordRoot === qRoot) {
        positionBonus = 80;
        break;
      }
    }
  }

  // === VELIKOST (če uporabnik NI specificiral) ===
  let sizeScore = 0;
  if (!querySize) {
    sizeScore = getSizeScore(productName, unit);
  }

  // === PENALIZACIJA za okuse ===
  const FLAVOR_MODIFIERS = [
    "cokolad", "vanilij", "jagod", "lesnik", "karamel", "banana", "visnja",
    "malin", "borovnic", "breskev", "marelica", "ananas", "limona", "pomaran",
    "jabolc", "orehov", "mandljev", "pistacij", "kokos", "sladka", "slana",
    "dimljen", "prekajan", "pikant", "light", "zero", "protein"
  ];

  let flavorPenalty = 0;
  for (const flavor of FLAVOR_MODIFIERS) {
    if (nameLower.includes(flavor) && !queryLower.includes(flavor.slice(0, 4))) {
      flavorPenalty += 35;
    }
  }

  // === PENALIZACIJA za derivative ===
  const DERIVATIVE_WORDS = [
    "preliv", "omaka", "namaz", "dodatek", "posip", "glazura",
    "sirup", "sos", "dip", "marinada", "zacimba"
  ];

  let derivativePenalty = 0;
  for (const deriv of DERIVATIVE_WORDS) {
    if (nameLower.includes(deriv) && !queryLower.includes(deriv)) {
      derivativePenalty += 60;
    }
  }

  // === PENALIZACIJA ZA "ZA ODRASLE" ===
  // "plenice" → baby plenice, NE "plenice za odrasle"
  let adultProductPenalty = 0;
  const ADULT_MARKERS = ["za odrasle", "adult", "inkontinenc", "tena ", "seni "];
  const isAdultProduct = ADULT_MARKERS.some(marker => nameLower.includes(marker));
  const queryWantsAdult = queryLower.includes("odrasl") || queryLower.includes("adult") || queryLower.includes("tena") || queryLower.includes("inkontinenc");

  if (isAdultProduct && !queryWantsAdult) {
    adultProductPenalty = 200;
  }

  // === BONUS ZA BABY IZDELKE ===
  let babyBonus = 0;
  const BABY_KEYWORDS = [
    "baby", "dojenck", "dojenc", "otrosk", "otroc", "malck", "malc",
    "pampers", "huggies", "babylove", "chicco", "avent", "nuk", "mam",
    "johnson", "sudocrem", "bepanthen", "bobas", "junior"
  ];
  const BABY_PRODUCT_TYPES = ["plenic", "dudka", "dudke", "steklen", "robck", "body", "pajac"];

  const isBabyProduct = BABY_KEYWORDS.some(kw => nameLower.includes(kw));
  const queryIsBabyType = BABY_PRODUCT_TYPES.some(pt => queryLower.includes(pt));
  const queryHasBabyKeyword = BABY_KEYWORDS.some(kw => queryLower.includes(kw));

  if (queryIsBabyType && isBabyProduct) {
    babyBonus = 100;
  }
  if (queryHasBabyKeyword && isBabyProduct) {
    babyBonus = 150;
  }

  // === BONUS ZA "ZA DOJENČKE", "ZA OTROKE" ===
  let targetAudienceBonus = 0;
  if (queryLower.includes("za dojenc") || queryLower.includes("za otrok") || queryLower.includes("za malc")) {
    const targetMatches = ["dojenc", "otrosk", "otrok", "baby", "malc", "junior", "kids"];
    if (targetMatches.some(t => nameLower.includes(t))) {
      targetAudienceBonus = 100;
    }
  }

  // === PENALIZACIJA ZA NEPOVEZANE IZDELKE ===
  let irrelevantPenalty = 0;
  const primaryProductWord = nameWords[0] || "";
  const queryMatchesPrimary = queryWords.some(qw => {
    const qRoot = getStemRoot(qw);
    const pRoot = getStemRoot(primaryProductWord);
    return primaryProductWord.includes(qw) || qw.includes(primaryProductWord) ||
           pRoot === qRoot || primaryProductWord.includes(qRoot) || qw.includes(pRoot);
  });

  if (!queryMatchesPrimary && exactMatches === 0) {
    irrelevantPenalty = 100;
  }

  // === KONČNI SCORE ===
  const finalScore = exactMatchBonus + sizeMatchBonus + simplicityScore + positionBonus + sizeScore
                     + babyBonus + targetAudienceBonus
                     - adjectivePenalty - flavorPenalty - derivativePenalty
                     - adultProductPenalty - irrelevantPenalty;

  return Math.max(1, finalScore);
}

// Iskanje izdelkov - PAMETNO razvrščanje
export const search = query({
  args: {
    query: v.string(),
    isPremium: v.boolean(),
  },
  returns: v.array(
    v.object({
      _id: v.id("products"),
      _creationTime: v.number(),
      name: v.string(),
      nameKey: v.optional(v.string()),
      category: v.string(),
      unit: v.string(),
      imageUrl: v.optional(v.string()),
      prices: v.array(
        v.object({
          storeId: v.id("stores"),
          storeName: v.string(),
          storeColor: v.string(),
          price: v.number(),
          originalPrice: v.optional(v.number()),
          isOnSale: v.boolean(),
          saleValidFrom: v.optional(v.string()),
          saleValidUntil: v.optional(v.string()),
        })
      ),
      lowestPrice: v.number(),
      highestPrice: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    if (!args.query || !args.query.trim() || args.query.trim().length < 2) {
      return [];
    }

    const searchQuery = args.query.trim();

    // 1. Pridobi kandidate iz search indexa
    const searchCandidates = await ctx.db
      .query("products")
      .withSearchIndex("search_name", (q) => q.search("name", searchQuery.toLowerCase()))
      .take(500);

    // 2. Fallback če premalo rezultatov
    let allProducts = searchCandidates;
    if (searchCandidates.length < 50) {
      allProducts = await ctx.db.query("products").take(3000);
    }

    // 3. Oceni vsak izdelek s PAMETNIM algoritmom
    // MINIMALNI SCORE: 50 - pod tem pragom izdelek ni dovolj relevanten
    const MIN_SCORE_THRESHOLD = 50;

    const scoredProducts = allProducts
      .map(product => ({
        product,
        score: smartMatch(product.name, searchQuery, product.unit),
      }))
      .filter(item => item.score >= MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 100) // Več kandidatov
      .map(item => item.product);

    // 4. Pridobi trgovine
    const stores = await ctx.db.query("stores").collect();
    const storeMap = new Map(
      stores
        .filter((store) => ALLOWED_STORE_NAMES.has(store.name))
        .map((store) => [store._id, store])
    );

    // 5. Pridobi cene za vsak izdelek
    const results = await Promise.all(
      scoredProducts.map(async (product) => {
        const prices = await ctx.db
          .query("prices")
          .withIndex("by_product", (q) => q.eq("productId", product._id))
          .collect();

        const pricesWithStores = prices
          .map((price) => {
            const store = storeMap.get(price.storeId);
            if (!store) return null;
            if (!args.isPremium && store.isPremium) return null;
            if (!Number.isFinite(price.price) || price.price < 0.05) return null;
            return {
              storeId: price.storeId,
              storeName: store.name,
              storeColor: store.color,
              price: price.price,
              originalPrice: price.originalPrice,
              isOnSale: price.isOnSale,
              saleValidFrom: price.saleValidFrom,
              saleValidUntil: price.saleValidUntil,
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .sort((a, b) => a.price - b.price);

        if (pricesWithStores.length === 0) return null;

        const validPriceNumbers = pricesWithStores.map((p) => p.price);

        return {
          ...product,
          prices: pricesWithStores,
          lowestPrice: Math.min(...validPriceNumbers),
          highestPrice: Math.max(...validPriceNumbers),
        };
      })
    );

    // 6. Filtriraj in končno razvrsti
    const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null && r.prices.length > 0);

    // Končno razvrščanje: VELIKOST > ENOSTAVNOST > CENA
    return validResults.sort((a, b) => {
      const aSize = getSizeScore(a.name, a.unit);
      const bSize = getSizeScore(b.name, b.unit);
      const aSmart = smartMatch(a.name, searchQuery, a.unit);
      const bSmart = smartMatch(b.name, searchQuery, b.unit);

      // Kombiniran score: 50% pametnost, 40% velikost, 10% cena
      const maxPrice = 30;
      const aPriceScore = 100 - Math.min(a.lowestPrice / maxPrice * 100, 100);
      const bPriceScore = 100 - Math.min(b.lowestPrice / maxPrice * 100, 100);

      const aTotal = aSmart * 0.5 + aSize * 0.4 + aPriceScore * 0.1;
      const bTotal = bSmart * 0.5 + bSize * 0.4 + bPriceScore * 0.1;

      return bTotal - aTotal;
    });
  },
});

// Pridobi izdelek po ID
export const getById = query({
  args: { productId: v.id("products") },
  returns: v.union(
    v.object({
      _id: v.id("products"),
      _creationTime: v.number(),
      name: v.string(),
      nameKey: v.optional(v.string()),
      category: v.string(),
      unit: v.string(),
      imageUrl: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.productId);
  },
});

// Število vseh izdelkov
export const count = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    return products.length;
  },
});

// Statistika slik
export const imageStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    withImage: v.number(),
    withoutImage: v.number(),
  }),
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    return {
      total: products.length,
      withImage: products.filter(p => p.imageUrl).length,
      withoutImage: products.filter(p => !p.imageUrl).length,
    };
  },
});

// Pridobi izdelke brez slik (za image scraper)
export const getProductsWithoutImages = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("products"),
      name: v.string(),
      category: v.string(),
      unit: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const offset = args.offset ?? 0;

    const products = await ctx.db.query("products").collect();

    // Filtriraj izdelke brez slik
    const withoutImages = products
      .filter(p => !p.imageUrl)
      .slice(offset, offset + limit)
      .map(p => ({
        _id: p._id,
        name: p.name,
        category: p.category,
        unit: p.unit,
      }));

    return withoutImages;
  },
});

// Posodobi sliko izdelka
export const updateProductImage = mutation({
  args: {
    productId: v.id("products"),
    imageUrl: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return false;

    await ctx.db.patch(args.productId, {
      imageUrl: args.imageUrl,
    });

    return true;
  },
});

// Batch posodobitev slik
export const batchUpdateImages = mutation({
  args: {
    updates: v.array(
      v.object({
        productId: v.id("products"),
        imageUrl: v.string(),
      })
    ),
  },
  returns: v.object({
    updated: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    let updated = 0;
    let failed = 0;

    for (const update of args.updates) {
      try {
        const product = await ctx.db.get(update.productId);
        if (product) {
          await ctx.db.patch(update.productId, {
            imageUrl: update.imageUrl,
          });
          updated++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { updated, failed };
  },
});
