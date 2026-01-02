import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
  Image,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { PLAN_FREE, PLAN_PLUS, PLAN_FAMILY } from "@/lib/branding";
import { authClient } from "@/lib/auth-client";
import { createShadow } from "@/lib/shadow-helper";
import { useConvexAuth } from "convex/react";
import { getSeasonalLogoSource } from "@/lib/Logo";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import BADGE_TOP_100 from "@/assets/images/Top 100 badge 2026.png";
import BADGE_TOP_10 from "@/assets/images/Top 10 badge 2026.png";
import BADGE_GOLD from "@/assets/images/Zlati badge 2026.png";
import BADGE_SILVER from "@/assets/images/Srebrni badge 2026.png";
import BADGE_BRONZE from "@/assets/images/Bronasti badge 2026.png";

type AwardEntry = {
  year: number;
  award: string;
  rank: number;
  leaderboard: "standard" | "family";
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCancelSuccessModal, setShowCancelSuccessModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showSignOutToast] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [receiptSuccess, setReceiptSuccess] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [familyInviteEmail, setFamilyInviteEmail] = useState("");
  const [familyInviting, setFamilyInviting] = useState(false);
  const [familyError, setFamilyError] = useState("");
  const [familySuccess, setFamilySuccess] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const profile = useQuery(
    api.userProfiles.getProfile,
    isAuthenticated ? {} : "skip"
  );
  const adminStats = useQuery(
    api.admin.getStats,
    isAuthenticated && profile?.isAdmin ? {} : "skip"
  );
  const receipts = useQuery(
    api.receipts.getReceipts,
    isAuthenticated ? { limit: 20 } : "skip"
  );
  const awards = useQuery(
    api.awards.getMyAwards,
    isAuthenticated ? {} : "skip"
  );
  const familyMembers = useQuery(
    api.familyPlan.getFamilyMembers,
    isAuthenticated && profile?.premiumType === "family" ? {} : "skip"
  );
  const pendingInvites = useQuery(
    api.familyPlan.getPendingInvitations,
    isAuthenticated && profile?.premiumType === "family" ? {} : "skip"
  );
  const submitReceipt = useAction(api.receipts.submitReceipt);
  const inviteFamilyMember = useMutation(api.familyPlan.inviteFamilyMember);
  const removeFamilyMember = useMutation(api.familyPlan.removeFamilyMember);
  const cancelInvitation = useMutation(api.familyPlan.cancelInvitation);
  
  // Check if user is guest (anonymous)
  const isGuest = profile ? (profile.isAnonymous || !profile.email) : false;
  const isAdmin = profile?.isAdmin ?? false;

  const isPremium = profile?.isPremium ?? false;
  const premiumType = profile?.premiumType ?? "solo";
  const searchesRemaining = profile?.searchesRemaining ?? (isGuest ? 1 : 3);
  const maxSearches = isPremium ? 999 : (isGuest ? 1 : 3);
  const searchProgress = isPremium ? 1 : Math.max(0, Math.min(1, searchesRemaining / maxSearches));
  const searchResetTime = profile?.searchResetTime;
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const getLocalDateKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const formatDateShort = (timestamp?: number) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return null;
    const day = `${date.getDate()}`.padStart(2, "0");
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };
  const displayNickname =
    profile?.nickname ??
    profile?.name ??
    (profile?.email ? profile.email.split("@")[0] : "Uporabnik");
  const receiptLimit = premiumType === "family" ? 4 : 2;
  const todayKey = getLocalDateKey();
  const receiptsToday = receipts?.filter((receipt) => receipt.purchaseDateKey === todayKey) ?? [];
  const receiptsRemaining = Math.max(0, receiptLimit - receiptsToday.length);
  const premiumUntilLabel = formatDateShort(profile?.premiumUntil);
  const premiumUntilMessage = premiumUntilLabel
    ? `Premium velja do ${premiumUntilLabel}.`
    : "Premium velja do konca trenutnega obdobja.";
  const awardsByYear = (awards ?? []).reduce<Record<string, AwardEntry[]>>((acc, award) => {
    const key = `${award.year}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(award);
    return acc;
  }, {});
  const awardYears = Object.keys(awardsByYear).sort((a, b) => Number(b) - Number(a));
  const getAwardBadge = (award: AwardEntry) => {
    const label = award.award.toLowerCase();
    if (label.includes("zlati")) {
      return { image: BADGE_GOLD, title: award.award };
    }
    if (label.includes("srebrni")) {
      return { image: BADGE_SILVER, title: award.award };
    }
    if (label.includes("bronasti")) {
      return { image: BADGE_BRONZE, title: award.award };
    }
    if (label.includes("top 10")) {
      return { image: BADGE_TOP_10, title: award.award };
    }
    if (label.includes("top 100")) {
      return { image: BADGE_TOP_100, title: award.award };
    }
    return { image: BADGE_TOP_100, title: award.award };
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const update = () => {
      if (!isPremium && searchResetTime && searchesRemaining <= 0) {
        const diff = Math.max(0, searchResetTime - Date.now());
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      } else {
        setTimeRemaining(null);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [searchResetTime, isPremium, searchesRemaining, maxSearches]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: searchProgress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [searchProgress]);

  useEffect(() => {
    if (profile?.nickname && !nicknameInput) {
      setNicknameInput(profile.nickname);
    }
  }, [profile?.nickname, nicknameInput]);

  const handleUpgrade = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.push("/premium");
  };

  const formatCurrency = (value: number) => {
    if (!Number.isFinite(value)) return "0.00 EUR";
    return value.toFixed(2).replace(".", ",") + " EUR";
  };

  const handleCaptureReceipt = async () => {
    if (receiptsRemaining <= 0) {
      setReceiptError("Dosežen dnevni limit računov.");
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setReceiptError("Dostop do kamere ni dovoljen.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setReceiptImage(result.assets[0].uri);
      setReceiptConfirmed(false);
      setReceiptError("");
      setReceiptSuccess("");
    }
  };

  const resetReceiptState = () => {
    setReceiptImage(null);
    setReceiptConfirmed(false);
    setReceiptError("");
    setReceiptSuccess("");
  };

  const handleSubmitReceipt = async () => {
    if (!receiptImage) {
      setReceiptError("Najprej posnemi račun.");
      return;
    }
    if (!receiptConfirmed) {
      setReceiptError("Potrdi, da je slikani račun tvoj.");
      return;
    }

    setReceiptSubmitting(true);
    setReceiptError("");
    setReceiptSuccess("");

    try {
      let base64Image = "";
      if (Platform.OS === "web") {
        const response = await fetch(receiptImage);
        const blob = await response.blob();
        base64Image = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } else {
        const base64 = await FileSystem.readAsStringAsync(receiptImage, {
          encoding: "base64",
        });
        base64Image = `data:image/jpeg;base64,${base64}`;
      }

      const result = await submitReceipt({
        imageBase64: base64Image,
        confirmed: receiptConfirmed,
      });

      if (!result.success) {
        setReceiptError(result.error ?? "Oddaja računa ni uspela.");
        return;
      }

      if (result.invalidReason) {
        setReceiptSuccess(`Račun shranjen, a neveljaven: ${result.invalidReason}`);
      } else {
        setReceiptSuccess("Račun potrjen in upoštevan.");
      }

      setTimeout(() => {
        setShowReceiptModal(false);
        resetReceiptState();
      }, 1200);
    } catch (error) {
      console.error("Receipt error:", error);
      setReceiptError("Oddaja računa ni uspela.");
    } finally {
      setReceiptSubmitting(false);
    }
  };


  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const timeoutMs = 6000;
    try {
      await Promise.race([
        authClient.signOut(),
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    } catch (error) {
      console.error("Napaka pri odjavi:", error);
    } finally {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace({ pathname: "/auth", params: { mode: "login" } });
      setSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    try {
      await authClient.signOut();
      router.replace({ pathname: "/auth", params: { mode: "login" } });
      // Note: Full account deletion would require backend implementation
    } catch (error) {
      console.error("Napaka pri brisanju:", error);
    }
    setShowDeleteModal(false);
  };

  const handleInviteFamilyMember = async () => {
    const trimmedEmail = familyInviteEmail.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFamilyError("Vnesi veljaven e-naslov");
      return;
    }

    setFamilyInviting(true);
    setFamilyError("");
    setFamilySuccess("");

    try {
      await inviteFamilyMember({ email: trimmedEmail });
      setFamilySuccess(`Vabilo poslano na ${trimmedEmail}!`);
      setFamilyInviteEmail("");
      setTimeout(() => {
        setFamilySuccess("");
      }, 3000);
    } catch (error: unknown) {
      setFamilyError(error instanceof Error ? error.message : "Napaka pri pošiljanju vabila");
    } finally {
      setFamilyInviting(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    try {
      await removeFamilyMember({ memberUserId });
    } catch (error: unknown) {
      console.error("Remove member error:", error);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await cancelInvitation({ invitationId: invitationId as any });
    } catch (error: unknown) {
      console.error("Cancel invite error:", error);
    }
  };

  const handleCancelSubscription = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    try {
      // Note: Subscription cancellation would require payment provider integration
      // For now just close modal - backend would handle actual cancellation
      setShowCancelModal(false);
      setShowCancelSuccessModal(true);
    } catch (error) {
      console.error("Cancel subscription error:", error);
      setShowCancelModal(false);
    }
  };

  if (!isAuthenticated || isGuest) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.authPrompt, { paddingTop: insets.top + 40 }]}>
          <Image
            source={getSeasonalLogoSource()}
            style={styles.authLogo}
            resizeMode="contain"
          />
          <Text style={styles.authTitle}>Prijava je potrebna</Text>
          <Text style={styles.authText}>
            Za dostop do profila in shranjevanje{"\n"}nastavitev se prijavi ali registriraj
          </Text>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => router.push({ pathname: "/auth", params: { mode: "register" } })}
          >
            <LinearGradient
              colors={["#8b5cf6", "#7c3aed"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.authButtonGradient}
            >
              <Text style={styles.authButtonText}>Prijava / Registracija</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />

      {/* Ambient Glow */}
      <View style={[styles.glowOrb, styles.glowOrb1]} />
      <View style={[styles.glowOrb, styles.glowOrb2]} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Image
            source={getSeasonalLogoSource()}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Moj profil</Text>
          <View style={styles.nicknameRow}>
            <Text style={styles.nicknameText}>{displayNickname}</Text>
          </View>
        </Animated.View>

        {/* Plan Card */}
        <Animated.View style={[styles.planCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient
            colors={
              isPremium
                ? ["rgba(251, 191, 36, 0.26)", "rgba(245, 158, 11, 0.2)"]
                : ["rgba(139, 92, 246, 0.15)", "rgba(59, 7, 100, 0.3)"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.planGradient,
              isPremium && styles.planGradientPremium,
              isPremium && styles.planPremiumShadow,
            ]}
          >
            <View style={styles.planHeader}>
              <View style={styles.planInfo}>
                <View style={styles.planBadge}>
                  {isPremium ? (
                    <Ionicons name="star" size={16} color="#fbbf24" />
                  ) : (
                    <Ionicons name="person" size={16} color="#a78bfa" />
                  )}
                  <Text style={[styles.planBadgeText, isPremium && styles.planBadgeTextPremium]}>
                    {isPremium ? (premiumType === "family" ? PLAN_FAMILY : PLAN_PLUS) : PLAN_FREE}
                  </Text>
                </View>
                <Text style={styles.planPrice}>
                  {isPremium ? (premiumType === "family" ? "2,99  EUR/mesec" : "1,99  EUR/mesec") : "Brezplačno"}
                </Text>
                {isPremium && (
                  <Text style={styles.planExpiry}>
                    {premiumUntilLabel ? `Velja do ${premiumUntilLabel}` : "Velja do konca obdobja"}
                  </Text>
                )}
              </View>
              {(!isPremium || (isPremium && premiumType === "solo")) && (
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={handleUpgrade}
                >
                  <LinearGradient
                    colors={["#fbbf24", "#f59e0b"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.upgradeGradient}
                  >
                    <Ionicons name="star" size={14} color="#0b0814" />
                    <Text style={styles.upgradeText}>
                      {isPremium ? "Nadgradi na Family" : "Nadgradi"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* Search Progress */}
            <View style={styles.searchProgress}>
              <View style={styles.searchProgressHeader}>
                <Text style={styles.searchProgressLabel}>Brezplačna iskanja</Text>
                <Text style={styles.searchProgressValue}>
                  {isPremium ? "neomejeno" : `${Math.max(0, searchesRemaining)}/${maxSearches}`}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    isPremium && styles.progressFillPremium,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              </View>
              {!isPremium && searchesRemaining <= 0 && timeRemaining ? (
                <View style={styles.searchTimer}>
                  <Ionicons name="time-outline" size={14} color="#fbbf24" />
                  <Text style={styles.searchTimerText}>Novo iskanje čez {timeRemaining}</Text>
                </View>
              ) : !isPremium && searchesRemaining === 1 ? (
                <Text style={styles.searchWarning}>
                  Še samo 1 brezplačno iskanje.
                </Text>
              ) : null}
            </View>

            {/* Plan Features */}
            <View style={styles.planFeatures}>
              <View style={styles.planFeature}>
                <Ionicons
                  name={isPremium ? "checkmark-circle" : "checkmark-circle-outline"}
                  size={18}
                  color={isPremium ? "#10b981" : "#6b7280"}
                />
                <Text style={[styles.planFeatureText, !isPremium && styles.planFeatureTextDisabled]}>
                  {isPremium
                    ? "Neomejeno iskanje"
                    : (maxSearches === 1 ? "1 iskanje na dan" : `${maxSearches} iskanja na dan`)}
                </Text>
              </View>
              <View style={styles.planFeature}>
                <Ionicons
                  name={isPremium ? "checkmark-circle" : "close-circle-outline"}
                  size={18}
                  color={isPremium ? "#10b981" : "#6b7280"}
                />
                <Text style={[styles.planFeatureText, !isPremium && styles.planFeatureTextDisabled]}>
                  {isPremium ? "Vse razpoložljive trgovine" : "Samo osnovne trgovine"}
                </Text>
              </View>
              <View style={styles.planFeature}>
                <Ionicons
                  name={isPremium ? "checkmark-circle" : "close-circle-outline"}
                  size={18}
                  color={isPremium ? "#10b981" : "#6b7280"}
                />
                <Text style={[styles.planFeatureText, !isPremium && styles.planFeatureTextDisabled]}>
                  {isPremium ? "Ekskluzivni kuponi" : "Osnovni kuponi"}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Achievements */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Dosežki</Text>
          <Text style={styles.sectionSubtitle}>Letni dosežki iz varčevanja</Text>
          {awardYears.length === 0 ? (
            <View style={styles.emptyAwards}>
              <Ionicons name="trophy-outline" size={26} color="#a78bfa" />
              <Text style={styles.emptyAwardsText}>
                Še ni dosežkov. Dodaj račune in začni varčevati.
              </Text>
            </View>
          ) : (
            awardYears.map((year) => (
              <View key={year} style={styles.awardYearCard}>
                <Text style={styles.awardYearTitle}>{year}</Text>
                <View style={styles.awardList}>
                  {awardsByYear[year].map((award, index) => {
                    const badge = getAwardBadge(award);
                    const leaderboardLabel =
                      award.leaderboard === "family" ? "Family lestvica" : "Skupna lestvica";
                    return (
                      <View key={`${year}-${award.rank}-${index}`} style={styles.awardBadgeCard}>
                        <Image source={badge.image} style={styles.awardBadgeImage} />
                        <View style={styles.awardBadgeInfo}>
                          <Text style={styles.awardBadgeTitle}>{badge.title}</Text>
                          <Text style={styles.awardBadgeMeta}>
                            {leaderboardLabel} - #{award.rank}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </Animated.View>

        {/* Receipts */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Računi</Text>
          <Text style={styles.sectionSubtitle}>
            Prihranek se računa iz potrjenih računov (max {receiptLimit}/dan).
          </Text>
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <View>
                <Text style={styles.receiptTitle}>Računi danes</Text>
                <Text style={styles.receiptMeta}>
                  {receiptsToday.length}/{receiptLimit} uporabljeno
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.receiptButton, receiptsRemaining <= 0 && styles.receiptButtonDisabled]}
                onPress={() => {
                  setShowReceiptModal(true);
                  resetReceiptState();
                }}
                disabled={receiptsRemaining <= 0}
              >
                <LinearGradient
                  colors={receiptsRemaining <= 0 ? ["#475569", "#334155"] : ["#22c55e", "#16a34a"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.receiptButtonGradient}
                >
                  <Ionicons name="camera" size={16} color="#fff" />
                  <Text style={styles.receiptButtonText}>Dodaj račun</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <Text style={styles.receiptHint}>
              Račun velja samo danes do 23:00. Brez potrditve se ne upošteva.
            </Text>
          </View>

          <View style={styles.receiptList}>
            {receipts && receipts.length > 0 ? (
              receipts.map((receipt) => (
                <View key={receipt._id} style={styles.receiptItem}>
                  <View style={styles.receiptItemRow}>
                    <Text style={styles.receiptStore}>{receipt.storeName ?? "Neznana trgovina"}</Text>
                    <Text style={styles.receiptDate}>{receipt.purchaseDateKey}</Text>
                  </View>
                  <View style={styles.receiptItemRow}>
                    <Text style={styles.receiptTotal}>Plačano: {formatCurrency(receipt.totalPaid)}</Text>
                    <Text style={styles.receiptSaved}>
                      Prihranek: {formatCurrency(receipt.savedAmount)}
                    </Text>
                  </View>
                  {!receipt.isValid && (
                    <Text style={styles.receiptInvalid}>
                      Neveljaven račun: {receipt.invalidReason ?? "Ni potrjen"}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.receiptEmpty}>Ni računov.</Text>
            )}
          </View>
        </Animated.View>

        {isAdmin && (
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <View style={styles.adminHeader}>
              <View>
                <Text style={styles.sectionTitle}>Admin Panel</Text>
                <Text style={styles.sectionSubtitle}>Pregled rasti v realnem času</Text>
              </View>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.2)", "rgba(15, 23, 42, 0.7)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.adminCard}
            >
              <View style={styles.adminRow}>
                <View style={styles.adminStat}>
                  <Ionicons name="people" size={20} color="#8b5cf6" />
                  <Text style={styles.adminStatLabel}>Uporabniki</Text>
                  <Text style={styles.adminStatValue}>
                    {adminStats?.totalUsers ?? "--"}
                  </Text>
                </View>
                <View style={styles.adminStat}>
                  <Ionicons name="flash" size={20} color="#10b981" />
                  <Text style={styles.adminStatLabel}>Aktivni</Text>
                  <Text style={styles.adminStatValue}>
                    {adminStats?.activeUsers ?? "--"}
                  </Text>
                </View>
                <View style={styles.adminStat}>
                  <Ionicons name="eye-outline" size={20} color="#f59e0b" />
                  <Text style={styles.adminStatLabel}>Gostje</Text>
                  <Text style={styles.adminStatValue}>
                    {adminStats?.totalGuests ?? "--"}
                  </Text>
                </View>
              </View>

              {adminStats?.topCountries && adminStats.topCountries.length > 0 && (
                <View style={styles.geoSection}>
                  <View style={styles.geoHeader}>
                    <Ionicons name="globe-outline" size={18} color="#cbd5e1" />
                    <Text style={styles.geoTitle}>Top Države</Text>
                  </View>
                  <View style={styles.geoList}>
                    {adminStats.topCountries.map((item, index) => (
                      <View key={item.country} style={styles.geoItem}>
                        <View style={styles.geoRank}>
                          <Text style={styles.geoRankText}>{index + 1}</Text>
                        </View>
                        <Text style={styles.geoCountry}>{item.country}</Text>
                        <Text style={styles.geoCount}>{item.count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </LinearGradient>
          </Animated.View>
        )}

        {/* Family Plan Management */}
        {premiumType === "family" && (
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <View style={styles.familyHeader}>
              <Text style={styles.sectionTitle}>Family Plan</Text>
              <TouchableOpacity
                style={styles.addMemberButton}
                onPress={() => setShowFamilyModal(true)}
              >
                <Ionicons name="person-add" size={18} color="#fbbf24" />
                <Text style={styles.addMemberText}>Povabi</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              {familyMembers?.availableSlots || 0} / {familyMembers?.maxMembers || 3} prostih mest
            </Text>

            <View style={styles.familyList}>
              {/* Current Members */}
              {familyMembers?.members && familyMembers.members.length > 0 && (
                <>
                  {familyMembers.members.map((member: { userId: string; nickname: string; email: string | undefined }) => (
                    <View key={member.userId} style={styles.familyMemberCard}>
                      <View style={styles.familyMemberIcon}>
                        <Ionicons name="person" size={20} color="#10b981" />
                      </View>
                      <View style={styles.familyMemberInfo}>
                        <Text style={styles.familyMemberName}>{member.nickname}</Text>
                        <Text style={styles.familyMemberEmail}>{member.email}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeMemberButton}
                        onPress={() => handleRemoveMember(member.userId)}
                      >
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {/* Pending Invitations */}
              {pendingInvites && pendingInvites.length > 0 && (
                <>
                  {pendingInvites.map((invite: { id: string; email: string | undefined }) => (
                    <View key={invite.id} style={styles.familyPendingCard}>
                      <View style={styles.familyMemberIcon}>
                        <Ionicons name="mail" size={20} color="#f59e0b" />
                      </View>
                      <View style={styles.familyMemberInfo}>
                        <Text style={styles.familyMemberEmail}>{invite.email}</Text>
                        <Text style={styles.familyPendingText}>Vabilo poslano</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeMemberButton}
                        onPress={() => handleCancelInvite(invite.id)}
                      >
                        <Ionicons name="close-circle" size={20} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {/* Empty State */}
              {(!familyMembers?.members || familyMembers.members.length === 0) &&
                (!pendingInvites || pendingInvites.length === 0) && (
                  <View style={styles.familyEmpty}>
                    <Ionicons name="people-outline" size={40} color="#6b7280" />
                    <Text style={styles.familyEmptyText}>
                      Dodaj družinske člane in delite premium funkcije!
                    </Text>
                  </View>
                )}
            </View>
          </Animated.View>
        )}

        {/* Settings */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Nastavitve</Text>

          <View style={styles.settingsList}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <TouchableOpacity style={styles.settingItem} onPress={() => router.push("/receipts" as any)}>
              <View style={styles.settingIcon}>
                <Ionicons name="receipt-outline" size={20} color="#10b981" />
              </View>
              <Text style={styles.settingText}>Moji Računi</Text>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => router.push("/notifications")}>
              <View style={styles.settingIcon}>
                <Ionicons name="notifications-outline" size={20} color="#a78bfa" />
              </View>
              <Text style={styles.settingText}>Obvestila</Text>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => router.push("/loyalty-cards")}>
              <View style={styles.settingIcon}>
                <Ionicons name="card-outline" size={20} color="#a78bfa" />
              </View>
              <Text style={styles.settingText}>Kartice zvestobe</Text>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => router.push("/help")}>
              <View style={styles.settingIcon}>
                <Ionicons name="help-circle-outline" size={20} color="#a78bfa" />
              </View>
              <Text style={styles.settingText}>Pomoč</Text>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => router.push("/terms")}>
              <View style={styles.settingIcon}>
                <Ionicons name="document-text-outline" size={20} color="#a78bfa" />
              </View>
              <Text style={styles.settingText}>Pogoji uporabe</Text>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>

            {isPremium && (
              <TouchableOpacity 
                style={styles.settingItem}
                onPress={() => setShowCancelModal(true)}
              >
                <View style={[styles.settingIcon, { backgroundColor: "rgba(251, 191, 36, 0.15)" }]}>
                  <Ionicons name="close-circle-outline" size={20} color="#fbbf24" />
                </View>
                <Text style={styles.settingText}>Prekliči naročnino</Text>
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.settingItem, styles.settingItemDanger]}
              onPress={() => setShowDeleteModal(true)}
            >
              <View style={[styles.settingIcon, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </View>
              <Text style={styles.settingTextDanger}>Izbriši račun</Text>
              <Ionicons name="chevron-forward" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} disabled={signingOut}>
          <Ionicons name="log-out-outline" size={20} color={signingOut ? "#9ca3af" : "#ef4444"} />
          <Text style={[styles.signOutText, signingOut && { color: "#9ca3af" }]}>
            {signingOut ? "Odjavljam..." : "Odjava"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      {showReceiptModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.receiptModal}>
            <LinearGradient
              colors={["rgba(34, 197, 94, 0.18)", "rgba(15, 23, 42, 0.9)"]}
              style={styles.receiptModalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => {
                  setShowReceiptModal(false);
                  resetReceiptState();
                }}
              >
                <Ionicons name="close" size={22} color="#9ca3af" />
              </TouchableOpacity>

              <Text style={styles.receiptModalTitle}>Dodaj račun</Text>

              {receiptImage ? (
                <Image source={{ uri: receiptImage }} style={styles.receiptPreview} />
              ) : (
                <View style={styles.receiptPlaceholder}>
                  <Ionicons name="receipt-outline" size={42} color="#a78bfa" />
                  <Text style={styles.receiptPlaceholderText}>Posnemi račun s kamero.</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.receiptCheckRow}
                onPress={() => setReceiptConfirmed((value) => !value)}
                activeOpacity={0.8}
              >
                <View style={[styles.receiptCheckBox, receiptConfirmed && styles.receiptCheckBoxChecked]}>
                  {receiptConfirmed && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={styles.receiptCheckText}>Potrdi, da je slikani račun tvoj.</Text>
              </TouchableOpacity>

              {receiptError ? <Text style={styles.receiptErrorText}>{receiptError}</Text> : null}
              {receiptSuccess ? <Text style={styles.receiptSuccessText}>{receiptSuccess}</Text> : null}

              <View style={styles.receiptModalActions}>
                <TouchableOpacity
                  style={[styles.receiptActionButton, receiptsRemaining <= 0 && styles.receiptActionDisabled]}
                  onPress={handleCaptureReceipt}
                  disabled={receiptsRemaining <= 0 || receiptSubmitting}
                >
                  <LinearGradient
                    colors={receiptsRemaining <= 0 ? ["#475569", "#334155"] : ["#8b5cf6", "#7c3aed"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.receiptActionGradient}
                  >
                    <Ionicons name="camera" size={18} color="#fff" />
                    <Text style={styles.receiptActionText}>Odpri kamero</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.receiptActionButton,
                    styles.receiptActionSecondary,
                    (!receiptImage || receiptSubmitting) && styles.receiptActionDisabled,
                  ]}
                  onPress={handleSubmitReceipt}
                  disabled={!receiptImage || receiptSubmitting}
                >
                  <LinearGradient
                    colors={!receiptImage || receiptSubmitting ? ["#475569", "#334155"] : ["#22c55e", "#16a34a"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.receiptActionGradient}
                  >
                    {receiptSubmitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        <Text style={styles.receiptActionText}>Oddaj račun</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}


      {showSignOutToast && (
        <View style={styles.toastOverlay}>
          <LinearGradient
            colors={["rgba(16, 185, 129, 0.25)", "rgba(16, 185, 129, 0.15)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.toastContainer}
          >
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.toastText}>Uspesno odjavljeno</Text>
          </LinearGradient>
        </View>
      )}

      {/* Premium Modal */}
      {showPremiumModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.2)", "rgba(59, 7, 100, 0.4)"]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowPremiumModal(false)}
              >
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>

              <Image
                source={getSeasonalLogoSource()}
                style={styles.modalLogo}
                resizeMode="contain"
              />

              <Text style={styles.modalTitle}>Pr'Hran Premium</Text>
              <Text style={styles.modalPrice}>1,99  EUR/mesec</Text>

              <View style={styles.modalFeatures}>
                <View style={styles.modalFeatureRow}>
                  <View style={styles.modalFeatureCol}>
                    <Text style={styles.modalFeatureLabel}>ZASTONJ</Text>
                    <View style={styles.modalFeature}>
                      <Ionicons name="checkmark" size={16} color="#10b981" />
                      <Text style={styles.modalFeatureText}>3 iskanja/dan</Text>
                    </View>
                    <View style={styles.modalFeature}>
                      <Ionicons name="close" size={16} color="#ef4444" />
                      <Text style={styles.modalFeatureTextDisabled}>Omejeno število trgovin</Text>
                    </View>
                    <View style={styles.modalFeature}>
                      <Ionicons name="close" size={16} color="#ef4444" />
                      <Text style={styles.modalFeatureTextDisabled}>Ekskluzivni kuponi</Text>
                    </View>
                  </View>
                  <View style={styles.modalFeatureDivider} />
                  <View style={styles.modalFeatureCol}>
                    <Text style={styles.modalFeatureLabelPremium}>PREMIUM</Text>
                    <View style={styles.modalFeature}>
                      <Ionicons name="checkmark" size={16} color="#10b981" />
                      <Text style={styles.modalFeatureText}>Neomejeno</Text>
                    </View>
                    <View style={styles.modalFeature}>
                      <Ionicons name="checkmark" size={16} color="#10b981" />
                      <Text style={styles.modalFeatureText}>Vse razpoložljive trgovine</Text>
                    </View>
                    <View style={styles.modalFeature}>
                      <Ionicons name="checkmark" size={16} color="#10b981" />
                      <Text style={styles.modalFeatureText}>Ekskluzivni kuponi</Text>
                    </View>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.modalButton} onPress={handleUpgrade}>
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalButtonGradient}
                >
                  <Ionicons name="star" size={18} color="#000" />
                  <Text style={styles.modalButtonText}>Nadgradi na PrHran Plus</Text>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.modalDisclaimer}>
                Prekliči kadarkoli. Brez skritih stroškov.
              </Text>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <LinearGradient
              colors={["rgba(239, 68, 68, 0.2)", "rgba(127, 29, 29, 0.4)"]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowDeleteModal(false)}
              >
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>

              <View style={styles.deleteIconContainer}>
                <LinearGradient
                  colors={["#ef4444", "#dc2626"]}
                  style={styles.deleteIconBg}
                >
                  <Ionicons name="warning" size={32} color="#fff" />
                </LinearGradient>
              </View>

              <Text style={styles.deleteTitle}>Izbriši račun?</Text>
              <Text style={styles.deleteDescription}>
                Ta dejanje je nepovratno. Vsi tvoji podatki, košarica in nastavitve bodo trajno izbrisani.
              </Text>

              <View style={styles.deleteButtons}>
                <TouchableOpacity 
                  style={styles.cancelDeleteButton}
                  onPress={() => setShowDeleteModal(false)}
                >
                  <Text style={styles.cancelDeleteText}>Prekliči</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.confirmDeleteButton}
                  onPress={handleDeleteAccount}
                >
                  <LinearGradient
                    colors={["#ef4444", "#dc2626"]}
                    style={styles.confirmDeleteGradient}
                  >
                    <Text style={styles.confirmDeleteText}>Izbriši</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <LinearGradient
              colors={["rgba(251, 191, 36, 0.2)", "rgba(180, 83, 9, 0.4)"]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowCancelModal(false)}
              >
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>

              <View style={styles.cancelIconContainer}>
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b"]}
                  style={styles.cancelIconBg}
                >
                  <Ionicons name="star" size={32} color="#000" />
                </LinearGradient>
              </View>

              <Text style={styles.cancelTitle}>Prekliči Premium?</Text>
              <Text style={styles.cancelDescription}>
                Ob preklicu boš izgubil dostop do:{"\n"}
                -  Neomejenega iskanja{"\n"}
                -  Vseh trgovin{"\n"}
                -  Ekskluzivnih kuponov
              </Text>

              <View style={styles.deleteButtons}>
                <TouchableOpacity 
                  style={styles.keepPremiumButton}
                  onPress={() => setShowCancelModal(false)}
                >
                  <LinearGradient
                    colors={["#fbbf24", "#f59e0b"]}
                    style={styles.keepPremiumGradient}
                  >
                    <Text style={styles.keepPremiumText}>Obdrži Premium</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.confirmCancelButton}
                  onPress={handleCancelSubscription}
                >
                  <Text style={styles.confirmCancelText}>Prekliči naročnino</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}

      {showCancelSuccessModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <LinearGradient
              colors={["rgba(16, 185, 129, 0.25)", "rgba(15, 23, 42, 0.75)"]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowCancelSuccessModal(false)}
              >
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>

              <View style={styles.cancelIconContainer}>
                <LinearGradient
                  colors={["#34d399", "#10b981"]}
                  style={styles.cancelIconBg}
                >
                  <Ionicons name="checkmark" size={32} color="#000" />
                </LinearGradient>
              </View>

              <Text style={styles.cancelTitle}>Naročnina preklicana</Text>
              <Text style={styles.cancelDescription}>{premiumUntilMessage}</Text>

              <TouchableOpacity
                style={styles.keepPremiumButton}
                onPress={() => setShowCancelSuccessModal(false)}
              >
                <LinearGradient
                  colors={["#34d399", "#10b981"]}
                  style={styles.keepPremiumGradient}
                >
                  <Text style={styles.keepPremiumText}>Zapri</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Family Invite Modal */}
      {showFamilyModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.2)", "rgba(59, 7, 100, 0.3)"]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => {
                  setShowFamilyModal(false);
                  setFamilyInviteEmail("");
                  setFamilyError("");
                  setFamilySuccess("");
                }}
              >
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>

              <View style={styles.familyModalIcon}>
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b"]}
                  style={styles.familyModalIconBg}
                >
                  <Ionicons name="people" size={32} color="#0b0814" />
                </LinearGradient>
              </View>

              <Text style={styles.modalTitle}>Povabi v Family Plan</Text>
              <Text style={styles.modalSubtitle}>
                Vnesi e-naslov osebe, ki jo želiš dodati v svojo družino.
              </Text>

              <TextInput
                style={styles.familyInput}
                placeholder="email@example.com"
                placeholderTextColor="#6b7280"
                value={familyInviteEmail}
                onChangeText={setFamilyInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {familyError ? (
                <Text style={styles.familyErrorText}>{familyError}</Text>
              ) : null}
              {familySuccess ? (
                <Text style={styles.familySuccessText}>{familySuccess}</Text>
              ) : null}

              <TouchableOpacity
                style={styles.familyInviteButton}
                onPress={handleInviteFamilyMember}
                disabled={familyInviting}
              >
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b"]}
                  style={styles.familyInviteGradient}
                >
                  {familyInviting ? (
                    <ActivityIndicator size="small" color="#0b0814" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#0b0814" />
                      <Text style={styles.familyInviteText}>Pošlji vabilo</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0a1e",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  glowOrb: {
    position: "absolute",
    borderRadius: 999,
  },
  glowOrb1: {
    width: 250,
    height: 250,
    backgroundColor: "#8b5cf6",
    top: -80,
    left: -80,
    opacity: 0.15,
  },
  glowOrb2: {
    width: 200,
    height: 200,
    backgroundColor: "#fbbf24",
    bottom: 150,
    right: -60,
    opacity: 0.08,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 102,
    height: 102,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  nicknameRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nicknameText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#a78bfa",
  },
  nicknameEditButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(139, 92, 246, 0.2)",
  },
  nicknameEditButtonDisabled: {
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  nicknameHint: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
  authPrompt: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  authLogo: {
    width: 218,
    height: 218,
    marginBottom: 24,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 12,
  },
  authText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  authButton: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
  },
  authButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  planCard: {
    marginBottom: 28,
    borderRadius: 24,
    overflow: "hidden",
  },
  planGradient: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  planGradientPremium: {
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  planPremiumShadow: {
    ...createShadow("#fbbf24", 0, 10, 0.35, 18, 10),
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  planInfo: {},
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#a78bfa",
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  planBadgeTextPremium: {
    color: "#fbbf24",
  },
  planPrice: {
    fontSize: 14,
    color: "#9ca3af",
  },
  planExpiry: {
    fontSize: 12,
    color: "#a7f3d0",
    marginTop: 4,
    fontWeight: "600",
  },
  upgradeButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  upgradeGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  upgradeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    marginLeft: 6,
  },
  searchProgress: {
    marginBottom: 20,
  },
  searchProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  searchProgressLabel: {
    fontSize: 13,
    color: "#9ca3af",
  },
  searchProgressValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#8b5cf6",
    borderRadius: 4,
  },
  progressFillPremium: {
    backgroundColor: "#fbbf24",
  },
  searchWarning: {
    fontSize: 12,
    color: "#fbbf24",
    marginTop: 8,
  },
  searchTimer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  searchTimerText: {
    fontSize: 12,
    color: "#fbbf24",
    marginLeft: 6,
  },
  planFeatures: {
    gap: 10,
  },
  planFeature: {
    flexDirection: "row",
    alignItems: "center",
  },
  planFeatureText: {
    fontSize: 14,
    color: "#fff",
    marginLeft: 10,
  },
  planFeatureTextDisabled: {
    color: "#6b7280",
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 16,
  },
  adminHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  liveText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10b981",
    letterSpacing: 0.8,
  },
  adminCard: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.4)",
    ...createShadow("#8b5cf6", 0, 4, 0.2),
  },
  adminRow: {
    flexDirection: "row",
    gap: 12,
  },
  adminStat: {
    flex: 1,
    minWidth: 90,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.25)",
    alignItems: "center",
    gap: 6,
  },
  adminStatLabel: {
    fontSize: 11,
    color: "#cbd5e1",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 2,
  },
  adminStatValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
  },
  geoSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(139, 92, 246, 0.2)",
  },
  geoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  geoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#cbd5e1",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  geoList: {
    gap: 8,
  },
  geoItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.15)",
  },
  geoRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(139, 92, 246, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  geoRankText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#a78bfa",
  },
  geoCountry: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#e2e8f0",
  },
  geoCount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#8b5cf6",
  },
  emptyAwards: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    alignItems: "center",
    gap: 10,
  },
  emptyAwardsText: {
    fontSize: 13,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 18,
  },
  awardYearCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.25)",
    marginBottom: 16,
    ...createShadow("#8b5cf6", 0, 4, 0.15),
  },
  awardYearTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 10,
  },
  awardList: {
    gap: 8,
  },
  awardBadgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    ...createShadow("#8b5cf6", 0, 2, 0.1),
  },
  awardBadgeImage: {
    width: 64,
    height: 64,
    resizeMode: "contain",
  },
  awardBadgeInfo: {
    flex: 1,
    gap: 4,
  },
  awardBadgeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  awardBadgeMeta: {
    fontSize: 12,
    color: "#cbd5e1",
  },
  receiptCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
    marginBottom: 18,
    ...createShadow("#22c55e", 0, 3, 0.12),
  },
  receiptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  receiptTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  receiptMeta: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  receiptButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  receiptButtonDisabled: {
    opacity: 0.7,
  },
  receiptButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  receiptButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  receiptHint: {
    fontSize: 12,
    color: "#d1fae5",
    lineHeight: 18,
  },
  receiptList: {
    gap: 10,
  },
  receiptItem: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    gap: 6,
  },
  receiptItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  receiptStore: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  receiptDate: {
    fontSize: 12,
    color: "#9ca3af",
  },
  receiptTotal: {
    fontSize: 12,
    color: "#e5e7eb",
  },
  receiptSaved: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "700",
  },
  receiptInvalid: {
    fontSize: 11,
    color: "#fca5a5",
  },
  receiptEmpty: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 8,
  },
  storesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  storeCard: {
    width: "31%",
    borderRadius: 16,
    overflow: "hidden",
  },
  storeCardActive: {},
  storeCardLocked: {
    opacity: 0.6,
  },
  storeCardGradient: {
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.15)",
  },
  storeEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  storeName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
  },
  lockBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    borderRadius: 8,
    padding: 4,
  },
  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 8,
    padding: 4,
  },
  settingsList: {
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: 16,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.15)",
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  settingText: {
    flex: 1,
    fontSize: 15,
    color: "#fff",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  toastOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 30,
    alignItems: "center",
  },
  toastContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    backgroundColor: "rgba(2, 44, 34, 0.6)",
  },
  toastText: {
    color: "#d1fae5",
    fontSize: 14,
    fontWeight: "600",
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ef4444",
    marginLeft: 8,
  },
  settingItemDanger: {
    borderBottomWidth: 0,
  },
  settingTextDanger: {
    flex: 1,
    fontSize: 15,
    color: "#ef4444",
  },
  deleteIconContainer: {
    alignSelf: "center",
    marginBottom: 20,
  },
  deleteIconBg: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  deleteDescription: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelDeleteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  cancelDeleteText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  confirmDeleteButton: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  confirmDeleteGradient: {
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmDeleteText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  cancelIconContainer: {
    alignSelf: "center",
    marginBottom: 20,
  },
  cancelIconBg: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  cancelDescription: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  keepPremiumButton: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  keepPremiumGradient: {
    paddingVertical: 14,
    alignItems: "center",
  },
  keepPremiumText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9ca3af",
  },
  receiptModal: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    overflow: "hidden",
  },
  receiptModalGradient: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  receiptModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 16,
  },
  receiptPreview: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginBottom: 16,
  },
  receiptPlaceholder: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  receiptPlaceholderText: {
    fontSize: 13,
    color: "#cbd5e1",
  },
  receiptCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  receiptCheckBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  receiptCheckBoxChecked: {
    backgroundColor: "#22c55e",
  },
  receiptCheckText: {
    fontSize: 13,
    color: "#d1fae5",
    flex: 1,
    lineHeight: 18,
  },
  receiptErrorText: {
    fontSize: 12,
    color: "#fca5a5",
    marginBottom: 8,
  },
  receiptSuccessText: {
    fontSize: 12,
    color: "#86efac",
    marginBottom: 8,
  },
  receiptModalActions: {
    gap: 10,
  },
  receiptActionButton: {
    borderRadius: 14,
    overflow: "hidden",
  },
  receiptActionDisabled: {
    opacity: 0.7,
  },
  receiptActionGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  receiptActionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  receiptActionSecondary: {
    marginTop: 2,
  },
  nicknameModal: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    overflow: "hidden",
  },
  nicknameModalGradient: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  nicknameModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 16,
  },
  nicknameInputContainer: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.4)",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    marginBottom: 10,
  },
  nicknameInput: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: "#fff",
    fontSize: 15,
  },
  nicknameAvailabilityText: {
    fontSize: 12,
    marginBottom: 8,
  },
  nicknameAvailable: {
    color: "#10b981",
  },
  nicknameUnavailable: {
    color: "#f87171",
  },
  nicknameErrorText: {
    fontSize: 12,
    color: "#fca5a5",
    marginBottom: 8,
  },
  nicknameActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  nicknameCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  nicknameCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#cbd5e1",
  },
  nicknameSaveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  nicknameSaveGradient: {
    paddingVertical: 12,
    alignItems: "center",
  },
  nicknameSaveText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    overflow: "hidden",
  },
  modalGradient: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  modalClose: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
  modalLogo: {
    width: 174,
    height: 174,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  modalPrice: {
    fontSize: 16,
    color: "#fbbf24",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  modalFeatures: {
    marginBottom: 24,
  },
  modalFeatureRow: {
    flexDirection: "row",
  },
  modalFeatureCol: {
    flex: 1,
  },
  modalFeatureDivider: {
    width: 1,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    marginHorizontal: 16,
  },
  modalFeatureLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  modalFeatureLabelPremium: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fbbf24",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  modalFeature: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  modalFeatureText: {
    fontSize: 13,
    color: "#fff",
    marginLeft: 8,
  },
  modalFeatureTextDisabled: {
    fontSize: 13,
    color: "#6b7280",
    marginLeft: 8,
  },
  modalButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
  },
  modalButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginLeft: 8,
  },
  modalDisclaimer: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  familyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addMemberButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  addMemberText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fbbf24",
  },
  familyList: {
    gap: 12,
  },
  familyMemberCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    ...createShadow("#10b981", 0, 2, 0.1),
  },
  familyPendingCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    ...createShadow("#f59e0b", 0, 2, 0.1),
  },
  familyMemberIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  familyMemberInfo: {
    flex: 1,
  },
  familyMemberName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  familyMemberEmail: {
    fontSize: 13,
    color: "#9ca3af",
  },
  familyPendingText: {
    fontSize: 12,
    color: "#f59e0b",
    fontWeight: "600",
    marginTop: 2,
  },
  removeMemberButton: {
    padding: 4,
  },
  familyEmpty: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  familyEmptyText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  familyModalIcon: {
    alignSelf: "center",
    marginBottom: 20,
  },
  familyModalIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  familyInput: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#fff",
    marginBottom: 16,
  },
  familyErrorText: {
    fontSize: 13,
    color: "#ef4444",
    marginBottom: 12,
    textAlign: "center",
  },
  familySuccessText: {
    fontSize: 13,
    color: "#10b981",
    marginBottom: 12,
    textAlign: "center",
  },
  familyInviteButton: {
    borderRadius: 14,
    overflow: "hidden",
  },
  familyInviteGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  familyInviteText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0b0814",
  },
});



