import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Trgovine (Spar, Mercator, Tuš, Lidl, Hofer, Jager)
  stores: defineTable({
    name: v.string(),
    logo: v.optional(v.string()),
    color: v.string(),
    isPremium: v.boolean(), // Ali je trgovina samo za premium uporabnike
  }),

  // Izdelki
  products: defineTable({
    name: v.string(),
    category: v.string(),
    unit: v.string(), // npr. "1L", "500g", "1kg"
    imageUrl: v.optional(v.string()),
  }).index("by_name", ["name"])
    .index("by_category", ["category"]),

  // Cene izdelkov po trgovinah
  prices: defineTable({
    productId: v.id("products"),
    storeId: v.id("stores"),
    price: v.number(),
    originalPrice: v.optional(v.number()), // Če je na akciji
    isOnSale: v.boolean(),
    lastUpdated: v.number(),
  }).index("by_product", ["productId"])
    .index("by_store", ["storeId"])
    .index("by_product_and_store", ["productId", "storeId"]),

  // Napredni kuponski sistem
  coupons: defineTable({
    storeId: v.id("stores"),
    code: v.string(),
    description: v.string(),
    // Tip kupona: percentage_total, percentage_single_item, fixed, category_discount
    couponType: v.optional(v.union(
      v.literal("percentage_total"),
      v.literal("percentage_single_item"),
      v.literal("fixed"),
      v.literal("category_discount")
    )),
    discountType: v.optional(v.string()), // Legacy field for backwards compatibility
    discountValue: v.number(),
    minPurchase: v.optional(v.number()),
    // Dnevi veljavnosti (0=nedelja, 1=ponedeljek, ..., 6=sobota)
    validDays: v.optional(v.array(v.number())),
    validFrom: v.optional(v.number()),
    validUntil: v.number(),
    // Ali velja na akcijske izdelke
    excludeSaleItems: v.optional(v.boolean()),
    // Ali zahteva kartico zvestobe
    requiresLoyaltyCard: v.optional(v.boolean()),
    // Ali se lahko kombinira z drugimi kuponi
    canCombine: v.optional(v.boolean()),
    // Kategorije za category_discount tip
    applicableCategories: v.optional(v.array(v.string())),
    isPremiumOnly: v.boolean(),
  }).index("by_store", ["storeId"]),

  // Uporabniški profili
  userProfiles: defineTable({
    userId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    // Datum rojstva
    birthDate: v.optional(v.object({
      day: v.number(),
      month: v.number(),
      year: v.number(),
    })),
    isPremium: v.boolean(),
    premiumUntil: v.optional(v.number()),
    premiumType: v.optional(v.union(v.literal("solo"), v.literal("family"))), // solo: 1.99€, family: 2.99€
    familyOwnerId: v.optional(v.string()), // Če je član family plana
    familyMembers: v.optional(v.array(v.string())), // Max 3 osebe za family plan
    dailySearches: v.number(),
    lastSearchDate: v.string(), // YYYY-MM-DD format
    searchResetTime: v.optional(v.number()), // Timestamp when searches reset
    // Kartice zvestobe
    loyaltyCards: v.optional(v.array(v.id("stores"))),
    // Priljubljene trgovine
    favoriteStores: v.optional(v.array(v.id("stores"))),
    // Security tracking
    lastIpAddress: v.optional(v.string()),
    lastDeviceInfo: v.optional(v.string()),
    suspiciousActivity: v.optional(v.boolean()),
    // Savings tracker
    totalSavings: v.optional(v.number()), // Skupni prihranki
    monthlySavings: v.optional(v.number()), // Prihranki ta mesec
    lastSavingsReset: v.optional(v.number()), // Kdaj resetiramo mesečne
  }).index("by_user_id", ["userId"])
    .index("by_family_owner", ["familyOwnerId"]),

  // Shopping Lists
  shoppingLists: defineTable({
    userId: v.string(),
    name: v.string(), // "Tedenski nakup", "Za žur"...
    icon: v.optional(v.string()), // Emoji ikona
    createdAt: v.number(),
    updatedAt: v.number(),
    // Family sharing
    sharedWith: v.optional(v.array(v.string())), // userId-ji družinskih članov
    isShared: v.optional(v.boolean()),
  }).index("by_user_id", ["userId"])
    .index("by_created_at", ["userId", "createdAt"]),

  // Shopping List Items
  shoppingListItems: defineTable({
    listId: v.id("shoppingLists"),
    productId: v.id("products"),
    quantity: v.number(),
    checked: v.boolean(), // Ali je že kupljeno
    addedBy: v.optional(v.string()), // Kdo je dodal (za family)
    addedAt: v.number(),
  }).index("by_list", ["listId"])
    .index("by_product", ["productId"]),

  // Price Alerts
  priceAlerts: defineTable({
    userId: v.string(),
    productId: v.id("products"),
    storeId: v.optional(v.id("stores")), // Če želi spremljati specifično trgovino
    targetPrice: v.number(), // Želena cena
    currentPrice: v.number(), // Trenutna najnižja cena
    isActive: v.boolean(),
    triggered: v.boolean(), // Ali je bil alert že sprožen
    triggeredAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_product", ["productId"])
    .index("by_active", ["isActive"]),

  // Purchases (za savings tracking)
  purchases: defineTable({
    userId: v.string(),
    productId: v.id("products"),
    storeId: v.id("stores"),
    quantity: v.number(),
    pricePaid: v.number(), // Cena ki jo je plačal
    regularPrice: v.number(), // Redna cena (brez akcije)
    savedAmount: v.number(), // Prihranek
    purchaseDate: v.number(),
  }).index("by_user", ["userId"])
    .index("by_date", ["userId", "purchaseDate"]),

  // Active sessions tracking
  activeSessions: defineTable({
    userId: v.string(),
    sessionToken: v.string(),
    ipAddress: v.string(),
    deviceInfo: v.optional(v.string()),
    location: v.optional(v.object({
      country: v.optional(v.string()),
      city: v.optional(v.string()),
      coordinates: v.optional(v.object({
        lat: v.number(),
        lon: v.number(),
      })),
    })),
    createdAt: v.number(),
    lastActiveAt: v.number(),
    expiresAt: v.number(),
  }).index("by_user_id", ["userId"])
    .index("by_session_token", ["sessionToken"])
    .index("by_expires_at", ["expiresAt"]),

  // Košarica
  cartItems: defineTable({
    userId: v.string(),
    productId: v.id("products"),
    storeId: v.id("stores"),
    quantity: v.number(),
    priceAtAdd: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_and_product", ["userId", "productId"]),

  // Zgodovina iskanj
  searchHistory: defineTable({
    userId: v.optional(v.string()),
    query: v.string(),
    timestamp: v.number(),
  }).index("by_user", ["userId"]),
});
