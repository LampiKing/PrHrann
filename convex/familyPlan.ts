import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authMutation, authQuery } from "./functions";

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
  const subject = "Povabilo v Pr'Hran Family";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Pozdravljeni!</h2>
      <p style="margin: 0 0 12px;">${inviterName} te vabi v Pr'Hran Family.</p>
      <p style="margin: 0 0 16px;">
        <a href="${inviteUrl}" style="color: #7c3aed; font-weight: 700; font-size: 16px;">Sprejmi vabilo</a>
      </p>
      <p style="margin: 0 0 8px;">Če gumb ne deluje, kopiraj povezavo:</p>
      <p style="word-break: break-all; color: #0f172a; font-size: 12px;">${inviteUrl}</p>
      <p style="margin-top: 16px; color: #475569; font-size: 12px;">Če vabila nisi pričakoval, sporočilo ignoriraj.</p>
    </div>
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
 */
export const inviteFamilyMember = authMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.user._id;

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
      // -1 ker owner ni v seznamu
      throw new Error(`Maksimalno število članov je ${MAX_FAMILY_MEMBERS} (vključno s tabo)`);
    }

    // Preveri če je email že povabljen
    const existingInvite = await ctx.db
      .query("familyInvitations")
      .withIndex("by_invitee_email", (q) => q.eq("inviteeEmail", args.email))
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
    const inviteeProfile = allProfiles.find(p => p.email === args.email);

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
      inviteeEmail: args.email,
      inviteeUserId: inviteeProfile?.userId,
      status: "pending",
      inviteToken: token,
      createdAt: now,
      expiresAt,
    });

    await sendFamilyInviteEmail(args.email, token, inviterName);

    return {
      success: true,
      message: `Vabilo poslano na ${args.email}`,
      token, // Za testiranje
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
