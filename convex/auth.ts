import { AuthFunctions, createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { components, internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { anonymous, multiSession } from "better-auth/plugins";
import authConfig from "./auth.config";

const authFunctions: AuthFunctions = internal.auth;

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth, {
    authFunctions,
    triggers: {
        user: {
            onCreate: async (ctx, user) => {
                const now = Date.now();
                const nickname = user.name ? user.name.trim() : undefined;
                const nicknameLower = nickname ? nickname.toLowerCase() : undefined;
                await ctx.db.insert("userProfiles", {
                    userId: user._id,
                    name: user.name || undefined,
                    nickname,
                    nicknameLower,
                    nicknameUpdatedAt: nickname ? now : undefined,
                    nicknameChangeAvailableAt: nickname
                        ? now + 30 * 24 * 60 * 60 * 1000
                        : undefined,
                    email: user.email || undefined,
                    emailVerified: user.emailVerified || false,
                    isAnonymous: user.isAnonymous ?? false,
                    isPremium: false,
                    dailySearches: 0,
                    lastSearchDate: new Date().toISOString().split("T")[0],
                });
            },
        },
    },
});

// export the trigger API functions so that triggers work
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

const rawSiteUrl =
    process.env.SITE_URL ||
    process.env.EXPO_PUBLIC_SITE_URL ||
    process.env.EXPO_PUBLIC_CONVEX_SITE_URL ||
    "https://vibrant-dolphin-871.convex.site";
const siteUrl = rawSiteUrl.includes(".convex.cloud")
    ? rawSiteUrl.replace(".convex.cloud", ".convex.site")
    : rawSiteUrl;
const isDev = process.env.NODE_ENV !== "production";
const localhostOrigins = isDev
    ? [
          ...Array.from({ length: 100 }, (_, i) => `http://localhost:${8000 + i}`),
          ...Array.from({ length: 100 }, (_, i) => `http://127.0.0.1:${8000 + i}`),
          ...Array.from({ length: 100 }, (_, i) => `http://localhost:${19000 + i}`),
          ...Array.from({ length: 100 }, (_, i) => `http://127.0.0.1:${19000 + i}`),
          "http://localhost:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
      ]
    : [];
const corsOrigins = isDev ? [siteUrl, ...localhostOrigins] : [siteUrl];
const fromEmail = process.env.FROM_EMAIL;
const fromName = process.env.FROM_NAME || "PrHran";
const resendApiKey = process.env.RESEND_API_KEY;

async function sendEmail(to: string, subject: string, html: string) {
    if (!fromEmail) {
        console.warn("Email disabled or FROM_EMAIL not set. Skipping send.");
        return;
    }
    if (!resendApiKey) {
        console.warn("RESEND_API_KEY not set. Skipping email send.");
        return;
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
        }
    } catch (error) {
        console.error("Email send error:", error);
    }
}

export const createAuth = (
    ctx: GenericCtx<DataModel>,
    { optionsOnly } = { optionsOnly: false }
) => {
    const config: any = {
        // disable logging when createAuth is called just to generate options.
        // this is not required, but there's a lot of noise in logs without it.
        logger: {
            disabled: optionsOnly,
        },
        secret: process.env.BETTER_AUTH_SECRET!,
        trustedOrigins: [siteUrl, "myapp://", ...localhostOrigins],
        database: authComponent.adapter(ctx),
        emailAndPassword: {
            enabled: true,
            // Enable immediate login to avoid blocking on email verification
            requireEmailVerification: true,
            sendVerificationOnSignUp: true,
            autoSignInAfterVerification: true,
            sendVerificationEmail: async ({ user, url, token }: any) => {
                const subject = "Potrdi svoj e-naslov";
                const html = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
                      <h2 style="margin: 0 0 12px;">Pozdravljeni!</h2>
                      <p style="margin: 0 0 12px;">Kliknite spodaj, da potrdite svoj e-naslov:</p>
                      <p style="margin: 0 0 16px;"><a href="${url}" style="color: #7c3aed; font-weight: 700;">Potrdi e-naslov</a></p>
                      <p style="margin: 0 0 8px;">Če gumb ne deluje, kopirajte povezavo:</p>
                      <p style="word-break: break-all; color: #0f172a;">${url}</p>
                      <p style="margin-top: 16px; color: #475569; font-size: 12px;">Če niste zahtevali tega sporočila, ga lahko ignorirate.</p>
                    </div>
                `;

                await sendEmail(user.email, subject, html);
                if (process.env.NODE_ENV !== "production") {
                    console.log(`Email verification link for ${user.email}: ${url}`);
                }
            },
            sendResetPassword: async ({ user, url, token }: any) => {
                const subject = "Ponastavi geslo";
                const html = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
                      <h2 style="margin: 0 0 12px;">Pozdravljeni!</h2>
                      <p style="margin: 0 0 12px;">Za ponastavitev gesla kliknite spodaj:</p>
                      <p style="margin: 0 0 16px;"><a href="${url}" style="color: #7c3aed; font-weight: 700;">Ponastavi geslo</a></p>
                      <p style="margin: 0 0 8px;">Če gumb ne deluje, kopirajte povezavo:</p>
                      <p style="word-break: break-all; color: #0f172a;">${url}</p>
                      <p style="margin-top: 16px; color: #475569; font-size: 12px;">Če niste zahtevali tega sporočila, ga lahko ignorirate.</p>
                    </div>
                `;

                await sendEmail(user.email, subject, html);
                if (process.env.NODE_ENV !== "production") {
                    console.log(`Password reset link for ${user.email}: ${url}`);
                }
            },
        },
        // Session settings - track IP and device
        session: {
            updateAge: 1000 * 60 * 5, // Update session every 5 minutes
            expiresIn: 60 * 60 * 24 * 7, // 7 days
            cookieCache: {
                enabled: true,
                maxAge: 5 * 60, // 5 minutes
            },
        },
        // Security settings
        rateLimit: {
            enabled: true,
            window: 60, // 1 minute window
            max: 10, // Max 10 requests per minute per IP
        },
        advanced: {
            crossSubDomainCookies: {
                enabled: false,
            },
            disableCSRFCheck: true,
        },
        cors: {
            origin: corsOrigins,
            credentials: true,
        },
        plugins: [
            // The Expo and Convex plugins are required
            anonymous(),
            expo(),
            convex({ authConfig }),
            crossDomain({ siteUrl }),
            // Multi-session management - max 2 active sessions per user
            multiSession({
                maximumSessions: 2,
            }),
        ],
    };
    
    // Only add social providers if credentials are configured
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        config.socialProviders = {
            ...config.socialProviders,
            google: {
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
        };
    }
    
    // Apple provider intentionally disabled to keep only Google sign-in
    
    return betterAuth(config);
};
