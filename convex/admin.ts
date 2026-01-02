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
