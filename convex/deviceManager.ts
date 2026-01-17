import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authMutation, authQuery } from "./functions";

// Funkcija za izračun konca tekočega meseca
function getEndOfMonth(): number {
  const now = new Date();
  // Naslednji mesec, 1. dan, 00:00:00 - to je konec tekočega meseca
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return nextMonth.getTime();
}

/**
 * Pridobi informacije o registrirani napravi
 */
export const getRegisteredDevice = authQuery({
  args: {},
  returns: v.union(
    v.object({
      deviceName: v.string(),
      platform: v.string(),
      registeredAt: v.number(),
      canChangeDevice: v.boolean(),
      changeAvailableAt: v.optional(v.number()),
      daysUntilChange: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const now = Date.now();

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile || !profile.registeredDeviceName) {
      return null;
    }

    const canChangeDevice = !profile.deviceChangeBlockedUntil || profile.deviceChangeBlockedUntil <= now;
    const daysUntilChange = profile.deviceChangeBlockedUntil
      ? Math.ceil((profile.deviceChangeBlockedUntil - now) / (24 * 60 * 60 * 1000))
      : undefined;

    return {
      deviceName: profile.registeredDeviceName,
      platform: profile.registeredDevicePlatform || "unknown",
      registeredAt: profile.deviceRegisteredAt || profile._creationTime,
      canChangeDevice,
      changeAvailableAt: canChangeDevice ? undefined : profile.deviceChangeBlockedUntil,
      daysUntilChange: canChangeDevice ? undefined : Math.max(0, daysUntilChange || 0),
    };
  },
});

/**
 * Preveri dostop do naprave - ali je uporabnik na pravilni napravi
 * Vrne: { allowed: true } ali { allowed: false, reason: "...", currentDevice: "...", newDevice: "..." }
 */
export const checkDeviceAccess = authQuery({
  args: {
    deviceName: v.string(),
    deviceHash: v.string(),
    platform: v.string(),
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
    currentDeviceName: v.optional(v.string()),
    newDeviceName: v.optional(v.string()),
    canChangeAt: v.optional(v.number()),
    daysUntilChange: v.optional(v.number()),
    isNewDevice: v.boolean(),
    isPremium: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const now = Date.now();

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    // Brez profila - dovoli dostop (nova registracija)
    if (!profile) {
      return { allowed: true, isNewDevice: true, isPremium: false };
    }

    const isPremium = profile.isPremium ?? false;

    // Brez registrirane naprave - to je prva naprava
    if (!profile.registeredDeviceHash) {
      return { allowed: true, isNewDevice: true, isPremium };
    }

    // Ista naprava - vse OK
    if (profile.registeredDeviceHash === args.deviceHash) {
      return { allowed: true, isNewDevice: false, isPremium };
    }

    // NOVA NAPRAVA - preveri ali je blokada aktivna (do konca meseca)
    const isBlocked = profile.deviceChangeBlockedUntil && profile.deviceChangeBlockedUntil > now;

    if (isBlocked) {
      const daysUntilChange = Math.ceil((profile.deviceChangeBlockedUntil! - now) / (24 * 60 * 60 * 1000));
      const blockedDate = new Date(profile.deviceChangeBlockedUntil!);
      const formattedDate = blockedDate.toLocaleDateString("sl-SI", {
        day: "numeric",
        month: "long",
      });
      return {
        allowed: false,
        reason: `Prijava z druge naprave ni mogoča do ${formattedDate}. Napravo lahko zamenjaš enkrat na mesec.`,
        currentDeviceName: profile.registeredDeviceName,
        newDeviceName: args.deviceName,
        canChangeAt: profile.deviceChangeBlockedUntil,
        daysUntilChange: Math.max(0, daysUntilChange),
        isNewDevice: true,
        isPremium,
      };
    }

    // Blokada je potekla (nov mesec) - nova naprava je dovoljena
    return {
      allowed: true,
      isNewDevice: true,
      currentDeviceName: profile.registeredDeviceName,
      newDeviceName: args.deviceName,
      isPremium,
    };
  },
});

/**
 * Registriraj novo napravo za premium uporabnika
 * To se kliče ob prijavi ko uporabnik potrdi zamenjavo naprave
 */
export const registerDevice = authMutation({
  args: {
    deviceName: v.string(),
    deviceHash: v.string(),
    platform: v.string(),
    forceChange: v.optional(v.boolean()), // Ali uporabnik potrdi zamenjavo naprave
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    previousDevice: v.optional(v.string()),
    newDevice: v.string(),
    blockedUntil: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const now = Date.now();

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      return {
        success: false,
        message: "Profil ni najden",
        newDevice: args.deviceName,
      };
    }

    // Preveri ali je to prva naprava ali ista naprava
    const isFirstDevice = !profile.registeredDeviceHash;
    const isSameDevice = profile.registeredDeviceHash === args.deviceHash;

    if (isSameDevice) {
      // Posodobi samo lastDeviceInfo
      await ctx.db.patch(profile._id, {
        lastDeviceInfo: args.deviceName,
      });
      return {
        success: true,
        message: "Ista naprava, posodobljeno",
        newDevice: args.deviceName,
      };
    }

    // Preveri blokado (do konca meseca)
    const isBlocked = profile.deviceChangeBlockedUntil && profile.deviceChangeBlockedUntil > now;

    if (isBlocked && !args.forceChange) {
      const blockedDate = new Date(profile.deviceChangeBlockedUntil!);
      const formattedDate = blockedDate.toLocaleDateString("sl-SI", {
        day: "numeric",
        month: "long",
      });
      return {
        success: false,
        message: `Zamenjava naprave ni mogoča do ${formattedDate}`,
        previousDevice: profile.registeredDeviceName,
        newDevice: args.deviceName,
        blockedUntil: profile.deviceChangeBlockedUntil,
      };
    }

    // Registriraj novo napravo - blokada do konca meseca
    const blockedUntil = getEndOfMonth();
    const previousDevice = profile.registeredDeviceName;

    await ctx.db.patch(profile._id, {
      registeredDeviceName: args.deviceName,
      registeredDeviceHash: args.deviceHash,
      registeredDevicePlatform: args.platform,
      deviceRegisteredAt: now,
      deviceChangeBlockedUntil: blockedUntil,
      lastDeviceInfo: args.deviceName,
    });

    // Zapri vse prejšnje seje uporabnika (odjavi staro napravo)
    const sessions = await ctx.db
      .query("activeSessions")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    const changeDate = new Date(blockedUntil);
    const formattedDate = changeDate.toLocaleDateString("sl-SI", {
      day: "numeric",
      month: "long",
    });

    if (isFirstDevice) {
      return {
        success: true,
        message: `Naprava "${args.deviceName}" registrirana. Naslednja zamenjava možna od ${formattedDate}.`,
        newDevice: args.deviceName,
        blockedUntil,
      };
    }

    return {
      success: true,
      message: `Naprava spremenjena na "${args.deviceName}". Naslednja zamenjava možna od ${formattedDate}.`,
      previousDevice,
      newDevice: args.deviceName,
      blockedUntil,
    };
  },
});

/**
 * Admin: Ponastavi napravo za uporabnika (če izgubi telefon ipd.)
 */
export const adminResetDevice = mutation({
  args: {
    targetUserId: v.string(),
    adminUserId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Preveri ali je admin
    const adminProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.adminUserId))
      .first();

    if (!adminProfile?.isAdmin) {
      return { success: false, message: "Ni admin pravic" };
    }

    const targetProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.targetUserId))
      .first();

    if (!targetProfile) {
      return { success: false, message: "Uporabnik ni najden" };
    }

    const oldDevice = targetProfile.registeredDeviceName || "brez naprave";

    await ctx.db.patch(targetProfile._id, {
      registeredDeviceName: undefined,
      registeredDeviceHash: undefined,
      registeredDevicePlatform: undefined,
      deviceRegisteredAt: undefined,
      deviceChangeBlockedUntil: undefined,
    });

    return {
      success: true,
      message: `Naprava "${oldDevice}" ponastavljena za uporabnika. Lahko se prijavi z novo napravo.`,
    };
  },
});
