import { v } from "convex/values";
import { authQuery, authMutation } from "./functions";

const MAX_FREE_SEARCHES = 3; // Maksimalno število brezplačnih iskanj na dan

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
      birthDate: v.optional(v.object({
        day: v.number(),
        month: v.number(),
        year: v.number(),
      })),
      isPremium: v.boolean(),
      premiumUntil: v.optional(v.number()),
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

    const maxSearches = profile.isPremium ? Infinity : MAX_FREE_SEARCHES;
    const searchesRemaining = profile.isPremium
      ? 999
      : Math.max(0, maxSearches - dailySearches);

    return {
      _id: profile._id,
      _creationTime: profile._creationTime,
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      birthDate: profile.birthDate,
      isPremium: profile.isPremium,
      premiumUntil: profile.premiumUntil,
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

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      await ctx.db.insert("userProfiles", {
        userId,
        isPremium: false,
        dailySearches: 1,
        lastSearchDate: today,
      });
      return { success: true, searchesRemaining: 2 };
    }

    // Ponastavi, če je nov dan
    if (profile.lastSearchDate !== today) {
      await ctx.db.patch(profile._id, {
        dailySearches: 1,
        lastSearchDate: today,
        searchResetTime: undefined,
      });
      return { success: true, searchesRemaining: profile.isPremium ? 999 : 2 };
    }

    // Preveri omejitev (3 iskanja za brezplačne uporabnike)
    if (!profile.isPremium && profile.dailySearches >= 3) {
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
          error: "Dnevna limita iskanj dosežena. Nadgradite na Premium!" 
        };
      }
      return { 
        success: false, 
        searchesRemaining: 0, 
        resetTime: profile.searchResetTime,
        error: "Dnevna limita iskanj dosežena. Nadgradite na Premium!"
      };
    }

    const newSearchCount = profile.dailySearches + 1;
    const remaining = profile.isPremium
      ? 999
      : Math.max(0, 3 - newSearchCount);

    // Če je to zadnje iskanje, nastavi reset time
    const updateData: { dailySearches: number; searchResetTime?: number } = {
      dailySearches: newSearchCount,
    };
    
    if (!profile.isPremium && newSearchCount >= 3) {
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
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = ctx.user._id;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) return false;

    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    await ctx.db.patch(profile._id, {
      isPremium: true,
      premiumUntil: Date.now() + oneMonth,
    });

    return true;
  },
});
