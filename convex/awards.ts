import { v } from "convex/values";
import { authQuery } from "./functions";

export const getMyAwards = authQuery({
  args: {},
  returns: v.array(
    v.object({
      year: v.number(),
      award: v.string(),
      rank: v.number(),
      leaderboard: v.union(v.literal("standard"), v.literal("family")),
    })
  ),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const awards = await ctx.db
      .query("seasonAwards")
      .withIndex("by_user_year", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return awards.map((award) => ({
      year: award.year,
      award: award.award,
      rank: award.rank,
      leaderboard: award.leaderboard,
    }));
  },
});
