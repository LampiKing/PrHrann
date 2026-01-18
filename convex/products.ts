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
 * Standardne velikosti (1L, 1kg) imajo OGROMNO prednost
 * Majhna pakiranja (pod 500ml/g) so MOČNO penalizirana
 *
 * POMEMBNO: Majhne velikosti se preverjajo NAJPREJ da "0,2 l" ne ujema "2 l"!
 */
function getSizeScore(name: string, unit: string): number {
  const text = `${name} ${unit}`.toLowerCase();

  // === NAJPREJ PREVERI MAJHNA PAKIRANJA ===
  // To prepreči da "0,2 l" ujema "2 l" regex!
  // 200ml in manj je "potovalna velikost" - NE SME biti prvi rezultat!
  if (/0[,.]2\s*l\b|\b200\s*ml\b/i.test(text)) return -200;
  if (/0[,.]18\s*l\b|\b180\s*ml\b/i.test(text)) return -220;
  if (/0[,.]15\s*l\b|\b150\s*ml\b/i.test(text)) return -240;
  if (/0[,.]125\s*l\b|\b125\s*ml\b/i.test(text)) return -260;
  if (/0[,.]1\s*l\b|\b100\s*ml\b/i.test(text)) return -300;
  if (/0[,.]05\s*l\b|\b50\s*ml\b/i.test(text)) return -400;

  // Majhna pakiranja v gramih
  if (/\b100\s*g\b/i.test(text)) return -30;
  if (/\b90\s*g\b/i.test(text)) return -40;
  if (/\b80\s*g\b/i.test(text)) return -50;
  if (/\b75\s*g\b/i.test(text)) return -60;
  if (/\b70\s*g\b/i.test(text)) return -70;
  if (/\b50\s*g\b/i.test(text)) return -80;
  if (/\b40\s*g\b/i.test(text)) return -90;
  if (/\b30\s*g\b/i.test(text)) return -100;
  if (/\b25\s*g\b/i.test(text)) return -110;
  if (/\b20\s*g\b/i.test(text)) return -120;

  // === STANDARDNE VELIKOSTI - kar ljudje dejansko kupujejo ===
  if (/\b1\s*kg\b|\b1000\s*g\b/i.test(text)) return 200;
  if (/\b1\s*l\b|\b1000\s*ml\b|\b1\s*liter\b/i.test(text)) return 200;
  if (/\b1[,.]5\s*l\b|\b1500\s*ml\b/i.test(text)) return 195;
  if (/\b2\s*l\b|\b2000\s*ml\b/i.test(text)) return 190;
  if (/\b500\s*g\b|\b0[,.]5\s*kg\b/i.test(text)) return 180;
  if (/\b500\s*ml\b|\b0[,.]5\s*l\b/i.test(text)) return 180;
  if (/\b750\s*ml\b/i.test(text)) return 170;
  if (/\b400\s*g\b/i.test(text)) return 160;
  if (/\b330\s*ml\b/i.test(text)) return 150;
  if (/\b300\s*g\b/i.test(text)) return 140;
  if (/\b250\s*g\b/i.test(text)) return 130;
  if (/\b250\s*ml\b/i.test(text)) return 120;

  // === SREDNJE velikosti ===
  if (/\b200\s*g\b/i.test(text)) return 80;
  if (/\b150\s*g\b/i.test(text)) return 70;

  return 50; // neznana velikost - srednje
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

  // === MEGA BONUS: Iskalna beseda je PRVA beseda v imenu izdelka ===
  // "Mleko" → "Mleko polnomastno 1L" dobi OGROMEN bonus
  // "Mleko" → "Čokoladno mleko" dobi OGROMNO penalizacijo
  let primaryWordBonus = 0;
  let secondaryWordPenalty = 0;

  if (nameWords.length > 0 && queryWords.length === 1) {
    // Enobesedna poizvedba - preveri ali je to primarna beseda
    const queryRoot = queryRoots[0];
    const firstNameRoot = nameRoots[0];
    const queryWord = queryWords[0];
    const firstNameWord = nameWords[0];

    // Ali je iskalna beseda PRVA beseda v imenu?
    const isFirstWord = firstNameWord === queryWord ||
                        firstNameRoot === queryRoot ||
                        firstNameWord.startsWith(queryWord) ||
                        firstNameWord.startsWith(queryRoot);

    if (isFirstWord) {
      // OGROMEN bonus - to je osnovni izdelek
      primaryWordBonus = 300;
    } else {
      // Iskalna beseda je nekje drugje v imenu - to je verzija/okus
      // npr. "Čokoladno MLEKO", "Vaniljev JOGURT"
      const foundLater = nameWords.slice(1).some((nw, idx) => {
        const nRoot = nameRoots[idx + 1];
        return nw === queryWord || nRoot === queryRoot || nw.includes(queryRoot);
      });

      if (foundLater) {
        // Penaliziraj - to NI primarni izdelek
        secondaryWordPenalty = 250;
      }
    }
  }

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
                     + babyBonus + targetAudienceBonus + primaryWordBonus
                     - adjectivePenalty - flavorPenalty - derivativePenalty
                     - adultProductPenalty - irrelevantPenalty - secondaryWordPenalty;

  return Math.max(1, finalScore);
}

/**
 * SINONIMI - Slovenski izrazi → kako so shranjeni v bazi
 * Ko uporabnik išče "čaj", najdemo "tea" izdelke
 */
const SEARCH_SYNONYMS: Record<string, string[]> = {
  // Pijače
  "čaj": ["čaj", "caj", "tea", "zeliščni", "zelišč"],
  "caj": ["čaj", "caj", "tea", "zeliščni"],
  "kava": ["kava", "coffee", "espresso", "barcaffe"],

  // Otroški izdelki
  "plenice": ["plenice", "pampers", "huggies", "babylove", "pelene", "baby"],
  "pelene": ["plenice", "pampers", "pelene", "baby"],
  "dude": ["duda", "dudka", "cucelj", "avent", "nuk"],

  // Čistila
  "pralni prašek": ["pralni", "detergent", "persil", "ariel", "tide"],
  "pralni prasek": ["pralni", "detergent", "persil", "ariel"],
  "detergent": ["detergent", "pralni", "persil", "ariel"],
  "mehčalec": ["mehčalec", "mehcalec", "lenor", "silan"],

  // Sadje
  "pomaranče": ["pomaranča", "pomaranče", "oranža", "orange", "citrus"],
  "pomaranca": ["pomaranča", "pomaranče", "oranža", "orange"],
  "banane": ["banana", "banane"],
  "banana": ["banana", "banane"],
  "jabolka": ["jabolka", "jabolko", "apple"],
  "limone": ["limona", "limone", "lemon"],

  // Meso
  "piščanec": ["piščanc", "pišcanc", "piščančje", "chicken", "perutnina"],
  "piscancje meso": ["piščanc", "pišcanc", "piščančje", "perutnina"],
  "govedina": ["goveje", "govedina", "beef", "juneće"],
  "svinjina": ["svinjsko", "svinjina", "pork"],

  // Mlečni izdelki
  "jogurt": ["jogurt", "yogurt", "activia", "ego"],
  "skuta": ["skuta", "cottage", "ricotta"],
  "smetana": ["smetana", "cream", "kisla smetana"],

  // Paštete
  "pašteta": ["pašteta", "pasteta", "argeta", "pate"],
  "pasteta": ["pašteta", "pasteta", "argeta", "pate"],

  // Higiena
  "toaletni papir": ["toaletni papir", "wc papir", "toilet"],
  "wc papir": ["toaletni papir", "wc papir", "toilet"],
  "zobna pasta": ["zobna pasta", "colgate", "sensodyne", "oral"],
  "šampon": ["šampon", "sampon", "shampoo", "head"],
  "milo": ["milo", "soap", "dove", "nivea"],

  // Splošno
  "čokolada": ["čokolada", "cokolada", "chocolate", "milka", "kinder"],
  "cokolada": ["čokolada", "cokolada", "chocolate", "milka"],

  // Hrana
  "pica": ["pizza", "pica"],
  "pizza": ["pizza", "pica"],
  "nutella": ["nutella", "namaz", "lešnik", "ferrero", "krema čokolad"],
  "namaz čokolada": ["nutella", "namaz", "čokoladni namaz", "ferrero"],
  "sendvič": ["sendvič", "sendvic", "sandwich", "toast"],
  "sendvic": ["sendvič", "sendvic", "sandwich", "toast"],
};

/**
 * Razširi iskalni pojem s sinonimi
 */
function expandSearchQuery(query: string): string[] {
  const queryLower = query.toLowerCase().trim();
  const synonyms = SEARCH_SYNONYMS[queryLower];

  if (synonyms) {
    return [queryLower, ...synonyms];
  }

  // Preveri tudi delne ujemanja
  for (const [key, values] of Object.entries(SEARCH_SYNONYMS)) {
    if (queryLower.includes(key) || key.includes(queryLower)) {
      return [queryLower, ...values];
    }
  }

  return [queryLower];
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

    // 1. Razširi iskalni pojem s sinonimi
    const searchTerms = expandSearchQuery(searchQuery);

    // 2. Pridobi kandidate iz search indexa za VSE sinonime
    const seenIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchCandidates: any[] = [];

    for (const term of searchTerms) {
      const candidates = await ctx.db
        .query("products")
        .withSearchIndex("search_name", (q) => q.search("name", term.toLowerCase()))
        .take(200);

      for (const candidate of candidates) {
        const idStr = String(candidate._id);
        if (!seenIds.has(idStr)) {
          seenIds.add(idStr);
          searchCandidates.push(candidate);
        }
      }
    }

    // 3. Fallback če premalo rezultatov
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allProducts: any[] = searchCandidates;
    if (searchCandidates.length < 50) {
      allProducts = await ctx.db.query("products").take(3000);
    }

    // 3. Oceni vsak izdelek s PAMETNIM algoritmom
    // MINIMALNI SCORE: 50 - pod tem pragom izdelek ni dovolj relevanten
    const MIN_SCORE_THRESHOLD = 50;

    const scoredProducts = allProducts
      .map(product => {
        // Uporabi NAJBOLJŠI score med originalnim query IN vsemi sinonimi
        // To omogoča da "pica" najde "pizza" izdelke
        let bestSmartScore = smartMatch(product.name, searchQuery, product.unit);
        for (const term of searchTerms) {
          const termScore = smartMatch(product.name, term, product.unit);
          if (termScore > bestSmartScore) {
            bestSmartScore = termScore;
          }
        }
        const smartScore = bestSmartScore;
        const sizeScore = getSizeScore(product.name, product.unit);
        // Kombiniran score: relevantnost + velikost (majhne velikosti dobijo negativen score)
        const combinedScore = smartScore + sizeScore;
        return { product, smartScore, sizeScore, combinedScore };
      })
      .filter(item => item.smartScore >= MIN_SCORE_THRESHOLD)
      .sort((a, b) => {
        // NAJPREJ: Standardne velikosti pred majhnimi
        const aIsStandard = a.sizeScore >= 100;
        const bIsStandard = b.sizeScore >= 100;
        const aIsTiny = a.sizeScore < 0;
        const bIsTiny = b.sizeScore < 0;

        if (aIsStandard && bIsTiny) return -1;
        if (bIsStandard && aIsTiny) return 1;
        if (a.sizeScore > 0 && bIsTiny) return -1;
        if (b.sizeScore > 0 && aIsTiny) return 1;

        // Potem po kombiniranem score
        return b.combinedScore - a.combinedScore;
      })
      .slice(0, 100)
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

    // Končno razvrščanje: RELEVANTNOST > VELIKOST > CENA
    // POMEMBNO: Standardne velikosti (1L, 1kg) MORAJO biti pred majhnimi (200ml)
    return validResults.sort((a, b) => {
      const aSize = getSizeScore(a.name, a.unit);
      const bSize = getSizeScore(b.name, b.unit);
      const aSmart = smartMatch(a.name, searchQuery, a.unit);
      const bSmart = smartMatch(b.name, searchQuery, b.unit);

      // NAJPREJ: Ali je ena od velikosti "standardna" in druga "majhna"?
      // Standardna = 500ml+ ali 250g+
      // Majhna = pod 250ml ali pod 100g
      const aIsStandard = aSize >= 100; // 1L, 1kg, 500ml, itd.
      const bIsStandard = bSize >= 100;
      const aIsTiny = aSize < 0; // 200ml in manj
      const bIsTiny = bSize < 0;

      // Standardni izdelki VEDNO pred majhnimi - NE GLEDE NA CENO
      if (aIsStandard && bIsTiny) return -1;
      if (bIsStandard && aIsTiny) return 1;

      // Tudi med ne-standardnimi, večji pride pred manjšim
      if (aSize > 0 && bIsTiny) return -1;
      if (bSize > 0 && aIsTiny) return 1;

      // Kombiniran score: 50% pametnost, 35% velikost, 15% cena (cenejši višje)
      const maxPrice = 30;
      const aPriceScore = 100 - Math.min(a.lowestPrice / maxPrice * 100, 100);
      const bPriceScore = 100 - Math.min(b.lowestPrice / maxPrice * 100, 100);

      const aTotal = aSmart * 0.50 + aSize * 0.35 + aPriceScore * 0.15;
      const bTotal = bSmart * 0.50 + bSize * 0.35 + bPriceScore * 0.15;

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
