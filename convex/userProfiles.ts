import { v } from "convex/values";
import { authQuery, authMutation } from "./functions";
import { action, internalMutation, query } from "./_generated/server";
import { getDateKey, getNextMidnightTimestamp } from "./time";
import { sendAdminNotification } from "./notify";
import { authComponent } from "./auth";
import { api, components, internal } from "./_generated/api";

const MAX_FREE_SEARCHES = 3; // Max free searches per day
const MAX_GUEST_SEARCHES = 1; // Guest has 1 search per day
const NICKNAME_MIN_LENGTH = 3;
const NICKNAME_MAX_LENGTH = 20;
const NICKNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_ADMIN_EMAILS = ["lamprett69@gmail.com", "prrhran@gmail.com"];
const rawAdminEmails =
  process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAILS.join(",");
const ADMIN_EMAILS = rawAdminEmails
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);
const isAdminEmail = (email?: string | null) =>
  Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));

// Get user profile
export const getProfile = authQuery({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("userProfiles"),
      _creationTime: v.number(),
      userId: v.string(),
      name: v.optional(v.string()),
      nickname: v.optional(v.string()),
      nicknameUpdatedAt: v.optional(v.number()),
      nicknameChangeAvailableAt: v.optional(v.number()),
      email: v.optional(v.string()),
      emailVerified: v.optional(v.boolean()),
      isAnonymous: v.optional(v.boolean()),
      isAdmin: v.optional(v.boolean()),
      profilePictureUrl: v.optional(v.string()),
      birthDate: v.optional(
        v.object({
          day: v.number(),
          month: v.number(),
          year: v.number(),
        })
      ),
      isPremium: v.boolean(),
      premiumUntil: v.optional(v.number()),
      premiumType: v.optional(v.union(v.literal("solo"), v.literal("family"))),
      familyOwnerId: v.optional(v.string()),
      familyMembers: v.optional(v.array(v.string())),
      dailySearches: v.number(),
      lastSearchDate: v.string(),
      searchResetTime: v.optional(v.number()),
      canSearch: v.boolean(),
      searchesRemaining: v.number(),
      totalSavings: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const today = getDateKey(Date.now());
    console.log("getProfile called for userId:", userId);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();
    console.log("Profile found:", !!profile);

    if (!profile) {
      return null;
    }

    let dailySearches = profile.dailySearches;
    let searchResetTime = profile.searchResetTime;

    if (profile.lastSearchDate !== today) {
      dailySearches = 0;
      searchResetTime = undefined;
    }

    const isGuest = profile.isAnonymous || !profile.email;
    const maxSearches = profile.isPremium
      ? Infinity
      : isGuest
      ? MAX_GUEST_SEARCHES
      : MAX_FREE_SEARCHES;
    const searchesRemaining = profile.isPremium
      ? 999
      : Math.max(0, maxSearches - dailySearches);
    const computedAdmin = (profile.isAdmin ?? false) || isAdminEmail(profile.email);

    return {
      _id: profile._id,
      _creationTime: profile._creationTime,
      userId: profile.userId,
      name: profile.name,
      nickname: profile.nickname ?? profile.name,
      nicknameUpdatedAt: profile.nicknameUpdatedAt,
      nicknameChangeAvailableAt: profile.nicknameChangeAvailableAt,
      email: profile.email,
      emailVerified: profile.emailVerified ?? false,
      isAnonymous: profile.isAnonymous ?? false,
      isAdmin: computedAdmin,
      profilePictureUrl: profile.profilePictureUrl,
      birthDate: profile.birthDate,
      isPremium: profile.isPremium,
      premiumUntil: profile.premiumUntil,
      premiumType: profile.premiumType,
      familyOwnerId: profile.familyOwnerId,
      familyMembers: profile.familyMembers,
      dailySearches,
      lastSearchDate: profile.lastSearchDate !== today ? today : profile.lastSearchDate,
      searchResetTime,
      canSearch: profile.isPremium || dailySearches < maxSearches,
      searchesRemaining,
      totalSavings: profile.totalSavings,
    };
  },
});

// Check nickname availability (public)
export const isNicknameAvailable = query({
  args: {
    nickname: v.string(),
  },
  returns: v.object({
    available: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const normalized = args.nickname.trim().toLowerCase();
    if (!normalized) {
      return { available: false };
    }
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_nickname", (q) => q.eq("nicknameLower", normalized))
      .first();
    return { available: !existing };
  },
});

// Create or update profile
export const ensureProfile = authMutation({
  args: {},
  returns: v.id("userProfiles"),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const today = getDateKey(Date.now());
    const nickname = ctx.user.name ? ctx.user.name.trim() : undefined;
    const nicknameLower = nickname ? nickname.toLowerCase() : undefined;

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("userProfiles", {
      userId,
      name: ctx.user.name || undefined,
      nickname,
      nicknameLower,
      nicknameUpdatedAt: nickname ? now : undefined,
      nicknameChangeAvailableAt: nickname ? now + NICKNAME_COOLDOWN_MS : undefined,
      email: ctx.user.email || undefined,
      emailVerified: ctx.user.emailVerified ?? false,
      isAnonymous: ctx.user.isAnonymous ?? false,
      isAdmin: isAdminEmail(ctx.user.email),
      isPremium: false,
      dailySearches: 0,
      lastSearchDate: today,
    });
  },
});

// Update birth date (legacy)
export const updateBirthDate = authMutation({
  args: {
    day: v.number(),
    month: v.number(),
    year: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) return false;

    await ctx.db.patch(profile._id, {
      birthDate: {
        day: args.day,
        month: args.month,
        year: args.year,
      },
    });

    return true;
  },
});

// Record search usage
export const recordSearch = authMutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    searchesRemaining: v.number(),
    resetTime: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const today = getDateKey(Date.now());
    const now = Date.now();
    const isAnonymous = ctx.user.isAnonymous ?? false;
    const isGuestUser = isAnonymous || !ctx.user.email;
    const guestMaxSearches = isGuestUser ? MAX_GUEST_SEARCHES : MAX_FREE_SEARCHES;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      const resetTime = guestMaxSearches <= 1 ? getNextMidnightTimestamp(now) : undefined;
      await ctx.db.insert("userProfiles", {
        userId,
        name: ctx.user.name || undefined,
        nickname: ctx.user.name || undefined,
        nicknameLower: ctx.user.name ? ctx.user.name.toLowerCase() : undefined,
        nicknameUpdatedAt: ctx.user.name ? now : undefined,
        nicknameChangeAvailableAt: ctx.user.name ? now + NICKNAME_COOLDOWN_MS : undefined,
        email: ctx.user.email || undefined,
        emailVerified: ctx.user.emailVerified ?? false,
        isAnonymous: isAnonymous,
        isAdmin: isAdminEmail(ctx.user.email),
        isPremium: false,
        dailySearches: 1,
        lastSearchDate: today,
        searchResetTime: resetTime,
      });
      return {
        success: true,
        searchesRemaining: Math.max(0, guestMaxSearches - 1),
        resetTime,
      };
    }

    const isGuest = profile.isAnonymous || !profile.email;

    // Require email verification for non-guest users
    if (!isGuest && !profile.emailVerified) {
      return {
        success: false,
        searchesRemaining: 0,
        error: "Email verification required. Please verify your email to start searching.",
      };
    }

    const maxSearches = profile.isPremium
      ? Infinity
      : isGuest
      ? MAX_GUEST_SEARCHES
      : MAX_FREE_SEARCHES;

    if (profile.lastSearchDate !== today) {
      const resetTime = !profile.isPremium && 1 >= maxSearches ? getNextMidnightTimestamp(now) : undefined;
      await ctx.db.patch(profile._id, {
        dailySearches: 1,
        lastSearchDate: today,
        searchResetTime: resetTime,
      });
      return {
        success: true,
        searchesRemaining: profile.isPremium ? 999 : Math.max(0, maxSearches - 1),
        resetTime,
      };
    }

    if (!profile.isPremium && profile.dailySearches >= maxSearches) {
      const guestError =
        "Daily guest limit reached. Register to unlock 3 searches per day and access Cart + Profile.";
      const premiumError =
        "Daily search limit reached. Upgrade to PrHran Plus for unlimited search.";
      if (!profile.searchResetTime) {
        const resetTime = getNextMidnightTimestamp(now);
        await ctx.db.patch(profile._id, {
          searchResetTime: resetTime,
        });
        return {
          success: false,
          searchesRemaining: 0,
          resetTime,
          error: isGuest ? guestError : premiumError,
        };
      }
      return {
        success: false,
        searchesRemaining: 0,
        resetTime: profile.searchResetTime,
        error: isGuest ? guestError : premiumError,
      };
    }

    const newSearchCount = profile.dailySearches + 1;
    const remaining = profile.isPremium ? 999 : Math.max(0, maxSearches - newSearchCount);

    const updateData: { dailySearches: number; searchResetTime?: number } = {
      dailySearches: newSearchCount,
    };

    if (!profile.isPremium && newSearchCount >= maxSearches) {
      updateData.searchResetTime = getNextMidnightTimestamp(now);
    }

    await ctx.db.patch(profile._id, updateData);

    return {
      success: true,
      searchesRemaining: remaining,
      resetTime: updateData.searchResetTime,
    };
  },
});

// Update nickname (1x per 30 days)
export const updateNickname = authMutation({
  args: {
    nickname: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    availableAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const trimmed = args.nickname.trim();
    const normalized = trimmed.toLowerCase();
    const now = Date.now();

    if (trimmed.length < NICKNAME_MIN_LENGTH || trimmed.length > NICKNAME_MAX_LENGTH) {
      return { success: false, error: "Nickname must be 3-20 characters." };
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      return { success: false, error: "Profile not found." };
    }

    const isGuest = profile.isAnonymous || !profile.email;
    if (isGuest) {
      return { success: false, error: "Register before setting a nickname." };
    }

    if (profile.nicknameChangeAvailableAt && now < profile.nicknameChangeAvailableAt) {
      return {
        success: false,
        error: "Nickname can be changed once every 30 days.",
        availableAt: profile.nicknameChangeAvailableAt,
      };
    }

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_nickname", (q) => q.eq("nicknameLower", normalized))
      .first();

    if (existing && existing.userId !== userId) {
      return { success: false, error: "Nickname is already taken." };
    }

    await ctx.db.patch(profile._id, {
      nickname: trimmed,
      nicknameLower: normalized,
      nicknameUpdatedAt: now,
      nicknameChangeAvailableAt: now + NICKNAME_COOLDOWN_MS,
    });

    return { success: true };
  },
});

// Update profile picture
export const updateProfilePicture = authMutation({
  args: {
    profilePictureUrl: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      return { success: false, error: "Profile not found." };
    }

    // Ensure the image URL is properly stored
    const imageUrl = args.profilePictureUrl.trim();
    if (!imageUrl) {
      return { success: false, error: "Image URL cannot be empty." };
    }

    await ctx.db.patch(profile._id, {
      profilePictureUrl: imageUrl,
    });

    // Verify the update was successful
    const updatedProfile = await ctx.db.get(profile._id);
    if (!updatedProfile?.profilePictureUrl) {
      return { success: false, error: "Failed to save profile picture." };
    }

    return { success: true };
  },
});

// Resend email verification
export const resendVerificationEmail = authMutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const userEmail = ctx.user.email;

    if (!userEmail) {
      return {
        success: false,
        message: "No email address found. Please register with an email.",
      };
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      return {
        success: false,
        message: "Profile not found.",
      };
    }

    if (profile.emailVerified) {
      return {
        success: false,
        message: "Email is already verified.",
      };
    }

    // Generate verification token (simple random token for demo)
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const siteUrl = process.env.SITE_URL || process.env.EXPO_PUBLIC_SITE_URL || "https://www.prhran.com";
    const verifyUrl = `${siteUrl}/verify-email?token=${token}&email=${encodeURIComponent(userEmail)}`;

    // Send verification email via Resend
    const fromEmail = process.env.FROM_EMAIL;
    const fromName = process.env.FROM_NAME || "Pr'Hran";
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!fromEmail || !resendApiKey) {
      console.error("Email configuration missing");
      return {
        success: false,
        message: "Email service not configured. Please contact support.",
      };
    }

    const subject = "Potrdi svoj e-naslov - Pr'Hran";
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Pozdravljeni!</h2>
        <p style="margin: 0 0 12px;">Kliknite spodaj, da potrdite svoj e-naslov:</p>
        <p style="margin: 0 0 16px;"><a href="${verifyUrl}" style="color: #7c3aed; font-weight: 700; font-size: 16px;">Potrdi e-naslov</a></p>
        <p style="margin: 0 0 8px;">Če gumb ne deluje, kopirajte povezavo:</p>
        <p style="word-break: break-all; color: #0f172a; font-size: 12px;">${verifyUrl}</p>
        <p style="margin-top: 16px; color: #475569; font-size: 12px;">Če niste zahtevali tega sporočila, ga lahko ignorirate.</p>
      </div>
    `;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: userEmail,
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Email send failed: ${response.status} ${errorText}`);
        return {
          success: false,
          message: "Failed to send verification email. Please try again later.",
        };
      }

      console.log(`Verification email sent to ${userEmail}`);
      return {
        success: true,
        message: `Potrditveni email je bil poslan na ${userEmail}. Preverite svojo pošto.`,
      };
    } catch (error) {
      console.error("Email send error:", error);
      return {
        success: false,
        message: "Failed to send verification email. Please try again later.",
      };
    }
  },
});

// Upgrade to premium (simulation)
export const upgradeToPremium = authMutation({
  args: {
    planType: v.optional(v.union(v.literal("solo"), v.literal("family"))),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const planType = args.planType || "solo";

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) return false;

    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const premiumUntil = Date.now() + oneMonth;
    await ctx.db.patch(profile._id, {
      isPremium: true,
      premiumUntil,
      premiumType: planType,
    });

    const email = profile.email || "-";
    const nickname = profile.nickname || "-";
    const planLabel = planType === "family" ? "Family" : "Plus";
    const subject = "Nova Premium naročnina v Pr'Hran";
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Nova naročnina</h2>
        <p style="margin: 0 0 8px;"><strong>E-naslov:</strong> ${email}</p>
        <p style="margin: 0 0 8px;"><strong>Vzdevek:</strong> ${nickname}</p>
        <p style="margin: 0 0 8px;"><strong>Paket:</strong> ${planLabel}</p>
        <p style="margin: 0 0 8px;"><strong>Velja do:</strong> ${new Date(premiumUntil).toLocaleDateString("sl-SI")}</p>
        <p style="margin: 16px 0 0; color: #475569; font-size: 12px;">Samodejno obvestilo iz Pr'Hran.</p>
      </div>
    `;
    await sendAdminNotification(subject, html);

    return true;
  },
});

export const deleteAccountData = internalMutation({
  args: { userId: v.string(), email: v.optional(v.string()) },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = args.userId;
    const userEmail = args.email?.toLowerCase();

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    const familyOwnerId = profile?.familyOwnerId;
    if (familyOwnerId) {
      const owner = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", familyOwnerId))
        .first();
      if (owner?.familyMembers?.length) {
        const nextMembers = owner.familyMembers.filter((id) => id !== userId);
        await ctx.db.patch(owner._id, { familyMembers: nextMembers });
      }
    }

    const members = await ctx.db
      .query("userProfiles")
      .withIndex("by_family_owner", (q) => q.eq("familyOwnerId", userId))
      .collect();
    for (const member of members) {
      await ctx.db.patch(member._id, { familyOwnerId: undefined });
    }

    const invitesByInviter = await ctx.db
      .query("familyInvitations")
      .withIndex("by_inviter", (q) => q.eq("inviterId", userId))
      .collect();
    for (const invite of invitesByInviter) {
      await ctx.db.delete(invite._id);
    }

    const invitesByInvitee = await ctx.db
      .query("familyInvitations")
      .withIndex("by_invitee_user", (q) => q.eq("inviteeUserId", userId))
      .collect();
    for (const invite of invitesByInvitee) {
      await ctx.db.delete(invite._id);
    }

    if (userEmail) {
      const invitesByEmail = await ctx.db
        .query("familyInvitations")
        .withIndex("by_invitee_email", (q) => q.eq("inviteeEmail", userEmail))
        .collect();
      for (const invite of invitesByEmail) {
        await ctx.db.delete(invite._id);
      }
    }

    const lists = await ctx.db
      .query("shoppingLists")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
    for (const list of lists) {
      const items = await ctx.db
        .query("shoppingListItems")
        .withIndex("by_list", (q) => q.eq("listId", list._id))
        .collect();
      for (const item of items) {
        await ctx.db.delete(item._id);
      }
      await ctx.db.delete(list._id);
    }

    const couponUsage = await ctx.db
      .query("couponUsage")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const usage of couponUsage) {
      await ctx.db.delete(usage._id);
    }

    const emailVerifications = await ctx.db
      .query("emailVerifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const verification of emailVerifications) {
      await ctx.db.delete(verification._id);
    }

    const priceAlerts = await ctx.db
      .query("priceAlerts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const alert of priceAlerts) {
      await ctx.db.delete(alert._id);
    }

    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const purchase of purchases) {
      await ctx.db.delete(purchase._id);
    }

    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const receipt of receipts) {
      await ctx.db.delete(receipt._id);
    }

    const yearlySavings = await ctx.db
      .query("yearlySavings")
      .withIndex("by_user_year", (q) => q.eq("userId", userId))
      .collect();
    for (const savings of yearlySavings) {
      await ctx.db.delete(savings._id);
    }

    const seasonAwards = await ctx.db
      .query("seasonAwards")
      .withIndex("by_user_year", (q) => q.eq("userId", userId))
      .collect();
    for (const award of seasonAwards) {
      await ctx.db.delete(award._id);
    }

    const activeSessions = await ctx.db
      .query("activeSessions")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
    for (const session of activeSessions) {
      await ctx.db.delete(session._id);
    }

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const item of cartItems) {
      await ctx.db.delete(item._id);
    }

    const searchHistory = await ctx.db
      .query("searchHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const entry of searchHistory) {
      await ctx.db.delete(entry._id);
    }

    const registeredDevices = await ctx.db
      .query("registeredDevices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const device of registeredDevices) {
      await ctx.db.delete(device._id);
    }

    const fingerprints = await ctx.db.query("deviceFingerprints").collect();
    for (const fingerprint of fingerprints) {
      if (!fingerprint.registeredUserIds.includes(userId)) continue;
      const nextIds = fingerprint.registeredUserIds.filter((id) => id !== userId);
      if (nextIds.length === 0) {
        await ctx.db.delete(fingerprint._id);
      } else {
        const nextCount = Math.max(0, fingerprint.registrationCount - 1);
        await ctx.db.patch(fingerprint._id, {
          registeredUserIds: nextIds,
          registrationCount: nextCount,
        });
      }
    }

    if (profile) {
      await ctx.db.delete(profile._id);
    }

    return { success: true };
  },
});

export const deleteAccount = action({
  args: {},
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Authentication required");

    const userId = user._id;
    const email = user.email ?? undefined;

    await ctx.runMutation(internal.userProfiles.deleteAccountData, { userId, email });

    const byUserId: Array<{ field: "userId"; operator: "eq"; value: string }> = [
      { field: "userId", operator: "eq", value: userId },
    ];
    const paginationOpts = { cursor: null, numItems: 500 };

    await Promise.all([
      ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "session",
          where: byUserId,
        },
        paginationOpts,
      }),
      ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "account",
          where: byUserId,
        },
        paginationOpts,
      }),
      ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "twoFactor",
          where: byUserId,
        },
        paginationOpts,
      }),
      ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "passkey",
          where: byUserId,
        },
        paginationOpts,
      }),
      ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "oauthAccessToken",
          where: byUserId,
        },
        paginationOpts,
      }),
      ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "oauthConsent",
          where: byUserId,
        },
        paginationOpts,
      }),
    ]);

    if (email) {
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "verification",
          where: [{ field: "identifier", operator: "eq", value: email }],
        },
        paginationOpts,
      });
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "user",
          where: [{ field: "email", operator: "eq", value: email }],
        },
        paginationOpts,
      });
    }

    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "user",
        where: byUserId,
      },
      paginationOpts,
    });

    return { success: true };
  },
});
