"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * SMART MERGE - Združi izdelke iz različnih trgovin z AI
 */

// Normalizacija za primerjavo
function normalizeForCompare(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Izvleči ključne besede
function extractKeywords(name: string): string[] {
  const stopWords = new Set(["in", "za", "s", "z", "na", "od", "do", "pri", "g", "kg", "ml", "l", "kos", "kom"]);
  return normalizeForCompare(name)
    .split(" ")
    .filter(w => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));
}

// ZNANE BLAGOVNE ZNAMKE
const KNOWN_BRANDS = new Set([
  "milka", "jaffa", "coca", "cola", "pepsi", "fanta", "sprite", "schweppes",
  "alpsko", "ljubljanske", "vindija", "mu", "ego", "zott", "danone", "activia",
  "barilla", "buitoni", "knorr", "podravka", "vegeta", "argeta",
  "nutella", "ferrero", "kinder", "raffaello", "mars", "snickers", "twix", "bounty",
  "lindt", "toblerone", "ritter", "sport",
  "nivea", "dove", "palmolive", "colgate", "oral",
  "radenska", "donat", "costella", "jana", "zala",
  "poli", "spar", "mercator", "tus",
  "lay", "pringles", "chio", "kelly",
  "nescafe", "jacobs", "lavazza", "barcaffe", "illy",
  "lipton", "teekanne", "pickwick",
  "heinz", "hellmann", "calve", "zvijezda",
  "dr", "oetker", "carte", "dor",
  "president", "philadelphia", "galbani", "parmareggio",
]);

// Izvleči brand iz imena
function extractBrand(name: string): string | null {
  const normalized = normalizeForCompare(name);
  const words = normalized.split(" ");

  for (const word of words) {
    if (KNOWN_BRANDS.has(word)) {
      return word;
    }
    // Preveri tudi kombinacije (coca cola, dr oetker)
    for (const brand of KNOWN_BRANDS) {
      if (normalized.includes(brand)) {
        return brand;
      }
    }
  }
  return null;
}

// Izvleči gramaturo (teža/volumen)
function extractSize(name: string): string | null {
  const normalized = normalizeForCompare(name);

  // Poišči vzorce: 100g, 1.5l, 250ml, 1 kg, itd.
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|dl)/i,
    /(\d+(?:[.,]\d+)?)\s*(kos|kom)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(",", "."));
      const unit = match[2].toLowerCase();

      // Normaliziraj v osnovno enoto
      if (unit === "g") return `${value}g`;
      if (unit === "kg") return `${value * 1000}g`;
      if (unit === "ml") return `${value}ml`;
      if (unit === "l") return `${value * 1000}ml`;
      if (unit === "cl") return `${value * 10}ml`;
      if (unit === "dl") return `${value * 100}ml`;
      return `${value}${unit}`;
    }
  }
  return null;
}

// Izračunaj podobnost (Jaccard)
function similarity(name1: string, name2: string): number {
  const kw1 = new Set(extractKeywords(name1));
  const kw2 = new Set(extractKeywords(name2));
  if (kw1.size === 0 || kw2.size === 0) return 0;
  const intersection = [...kw1].filter(x => kw2.has(x)).length;
  const union = new Set([...kw1, ...kw2]).size;
  return intersection / union;
}

// Uporabi AI za primerjavo dveh izdelkov (Groq - BREZPLAČEN!)
async function aiCompare(product1: string, product2: string): Promise<boolean> {
  // Najprej poskusi Groq (brezplačen), nato OpenAI kot fallback
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const apiKey = groqKey || openaiKey;
  const isGroq = !!groqKey;

  if (!apiKey) {
    console.log("No GROQ_API_KEY or OPENAI_API_KEY, skipping AI comparison");
    return false;
  }

  try {
    const baseUrl = isGroq
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const model = isGroq ? "llama-3.1-8b-instant" : "gpt-4o-mini";

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `Si expert za SLOVENSKE TRGOVINE (Mercator, Spar, Tuš). Primerjaj dva izdelka.

ZELO POMEMBNO - Trgovine pišejo ZELO RAZLIČNO za ISTI izdelek:
- "COCA-COLA ORIGINAL, 1L" = "Gazirana pijača, Coca Cola, 1 l" → DA (ista znamka + velikost)
- "JAFFA MARELICA, 150G" = "Jaffa keksi marelica 150g" → DA (ista znamka + velikost + okus)
- "Mlečna čokolada Milka 100g" = "MILKA ČOKOLADA MLEČNA 100G" → DA

GLAVNO PRAVILO:
**Če je ISTA ZNAMKA + ISTA VELIKOST + ISTI OKUS/TIP** = to je ISTI izdelek = DA

Primeri DA:
- Ista znamka + ista gramatura + podoben opis = DA
- Samo drugačen vrstni red besed = DA
- Ena trgovina ima "Gazirana pijača" + brand, druga samo brand = DA

Primeri NE:
- Različna velikost (100g vs 250g) = NE
- Različen okus (jagoda vs čokolada, original vs zero) = NE
- Različna znamka = NE

Odgovori SAMO "DA" ali "NE".`,
          },
          {
            role: "user",
            content: `"${product1}" vs "${product2}" - ISTI izdelek?`,
          },
        ],
        max_tokens: 5,
        temperature: 0,
      }),
    });

    if (!response.ok) return false;
    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase();
    return answer === "DA";
  } catch (e) {
    console.error("AI compare error:", e);
    return false;
  }
}

// Glavni action za smart merge
export const runSmartMerge = action({
  args: {
    batchSize: v.optional(v.number()),
    useAI: v.optional(v.boolean()),
  },
  returns: v.object({
    processed: v.number(),
    mergedByImage: v.number(),
    mergedByAI: v.number(),
    aiCalls: v.number(),
    noApiKey: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 50;
    const useAI = args.useAI ?? true;

    // Check API key (Groq ali OpenAI)
    const hasApiKey = !!process.env.GROQ_API_KEY || !!process.env.OPENAI_API_KEY;
    if (useAI && !hasApiKey) {
      return {
        processed: 0,
        mergedByImage: 0,
        mergedByAI: 0,
        aiCalls: 0,
        noApiKey: true,
      };
    }

    // Pridobi izdelke s samo 1 trgovino
    const singleStoreProducts = await ctx.runMutation(internal.smartMergeHelpers.getSingleStoreProducts, { limit: batchSize });

    // Pridobi izdelke za primerjavo (omejeno zaradi read limits)
    const allProducts = await ctx.runMutation(internal.smartMergeHelpers.getMultiStoreProducts, { limit: 500 });

    let mergedByImage = 0;
    let mergedByAI = 0;
    let aiCalls = 0;
    let processed = 0;

    for (const product of singleStoreProducts) {
      processed++;
      if (!product.name) continue;

      // 1. SLIKOVNO UJEMANJE
      if (product.imageUrl) {
        const imageMatch = allProducts.find((p: typeof product) =>
          p._id !== product._id &&
          p.imageUrl === product.imageUrl
        );

        if (imageMatch) {
          await ctx.runMutation(internal.smartMergeHelpers.mergeProducts, {
            keepId: imageMatch._id,
            mergeId: product._id,
          });
          mergedByImage++;
          continue;
        }
      }

      // 2. AI MATCHING
      if (!useAI) continue;

      // PAMETNO ISKANJE KANDIDATOV:
      const productBrand = extractBrand(product.name);
      const productSize = extractSize(product.name);
      const productKeywords = extractKeywords(product.name);

      // Filtriraj kandidate - iščemo izdelke iz DRUGIH trgovin
      const candidates = allProducts.filter((p: typeof product) => {
        if (p._id === product._id) return false;

        const candidateBrand = extractBrand(p.name);
        const candidateSize = extractSize(p.name);

        // PRIORITETA 1: Isti brand + ista velikost = zelo verjeten match
        if (productBrand && candidateBrand && productSize && candidateSize) {
          if (productBrand === candidateBrand && productSize === candidateSize) {
            return true;
          }
        }

        // PRIORITETA 2: Isti brand + podobna velikost
        if (productBrand && candidateBrand && productBrand === candidateBrand) {
          return true;
        }

        // PRIORITETA 3: Ista velikost + vsaj 2 skupni besedi
        if (productSize && candidateSize && productSize === candidateSize) {
          const candidateKeywords = extractKeywords(p.name);
          const commonWords = productKeywords.filter(w => candidateKeywords.includes(w));
          if (commonWords.length >= 2) {
            return true;
          }
        }

        // PRIORITETA 4: Vsaj 3 skupne besede
        const candidateKeywords = extractKeywords(p.name);
        const commonWords = productKeywords.filter(w => candidateKeywords.includes(w));
        return commonWords.length >= 3;
      });

      // Preveri z AI (max 5 kandidatov za boljši rezultat)
      for (const candidate of candidates.slice(0, 5)) {
        aiCalls++;
        const isMatch = await aiCompare(product.name, candidate.name);

        if (isMatch) {
          await ctx.runMutation(internal.smartMergeHelpers.mergeProducts, {
            keepId: candidate._id,
            mergeId: product._id,
          });
          mergedByAI++;
          break;
        }
      }
    }

    return {
      processed,
      mergedByImage,
      mergedByAI,
      aiCalls,
      noApiKey: false,
    };
  },
});
