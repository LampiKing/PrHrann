// Reset script - run with: npx convex run scripts/resetData.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

// This is a direct mutation, not using auth
export default mutation({
  args: {},
  handler: async (ctx) => {
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
