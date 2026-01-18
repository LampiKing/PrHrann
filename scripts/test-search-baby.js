/**
 * TEST SEARCH ALGORITHM - BABY PRODUCTS
 */

function extractSize(text) {
  const match = text.match(/(\d+[,.]?\d*)\s*(kg|g|l|ml|cl|dl|liter|litrov|kos|kom)/i);
  if (!match) return null;
  let value = parseFloat(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();
  if (unit === "kg") value *= 1000;
  if (unit === "l" || unit === "liter" || unit === "litrov") value *= 1000;
  if (unit === "cl") value *= 10;
  if (unit === "dl") value *= 100;
  const baseUnit = (unit === "kg" || unit === "g") ? "g" : (unit === "kos" || unit === "kom") ? "kos" : "ml";
  return { value, unit: baseUnit };
}

function getSizeScore(name, unit) {
  const text = `${name} ${unit}`.toLowerCase();
  if (/\b1\s*kg\b|\b1000\s*g\b/i.test(text)) return 100;
  if (/\b1\s*l\b|\b1000\s*ml\b/i.test(text)) return 100;
  if (/\b1[,.]5\s*l\b|\b1500\s*ml\b/i.test(text)) return 98;
  if (/\b500\s*g\b|\b0[,.]5\s*kg\b/i.test(text)) return 90;
  if (/\b500\s*ml\b/i.test(text)) return 90;
  if (/\b250\s*g\b/i.test(text)) return 80;
  if (/\b200\s*g\b/i.test(text)) return 50;
  if (/\b100\s*g\b/i.test(text)) return 20;
  if (/\b50\s*g\b/i.test(text)) return 10;
  return 25;
}

function getStemRoot(word) {
  const w = word.toLowerCase();
  if (w.endsWith("ov") || w.endsWith("ev")) return w.slice(0, -2);
  if (w.endsWith("ni") || w.endsWith("na") || w.endsWith("no")) return w.slice(0, -2);
  if (w.endsWith("ski") || w.endsWith("ški")) return w.slice(0, -3);
  if (w.endsWith("en") || w.endsWith("an")) return w.slice(0, -2);
  if (w.endsWith("a") || w.endsWith("e") || w.endsWith("i") || w.endsWith("o")) return w.slice(0, -1);
  return w;
}

function isAdjective(word) {
  const w = word.toLowerCase();
  return w.endsWith("ni") || w.endsWith("na") || w.endsWith("no") ||
         w.endsWith("ski") || w.endsWith("ški") || w.endsWith("ov") ||
         w.endsWith("ev") || w.endsWith("en") || w.endsWith("an") ||
         w.endsWith("ast") || w.endsWith("at");
}

function smartMatch(productName, searchQuery, unit) {
  const nameLower = productName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const queryLower = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const queryWithoutSize = queryLower.replace(/\d+[,.]?\d*\s*(%|kg|g|l|ml|cl|dl|liter|litrov|kos|kom)/gi, "").trim();
  const queryWords = queryWithoutSize.split(/\s+/).filter(w => w.length > 1);

  if (queryWords.length === 0) return 0;

  const nameWithoutSize = nameLower.replace(/\d+[,.]?\d*\s*(kg|g|l|ml|cl|dl|kos|kom|%)/gi, "");
  const nameWords = nameWithoutSize.split(/[\s,\-\/]+/).filter(w => w.length > 1);

  const queryRoots = queryWords.map(w => getStemRoot(w));
  const nameRoots = nameWords.map(w => getStemRoot(w));

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

  let adjectivePenalty = 0;
  if (matchedAsAdjective && exactMatches === 0) {
    adjectivePenalty = 150;
  }

  let exactMatchBonus = exactMatches * 100;

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

  const extraWords = nameWords.length - queryWords.length;
  const simplicityScore = Math.max(0, 120 - extraWords * 35);

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

  let sizeScore = 0;
  if (!querySize) {
    sizeScore = getSizeScore(productName, unit);
  }

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

  const DERIVATIVE_WORDS = [
    "preliv", "omaka", "namaz", "dodatek", "posip", "glazura", "krema",
    "sirup", "sos", "dip", "marinada", "zacimba"
  ];

  let derivativePenalty = 0;
  for (const deriv of DERIVATIVE_WORDS) {
    if (nameLower.includes(deriv) && !queryLower.includes(deriv)) {
      derivativePenalty += 60;
    }
  }

  // Adult product penalty - penalize adult products when searching for baby items
  let adultProductPenalty = 0;
  const ADULT_INDICATORS = ["za odrasle", "tena", "adult", "inkontinenc"];
  const BABY_SEARCH_TERMS = ["plenic", "baby", "dojen", "otrok", "otroš"];

  const isAdultProduct = ADULT_INDICATORS.some(ind => nameLower.includes(ind));
  const isBabySearch = BABY_SEARCH_TERMS.some(term => queryLower.includes(term));

  if (isAdultProduct && isBabySearch) {
    adultProductPenalty = 500; // Strong penalty
  } else if (isAdultProduct && queryLower.includes("plenic")) {
    adultProductPenalty = 400; // Penalty for "plenice" search showing adult diapers
  }

  // Baby product bonus - boost baby products for baby-related searches
  let babyBonus = 0;
  const BABY_PRODUCT_INDICATORS = ["baby", "pampers", "huggies", "babylove", "dojenč", "otroš", "chicco", "avent", "nuk", "mam"];
  const isBabyProduct = BABY_PRODUCT_INDICATORS.some(ind => nameLower.includes(ind));

  if (isBabyProduct && isBabySearch) {
    babyBonus = 150;
  } else if (isBabyProduct && queryLower.includes("plenic")) {
    babyBonus = 100; // Boost baby diapers for "plenice" search
  }

  // Target audience bonus - boost products explicitly for babies/children
  let targetAudienceBonus = 0;
  if (nameLower.includes("za dojenčke") || nameLower.includes("za otroke") || nameLower.includes("za bebe")) {
    if (isBabySearch || queryLower.includes("plenic")) {
      targetAudienceBonus = 100;
    }
  }

  // Irrelevant product penalty - penalize completely unrelated products
  let irrelevantPenalty = 0;
  const NON_BABY_CATEGORIES = ["head & shoulders", "nivea men", "gillette", "old spice"];
  if (NON_BABY_CATEGORIES.some(cat => nameLower.includes(cat)) && isBabySearch) {
    irrelevantPenalty = 300;
  }

  const finalScore = exactMatchBonus + sizeMatchBonus + simplicityScore + positionBonus + sizeScore + babyBonus + targetAudienceBonus
                     - adjectivePenalty - flavorPenalty - derivativePenalty - adultProductPenalty - irrelevantPenalty;

  return Math.max(1, finalScore);
}

// ========== BABY PRODUCTS ==========
const BABY_PRODUCTS = [
  // 1-10: Osnovni baby pripomočki
  { name: "Pampers plenice Premium Care velikost 2", unit: "50 kos" },
  { name: "Pampers plenice Premium Care velikost 3", unit: "60 kos" },
  { name: "Pampers plenice Premium Care velikost 4", unit: "52 kos" },
  { name: "Babylove plenice velikost 3", unit: "46 kos" },
  { name: "Huggies plenice Ultra Comfort", unit: "42 kos" },
  { name: "Pampers vlažilni robčki Sensitive", unit: "80 kos" },
  { name: "Pampers vlažilni robčki Fresh Clean", unit: "52 kos" },
  { name: "Babylove vlažilni robčki", unit: "80 kos" },
  { name: "Johnson's Baby šampon", unit: "300ml" },
  { name: "Johnson's Baby gel za telo", unit: "200ml" },
  { name: "Nivea Baby šampon", unit: "250ml" },
  { name: "Sudocrem krema proti izpuščajem", unit: "125g" },
  { name: "Bepanthen Baby krema", unit: "100g" },
  { name: "Chicco steklenička za hranjenje 150ml", unit: "1 kos" },
  { name: "Philips Avent steklenička Natural 260ml", unit: "1 kos" },
  { name: "MAM dudka Perfect 0-6m", unit: "2 kos" },
  { name: "Philips Avent dudka", unit: "2 kos" },
  { name: "NUK sesalnik za nos", unit: "1 kos" },
  { name: "Chicco digitalni termometer", unit: "1 kos" },
  { name: "Sangenic plenične vrečke za smeti", unit: "3 kos" },
  { name: "Baby krpice za čiščenje bambusove", unit: "10 kos" },

  // 11-20: Hranjenje
  { name: "Silikonski podložek za hranjenje", unit: "1 kos" },
  { name: "Hranilna žlička set 3 kos", unit: "3 kos" },
  { name: "NUK lonček s pokrovom 360°", unit: "1 kos" },
  { name: "Prenosni stekleničnik Chicco", unit: "1 kos" },
  { name: "Sesalne posodice za prigrizke", unit: "2 kos" },
  { name: "Philips Avent stekleničke z merilno skalo", unit: "3 kos" },
  { name: "NUK kubček za učenje pitja", unit: "1 kos" },
  { name: "Set posodic za shranjevanje hrane", unit: "5 kos" },
  { name: "Chicco Polly otroški stolček za hranjenje", unit: "1 kos" },
  { name: "Biološko razgradljivi prtički", unit: "100 kos" },

  // 21-30: Oblačila
  { name: "Baby body z dolgimi rokavi bel", unit: "1 kos" },
  { name: "Baby body s kratkimi rokavi", unit: "3 kos" },
  { name: "Baby nogavičke set 5 parov", unit: "5 kos" },
  { name: "Kapica za dojenčke bombažna", unit: "1 kos" },
  { name: "Otroški pajac plišast", unit: "1 kos" },
  { name: "Baby bombažne hlače", unit: "1 kos" },
  { name: "Otroška jopica pletena", unit: "1 kos" },
  { name: "UV zaščitna kapa za dojenčke", unit: "1 kos" },
  { name: "Kopalni plašč za dojenčke", unit: "1 kos" },
  { name: "Otroški rokavički brez palcev", unit: "1 kos" },

  // 31-40: Igrače
  { name: "Plišasta igrača medvedek", unit: "1 kos" },
  { name: "Montessori didaktične igrače set", unit: "1 kos" },
  { name: "Fisher-Price zvitki za učenje", unit: "1 kos" },
  { name: "Lesene kocke barvne 50 kos", unit: "50 kos" },
  { name: "Interaktivna knjiga za dojenčke", unit: "1 kos" },
  { name: "Chicco hodalica za začetnike", unit: "1 kos" },
  { name: "Fisher-Price glasbene igrače", unit: "1 kos" },
  { name: "Kopalne igrače set račke", unit: "3 kos" },
  { name: "Igrače za razvoj gibanja", unit: "1 kos" },
  { name: "Puzzle za malčke 4 kosi", unit: "4 kos" },

  // 41-50: Spanje
  { name: "Otroška posteljnina set 3 delni", unit: "1 set" },
  { name: "Prenosna posteljica", unit: "1 kos" },
  { name: "Vzglavnik za dojenčke anatomski", unit: "1 kos" },
  { name: "Ogrinjalo za dojenčke mehko", unit: "1 kos" },
  { name: "Nočna lučka LED za otroke", unit: "1 kos" },
  { name: "Philips Avent baby monitor", unit: "1 kos" },
  { name: "Organizator za previjalno mizo", unit: "1 kos" },
  { name: "Zatemnitvene zavese za otroško sobo", unit: "2 kos" },
  { name: "Vzmetnica za otroško posteljico 60x120", unit: "1 kos" },

  // 51-60: Mobilnost
  { name: "Chicco otroški voziček Lite Way", unit: "1 kos" },
  { name: "Maxi-Cosi avtosedež za dojenčke", unit: "1 kos" },
  { name: "Senčnik za voziček univerzalni", unit: "1 kos" },
  { name: "Ergobaby nahrbtnik za starše", unit: "1 kos" },
  { name: "Baby nosilka ergonomska", unit: "1 kos" },
  { name: "Varnostne zavornice za omare", unit: "10 kos" },
  { name: "Zaščitne obloge za robove pohištva", unit: "4 kos" },
  { name: "Potovalna previjalna torba", unit: "1 kos" },
  { name: "Mini hladilna torbica za mleko", unit: "1 kos" },
  { name: "Komplet prve pomoči za potovanja", unit: "1 kos" },

  // Dodatni izdelki za boljše testiranje
  { name: "Plenice za odrasle TENA", unit: "30 kos" },
  { name: "Vlažilni robčki Nivea", unit: "40 kos" },
  { name: "Šampon Head & Shoulders", unit: "400ml" },
  { name: "Gel za tuširanje Nivea Men", unit: "250ml" },
];

const TEST_QUERIES = [
  "plenice",
  "pampers",
  "baby šampon",
  "dudka",
  "steklenička",
  "vlažilni robčki",
  "igrače",
  "posteljica",
  "voziček",
  "avtosedež",
  "body",
  "krema za dojenčke",
];

console.log("========================================");
console.log("   BABY PRODUCTS SEARCH TEST");
console.log("========================================\n");

for (const query of TEST_QUERIES) {
  console.log(`\n🔍 ISKANJE: "${query}"`);
  console.log("-".repeat(55));

  const results = BABY_PRODUCTS
    .map(p => ({
      ...p,
      score: smartMatch(p.name, query, p.unit)
    }))
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score);

  if (results.length === 0) {
    console.log("   Ni zadetkov");
  } else {
    results.slice(0, 5).forEach((r, i) => {
      const mark = i === 0 ? "✅" : "  ";
      console.log(`${mark} ${i + 1}. ${r.name.substring(0, 45)} - Score: ${r.score}`);
    });

    // Preveri če so napačni rezultati visoko
    const wrongResults = results.filter(r =>
      !r.name.toLowerCase().includes(query.split(" ")[0].toLowerCase().substring(0, 4))
    );
    if (wrongResults.length > 0 && wrongResults[0].score > results[0].score * 0.8) {
      console.log(`   ⚠️  POZOR: "${wrongResults[0].name.substring(0,30)}" je visoko!`);
    }
  }
}

console.log("\n========================================");
console.log("   TEST KONČAN");
console.log("========================================");
