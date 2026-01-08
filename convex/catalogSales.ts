import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";

export const ingestCatalogSales = mutation({
    args: {
        sales: v.array(
            v.object({
                productName: v.string(),
                storeName: v.string(), // We'll map this to storeId
                originalPrice: v.number(),
                salePrice: v.number(),
                discountPercentage: v.optional(v.number()), // e.g. 23
                validFrom: v.string(), // ISO date
                validUntil: v.string(), // ISO date
                catalogSource: v.string(),
            })
        ),
    },
    handler: async (ctx, args) => {
        const { sales } = args;
        let insertedCount = 0;

        for (const sale of sales) {
            // 1. Resolve Store ID
            const store = await ctx.db
                .query("stores")
                .filter((q) => q.eq(q.field("name"), sale.storeName))
                .first();

            if (!store) {
                console.warn(`Store not found: ${sale.storeName}`);
                continue;
            }

            // 2. Try to match product (Simple exact or fuzzy match simulation)
            // For now, we store even if not matched, but ideally we link it.
            let productId = undefined;
            const product = await ctx.db
                .query("products")
                .withSearchIndex("search_name", (q) => q.search("name", sale.productName))
                .first();

            if (product) {
                productId = product._id;
            }

            // 3. Insert into salePrices
            // Check if already exists to avoid duplicates?
            const existing = await ctx.db
                .query("salePrices")
                .withIndex("by_product_name", (q) => q.eq("productName", sale.productName))
                .filter((q) => q.eq(q.field("validUntil"), sale.validUntil))
                .first();

            const isActive = new Date(sale.validUntil) >= new Date();

            if (!existing) {
                await ctx.db.insert("salePrices", {
                    productName: sale.productName,
                    productId: productId,
                    storeId: store._id,
                    originalPrice: sale.originalPrice,
                    salePrice: sale.salePrice,
                    discountPercentage: sale.discountPercentage || 0,
                    validFrom: sale.validFrom,
                    validUntil: sale.validUntil,
                    catalogSource: sale.catalogSource,
                    scrapedAt: Date.now(),
                    isActive: isActive,
                });
                insertedCount++;
            } else {
                // Update?
            }
        }

        return { status: "success", inserted: insertedCount };
    },
});
