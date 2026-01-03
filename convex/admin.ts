import { v } from "convex/values";
import { authQuery } from "./functions";

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
      if (!existing || session.lastActivity > existing.lastActivity) {
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
        lastActivity: session?.lastActivity,
        location: session?.location,
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
