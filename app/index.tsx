import { View, StyleSheet } from "react-native";
import Logo from "../lib/Logo";
import { useConvexAuth } from "convex/react";
import { Redirect } from "expo-router";

export default function Index() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Logo size={90} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/auth" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a12",
  },
});
