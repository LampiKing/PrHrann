import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Trgovine (Spar, Mercator, Tus)
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
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"])
    .searchIndex("search_name", { searchField: "name" }),

  // Cene izdelkov po trgovinah
  prices: defineTable({
    productId: v.id("products"),
    storeId: v.id("stores"),
    price: v.number(),
    originalPrice: v.optional(v.number()), // Če je na akciji
    isOnSale: v.boolean(),
    lastUpdated: v.number(),
  })
    .index("by_product", ["productId"])
    .index("by_store", ["storeId"])
    .index("by_product_and_store", ["productId", "storeId"]),

  // Napredni kuponski sistem
  coupons: defineTable({
    storeId: v.id("stores"),
    code: v.string(),
    description: v.string(),
    // Tip kupona: percentage_total, percentage_single_item, fixed, category_discount
    couponType: v.optional(
      v.union(
        v.literal("percentage_total"),
        v.literal("percentage_single_item"),
        v.literal("fixed"),
        v.literal("category_discount")
      )
    ),
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
    // Dodatni pogoji
    maxUsesPerUser: v.optional(v.number()), // Koliko krat lahko uporabnik uporabi (npr. 1 za ENKRAT)
    excludedProducts: v.optional(v.array(v.string())), // Izključeni izdelki (npr. "postreženo meso")
    additionalNotes: v.optional(v.string()), // Dodatna opozorila
    weekNumber: v.optional(v.number()), // Za tedenski tracking kuponov
    isActive: v.optional(v.boolean()), // Ali je kupon aktiven
    isPremiumOnly: v.boolean(),
  }).index("by_store", ["storeId"]),

  // Coupon Usage Tracking - za maxUsesPerUser
  couponUsage: defineTable({
    userId: v.string(),
    couponId: v.id("coupons"),
    usedAt: v.number(),
    orderId: v.optional(v.string()), // Za tracking že implementiramo naročila
    savings: v.number(), // Koliko je uporabnik prihranil
  })
    .index("by_user_and_coupon", ["userId", "couponId"])
    .index("by_user", ["userId"]),

  // Uporabniški profili
  userProfiles: defineTable({
    userId: v.string(),
    name: v.optional(v.string()),
    nickname: v.optional(v.string()),
    nicknameLower: v.optional(v.string()),
    nicknameUpdatedAt: v.optional(v.number()),
    nicknameChangeAvailableAt: v.optional(v.number()),
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    isAnonymous: v.optional(v.boolean()),
    isAdmin: v.optional(v.boolean()),
    // Datum rojstva
    birthDate: v.optional(
      v.object({
        day: v.number(),
        month: v.number(),
        year: v.number(),
      })
    ),
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
  })
    .index("by_user_id", ["userId"])
    .index("by_family_owner", ["familyOwnerId"])
    .index("by_nickname", ["nicknameLower"]),

  // Email verification records
  emailVerifications: defineTable({
    userId: v.string(),
    email: v.string(),
    code: v.string(), // 6-mestna koda
    token: v.string(), // povezava token
    createdAt: v.number(),
    expiresAt: v.number(),
    verified: v.boolean(),
    verifiedAt: v.optional(v.number()),
    resendCount: v.optional(v.number()), // koliko krat je bila koda ponovno poslana
    lastSentAt: v.optional(v.number()), // zadnji čas pošiljanja emaila
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"]),

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
  })
    .index("by_user_id", ["userId"])
    .index("by_created_at", ["userId", "createdAt"]),

  // Shopping List Items
  shoppingListItems: defineTable({
    listId: v.id("shoppingLists"),
    productId: v.id("products"),
    quantity: v.number(),
    checked: v.boolean(), // Ali je že kupljeno
    addedBy: v.optional(v.string()), // Kdo je dodal (za family)
    addedAt: v.number(),
  })
    .index("by_list", ["listId"])
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
  })
    .index("by_user", ["userId"])
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
  })
    .index("by_user", ["userId"])
    .index("by_date", ["userId", "purchaseDate"]),

  // Računi (OCR + prihranki)
  receipts: defineTable({
    userId: v.string(),
    groupId: v.string(),
    storeName: v.optional(v.string()),
    storeNameLower: v.optional(v.string()),
    storeId: v.optional(v.id("stores")),
    purchaseDate: v.number(),
    purchaseDateKey: v.string(),
    purchaseTime: v.optional(v.string()),
    totalPaid: v.number(),
    currency: v.optional(v.string()),
    referenceTotal: v.optional(v.number()),
    savedAmount: v.number(),
    isValid: v.boolean(),
    invalidReason: v.optional(v.string()),
    confirmed: v.boolean(),
    source: v.string(),
    // Tip računa (fizični, virtualni, email)
    receiptType: v.optional(v.union(
      v.literal("physical"),
      v.literal("virtual"),
      v.literal("email")
    )),
    // Slika računa
    imageStorageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
    // OCR podatki
    ocrText: v.optional(v.string()),
    ocrConfidence: v.optional(v.number()),
    receiptNumber: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    // Anti-duplicate system
    receiptFingerprint: v.string(),
    isDuplicate: v.optional(v.boolean()),
    duplicateOfReceiptId: v.optional(v.id("receipts")),
    // Anti-abuse
    suspiciousActivity: v.optional(v.boolean()),
    suspiciousReasons: v.optional(v.array(v.string())),
    // Sezona
    seasonYear: v.optional(v.number()),
    seasonEligible: v.boolean(),
    // Izdelki
    items: v.array(
      v.object({
        name: v.string(),
        quantity: v.optional(v.number()),
        unitPrice: v.optional(v.number()),
        lineTotal: v.optional(v.number()),
        matchedProductId: v.optional(v.id("products")),
        matchScore: v.optional(v.number()),
        referenceUnitPrice: v.optional(v.number()),
      })
    ),
    // Metadata
    deviceInfo: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_group_and_date", ["groupId", "purchaseDateKey"])
    .index("by_group_and_fingerprint", ["groupId", "receiptFingerprint"])
    .index("by_store", ["storeId"])
    .searchIndex("search_receipt_number", {
      searchField: "receiptNumber",
    }),

  // Letni prihranki po sezoni
  yearlySavings: defineTable({
    userId: v.string(),
    year: v.number(),
    savings: v.number(),
    updatedAt: v.number(),
  })
    .index("by_year", ["year", "savings"])
    .index("by_user_year", ["userId", "year"]),

  // Sezonsko stanje
  seasonState: defineTable({
    year: v.number(),
    startAt: v.number(),
    endAt: v.number(),
    lockedAt: v.optional(v.number()),
    awardsAssignedAt: v.optional(v.number()),
  }).index("by_year", ["year"]),

  // Sezonske nagrade
  seasonAwards: defineTable({
    userId: v.string(),
    year: v.number(),
    leaderboard: v.union(v.literal("standard"), v.literal("family")),
    rank: v.number(),
    award: v.string(),
    assignedAt: v.number(),
  })
    .index("by_user_year", ["userId", "year"])
    .index("by_year", ["year"]),

  // Active sessions tracking
  activeSessions: defineTable({
    userId: v.string(),
    sessionToken: v.string(),
    ipAddress: v.string(),
    deviceInfo: v.optional(v.string()),
    location: v.optional(
      v.object({
        country: v.optional(v.string()),
        city: v.optional(v.string()),
        coordinates: v.optional(
          v.object({
            lat: v.number(),
            lon: v.number(),
          })
        ),
      })
    ),
    createdAt: v.number(),
    lastActiveAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_session_token", ["sessionToken"])
    .index("by_expires_at", ["expiresAt"]),

  // Košarica
  cartItems: defineTable({
    userId: v.string(),
    productId: v.id("products"),
    storeId: v.id("stores"),
    quantity: v.number(),
    priceAtAdd: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_product", ["userId", "productId"]),

  // Zgodovina iskanj
  searchHistory: defineTable({
    userId: v.optional(v.string()),
    query: v.string(),
    timestamp: v.number(),
  }).index("by_user", ["userId"]),

  // Device Fingerprints - za preprečevanje zlorabe
  deviceFingerprints: defineTable({
    // Unique device fingerprint (kombinacija platform, OS version, device model, etc.)
    fingerprintHash: v.string(),
    // Device metadata
    platform: v.string(), // "ios", "android", "web"
    osVersion: v.optional(v.string()),
    deviceModel: v.optional(v.string()),
    deviceBrand: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    // Prva registracija iz te naprave
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    // Števec registracij iz te naprave
    registrationCount: v.number(),
    // Seznam user ID-jev, ki so se registrirali iz te naprave
    registeredUserIds: v.array(v.string()),
    // Ali je naprava blokirana
    isBlocked: v.boolean(),
    blockedReason: v.optional(v.string()),
    blockedAt: v.optional(v.number()),
  })
    .index("by_fingerprint", ["fingerprintHash"])
    .index("by_blocked", ["isBlocked"]),

  // Registered Devices - katera naprava je povezana s katerim uporabnikom
  registeredDevices: defineTable({
    userId: v.string(),
    fingerprintHash: v.string(),
    deviceName: v.string(), // "iPhone 16 Pro Max", "Samsung Galaxy S25"
    platform: v.string(),
    // Kdaj je bila naprava prvič registrirana
    registeredAt: v.number(),
    lastUsedAt: v.number(),
    // Ali je to primarna naprava (za Family plan limitacije)
    isPrimary: v.boolean(),
    // Locked status - če je zaklenjena, drugi userji ne morejo uporabljati te naprave
    isLocked: v.boolean(),
    lockedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_fingerprint", ["fingerprintHash"])
    .index("by_user_and_fingerprint", ["userId", "fingerprintHash"]),

  // Family Invitations - za Family Plan management
  familyInvitations: defineTable({
    // Kdo je poslal vabilo
    inviterId: v.string(),
    inviterNickname: v.string(),
    // Komu je poslano (email ali userId)
    inviteeEmail: v.optional(v.string()),
    inviteeUserId: v.optional(v.string()),
    // Status vabila
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired")
    ),
    // Invite token za sprejem
    inviteToken: v.string(),
    // Časovni žigi
    createdAt: v.number(),
    expiresAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_inviter", ["inviterId"])
    .index("by_invitee_email", ["inviteeEmail"])
    .index("by_invitee_user", ["inviteeUserId"])
    .index("by_token", ["inviteToken"])
    .index("by_status", ["status"]),
});

