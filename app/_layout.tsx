import { useEffect } from "react";
import { ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Asset } from "expo-asset";
import { getSeasonalLogoSource } from "@/lib/Logo";

const rawConvexUrl =
  process.env.EXPO_PUBLIC_CONVEX_URL || process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
const convexUrl = rawConvexUrl
  ? rawConvexUrl.replace(".convex.site", ".convex.cloud")
  : undefined;

const convexClient = convexUrl
  ? new ConvexReactClient(convexUrl, {
      unsavedChangesWarning: false,
    })
  : null;

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const updateFavicon = async () => {
      if (typeof document === "undefined") return;
      const source = getSeasonalLogoSource(new Date());
      const asset = Asset.fromModule(source);

      if (!asset.uri) {
        try {
          await asset.downloadAsync();
        } catch {
          return;
        }
      }

      const uri = asset.uri || asset.localUri;
      if (!uri) return;

      const links = document.querySelectorAll("link[rel*='icon']");
      if (links.length === 0) {
        const link = document.createElement("link");
        link.rel = "icon";
        link.href = uri;
        document.head.appendChild(link);
        return;
      }

      links.forEach((link) => link.setAttribute("href", uri));
    };

    updateFavicon();
    const interval = setInterval(() => {
      void updateFavicon();
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!convexClient) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.missingConfig}>
          <Text style={styles.missingTitle}>Missing Convex URL</Text>
          <Text style={styles.missingText}>
            Set EXPO_PUBLIC_CONVEX_URL in your environment.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ConvexBetterAuthProvider client={convexClient} authClient={authClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
      </ConvexBetterAuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  missingConfig: {
    flex: 1,
    backgroundColor: "#0f0a1e",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  missingText: {
    fontSize: 13,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 18,
  },
});
