import { v } from "convex/values";
import { authQuery, authMutation } from "./functions";
import { query } from "./_generated/server";
import { getDateKey, getNextMidnightTimestamp } from "./time";

const MAX_FREE_SEARCHES = 3; // Max free searches per day
const MAX_GUEST_SEARCHES = 1; // Guest has 1 search per day
const NICKNAME_MIN_LENGTH = 3;
const NICKNAME_MAX_LENGTH = 20;
const NICKNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "lamprett69@gmail.com").toLowerCase();
const isAdminEmail = (email?: string | null) =>
  Boolean(email && email.toLowerCase() === ADMIN_EMAIL);

// Get user profile
export const getProfile = authQuery({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("userProfiles"),
      _creationTime: v.number(),
      userId: v.string(),
      name: v.optional(v.string()),
      nickname: v.optional(v.string()),
      nicknameUpdatedAt: v.optional(v.number()),
      nicknameChangeAvailableAt: v.optional(v.number()),
      email: v.optional(v.string()),
      emailVerified: v.optional(v.boolean()),
      isAnonymous: v.optional(v.boolean()),
      isAdmin: v.optional(v.boolean()),
      birthDate: v.optional(
        v.object({
          day: v.number(),
          month: v.number(),
          year: v.number(),
        })
      ),
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
      totalSavings: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const today = getDateKey(Date.now());

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      return null;
    }

    let dailySearches = profile.dailySearches;
    let searchResetTime = profile.searchResetTime;

    if (profile.lastSearchDate !== today) {
      dailySearches = 0;
      searchResetTime = undefined;
    }

    const isGuest = profile.isAnonymous || !profile.email;
    const maxSearches = profile.isPremium
      ? Infinity
      : isGuest
      ? MAX_GUEST_SEARCHES
      : MAX_FREE_SEARCHES;
    const searchesRemaining = profile.isPremium
      ? 999
      : Math.max(0, maxSearches - dailySearches);
    const computedAdmin = (profile.isAdmin ?? false) || isAdminEmail(profile.email);

    return {
      _id: profile._id,
      _creationTime: profile._creationTime,
      userId: profile.userId,
      name: profile.name,
      nickname: profile.nickname ?? profile.name,
      nicknameUpdatedAt: profile.nicknameUpdatedAt,
      nicknameChangeAvailableAt: profile.nicknameChangeAvailableAt,
      email: profile.email,
      emailVerified: profile.emailVerified ?? false,
      isAnonymous: profile.isAnonymous ?? false,
      isAdmin: computedAdmin,
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
      totalSavings: profile.totalSavings,
    };
  },
});

// Check nickname availability (public)
export const isNicknameAvailable = query({
  args: {
    nickname: v.string(),
  },
  returns: v.object({
    available: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const normalized = args.nickname.trim().toLowerCase();
    if (!normalized) {
      return { available: false };
    }
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_nickname", (q) => q.eq("nicknameLower", normalized))
      .first();
    return { available: !existing };
  },
});

// Create or update profile
export const ensureProfile = authMutation({
  args: {},
  returns: v.id("userProfiles"),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const today = getDateKey(Date.now());
    const nickname = ctx.user.name ? ctx.user.name.trim() : undefined;
    const nicknameLower = nickname ? nickname.toLowerCase() : undefined;

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("userProfiles", {
      userId,
      name: ctx.user.name || undefined,
      nickname,
      nicknameLower,
      nicknameUpdatedAt: nickname ? now : undefined,
      nicknameChangeAvailableAt: nickname ? now + NICKNAME_COOLDOWN_MS : undefined,
      email: ctx.user.email || undefined,
      emailVerified: ctx.user.emailVerified ?? false,
      isAnonymous: ctx.user.isAnonymous ?? false,
      isAdmin: isAdminEmail(ctx.user.email),
      isPremium: false,
      dailySearches: 0,
      lastSearchDate: today,
    });
  },
});

// Update birth date (legacy)
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

// Record search usage
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
    const today = getDateKey(Date.now());
    const now = Date.now();
    const isAnonymous = ctx.user.isAnonymous ?? false;
    const isGuestUser = isAnonymous || !ctx.user.email;
    const guestMaxSearches = isGuestUser ? MAX_GUEST_SEARCHES : MAX_FREE_SEARCHES;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      const resetTime = guestMaxSearches <= 1 ? getNextMidnightTimestamp(now) : undefined;
      await ctx.db.insert("userProfiles", {
        userId,
        name: ctx.user.name || undefined,
        nickname: ctx.user.name || undefined,
        nicknameLower: ctx.user.name ? ctx.user.name.toLowerCase() : undefined,
        nicknameUpdatedAt: ctx.user.name ? now : undefined,
        nicknameChangeAvailableAt: ctx.user.name ? now + NICKNAME_COOLDOWN_MS : undefined,
        email: ctx.user.email || undefined,
        emailVerified: ctx.user.emailVerified ?? false,
        isAnonymous: isAnonymous,
        isAdmin: isAdminEmail(ctx.user.email),
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
      : isGuest
      ? MAX_GUEST_SEARCHES
      : MAX_FREE_SEARCHES;

    if (profile.lastSearchDate !== today) {
      const resetTime = !profile.isPremium && 1 >= maxSearches ? getNextMidnightTimestamp(now) : undefined;
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

    if (!profile.isPremium && profile.dailySearches >= maxSearches) {
      const guestError =
        "Daily guest limit reached. Register to unlock 3 searches per day and access Cart + Profile.";
      const premiumError =
        "Daily search limit reached. Upgrade to PrHran Plus for unlimited search.";
      if (!profile.searchResetTime) {
        const resetTime = getNextMidnightTimestamp(now);
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
        error: isGuest ? guestError : premiumError,
      };
    }

    const newSearchCount = profile.dailySearches + 1;
    const remaining = profile.isPremium ? 999 : Math.max(0, maxSearches - newSearchCount);

    const updateData: { dailySearches: number; searchResetTime?: number } = {
      dailySearches: newSearchCount,
    };

    if (!profile.isPremium && newSearchCount >= maxSearches) {
      updateData.searchResetTime = getNextMidnightTimestamp(now);
    }

    await ctx.db.patch(profile._id, updateData);

    return {
      success: true,
      searchesRemaining: remaining,
      resetTime: updateData.searchResetTime,
    };
  },
});

// Update nickname (1x per 30 days)
export const updateNickname = authMutation({
  args: {
    nickname: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    availableAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const trimmed = args.nickname.trim();
    const normalized = trimmed.toLowerCase();
    const now = Date.now();

    if (trimmed.length < NICKNAME_MIN_LENGTH || trimmed.length > NICKNAME_MAX_LENGTH) {
      return { success: false, error: "Nickname must be 3-20 characters." };
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      return { success: false, error: "Profile not found." };
    }

    const isGuest = profile.isAnonymous || !profile.email;
    if (isGuest) {
      return { success: false, error: "Register before setting a nickname." };
    }

    if (profile.nicknameChangeAvailableAt && now < profile.nicknameChangeAvailableAt) {
      return {
        success: false,
        error: "Nickname can be changed once every 30 days.",
        availableAt: profile.nicknameChangeAvailableAt,
      };
    }

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_nickname", (q) => q.eq("nicknameLower", normalized))
      .first();

    if (existing && existing.userId !== userId) {
      return { success: false, error: "Nickname is already taken." };
    }

    await ctx.db.patch(profile._id, {
      nickname: trimmed,
      nicknameLower: normalized,
      nicknameUpdatedAt: now,
      nicknameChangeAvailableAt: now + NICKNAME_COOLDOWN_MS,
    });

    return { success: true };
  },
});

// Upgrade to premium (simulation)
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
