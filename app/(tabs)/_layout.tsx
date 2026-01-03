import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import Logo from "@/lib/Logo";
import { useQuery, useConvexAuth, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  // Check if user is guest (anonymous user)
  const profile = useQuery(
    api.userProfiles.getProfile,
    isAuthenticated ? {} : "skip"
  );

  // Detect guest mode
  const isGuest = profile ? (profile.isAnonymous || !profile.email) : false;

  // Only query stores when authenticated
  const stores = useQuery(
    api.stores.getAll,
    isAuthenticated ? {} : "skip"
  );
  const initializeAllData = useAction(api.stores.initializeAllData);

  useEffect(() => {
    const initializeData = async () => {
      if (isAuthenticated && stores && stores.length === 0) {
        try {
          console.log("Inicializacija podatkov...");
          const result = await initializeAllData({});
          console.log("Podatki inicializirani:", result);
        } catch (error) {
          console.error("Napaka pri inicializaciji:", error);
        }
      }
    };
    initializeData();
  }, [isAuthenticated, stores, initializeAllData]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={["#0a0a0f", "#1a1025", "#0a0a0f"]}
          style={StyleSheet.absoluteFill}
        />
        <Logo size={90} />
      </View>
    );
  }

  // Redirect to auth if not authenticated
  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
  }

  // CRITICAL: Block users without verified email (except anonymous/guest)
  if (profile && !profile.isAnonymous && !profile.emailVerified) {
    console.log("Email not verified in TabsLayout, redirecting to /verify");
    return <Redirect href="/verify" />;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a0f", "#1a1025", "#0a0a0f"]}
        style={StyleSheet.absoluteFill}
      />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: "#a855f7",
          tabBarInactiveTintColor: "#6b7280",
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
          tabBarShowLabel: true,
          tabBarLabelPosition: "below-icon",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Iskanje",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: "Košarica",
            href: isGuest ? null : undefined,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: "Lestvica",
            href: isGuest ? null : undefined,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trophy" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
            href: isGuest ? null : undefined,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0f",
  },
  tabBar: {
    backgroundColor: "rgba(10, 10, 15, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(139, 92, 246, 0.2)",
    height: Platform.OS === "ios" ? 88 : 72,
    paddingBottom: Platform.OS === "ios" ? 28 : 10,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  tabBarItem: {
    paddingTop: 2,
  },
});

