/**
 * TEST SEARCH ALGORITHM
 * Run with: node scripts/test-search.js
 */

// Kopiraj funkcije iz products.ts za testiranje

function extractSize(text) {
  const match = text.match(/(\d+[,.]?\d*)\s*(kg|g|l|ml|cl|dl|liter|litrov)/i);
  if (!match) return null;

  let value = parseFloat(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();

  if (unit === "kg") value *= 1000;
  if (unit === "l" || unit === "liter" || unit === "litrov") value *= 1000;
  if (unit === "cl") value *= 10;
  if (unit === "dl") value *= 100;

  const baseUnit = (unit === "kg" || unit === "g") ? "g" : "ml";
  return { value, unit: baseUnit };
}

function getSizeScore(name, unit) {
  const text = `${name} ${unit}`.toLowerCase();

  if (/\b1\s*kg\b|\b1000\s*g\b/i.test(text)) return 100;
  if (/\b1\s*l\b|\b1000\s*ml\b|\b1\s*liter\b/i.test(text)) return 100;
  if (/\b1[,.]5\s*l\b|\b1500\s*ml\b/i.test(text)) return 98;
  if (/\b2\s*l\b|\b2000\s*ml\b/i.test(text)) return 95;
  if (/\b500\s*g\b|\b0[,.]5\s*kg\b/i.test(text)) return 90;
  if (/\b500\s*ml\b|\b0[,.]5\s*l\b/i.test(text)) return 90;
  if (/\b750\s*ml\b/i.test(text)) return 85;
  if (/\b250\s*g\b/i.test(text)) return 80;
  if (/\b400\s*g\b/i.test(text)) return 75;
  if (/\b330\s*ml\b/i.test(text)) return 70;
  if (/\b300\s*g\b/i.test(text)) return 65;
  if (/\b200\s*g\b/i.test(text)) return 50;
  if (/\b150\s*g\b/i.test(text)) return 45;
  if (/\b250\s*ml\b/i.test(text)) return 40;
  if (/\b200\s*ml\b/i.test(text)) return 15;
  if (/\b100\s*ml\b/i.test(text)) return 8;
  if (/\b50\s*ml\b/i.test(text)) return 5;
  if (/\b100\s*g\b/i.test(text)) return 20;
  if (/\b2[02]\s*ml\b|\b0[,.]2\s*l\b/i.test(text)) return 3;

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

  const finalScore = exactMatchBonus + sizeMatchBonus + simplicityScore + positionBonus + sizeScore
                     - adjectivePenalty - flavorPenalty - derivativePenalty;

  return Math.max(1, finalScore);
}

// ========== TEST CASES ==========

const TEST_PRODUCTS = [
  // Mleko
  { name: "Mleko 1L", unit: "1L" },
  { name: "Mleko 0.5L", unit: "0.5L" },
  { name: "Alpsko mleko 3.5% 1L", unit: "1L" },
  { name: "Čokoladno mleko 0.5L", unit: "0.5L" },
  { name: "Čokoladno mleko z vanilijo 250ml", unit: "250ml" },

  // Čokolada
  { name: "Čokolada Milka 100g", unit: "100g" },
  { name: "Čokolada Milka z lešniki 100g", unit: "100g" },
  { name: "Čokoladni preliv 200g", unit: "200g" },
  { name: "Čokoladna krema Nutella 400g", unit: "400g" },
  { name: "Bela čokolada 80g", unit: "80g" },

  // Jabolko
  { name: "Jabolko Golden 1kg", unit: "1kg" },
  { name: "Jabolka rdeča 500g", unit: "500g" },
  { name: "Jabolčni sok 1L", unit: "1L" },
  { name: "Jabolčni kis 0.5L", unit: "0.5L" },
  { name: "Jabolčna čežana 200g", unit: "200g" },

  // Fructal
  { name: "Fructal nektar pomaranča 1.5L", unit: "1.5L" },
  { name: "Fructal nektar pomaranča 0.2L", unit: "0.2L" },
  { name: "Fructal 100% sok jabolko 1L", unit: "1L" },
  { name: "Fructal smoothie jagoda 250ml", unit: "250ml" },

  // Salama
  { name: "Poli salama rezana 100g", unit: "100g" },
  { name: "Salama 300g", unit: "300g" },
  { name: "Rezana salama 150g", unit: "150g" },
  { name: "Čokoladna salama 200g", unit: "200g" }, // desert!

  // Kruh
  { name: "Kruh beli 500g", unit: "500g" },
  { name: "Kruh polnozrnati 400g", unit: "400g" },
  { name: "Kruhovi kocki 200g", unit: "200g" },

  // Pašteta
  { name: "Argeta kokošja pašteta 95g", unit: "95g" },
  { name: "Argeta junior pašteta 95g", unit: "95g" },
  { name: "Argeta tuna pašteta 95g", unit: "95g" },
  { name: "Argeta exclusive pašteta 95g", unit: "95g" },
  { name: "Pašteta kokošja 100g", unit: "100g" },
  { name: "Pašteta jetrna 150g", unit: "150g" },
  { name: "Gavrilović pašteta 100g", unit: "100g" },
  { name: "Argeta namaz tunin 95g", unit: "95g" },
];

const TEST_QUERIES = [
  "pašteta argeta",
  "argeta",
  "pašteta",
  "argeta kokošja",
];

console.log("========================================");
console.log("   SEARCH ALGORITHM TEST");
console.log("========================================\n");

for (const query of TEST_QUERIES) {
  console.log(`\n🔍 ISKANJE: "${query}"`);
  console.log("-".repeat(50));

  const results = TEST_PRODUCTS
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
      console.log(`${mark} ${i + 1}. ${r.name} (${r.unit}) - Score: ${r.score}`);
    });
  }
}

console.log("\n========================================");
console.log("   TEST KONČAN");
console.log("========================================");
