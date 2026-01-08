import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const ALLOWED_STORE_NAMES = new Set(["Spar", "Mercator", "Tus"]);
const STORE_COLORS: Record<string, string> = {
  Spar: "#c8102e",
  Mercator: "#d3003c",
  Tus: "#0d8a3c",
};

const STORE_NAME_MAP: Record<string, string> = {
  "spar online": "Spar",
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
  const normalized = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/,/g, ".")
    .replace(/[^a-z0-9.%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
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
    const storeMap = new Map(
      stores.map((store) => [normalize(store.name), store])
    );

    const existingProducts = await ctx.db.query("products").collect();
    const productMap = new Map<string, typeof existingProducts[0]>();
    for (const product of existingProducts) {
      const key = normalizeProductKey(product.name);
      if (!key || productMap.has(key)) continue;
      productMap.set(key, product);
    }

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
      const mappedStoreName = STORE_NAME_MAP[rawStore] || item.trgovina;
      let store: typeof stores[0] | null | undefined = storeMap.get(normalize(mappedStoreName));
      if (!store) {
        if (!ALLOWED_STORE_NAMES.has(mappedStoreName)) {
          unknownStores += 1;
          continue;
        }
        const storeId = await ctx.db.insert("stores", {
          name: mappedStoreName,
          color: STORE_COLORS[mappedStoreName] ?? "#8b5cf6",
          isPremium: false,
        });
        store = await ctx.db.get(storeId);
        if (!store) {
          skipped += 1;
          continue;
        }
        if (!store) {
          skipped += 1;
          continue;
        }
        storeMap.set(normalize(store.name), store);
      }
      if (!ALLOWED_STORE_NAMES.has(store.name)) {
        unknownStores += 1;
        continue;
      }

      const category = item.kategorija?.trim() || "Neznana kategorija";
      // Use provided unit or infer from name
      const unit = item.enota?.trim() || inferUnit(rawName);

      let product = productMap.get(nameKey);
      if (!product) {
        const productId = await ctx.db.insert("products", {
          name: rawName,
          category,
          unit,
          imageUrl: undefined,
        });
        product = {
          _id: productId,
          _creationTime: Date.now(),
          name: rawName,
          category,
          unit,
          imageUrl: undefined,
        };
        productMap.set(nameKey, product);
        createdProducts += 1;
      } else {
        const updates: Partial<typeof product> = {};
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
        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(product._id, updates);
          product = { ...product, ...updates };
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

      if (!existingPrice) {
        await ctx.db.insert("prices", {
          productId: product._id,
          storeId: store._id,
          price,
          originalPrice,
          isOnSale,
          lastUpdated: Date.now(),
        });
        createdPrices += 1;
      } else {
        await ctx.db.patch(existingPrice._id, {
          price,
          originalPrice,
          isOnSale,
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
