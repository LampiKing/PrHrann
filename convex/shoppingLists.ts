import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Ustvari novo nakupovalno listo
export const createList = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niste prijavljeni");

    const listId = await ctx.db.insert("shoppingLists", {
      userId: identity.subject,
      name: args.name,
      icon: args.icon || "🛒",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isShared: false,
    });

    return { success: true, listId };
  },
});

// Pridobi vse liste uporabnika
export const getLists = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userLists = await ctx.db
      .query("shoppingLists")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .collect();

    // Dodaj tudi liste ki so deljene z uporabnikom (family sharing)
    const sharedLists = await ctx.db
      .query("shoppingLists")
      .filter((q) => 
        q.and(
          q.eq(q.field("isShared"), true),
          q.neq(q.field("userId"), identity.subject)
        )
      )
      .collect();

    const relevantSharedLists = sharedLists.filter(
      list => list.sharedWith?.includes(identity.subject)
    );

    const allLists = [...userLists, ...relevantSharedLists];

    // Za vsako listo pridobi število itemov
    const listsWithCounts = await Promise.all(
      allLists.map(async (list) => {
        const items = await ctx.db
          .query("shoppingListItems")
          .withIndex("by_list", (q) => q.eq("listId", list._id))
          .collect();

        const checkedCount = items.filter(item => item.checked).length;

        return {
          ...list,
          totalItems: items.length,
          checkedItems: checkedCount,
          isOwner: list.userId === identity.subject,
        };
      })
    );

    return listsWithCounts.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Pridobi items za specifično listo
export const getListItems = query({
  args: {
    listId: v.id("shoppingLists"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { items: [], cheapestStore: null, totalCost: 0 };

    // Preveri dostop
    const list = await ctx.db.get(args.listId);
    if (!list) return { items: [], cheapestStore: null, totalCost: 0 };

    const hasAccess = 
      list.userId === identity.subject ||
      (list.sharedWith?.includes(identity.subject) ?? false);

    if (!hasAccess) return { items: [], cheapestStore: null, totalCost: 0 };

    const items = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .collect();

    // Za vsak item pridobi product details in najnižjo ceno
    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        if (!product) return null;

        // Pridobi vse cene za ta produkt
        const prices = await ctx.db
          .query("prices")
          .withIndex("by_product", (q) => q.eq("productId", item.productId))
          .collect();

        const pricesWithStores = await Promise.all(
          prices.map(async (price) => {
            const store = await ctx.db.get(price.storeId);
            return {
              ...price,
              storeName: store?.name,
              storeColor: store?.color,
            };
          })
        );

        const lowestPrice = pricesWithStores.reduce((min, p) => 
          p.price < min.price ? p : min
        );

        return {
          ...item,
          product,
          lowestPrice: lowestPrice.price,
          lowestPriceStore: lowestPrice.storeName,
          lowestPriceStoreColor: lowestPrice.storeColor,
          allPrices: pricesWithStores,
        };
      })
    );

    const validItems = itemsWithDetails.filter(item => item !== null);

    // Izračunaj najcenejšo trgovino za celotno listo
    const storeMap = new Map<string, { total: number; count: number; color: string }>();

    validItems.forEach(item => {
      if (!item) return;
      item.allPrices.forEach(price => {
        if (!price.storeName) return;
        const current = storeMap.get(price.storeName) || { total: 0, count: 0, color: price.storeColor || "#000" };
        storeMap.set(price.storeName, {
          total: current.total + (price.price * item.quantity),
          count: current.count + 1,
          color: price.storeColor || "#000",
        });
      });
    });

    let cheapestStore: { name: string; total: number; color: string; itemsCount: number } | null = null;
    let minTotal = Infinity;

    storeMap.forEach((value, storeName) => {
      // Samo trgovine ki imajo VSE produkte
      if (value.count === validItems.length && value.total < minTotal) {
        minTotal = value.total;
        cheapestStore = {
          name: storeName,
          total: value.total,
          color: value.color,
          itemsCount: value.count,
        };
      }
    });

    return {
      items: validItems,
      cheapestStore,
      totalCost: cheapestStore?.total || 0,
    };
  },
});

// Dodaj item v listo
export const addItem = mutation({
  args: {
    listId: v.id("shoppingLists"),
    productId: v.id("products"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niste prijavljeni");

    // Preveri če item že obstaja
    const existing = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .filter((q) => q.eq(q.field("productId"), args.productId))
      .first();

    if (existing) {
      // Posodobi količino
      await ctx.db.patch(existing._id, {
        quantity: existing.quantity + args.quantity,
      });
    } else {
      // Dodaj nov item
      await ctx.db.insert("shoppingListItems", {
        listId: args.listId,
        productId: args.productId,
        quantity: args.quantity,
        checked: false,
        addedBy: identity.subject,
        addedAt: Date.now(),
      });
    }

    // Posodobi updatedAt na listi
    await ctx.db.patch(args.listId, {
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Odstrani item iz liste
export const removeItem = mutation({
  args: {
    itemId: v.id("shoppingListItems"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niste prijavljeni");

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item ne obstaja");

    await ctx.db.delete(args.itemId);

    // Posodobi updatedAt na listi
    await ctx.db.patch(item.listId, {
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Označi item kot kupljen/nekupljen
export const toggleItemChecked = mutation({
  args: {
    itemId: v.id("shoppingListItems"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niste prijavljeni");

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item ne obstaja");

    await ctx.db.patch(args.itemId, {
      checked: !item.checked,
    });

    return { success: true, checked: !item.checked };
  },
});

// Posodobi količino
export const updateQuantity = mutation({
  args: {
    itemId: v.id("shoppingListItems"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niste prijavljeni");

    if (args.quantity <= 0) {
      await ctx.db.delete(args.itemId);
    } else {
      await ctx.db.patch(args.itemId, {
        quantity: args.quantity,
      });
    }

    return { success: true };
  },
});

// Izbriši listo
export const deleteList = mutation({
  args: {
    listId: v.id("shoppingLists"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niste prijavljeni");

    const list = await ctx.db.get(args.listId);
    if (!list) throw new Error("Lista ne obstaja");
    if (list.userId !== identity.subject) throw new Error("Nimate dovoljenja");

    // Izbriši vse items
    const items = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    // Izbriši listo
    await ctx.db.delete(args.listId);

    return { success: true };
  },
});

// Preimenuj listo
export const renameList = mutation({
  args: {
    listId: v.id("shoppingLists"),
    name: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niste prijavljeni");

    const list = await ctx.db.get(args.listId);
    if (!list) throw new Error("Lista ne obstaja");
    if (list.userId !== identity.subject) throw new Error("Nimate dovoljenja");

    await ctx.db.patch(args.listId, {
      name: args.name,
      icon: args.icon,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Deli listo z družinskimi člani (samo za family premium)
export const shareListWithFamily = mutation({
  args: {
    listId: v.id("shoppingLists"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niste prijavljeni");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .first();

    if (!profile?.isPremium || profile.premiumType !== "family") {
      throw new Error("Za deljenje list potrebujete Premium Family paket (2,99€/mesec)");
    }

    const list = await ctx.db.get(args.listId);
    if (!list) throw new Error("Lista ne obstaja");
    if (list.userId !== identity.subject) throw new Error("Nimate dovoljenja");

    // Deli z vsemi družinskimi člani
    await ctx.db.patch(args.listId, {
      isShared: true,
      sharedWith: profile.familyMembers || [],
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
