/**
 * PrHran - Primerjava cen
 * Coded by LampiPizza
 * © 2026
 */
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
 * BESEDE KI SE ZAČNEJO ENAKO, A SO POPOLNOMA RAZLIČNE
 * npr. "sol" vs "solata" - sol=salt, solata=salad
 * Te pare moramo eksplicitno ločiti!
 */
const DISTINCT_WORD_PAIRS: Record<string, string[]> = {
  "sol": ["solata", "solatna", "solatni", "solaten"],  // sol ≠ solata
  "sir": ["sirup", "sirov"],                           // sir (cheese) ≠ sirup (syrup)
  "rib": ["ribana", "ribani", "ribano"],              // riba ≠ ribana (grated)
  "med": ["medeno", "medena", "medeni", "meden"],     // med (honey) ≠ meden (copper/bronze)
};

/**
 * Preveri ali sta dve besedi popolnoma različni kljub podobnemu začetku
 */
function areDistinctWords(queryWord: string, productWord: string): boolean {
  const qLower = queryWord.toLowerCase();
  const pLower = productWord.toLowerCase();

  const distinctList = DISTINCT_WORD_PAIRS[qLower];
  if (distinctList && distinctList.some(distinct => pLower.startsWith(distinct) || pLower === distinct)) {
    return true;
  }
  return false;
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
 * 7. "sol" → Sol, NE "Solata"
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

  // Track partial/substring matches separately - they should be penalized
  let partialMatches = 0;

  for (const qWord of queryWords) {
    const qRoot = getStemRoot(qWord);

    for (let i = 0; i < nameWords.length; i++) {
      const nWord = nameWords[i];
      const nRoot = nameRoots[i];

      // NAJPREJ: Preveri ali sta besedi eksplicitno RAZLIČNI (npr. sol ≠ solata)
      if (areDistinctWords(qWord, nWord)) {
        // Te besede so popolnoma različne - IGNORIRAJ!
        continue;
      }

      // 1. TOČNO ujemanje besede
      if (nWord === qWord) {
        exactMatches++;
        break;
      }
      // 2. TOČNO ujemanje korena (npr. "mleko" = "mlek" = "mleka")
      else if (nRoot === qRoot && nRoot.length >= 3) {
        rootMatches++;
        if (isAdjective(nWord) && !isAdjective(qWord)) {
          matchedAsAdjective = true;
        }
        break;
      }
      // 3. Beseda se ZAČNE z iskalno besedo (npr. "sol" -> "solni")
      // AMPAK: kratka beseda (3-4 znaki) ne sme matchati veliko daljše besede
      // npr. "sol" (3) ne sme matchati "solata" (6) ali "solatna" (7) ker je to druga beseda!
      // KRITIČNO: "sol" ≠ "solata" (sol=salt, solata=salad - popolnoma različni besedi!)
      else if (nWord.startsWith(qWord) && qWord.length >= 3) {
        const lengthDiff = nWord.length - qWord.length;

        // Dinamični prag glede na dolžino iskalne besede:
        // - 3 znaki (npr "sol") → max diff 2 (dovoli "solni", "solna", NE "solata"!)
        // - 4 znaki → max diff 2
        // - 5+ znakov → max diff 3
        const maxAllowedDiff = qWord.length <= 4 ? 2 : 3;

        if (lengthDiff <= maxAllowedDiff) {
          rootMatches++;
          break;
        }
        // Drugače je to partial match z nizkim scorom
        partialMatches++;
        break;
      }
      // 4. SUBSTRING match - ZELO SLABO! (npr. "sol" v "solatna")
      // Samo če je query dolg vsaj 4 znake, sicer ignoriramo
      else if (qWord.length >= 4 && nWord.includes(qWord)) {
        partialMatches++;
        break;
      }
    }
  }

  const totalMatches = exactMatches + rootMatches + partialMatches;
  if (totalMatches === 0) return 0;

  // Če imamo SAMO partial matches (substring), to je zelo slab rezultat
  // npr. "sol" najde "solatna" - to NI sol!
  if (exactMatches === 0 && rootMatches === 0 && partialMatches > 0) {
    return 10; // Zelo nizek score - bo filtriran s MIN_SCORE_THRESHOLD
  }

  const matchRatio = (exactMatches + rootMatches) / queryWords.length;
  if (matchRatio < 1) return matchRatio * 20;

  // === PENALIZACIJA za pridevnike ===
  let adjectivePenalty = 0;
  if (matchedAsAdjective && exactMatches === 0) {
    adjectivePenalty = 150;
  }

  // === BONUS ZA TOČNO UJEMANJE ===
  let exactMatchBonus = exactMatches * 100;

  // === MEGA BONUS: Vse iskalne besede se ujemajo ===
  // Za "alpsko mleko" morajo OBILE besedi matchati za visok score
  // To prepreči da "Mleko trajno 0,2L" zmaga pred "Alpsko mleko 1L"
  let allWordsMatchBonus = 0;
  if (queryWords.length >= 2 && (exactMatches + rootMatches) >= queryWords.length) {
    // VSE besede se ujemajo - to je ZELO relevanten rezultat!
    allWordsMatchBonus = 200;
  }

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
        // Penaliziraj - ampak NE preveč za blagovne znamke
        // "Keksi Jaffa" - Jaffa je blagovna znamka, ne okus
        // Če je iskalna beseda med 2.-4. besedo, je verjetno blagovna znamka
        const foundAtIndex = nameWords.findIndex((nw, idx) => {
          if (idx === 0) return false;
          const nRoot = nameRoots[idx];
          return nw === queryWord || nRoot === queryRoot || nw.includes(queryRoot);
        });

        if (foundAtIndex >= 1 && foundAtIndex <= 3) {
          // Verjetno blagovna znamka (Jaffa, Milka, Kraš) - majhna penalizacija
          secondaryWordPenalty = 30;
        } else {
          // Okus ali modifier na koncu - večja penalizacija
          secondaryWordPenalty = 150;
        }
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

  // === PENALIZACIJA ZA HRANO ZA ŽIVALI ===
  // "pašteta" → Argeta (človeška hrana), NE "Pašteta za Pse Tačko"
  // "hrana" → človeška hrana, NE "hrana za pse/mačke"
  let petFoodPenalty = 0;
  const PET_FOOD_MARKERS = [
    "za pse", "za mačke", "za macke", "za živali", "za zivali",
    "za psa", "za mačko", "za macko", "za mucke", "za muce",
    "dog", "cat food", "pet food", "petfood",
    "tačko", "tacko", "tačka", "tacka", // Tačko je blagovna znamka za pse
    "kitekat", "whiskas", "pedigree", "chappi", "friskies",
    "purina", "felix", "sheba", "cesar", "royal canin",
    "briketi", "granule za", "pasja", "mačja", "macja",
    "za hišne", "za hisne", "za ljubimce"
  ];
  const isPetFood = PET_FOOD_MARKERS.some(marker => nameLower.includes(marker));
  const queryWantsPetFood = queryLower.includes("za pse") || queryLower.includes("za psa") ||
                            queryLower.includes("za mačk") || queryLower.includes("za mack") ||
                            queryLower.includes("za muc") || queryLower.includes("pasj") ||
                            queryLower.includes("mačj") || queryLower.includes("macj") ||
                            queryLower.includes("dog") || queryLower.includes("cat") ||
                            queryLower.includes("tačko") || queryLower.includes("tacko") ||
                            queryLower.includes("za živali") || queryLower.includes("za zivali") ||
                            queryLower.includes("za ljubimce");

  if (isPetFood && !queryWantsPetFood) {
    petFoodPenalty = 500; // ZELO visoka penalizacija - hrana za živali NE SME biti med prvimi rezultati
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
                     + babyBonus + targetAudienceBonus + primaryWordBonus + allWordsMatchBonus
                     - adjectivePenalty - flavorPenalty - derivativePenalty
                     - adultProductPenalty - petFoodPenalty - irrelevantPenalty - secondaryWordPenalty;

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
  "sok": ["sok", "juice", "nektar", "100%"],
  "voda": ["voda", "water", "mineralna", "naravna"],
  "pivo": ["pivo", "beer", "laško", "union", "heineken"],
  "vino": ["vino", "wine", "belo", "rdeče"],

  // Pekovski izdelki - ZELO POGOSTO ISKANO
  "kruh": ["kruh", "bread", "hlebec", "štruca"],
  "beli kruh": ["beli kruh", "bel kruh", "white bread"],
  "črni kruh": ["črni kruh", "crni kruh", "rženi kruh"],
  "žemlja": ["žemlja", "zemlja", "žemlje", "zemlje", "roll", "kajzerica"],
  "žemlje": ["žemlja", "zemlja", "žemlje", "zemlje", "roll", "kajzerica"],
  "zemlja": ["žemlja", "zemlja", "žemlje", "zemlje"],
  "zemlje": ["žemlja", "zemlja", "žemlje", "zemlje"],
  "pecivo": ["pecivo", "kroasan", "burek", "štruklji"],
  "toast": ["toast", "tost", "sendvič kruh"],

  // Moka in peka
  "moka": ["moka", "flour", "pšenična moka"],
  "sladkor": ["sladkor", "sugar", "kristalni sladkor"],
  "sol": ["sol", "salt", "solni", "solna"],
  "morska sol": ["morska sol", "sea salt"],
  "kuhinjska sol": ["kuhinjska sol", "table salt"],
  "kvas": ["kvas", "yeast", "droži"],
  "olje": ["olje", "oil", "sončnično", "oljčno", "olivno"],

  // Otroški izdelki
  "plenice": ["plenice", "pampers", "huggies", "babylove", "pelene", "baby"],
  "pelene": ["plenice", "pampers", "pelene", "baby"],
  "dude": ["duda", "dudka", "cucelj", "avent", "nuk"],

  // Čistila
  "pralni prašek": ["pralni", "detergent", "persil", "ariel", "tide"],
  "pralni prasek": ["pralni", "detergent", "persil", "ariel"],
  "detergent": ["detergent", "pralni", "persil", "ariel"],
  "mehčalec": ["mehčalec", "mehcalec", "lenor", "silan"],
  "fairy": ["fairy", "detergent za posodo", "pomivalno", "jar"],

  // Sadje
  "pomaranče": ["pomaranča", "pomaranče", "oranža", "orange", "citrus"],
  "pomaranca": ["pomaranča", "pomaranče", "oranža", "orange"],
  "banane": ["banana", "banane"],
  "banana": ["banana", "banane"],
  "jabolka": ["jabolka", "jabolko", "apple"],
  "jabolko": ["jabolka", "jabolko", "apple", "golden", "jonagold"],
  "limone": ["limona", "limone", "lemon"],
  "paradižnik": ["paradižnik", "paradiżnik", "tomato", "rajčica"],
  "krompir": ["krompir", "potato", "mladinski"],
  "čebula": ["čebula", "cebula", "onion", "čebule"],
  "paprika": ["paprika", "pepper", "paprike", "babura"],
  "kumare": ["kumara", "kumare", "cucumber"],
  "solata": ["solata", "salad", "zelena", "ledena"],

  // Meso in mesni izdelki
  "piščanec": ["piščanc", "pišcanc", "piščančje", "chicken", "perutnina"],
  "piscancje meso": ["piščanc", "pišcanc", "piščančje", "perutnina"],
  "govedina": ["goveje", "govedina", "beef", "juneće"],
  "svinjina": ["svinjsko", "svinjina", "pork"],
  "salama": ["salama", "salami", "mortadela", "klobasa"],
  "mortadela": ["mortadela", "salama", "posebna"],
  "hrenovka": ["hrenovka", "hrenovke", "viršla", "hot dog"],
  "šunka": ["šunka", "sunka", "ham", "pršut"],
  "sunka": ["šunka", "sunka", "ham", "pršut"],
  "pršut": ["pršut", "prsut", "prosciutto", "kraški"],
  "slanina": ["slanina", "bacon", "panceta"],

  // Mlečni izdelki
  "mleko": ["mleko", "milk"],
  "alpsko mleko": ["alpsko mleko", "alpsko", "alpska mlekarna"],
  "trajno mleko": ["trajno mleko", "uht mleko"],
  "sveže mleko": ["sveže mleko", "sveze mleko", "pasterizirano"],
  "jogurt": ["jogurt", "yogurt", "activia", "ego", "navadni", "sadni"],
  "skuta": ["skuta", "cottage", "ricotta", "sveža"],
  "smetana": ["smetana", "cream", "kisla smetana", "sladka"],
  "sir": ["sir", "cheese", "gavda", "edamer", "trapist"],
  "maslo": ["maslo", "butter", "margarina"],
  "jajca": ["jajca", "jajce", "eggs", "prosta reja"],
  "parmezan": ["parmezan", "parmigiano", "grana padano", "trdi sir"],

  // Paštete in namazi
  "pašteta": ["pašteta", "pasteta", "argeta", "pate", "jetrna"],
  "pasteta": ["pašteta", "pasteta", "argeta", "pate"],
  "namaz": ["namaz", "spread", "čokoladni", "lešnikov"],

  // Higiena
  "toaletni papir": ["toaletni papir", "wc papir", "toilet"],
  "wc papir": ["toaletni papir", "wc papir", "toilet"],
  "zobna pasta": ["zobna pasta", "colgate", "sensodyne", "oral"],
  "šampon": ["šampon", "sampon", "shampoo", "head"],
  "milo": ["milo", "soap", "dove", "nivea"],

  // Sladkarije
  "čokolada": ["čokolada", "cokolada", "chocolate", "milka", "kinder"],
  "cokolada": ["čokolada", "cokolada", "chocolate", "milka"],
  "bonboni": ["bonboni", "bonbon", "candy", "haribo", "orbit"],
  "keksi": ["keksi", "keks", "cookie", "biscuit", "jaffa"],
  "sladoled": ["sladoled", "ice cream", "kornet", "lučka"],

  // Testenine in riž
  "testenine": ["testenine", "pasta", "špageti", "makaroni", "pene"],
  "špageti": ["špageti", "spageti", "spaghetti", "pasta"],
  "riz": ["riž", "riz", "rice", "basmati", "jasmin"],
  "riž": ["riž", "riz", "rice", "basmati"],

  // Konzerve
  "tuna": ["tuna", "tunina", "riba"],
  "fižol": ["fižol", "fizol", "beans"],
  "grah": ["grah", "peas", "čičerika"],
  "koruza": ["koruza", "corn", "sladka"],

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

    // 3. Uporabi samo search kandidate - BREZ fallbacka na random izdelke!
    // Fallback je povzročal da so se prikazovali nerelevantni izdelki
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allProducts: any[] = searchCandidates;

    // 3. Oceni vsak izdelek s PAMETNIM algoritmom
    // MINIMALNI SCORE: 80 - pod tem pragom izdelek ni dovolj relevanten
    // Povečano iz 50 na 80 za boljšo relevantnost rezultatov
    const MIN_SCORE_THRESHOLD = 80;

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
        // LOGIKA SORTIRANJA:
        // 1. Samo RELEVANTNI izdelki pridejo skozi filter (smartScore >= 80)
        // 2. Med relevantnimi: STANDARDNE VELIKOSTI (1L, 1kg, 500g) NAJPREJ
        // 3. Znotraj iste velikostne kategorije: po relevantnosti
        // 4. Na koncu: najcenejši

        const aIsStandard = a.sizeScore >= 100;  // 1L, 1kg, 500g+
        const bIsStandard = b.sizeScore >= 100;
        const aIsTiny = a.sizeScore < 0;         // <100ml, <100g
        const bIsTiny = b.sizeScore < 0;

        // NAJPREJ: Standardne velikosti pred majhnimi
        // To zagotavlja da 1L mleko pride pred 200ml mlekom
        if (aIsStandard && !bIsStandard) return -1;
        if (bIsStandard && !aIsStandard) return 1;

        // DRUGIČ: Srednje velikosti pred majhnimi
        if (!aIsTiny && bIsTiny) return -1;
        if (!bIsTiny && aIsTiny) return 1;

        // TRETJIČ: Med enakimi kategorijami, VEDNO večja velikost najprej
        // 1L > 500ml > 200ml
        if (a.sizeScore !== b.sizeScore) {
          return b.sizeScore - a.sizeScore;
        }

        // ČETRTIČ: Enaka velikost, sortiraj po relevantnosti
        const scoreDiff = b.smartScore - a.smartScore;
        if (Math.abs(scoreDiff) > 30) {
          return scoreDiff;
        }

        // PETIČ: Enaka velikost in relevantnost = po kombiniranem score
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

    // Končno razvrščanje: STANDARDNE VELIKOSTI + NAJCENEJŠI PRVI!
    // 1. Standardne velikosti (1L, 1kg, 500g) pred majhnimi (200ml, 100g)
    // 2. Znotraj podobnih velikosti: NAJCENEJŠI PRVI
    return validResults.sort((a, b) => {
      const aSize = getSizeScore(a.name, a.unit);
      const bSize = getSizeScore(b.name, b.unit);
      const aSmart = smartMatch(a.name, searchQuery, a.unit);
      const bSmart = smartMatch(b.name, searchQuery, b.unit);

      // Standardni izdelki (1L, 1kg, 500ml, 500g) = sizeScore >= 100
      const aIsStandard = aSize >= 100;
      const bIsStandard = bSize >= 100;
      // Majhna pakiranja (200ml, 100g in manj) = sizeScore < 0
      const aIsTiny = aSize < 0;
      const bIsTiny = bSize < 0;

      // NAJPREJ: Standardni pred majhnimi (logično za uporabnika)
      // Uporabnik išče "alpsko mleko" → 1L MORA biti pred 200ml!
      if (aIsStandard && !bIsStandard) return -1;
      if (bIsStandard && !aIsStandard) return 1;

      // DRUGIČ: Med ne-standardnimi, večji pred manjšimi (pozitivni pred negativnimi)
      if (!aIsTiny && bIsTiny) return -1;
      if (!bIsTiny && aIsTiny) return 1;

      // TRETJIČ: Med enakimi kategorijami, večja velikost najprej
      // To zagotavlja da 1L pride pred 500ml, in da 500ml pride pred 200ml
      if (aSize !== bSize) {
        return bSize - aSize;  // Večji size score = prej
      }

      // ČETRTIČ: Če sta enake velikosti, sortiraj po RELEVANTNOSTI
      const smartDiff = bSmart - aSmart;
      if (Math.abs(smartDiff) > 30) return smartDiff > 0 ? 1 : -1;

      // PETIČ: Če sta podobno relevantna, NAJCENEJŠI PRVI!
      return a.lowestPrice - b.lowestPrice;
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

// Debug: iskanje po imenu (brez scoringa)
export const debugSearchByName = query({
  args: { query: v.string() },
  returns: v.array(v.object({
    _id: v.id("products"),
    name: v.string(),
    nameKey: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const q = args.query.toLowerCase();
    const products = await ctx.db.query("products").take(5000);
    return products
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 20)
      .map(p => ({ _id: p._id, name: p.name, nameKey: p.nameKey }));
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
