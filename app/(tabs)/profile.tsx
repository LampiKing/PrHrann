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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { useConvexAuth } from "convex/react";

const STORES = [
  { name: "Spar", emoji: "🟢", color: "#22c55e" },
  { name: "Mercator", emoji: "🔵", color: "#3b82f6" },
  { name: "Tus", emoji: "🟡", color: "#eab308" },
  { name: "Hofer", emoji: "🔴", color: "#ef4444", premium: true },
  { name: "Lidl", emoji: "🟠", color: "#f97316", premium: true },
  { name: "Jager", emoji: "🟣", color: "#a855f7", premium: true },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [favoriteStores, setFavoriteStores] = useState<string[]>(["Spar", "Mercator", "Tus"]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const profile = useQuery(
    api.userProfiles.getProfile,
    isAuthenticated ? {} : "skip"
  );
  const upgradeToPremium = useMutation(api.userProfiles.upgradeToPremium);

  const isPremium = profile?.isPremium ?? false;
  const searchesToday = profile?.dailySearches ?? 0;
  const maxSearches = isPremium ? 999 : 3;
  const searchProgress = isPremium ? 1 : searchesToday / maxSearches;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: searchProgress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [searchProgress]);

  const handleUpgrade = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.push("/premium");
  };

  const toggleFavoriteStore = (storeName: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setFavoriteStores((prev) =>
      prev.includes(storeName)
        ? prev.filter((s) => s !== storeName)
        : [...prev, storeName]
    );
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      router.replace("/auth");
    } catch (error) {
      console.error("Napaka pri odjavi:", error);
    }
  };

  const handleDeleteAccount = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    try {
      await authClient.signOut();
      router.replace("/auth");
      // Note: Full account deletion would require backend implementation
    } catch (error) {
      console.error("Napaka pri brisanju:", error);
    }
    setShowDeleteModal(false);
  };

  const handleCancelSubscription = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    // Note: Subscription cancellation would require payment provider integration
    setShowCancelModal(false);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.authPrompt, { paddingTop: insets.top + 40 }]}>
          <Image
            source={require("@/assets/images/1595E33B-B540-4C55-BAA2-E6DA6596BEFF.png")}
            style={styles.authLogo}
            resizeMode="contain"
          />
          <Text style={styles.authTitle}>Prijavi se</Text>
          <Text style={styles.authText}>
            Za dostop do profila in shranjevanje{"\n"}nastavitev se prijavi v svoj račun
          </Text>
          <TouchableOpacity style={styles.authButton} onPress={() => router.push("/auth")}>
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
            source={require("@/assets/images/1595E33B-B540-4C55-BAA2-E6DA6596BEFF.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Moj profil</Text>
        </Animated.View>

        {/* Plan Card */}
        <Animated.View style={[styles.planCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient
            colors={
              isPremium
                ? ["rgba(251, 191, 36, 0.2)", "rgba(245, 158, 11, 0.1)"]
                : ["rgba(139, 92, 246, 0.15)", "rgba(59, 7, 100, 0.3)"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.planGradient,
              isPremium && styles.planGradientPremium,
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
                    {isPremium ? "PREMIUM" : "BREZPLAČNO"}
                  </Text>
                </View>
                <Text style={styles.planPrice}>
                  {isPremium ? "1,99 €/mesec" : "0 €/mesec"}
                </Text>
              </View>
              {!isPremium && (
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
                    <Ionicons name="star" size={14} color="#000" />
                    <Text style={styles.upgradeText}>Nadgradi</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* Search Progress */}
            <View style={styles.searchProgress}>
              <View style={styles.searchProgressHeader}>
                <Text style={styles.searchProgressLabel}>Dnevna iskanja</Text>
                <Text style={styles.searchProgressValue}>
                  {isPremium ? "∞" : `${searchesToday}/${maxSearches}`}
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
              {!isPremium && searchesToday >= 2 && (
                <Text style={styles.searchWarning}>
                  ⚠️ Skoraj si porabil dnevna iskanja
                </Text>
              )}
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
                  {isPremium ? "Neomejeno iskanj" : "3 iskanja na dan"}
                </Text>
              </View>
              <View style={styles.planFeature}>
                <Ionicons
                  name={isPremium ? "checkmark-circle" : "close-circle-outline"}
                  size={18}
                  color={isPremium ? "#10b981" : "#6b7280"}
                />
                <Text style={[styles.planFeatureText, !isPremium && styles.planFeatureTextDisabled]}>
                  {isPremium ? "Vse trgovine" : "Samo osnovne trgovine"}
                </Text>
              </View>
              <View style={styles.planFeature}>
                <Ionicons
                  name={isPremium ? "checkmark-circle" : "close-circle-outline"}
                  size={18}
                  color={isPremium ? "#10b981" : "#6b7280"}
                />
                <Text style={[styles.planFeatureText, !isPremium && styles.planFeatureTextDisabled]}>
                  {isPremium ? "Optimizacija košarice" : "Brez optimizacije"}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Settings */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Nastavitve</Text>

          <View style={styles.settingsList}>
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
              <Text style={styles.settingText}>Lojalnostne kartice</Text>
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
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.signOutText}>Odjava</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

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
                source={require("@/assets/images/1595E33B-B540-4C55-BAA2-E6DA6596BEFF.png")}
                style={styles.modalLogo}
                resizeMode="contain"
              />

              <Text style={styles.modalTitle}>Pr'Hran Premium</Text>
              <Text style={styles.modalPrice}>1,99 €/mesec</Text>

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
                      <Text style={styles.modalFeatureTextDisabled}>Hofer, Lidl, Jager</Text>
                    </View>
                    <View style={styles.modalFeature}>
                      <Ionicons name="close" size={16} color="#ef4444" />
                      <Text style={styles.modalFeatureTextDisabled}>Optimizacija</Text>
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
                      <Text style={styles.modalFeatureText}>Vse trgovine</Text>
                    </View>
                    <View style={styles.modalFeature}>
                      <Ionicons name="checkmark" size={16} color="#10b981" />
                      <Text style={styles.modalFeatureText}>Optimizacija</Text>
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
                  <Text style={styles.modalButtonText}>Nadgradi na Premium</Text>
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
                • Neomejenega iskanja{"\n"}
                • Vseh trgovin{"\n"}
                • Optimizacije košarice
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
    width: 70,
    height: 70,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  authPrompt: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  authLogo: {
    width: 100,
    height: 100,
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
    marginBottom: 24,
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
    marginBottom: 24,
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.1)",
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
    width: 80,
    height: 80,
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
});
