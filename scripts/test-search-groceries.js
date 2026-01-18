/**
 * TEST SEARCH ALGORITHM - GROCERY LIST
 * Testiranje z realnim nakupovalnim seznamom
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
  if (/\b2\s*kg\b|\b2000\s*g\b/i.test(text)) return 95;
  if (/\b2\s*l\b|\b2000\s*ml\b/i.test(text)) return 95;
  if (/\b1[,.]5\s*l\b|\b1500\s*ml\b/i.test(text)) return 98;
  if (/\b500\s*g\b|\b0[,.]5\s*kg\b/i.test(text)) return 90;
  if (/\b500\s*ml\b/i.test(text)) return 90;
  if (/\b250\s*g\b/i.test(text)) return 80;
  if (/\b300\s*g\b/i.test(text)) return 75;
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

  const finalScore = exactMatchBonus + sizeMatchBonus + simplicityScore + positionBonus + sizeScore
                     - adjectivePenalty - flavorPenalty - derivativePenalty;

  return Math.max(1, finalScore);
}

// ========== GROCERY PRODUCTS DATABASE ==========
const GROCERY_PRODUCTS = [
  // MLEČNI IZDELKI
  { name: "Alpsko mleko 3,5% 1L", unit: "1L" },
  { name: "Alpsko mleko 1,5% 1L", unit: "1L" },
  { name: "Mleko sveže 3,5% 1L", unit: "1L" },
  { name: "Mleko sveže 1,5% 1L", unit: "1L" },
  { name: "Čokoladno mleko 0,5L", unit: "0,5L" },
  { name: "Jogurt naravni 1kg", unit: "1kg" },
  { name: "Jogurt naravni 500g", unit: "500g" },
  { name: "Jogurt navadni 180g", unit: "180g" },
  { name: "Jogurt sadni jagoda 150g", unit: "150g" },
  { name: "Jogurt Activia naravni 125g", unit: "125g" },
  { name: "Sir Gauda 300g", unit: "300g" },
  { name: "Sir Gauda 200g", unit: "200g" },
  { name: "Sir Edamec 200g", unit: "200g" },
  { name: "Sir trdi Parmezan 150g", unit: "150g" },
  { name: "Sir za pizze 400g", unit: "400g" },
  { name: "Sir topljeni lističi 200g", unit: "200g" },
  { name: "Skuta polnomastna 500g", unit: "500g" },
  { name: "Skuta posneta 250g", unit: "250g" },
  { name: "Skuta z jogurtom 400g", unit: "400g" },
  { name: "Jajca M 10 kos", unit: "10 kos" },
  { name: "Jajca L 6 kos", unit: "6 kos" },
  { name: "Jajca prosta reja 10 kos", unit: "10 kos" },
  { name: "Maslo 250g", unit: "250g" },
  { name: "Maslo 125g", unit: "125g" },
  { name: "Margarina 500g", unit: "500g" },

  // MESNI IZDELKI
  { name: "Šunka kuhana 150g", unit: "150g" },
  { name: "Šunka pršut 100g", unit: "100g" },
  { name: "Salama posebna 150g", unit: "150g" },

  // KRUH IN PEKOVSKI IZDELKI
  { name: "Kruh polnozrnati 500g", unit: "500g" },
  { name: "Kruh beli 400g", unit: "400g" },
  { name: "Kruh mešani 500g", unit: "500g" },
  { name: "Kruh rženi 350g", unit: "350g" },
  { name: "Toast beli 500g", unit: "500g" },
  { name: "Žemlje bele 6 kos", unit: "6 kos" },
  { name: "Žemlje polnozrnate 4 kos", unit: "4 kos" },

  // KONZERVE
  { name: "Koruza v zrnu 340g", unit: "340g" },
  { name: "Koruza sladka v pločevinki 425g", unit: "425g" },
  { name: "Koruzni zdrob 500g", unit: "500g" },
  { name: "Fižol v slanici 400g", unit: "400g" },
  { name: "Fižol rdeči v pločevinki 400g", unit: "400g" },
  { name: "Fižol beli suhi 500g", unit: "500g" },
  { name: "Paradižnik v lastnem soku 400g", unit: "400g" },
  { name: "Paradižnik pasiran 500g", unit: "500g" },
  { name: "Paradižnikova omaka 350g", unit: "350g" },
  { name: "Paradižnik svež 500g", unit: "500g" },
  { name: "Paradižnik cherry 250g", unit: "250g" },

  // RIŽ IN TESTENINE
  { name: "Riž dolgozrnati 1kg", unit: "1kg" },
  { name: "Riž basmati 500g", unit: "500g" },
  { name: "Riž rižoto 1kg", unit: "1kg" },
  { name: "Testenine špageti 500g", unit: "500g" },
  { name: "Testenine penne 500g", unit: "500g" },
  { name: "Testenine fusilli 500g", unit: "500g" },
  { name: "Testenine lazanja 250g", unit: "250g" },

  // OLJA
  { name: "Oljčno olje ekstra deviško 500ml", unit: "500ml" },
  { name: "Oljčno olje 1L", unit: "1L" },
  { name: "Sončnično olje 1L", unit: "1L" },
  { name: "Sončnično olje 2L", unit: "2L" },
  { name: "Bučno olje 250ml", unit: "250ml" },

  // ZELENJAVA
  { name: "Krompir beli 2kg", unit: "2kg" },
  { name: "Krompir rdeči 1kg", unit: "1kg" },
  { name: "Krompir mladi 1,5kg", unit: "1,5kg" },
  { name: "Čebula rjava 1kg", unit: "1kg" },
  { name: "Čebula rdeča 500g", unit: "500g" },
  { name: "Česen glavica 3 kos", unit: "3 kos" },
  { name: "Česen olupljen 100g", unit: "100g" },
  { name: "Motovilec 100g", unit: "100g" },
  { name: "Solata zelena 1 kos", unit: "1 kos" },
  { name: "Solata ledena 1 kos", unit: "1 kos" },
  { name: "Paprika rdeča 3 kos", unit: "3 kos" },
  { name: "Paprika zelena 500g", unit: "500g" },
  { name: "Paprika rumena 3 kos", unit: "3 kos" },

  // SADJE
  { name: "Banane 1kg", unit: "1kg" },
  { name: "Banane bio 750g", unit: "750g" },
  { name: "Jabolka Golden 1kg", unit: "1kg" },
  { name: "Jabolka rdeča 1kg", unit: "1kg" },
  { name: "Jabolčni sok 1L", unit: "1L" },
  { name: "Jabolčni kis 500ml", unit: "500ml" },
  { name: "Pomaranče 1kg", unit: "1kg" },
  { name: "Pomaranče naveline 1,5kg", unit: "1,5kg" },
  { name: "Pomarančni sok 1L", unit: "1L" },

  // MESO
  { name: "Piščančji file 500g", unit: "500g" },
  { name: "Piščančja prsa 400g", unit: "400g" },
  { name: "Piščančje bedra 600g", unit: "600g" },
  { name: "Piščančje krilce 500g", unit: "500g" },
  { name: "Mleto meso mešano 500g", unit: "500g" },
  { name: "Mleto meso goveje 400g", unit: "400g" },
  { name: "Govedina zrezek 300g", unit: "300g" },
  { name: "Svinjina kare 500g", unit: "500g" },
  { name: "Ribji file oslič 400g", unit: "400g" },
  { name: "Ribji file losos 300g", unit: "300g" },
  { name: "Ribji fileti zamrznjeni 500g", unit: "500g" },

  // KAVA IN ČAJ
  { name: "Kava mleta 250g", unit: "250g" },
  { name: "Kava mleta 500g", unit: "500g" },
  { name: "Kava v zrnu 1kg", unit: "1kg" },
  { name: "Čaj zeliščni 20 vrečk", unit: "20 kos" },
  { name: "Čaj črni 25 vrečk", unit: "25 kos" },
  { name: "Čaj zeleni 20 vrečk", unit: "20 kos" },
  { name: "Čaj sadni 20 vrečk", unit: "20 kos" },

  // ZAČIMBE IN SLADKOR
  { name: "Sladkor beli 1kg", unit: "1kg" },
  { name: "Sladkor rjavi 500g", unit: "500g" },
  { name: "Sol morska 500g", unit: "500g" },
  { name: "Sol kuhinjska 1kg", unit: "1kg" },
  { name: "Poper črni mleti 50g", unit: "50g" },
  { name: "Poper v zrnu 100g", unit: "100g" },
  { name: "Moka pšenična 1kg", unit: "1kg" },

  // PAŠTETE IN NAMAZI
  { name: "Pašteta Argeta kokošja 95g", unit: "95g" },
  { name: "Pašteta jetrna 100g", unit: "100g" },
  { name: "Pašteta tuna 95g", unit: "95g" },
  { name: "Marmelada jagodna 450g", unit: "450g" },
  { name: "Marmelada marelična 370g", unit: "370g" },
  { name: "Marmelada gozdni sadeži 450g", unit: "450g" },
  { name: "Namaz čokoladno-lešnikov 400g", unit: "400g" },
  { name: "Namaz čokoladni Nutella 750g", unit: "750g" },

  // SLADKARIJE
  { name: "Keksi Petit beurre 300g", unit: "300g" },
  { name: "Keksi čokoladni 200g", unit: "200g" },
  { name: "Keksi Hobi 250g", unit: "250g" },
  { name: "Čokolada Milka 100g", unit: "100g" },
  { name: "Čokolada temna 85% 100g", unit: "100g" },
  { name: "Čokolada bela 100g", unit: "100g" },
  { name: "Čokoladni namaz Nutella 400g", unit: "400g" },
  { name: "Čokoladni preliv 200g", unit: "200g" },

  // PIJAČE
  { name: "Sok jabolčni 100% 1L", unit: "1L" },
  { name: "Sok pomarančni 1L", unit: "1L" },
  { name: "Sok multivitamin 1L", unit: "1L" },
  { name: "Voda negazirana 1,5L", unit: "1,5L" },
  { name: "Voda gazirana 1,5L", unit: "1,5L" },
  { name: "Voda gazirana 6x1,5L", unit: "6x1,5L" },
  { name: "Mineralna voda Radenska 1L", unit: "1L" },
];

// ========== NAKUPOVALNI SEZNAM - NOVI TEST ==========
const SHOPPING_LIST = [
  "žemlje bele",
  "kruh mešani",
  "maslo 250g",
  "mleko 3,5% 1l",
  "jogurt navadni 180g",
  "sir gauda 200g",
  "šunka kuhana 150g",
  "pašteta",
  "marmelada jagoda",
  "namaz čokoladno-lešnikov",
  "jajca 6 kos",
  "testenine špageti 500g",
  "paradižnikova omaka",
  "jabolka 1kg",
  "sok pomaranča 1l",
];

console.log("========================================");
console.log("   GROCERY LIST SEARCH TEST");
console.log("========================================\n");

let successCount = 0;
let warningCount = 0;

for (const query of SHOPPING_LIST) {
  const results = GROCERY_PRODUCTS
    .map(p => ({
      ...p,
      score: smartMatch(p.name, query, p.unit)
    }))
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score);

  const topResult = results[0];
  const isGoodMatch = topResult && topResult.score >= 100;

  const icon = isGoodMatch ? "✅" : (results.length > 0 ? "⚠️" : "❌");
  if (isGoodMatch) successCount++;
  else if (results.length > 0) warningCount++;

  console.log(`${icon} "${query}"`);
  if (topResult) {
    console.log(`   → ${topResult.name} (Score: ${topResult.score})`);
    if (results.length > 1 && results[1].score > topResult.score * 0.9) {
      console.log(`   → ${results[1].name} (Score: ${results[1].score})`);
    }
  } else {
    console.log(`   → Ni zadetkov!`);
  }
}

console.log("\n========================================");
console.log(`   REZULTATI: ${successCount}/${SHOPPING_LIST.length} odlično`);
console.log(`              ${warningCount} opozoril`);
console.log("========================================");

// ========== TEST IZDELKOV KI NE OBSTAJAJO ==========
console.log("\n\n========================================");
console.log("   TEST: IZDELKI KI NE OBSTAJAJO");
console.log("   (prag: score >= 50 za prikaz)");
console.log("========================================\n");

const NON_EXISTENT = [
  "monster",            // energijska pijača - ni v bazi
  "shark",              // energijska pijača - ni v bazi
  "red bull",           // energijska pijača - ni v bazi
  "avokado",            // ni v bazi
  "tunin sendvič",      // ni v bazi
  "proteinski shake",   // ni v bazi
];

const MIN_SCORE_THRESHOLD = 50;

for (const query of NON_EXISTENT) {
  const results = GROCERY_PRODUCTS
    .map(p => ({
      ...p,
      score: smartMatch(p.name, query, p.unit)
    }))
    .filter(p => p.score >= MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (results.length === 0) {
    console.log(`✅ "${query}" → Izdelka nismo našli (PRAVILNO!)`);
  } else {
    console.log(`⚠️  "${query}" → Našel: ${results[0].name} (Score: ${results[0].score})`);
  }
}

console.log("\n========================================");
