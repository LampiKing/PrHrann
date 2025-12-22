import { v } from "convex/values";
import { authQuery, authMutation } from "./functions";
import { Id } from "./_generated/dataModel";

// Pridobi košarico uporabnika
export const getCart = authQuery({
  args: {},
  returns: v.object({
    items: v.array(
      v.object({
        _id: v.id("cartItems"),
        productId: v.id("products"),
        productName: v.string(),
        productUnit: v.string(),
        storeId: v.id("stores"),
        storeName: v.string(),
        storeColor: v.string(),
        quantity: v.number(),
        priceAtAdd: v.number(),
        currentPrice: v.number(),
      })
    ),
    groupedByStore: v.array(
      v.object({
        storeId: v.id("stores"),
        storeName: v.string(),
        storeColor: v.string(),
        items: v.array(
          v.object({
            _id: v.id("cartItems"),
            productId: v.id("products"),
            productName: v.string(),
            productUnit: v.string(),
            storeId: v.id("stores"),
            storeName: v.string(),
            storeColor: v.string(),
            quantity: v.number(),
            priceAtAdd: v.number(),
            currentPrice: v.number(),
          })
        ),
        subtotal: v.number(),
      })
    ),
    total: v.number(),
    itemCount: v.number(),
  }),
  handler: async (ctx) => {
    const userId = ctx.user._id;

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const items = await Promise.all(
      cartItems.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        const store = await ctx.db.get(item.storeId);
        
        // Pridobi trenutno ceno
        const currentPriceDoc = await ctx.db
          .query("prices")
          .withIndex("by_product_and_store", (q) =>
            q.eq("productId", item.productId).eq("storeId", item.storeId)
          )
          .first();

        return {
          _id: item._id,
          productId: item.productId,
          productName: product?.name || "Neznano",
          productUnit: product?.unit || "",
          storeId: item.storeId,
          storeName: store?.name || "Neznano",
          storeColor: store?.color || "#666",
          quantity: item.quantity,
          priceAtAdd: item.priceAtAdd,
          currentPrice: currentPriceDoc?.price || item.priceAtAdd,
        };
      })
    );

    // Grupiraj po trgovinah
    const storeGroups = new Map<
      Id<"stores">,
      {
        storeId: Id<"stores">;
        storeName: string;
        storeColor: string;
        items: typeof items;
        subtotal: number;
      }
    >();

    for (const item of items) {
      const existing = storeGroups.get(item.storeId);
      if (existing) {
        existing.items.push(item);
        existing.subtotal += item.currentPrice * item.quantity;
      } else {
        storeGroups.set(item.storeId, {
          storeId: item.storeId,
          storeName: item.storeName,
          storeColor: item.storeColor,
          items: [item],
          subtotal: item.currentPrice * item.quantity,
        });
      }
    }

    const groupedByStore = Array.from(storeGroups.values()).map((group) => ({
      ...group,
      subtotal: Math.round(group.subtotal * 100) / 100,
    }));

    const total = Math.round(
      items.reduce((sum, item) => sum + item.currentPrice * item.quantity, 0) * 100
    ) / 100;

    return {
      items,
      groupedByStore,
      total,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  },
});

// Dodaj v košarico
export const addToCart = authMutation({
  args: {
    productId: v.id("products"),
    storeId: v.id("stores"),
    price: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;

    // Preveri, če že obstaja
    const existing = await ctx.db
      .query("cartItems")
      .withIndex("by_user_and_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    if (existing && existing.storeId === args.storeId) {
      // Povečaj količino
      await ctx.db.patch(existing._id, {
        quantity: existing.quantity + 1,
      });
    } else if (existing) {
      // Zamenjaj trgovino
      await ctx.db.patch(existing._id, {
        storeId: args.storeId,
        priceAtAdd: args.price,
        quantity: 1,
      });
    } else {
      // Dodaj nov izdelek
      await ctx.db.insert("cartItems", {
        userId,
        productId: args.productId,
        storeId: args.storeId,
        quantity: 1,
        priceAtAdd: args.price,
      });
    }
    return null;
  },
});

// Posodobi količino
export const updateQuantity = authMutation({
  args: {
    cartItemId: v.id("cartItems"),
    quantity: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.quantity <= 0) {
      await ctx.db.delete(args.cartItemId);
    } else {
      await ctx.db.patch(args.cartItemId, { quantity: args.quantity });
    }
    return null;
  },
});

// Odstrani iz košarice
export const removeFromCart = authMutation({
  args: { cartItemId: v.id("cartItems") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.cartItemId);
    return null;
  },
});

// Izprazni košarico
export const clearCart = authMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const items = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    return null;
  },
});
