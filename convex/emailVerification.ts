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
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: rgba(15, 23, 42, 0.95); border-radius: 24px; border: 1px solid rgba(139, 92, 246, 0.4); box-shadow: 0 20px 60px rgba(139, 92, 246, 0.3);">

          <!-- Logo & Header -->
          <tr>
            <td align="center" style="padding: 48px 32px 24px; position: relative;">
              <!-- Animated Logo with Glow -->
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="position: relative;">
                    <div style="width: 100px; height: 100px; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #6d28d9 100%); border-radius: 24px; display: inline-block; text-align: center; line-height: 100px; box-shadow: 0 12px 40px rgba(168, 85, 247, 0.6), 0 0 0 8px rgba(168, 85, 247, 0.1), 0 0 0 16px rgba(168, 85, 247, 0.05);">
                      <span style="font-size: 56px; font-weight: 900; color: #ffffff; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);">🛒</span>
                    </div>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 28px 0 12px; font-size: 36px; font-weight: 900; color: #ffffff; letter-spacing: -1px; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);">Pr'Hran</h1>
              <p style="margin: 0; font-size: 17px; color: #c4b5fd; font-weight: 600; letter-spacing: 0.5px;">✨ Primerjavajte cene z lahkoto</p>
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
              <h2 style="margin: 0 0 16px; font-size: 28px; font-weight: 800; color: #ffffff; text-align: center; line-height: 1.2;">🔐 Potrdite svoj e-naslov</h2>
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 26px; color: #cbd5e1; text-align: center;">Hvala za registracijo! 🎉<br/>Za dokončanje vnesite spodnjo kodo v aplikaciji.</p>

              <!-- Code Box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 32px 0;">
                    <div style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 20px; padding: 28px 56px; box-shadow: 0 16px 48px rgba(139, 92, 246, 0.5), 0 0 0 6px rgba(139, 92, 246, 0.1);">
                      <p style="margin: 0 0 8px; font-size: 13px; color: #e9d5ff; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">🔑 Vaša verifikacijska koda</p>
                      <p style="margin: 0; font-size: 52px; font-weight: 900; color: #ffffff; letter-spacing: 12px; font-family: 'Courier New', monospace; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);">${code}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; background: linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(251, 146, 60, 0.08)); border: 2px solid rgba(251, 191, 36, 0.3); border-radius: 16px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="40" valign="top">
                          <div style="width: 32px; height: 32px; background: rgba(251, 191, 36, 0.25); border-radius: 50%; text-align: center; line-height: 32px;">
                            <span style="font-size: 20px;">⏰</span>
                          </div>
                        </td>
                        <td style="padding-left: 16px;">
                          <p style="margin: 0; font-size: 15px; line-height: 22px; color: #fcd34d;">
                            <strong style="font-weight: 800;">⚡ Pomembno:</strong> Ta koda velja samo <strong style="color: #fbbf24; background: rgba(251, 191, 36, 0.15); padding: 2px 8px; border-radius: 6px;">15 minut</strong>. Če kode ne vnesete v tem času, lahko zahtevate novo.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Instructions -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 36px; background: rgba(139, 92, 246, 0.08); border-radius: 16px; padding: 24px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 18px; font-size: 16px; font-weight: 700; color: #ffffff;">📱 Kako potrditi e-naslov:</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid rgba(139, 92, 246, 0.15);">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="36" valign="top">
                                <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); border-radius: 50%; text-align: center; line-height: 28px; font-weight: 800; color: #ffffff; font-size: 13px;">1</div>
                              </td>
                              <td style="padding-left: 14px;">
                                <p style="margin: 0; font-size: 14px; line-height: 22px; color: #cbd5e1;">Odprite aplikacijo <strong style="color: #c4b5fd;">Pr'Hran 🛒</strong></p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid rgba(139, 92, 246, 0.15);">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="36" valign="top">
                                <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); border-radius: 50%; text-align: center; line-height: 28px; font-weight: 800; color: #ffffff; font-size: 13px;">2</div>
                              </td>
                              <td style="padding-left: 14px;">
                                <p style="margin: 0; font-size: 14px; line-height: 22px; color: #cbd5e1;">Vnesite zgornjo <strong style="color: #c4b5fd;">6-mestno kodo 🔑</strong></p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="36" valign="top">
                                <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); border-radius: 50%; text-align: center; line-height: 28px; font-weight: 800; color: #ffffff; font-size: 13px;">3</div>
                              </td>
                              <td style="padding-left: 14px;">
                                <p style="margin: 0; font-size: 14px; line-height: 22px; color: #cbd5e1;">Kliknite <strong style="color: #c4b5fd;">"Potrdi kodo" ✅</strong></p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
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
            <td style="padding: 36px 32px;">
              <p style="margin: 0 0 16px; font-size: 13px; line-height: 20px; color: #9ca3af; text-align: center;">
                🔒 Če niste zahtevali te potrditve, lahko to sporočilo ignorirate.
              </p>
              <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280; text-align: center;">
                © ${new Date().getFullYear()} <strong style="color: #a78bfa;">Pr'Hran</strong>
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
