import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { authMutation, authQuery } from "./functions";
import { api } from "./_generated/api";

const MAX_FAMILY_MEMBERS = 3; // Vključno z ownerjem
const INVITATION_EXPIRY_DAYS = 7;
const normalizeUrl = (value?: string) => value?.trim().replace(/\/$/, "");
const fallbackSiteUrl = "https://www.prhran.com";
const rawSiteUrl = normalizeUrl(
  process.env.SITE_URL || process.env.EXPO_PUBLIC_SITE_URL || fallbackSiteUrl
) || fallbackSiteUrl;
const siteUrl = rawSiteUrl.includes(".convex.cloud")
  ? rawSiteUrl.replace(".convex.cloud", ".convex.site")
  : rawSiteUrl;

async function sendFamilyInviteEmail(
  toEmail: string,
  token: string,
  inviterName: string
) {
  const fromEmail = process.env.FROM_EMAIL;
  const fromName = process.env.FROM_NAME || "PrHran";
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!fromEmail || !resendApiKey) {
    throw new Error("Pošiljanje vabila ni nastavljeno. Kontaktiraj podporo.");
  }

  const inviteUrl = `${siteUrl}/accept-invitation?token=${encodeURIComponent(token)}`;
  const subject = `🎉 ${inviterName} te vabi v Pr'Hran Family!`;
  const text = `Pozdravljeni!

${inviterName} te vabi v Pr'Hran Family! 👨‍👩‍👧

🌟 KAJ DOBIŠ:
✅ Premium košarica - shrani najljubše izdelke
✅ Avtomatski kuponi - prihrani še več
✅ Neomejeno iskanje - vse cene vseh trgovin
✅ Brez oglasov - čista izkušnja

👉 SPREJMI VABILO:
${inviteUrl}

⏰ Vabilo velja 7 dni.

Če vabila niste pričakovali, to sporočilo ignorirajte.

---
© ${new Date().getFullYear()} Pr'Hran
Izdelano z ❤️ v Sloveniji 🇸🇮`;
  const html = `
<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Family Vabilo</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0a0a12 0%, #1a0a2e 50%, #0f0a1e 100%); min-height: 100vh;">
  <table width="100%" cellpadding="0" cellspacing="0" style="min-height: 100vh; background: linear-gradient(135deg, #0a0a12 0%, #1a0a2e 50%, #0f0a1e 100%);">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main Container -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: rgba(15, 23, 42, 0.95); border-radius: 24px; border: 1px solid rgba(251, 191, 36, 0.4); box-shadow: 0 20px 60px rgba(251, 191, 36, 0.3);">

          <!-- Logo & Header -->
          <tr>
            <td align="center" style="padding: 48px 32px 24px;">
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="position: relative;">
                    <!-- Pr'Hran Family SVG Logo -->
                    <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                      <!-- Outer glow rings -->
                      <rect x="0" y="0" width="100" height="100" rx="24" fill="rgba(251, 191, 36, 0.05)" />
                      <rect x="4" y="4" width="92" height="92" rx="22" fill="rgba(251, 191, 36, 0.1)" />

                      <!-- Main gradient background -->
                      <defs>
                        <linearGradient id="familyLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
                          <stop offset="50%" style="stop-color:#f59e0b;stop-opacity:1" />
                          <stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
                        </linearGradient>
                        <filter id="familyLogoShadow" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur in="SourceAlpha" stdDeviation="8"/>
                          <feOffset dx="0" dy="4" result="offsetblur"/>
                          <feComponentTransfer>
                            <feFuncA type="linear" slope="0.6"/>
                          </feComponentTransfer>
                          <feMerge>
                            <feMergeNode/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>

                      <!-- Logo box with shadow -->
                      <rect x="8" y="8" width="84" height="84" rx="20" fill="url(#familyLogoGradient)" filter="url(#familyLogoShadow)" />

                      <!-- Letter P -->
                      <text x="50" y="72" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="900" fill="#ffffff" text-anchor="middle" style="text-shadow: 0 2px 12px rgba(0,0,0,0.3);">P</text>

                      <!-- Family badge - small crown icon -->
                      <circle cx="75" cy="25" r="14" fill="#fbbf24" filter="url(#familyLogoShadow)" />
                      <text x="75" y="31" font-size="16" fill="#0a0a12" text-anchor="middle" font-weight="900">👑</text>
                    </svg>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 28px 0 12px; font-size: 36px; font-weight: 900; color: #ffffff; letter-spacing: -1px; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);">Pr'Hran Family</h1>
              <p style="margin: 0; font-size: 17px; color: #fcd34d; font-weight: 600; letter-spacing: 0.5px;">✨ Premium načrt za vso družino</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.4), transparent);"></div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 20px; font-size: 32px; font-weight: 900; color: #ffffff; text-align: center; line-height: 1.2;">
                <strong style="color: #fbbf24; font-size: 36px;">${inviterName}</strong><br/>
                <span style="font-size: 20px; color: #cbd5e1; font-weight: 600;">te vabi v Pr'Hran Family! 🎉</span>
              </h2>

              <!-- Benefits Box - KOMPAKTNEJŠI -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(251, 146, 60, 0.1)); border: 2px solid rgba(251, 191, 36, 0.4); border-radius: 16px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 16px; font-size: 17px; font-weight: 800; color: #fbbf24; text-align: center;">🌟 Kaj dobiš?</p>
                    <p style="margin: 0; font-size: 15px; line-height: 24px; color: #e5e7eb; text-align: center;">
                      ✅ <strong style="color: #fcd34d;">Premium košarica</strong><br/>
                      ✅ <strong style="color: #fcd34d;">Avtomatski kuponi</strong><br/>
                      ✅ <strong style="color: #fcd34d;">Neomejeno iskanje</strong><br/>
                      ✅ <strong style="color: #fcd34d;">Brez oglasov</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 12px 0 32px;">
                    <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #0a0a12; text-decoration: none; font-size: 18px; font-weight: 800; padding: 18px 48px; border-radius: 16px; box-shadow: 0 12px 32px rgba(251, 191, 36, 0.4), 0 0 0 4px rgba(251, 191, 36, 0.1); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">
                      🎁 Sprejmi vabilo
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info - KOMPAKTNO -->
              <p style="margin: 16px 0 0; font-size: 14px; line-height: 22px; color: #c4b5fd; text-align: center;">
                ⏰ Vabilo velja <strong style="color: #fbbf24;">7 dni</strong>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.4), transparent);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 36px 32px;">
              <p style="margin: 0 0 16px; font-size: 13px; line-height: 20px; color: #9ca3af; text-align: center;">
                🔒 Če vabila niste pričakovali, lahko to sporočilo ignorirate.
              </p>
              <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280; text-align: center;">
                © ${new Date().getFullYear()} <strong style="color: #fbbf24;">Pr'Hran</strong>
              </p>
              <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center; letter-spacing: 0.5px;">
                Izdelano z ❤️ v Sloveniji 🇸🇮
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: toEmail,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Family invite email failed:", response.status, errorText);
    throw new Error("Pošiljanje vabila ni uspelo. Poskusi znova.");
  }
}

/**
 * Генериша invite token
 */
function generateInviteToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Povabi člana v Family Plan
 * POMEMBNO: To je ACTION (ne mutation) ker mora poslat email preko Resend API
 */
export const inviteFamilyMember = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Get user from auth
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Nisi prijavljen");
    }
    const userId = user.subject;

    // Use internal mutation to create invitation and validate
    const result = await ctx.runMutation(api.familyPlan.createFamilyInvitationInternal, {
      userId,
      email: args.email,
    });

    // Send email
    await sendFamilyInviteEmail(args.email, result.token, result.inviterName);

    return {
      success: true,
      message: `Vabilo poslano na ${args.email}`,
    };
  },
});

/**
 * INTERNAL: Create family invitation (called from action)
 */
export const createFamilyInvitationInternal = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, email } = args;

    // Pridobi profil uporabnika
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      throw new Error("Profil ne obstaja");
    }

    // Preveri če je uporabnik Family owner
    if (profile.premiumType !== "family") {
      throw new Error("Za vabilo članov potrebuješ Family naročnino");
    }

    if (profile.familyOwnerId && profile.familyOwnerId !== userId) {
      throw new Error("Samo lastnik Family načrta lahko vabi nove člane");
    }

    // Preveri število članov
    const currentMembers = profile.familyMembers || [];
    if (currentMembers.length >= MAX_FAMILY_MEMBERS - 1) {
      throw new Error(`Maksimalno število članov je ${MAX_FAMILY_MEMBERS} (vključno s tabo)`);
    }

    // Preveri če je email že povabljen
    const existingInvite = await ctx.db
      .query("familyInvitations")
      .withIndex("by_invitee_email", (q) => q.eq("inviteeEmail", email))
      .filter((q) =>
        q.and(
          q.eq(q.field("inviterId"), userId),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();

    if (existingInvite) {
      throw new Error("Ta email je že povabljen. Počakaj na odgovor.");
    }

    // Preveri če uporabnik z tem emailom že obstaja in je že v Family
    const allProfiles = await ctx.db.query("userProfiles").collect();
    const inviteeProfile = allProfiles.find(p => p.email === email);

    if (inviteeProfile) {
      if (inviteeProfile.familyOwnerId) {
        throw new Error("Ta uporabnik je že član drugega Family načrta");
      }
      if (currentMembers.includes(inviteeProfile.userId)) {
        throw new Error("Ta uporabnik je že član tvojega Family načrta");
      }
    }

    // Ustvari vabilo
    const token = generateInviteToken();
    const inviterName = profile.nickname || profile.name || "Pr'Hran uporabnik";
    const now = Date.now();
    const expiresAt = now + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    await ctx.db.insert("familyInvitations", {
      inviterId: userId,
      inviterNickname: inviterName,
      inviteeEmail: email,
      inviteeUserId: inviteeProfile?.userId,
      status: "pending",
      inviteToken: token,
      createdAt: now,
      expiresAt,
    });

    return {
      token,
      inviterName,
    };
  },
});

/**
 * Sprejmi vabilo v Family Plan
 */
export const acceptFamilyInvitation = authMutation({
  args: {
    inviteToken: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.user._id;

    // Najdi vabilo
    const invitation = await ctx.db
      .query("familyInvitations")
      .withIndex("by_token", (q) => q.eq("inviteToken", args.inviteToken))
      .first();

    if (!invitation) {
      throw new Error("Vabilo ne obstaja ali je že bilo uporabljeno");
    }

    if (invitation.status !== "pending") {
      throw new Error(`Vabilo je že ${invitation.status}`);
    }

    if (invitation.expiresAt < Date.now()) {
      await ctx.db.patch(invitation._id, { status: "expired" });
      throw new Error("Vabilo je poteklo");
    }

    // Pridobi profila
    const inviteeProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    const inviterProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", invitation.inviterId))
      .first();

    if (!inviteeProfile || !inviterProfile) {
      throw new Error("Profil ne obstaja");
    }

    // Preveri če je invitee že v Family
    if (inviteeProfile.familyOwnerId) {
      throw new Error("Že si član drugega Family načrta. Najprej ga zapusti.");
    }

    // Preveri če je inviter še vedno Family owner
    if (inviterProfile.premiumType !== "family") {
      throw new Error("Povabitelj več nima Family naročnine");
    }

    // Dodaj člana v Family
    const currentMembers = inviterProfile.familyMembers || [];
    if (currentMembers.length >= MAX_FAMILY_MEMBERS - 1) {
      throw new Error("Family načrt je že poln");
    }

    // Posodobi invitee profil
    await ctx.db.patch(inviteeProfile._id, {
      familyOwnerId: invitation.inviterId,
      isPremium: true, // Family člani dobijo premium funkcije
      premiumType: undefined, // Samo owner ima premiumType
    });

    // Posodobi inviter profil (dodaj člana)
    await ctx.db.patch(inviterProfile._id, {
      familyMembers: [...currentMembers, userId],
    });

    // Označi vabilo kot sprejeto
    await ctx.db.patch(invitation._id, {
      status: "accepted",
      respondedAt: Date.now(),
    });

    return {
      success: true,
      message: `Uspešno si se pridružil Family načrtu uporabnika ${invitation.inviterNickname}!`,
      ownerNickname: invitation.inviterNickname,
    };
  },
});

/**
 * Zavrni vabilo v Family Plan
 */
export const declineFamilyInvitation = authMutation({
  args: {
    inviteToken: v.string(),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("familyInvitations")
      .withIndex("by_token", (q) => q.eq("inviteToken", args.inviteToken))
      .first();

    if (!invitation) {
      throw new Error("Vabilo ne obstaja");
    }

    if (invitation.status !== "pending") {
      throw new Error("Vabilo ni več aktivno");
    }

    await ctx.db.patch(invitation._id, {
      status: "declined",
      respondedAt: Date.now(),
    });

    return {
      success: true,
      message: "Vabilo zavrnjeno",
    };
  },
});

/**
 * Odstrani člana iz Family Plan (samo owner)
 */
export const removeFamilyMember = authMutation({
  args: {
    memberUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.user._id;

    const ownerProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!ownerProfile) {
      throw new Error("Profil ne obstaja");
    }

    if (ownerProfile.premiumType !== "family") {
      throw new Error("Samo Family owner lahko odstranjuje člane");
    }

    const currentMembers = ownerProfile.familyMembers || [];
    if (!currentMembers.includes(args.memberUserId)) {
      throw new Error("Ta uporabnik ni član tvojega Family načrta");
    }

    // Odstrani člana iz seznama
    const updatedMembers = currentMembers.filter((m) => m !== args.memberUserId);

    await ctx.db.patch(ownerProfile._id, {
      familyMembers: updatedMembers,
    });

    // Posodobi profil člana
    const memberProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.memberUserId))
      .first();

    if (memberProfile) {
      await ctx.db.patch(memberProfile._id, {
        familyOwnerId: undefined,
        isPremium: false, // Izgubi premium
      });
    }

    return {
      success: true,
      message: "Član odstranjen iz Family načrta",
    };
  },
});

/**
 * Zapusti Family Plan (član)
 */
export const leaveFamilyPlan = authMutation({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.user._id;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      throw new Error("Profil ne obstaja");
    }

    if (!profile.familyOwnerId) {
      throw new Error("Nisi član nobenega Family načrta");
    }

    if (profile.premiumType === "family") {
      throw new Error("Kot owner Family načrta ga ne moreš zapustiti. Najprej razveljavi naročnino.");
    }

    const ownerId = profile.familyOwnerId;

    // Odstrani se iz owner-jevega seznama
    const ownerProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", ownerId))
      .first();

    if (ownerProfile) {
      const updatedMembers = (ownerProfile.familyMembers || []).filter((m) => m !== userId);
      await ctx.db.patch(ownerProfile._id, {
        familyMembers: updatedMembers,
      });
    }

    // Posodobi svoj profil
    await ctx.db.patch(profile._id, {
      familyOwnerId: undefined,
      isPremium: false,
    });

    return {
      success: true,
      message: "Uspešno si zapustil Family načrt",
    };
  },
});

/**
 * Pridobi Family člane (za owner)
 */
export const getFamilyMembers = authQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.user._id;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!profile || profile.premiumType !== "family") {
      return {
        isOwner: false,
        members: [],
        maxMembers: MAX_FAMILY_MEMBERS,
      };
    }

    const memberIds = profile.familyMembers || [];
    const members = [];

    for (const memberId of memberIds) {
      const memberProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", memberId))
        .first();

      if (memberProfile) {
        members.push({
          userId: memberId,
          nickname: memberProfile.nickname || "Neznani uporabnik",
          email: memberProfile.email,
          joinedAt: memberProfile._creationTime, // Uporabi _creationTime namesto createdAt
        });
      }
    }

    return {
      isOwner: true,
      members,
      maxMembers: MAX_FAMILY_MEMBERS,
      availableSlots: MAX_FAMILY_MEMBERS - 1 - members.length,
    };
  },
});

/**
 * Pridobi pending invitations (za owner)
 */
export const getPendingInvitations = authQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.user._id;

    const invitations = await ctx.db
      .query("familyInvitations")
      .withIndex("by_inviter", (q) => q.eq("inviterId", userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    const now = Date.now();
    return invitations
      .filter((inv) => inv.expiresAt > now)
      .map((inv) => ({
        id: inv._id,
        email: inv.inviteeEmail,
        token: inv.inviteToken,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
      }));
  },
});

/**
 * Prekliči vabilo (за owner)
 */
export const cancelInvitation = authMutation({
  args: {
    invitationId: v.id("familyInvitations"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.user._id;

    const invitation = await ctx.db.get(args.invitationId);

    if (!invitation) {
      throw new Error("Vabilo ne obstaja");
    }

    if (invitation.inviterId !== userId) {
      throw new Error("Nimate dovoljenja za preklic tega vabila");
    }

    await ctx.db.delete(args.invitationId);

    return {
      success: true,
      message: "Vabilo preklicano",
    };
  },
});
