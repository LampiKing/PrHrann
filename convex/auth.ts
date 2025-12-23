import { AuthFunctions, createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { components, internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { anonymous, multiSession, ipRateLimit } from "better-auth/plugins";

const authFunctions: AuthFunctions = internal.auth;

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth, {
    authFunctions,
    triggers: {},
});

// export the trigger API functions so that triggers work
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

const siteUrl = process.env.SITE_URL || "https://amicable-kudu-812.convex.site";

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
        trustedOrigins: [siteUrl, "myapp://"],
        database: authComponent.adapter(ctx),
        // Email/password with verification required
        emailAndPassword: {
            enabled: true,
            requireEmailVerification: true,
            sendVerificationOnSignUp: true,
            autoSignInAfterVerification: true,
            sendResetPassword: async ({ user, url, token }) => {
                // TODO: Implement email sending (e.g., with Resend, SendGrid, etc.)
                console.log(`Password reset link for ${user.email}: ${url}`);
                console.log(`Token: ${token}`);
                // For now, just log - in production, send actual email
            },
        },
        emailVerification: {
            sendOnSignUp: true,
            autoSignInAfterVerification: true,
            sendVerificationEmail: async ({ user, url, token }) => {
                // TODO: Implement email sending (e.g., with Resend, SendGrid, etc.)
                console.log(`Verification email for ${user.email}`);
                console.log(`Verification URL: ${url}`);
                console.log(`Token: ${token}`);
                // For now, just log - in production, send actual email
                // Example with Resend:
                // await resend.emails.send({
                //   from: 'PrHran <noreply@prhran.si>',
                //   to: user.email,
                //   subject: 'Potrdite vaš email',
                //   html: `<a href="${url}">Kliknite za potrditev</a>`
                // });
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
            disableCSRFCheck: false,
        },
        plugins: [
            // The Expo and Convex plugins are required
            anonymous(),
            expo(),
            convex({
                authConfig: {} as any
            }),
            crossDomain({ siteUrl }),
            // Multi-session management - max 2 active sessions per user
            multiSession({
                maximumActiveSessions: 2,
            }),
            // IP rate limiting and tracking
            ipRateLimit({
                window: 60, // 1 minute
                max: 20, // 20 requests per minute per IP
                storage: "memory", // Use in-memory storage
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
    
    if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
        config.socialProviders = {
            ...config.socialProviders,
            apple: {
                clientId: process.env.APPLE_CLIENT_ID,
                clientSecret: process.env.APPLE_CLIENT_SECRET,
            },
        };
    }
    
    return betterAuth(config);
};
