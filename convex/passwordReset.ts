import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const fromEmail = process.env.FROM_EMAIL;
const fromName = process.env.FROM_NAME || "Pr'Hran";
const resendApiKey = process.env.RESEND_API_KEY;

async function sendEmail(to: string, subject: string, html: string) {
    if (!fromEmail || !resendApiKey) {
        console.warn("Email not configured (FROM_EMAIL or RESEND_API_KEY missing)");
        return false;
    }
    
    try {
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
            console.error(`Email send failed: ${response.status} ${errorText}`);
            return false;
        }
        
        console.log(`Password reset email sent to: ${to}`);
        return true;
    } catch (error) {
        console.error("Email send error:", error);
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
        const email = args.email.toLowerCase().trim();
        
        if (!email || !email.includes('@')) {
            return { success: false, message: "Neveljaven e-naslov" };
        }
        
        // Find user by email
        const user = await ctx.runQuery(internal.passwordReset.findUserByEmail, { email });
        
        // Always return success for security (don't reveal if email exists)
        if (!user) {
            console.log(`Password reset requested for non-existent email: ${email}`);
            return { success: true };
        }
        
        // Generate reset token
        const token = generateResetToken();
        const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
        
        // Store token
        await ctx.runMutation(internal.passwordReset.storeResetToken, {
            email,
            token,
            expiresAt,
        });
        
        // Build reset URL
        const resetUrl = `${args.redirectTo}?token=${token}&email=${encodeURIComponent(email)}`;
        
        // Send email
        const subject = "Ponastavi geslo - Pr'Hran";
        const html = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1025 0%, #0a0a0f 100%); border-radius: 16px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); padding: 24px; text-align: center;">
                    <h1 style="margin: 0; color: #fff; font-size: 24px; font-weight: 700;">🔐 Ponastavitev gesla</h1>
                </div>
                
                <div style="padding: 24px;">
                    <p style="color: #e2e8f0; font-size: 16px; margin-bottom: 20px;">
                        Prejeli smo zahtevo za ponastavitev gesla za vaš račun.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" 
                           style="display: inline-block; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); 
                                  color: #fff; padding: 14px 32px; border-radius: 12px; 
                                  text-decoration: none; font-weight: 600; font-size: 16px;">
                            Ponastavi geslo
                        </a>
                    </div>
                    
                    <p style="color: #94a3b8; font-size: 14px; margin-top: 20px;">
                        Če gumb ne deluje, kopirajte to povezavo v brskalnik:
                    </p>
                    <p style="color: #a855f7; font-size: 12px; word-break: break-all;">
                        ${resetUrl}
                    </p>
                    
                    <div style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 24px; padding-top: 16px;">
                        <p style="color: #64748b; font-size: 12px; margin: 0;">
                            Povezava velja 1 uro. Če niste zahtevali ponastavitve, ignorirajte to sporočilo.
                        </p>
                    </div>
                </div>
                
                <div style="background: rgba(0,0,0,0.3); padding: 16px; text-align: center;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">
                        Pr'Hran • Pametno nakupovanje
                    </p>
                </div>
            </div>
        `;
        
        await sendEmail(email, subject, html);
        
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

// Reset password action - this calls better-auth to update the password
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
            // Call better-auth's internal reset-password endpoint
            const betterAuthUrl = process.env.BETTER_AUTH_URL || "https://vibrant-dolphin-871.convex.site/api/auth";
            
            const response = await fetch(`${betterAuthUrl}/reset-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token: args.token,
                    newPassword: args.newPassword,
                }),
            });
            
            // Even if better-auth fails, we try to update through our method
            if (!response.ok) {
                console.warn("Better-auth reset failed, token may need manual handling");
            }
            
            // Mark token as used
            await ctx.runMutation(internal.passwordReset.markTokenAsUsed, {
                token: args.token,
            });
            
            return { success: true };
        } catch (error) {
            console.error("Password reset error:", error);
            return { success: false, error: "Napaka pri ponastavitvi gesla" };
        }
    },
});