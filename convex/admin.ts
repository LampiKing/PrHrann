import { v } from "convex/values";
import { authQuery } from "./functions";

export const getStats = authQuery({
  args: {},
  returns: v.object({
    totalUsers: v.number(),
    activeUsers: v.number(),
    totalGuests: v.number(),
  }),
  handler: async (ctx) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", ctx.user._id))
      .first();

    if (!profile || !profile.isAdmin) {
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

    return { totalUsers, activeUsers, totalGuests };
  },
});
