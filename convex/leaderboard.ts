import { v } from "convex/values";
import { authQuery, authMutation } from "./functions";
import { internalMutation } from "./_generated/server";
import { getSeasonWindow, getSeasonYear } from "./time";

type LeaderboardType = "standard" | "family";

const LEADERBOARD_LIMIT = 100;

type AwardCtx = {
  db: any;
};

function isFamilyProfile(profile: {
  premiumType?: "solo" | "family";
  familyOwnerId?: string;
}): boolean {
  return profile.premiumType === "family" || Boolean(profile.familyOwnerId);
}

const buildAwardTitles = (year: number, rank: number) => {
  const awards: string[] = [];
  if (rank === 1) awards.push(`Zlati varčevalec ${year}`);
  if (rank === 2) awards.push(`Srebrni varčevalec ${year}`);
  if (rank === 3) awards.push(`Bronasti varčevalec ${year}`);
  if (rank <= 3) {
    awards.push(`Top 10 varčevalec ${year}`);
    awards.push(`Top 100 varčevalec ${year}`);
    return awards;
  }
  if (rank <= 10) {
    awards.push(`Top 10 varčevalec ${year}`);
    return awards;
  }
  if (rank <= 100) {
    awards.push(`Top 100 varčevalec ${year}`);
  }
  return awards;
};

const assignSeasonAwards = async (ctx: AwardCtx, now: number) => {
  const year = getSeasonYear(now);
  const season = getSeasonWindow(year);

  let seasonState = await ctx.db
    .query("seasonState")
    .withIndex("by_year", (q: any) => q.eq("year", year))
    .first();

  if (!seasonState) {
    const id = await ctx.db.insert("seasonState", {
      year,
      startAt: season.startAt,
      endAt: season.endAt,
    });
    seasonState = await ctx.db.get(id);
  }

  if (!seasonState) {
    return { success: false, assigned: false };
  }

  if (seasonState.awardsAssignedAt) {
    return { success: true, assigned: false };
  }

  if (now <= season.endAt) {
    return { success: true, assigned: false };
  }

  const allSavings = await ctx.db
    .query("yearlySavings")
    .withIndex("by_year", (q: any) => q.eq("year", year))
    .collect();

  const profileMap = new Map<string, any>();
  for (const entry of allSavings) {
    if (!profileMap.has(entry.userId)) {
      const p = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q: any) => q.eq("userId", entry.userId))
        .first();
      if (p) profileMap.set(entry.userId, p);
    }
  }

  const assignAwardsForType = async (type: LeaderboardType) => {
    const filtered = allSavings
      .map((entry: any) => ({
        entry,
        profile: profileMap.get(entry.userId),
      }))
      .filter((item: any) => item.profile)
      .filter((item: any) =>
        type === "family"
          ? isFamilyProfile(item.profile)
          : !isFamilyProfile(item.profile)
      )
      .sort((a: any, b: any) => b.entry.savings - a.entry.savings)
      .slice(0, LEADERBOARD_LIMIT);

    const nowTs = Date.now();
    for (let i = 0; i < filtered.length; i++) {
      const rank = i + 1;
      const awardTitles = buildAwardTitles(year, rank);
      for (const award of awardTitles) {
        await ctx.db.insert("seasonAwards", {
          userId: filtered[i].entry.userId,
          year,
          leaderboard: type,
          rank,
          award,
          assignedAt: nowTs,
        });
      }
    }
  };

  await assignAwardsForType("standard");
  await assignAwardsForType("family");

  await ctx.db.patch(seasonState._id, {
    lockedAt: now,
    awardsAssignedAt: now,
  });

  return { success: true, assigned: true };
};

export const getMySeasonSummary = authQuery({
  args: {},
  returns: v.object({
    year: v.number(),
    savings: v.number(),
    rank: v.optional(v.number()),
    leaderboardType: v.union(v.literal("standard"), v.literal("family")),
    seasonStartAt: v.number(),
    seasonEndAt: v.number(),
  }),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      const year = getSeasonYear(Date.now());
      const season = getSeasonWindow(year);
      const fallbackLeaderboardType: LeaderboardType = "standard";
      return {
        year,
        savings: 0,
        rank: undefined,
        leaderboardType: fallbackLeaderboardType,
        seasonStartAt: season.startAt,
        seasonEndAt: season.endAt,
      };
    }

    const leaderboardType: LeaderboardType = isFamilyProfile(profile) ? "family" : "standard";
    const year = getSeasonYear(Date.now());
    const season = getSeasonWindow(year);

    const personal = await ctx.db
      .query("yearlySavings")
      .withIndex("by_user_year", (q) => q.eq("userId", userId).eq("year", year))
      .first();
    const savings = personal?.savings ?? 0;

    const allSavings = await ctx.db
      .query("yearlySavings")
      .withIndex("by_year", (q) => q.eq("year", year))
      .collect();

    const profileMap = new Map<string, typeof profile>();
    for (const entry of allSavings) {
      if (!profileMap.has(entry.userId)) {
        const p = await ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (q) => q.eq("userId", entry.userId))
          .first();
        if (p) profileMap.set(entry.userId, p);
      }
    }

    const filtered = allSavings
      .map((entry) => ({
        entry,
        profile: profileMap.get(entry.userId),
      }))
      .filter((item) => item.profile)
      .filter((item) =>
        leaderboardType === "family"
          ? isFamilyProfile(item.profile!)
          : !isFamilyProfile(item.profile!)
      )
      .sort((a, b) => b.entry.savings - a.entry.savings);

    const rank = filtered.findIndex((item) => item.entry.userId === userId);

    return {
      year,
      savings,
      rank: rank >= 0 ? rank + 1 : undefined,
      leaderboardType,
      seasonStartAt: season.startAt,
      seasonEndAt: season.endAt,
    };
  },
});

export const getLeaderboard = authQuery({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    year: v.number(),
    leaderboardType: v.union(v.literal("standard"), v.literal("family")),
    entries: v.array(
      v.object({
        userId: v.string(),
        nickname: v.string(),
        savings: v.number(),
        rank: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      const fallbackLeaderboardType: LeaderboardType = "standard";
      return {
        year: getSeasonYear(Date.now()),
        leaderboardType: fallbackLeaderboardType,
        entries: [],
      };
    }

    const leaderboardType: LeaderboardType = isFamilyProfile(profile) ? "family" : "standard";
    const year = getSeasonYear(Date.now());
    const limit = args.limit ?? LEADERBOARD_LIMIT;

    const allSavings = await ctx.db
      .query("yearlySavings")
      .withIndex("by_year", (q) => q.eq("year", year))
      .collect();

    const profileMap = new Map<string, typeof profile>();
    for (const entry of allSavings) {
      if (!profileMap.has(entry.userId)) {
        const p = await ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (q) => q.eq("userId", entry.userId))
          .first();
        if (p) profileMap.set(entry.userId, p);
      }
    }

    const filtered = allSavings
      .map((entry) => ({
        entry,
        profile: profileMap.get(entry.userId),
      }))
      .filter((item) => item.profile)
      .filter((item) =>
        leaderboardType === "family"
          ? isFamilyProfile(item.profile!)
          : !isFamilyProfile(item.profile!)
      )
      .sort((a, b) => b.entry.savings - a.entry.savings)
      .slice(0, limit)
      .map((item, index) => ({
        userId: item.entry.userId,
        nickname: item.profile!.nickname || item.profile!.name || "Uporabnik",
        savings: item.entry.savings,
        rank: index + 1,
      }));

    return {
      year,
      leaderboardType,
      entries: filtered,
    };
  },
});

export const assignSeasonAwardsIfNeeded = authMutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    assigned: v.boolean(),
  }),
  handler: async (ctx) => {
    return assignSeasonAwards({ db: ctx.db }, Date.now());
  },
});

export const assignSeasonAwardsCron = internalMutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    assigned: v.boolean(),
  }),
  handler: async (ctx) => {
    return assignSeasonAwards({ db: ctx.db }, Date.now());
  },
});
