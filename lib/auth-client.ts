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

// Site URL for cross-domain authentication
const siteUrl = normalizeUrl(process.env.EXPO_PUBLIC_SITE_URL) || "https://www.prhran.com";

if (!normalizedAuthBaseUrl) {
    console.warn("Missing Convex auth URL. Set EXPO_PUBLIC_CONVEX_SITE_URL.");
}

export const authClient = createAuthClient({
    baseURL: normalizedAuthBaseUrl,
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
