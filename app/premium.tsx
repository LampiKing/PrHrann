import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PLAN_FREE, PLAN_PLUS, PLAN_FAMILY, MARKETING } from "@/lib/branding";
import { createShadow } from "@/lib/shadow-helper";
import FloatingBackground from "@/lib/FloatingBackground";

const INDIVIDUAL_FEATURES = [
  { icon: "infinite", title: "Neomejeno iskanje", description: "Brez dnevnih omejitev v vseh trgovinah." },
  { icon: "camera", title: "Slikaj izdelek", description: "Takoj najde najnižjo ceno." },
  { icon: "pricetag", title: "Pametni kuponi", description: "Več akcij in ekskluzivni kuponi." },
  { icon: "analytics", title: "Pregled prihrankov", description: "Sledenje prihrankom po računih." },
  { icon: "trophy", title: "Lestvice in značke", description: "Tekmuj in zbiraj nagrade." },
];

const FAMILY_BONUS_FEATURES = [
  { icon: "people", title: "Do 3 profilov", description: "Povabi do 2 člana (skupaj 3 profili)." },
  { icon: "trophy", title: "Družinska mini liga", description: "Kdo bo v družini prihranil največ?" },
  { icon: "person-circle", title: "Vsak svoj profil", description: "Premium ugodnosti za vse člane." },
];

export default function PremiumScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const upgradeToPremium = useMutation(api.userProfiles.upgradeToPremium);

  // Animations - MUST be before any early returns
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  // Check if user is guest (anonymous)
  const profile = useQuery(
    api.userProfiles.getProfile,
    isAuthenticated ? {} : "skip"
  );
  const isGuest = profile ? (profile.isAnonymous || !profile.email) : false;
  const isAlreadyPremium = profile?.isPremium ?? false;
  const currentPremiumType = profile?.premiumType ?? "solo";

  const [selectedPlan, setSelectedPlan] = useState<"individual" | "family">(
    isAlreadyPremium && currentPremiumType === "solo" ? "family" : "individual"
  );
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const selectedPlanLabel = selectedPlan === "family" ? PLAN_FAMILY : PLAN_PLUS;

  // Show loading during auth check
  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#0f0a1e", "#1a0a2e", "#270a3a"]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Animated.View style={{ opacity: fadeAnim }}>
              <Ionicons name="diamond" size={48} color="#fbbf24" />
              <Text style={{ color: "#9ca3af", marginTop: 16, fontSize: 14 }}>Nalaganje...</Text>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
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

  const handlePayment = async () => {
    // If guest, show auth modal instead of payment
    if (isGuest || !isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    // Validate plan selection
    if (!selectedPlan) {
      console.error("No plan selected");
      return;
    }
    
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setProcessing(true);

    try {
      // TODO: Real payment integration
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      await upgradeToPremium({
        planType: selectedPlan === "family" ? "family" : "solo"
      });
      
      setPaymentSuccess(true);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Animated.spring(successAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        router.replace("/(tabs)");
      }, 2500);
    } catch (error) {
      console.error("Payment error:", error);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setProcessing(false);
    }
  };

  if (paymentSuccess) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#0f0a1e", "#1a0a2e", "#270a3a"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.successContainer}>
          <Animated.View
            style={[
              {
                opacity: successAnim,
                transform: [
                  {
                    scale: successAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={["#fbbf24", "#f59e0b", "#d97706"]}
              style={styles.successBadge}
            >
              <Ionicons name="checkmark-circle" size={80} color="#fff" />
            </LinearGradient>
            <Text style={styles.successTitle}>Čestitamo!</Text>
            <Text style={styles.successText}>
              Zdaj ste {selectedPlanLabel} uporabnik!
            </Text>
            <Text style={styles.successSubtext}>
              Uživajte v vseh funkcijah brez omejitev.
            </Text>
          </Animated.View>
        </View>
      </View>
    );
  }

  const price = selectedPlan === "family" ? "3,99" : "1,99";
  const features = selectedPlan === "family" 
    ? [...INDIVIDUAL_FEATURES, ...FAMILY_BONUS_FEATURES]
    : INDIVIDUAL_FEATURES;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0f0a1e", "#1a0a2e", "#270a3a"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating background icons */}
      <FloatingBackground variant="sparse" />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* Header */}
            <View style={styles.titleContainer}>
              <LinearGradient
                colors={["#fbbf24", "#f59e0b"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.premiumBadge}
              >
                <Ionicons name="diamond" size={24} color="#000" />
                <Text style={styles.premiumBadgeText}>PREMIUM</Text>
              </LinearGradient>
              <Text style={styles.mainTitle}>Nadgradi na {selectedPlanLabel}</Text>
              <Text style={styles.subtitle}>
                {isAlreadyPremium && currentPremiumType === "solo" 
                  ? `Deli ${PLAN_FAMILY} z družino in prihrani še več`
                  : "Odkleni vse funkcije in varčuj več kot kdaj koli prej"
                }
              </Text>
            </View>

            {/* Plan Selector */}
            <View style={styles.planSelector}>
              {/* Individual Plan - show only if not already premium */}
              {!isAlreadyPremium && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    setSelectedPlan("individual");
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  style={[
                    styles.planCard,
                    selectedPlan === "individual" && styles.planCardActivePlus,
                  ]}
                >
                  {selectedPlan === "individual" && (
                    <View style={[styles.selectedBadge, styles.selectedBadgePlus]}>
                      <Ionicons name="checkmark-circle" size={22} color="#0b0814" />
                      <Text style={styles.selectedBadgeText}>Izbrano</Text>
                    </View>
                  )}
                  <View style={styles.planHeader}>
                    <Ionicons name="person" size={32} color="#8b5cf6" />
                    <Text style={styles.planName}>{PLAN_PLUS}</Text>
                  </View>
                  <Text style={styles.planPrice}>1,99 EUR</Text>
                  <Text style={styles.planPeriod}>/ mesec</Text>
                  <Text style={styles.planDescription}>{MARKETING.blurbs.plusShort}</Text>
                </TouchableOpacity>
              )}

              {/* Family Plan */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setSelectedPlan("family");
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                style={[
                  styles.planCard,
                  selectedPlan === "family" && styles.planCardActiveFamily,
                ]}
              >
                <View style={styles.popularBadge}>
                  <LinearGradient
                    colors={["#fbbf24", "#f59e0b"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.popularBadgeGradient}
                  >
                    <Text style={styles.popularBadgeText}>NAJBOLJŠE</Text>
                  </LinearGradient>
                </View>
                {selectedPlan === "family" && (
                  <View style={[styles.selectedBadge, styles.selectedBadgeFamily]}>
                    <Ionicons name="checkmark-circle" size={22} color="#0b0814" />
                    <Text style={styles.selectedBadgeText}>Izbrano</Text>
                  </View>
                )}
                <View style={styles.planHeader}>
                  <Ionicons name="people" size={32} color="#f59e0b" />
                  <Text style={styles.planName}>{PLAN_FAMILY}</Text>
                </View>
                <Text style={styles.planPrice}>
                  {isAlreadyPremium && currentPremiumType === "solo" ? "+2 EUR" : "3,99 EUR"}
                </Text>
                <Text style={styles.planPeriod}>
                  {isAlreadyPremium && currentPremiumType === "solo" ? "dodatek" : "/ mesec"}
                </Text>
                <Text style={styles.planDescription}>{MARKETING.blurbs.familyShort}</Text>
                <View style={styles.discountBadge}>
                  <LinearGradient colors={["#22c55e", "#16a34a"]} style={styles.discountBadgeGradient}>
                    <Text style={styles.discountBadgeText}>33% ceneje na osebo</Text>
                  </LinearGradient>
                </View>
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>Skupaj do 3 profilov</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Features Comparison */}
            <View style={styles.comparisonContainer}>
              <Text style={styles.comparisonTitle}>Kaj dobiš z vsakim paketom?</Text>
              
              <View style={styles.comparisonTable}>
                {/* Header */}
                <View style={styles.comparisonRow}>
                  <View style={[styles.comparisonCell, styles.featureNameCell]}>
                    <Text style={styles.comparisonHeaderText}>Funkcija</Text>
                  </View>
                  <View style={[styles.comparisonCell, styles.basicCell]}>
                    <Text style={styles.comparisonHeaderText}>{PLAN_FREE}</Text>
                  </View>
                  <View style={[styles.comparisonCell, styles.premiumCell]}>
                    <Text style={styles.comparisonHeaderText}>{PLAN_PLUS}</Text>
                  </View>
                  <View style={[styles.comparisonCell, styles.familyCell]}>
                    <Text style={styles.comparisonHeaderText}>{PLAN_FAMILY}</Text>
                  </View>
                </View>

                {/* Comparison Items */}
                <View style={styles.comparisonRow}>
                  <View style={[styles.comparisonCell, styles.featureNameCell]}>
                    <Text style={styles.comparisonItemText}>Iskanja na dan</Text>
                  </View>
                  <View style={[styles.comparisonCell, styles.basicCell]}>
                    <Text style={styles.comparisonValue}>3/dan</Text>
                  </View>
                  <View style={[styles.comparisonCell, styles.premiumCell]}>
                    <Text style={styles.comparisonValue}>{MARKETING.labels.unlimited}</Text>
                  </View>
                  <View style={[styles.comparisonCell, styles.familyCell]}>
                    <Text style={styles.comparisonValue}>{MARKETING.labels.unlimited}</Text>
                  </View>
                </View>

                <View style={styles.comparisonRow}>
                  <View style={[styles.comparisonCell, styles.featureNameCell]}>
                    <Text style={styles.comparisonItemText}>Slikanje izdelkov</Text>
                  </View>
                  <View style={[styles.comparisonCell, styles.basicCell]}>
                    <Ionicons name="close" size={20} color="#ef4444" />
                  </View>
                  <View style={[styles.comparisonCell, styles.premiumCell]}>
                    <Ionicons name="checkmark" size={20} color="#22c55e" />
                  </View>
                  <View style={[styles.comparisonCell, styles.familyCell]}>
                    <Ionicons name="checkmark" size={20} color="#22c55e" />
                  </View>
                </View>

                <View style={styles.comparisonRow}>
                  <View style={[styles.comparisonCell, styles.featureNameCell]}>
                    <Text style={styles.comparisonItemText}>Kamera za račune</Text>
                  </View>
                  <View style={[styles.comparisonCell, styles.basicCell]}>
                    <Ionicons name="checkmark" size={20} color="#22c55e" />
                  </View>
                  <View style={[styles.comparisonCell, styles.premiumCell]}>
                    <Ionicons name="checkmark" size={20} color="#22c55e" />
                  </View>
                  <View style={[styles.comparisonCell, styles.familyCell]}>
                    <Ionicons name="checkmark" size={20} color="#22c55e" />
                  </View>
                </View>

                <View style={styles.comparisonRow}>
                  <View style={[styles.comparisonCell, styles.featureNameCell]}>
                    <Text style={styles.comparisonItemText}>Družinska mini liga</Text>
                  </View>
                  <View style={[styles.comparisonCell, styles.basicCell]}>
                    <Ionicons name="close" size={20} color="#ef4444" />
                  </View>
                  <View style={[styles.comparisonCell, styles.premiumCell]}>
                    <Ionicons name="close" size={20} color="#ef4444" />
                  </View>
                  <View style={[styles.comparisonCell, styles.familyCell]}>
                    <Ionicons name="checkmark" size={20} color="#22c55e" />
                  </View>
                </View>

                <View style={styles.comparisonRow}>
                  <View style={[styles.comparisonCell, styles.featureNameCell]}>
                    <Text style={styles.comparisonItemText}>Št. uporabnikov</Text>
                  </View>
                  <View style={[styles.comparisonCell, styles.basicCell]}>
                    <Text style={styles.comparisonValue}>1</Text>
                  </View>
                  <View style={[styles.comparisonCell, styles.premiumCell]}>
                    <Text style={styles.comparisonValue}>1</Text>
                  </View>
                  <View style={[styles.comparisonCell, styles.familyCell]}>
                    <Text style={styles.comparisonValue}>3</Text>
                  </View>
                </View>

                <View style={styles.comparisonRow}>
                  <View style={[styles.comparisonCell, styles.featureNameCell]}>
                    <Text style={styles.comparisonItemText}>Prednostna podpora</Text>
                  </View>
                  <View style={[styles.comparisonCell, styles.basicCell]}>
                    <Ionicons name="close" size={20} color="#ef4444" />
                  </View>
                  <View style={[styles.comparisonCell, styles.premiumCell]}>
                    <Ionicons name="checkmark" size={20} color="#22c55e" />
                  </View>
                  <View style={[styles.comparisonCell, styles.familyCell]}>
                    <Ionicons name="checkmark" size={20} color="#22c55e" />
                  </View>
                </View>

                {/* Removed ads row: no ads in any plan */}

                {/* Removed duplicate rows for cleaner, symmetric table */}
              </View>

              {/* Comparison footer for clarity */}
              <Text style={styles.comparisonFooter}>{MARKETING.footerLine}</Text>
            </View>

            {/* Features List */}
            <View style={styles.featuresContainer}>
              <Text style={styles.featuresTitle}>Prednosti izbranega paketa</Text>
              {features.map((feature) => (
                <View key={feature.title} style={styles.featureRow}>
                  <View style={styles.featureIconContainer}>
                    <LinearGradient
                      colors={
                        selectedPlan === "family"
                          ? ["#fbbf24", "#f59e0b"]
                          : ["#8b5cf6", "#7c3aed"]
                      }
                      style={styles.featureIconBg}
                    >
                      <Ionicons
                        name={feature.icon as keyof typeof Ionicons.glyphMap}
                        size={20}
                        color="#fff"
                      />
                    </LinearGradient>
                  </View>
                  <View style={styles.featureTextContainer}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription}>
                      {feature.description}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                </View>
              ))}
            </View>

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handlePayment}
              disabled={processing}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={
                  selectedPlan === "family"
                    ? ["#fbbf24", "#f59e0b", "#d97706"]
                    : ["#8b5cf6", "#7c3aed", "#6d28d9"]
                }
                style={styles.ctaGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {processing ? (
                  <Ionicons name="sync" size={24} color="#fff" />
                ) : (
                  <View style={styles.ctaContent}>
                    <Text style={styles.ctaText}>Nadaljuj na plačilo</Text>
                    <Text style={styles.ctaPrice}>
                      {selectedPlanLabel} • {price} EUR/mesec
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Trust badges */}
            <View style={styles.trustBadges}>
              <View style={styles.trustBadge}>
                <Ionicons name="shield-checkmark" size={16} color="#10b981" />
                <Text style={styles.trustText}>Varno plačilo</Text>
              </View>
              <View style={styles.trustBadge}>
                <Ionicons name="refresh" size={16} color="#10b981" />
                <Text style={styles.trustText}>Prekliči kadarkoli</Text>
              </View>
              <View style={styles.trustBadge}>
                <Ionicons name="lock-closed" size={16} color="#10b981" />
                <Text style={styles.trustText}>SSL zaščita</Text>
              </View>
            </View>

            <Text style={styles.disclaimer}>
              Mesečna naročnina z avtomatskim podaljšanjem. Prekličete lahko kadarkoli
              brez dodatnih stroškov. Vse cene vključujejo DDV.
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* Auth Required Modal for Guests */}
      <Modal
        transparent
        visible={showAuthModal}
        onRequestClose={() => setShowAuthModal(false)}
        animationType="fade"
        hardwareAccelerated
      >
        <View style={styles.authModalOverlay}>
          <View style={styles.authModal}>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.98)", "rgba(88, 28, 135, 0.99)"]}
              style={styles.authModalGradient}
            >
              <TouchableOpacity
                style={styles.authCloseBtn}
                onPress={() => setShowAuthModal(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>

              <View style={styles.authIconContainer}>
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b"]}
                  style={styles.authIconGradient}
                >
                  <Ionicons name="person-add" size={44} color="#000" />
                </LinearGradient>
              </View>

              <Text style={styles.authModalTitle}>Prijava potrebna</Text>
              <Text style={styles.authModalSubtitle}>
                Za nakup Premium naročnine se moraš najprej prijaviti ali registrirati.
              </Text>

              <View style={styles.authBenefits}>
                <View style={styles.authBenefitItem}>
                  <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                  <Text style={styles.authBenefitText}>Brezplačna registracija</Text>
                </View>
                <View style={styles.authBenefitItem}>
                  <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                  <Text style={styles.authBenefitText}>3 iskanja na dan - zastonj!</Text>
                </View>
                <View style={styles.authBenefitItem}>
                  <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                  <Text style={styles.authBenefitText}>Možnost nadgradnje kadarkoli</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.authPrimaryBtn}
                onPress={() => {
                  setShowAuthModal(false);
                  setTimeout(() => {
                    router.push({ pathname: "/auth", params: { mode: "register" } });
                  }, 0);
                }}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b", "#d97706"]}
                  style={styles.authPrimaryBtnGradient}
                >
                  <Ionicons name="log-in" size={22} color="#000" />
                  <Text style={styles.authPrimaryBtnText}>PRIJAVA / REGISTRACIJA</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.authSecondaryBtn}
                onPress={() => setShowAuthModal(false)}
              >
                <Text style={styles.authSecondaryBtnText}>Nadaljuj brez prijave</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
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
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.7)",
    ...createShadow("#fbbf24", 0, 8, 0.4, 20, 10),
  },
  premiumBadgeText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  planSelector: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 32,
  },
  planCard: {
    flex: 1,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: "rgba(139, 92, 246, 0.2)",
    position: "relative",
  },
  planCardActivePlus: {
    backgroundColor: "rgba(139, 92, 246, 0.25)",
    borderColor: "#c084fc",
    ...createShadow("#8b5cf6", 0, 8, 0.35, 16, 10),
  },
  planCardActiveFamily: {
    backgroundColor: "rgba(251, 191, 36, 0.18)",
    borderColor: "#fbbf24",
    ...createShadow("#fbbf24", 0, 10, 0.4, 18, 12),
  },
  selectedBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
  },
  selectedBadgePlus: {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderColor: "rgba(192, 132, 252, 0.7)",
  },
  selectedBadgeFamily: {
    backgroundColor: "rgba(251, 191, 36, 0.95)",
    borderColor: "rgba(217, 119, 6, 0.9)",
  },
  selectedBadgeText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    left: "50%",
    marginLeft: -50,
    width: 100,
  },
  popularBadgeGradient: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 0.5,
  },
  planHeader: {
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginTop: 8,
  },
  planPrice: {
    fontSize: 36,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
  },
  planPeriod: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
  },
  discountBadge: {
    marginTop: 12,
    alignSelf: "center",
  },
  discountBadgeGradient: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.6)",
  },
  discountBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f0fdf4",
    letterSpacing: 0.2,
  },
  savingsBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 12,
    alignSelf: "center",
  },
  savingsText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10b981",
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.1)",
  },
  featureIconContainer: {
    marginRight: 12,
  },
  featureIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: "#9ca3af",
    lineHeight: 18,
  },
  ctaButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
    ...createShadow("#000", 0, 8, 0.3, 16, 10),
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  ctaContent: {
    alignItems: "center",
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  ctaPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 4,
    textAlign: "center",
  },
  trustBadges: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 16,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trustText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  disclaimer: {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  // Success screen
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  successBadge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    ...createShadow("#fbbf24", 0, 8, 0.6, 20, 15),
  },
  successTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  successText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
  },
  comparisonContainer: {
    marginBottom: 32,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(30, 30, 46, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    padding: 0,
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.1)",
  },
  comparisonTable: {
    overflow: "hidden",
  },
  comparisonRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.1)",
    alignItems: "center",
  },
  comparisonCell: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  featureNameCell: {
    flex: 1.3,
    alignItems: "flex-start",
    paddingLeft: 12,
  },
  basicCell: {
    flex: 0.9,
    backgroundColor: "rgba(107, 114, 128, 0.1)",
  },
  premiumCell: {
    flex: 0.9,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
  },
  familyCell: {
    flex: 0.9,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
  },
  comparisonHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#e5e7eb",
    textAlign: "center",
  },
  comparisonItemText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
  },
  comparisonValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b5cf6",
    textAlign: "center",
  },
  comparisonFooter: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    paddingVertical: 12,
  },
  // Auth Modal Styles
  authModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  authModal: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    overflow: "hidden",
    ...createShadow("#8b5cf6", 0, 8, 0.4, 24, 20),
  },
  authModalGradient: {
    padding: 28,
    alignItems: "center",
  },
  authCloseBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  authIconContainer: {
    marginBottom: 20,
    ...createShadow("#fbbf24", 0, 4, 0.5, 16, 8),
  },
  authIconGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  authModalTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
  },
  authModalSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.85)",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  authBenefits: {
    width: "100%",
    marginBottom: 24,
    gap: 14,
  },
  authBenefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
  },
  authBenefitText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  authPrimaryBtn: {
    width: "100%",
    marginBottom: 14,
    borderRadius: 16,
    overflow: "hidden",
    ...createShadow("#fbbf24", 0, 4, 0.4, 12, 8),
  },
  authPrimaryBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 10,
  },
  authPrimaryBtnText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 0.5,
  },
  authSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  authSecondaryBtnText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
  },
});


