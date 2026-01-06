import { v } from "convex/values";
import { authQuery, authMutation } from "./functions";
import { mutation } from "./_generated/server";

const DEFAULT_ADMIN_EMAILS = ["lamprett69@gmail.com", "prrhran@gmail.com"];
const rawAdminEmails =
  process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAILS.join(",");
const ADMIN_EMAILS = rawAdminEmails
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

export const getStats = authQuery({
  args: {},
  returns: v.object({
    totalUsers: v.number(),
    activeUsers: v.number(),
    totalGuests: v.number(),
    topCountries: v.array(
      v.object({
        country: v.string(),
        count: v.number(),
      })
    ),
  }),
  handler: async (ctx) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", ctx.user._id))
      .first();

    const userEmail = ctx.user.email?.toLowerCase();
    const isAdmin =
      profile?.isAdmin || (userEmail && ADMIN_EMAILS.includes(userEmail));

    if (!isAdmin) {
      throw new Error("Not authorized");
    }

    const profiles = await ctx.db.query("userProfiles").collect();
    const totalGuests = profiles.filter((p) => p.isAnonymous || !p.email).length;
    const totalUsers = profiles.length - totalGuests;

    const sessions = await ctx.db.query("activeSessions").collect();
    const activeUserIds = new Set(sessions.map((session) => session.userId));
    const activeUsers = profiles.filter(
      (p) => !p.isAnonymous && p.email && activeUserIds.has(p.userId)
    ).length;

    // Get location statistics from active sessions
    const countryCounts = new Map<string, number>();
    for (const session of sessions) {
      const country = session.location?.country || "Unknown";
      countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
    }

    const topCountries = Array.from(countryCounts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 countries

    return { totalUsers, activeUsers, totalGuests, topCountries };
  },
});

// Get detailed user list (for admin modal)
export const getAllUsers = authQuery({
  args: {
    type: v.union(v.literal("registered"), v.literal("active"), v.literal("guests")),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      userId: v.string(),
      name: v.optional(v.string()),
      nickname: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerified: v.optional(v.boolean()),
      isPremium: v.boolean(),
      premiumType: v.optional(v.union(v.literal("solo"), v.literal("family"))),
      isAnonymous: v.optional(v.boolean()),
      dailySearches: v.number(),
      totalSavings: v.optional(v.number()),
      _creationTime: v.number(),
      lastActivity: v.optional(v.number()),
      location: v.optional(v.object({
        country: v.string(),
        city: v.optional(v.string()),
      })),
    })
  ),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", ctx.user._id))
      .first();

    const userEmail = ctx.user.email?.toLowerCase();
    const isAdmin =
      profile?.isAdmin || (userEmail && ADMIN_EMAILS.includes(userEmail));

    if (!isAdmin) {
      throw new Error("Not authorized");
    }

    const profiles = await ctx.db.query("userProfiles").collect();
    const sessions = await ctx.db.query("activeSessions").collect();

    // Create map of userId -> last session
    const sessionMap = new Map<string, typeof sessions[0]>();
    for (const session of sessions) {
      const existing = sessionMap.get(session.userId);
      if (!existing || session.lastActiveAt > existing.lastActiveAt) {
        sessionMap.set(session.userId, session);
      }
    }

    let filteredProfiles = profiles;

    // Filter by type
    if (args.type === "registered") {
      filteredProfiles = profiles.filter((p) => !p.isAnonymous && p.email);
    } else if (args.type === "active") {
      const activeUserIds = new Set(sessions.map((s) => s.userId));
      filteredProfiles = profiles.filter(
        (p) => !p.isAnonymous && p.email && activeUserIds.has(p.userId)
      );
    } else if (args.type === "guests") {
      filteredProfiles = profiles.filter((p) => p.isAnonymous || !p.email);
    }

    // Sort by creation time (newest first)
    filteredProfiles.sort((a, b) => b._creationTime - a._creationTime);

    // Apply limit
    if (args.limit) {
      filteredProfiles = filteredProfiles.slice(0, args.limit);
    }

    // Map to return format
    return filteredProfiles.map((p) => {
      const session = sessionMap.get(p.userId);
      return {
        userId: p.userId,
        name: p.name,
        nickname: p.nickname,
        email: p.email,
        emailVerified: p.emailVerified,
        isPremium: p.isPremium,
        premiumType: p.premiumType,
        isAnonymous: p.isAnonymous,
        dailySearches: p.dailySearches,
        totalSavings: p.totalSavings,
        _creationTime: p._creationTime,
        lastActivity: session?.lastActiveAt,
        location: session?.location?.country ? {
          country: session.location.country,
          city: session.location.city,
        } : undefined,
      };
    });
  },
});

// Get additional admin statistics
export const getDetailedStats = authQuery({
  args: {},
  returns: v.object({
    premiumUsers: v.number(),
    freeUsers: v.number(),
    totalSearchesToday: v.number(),
    totalSavings: v.number(),
    avgSavingsPerUser: v.number(),
    recentSignups: v.number(), // Last 7 days
    verifiedEmails: v.number(),
    unverifiedEmails: v.number(),
  }),
  handler: async (ctx) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", ctx.user._id))
      .first();

    const userEmail = ctx.user.email?.toLowerCase();
    const isAdmin =
      profile?.isAdmin || (userEmail && ADMIN_EMAILS.includes(userEmail));

    if (!isAdmin) {
      throw new Error("Not authorized");
    }

    const profiles = await ctx.db.query("userProfiles").collect();
    const registeredUsers = profiles.filter((p) => !p.isAnonymous && p.email);

    const premiumUsers = registeredUsers.filter((p) => p.isPremium).length;
    const freeUsers = registeredUsers.length - premiumUsers;

    const totalSearchesToday = registeredUsers.reduce(
      (sum, p) => sum + p.dailySearches,
      0
    );

    const totalSavings = registeredUsers.reduce(
      (sum, p) => sum + (p.totalSavings || 0),
      0
    );

    const avgSavingsPerUser =
      registeredUsers.length > 0 ? totalSavings / registeredUsers.length : 0;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentSignups = registeredUsers.filter(
      (p) => p._creationTime > sevenDaysAgo
    ).length;

    const verifiedEmails = registeredUsers.filter((p) => p.emailVerified).length;
    const unverifiedEmails = registeredUsers.length - verifiedEmails;

    return {
      premiumUsers,
      freeUsers,
      totalSearchesToday,
      totalSavings,
      avgSavingsPerUser,
      recentSignups,
      verifiedEmails,
      unverifiedEmails,
    };
  },
});

// DANGEROUS: Reset all user data - only for testing
export const resetAllUserData = mutation({
  args: {
    confirmReset: v.string(),
  },
  handler: async (ctx, args) => {
    // Safety check
    if (args.confirmReset !== "RESET_ALL_DATA_CONFIRM") {
      throw new Error("Invalid confirmation code");
    }

    // Delete all user profiles
    const profiles = await ctx.db.query("userProfiles").collect();
    for (const profile of profiles) {
      await ctx.db.delete(profile._id);
    }

    // Delete all family invitations
    const invitations = await ctx.db.query("familyInvitations").collect();
    for (const inv of invitations) {
      await ctx.db.delete(inv._id);
    }

    // Delete all active sessions
    const sessions = await ctx.db.query("activeSessions").collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    // Delete all shopping lists
    const lists = await ctx.db.query("shoppingLists").collect();
    for (const list of lists) {
      await ctx.db.delete(list._id);
    }

    // Delete all receipts
    const receipts = await ctx.db.query("receipts").collect();
    for (const receipt of receipts) {
      await ctx.db.delete(receipt._id);
    }

    // Delete all cart items
    const cartItems = await ctx.db.query("cartItems").collect();
    for (const item of cartItems) {
      await ctx.db.delete(item._id);
    }

    // Delete all price alerts
    const alerts = await ctx.db.query("priceAlerts").collect();
    for (const alert of alerts) {
      await ctx.db.delete(alert._id);
    }

    // Delete search analytics
    const analytics = await ctx.db.query("searchAnalytics").collect();
    for (const a of analytics) {
      await ctx.db.delete(a._id);
    }

    // Delete user suggestions
    const suggestions = await ctx.db.query("userSuggestions").collect();
    for (const s of suggestions) {
      await ctx.db.delete(s._id);
    }

    console.log("ALL USER DATA RESET:", {
      profiles: profiles.length,
      invitations: invitations.length,
      sessions: sessions.length,
      lists: lists.length,
      receipts: receipts.length,
      cartItems: cartItems.length,
      alerts: alerts.length,
      analytics: analytics.length,
      suggestions: suggestions.length,
    });

    return {
      success: true,
      deleted: {
        profiles: profiles.length,
        invitations: invitations.length,
        sessions: sessions.length,
        lists: lists.length,
        receipts: receipts.length,
        cartItems: cartItems.length,
        alerts: alerts.length,
        analytics: analytics.length,
        suggestions: suggestions.length,
      },
    };
  },
});
