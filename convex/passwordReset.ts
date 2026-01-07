import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal, components } from "./_generated/api";
import bcrypt from "bcryptjs";

const fromEmail = process.env.FROM_EMAIL;
const fromName = process.env.FROM_NAME || "Pr'Hran";
const resendApiKey = process.env.RESEND_API_KEY;

async function sendEmail(to: string, subject: string, html: string) {
    console.log(`[sendEmail] Attempting to send email to: ${to}`);
    console.log(`[sendEmail] FROM_EMAIL configured: ${!!fromEmail}`);
    console.log(`[sendEmail] RESEND_API_KEY configured: ${!!resendApiKey}`);
    
    if (!fromEmail || !resendApiKey) {
        console.error("[sendEmail] Email not configured - FROM_EMAIL or RESEND_API_KEY missing!");
        console.error(`[sendEmail] FROM_EMAIL: ${fromEmail ? 'SET' : 'MISSING'}`);
        console.error(`[sendEmail] RESEND_API_KEY: ${resendApiKey ? 'SET' : 'MISSING'}`);
        return false;
    }
    
    try {
        console.log(`[sendEmail] Sending via Resend API from: ${fromName} <${fromEmail}>`);
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: `${fromName} <${fromEmail}>`,
                to,
                subject,
                html,
            }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[sendEmail] Resend API error: ${response.status} ${errorText}`);
            return false;
        }
        
        const result = await response.json();
        console.log(`[sendEmail] SUCCESS! Email sent to: ${to}, ID: ${result.id}`);
        return true;
    } catch (error) {
        console.error("[sendEmail] Exception:", error);
        return false;
    }
}

function generateResetToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

// Internal query to find user by email
export const findUserByEmail = internalQuery({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        // Search in userProfiles table
        const profile = await ctx.db
            .query("userProfiles")
            .filter((q) => q.eq(q.field("email"), args.email))
            .first();
        
        return profile;
    },
});

// Internal mutation to store reset token
export const storeResetToken = internalMutation({
    args: {
        email: v.string(),
        token: v.string(),
        expiresAt: v.number(),
    },
    handler: async (ctx, args) => {
        // Check if there's an existing token for this email and delete it
        const existing = await ctx.db
            .query("passwordResetTokens")
            .withIndex("by_email", (q) => q.eq("email", args.email))
            .first();
        
        if (existing) {
            await ctx.db.delete(existing._id);
        }
        
        // Store new token
        await ctx.db.insert("passwordResetTokens", {
            email: args.email,
            token: args.token,
            expiresAt: args.expiresAt,
            used: false,
        });
    },
});

export const requestPasswordReset = action({
    args: {
        email: v.string(),
        redirectTo: v.string(),
    },
    returns: v.object({
        success: v.boolean(),
        message: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
        console.log(`[requestPasswordReset] Starting for email: ${args.email}`);
        console.log(`[requestPasswordReset] Redirect URL: ${args.redirectTo}`);
        
        const email = args.email.toLowerCase().trim();
        
        if (!email || !email.includes('@')) {
            console.log(`[requestPasswordReset] Invalid email format`);
            return { success: false, message: "Neveljaven e-naslov" };
        }
        
        // Find user by email
        console.log(`[requestPasswordReset] Looking for user with email: ${email}`);
        const user = await ctx.runQuery(internal.passwordReset.findUserByEmail, { email });
        
        // Always return success for security (don't reveal if email exists)
        if (!user) {
            console.log(`[requestPasswordReset] User not found for email: ${email}`);
            return { success: true };
        }
        
        console.log(`[requestPasswordReset] User found! userId: ${user.userId}`);
        
        // Generate reset token
        const token = generateResetToken();
        const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
        
        console.log(`[requestPasswordReset] Generated token, storing...`);
        
        // Store token
        await ctx.runMutation(internal.passwordReset.storeResetToken, {
            email,
            token,
            expiresAt,
        });
        
        // Build reset URL
        const resetUrl = `${args.redirectTo}?token=${token}&email=${encodeURIComponent(email)}`;
        
        // Send email
        const subject = "🔐 Ponastavitev gesla - Pr'Hran";
        const html = `
<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ponastavitev gesla</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0a0a12 0%, #1a0a2e 50%, #0f0a1e 100%); min-height: 100vh;">
  <table width="100%" cellpadding="0" cellspacing="0" style="min-height: 100vh; background: linear-gradient(135deg, #0a0a12 0%, #1a0a2e 50%, #0f0a1e 100%);">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main Container -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: rgba(15, 23, 42, 0.95); border-radius: 24px; border: 1px solid rgba(139, 92, 246, 0.4); box-shadow: 0 20px 60px rgba(139, 92, 246, 0.3);">

          <!-- Logo & Header -->
          <tr>
            <td align="center" style="padding: 48px 32px 24px;">
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td>
                    <div style="width: 100px; height: 100px; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #6d28d9 100%); border-radius: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 16px 48px rgba(139, 92, 246, 0.5);">
                      <span style="font-size: 56px; font-weight: 900; color: #ffffff; font-family: Arial, sans-serif; line-height: 100px; text-align: center; display: block; width: 100%;">P</span>
                    </div>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 28px 0 12px; font-size: 36px; font-weight: 900; color: #ffffff; letter-spacing: -1px; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);">Pr'Hran</h1>
              <p style="margin: 0; font-size: 17px; color: #e5e7eb; font-weight: 600; letter-spacing: 0.5px;">Nakupuj <strong style="color: #fbbf24;">pametno</strong></p>
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
              <h2 style="margin: 0 0 16px; font-size: 28px; font-weight: 800; color: #ffffff; text-align: center; line-height: 1.2;">🔐 Ponastavitev gesla</h2>
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 26px; color: #cbd5e1; text-align: center;">Prejeli smo zahtevo za ponastavitev gesla za vaš račun.<br/>Kliknite spodnji gumb za nadaljevanje.</p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0 32px;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); color: #ffffff; padding: 18px 48px; border-radius: 16px; text-decoration: none; font-weight: 700; font-size: 18px; box-shadow: 0 12px 40px rgba(139, 92, 246, 0.5), 0 0 0 4px rgba(139, 92, 246, 0.1); letter-spacing: 0.5px;">
                      🔑 Ponastavi geslo
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(139, 92, 246, 0.1); border-radius: 16px; border: 1px solid rgba(139, 92, 246, 0.2);">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; font-size: 14px; color: #a78bfa; font-weight: 600;">⏰ Pomembno:</p>
                    <ul style="margin: 0; padding: 0 0 0 20px; color: #cbd5e1; font-size: 14px; line-height: 24px;">
                      <li>Povezava velja <strong style="color: #a855f7;">1 uro</strong></li>
                      <li>Geslo mora imeti vsaj <strong style="color: #a855f7;">8 znakov</strong></li>
                      <li>Če niste zahtevali ponastavitve, ignorirajte to sporočilo</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Alternative Link -->
              <p style="margin: 24px 0 8px; font-size: 13px; color: #6b7280; text-align: center;">Če gumb ne deluje, kopirajte to povezavo:</p>
              <p style="margin: 0; font-size: 12px; color: #a78bfa; text-align: center; word-break: break-all; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px;">${resetUrl}</p>
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
            <td style="padding: 32px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #9ca3af;">Lep pozdrav,</p>
              <p style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #ffffff;">Ekipa Pr'Hran 💜</p>
              <p style="margin: 0; font-size: 12px; color: #6b7280;">© ${new Date().getFullYear()} Pr'Hran • Izdelano z ❤️ v Sloveniji 🇸🇮</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `;
        
        console.log(`[requestPasswordReset] Sending email to: ${email}`);
        const emailSent = await sendEmail(email, subject, html);
        console.log(`[requestPasswordReset] Email sent result: ${emailSent}`);
        
        return { success: true };
    },
});

// Internal query to validate token
export const validateResetToken = internalQuery({
    args: {
        token: v.string(),
        email: v.string(),
    },
    handler: async (ctx, args) => {
        const tokenRecord = await ctx.db
            .query("passwordResetTokens")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();
        
        if (!tokenRecord) {
            return { valid: false, error: "Neveljavna povezava" };
        }
        
        if (tokenRecord.email.toLowerCase() !== args.email.toLowerCase()) {
            return { valid: false, error: "Neveljavna povezava" };
        }
        
        if (tokenRecord.used) {
            return { valid: false, error: "Povezava je že bila uporabljena" };
        }
        
        if (Date.now() > tokenRecord.expiresAt) {
            return { valid: false, error: "Povezava je potekla" };
        }
        
        return { valid: true };
    },
});

// Internal mutation to mark token as used
export const markTokenAsUsed = internalMutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const tokenRecord = await ctx.db
            .query("passwordResetTokens")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();
        
        if (tokenRecord) {
            await ctx.db.patch(tokenRecord._id, { used: true });
        }
    },
});

// Public query to check if token is valid (for UI)
export const checkResetToken = action({
    args: {
        token: v.string(),
        email: v.string(),
    },
    returns: v.object({
        valid: v.boolean(),
        error: v.optional(v.string()),
    }),
    handler: async (ctx, args): Promise<{ valid: boolean; error?: string }> => {
        const result = await ctx.runQuery(internal.passwordReset.validateResetToken, {
            token: args.token,
            email: args.email,
        });
        return { valid: result.valid, error: result.error };
    },
});

// Reset password action - updates password in better-auth database
export const resetPassword = action({
    args: {
        token: v.string(),
        email: v.string(),
        newPassword: v.string(),
    },
    returns: v.object({
        success: v.boolean(),
        error: v.optional(v.string()),
    }),
    handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
        // Validate token
        const validation = await ctx.runQuery(internal.passwordReset.validateResetToken, {
            token: args.token,
            email: args.email,
        }) as { valid: boolean; error?: string };
        
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }
        
        // Validate password
        if (args.newPassword.length < 8) {
            return { success: false, error: "Geslo mora imeti vsaj 8 znakov" };
        }
        
        try {
            // Hash password using bcrypt (same as better-auth)
            const hashedPassword = await bcrypt.hash(args.newPassword, 10);
            
            // Find user by email to get userId
            const profile = await ctx.runQuery(internal.passwordReset.findUserByEmail, {
                email: args.email,
            });
            
            if (!profile) {
                return { success: false, error: "Uporabnik ni najden" };
            }
            
            // Update password in better-auth account table using updateOne
            await ctx.runMutation(components.betterAuth.adapter.updateOne, {
                input: {
                    model: "account",
                    update: {
                        password: hashedPassword,
                        updatedAt: Date.now(),
                    },
                    where: [
                        {
                            field: "userId",
                            operator: "eq",
                            value: profile.userId,
                        },
                        {
                            field: "providerId",
                            operator: "eq",
                            value: "credential",
                            connector: "AND",
                        },
                    ],
                },
            });
            
            // Mark token as used
            await ctx.runMutation(internal.passwordReset.markTokenAsUsed, {
                token: args.token,
            });
            
            console.log(`Password reset successful for: ${args.email}`);
            return { success: true };
        } catch (error) {
            console.error("Password reset error:", error);
            return { success: false, error: "Napaka pri ponastavitvi gesla" };
        }
    },
});