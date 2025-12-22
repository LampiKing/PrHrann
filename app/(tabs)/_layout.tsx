import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  
  // Only query stores when authenticated
  const stores = useQuery(
    api.stores.getAll,
    isAuthenticated ? {} : "skip"
  );
  const seedStores = useMutation(api.stores.seedStores);
  const seedProducts = useMutation(api.products.seedProducts);
  const seedCoupons = useMutation(api.coupons.seedCoupons);

  useEffect(() => {
    const initializeData = async () => {
      if (isAuthenticated && stores && stores.length === 0) {
        try {
          await seedStores({});
          await seedProducts({});
          await seedCoupons({});
        } catch {
          // Ignoriraj napake pri inicializaciji
        }
      }
    };
    initializeData();
  }, [isAuthenticated, stores, seedStores, seedProducts, seedCoupons]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={["#0a0a0f", "#1a1025", "#0a0a0f"]}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  // Redirect to auth if not authenticated
  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
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
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
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
    height: Platform.OS === "ios" ? 88 : 64,
    paddingBottom: Platform.OS === "ios" ? 28 : 8,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  tabBarItem: {
    paddingTop: 4,
  },
});
