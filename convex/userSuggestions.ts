import { v } from "convex/values";
import { authMutation, authQuery } from "./functions";

// ==================== USER QUERIES & MUTATIONS ====================

// Submit suggestion (any authenticated user)
export const submitSuggestion = authMutation({
  args: {
    suggestionType: v.union(
      v.literal("feature"),
      v.literal("improvement"),
      v.literal("bug"),
      v.literal("store"),
      v.literal("product"),
      v.literal("other")
    ),
    title: v.string(),
    description: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    suggestionId: v.optional(v.id("userSuggestions")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Validate input
    if (args.title.trim().length < 5) {
      return { success: false, error: "Naslov mora imeti vsaj 5 znakov" };
    }
    if (args.description.trim().length < 20) {
      return { success: false, error: "Opis mora imeti vsaj 20 znakov" };
    }

    // Get user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", ctx.user._id))
      .first();

    // Create suggestion
    const suggestionId = await ctx.db.insert("userSuggestions", {
      userId: ctx.user._id,
      userNickname: profile?.nickname || profile?.name || "Anonimen",
      suggestionType: args.suggestionType,
      title: args.title.trim(),
      description: args.description.trim(),
      status: "pending",
      rewardGiven: false,
      submittedAt: Date.now(),
    });

    return {
      success: true,
      suggestionId,
    };
  },
});

// Get user's own suggestions
export const getMySuggestions = authQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const suggestions = await ctx.db
      .query("userSuggestions")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .order("desc")
      .collect();

    return suggestions;
  },
});

// ==================== ADMIN QUERIES & MUTATIONS ====================

// Get all suggestions (admin only)
export const getAllSuggestions = authQuery({
  args: {
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("reviewing"),
      v.literal("approved"),
      v.literal("implemented"),
      v.literal("rejected"),
      v.literal("duplicate")
    )),
    type: v.optional(v.union(
      v.literal("feature"),
      v.literal("improvement"),
      v.literal("bug"),
      v.literal("store"),
      v.literal("product"),
      v.literal("other")
    )),
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

    const suggestions = args.status
      ? await ctx.db
          .query("userSuggestions")
          .withIndex("by_status", (q) => q.eq("status", args.status as typeof args.status & string))
          .order("desc")
          .take(args.limit || 100)
      : args.type
      ? await ctx.db
          .query("userSuggestions")
          .withIndex("by_type", (q) => q.eq("suggestionType", args.type as typeof args.type & string))
          .order("desc")
          .take(args.limit || 100)
      : await ctx.db
          .query("userSuggestions")
          .order("desc")
          .take(args.limit || 100);

    return suggestions;
  },
});

// Review suggestion (admin only)
export const reviewSuggestion = authMutation({
  args: {
    suggestionId: v.id("userSuggestions"),
    status: v.union(
      v.literal("reviewing"),
      v.literal("approved"),
      v.literal("implemented"),
      v.literal("rejected"),
      v.literal("duplicate")
    ),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    )),
    adminNotes: v.optional(v.string()),
    giveReward: v.boolean(), // Ali naj dobi 1 dan premium
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", ctx.user._id))
      .first();

    if (!profile?.isAdmin) {
      return { success: false, error: "Admin access required" };
    }

    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) {
      return { success: false, error: "Suggestion not found" };
    }

    // Update suggestion
    await ctx.db.patch(args.suggestionId, {
      status: args.status,
      priority: args.priority,
      adminNotes: args.adminNotes,
      reviewedAt: Date.now(),
      reviewedBy: ctx.user._id,
    });

    // Give reward if approved and not already given
    if (args.giveReward && !suggestion.rewardGiven) {
      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", suggestion.userId))
        .first();

      if (userProfile) {
        const now = Date.now();
        const oneDayInMs = 24 * 60 * 60 * 1000;

        // Extend premium by 1 day
        let newPremiumUntil: number;
        if (userProfile.premiumUntil && userProfile.premiumUntil > now) {
          // Extend existing premium
          newPremiumUntil = userProfile.premiumUntil + oneDayInMs;
        } else {
          // Grant new 1-day premium
          newPremiumUntil = now + oneDayInMs;
        }

        await ctx.db.patch(userProfile._id, {
          isPremium: true,
          premiumUntil: newPremiumUntil,
        });

        // Mark reward as given
        await ctx.db.patch(args.suggestionId, {
          rewardGiven: true,
          rewardGivenAt: now,
        });
      }
    }

    return { success: true };
  },
});

// Get suggestion stats (admin only)
export const getSuggestionStats = authQuery({
  args: {},
  returns: v.object({
    total: v.number(),
    pending: v.number(),
    reviewing: v.number(),
    approved: v.number(),
    implemented: v.number(),
    rejected: v.number(),
    duplicate: v.number(),
    rewardsGiven: v.number(),
  }),
  handler: async (ctx) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", ctx.user._id))
      .first();

    if (!profile?.isAdmin) {
      throw new Error("Admin access required");
    }

    const all = await ctx.db.query("userSuggestions").collect();

    return {
      total: all.length,
      pending: all.filter((s) => s.status === "pending").length,
      reviewing: all.filter((s) => s.status === "reviewing").length,
      approved: all.filter((s) => s.status === "approved").length,
      implemented: all.filter((s) => s.status === "implemented").length,
      rejected: all.filter((s) => s.status === "rejected").length,
      duplicate: all.filter((s) => s.status === "duplicate").length,
      rewardsGiven: all.filter((s) => s.rewardGiven).length,
    };
  },
});
