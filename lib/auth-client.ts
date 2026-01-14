import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const normalizeUrl = (value?: string) => value?.trim().replace(/\/$/, "");
const rawSiteUrl = normalizeUrl(process.env.EXPO_PUBLIC_CONVEX_SITE_URL);
const rawCloudUrl = normalizeUrl(process.env.EXPO_PUBLIC_CONVEX_URL);
const authBaseUrl = rawSiteUrl || rawCloudUrl;
const normalizedAuthBaseUrl = authBaseUrl
    ? authBaseUrl.replace(".convex.cloud", ".convex.site")
    : undefined;

const DEFAULT_CONVEX_SITE_URL = "https://vibrant-dolphin-871.convex.site";
const isLocalUrl = (value?: string) =>
    Boolean(value && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(value));

const resolvedAuthBaseUrl = (() => {
    const candidate = normalizedAuthBaseUrl || DEFAULT_CONVEX_SITE_URL;

    // If deployed on a real domain, ignore localhost/127.* base URLs baked into the bundle.
    if (typeof window === "undefined") return candidate;
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    if (!isLocalHost && isLocalUrl(candidate)) return DEFAULT_CONVEX_SITE_URL;
    return candidate;
})();

// Site URL for cross-domain authentication
const siteUrl = normalizeUrl(process.env.EXPO_PUBLIC_SITE_URL) || "https://www.prhran.com";

if (!resolvedAuthBaseUrl) {
    console.warn("Missing Convex auth URL. Set EXPO_PUBLIC_CONVEX_SITE_URL.");
}

export const authClient = createAuthClient({
    baseURL: resolvedAuthBaseUrl,
    // Add fetch options to handle CORS properly
    fetchOptions: {
        credentials: "include",
    },
    plugins: [
        anonymousClient(),
        ...(Platform.OS === "web"
            ? [crossDomainClient({ siteURL: siteUrl })]
            : [
                  expoClient({
                      scheme: Constants.expoConfig?.scheme as string,
                      storagePrefix: Constants.expoConfig?.scheme as string,
                      storage: SecureStore,
                  }),
              ]),
        convexClient(),
    ],
});
