import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const ALLOWED_STORE_NAMES = new Set(["Spar", "Mercator", "Tus"]);
const CLEAR_BATCH_SIZE = 1000;
const STORE_COLORS: Record<string, string> = {
  Spar: "#c8102e",
  Mercator: "#d3003c",
  Tus: "#0d8a3c",
};

const STORE_NAME_MAP: Record<string, string> = {
  "spar": "Spar",
  "spar online": "Spar",
  "mercator": "Mercator",
  "mercator online": "Mercator",
  "hitri nakup": "Tus",
  "tuš": "Tus",
  "tus": "Tus",
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizeName = (value: string) =>
  value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const normalizeProductToken = (token: string) => {
  if (!token) return "";
  let cleaned = token.replace(/×/g, "x");
  if (/^[a-z.]+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "");
  }
  const match = cleaned.match(/^(\d+(?:\.\d+)?)(kg|g|l|ml|cl|dl)$/i);
  if (!match) return cleaned;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return cleaned;
  const unit = match[2].toLowerCase();
  const formatNumber = (num: number) => {
    const rounded = Math.round(num * 1000) / 1000;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  };
  if (unit === "g") return `${formatNumber(value / 1000)}kg`;
  if (unit === "ml") return `${formatNumber(value / 1000)}l`;
  if (unit === "cl") return `${formatNumber(value / 100)}l`;
  if (unit === "dl") return `${formatNumber(value / 10)}l`;
  return `${formatNumber(value)}${unit}`;
};

const normalizeProductKey = (value: string) => {
  let normalized = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/,/g, ".")
    .replace(/[^a-z0-9.%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";

  // POMEMBNO: Združi število + enoto če sta ločena s presledkom
  // "250 g" -> "250g", "1 l" -> "1l", "500 ml" -> "500ml"
  normalized = normalized.replace(/(\d+(?:\.\d+)?)\s+(kg|g|l|ml|cl|dl|kos|kom)\b/gi, "$1$2");

  const tokens = normalized
    .split(" ")
    .map((token) => normalizeProductToken(token))
    .filter(Boolean);
  if (!tokens.length) return "";
  const tokenSet = new Set(tokens);
  return Array.from(tokenSet).sort().join(" ");
};

const scoreDisplayName = (value: string) => {
  let score = 0;
  if (/\s/.test(value)) score += 2;
  if (/\d/.test(value)) score += 1;
  if (value.length >= 12) score += 1;
  return score;
};

const inferUnit = (name: string) => {
  const match = name.match(
    /(\d+(?:[.,]\d+)?)\s?(kg|g|l|ml|cl|dl)\b/i
  );
  if (match) {
    return `${match[1].replace(",", ".")}${match[2].toLowerCase()}`;
  }
  const packMatch = name.match(
    /(\d+)\s?(kos|kom|komadov|pack|pck|pcs)\b/i
  );
  if (packMatch) {
    return `${packMatch[1]} kos`;
  }
  return "1 kos";
};

export const importFromScanner = internalMutation({
  args: {
    items: v.array(
      v.object({
        ime: v.string(),
        redna_cena: v.optional(v.number()),
        akcijska_cena: v.optional(v.number()),
        kategorija: v.optional(v.string()),
        enota: v.optional(v.string()),
        trgovina: v.string(),
        url: v.optional(v.string()),
        slika: v.optional(v.string()), // URL slike izdelka
        // Datumi veljavnosti akcije
        akcija_od: v.optional(v.string()), // "2026-01-15" ali "15.1.2026"
        akcija_do: v.optional(v.string()), // "2026-01-21" ali "21.1.2026"
        katalog: v.optional(v.string()), // "Mercator katalog 3/2026"
      })
    ),
  },
  returns: v.object({
    createdProducts: v.number(),
    updatedProducts: v.number(),
    createdPrices: v.number(),
    updatedPrices: v.number(),
    skipped: v.number(),
    unknownStores: v.number(),
  }),
  handler: async (ctx, args) => {
    const stores = await ctx.db.query("stores").collect();
    // Prefer canonical store names (Spar/Mercator/Tus) when duplicates exist
    // (e.g., "SPAR" created by legacy imports).
    const storeMap = new Map<string, typeof stores[0]>();
    for (const store of stores) {
      const key = normalize(store.name);
      const isCanonical = ALLOWED_STORE_NAMES.has(store.name);
      if (isCanonical || !storeMap.has(key)) {
        storeMap.set(key, store);
      }
    }
    const productCache = new Map<string, any>();

    let createdProducts = 0;
    let updatedProducts = 0;
    let createdPrices = 0;
    let updatedPrices = 0;
    let skipped = 0;
    let unknownStores = 0;

    for (const item of args.items) {
      const rawName = normalizeName(item.ime || "");
      const nameKey = normalizeProductKey(rawName);
      if (!rawName || !nameKey) {
        skipped += 1;
        continue;
      }

      const rawStore = normalize(item.trgovina || "");
      const canonicalStoreName = STORE_NAME_MAP[rawStore] || item.trgovina;
      if (!ALLOWED_STORE_NAMES.has(canonicalStoreName)) {
        unknownStores += 1;
        continue;
      }

      const storeKey = normalize(canonicalStoreName);
      let store: typeof stores[0] | null | undefined = storeMap.get(storeKey);
      if (!store) {
        const storeId = await ctx.db.insert("stores", {
          name: canonicalStoreName,
          color: STORE_COLORS[canonicalStoreName] ?? "#8b5cf6",
          isPremium: false,
        });
        store = await ctx.db.get(storeId);
        if (!store) {
          skipped += 1;
          continue;
        }
        storeMap.set(storeKey, store);
      } else if (store.name !== canonicalStoreName) {
        // Normalize legacy names like "SPAR", "MERCATOR", "TUŠ" to canonical names.
        const nextColor = STORE_COLORS[canonicalStoreName] ?? store.color;
        await ctx.db.patch(store._id, {
          name: canonicalStoreName,
          color: nextColor,
        });
        store = { ...store, name: canonicalStoreName, color: nextColor };
        storeMap.set(storeKey, store);
      }

      const category = item.kategorija?.trim() || "Neznana kategorija";
      // Use provided unit or infer from name
      const unit = item.enota?.trim() || inferUnit(rawName);

      // Slika izdelka
      const imageUrl = item.slika?.trim() || undefined;

      // NOVO: Najprej poišči izdelek po SLIKI (isti izdelek v različnih trgovinah ima isto sliko!)
      let product = productCache.get(nameKey);
      if (!product && imageUrl) {
        // Poišči po image URL - to je KLJUČNO za združevanje istih izdelkov iz različnih trgovin
        product = await ctx.db
          .query("products")
          .withIndex("by_image", (q) => q.eq("imageUrl", imageUrl))
          .first();
        if (product) {
          productCache.set(nameKey, product);
          // Shrani tudi pod image key za hitrejše iskanje
          productCache.set(`img:${imageUrl}`, product);
        }
      }
      // Če ni najdeno po sliki, preveri cache po image URL
      if (!product && imageUrl) {
        product = productCache.get(`img:${imageUrl}`);
      }
      // Fallback na nameKey in name
      if (!product) {
        product = await ctx.db
          .query("products")
          .withIndex("by_name_key", (q) => q.eq("nameKey", nameKey))
          .first();
        if (!product) {
          product = await ctx.db
            .query("products")
            .withIndex("by_name", (q) => q.eq("name", rawName))
            .first();
        }
        if (product) {
          productCache.set(nameKey, product);
        }
      }

      if (!product) {
        const productId = await ctx.db.insert("products", {
          name: rawName,
          nameKey,
          category,
          unit,
          imageUrl,
        });
        product = {
          _id: productId,
          _creationTime: Date.now(),
          name: rawName,
          nameKey,
          category,
          unit,
          imageUrl,
        };
        productCache.set(nameKey, product);
        createdProducts += 1;
      } else {
        const updates: Partial<typeof product> = {};
        if (product.nameKey !== nameKey) {
          updates.nameKey = nameKey;
        }
        if (!product.category || product.category === "Neznana kategorija") {
          updates.category = category;
        }
        const inferredUnit = item.enota?.trim() || inferUnit(rawName);
        if (product.unit === "1 kos" && inferredUnit !== "1 kos") {
          updates.unit = inferredUnit;
        }
        const incomingScore = scoreDisplayName(rawName);
        const existingScore = scoreDisplayName(product.name);
        if (incomingScore > existingScore && rawName.length > product.name.length) {
          updates.name = rawName;
        }
        // VEDNO posodobi sliko če imamo novo (preference: nova slika je boljša)
        if (imageUrl) {
          updates.imageUrl = imageUrl;
        }
        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(product._id, updates);
          product = { ...product, ...updates };
          productCache.set(nameKey, product);
          updatedProducts += 1;
        }
      }

      const price =
        item.akcijska_cena ??
        item.redna_cena ??
        undefined;
      if (!price || !Number.isFinite(price) || price <= 0) {
        skipped += 1;
        continue;
      }

      const isOnSale =
        item.akcijska_cena !== undefined &&
        item.redna_cena !== undefined &&
        item.akcijska_cena < item.redna_cena;

      const originalPrice = isOnSale ? item.redna_cena : undefined;

      const existingPrice = await ctx.db
        .query("prices")
        .withIndex("by_product_and_store", (q) =>
          q.eq("productId", product._id).eq("storeId", store._id)
        )
        .first();

      // Parsiraj datume akcije
      const parseDate = (dateStr?: string): string | undefined => {
        if (!dateStr) return undefined;
        // Podpira: "2026-01-15", "15.1.2026", "15. 1. 2026"
        const clean = dateStr.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean; // ISO format
        const match = clean.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
        if (match) {
          const [, d, m, y] = match;
          return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        }
        return undefined;
      };

      const saleValidFrom = parseDate(item.akcija_od);
      const saleValidUntil = parseDate(item.akcija_do);
      const catalogSource = item.katalog?.trim() || undefined;

      if (!existingPrice) {
        await ctx.db.insert("prices", {
          productId: product._id,
          storeId: store._id,
          price,
          originalPrice,
          isOnSale,
          saleValidFrom,
          saleValidUntil,
          catalogSource,
          lastUpdated: Date.now(),
        });
        createdPrices += 1;
      } else {
        await ctx.db.patch(existingPrice._id, {
          price,
          originalPrice,
          isOnSale,
          saleValidFrom,
          saleValidUntil,
          catalogSource,
          lastUpdated: Date.now(),
        });
        updatedPrices += 1;
      }
    }

    return {
      createdProducts,
      updatedProducts,
      createdPrices,
      updatedPrices,
      skipped,
      unknownStores,
    };
  },
});

// Funkcija za brisanje vseh izdelkov in cen (za fresh import)
export const clearAllProductsAndPrices = internalMutation({
  args: {},
  returns: v.object({
    deletedProducts: v.number(),
    deletedPrices: v.number(),
  }),
  handler: async (ctx) => {
    const prices = await ctx.db.query("prices").take(CLEAR_BATCH_SIZE);
    for (const price of prices) await ctx.db.delete(price._id);

    const remaining = CLEAR_BATCH_SIZE - prices.length;
    const products = remaining > 0
      ? await ctx.db.query("products").take(remaining)
      : [];
    for (const product of products) await ctx.db.delete(product._id);

    return {
      deletedProducts: products.length,
      deletedPrices: prices.length,
    };
  },
});
