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

    const html = `
<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Potrditev e-naslova</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0a0a12 0%, #1a0a2e 50%, #0f0a1e 100%); min-height: 100vh;">
  <table width="100%" cellpadding="0" cellspacing="0" style="min-height: 100vh; background: linear-gradient(135deg, #0a0a12 0%, #1a0a2e 50%, #0f0a1e 100%);">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main Container -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: rgba(15, 23, 42, 0.85); border-radius: 24px; border: 1px solid rgba(139, 92, 246, 0.3); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);">

          <!-- Logo & Header -->
          <tr>
            <td align="center" style="padding: 48px 32px 24px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(168, 85, 247, 0.4);">
                <span style="font-size: 42px; font-weight: 900; color: #ffffff; letter-spacing: -1px;">P</span>
              </div>
              <h1 style="margin: 24px 0 12px; font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Pr'Hran</h1>
              <p style="margin: 0; font-size: 16px; color: #a78bfa; font-weight: 600;">Primerjavajte cene z lahkoto</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4), transparent);"></div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #ffffff; text-align: center;">Potrdite svoj e-naslov</h2>
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 24px; color: #cbd5e1; text-align: center;">Za dokončanje registracije vnesite spodnjo kodo v aplikaciji Pr'Hran.</p>

              <!-- Code Box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 32px 0;">
                    <div style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 16px; padding: 24px 48px; box-shadow: 0 12px 32px rgba(139, 92, 246, 0.35);">
                      <p style="margin: 0; font-size: 14px; color: #e9d5ff; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Vaša verifikacijska koda</p>
                      <p style="margin: 12px 0 0; font-size: 48px; font-weight: 900; color: #ffffff; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 12px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="32" valign="top">
                          <div style="width: 24px; height: 24px; background: rgba(251, 191, 36, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <span style="color: #fbbf24; font-size: 16px; font-weight: 700;">ℹ</span>
                          </div>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0; font-size: 14px; line-height: 20px; color: #fcd34d;">
                            <strong style="font-weight: 700;">Pomembno:</strong> Ta koda velja samo <strong>15 minut</strong>. Če kode ne boste vnesli v tem času, boste morali zahtevati novo.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Instructions -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #ffffff;">Kako potrditi e-naslov:</p>
                    <ol style="margin: 0; padding-left: 24px; font-size: 14px; line-height: 24px; color: #cbd5e1;">
                      <li style="margin-bottom: 8px;">Odprite aplikacijo <strong style="color: #a78bfa;">Pr'Hran</strong></li>
                      <li style="margin-bottom: 8px;">Vnesite zgornjo <strong style="color: #a78bfa;">6-mestno kodo</strong></li>
                      <li style="margin-bottom: 0;">Kliknite <strong style="color: #a78bfa;">"Potrdi kodo"</strong></li>
                    </ol>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4), transparent);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 12px; font-size: 13px; line-height: 20px; color: #9ca3af; text-align: center;">
                Če niste zahtevali te potrditve, lahko to sporočilo ignorirate.
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                © ${new Date().getFullYear()} Pr'Hran. Vsi izdelani z ❤️ v Sloveniji.
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

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject: "🔐 Potrditev e-naslova - Pr'Hran",
        text,
        html,
      }),
    });

    if (!res.ok) {
      const msg = await res.text();
      console.error("Resend API error:", msg);
      throw new Error("Napaka pri pošiljanju emaila. Prosimo, poskusite znova ali kontaktirajte podporo.");
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
