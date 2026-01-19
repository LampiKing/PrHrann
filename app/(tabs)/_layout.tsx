import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet, Platform } from "react-native";
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
          tabBarActiveTintColor: "#c084fc",
          tabBarInactiveTintColor: "#64748b",
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
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <Ionicons name={focused ? "search" : "search-outline"} size={26} color={color} />
              </View>
            ),
            tabBarLabel: ({ focused, color }) => (
              <Text style={[styles.tabBarLabel, focused && styles.tabBarLabelActive, { color }]}>
                Iskanje
              </Text>
            ),
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: "Seznam",
            href: isGuest ? null : undefined,
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <Ionicons name={focused ? "bag" : "bag-outline"} size={26} color={color} />
              </View>
            ),
            tabBarLabel: ({ focused, color }) => (
              <Text style={[styles.tabBarLabel, focused && styles.tabBarLabelActive, { color }]}>
                Seznam
              </Text>
            ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: "Lestvica",
            href: isGuest ? null : undefined,
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <Ionicons name={focused ? "trophy" : "trophy-outline"} size={26} color={color} />
              </View>
            ),
            tabBarLabel: ({ focused, color }) => (
              <Text style={[styles.tabBarLabel, focused && styles.tabBarLabelActive, { color }]}>
                Lestvica
              </Text>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
            href: isGuest ? null : undefined,
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <Ionicons name={focused ? "person" : "person-outline"} size={26} color={color} />
              </View>
            ),
            tabBarLabel: ({ focused, color }) => (
              <Text style={[styles.tabBarLabel, focused && styles.tabBarLabelActive, { color }]}>
                Profil
              </Text>
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
    borderTopWidth: 1,
    borderTopColor: "rgba(139, 92, 246, 0.4)",
    height: Platform.select({
      ios: 90,
      android: 75,
      web: 70,
      default: 75,
    }),
    paddingBottom: Platform.select({
      ios: 28,
      android: 12,
      web: 10,
      default: 12,
    }),
    paddingTop: 10,
    elevation: 20,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  tabBarLabel: {
    fontSize: Platform.select({
      ios: 11,
      android: 11,
      web: 10,
      default: 11,
    }),
    fontWeight: "600",
    marginTop: 4,
    letterSpacing: 0.3,
  },
  tabBarLabelActive: {
    fontWeight: "700",
    fontSize: Platform.select({
      ios: 11,
      android: 11,
      web: 10,
      default: 11,
    }),
  },
  tabBarItem: {
    paddingTop: 4,
    paddingVertical: Platform.OS === "web" ? 6 : 4,
  },
  activeIconContainer: {
    backgroundColor: "rgba(192, 132, 252, 0.15)",
    borderRadius: 16,
    padding: 6,
    marginBottom: -2,
  },
});

