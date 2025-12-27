import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Check for suspicious activity based on IP changes
export const checkSuspiciousActivity = mutation({
  args: {
    ipAddress: v.string(),
    deviceInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { suspicious: false };

    // Get user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .first();

    if (!profile) return { suspicious: false };

    let suspicious = false;
    
    // Check if IP changed dramatically (different country)
    if (profile.lastIpAddress && profile.lastIpAddress !== args.ipAddress) {
      // In production, you'd use IP geolocation service here
      // For now, we just flag significant IP changes
      const oldIpParts = profile.lastIpAddress.split('.');
      const newIpParts = args.ipAddress.split('.');
      
      // Validate IP format before comparison
      if (oldIpParts.length >= 2 && newIpParts.length >= 2) {
        // If first two octets are different, likely different location
        if (oldIpParts[0] !== newIpParts[0] || oldIpParts[1] !== newIpParts[1]) {
          suspicious = true;
        }
      }
    }

    // Update profile with latest IP and device
    await ctx.db.patch(profile._id, {
      lastIpAddress: args.ipAddress,
      lastDeviceInfo: args.deviceInfo,
      suspiciousActivity: suspicious,
    });

    return { 
      suspicious,
      message: suspicious 
        ? "Zaznan je bil poskus dostopa iz neobičajne lokacije. Če to niste bili vi, takoj spremenite geslo!"
        : undefined
    };
  },
});

// Get active sessions for user
export const getActiveSessions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const now = Date.now();
    
    // Get all active sessions
    const sessions = await ctx.db
      .query("activeSessions")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .collect();

    return sessions.map(s => ({
      id: s._id,
      ipAddress: s.ipAddress,
      deviceInfo: s.deviceInfo,
      location: s.location,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
    }));
  },
});

// Terminate a specific session
export const terminateSession = mutation({
  args: {
    sessionId: v.id("activeSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    
    // Verify session belongs to user
    if (session.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.sessionId);
    return { success: true };
  },
});

// Terminate all other sessions except current
export const terminateAllOtherSessions = mutation({
  args: {
    currentSessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const sessions = await ctx.db
      .query("activeSessions")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .collect();

    let terminated = 0;
    for (const session of sessions) {
      if (session.sessionToken !== args.currentSessionToken) {
        await ctx.db.delete(session._id);
        terminated++;
      }
    }

    return { 
      success: true, 
      terminated,
      message: `Zaključenih ${terminated} drugih sej.`
    };
  },
});

// Clean up expired sessions (should be called periodically)
export const cleanupExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    const expiredSessions = await ctx.db
      .query("activeSessions")
      .withIndex("by_expires_at", (q) => q.lt("expiresAt", now))
      .collect();

    for (const session of expiredSessions) {
      await ctx.db.delete(session._id);
    }

    return { cleaned: expiredSessions.length };
  },
});

// Track session activity
export const trackSessionActivity = mutation({
  args: {
    sessionToken: v.string(),
    ipAddress: v.string(),
    deviceInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false };

    const existingSession = await ctx.db
      .query("activeSessions")
      .withIndex("by_session_token", (q) => q.eq("sessionToken", args.sessionToken))
      .first();

    const now = Date.now();
    const expiresAt = now + (7 * 24 * 60 * 60 * 1000); // 7 days

    if (existingSession) {
      // Update existing session
      await ctx.db.patch(existingSession._id, {
        lastActiveAt: now,
        expiresAt: expiresAt,
        ipAddress: args.ipAddress,
        deviceInfo: args.deviceInfo,
      });
    } else {
      // Create new session
      // Check if user has too many active sessions
      const activeSessions = await ctx.db
        .query("activeSessions")
        .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
        .filter((q) => q.gt(q.field("expiresAt"), now))
        .collect();

      // Maximum 2 sessions (as configured in auth.ts)
      if (activeSessions.length >= 2) {
        // Remove oldest session
        const oldestSession = activeSessions.sort((a, b) => a.lastActiveAt - b.lastActiveAt)[0];
        await ctx.db.delete(oldestSession._id);
      }

      await ctx.db.insert("activeSessions", {
        userId: identity.subject,
        sessionToken: args.sessionToken,
        ipAddress: args.ipAddress,
        deviceInfo: args.deviceInfo,
        createdAt: now,
        lastActiveAt: now,
        expiresAt: expiresAt,
      });
    }

    return { success: true };
  },
});
