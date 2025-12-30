import { useState } from "react";
import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal } from "react-native";
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
  const [showInfoModal, setShowInfoModal] = useState(false);
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
            Registracija odklene lestvico, Košarico in Profil ter še 2 iskanji danes.
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
  const leaderboardEntries = leaderboard?.entries ?? [];
  const topThree = leaderboardEntries.slice(0, 3);
  const restEntries = leaderboardEntries.slice(3);
  const podiumSlots = [
    {
      rank: 2,
      entry: topThree[1],
      colors: ["rgba(148, 163, 184, 0.22)", "rgba(15, 23, 42, 0.7)"],
      accent: "#e2e8f0",
      icon: "ribbon",
      stepStyle: styles.podiumStepSecond,
    },
    {
      rank: 1,
      entry: topThree[0],
      colors: ["rgba(251, 191, 36, 0.3)", "rgba(120, 53, 15, 0.6)"],
      accent: "#fbbf24",
      icon: "trophy",
      stepStyle: styles.podiumStepFirst,
    },
    {
      rank: 3,
      entry: topThree[2],
      colors: ["rgba(217, 119, 6, 0.25)", "rgba(67, 20, 7, 0.65)"],
      accent: "#f59e0b",
      icon: "ribbon",
      stepStyle: styles.podiumStepThird,
    },
  ];

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

        <LinearGradient
          colors={["rgba(16, 185, 129, 0.22)", "rgba(15, 23, 42, 0.65)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryCard}
        >
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryPill}>
              <Ionicons name="sparkles" size={14} color="#a7f3d0" />
              <Text style={styles.summaryPillText}>
                Sezona {summary?.year ?? new Date().getFullYear()}
              </Text>
            </View>
            <View style={styles.summaryDeadlinePill}>
              <Ionicons name="time" size={14} color="#fcd34d" />
              <Text style={styles.summaryDeadlineText}>Do 24. decembra ob 17:00</Text>
            </View>
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => setShowInfoModal(true)}
            >
              <Ionicons name="help-circle-outline" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
          <View style={styles.summaryMainRow}>
            <View style={styles.summarySavingsBlock}>
              <Text style={styles.summaryTitle}>Prihranil si letos</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary?.savings ?? 0)}</Text>
              <Text style={styles.summaryNote}>Prihranek iz potrjenih računov</Text>
            </View>
            <View style={styles.summaryRankBlock}>
              <Text style={styles.summaryRankLabel}>Tvoje mesto</Text>
              <Text style={styles.summaryRankValue}>
                {summary?.rank ? `#${summary.rank}` : "--"}
              </Text>
              <View style={styles.summaryRankBadge}>
                <Ionicons name="trophy" size={14} color="#fbbf24" />
                <Text style={styles.summaryRankBadgeText}>Lestvica</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.updateHint}>
          <Ionicons name="refresh" size={14} color="#94a3b8" />
          <Text style={styles.updateHintText}>Lestvica se osvežuje vsakih 10 minut.</Text>
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

        <View style={styles.podiumCard}>
          <Text style={styles.podiumTitle}>Top 3 varčevalci</Text>
          <View style={styles.podiumRow}>
            {podiumSlots.map((slot) => {
              const isEmpty = !slot.entry;
              return (
                <View key={slot.rank} style={styles.podiumColumn}>
                  <View
                    style={[
                      styles.podiumAvatar,
                      isEmpty && styles.podiumAvatarEmpty,
                      { borderColor: slot.accent },
                    ]}
                  >
                    <Ionicons name={slot.icon} size={18} color={slot.accent} />
                  </View>
                  <Text style={[styles.podiumName, isEmpty && styles.podiumNameEmpty]}>
                    {slot.entry?.nickname ?? "Bodi prvi!"}
                  </Text>
                  <Text style={[styles.podiumSavings, isEmpty && styles.podiumSavingsEmpty]}>
                    {formatCurrency(slot.entry?.savings ?? 0)}
                  </Text>
                  <LinearGradient
                    colors={slot.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[styles.podiumStepBlock, slot.stepStyle]}
                  >
                    <Text style={[styles.podiumStepNumber, { color: slot.accent }]}>
                      {slot.rank}
                    </Text>
                  </LinearGradient>
                </View>
              );
            })}
          </View>
          <View style={styles.podiumBaseLine} />
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Top 100 varčevalci</Text>
          {restEntries.length ? (
            restEntries.map((entry) => (
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

      <Modal
        transparent
        visible={showInfoModal}
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.infoOverlay}>
          <LinearGradient
            colors={["rgba(15, 10, 30, 0.98)", "rgba(30, 17, 55, 0.98)"]}
            style={styles.infoCard}
          >
            <View style={styles.infoHeader}>
              <Ionicons name="help-circle" size={28} color="#fbbf24" />
              <Text style={styles.infoTitle}>Kako deluje lestvica?</Text>
            </View>
            <Text style={styles.infoText}>
              Lestvica temelji izključno na potrjenih računih. Košarica ne vpliva na
              prihranek ali uvrstitev. Osvežitev poteka vsakih 10 minut.
            </Text>
            <TouchableOpacity
              style={styles.infoCloseButton}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.infoCloseText}>Razumem</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    marginBottom: 16,
    overflow: "hidden",
  },
  summaryTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
  },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  summaryPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#a7f3d0",
    letterSpacing: 0.3,
  },
  summaryDeadlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  summaryDeadlineText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fde68a",
  },
  summaryMainRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  summarySavingsBlock: {
    flex: 1,
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
  summaryNote: {
    fontSize: 11,
    color: "rgba(226, 232, 240, 0.7)",
  },
  summaryRankBlock: {
    alignItems: "flex-end",
  },
  summaryRankLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
  },
  summaryRankValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fbbf24",
  },
  summaryRankBadge: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.35)",
  },
  summaryRankBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fde68a",
    letterSpacing: 0.4,
  },
  updateHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 18,
    alignSelf: "center",
  },
  updateHintText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
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
  podiumCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    marginBottom: 16,
  },
  podiumTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
  podiumRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  podiumColumn: {
    width: "31%",
    alignItems: "center",
    gap: 8,
  },
  podiumAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderWidth: 1.5,
  },
  podiumAvatarEmpty: {
    backgroundColor: "rgba(148, 163, 184, 0.1)",
  },
  podiumNameEmpty: {
    color: "#94a3b8",
  },
  podiumSavingsEmpty: {
    color: "rgba(148, 163, 184, 0.7)",
  },
  podiumStepBlock: {
    width: "100%",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  podiumStepNumber: {
    fontSize: 28,
    fontWeight: "900",
  },
  podiumStepFirst: {
    height: 170,
  },
  podiumStepSecond: {
    height: 140,
  },
  podiumStepThird: {
    height: 120,
  },
  podiumName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  podiumSavings: {
    fontSize: 11,
    color: "#e2e8f0",
  },
  podiumBaseLine: {
    marginTop: 12,
    height: 2,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.25)",
  },
  listCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#e9d5ff",
    marginBottom: 12,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: "rgba(30, 41, 59, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.18)",
  },
  rankBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(139, 92, 246, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 13,
    fontWeight: "800",
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
    color: "#ddd6fe",
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
  infoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  infoCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.35)",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  infoText: {
    fontSize: 13,
    color: "#d1d5db",
    lineHeight: 20,
  },
  infoCloseButton: {
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#8b5cf6",
    alignItems: "center",
  },
  infoCloseText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});

