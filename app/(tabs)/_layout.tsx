import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import Logo from "../../lib/Logo";
import { useQuery, useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef } from "react";
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
  const ensureProfile = useMutation(api.userProfiles.ensureProfile);
  const seedStores = useMutation(api.stores.seedStores);
  const ensureProfileAttemptedRef = useRef(false);
  const seedStoresAttemptedRef = useRef(false);
  const profileLoadStartRef = useRef<number | null>(null);

  // Track when profile loading started
  useEffect(() => {
    if (isAuthenticated && profile === undefined && !profileLoadStartRef.current) {
      profileLoadStartRef.current = Date.now();
    }
    if (profile !== undefined) {
      profileLoadStartRef.current = null;
    }
  }, [isAuthenticated, profile]);

  // Create profile if: profile is null OR loading times out
  useEffect(() => {
    if (!isAuthenticated || ensureProfileAttemptedRef.current) {
      return;
    }

    // Immediate creation if profile is null (doesn't exist)
    if (profile === null) {
      ensureProfileAttemptedRef.current = true;
      ensureProfile({})
        .then(() => {
          ensureProfileAttemptedRef.current = false;
        })
        .catch((error) => {
          console.error("Napaka pri ustvarjanju profila:", error);
          ensureProfileAttemptedRef.current = false;
        });
      return;
    }

    // Timeout fallback: if profile is undefined for too long, try creating
    if (profile === undefined && profileLoadStartRef.current) {
      const timeout = setTimeout(() => {
        if (profile === undefined && !ensureProfileAttemptedRef.current) {
          ensureProfileAttemptedRef.current = true;
          ensureProfile({})
            .then(() => {
              ensureProfileAttemptedRef.current = false;
            })
            .catch((error) => {
              console.error("Napaka pri ustvarjanju profila (timeout):", error);
              ensureProfileAttemptedRef.current = false;
            });
        }
      }, 3000); // 3 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isAuthenticated, profile, ensureProfile]);

  useEffect(() => {
    if (!isAuthenticated || !stores || stores.length > 0 || seedStoresAttemptedRef.current) {
      return;
    }
    seedStoresAttemptedRef.current = true;
    seedStores({})
      .then(() => {
        seedStoresAttemptedRef.current = false;
      })
      .catch((error) => {
        console.error("Napaka pri inicializaciji trgovin:", error);
        seedStoresAttemptedRef.current = false;
      });
  }, [isAuthenticated, stores, seedStores]);

  // Hitro preveri auth state - brez čakanja
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

  // Takoj redirect če ni prijavljen
  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
  }

  // CRITICAL: Block users without verified email (except anonymous/guest)
  if (profile && !profile.isAnonymous && !profile.emailVerified) {
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
            title: "Seznam",
            href: isGuest ? null : undefined,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bag-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: "Tekmovanje",
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
    backgroundColor: "rgba(10, 10, 15, 0.98)",
    borderTopWidth: 2,
    borderTopColor: "rgba(139, 92, 246, 0.3)",
    height: Platform.select({
      ios: 88,
      android: 72,
      web: 65,
      default: 72,
    }),
    paddingBottom: Platform.select({
      ios: 28,
      android: 10,
      web: 8,
      default: 10,
    }),
    paddingTop: 8,
    elevation: 20,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  tabBarLabel: {
    fontSize: Platform.select({
      ios: 12,
      android: 12,
      web: 11,
      default: 12,
    }),
    fontWeight: "600",
    marginTop: Platform.OS === "web" ? 2 : 0,
  },
  tabBarItem: {
    paddingTop: 2,
    paddingVertical: Platform.OS === "web" ? 4 : 2,
  },
});

