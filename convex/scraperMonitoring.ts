import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { authQuery } from "./functions";

// ==================== ADMIN QUERIES ====================

// Get latest scraper runs (admin only)
export const getScraperRuns = authQuery({
  args: {
    type: v.optional(v.union(v.literal("daily_prices"), v.literal("catalog_sales"))),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", ctx.user._id))
      .first();

    if (!profile?.isAdmin) {
      throw new Error("Admin access required");
    }

    const runs = args.type
      ? await ctx.db
          .query("scraperRuns")
          .withIndex("by_type", (q) => q.eq("type", args.type as "daily_prices" | "catalog_sales"))
          .order("desc")
          .take(args.limit || 20)
      : await ctx.db
          .query("scraperRuns")
          .withIndex("by_started_at")
          .order("desc")
          .take(args.limit || 20);

    return runs;
  },
});

// Get scraper statistics (admin only)
export const getScraperStats = authQuery({
  args: {},
  returns: v.object({
    dailyPrices: v.object({
      lastRun: v.optional(v.any()),
      totalRuns: v.number(),
      successRate: v.number(),
      avgDuration: v.number(),
      avgItemsUpdated: v.number(),
    }),
    catalogSales: v.object({
      lastRun: v.optional(v.any()),
      totalRuns: v.number(),
      successRate: v.number(),
      avgDuration: v.number(),
      avgItemsUpdated: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", ctx.user._id))
      .first();

    if (!profile?.isAdmin) {
      throw new Error("Admin access required");
    }

    // Daily prices stats
    const dailyRuns = await ctx.db
      .query("scraperRuns")
      .withIndex("by_type", (q) => q.eq("type", "daily_prices"))
      .collect();

    const catalogRuns = await ctx.db
      .query("scraperRuns")
      .withIndex("by_type", (q) => q.eq("type", "catalog_sales"))
      .collect();

    const calculateStats = (runs: any[]) => {
      if (runs.length === 0) {
        return {
          lastRun: undefined,
          totalRuns: 0,
          successRate: 0,
          avgDuration: 0,
          avgItemsUpdated: 0,
        };
      }

      const lastRun = runs[0];
      const successCount = runs.filter((r) => r.status === "success").length;
      const avgDuration = runs
        .filter((r) => r.duration)
        .reduce((sum, r) => sum + (r.duration || 0), 0) / runs.length;
      const avgItemsUpdated = runs
        .reduce((sum, r) => sum + r.totalItemsUpdated, 0) / runs.length;

      return {
        lastRun,
        totalRuns: runs.length,
        successRate: (successCount / runs.length) * 100,
        avgDuration: Math.round(avgDuration),
        avgItemsUpdated: Math.round(avgItemsUpdated),
      };
    };

    return {
      dailyPrices: calculateStats(dailyRuns),
      catalogSales: calculateStats(catalogRuns),
    };
  },
});

// ==================== INTERNAL MUTATIONS (called by scrapers) ====================

// Record scraper start
export const recordScraperStart = internalMutation({
  args: {
    type: v.union(v.literal("daily_prices"), v.literal("catalog_sales")),
  },
  returns: v.id("scraperRuns"),
  handler: async (ctx, args) => {
    const runId = await ctx.db.insert("scraperRuns", {
      type: args.type,
      status: "running",
      startedAt: Date.now(),
      storeResults: [],
      totalItemsProcessed: 0,
      totalItemsUpdated: 0,
    });

    return runId;
  },
});

// Record scraper completion
export const recordScraperCompletion = internalMutation({
  args: {
    runId: v.id("scraperRuns"),
    status: v.union(v.literal("success"), v.literal("failed"), v.literal("partial")),
    storeResults: v.array(v.object({
      storeName: v.string(),
      status: v.string(),
      itemsProcessed: v.number(),
      itemsUpdated: v.number(),
      errorMessage: v.optional(v.string()),
    })),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.object({
      catalogsScraped: v.optional(v.array(v.string())),
      newSalesFound: v.optional(v.number()),
      expiredSales: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return;

    const completedAt = Date.now();
    const duration = completedAt - run.startedAt;

    const totalItemsProcessed = args.storeResults.reduce(
      (sum, r) => sum + r.itemsProcessed,
      0
    );
    const totalItemsUpdated = args.storeResults.reduce(
      (sum, r) => sum + r.itemsUpdated,
      0
    );

    await ctx.db.patch(args.runId, {
      status: args.status,
      completedAt,
      duration,
      storeResults: args.storeResults,
      totalItemsProcessed,
      totalItemsUpdated,
      errorMessage: args.errorMessage,
      metadata: args.metadata,
    });
  },
});
