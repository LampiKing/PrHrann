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
        productCategory: v.string(),
        storeId: v.id("stores"),
        storeName: v.string(),
        storeColor: v.string(),
        quantity: v.number(),
        priceAtAdd: v.number(),
        currentPrice: v.number(),
        isOnSale: v.boolean(),
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
            productCategory: v.string(),
            storeId: v.id("stores"),
            storeName: v.string(),
            storeColor: v.string(),
            quantity: v.number(),
            priceAtAdd: v.number(),
            currentPrice: v.number(),
            isOnSale: v.boolean(),
          })
        ),
        subtotal: v.number(),
        bestCoupon: v.optional(
          v.object({
            couponId: v.id("coupons"),
            code: v.string(),
            description: v.string(),
            savings: v.number(),
            appliedTo: v.string(),
            finalSubtotal: v.number(),
          })
        ),
      })
    ),
    total: v.number(),
    totalWithCoupons: v.number(),
    totalSavings: v.number(),
    itemCount: v.number(),
  }),
  handler: async (ctx) => {
    const userId = ctx.user._id;

    // Pridobi uporabniški profil za premium status in loyalty cards
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    const isPremium = profile?.isPremium ?? false;

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
          productCategory: product?.category || "Ostalo",
          storeId: item.storeId,
          storeName: store?.name || "Neznano",
          storeColor: store?.color || "#666",
          quantity: item.quantity,
          priceAtAdd: item.priceAtAdd,
          currentPrice: currentPriceDoc?.price || item.priceAtAdd,
          isOnSale: currentPriceDoc?.isOnSale ?? false,
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

    // Izračunaj najboljše kupone za vsako trgovino
    let totalSavings = 0;
    const groupedWithCoupons = await Promise.all(
      Array.from(storeGroups.values()).map(async (group) => {
        const subtotal = Math.round(group.subtotal * 100) / 100;
        
        // Pridobi vse veljavne kupone za to trgovino
        const coupons = await ctx.db
          .query("coupons")
          .withIndex("by_store", (q) => q.eq("storeId", group.storeId))
          .collect();

        const now = Date.now();
        const currentDay = new Date().getDay();
        const hasLoyaltyCard = profile?.loyaltyCards?.includes(group.storeId) ?? false;

        // Filtriraj veljavne kupone
        const validCoupons = coupons.filter((c) => {
          if (!c || !c.validUntil) return false;
          if (c.validUntil < now) return false;
          if (c.validFrom && c.validFrom > now) return false;
          if (c.validDays && c.validDays.length > 0 && !c.validDays.includes(currentDay)) return false;
          if (c.isPremiumOnly && !isPremium) return false;
          if (c.requiresLoyaltyCard && !hasLoyaltyCard) return false;
          return true;
        });

        let bestCoupon = null;
        let maxSavings = 0;

        // Izračunaj prihranek za vsak kupon
        for (const coupon of validCoupons) {
          const couponType = coupon.couponType ?? (coupon.discountType === "percentage" ? "percentage_total" : "fixed");
          const excludeSaleItems = coupon.excludeSaleItems ?? false;
          
          // Preveri minimalni znesek
          if (coupon.minPurchase && subtotal < coupon.minPurchase) continue;

          let savings = 0;
          let appliedTo = "";
          const eligibleItems = excludeSaleItems ? group.items.filter(i => !i.isOnSale) : group.items;
          
          switch (couponType) {
            case "percentage_total": {
              const eligibleTotal = eligibleItems.reduce((sum, i) => sum + i.currentPrice * i.quantity, 0);
              savings = eligibleTotal * (coupon.discountValue / 100);
              appliedTo = "celoten nakup";
              break;
            }
            case "percentage_single_item": {
              if (eligibleItems.length === 0) break;
              const bestItem = [...eligibleItems].sort((a, b) => b.currentPrice - a.currentPrice)[0];
              savings = bestItem.currentPrice * (coupon.discountValue / 100);
              appliedTo = bestItem.productName;
              break;
            }
            case "fixed": {
              savings = Math.min(coupon.discountValue, subtotal);
              appliedTo = "celoten nakup";
              break;
            }
            case "category_discount": {
              const categoryItems = eligibleItems.filter(i => 
                coupon.applicableCategories?.includes(i.productCategory)
              );
              const categoryTotal = categoryItems.reduce((sum, i) => sum + i.currentPrice * i.quantity, 0);
              savings = categoryTotal * (coupon.discountValue / 100);
              appliedTo = `kategorija: ${coupon.applicableCategories?.join(", ")}`;
              break;
            }
          }

          if (savings > maxSavings) {
            maxSavings = savings;
            bestCoupon = {
              couponId: coupon._id,
              code: coupon.code,
              description: coupon.description,
              savings: Math.round(savings * 100) / 100,
              appliedTo,
              finalSubtotal: Math.round((subtotal - savings) * 100) / 100,
            };
          }
        }

        if (bestCoupon) {
          totalSavings += bestCoupon.savings;
        }

        return {
          ...group,
          subtotal,
          bestCoupon: bestCoupon || undefined,
        };
      })
    );

    const total = Math.round(
      items.reduce((sum, item) => sum + item.currentPrice * item.quantity, 0) * 100
    ) / 100;

    const totalWithCoupons = Math.round((total - totalSavings) * 100) / 100;

    return {
      items,
      groupedByStore: groupedWithCoupons,
      total,
      totalWithCoupons,
      totalSavings: Math.round(totalSavings * 100) / 100,
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
