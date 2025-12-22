import { ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ConvexBetterAuthProvider client={convex} authClient={authClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </ConvexBetterAuthProvider>
    </SafeAreaProvider>
  );
}
