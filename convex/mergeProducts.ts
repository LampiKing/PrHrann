import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Normalizira ime izdelka za primerjavo
 * "MILKA ČOKOLADA MLEČNA 100G" -> "milka cokolada mlecna 100g"
 */
function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // Odstrani diakritike (č -> c, š -> s)
    .replace(/[^a-z0-9\s]/g, " ")    // Odstrani posebne znake
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Izloči ključne besede iz imena (brand, tip, velikost)
 * "Milka čokolada mlečna 100g" -> ["milka", "cokolada", "mlecna", "100g"]
 */
function extractKeywords(name: string): string[] {
  const normalized = normalizeForMatch(name);
  return normalized.split(" ").filter(w => w.length > 1);
}

/**
 * Izračuna podobnost med dvema imenoma (0-100)
 */
function similarityScore(name1: string, name2: string): number {
  const kw1 = new Set(extractKeywords(name1));
  const kw2 = new Set(extractKeywords(name2));

  if (kw1.size === 0 || kw2.size === 0) return 0;

  // Jaccard similarity
  const intersection = new Set([...kw1].filter(x => kw2.has(x)));
  const union = new Set([...kw1, ...kw2]);

  return Math.round((intersection.size / union.size) * 100);
}

/**
 * Ustvari kanonično ime izdelka iz več imen
 * Izbere najkrajše in najbolj berljivo ime
 */
function createCanonicalName(names: string[]): string {
  // Filtriraj prazna imena
  const validNames = names.filter(n => n && n.trim().length > 0);
  if (validNames.length === 0) return "Neznani izdelek";

  // Preferiraj imena ki:
  // 1. Imajo normalno dolžino (10-50 znakov)
  // 2. Začnejo z veliko začetnico
  // 3. Niso vsa velika ali vsa mala
  const scored = validNames.map(name => {
    let score = 0;
    const len = name.length;

    // Dolžina
    if (len >= 10 && len <= 50) score += 20;
    else if (len >= 5 && len <= 60) score += 10;

    // Prva velika, ostale male/mešano
    if (/^[A-ZČŠŽ][a-zčšž]/.test(name)) score += 15;

    // Ni vse CAPS
    if (name !== name.toUpperCase()) score += 10;

    // Ima številke (velikost)
    if (/\d/.test(name)) score += 5;

    return { name, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].name;
}

/**
 * Poišče izdelke ki se lahko združijo (podobna imena)
 */
export const findMergeCandidates = internalQuery({
  args: {
    limit: v.number(),
    offset: v.number(),
  },
  returns: v.array(
    v.object({
      productId: v.id("products"),
      name: v.string(),
      nameKey: v.optional(v.string()),
      normalized: v.string(),
      storeCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .order("asc")
      .paginate({ numItems: args.limit, cursor: null });

    const results = await Promise.all(
      products.page.map(async (product) => {
        const prices = await ctx.db
          .query("prices")
          .withIndex("by_product", q => q.eq("productId", product._id))
          .collect();

        return {
          productId: product._id,
          name: product.name,
          nameKey: product.nameKey,
          normalized: normalizeForMatch(product.name),
          storeCount: prices.length,
        };
      })
    );

    // Vrni samo izdelke z eno trgovino (kandidati za združitev)
    return results.filter(r => r.storeCount === 1);
  },
});

/**
 * Združi dva izdelka v enega
 * - Ohrani izdelek z več cenami
 * - Prenese cene iz drugega izdelka
 * - Pobriše duplikat
 */
export const mergeTwo = internalMutation({
  args: {
    keepProductId: v.id("products"),
    mergeProductId: v.id("products"),
  },
  returns: v.object({
    success: v.boolean(),
    pricesMoved: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.keepProductId === args.mergeProductId) {
      return { success: false, pricesMoved: 0 };
    }

    const keepProduct = await ctx.db.get(args.keepProductId);
    const mergeProduct = await ctx.db.get(args.mergeProductId);

    if (!keepProduct || !mergeProduct) {
      return { success: false, pricesMoved: 0 };
    }

    // Prenesi vse cene iz mergeProduct na keepProduct
    const pricesToMove = await ctx.db
      .query("prices")
      .withIndex("by_product", q => q.eq("productId", args.mergeProductId))
      .collect();

    let pricesMoved = 0;
    for (const price of pricesToMove) {
      // Preveri če že obstaja cena za to trgovino
      const existing = await ctx.db
        .query("prices")
        .withIndex("by_product_and_store", q =>
          q.eq("productId", args.keepProductId).eq("storeId", price.storeId)
        )
        .first();

      if (existing) {
        // Posodobi če je nova cena nižja
        if (price.price < existing.price) {
          await ctx.db.patch(existing._id, {
            price: price.price,
            originalPrice: price.originalPrice,
            isOnSale: price.isOnSale,
            lastUpdated: Date.now(),
          });
        }
        // Pobriši staro
        await ctx.db.delete(price._id);
      } else {
        // Prenesi ceno
        await ctx.db.patch(price._id, {
          productId: args.keepProductId,
        });
        pricesMoved++;
      }
    }

    // Posodobi ime če je boljše
    const newName = createCanonicalName([keepProduct.name, mergeProduct.name]);
    if (newName !== keepProduct.name) {
      await ctx.db.patch(args.keepProductId, { name: newName });
    }

    // Posodobi sliko če manjka
    if (!keepProduct.imageUrl && mergeProduct.imageUrl) {
      await ctx.db.patch(args.keepProductId, { imageUrl: mergeProduct.imageUrl });
    }

    // Pobriši merge produkt
    await ctx.db.delete(args.mergeProductId);

    return { success: true, pricesMoved };
  },
});

/**
 * Avtomatsko združi izdelke po podobnosti imena
 * OPTIMIZIRANA VERZIJA: Manjše branje dokumentov
 */
export const autoMerge = internalMutation({
  args: {
    minSimilarity: v.number(), // Minimum similarity score (0-100)
    batchSize: v.number(),     // Koliko izdelkov procesira naenkrat
  },
  returns: v.object({
    processed: v.number(),
    merged: v.number(),
    remaining: v.number(),
  }),
  handler: async (ctx, args) => {
    // OPTIMIZACIJA: Preberi stores ENKRAT
    const stores = await ctx.db.query("stores").collect();
    const storeMap = new Map(stores.map(s => [s._id.toString(), s.name]));

    // Omeji batch size za varnost (max 200 izdelkov)
    const safeBatchSize = Math.min(args.batchSize, 200);

    // Pridobi izdelke
    const allProducts = await ctx.db.query("products").take(safeBatchSize);

    // Za vsak izdelek pridobi samo cene (stores že imamo)
    const productsWithInfo = await Promise.all(
      allProducts.map(async (product) => {
        const prices = await ctx.db
          .query("prices")
          .withIndex("by_product", q => q.eq("productId", product._id))
          .collect();

        return {
          product,
          normalized: normalizeForMatch(product.name),
          keywords: extractKeywords(product.name),
          priceCount: prices.length,
          storeNames: prices.map(p => storeMap.get(p.storeId.toString()) || "unknown"),
        };
      })
    );

    // Grupiraj po prvem ključnem besedi (brand/tip)
    const groups = new Map<string, typeof productsWithInfo>();

    for (const item of productsWithInfo) {
      // Uporabi prve 2 besedi kot ključ
      const key = item.keywords.slice(0, 2).join(" ");
      if (!key) continue;

      const existing = groups.get(key) || [];
      existing.push(item);
      groups.set(key, existing);
    }

    let merged = 0;
    let processed = 0;

    // Za vsako grupo preveri če lahko združimo izdelke iz različnih trgovin
    for (const [key, items] of groups) {
      if (items.length < 2) continue;

      // Razdeli po trgovinah
      const byStore = new Map<string, typeof items[0][]>();
      for (const item of items) {
        for (const store of item.storeNames) {
          const existing = byStore.get(store) || [];
          existing.push(item);
          byStore.set(store, existing);
        }
      }

      // Če imamo izdelke iz različnih trgovin, jih poskusimo združiti
      const storeNames = Array.from(byStore.keys());
      if (storeNames.length < 2) continue;

      // Vzemi prvi izdelek kot "base"
      const baseItems = byStore.get(storeNames[0]) || [];
      if (baseItems.length === 0) continue;

      // OPTIMIZACIJA: Omeji na 3 base items per group
      for (const baseItem of baseItems.slice(0, 3)) {
        processed++;

        // Poišči najboljši match v drugih trgovinah (omeji na 2 trgovine)
        for (let i = 1; i < Math.min(storeNames.length, 3); i++) {
          const otherItems = byStore.get(storeNames[i]) || [];

          // OPTIMIZACIJA: Omeji na 3 items per store
          for (const otherItem of otherItems.slice(0, 3)) {
            // Preskoči če je isti izdelek
            if (otherItem.product._id === baseItem.product._id) continue;

            // Izračunaj podobnost
            const score = similarityScore(baseItem.product.name, otherItem.product.name);

            if (score >= args.minSimilarity) {
              // Združi!
              const pricesToMove = await ctx.db
                .query("prices")
                .withIndex("by_product", q => q.eq("productId", otherItem.product._id))
                .collect();

              for (const price of pricesToMove) {
                const existing = await ctx.db
                  .query("prices")
                  .withIndex("by_product_and_store", q =>
                    q.eq("productId", baseItem.product._id).eq("storeId", price.storeId)
                  )
                  .first();

                if (!existing) {
                  await ctx.db.patch(price._id, { productId: baseItem.product._id });
                } else {
                  await ctx.db.delete(price._id);
                }
              }

              // Posodobi ime
              const keepProduct = await ctx.db.get(baseItem.product._id);
              if (keepProduct) {
                const newName = createCanonicalName([keepProduct.name, otherItem.product.name]);
                const updates: Record<string, any> = {};
                if (newName !== keepProduct.name) updates.name = newName;
                if (!keepProduct.imageUrl && otherItem.product.imageUrl) {
                  updates.imageUrl = otherItem.product.imageUrl;
                }
                if (Object.keys(updates).length > 0) {
                  await ctx.db.patch(baseItem.product._id, updates);
                }
              }

              // Pobriši
              await ctx.db.delete(otherItem.product._id);
              merged++;
              break; // Samo en merge per base item
            }
          }
        }
      }
    }

    const remaining = productsWithInfo.filter(p => p.priceCount === 1).length;

    return {
      processed,
      merged,
      remaining,
    };
  },
});
