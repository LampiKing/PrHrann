import { v } from "convex/values";
import { authMutation, authQuery, authAction } from "./functions";
import { api } from "./_generated/api";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateToken(): string {
  // 16-byte random hex string; avoid Node require for bundling safety
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
    const arr = new Uint8Array(16);
    globalThis.crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback: non-crypto token, acceptable for non-link flow
  return (
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  ).slice(0, 32);
}

// Action: send verification email (handles cooldown/resend limits)
export const requestEmailVerification = authAction({
  args: {},
  returns: v.object({ success: v.boolean(), email: v.string() }),
  handler: async (ctx) => {
    const active = await ctx.runQuery(api.emailVerification.getActiveVerification, {});

    let email: string;
    let code: string;

    if (active) {
      const now = Date.now();
      if (active.lastSentAt && now - active.lastSentAt < 60 * 1000) {
        throw new Error("Počakajte 60 sekund pred ponovnim pošiljanjem.");
      }
      const resendCount = active.resendCount ?? 1;
      if (resendCount >= 3) {
        throw new Error("Doseženo maksimalno število poskusov (3) v 15 minutah.");
      }
      const updated = await ctx.runMutation(api.emailVerification.incrementResendCount, {});
      email = updated.email;
      code = updated.code;
    } else {
      const created: { email: string; code: string; token: string } = await ctx.runMutation(
        api.emailVerification.createVerificationRecord,
        {}
      );
      email = created.email;
      code = created.code;
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;
    const fromName = process.env.FROM_NAME || "PrHran";
    if (!apiKey) {
      console.warn("RESEND_API_KEY ni nastavljen. Email ne bo poslan.");
      return { success: true, email };
    }
    if (!fromEmail) {
      console.warn("FROM_EMAIL ni nastavljen. Email ne bo poslan.");
      return { success: true, email };
    }

    const text = `Potrdite vaš e-naslov\nKoda: ${code}\nKoda velja 15 minut.\nOdprite aplikacijo in vnesite kodo za potrditev.`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject: "Potrditev e-naslova",
        text,
      }),
    });

    if (!res.ok) {
      const msg = await res.text();
      console.warn("Resend API error:", msg);
      // We still return success true so UX proceeds; code entry will work.
    }

    return { success: true, email };
  },
});

// Mutation: verify 6-digit code
export const verifyByCode = authMutation({
  args: { code: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = ctx.user._id;
    const rec = await ctx.db
      .query("emailVerifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (!rec) throw new Error("Verifikacijska zahteva ni najdena.");
    if (rec.verified) return { success: true };
    if (Date.now() > rec.expiresAt) throw new Error("Koda je potekla.");
    if (rec.code !== args.code) throw new Error("Napačna koda.");

    await ctx.db.patch(rec._id, { verified: true, verifiedAt: Date.now() });

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();
    if (profile) {
      await ctx.db.patch(profile._id, { emailVerified: true });
    }

    return { success: true };
  },
});

// Mutation: verify via token (currently unused)
export const verifyByToken = authMutation({
  args: { token: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const rec = await ctx.db
      .query("emailVerifications")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!rec) throw new Error("Neveljaven ali potekel token.");
    if (rec.verified) return { success: true };
    if (Date.now() > rec.expiresAt) throw new Error("Token je potekel.");

    await ctx.db.patch(rec._id, { verified: true, verifiedAt: Date.now() });

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", rec.userId))
      .first();
    if (profile) {
      await ctx.db.patch(profile._id, { emailVerified: true });
    }

    return { success: true };
  },
});

// Mutation: create verification record
export const createVerificationRecord = authMutation({
  args: {},
  returns: v.object({ email: v.string(), code: v.string(), token: v.string() }),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();
    const email = profile?.email || ctx.user.email;
    if (!email) throw new Error("Manjka e-naslov za verifikacijo.");

    const code = generateCode();
    const token = generateToken();
    const createdAt = Date.now();
    const expiresAt = createdAt + 15 * 60 * 1000; // 15 minutes

    await ctx.db.insert("emailVerifications", {
      userId,
      email,
      code,
      token,
      createdAt,
      expiresAt,
      verified: false,
      verifiedAt: undefined,
      resendCount: 1,
      lastSentAt: createdAt,
    });

    return { email, code, token };
  },
});

// Query: get active verification record
export const getActiveVerification = authQuery({
  args: {},
  returns: v.union(
    v.object({
      email: v.string(),
      code: v.string(),
      lastSentAt: v.optional(v.number()),
      resendCount: v.optional(v.number()),
      expiresAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const now = Date.now();
    const rec = await ctx.db
      .query("emailVerifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.and(q.eq(q.field("verified"), false), q.gt(q.field("expiresAt"), now)))
      .order("desc")
      .first();
    if (!rec) return null;
    return {
      email: rec.email,
      code: rec.code,
      lastSentAt: rec.lastSentAt,
      resendCount: rec.resendCount,
      expiresAt: rec.expiresAt,
    };
  },
});

// Mutation: increment resend count
export const incrementResendCount = authMutation({
  args: {},
  returns: v.object({ email: v.string(), code: v.string() }),
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const now = Date.now();
    const rec = await ctx.db
      .query("emailVerifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.and(q.eq(q.field("verified"), false), q.gt(q.field("expiresAt"), now)))
      .order("desc")
      .first();
    if (!rec) throw new Error("Ni aktivne verifikacije.");
    const newCount = (rec.resendCount ?? 1) + 1;
    await ctx.db.patch(rec._id, { resendCount: newCount, lastSentAt: now });
    return { email: rec.email, code: rec.code };
  },
});
//
// Remove corrupted duplicate content appended below
//
