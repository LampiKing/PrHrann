import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getSeasonalLogoSource } from "@/lib/Logo";

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) return "0.00 EUR";
  return value.toFixed(2).replace(".", ",") + " EUR";
};

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(
    api.userProfiles.getProfile,
    isAuthenticated ? {} : "skip"
  );
  const isGuest = profile ? profile.isAnonymous || !profile.email : false;
  const summary = useQuery(
    api.leaderboard.getMySeasonSummary,
    isAuthenticated ? {} : "skip"
  );
  const leaderboard = useQuery(
    api.leaderboard.getLeaderboard,
    isAuthenticated ? { limit: 100 } : "skip"
  );

  if (!isAuthenticated || isGuest) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.guestLock, { paddingTop: insets.top + 40 }]}>
          <View style={styles.guestLogoWrap}>
            <Image source={getSeasonalLogoSource()} style={styles.guestLogo} resizeMode="contain" />
          </View>
          <Text style={styles.guestTitle}>Lestvica je zaklenjena</Text>
          <Text style={styles.guestText}>
            Registracija odklene lestvico, Kosarico in Profil ter se 2 iskanji danes.
          </Text>
          <TouchableOpacity
            style={styles.guestButton}
            onPress={() => router.push({ pathname: "/auth", params: { mode: "register" } })}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#8b5cf6", "#7c3aed"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.guestButtonGradient}
            >
              <Text style={styles.guestButtonText}>Prijava / Registracija</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const leaderboardTypeLabel =
    summary?.leaderboardType === "family" ? "Family lestvica" : "Free + Plus lestvica";

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Ionicons name="trophy" size={38} color="#fbbf24" />
          <Text style={styles.title}>Letna lestvica</Text>
          <Text style={styles.subtitle}>{leaderboardTypeLabel}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Prihranil si letos</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary?.savings ?? 0)}</Text>
          <Text style={styles.summaryRank}>
            Tvoje mesto: {summary?.rank ? `#${summary.rank}` : "--"}
          </Text>
          <Text style={styles.summarySeason}>
            Sezona {summary?.year ?? new Date().getFullYear()} - do 24. decembra ob 17:00
          </Text>
        </View>

        <View style={styles.rewardCard}>
          <Text style={styles.rewardTitle}>Nagrade sezone</Text>
          <View style={styles.rewardRow}>
            <Text style={styles.rewardRank}>1. mesto</Text>
            <Text style={styles.rewardPrize}>Premium 1 leto</Text>
          </View>
          <View style={styles.rewardRow}>
            <Text style={styles.rewardRank}>2. mesto</Text>
            <Text style={styles.rewardPrize}>Premium 6 mesecev</Text>
          </View>
          <View style={styles.rewardRow}>
            <Text style={styles.rewardRank}>3. mesto</Text>
            <Text style={styles.rewardPrize}>Premium 1 mesec</Text>
          </View>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Top varcevalci</Text>
          {leaderboard?.entries.length ? (
            leaderboard.entries.map((entry) => (
              <View key={entry.userId} style={styles.listRow}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{entry.rank}</Text>
                </View>
                <View style={styles.listInfo}>
                  <Text style={styles.listName}>{entry.nickname}</Text>
                  <Text style={styles.listSaving}>{formatCurrency(entry.savings)}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Ni podatkov za lestvico.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0a1e",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
  },
  subtitle: {
    fontSize: 13,
    color: "#a78bfa",
  },
  summaryCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 12,
    color: "#d1fae5",
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#10b981",
    marginBottom: 6,
  },
  summaryRank: {
    fontSize: 14,
    color: "#e5e7eb",
  },
  summarySeason: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 6,
  },
  rewardCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
    marginBottom: 16,
  },
  rewardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fbbf24",
    marginBottom: 10,
  },
  rewardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  rewardRank: {
    fontSize: 13,
    color: "#fff",
  },
  rewardPrize: {
    fontSize: 13,
    color: "#fde68a",
    fontWeight: "600",
  },
  listCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.25)",
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.15)",
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  listSaving: {
    fontSize: 12,
    color: "#c4b5fd",
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
  },
  guestLock: {
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  guestLogoWrap: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  guestLogo: {
    width: 70,
    height: 70,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  guestText: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
  },
  guestButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 6,
  },
  guestButtonGradient: {
    paddingVertical: 14,
    alignItems: "center",
  },
  guestButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
