import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authMutation, authQuery } from "./functions";

// ANTI-ABUSE KONSTANTE
const MAX_REGISTRATIONS_PER_DEVICE = 3; // Max 3 registracije iz iste naprave
const MAX_DEVICES_PER_USER = 5; // Max 5 naprav na uporabnika
const MAX_DEVICES_PER_FAMILY_MEMBER = 2; // Max 2 napravi za family member (ne owner)

/**
 * Генериша device fingerprint hash iz device info
 */
function generateFingerprintHash(deviceInfo: {
  platform: string;
  osVersion?: string;
  deviceModel?: string;
  deviceBrand?: string;
  appVersion?: string;
}): string {
  const parts = [
    deviceInfo.platform,
    deviceInfo.osVersion || '',
    deviceInfo.deviceModel || '',
    deviceInfo.deviceBrand || '',
    deviceInfo.appVersion || '',
  ];
  return parts.join('|');
}

/**
 * Preveri ali lahko naprava registrira nov račun
 */
export const checkDeviceEligibility = mutation({
  args: {
    platform: v.string(),
    osVersion: v.optional(v.string()),
    deviceModel: v.optional(v.string()),
    deviceBrand: v.optional(v.string()),
    appVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const fingerprintHash = generateFingerprintHash(args);

    // Preveri če naprava že obstaja
    const existingDevice = await ctx.db
      .query("deviceFingerprints")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprintHash", fingerprintHash))
      .first();

    if (!existingDevice) {
      // Nova naprava - dovoli registracijo
      return {
        eligible: true,
        message: "Nova naprava - registracija dovoljena",
      };
    }

    // Preveri če je naprava blokirana
    if (existingDevice.isBlocked) {
      return {
        eligible: false,
        message: existingDevice.blockedReason || "Ta naprava je blokirana zaradi sumljive aktivnosti.",
        blocked: true,
      };
    }

    // Preveri število registracij
    if (existingDevice.registrationCount >= MAX_REGISTRATIONS_PER_DEVICE) {
      return {
        eligible: false,
        message: `Ta naprava je že dosegla maksimalno število registracij (${MAX_REGISTRATIONS_PER_DEVICE}). Za pomoč kontaktirajte podporo.`,
        tooManyRegistrations: true,
      };
    }

    return {
      eligible: true,
      message: `Registracija dovoljena (${existingDevice.registrationCount}/${MAX_REGISTRATIONS_PER_DEVICE})`,
      registrationCount: existingDevice.registrationCount,
    };
  },
});

/**
 * Registriraj novo napravo za uporabnika (po uspešni prijavi/registraciji)
 */
export const registerDevice = authMutation({
  args: {
    platform: v.string(),
    osVersion: v.optional(v.string()),
    deviceModel: v.optional(v.string()),
    deviceBrand: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    deviceName: v.string(), // "iPhone 16 Pro Max"
  },
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const fingerprintHash = generateFingerprintHash(args);
    const now = Date.now();

    // Preveri če naprava že obstaja v deviceFingerprints
    let deviceFingerprint = await ctx.db
      .query("deviceFingerprints")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprintHash", fingerprintHash))
      .first();

    if (!deviceFingerprint) {
      // Ustvari nov deviceFingerprint
      const fpId = await ctx.db.insert("deviceFingerprints", {
        fingerprintHash,
        platform: args.platform,
        osVersion: args.osVersion,
        deviceModel: args.deviceModel,
        deviceBrand: args.deviceBrand,
        appVersion: args.appVersion,
        firstSeenAt: now,
        lastSeenAt: now,
        registrationCount: 1,
        registeredUserIds: [userId],
        isBlocked: false,
      });
      deviceFingerprint = await ctx.db.get(fpId);
    } else {
      // Posodobi obstoječi deviceFingerprint
      if (!deviceFingerprint.registeredUserIds.includes(userId)) {
        await ctx.db.patch(deviceFingerprint._id, {
          lastSeenAt: now,
          registrationCount: deviceFingerprint.registrationCount + 1,
          registeredUserIds: [...deviceFingerprint.registeredUserIds, userId],
        });
      } else {
        await ctx.db.patch(deviceFingerprint._id, {
          lastSeenAt: now,
        });
      }
    }

    // Preveri če je naprava že registrirana za tega uporabnika
    const existingRegistration = await ctx.db
      .query("registeredDevices")
      .withIndex("by_user_and_fingerprint", (q) =>
        q.eq("userId", userId).eq("fingerprintHash", fingerprintHash)
      )
      .first();

    if (existingRegistration) {
      // Posodobi zadnji čas uporabe
      await ctx.db.patch(existingRegistration._id, {
        lastUsedAt: now,
      });
      return {
        success: true,
        deviceId: existingRegistration._id,
        message: "Naprava že registrirana - posodobljeno",
      };
    }

    // Preveri število naprav uporabnika
    const userDevices = await ctx.db
      .query("registeredDevices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (userDevices.length >= MAX_DEVICES_PER_USER) {
      throw new Error(
        `Doseženo maksimalno število naprav (${MAX_DEVICES_PER_USER}). Odstrani staro napravo v nastavitvah.`
      );
    }

    // Ali je to prva naprava (bo primarna)
    const isPrimary = userDevices.length === 0;

    // Registriraj novo napravo
    const deviceId = await ctx.db.insert("registeredDevices", {
      userId,
      fingerprintHash,
      deviceName: args.deviceName,
      platform: args.platform,
      registeredAt: now,
      lastUsedAt: now,
      isPrimary,
      isLocked: false,
    });

    return {
      success: true,
      deviceId,
      isPrimary,
      message: "Naprava uspešno registrirana",
    };
  },
});

/**
 * Preveri ali lahko uporabnik uporablja to napravo (za Family Plan lock)
 */
export const checkDeviceAccess = authMutation({
  args: {
    fingerprintHash: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.user._id;

    // Preveri če je naprava registrirana za tega uporabnika
    const userDevice = await ctx.db
      .query("registeredDevices")
      .withIndex("by_user_and_fingerprint", (q) =>
        q.eq("userId", userId).eq("fingerprintHash", args.fingerprintHash)
      )
      .first();

    if (!userDevice) {
      return {
        allowed: false,
        message: "Ta naprava ni registrirana za tvoj račun.",
      };
    }

    // Preveri če je naprava zaklenjena za drugega uporabnika
    const otherUserDevices = await ctx.db
      .query("registeredDevices")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprintHash", args.fingerprintHash))
      .filter((q) => q.neq(q.field("userId"), userId))
      .collect();

    const lockedForOther = otherUserDevices.some((d) => d.isLocked);

    if (lockedForOther) {
      const lockedDevice = otherUserDevices.find((d) => d.isLocked);
      return {
        allowed: false,
        message: `Ta naprava je zaklenjena za drugega uporabnika (${lockedDevice?.deviceName || "Neznana naprava"}). Samo en uporabnik jo lahko uporablja hkrati.`,
        lockedForUser: lockedDevice?.userId,
      };
    }

    // Posodobi zadnji čas uporabe
    await ctx.db.patch(userDevice._id, {
      lastUsedAt: Date.now(),
    });

    return {
      allowed: true,
      message: "Dostop dovoljen",
      deviceId: userDevice._id,
    };
  },
});

/**
 * Pridobi seznam registriranih naprav za uporabnika
 */
export const getUserDevices = authQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.user._id;

    const devices = await ctx.db
      .query("registeredDevices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return devices.map((d) => ({
      id: d._id,
      deviceName: d.deviceName,
      platform: d.platform,
      registeredAt: d.registeredAt,
      lastUsedAt: d.lastUsedAt,
      isPrimary: d.isPrimary,
      isLocked: d.isLocked,
      lockedAt: d.lockedAt,
    }));
  },
});

/**
 * Zakleni napravo (samo trenutni uporabnik jo lahko uporablja)
 */
export const lockDevice = authMutation({
  args: {
    deviceId: v.id("registeredDevices"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const device = await ctx.db.get(args.deviceId);

    if (!device) {
      throw new Error("Naprava ne obstaja");
    }

    if (device.userId !== userId) {
      throw new Error("Nimate dovoljenja za zaklepanje te naprave");
    }

    await ctx.db.patch(args.deviceId, {
      isLocked: true,
      lockedAt: Date.now(),
    });

    return {
      success: true,
      message: `${device.deviceName} je zdaj zaklenjena za tvoj račun.`,
    };
  },
});

/**
 * Odkleni napravo
 */
export const unlockDevice = authMutation({
  args: {
    deviceId: v.id("registeredDevices"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const device = await ctx.db.get(args.deviceId);

    if (!device) {
      throw new Error("Naprava ne obstaja");
    }

    if (device.userId !== userId) {
      throw new Error("Nimate dovoljenja za odklepanje te naprave");
    }

    await ctx.db.patch(args.deviceId, {
      isLocked: false,
      lockedAt: undefined,
    });

    return {
      success: true,
      message: `${device.deviceName} je zdaj odklenjena.`,
    };
  },
});

/**
 * Odstrani napravo
 */
export const removeDevice = authMutation({
  args: {
    deviceId: v.id("registeredDevices"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const device = await ctx.db.get(args.deviceId);

    if (!device) {
      throw new Error("Naprava ne obstaja");
    }

    if (device.userId !== userId) {
      throw new Error("Nimate dovoljenja za odstranitev te naprave");
    }

    if (device.isPrimary) {
      throw new Error("Primarne naprave ne morete odstraniti. Najprej nastavite drugo napravo kot primarno.");
    }

    await ctx.db.delete(args.deviceId);

    return {
      success: true,
      message: `${device.deviceName} odstranjena.`,
    };
  },
});

/**
 * Nastavi napravo kot primarno
 */
export const setPrimaryDevice = authMutation({
  args: {
    deviceId: v.id("registeredDevices"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const device = await ctx.db.get(args.deviceId);

    if (!device) {
      throw new Error("Naprava ne obstaja");
    }

    if (device.userId !== userId) {
      throw new Error("Nimate dovoljenja");
    }

    // Odstrani primarno oznako iz vseh naprav
    const allDevices = await ctx.db
      .query("registeredDevices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const d of allDevices) {
      if (d.isPrimary) {
        await ctx.db.patch(d._id, { isPrimary: false });
      }
    }

    // Nastavi trenutno napravo kot primarno
    await ctx.db.patch(args.deviceId, { isPrimary: true });

    return {
      success: true,
      message: `${device.deviceName} je zdaj primarna naprava.`,
    };
  },
});
