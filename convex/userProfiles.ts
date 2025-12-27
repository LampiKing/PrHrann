import { v } from "convex/values";
import { authQuery, authMutation } from "./functions";

const MAX_FREE_SEARCHES = 3; // Maksimalno število brezplačnih iskanj na dan
const MAX_GUEST_SEARCHES = 1; // Gost ima 1 iskanje na dan

// Pridobi profil uporabnika
export const getProfile = authQuery({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("userProfiles"),
      _creationTime: v.number(),
      userId: v.string(),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerified: v.optional(v.boolean()),
      isAnonymous: v.optional(v.boolean()),
      birthDate: v.optional(v.object({
        day: v.number(),
        month: v.number(),
        year: v.number(),
      })),
      isPremium: v.boolean(),
      premiumUntil: v.optional(v.number()),
      premiumType: v.optional(v.union(v.literal("solo"), v.literal("family"))),
      familyOwnerId: v.optional(v.string()),
      familyMembers: v.optional(v.array(v.string())),
      dailySearches: v.number(),
      lastSearchDate: v.string(),
      searchResetTime: v.optional(v.number()),
      canSearch: v.boolean(),
      searchesRemaining: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const today = new Date().toISOString().split("T")[0];

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      return null;
    }

    // Ponastavi dnevna iskanja, če je nov dan
    let dailySearches = profile.dailySearches;
    let searchResetTime = profile.searchResetTime;
    
    if (profile.lastSearchDate !== today) {
      dailySearches = 0;
      searchResetTime = undefined;
    }

    // Preveri ali je gost (anonymous user)
    const isGuest = profile.isAnonymous || !profile.email;
    const maxSearches = profile.isPremium
      ? Infinity
      : (isGuest ? MAX_GUEST_SEARCHES : MAX_FREE_SEARCHES);
    const searchesRemaining = profile.isPremium
      ? 999
      : Math.max(0, maxSearches - dailySearches);

    return {
      _id: profile._id,
      _creationTime: profile._creationTime,
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      emailVerified: profile.emailVerified ?? false,
      isAnonymous: profile.isAnonymous ?? false,
      birthDate: profile.birthDate,
      isPremium: profile.isPremium,
      premiumUntil: profile.premiumUntil,
      premiumType: profile.premiumType,
      familyOwnerId: profile.familyOwnerId,
      familyMembers: profile.familyMembers,
      dailySearches,
      lastSearchDate: profile.lastSearchDate !== today ? today : profile.lastSearchDate,
      searchResetTime,
      canSearch: profile.isPremium || dailySearches < maxSearches,
      searchesRemaining,
    };
  },
});

// Ustvari ali posodobi profil
export const ensureProfile = authMutation({
  args: {},
  returns: v.id("userProfiles"),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const today = new Date().toISOString().split("T")[0];

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", {
      userId,
      name: ctx.user.name || undefined,
      email: ctx.user.email || undefined,
      emailVerified: ctx.user.emailVerified ?? false,
      isAnonymous: ctx.user.isAnonymous ?? false,
      isPremium: false,
      dailySearches: 0,
      lastSearchDate: today,
    });
  },
});

// Posodobi datum rojstva
export const updateBirthDate = authMutation({
  args: {
    day: v.number(),
    month: v.number(),
    year: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) return false;

    await ctx.db.patch(profile._id, {
      birthDate: {
        day: args.day,
        month: args.month,
        year: args.year,
      },
    });

    return true;
  },
});

// Zabeleži iskanje
export const recordSearch = authMutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    searchesRemaining: v.number(),
    resetTime: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const today = new Date().toISOString().split("T")[0];
    const now = Date.now();
    const isAnonymous = ctx.user.isAnonymous ?? false;
    const isGuestUser = isAnonymous || !ctx.user.email;
    const guestMaxSearches = isGuestUser ? MAX_GUEST_SEARCHES : MAX_FREE_SEARCHES;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      const resetTime = guestMaxSearches <= 1 ? now + 24 * 60 * 60 * 1000 : undefined;
      await ctx.db.insert("userProfiles", {
        userId,
        name: ctx.user.name || undefined,
        email: ctx.user.email || undefined,
        emailVerified: ctx.user.emailVerified ?? false,
        isAnonymous: isAnonymous,
        isPremium: false,
        dailySearches: 1,
        lastSearchDate: today,
        searchResetTime: resetTime,
      });
      return { 
        success: true, 
        searchesRemaining: Math.max(0, guestMaxSearches - 1),
        resetTime,
      };
    }

    const isGuest = profile.isAnonymous || !profile.email;
    const maxSearches = profile.isPremium
      ? Infinity
      : (isGuest ? MAX_GUEST_SEARCHES : MAX_FREE_SEARCHES);

    // Ponastavi, če je nov dan
    if (profile.lastSearchDate !== today) {
      const resetTime = (!profile.isPremium && 1 >= maxSearches)
        ? now + 24 * 60 * 60 * 1000
        : undefined;
      await ctx.db.patch(profile._id, {
        dailySearches: 1,
        lastSearchDate: today,
        searchResetTime: resetTime,
      });
      return { 
        success: true, 
        searchesRemaining: profile.isPremium ? 999 : Math.max(0, maxSearches - 1),
        resetTime,
      };
    }

    // Preveri omejitev (MAX_FREE_SEARCHES iskanja za brezplačne uporabnike)
    if (!profile.isPremium && profile.dailySearches >= maxSearches) {
      const guestError =
        "Dnevna limita gostujočih iskanj dosežena. Prijavi se za 3 iskanja na dan in dostop do Košarice ter Profila.";
      const premiumError =
        "Dnevna limita iskanj dosežena. Nadgradite na Premium (1,99ƒ'ª/mesec)!";
      // Nastavi reset time če še ni nastavljen
      if (!profile.searchResetTime) {
        const resetTime = now + 24 * 60 * 60 * 1000; // 24 ur od zdaj
        await ctx.db.patch(profile._id, {
          searchResetTime: resetTime,
        });
        return { 
          success: false, 
          searchesRemaining: 0, 
          resetTime,
          error: isGuest ? guestError : premiumError,
        };
      }
      return { 
        success: false, 
        searchesRemaining: 0, 
        resetTime: profile.searchResetTime,
        error: isGuest ? guestError : "Dnevna limita iskanj dosežena. Nadgradite na Premium!",
      };
    }

    const newSearchCount = profile.dailySearches + 1;
    const remaining = profile.isPremium
      ? 999
      : Math.max(0, maxSearches - newSearchCount);

    // Če je to zadnje iskanje, nastavi reset time
    const updateData: { dailySearches: number; searchResetTime?: number } = {
      dailySearches: newSearchCount,
    };
    
    if (!profile.isPremium && newSearchCount >= maxSearches) {
      updateData.searchResetTime = now + 24 * 60 * 60 * 1000;
    }

    await ctx.db.patch(profile._id, updateData);

    return { 
      success: true, 
      searchesRemaining: remaining,
      resetTime: updateData.searchResetTime,
    };
  },
});

// Nadgradi na premium (simulacija)
export const upgradeToPremium = authMutation({
  args: {
    planType: v.optional(v.union(v.literal("solo"), v.literal("family"))),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const planType = args.planType || "solo";

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) return false;

    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    await ctx.db.patch(profile._id, {
      isPremium: true,
      premiumUntil: Date.now() + oneMonth,
      premiumType: planType,
    });

    return true;
  },
});
