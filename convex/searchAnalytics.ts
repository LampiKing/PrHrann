import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * SEARCH ANALYTICS - Track vsako iskanje
 * To nam omogoča AI učenje in izboljšave
 */
export const trackSearch = mutation({
  args: {
    searchQuery: v.string(),
    resultsCount: v.number(),
    userId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    deviceType: v.optional(v.string()),
  },
  returns: v.id("searchAnalytics"),
  handler: async (ctx, args) => {
    const analyticsId = await ctx.db.insert("searchAnalytics", {
      userId: args.userId,
      searchQuery: args.searchQuery,
      searchQueryLower: args.searchQuery.toLowerCase(),
      resultsCount: args.resultsCount,
      timestamp: Date.now(),
      sessionId: args.sessionId,
      deviceType: args.deviceType,
    });

    return analyticsId;
  },
});

/**
 * Track ko uporabnik klikne na rezultat
 */
export const trackClick = mutation({
  args: {
    analyticsId: v.id("searchAnalytics"),
    productId: v.id("products"),
    productName: v.string(),
    position: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.analyticsId, {
      clickedProductId: args.productId,
      clickedProductName: args.productName,
      clickedAtPosition: args.position,
      foundWhatLookingFor: true, // Assume če je kliknil, je našel
    });

    return null;
  },
});

/**
 * Track ko uporabnik doda v košarico
 */
export const trackAddToCart = mutation({
  args: {
    analyticsId: v.id("searchAnalytics"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.analyticsId, {
      addedToCart: true,
    });

    return null;
  },
});

/**
 * AI INSIGHTS - Pridobi problematična iskanja
 * Pošlje email adminu s predlogi za izboljšave
 */
export const getProblematicSearches = query({
  args: {
    lastDays: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      query: v.string(),
      searchCount: v.number(),
      averageResults: v.number(),
      clickRate: v.number(), // % koliko ljudi je kliknilo
      cartRate: v.number(), // % koliko ljudi je dodalo v košarico
    })
  ),
  handler: async (ctx, args) => {
    const days = args.lastDays || 7;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    // Pridobi vse searches v zadnjih X dneh
    const searches = await ctx.db
      .query("searchAnalytics")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .collect();

    // Group by query
    const queryMap = new Map<
      string,
      {
        count: number;
        totalResults: number;
        clicks: number;
        addedToCart: number;
      }
    >();

    for (const search of searches) {
      const key = search.searchQueryLower;
      const existing = queryMap.get(key) || {
        count: 0,
        totalResults: 0,
        clicks: 0,
        addedToCart: 0,
      };

      existing.count++;
      existing.totalResults += search.resultsCount;
      if (search.clickedProductId) existing.clicks++;
      if (search.addedToCart) existing.addedToCart++;

      queryMap.set(key, existing);
    }

    // Konvertiraj v array in izračunaj metrike
    const results = Array.from(queryMap.entries())
      .map(([query, data]) => ({
        query,
        searchCount: data.count,
        averageResults: data.totalResults / data.count,
        clickRate: (data.clicks / data.count) * 100,
        cartRate: (data.addedToCart / data.count) * 100,
      }))
      // Sortiraj po search count (najpogostejša iskanja)
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 50); // Top 50

    return results;
  },
});

/**
 * AI SUGGESTIONS - Generira predloge za izboljšave
 */
export const generateAISuggestions = query({
  args: {},
  returns: v.array(
    v.object({
      type: v.string(), // "missing_product" | "poor_results" | "popular_search"
      priority: v.string(), // "high" | "medium" | "low"
      searchQuery: v.string(),
      suggestion: v.string(),
      metrics: v.object({
        searchCount: v.number(),
        averageResults: v.number(),
        clickRate: v.number(),
      }),
    })
  ),
  handler: async (ctx) => {
    // Pridobi problematične searches
    const problematic = await ctx.db
      .query("searchAnalytics")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", Date.now() - 7 * 24 * 60 * 60 * 1000)
      )
      .collect();

    // Group by query
    const queryMap = new Map<string, { count: number; results: number; clicks: number }>();

    for (const search of problematic) {
      const key = search.searchQueryLower;
      const existing = queryMap.get(key) || { count: 0, results: 0, clicks: 0 };
      existing.count++;
      existing.results += search.resultsCount;
      if (search.clickedProductId) existing.clicks++;
      queryMap.set(key, existing);
    }

    const suggestions = [];

    for (const [query, data] of queryMap.entries()) {
      const avgResults = data.results / data.count;
      const clickRate = (data.clicks / data.count) * 100;

      // SUGGESTION 1: Pogosto iskanje brez rezultatov
      if (data.count >= 5 && avgResults === 0) {
        suggestions.push({
          type: "missing_product",
          priority: "high",
          searchQuery: query,
          suggestion: `Uporabniki ${data.count}x iščejo "${query}", ampak ni rezultatov. Dodaj ta izdelek v bazo!`,
          metrics: {
            searchCount: data.count,
            averageResults: avgResults,
            clickRate,
          },
        });
      }

      // SUGGESTION 2: Pogosto iskanje z slabimi rezultati
      if (data.count >= 10 && avgResults < 3 && avgResults > 0) {
        suggestions.push({
          type: "poor_results",
          priority: "medium",
          searchQuery: query,
          suggestion: `Iskanje "${query}" ima samo ${avgResults.toFixed(1)} rezultatov. Izboljšaj fuzzy matching ali dodaj več izdelkov.`,
          metrics: {
            searchCount: data.count,
            averageResults: avgResults,
            clickRate,
          },
        });
      }

      // SUGGESTION 3: Popularno iskanje z nizko click rate
      if (data.count >= 20 && clickRate < 30) {
        suggestions.push({
          type: "poor_relevance",
          priority: "medium",
          searchQuery: query,
          suggestion: `"${query}" ima nizko click rate (${clickRate.toFixed(1)}%). Rezultati niso relevantni - preveri fuzzy matching.`,
          metrics: {
            searchCount: data.count,
            averageResults: avgResults,
            clickRate,
          },
        });
      }

      // SUGGESTION 4: Zelo popularno iskanje - highlight
      if (data.count >= 50 && clickRate >= 50) {
        suggestions.push({
          type: "popular_search",
          priority: "low",
          searchQuery: query,
          suggestion: `"${query}" je zelo popularno iskanje (${data.count}x) z visoko click rate (${clickRate.toFixed(1)}%). Vse deluje dobro! 🎉`,
          metrics: {
            searchCount: data.count,
            averageResults: avgResults,
            clickRate,
          },
        });
      }
    }

    // Sortiraj po prioriteti in search count
    return suggestions
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder];
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder];

        if (aPriority !== bPriority) return aPriority - bPriority;
        return b.metrics.searchCount - a.metrics.searchCount;
      })
      .slice(0, 20); // Top 20 suggestions
  },
});
