import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getSeasonalLogoSource } from "@/lib/Logo";
import FloatingBackground from "@/lib/FloatingBackground";
import { PLAN_FAMILY, PLAN_PLUS } from "@/lib/branding";

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) return "0.00 EUR";
  return value.toFixed(2).replace(".", ",") + " EUR";
};

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
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
  const awards = useQuery(
    api.awards.getMyAwards,
    isAuthenticated ? {} : "skip"
  );

  // Show loading during auth initialization
  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.guestLock, { paddingTop: insets.top + 40 }]}>
          <View style={styles.guestLogoWrap}>
            <Image source={getSeasonalLogoSource()} style={styles.guestLogo} resizeMode="contain" />
          </View>
          <ActivityIndicator size="large" color="#8b5cf6" style={{ marginTop: 24 }} />
          <Text style={styles.guestText}>Nalaganje lestvice...</Text>
        </View>
      </View>
    );
  }

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
            Registracija odklene lestvico, Košarico in Profil ter še 2 iskanja danes.
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
    summary?.leaderboardType === "family"
      ? `${PLAN_FAMILY} lestvica`
      : `Free + ${PLAN_PLUS} lestvica`;
  const currentYear = new Date().getFullYear();
  const displaySeasonYear = summary?.year && summary.year >= currentYear
    ? summary.year
    : currentYear;
  const leaderboardEntries = leaderboard?.entries ?? [];
  const topThree = leaderboardEntries.slice(0, 3);
  const awardItems = awards ?? [];
  const podiumSlots = [
    {
      rank: 2,
      entry: topThree[1],
      colors: ["rgba(148, 163, 184, 0.22)", "rgba(15, 23, 42, 0.7)"] as const,
      accent: "#e2e8f0",
      icon: "ribbon" as const,
      stepStyle: styles.podiumStepSecond,
    },
    {
      rank: 1,
      entry: topThree[0],
      colors: ["rgba(251, 191, 36, 0.3)", "rgba(120, 53, 15, 0.6)"] as const,
      accent: "#fbbf24",
      icon: "trophy" as const,
      stepStyle: styles.podiumStepFirst,
    },
    {
      rank: 3,
      entry: topThree[2],
      colors: ["rgba(217, 119, 6, 0.25)", "rgba(67, 20, 7, 0.65)"] as const,
      accent: "#f59e0b",
      icon: "ribbon" as const,
      stepStyle: styles.podiumStepThird,
    },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
      <FloatingBackground variant="sparse" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.trophyContainer}>
            <View style={styles.trophyGlow} />
            <Ionicons name="trophy" size={42} color="#fbbf24" />
          </View>
          <Text style={styles.title}>Letna Lestvica {displaySeasonYear} 🏆</Text>
          <Text style={styles.subtitle}>{leaderboardTypeLabel}</Text>
          <Text style={styles.motivationalText}>
            Vsak prihranek šteje! 💪 Skupaj varčujemo pametno! ✨
          </Text>
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
                Sezona {displaySeasonYear}
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

        <View style={styles.podiumCard}>
          <View style={styles.rewardHeader}>
            <Text style={styles.rewardTitle}>🎁 Nagrade</Text>
            <Text style={styles.rewardSubtitle}>Za najboljše varčevalce! 🌟</Text>
          </View>
          <View style={styles.rewardRow}>
            <Text style={styles.rewardRank}>🥇 1. mesto</Text>
            <Text style={styles.rewardPrize}>{PLAN_PLUS} 6 mesecev 🎉</Text>
          </View>
          <View style={styles.rewardRow}>
            <Text style={styles.rewardRank}>🥈 2. mesto</Text>
            <Text style={styles.rewardPrize}>{PLAN_PLUS} 3 mesece ⭐</Text>
          </View>
          <View style={styles.rewardRow}>
            <Text style={styles.rewardRank}>🥉 3. mesto</Text>
            <Text style={styles.rewardPrize}>{PLAN_PLUS} 1 mesec 💫</Text>
          </View>

          <Text style={[styles.podiumTitle, { marginTop: 24 }]}>Top 3 varčevalci</Text>
          <View style={styles.podiumRow}>
            <LinearGradient
              colors={["rgba(148, 163, 184, 0.35)", "rgba(15, 23, 42, 0.0)"]}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={styles.podiumStage}
            />
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
                    {slot.entry?.nickname ?? "Zasedi to mesto!"}
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

        <View style={styles.awardsCard}>
          <View style={styles.awardsHeader}>
            <View style={styles.awardsTitleRow}>
              <Ionicons name="ribbon" size={20} color="#fbbf24" />
              <Text style={styles.awardsTitle}>Tvoje nagrade in značke</Text>
            </View>
            <Text style={styles.awardsSubtitle}>
              Nagrade se podelijo 25. decembra (od sezone 2026 naprej).
            </Text>
          </View>
          {awardItems.length > 0 ? (
            <View style={styles.awardsList}>
              {awardItems.map((award) => {
                const isReward = award.award.startsWith(PLAN_PLUS);
                const iconName = isReward ? "star" : "ribbon";
                const iconColor = isReward ? "#fbbf24" : "#a855f7";
                const leagueLabel = award.leaderboard === "family"
                  ? PLAN_FAMILY
                  : `Free + ${PLAN_PLUS}`;
                return (
                  <View
                    key={`${award.year}-${award.rank}-${award.award}-${award.leaderboard}`}
                    style={styles.awardRow}
                  >
                    <View style={[styles.awardIcon, { borderColor: iconColor }]}>
                      <Ionicons name={iconName} size={14} color={iconColor} />
                    </View>
                    <View style={styles.awardInfo}>
                      <Text style={styles.awardName}>{award.award}</Text>
                      <Text style={styles.awardMeta}>
                        {award.year} · {leagueLabel}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.awardsEmpty}>Še nimaš nagrad ali značk. Začni s tekmovanjem!</Text>
          )}
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Tvoje mesto</Text>
          {summary?.rank && leaderboardEntries.length > 0 ? (
            <>
              {/* Show 2 entries before user (if exist) */}
              {leaderboardEntries
                .filter((entry) => entry.rank >= (summary.rank! - 2) && entry.rank < summary.rank!)
                .map((entry) => (
                  <View key={entry.userId} style={styles.listRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{entry.rank}</Text>
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={styles.listName}>{entry.nickname}</Text>
                      <Text style={styles.listSaving}>{formatCurrency(entry.savings)}</Text>
                    </View>
                  </View>
                ))}

              {/* Current user - highlighted */}
              {leaderboardEntries
                .filter((entry) => entry.rank === summary.rank)
                .map((entry) => (
                  <LinearGradient
                    key={entry.userId}
                    colors={["rgba(251, 191, 36, 0.25)", "rgba(139, 92, 246, 0.25)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.listRow, styles.currentUserRow]}
                  >
                    <View style={[styles.rankBadge, styles.currentUserRankBadge]}>
                      <Text style={[styles.rankText, styles.currentUserRankText]}>#{entry.rank}</Text>
                    </View>
                    <View style={styles.listInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.listName, styles.currentUserName]}>{entry.nickname}</Text>
                        <Text style={styles.youBadge}>TI</Text>
                      </View>
                      <Text style={[styles.listSaving, styles.currentUserSaving]}>{formatCurrency(entry.savings)}</Text>
                    </View>
                  </LinearGradient>
                ))}

              {/* Show 2 entries after user (if exist) */}
              {leaderboardEntries
                .filter((entry) => entry.rank > summary.rank! && entry.rank <= (summary.rank! + 2))
                .map((entry) => (
                  <View key={entry.userId} style={styles.listRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{entry.rank}</Text>
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={styles.listName}>{entry.nickname}</Text>
                      <Text style={styles.listSaving}>{formatCurrency(entry.savings)}</Text>
                    </View>
                  </View>
                ))}
            </>
          ) : (
            <Text style={styles.emptyText}>Dodaj račune za uvrstitev na lestvico.</Text>
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
              🏆 <Text style={styles.infoBold}>Tekmuj in s prihranki zmagaj!</Text>
              {"\n\n"}
              📸 <Text style={styles.infoBold}>Slikaj račune</Text> - Vsak dan do 23:00 dodaj račune iz trgovin Mercator, Spar in Tuš. Računi iz drugih trgovin (Lidl, Hofer, itd.) NE veljajo za lestvico. Aplikacija izračuna, koliko bi plačal v drugih trgovinah.
              {"\n\n"}
              💰 <Text style={styles.infoBold}>Zberi prihranke</Text> - Tvoj letni prihranek se posodablja z vsakim potrjenim računom. Več računov = večji prihranek = višja pozicija!
              {"\n\n"}
              🎯 <Text style={styles.infoBold}>Kaj NE šteje?</Text> Košarica in primerjava cen brez nakupa ne vplivata na lestvico. Samo POTRJENI računi iz Mercator, Spar ali Tuš štejejo.
              {"\n\n"}
              🏅 <Text style={styles.infoBold}>Nagrade</Text> - Top 10 prejme značke (Zlati, Srebrni, Bronasti). Top 100 dobi special badge. Nagrade se podelijo 25. decembra (od sezone 2026 naprej).
              {"\n\n"}
              👨‍👩‍👧 <Text style={styles.infoBold}>{PLAN_FAMILY}</Text> - Tekmujte skupaj! Do 3 člane. Skupni prihranki = močnejša ekipa na lestvici.
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
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    gap: 8,
  },
  trophyContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  trophyGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(251, 191, 36, 0.25)",
    opacity: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#a78bfa",
    fontWeight: "600",
  },
  motivationalText: {
    fontSize: 13,
    color: "#cbd5e1",
    textAlign: "center",
    marginTop: 4,
    fontWeight: "500",
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
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(251, 191, 36, 0.35)",
    marginBottom: 16,
  },
  rewardHeader: {
    marginBottom: 14,
    alignItems: "center",
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fbbf24",
    marginBottom: 4,
    textAlign: "center",
  },
  rewardSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fcd34d",
    textAlign: "center",
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
    position: "relative",
    paddingBottom: 8,
  },
  podiumStage: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 0,
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
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
  awardsCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
    marginBottom: 16,
  },
  awardsHeader: {
    marginBottom: 12,
  },
  awardsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  awardsTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
  awardsSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 16,
  },
  awardsList: {
    gap: 10,
  },
  awardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(55, 65, 81, 0.4)",
  },
  awardIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },
  awardInfo: {
    flex: 1,
  },
  awardName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f8fafc",
  },
  awardMeta: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  awardsEmpty: {
    fontSize: 13,
    color: "#94a3b8",
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
  currentUserRow: {
    borderWidth: 2,
    borderColor: "rgba(251, 191, 36, 0.5)",
    paddingVertical: 12,
    marginBottom: 12,
  },
  currentUserRankBadge: {
    backgroundColor: "rgba(251, 191, 36, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.6)",
  },
  currentUserRankText: {
    color: "#fbbf24",
    fontWeight: "900",
  },
  currentUserName: {
    color: "#fbbf24",
    fontWeight: "800",
    fontSize: 15,
  },
  currentUserSaving: {
    color: "#fcd34d",
    fontWeight: "700",
  },
  youBadge: {
    backgroundColor: "rgba(251, 191, 36, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 10,
    fontWeight: "900",
    color: "#fbbf24",
  },
  guestLock: {
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  guestLogoWrap: {
    width: 128,
    height: 128,
    borderRadius: 32,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  guestLogo: {
    width: 76,
    height: 153,
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
    lineHeight: 22,
  },
  infoBold: {
    fontWeight: "700",
    color: "#fbbf24",
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
