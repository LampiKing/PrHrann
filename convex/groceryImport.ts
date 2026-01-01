import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const STORE_NAME_MAP: Record<string, string> = {
  "spar online": "Spar",
  "mercator online": "Mercator",
  "hitri nakup": "Tus",
  "tuš": "Tus",
  "tus": "Tus",
  "trgovine jager": "Jager",
  "jager": "Jager",
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizeName = (value: string) =>
  value.replace(/\s+/g, " ").trim();

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
    const productMap = new Map(
      existingProducts.map((product) => [normalize(product.name), product])
    );

    let createdProducts = 0;
    let updatedProducts = 0;
    let createdPrices = 0;
    let updatedPrices = 0;
    let skipped = 0;
    let unknownStores = 0;

    for (const item of args.items) {
      const rawName = normalizeName(item.ime || "");
      if (!rawName) {
        skipped += 1;
        continue;
      }

      const rawStore = normalize(item.trgovina || "");
      const mappedStoreName = STORE_NAME_MAP[rawStore] || item.trgovina;
      const store = storeMap.get(normalize(mappedStoreName));
      if (!store) {
        unknownStores += 1;
        continue;
      }

      const category = item.kategorija?.trim() || "Neznana kategorija";
      const unit = inferUnit(rawName);

      let product = productMap.get(normalize(rawName));
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
        productMap.set(normalize(rawName), product);
        createdProducts += 1;
      } else if (!product.category || product.category === "Neznana kategorija") {
        await ctx.db.patch(product._id, { category });
        updatedProducts += 1;
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
