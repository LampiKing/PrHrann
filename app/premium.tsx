import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SOLO_FEATURES = [
  { icon: "infinite", title: "Neomejeno iskanje", description: "Brez dnevnih omejitev" },
  { icon: "list", title: "Nakupovalni seznami", description: "Ustvari in organiziraj" },
  { icon: "notifications", title: "Obvestila o cenah", description: "Ko pade cena izdelka" },
  { icon: "analytics", title: "Sledenje prihrankom", description: "Mesečna statistika" },
  { icon: "pricetag", title: "Ekskluzivni kuponi", description: "Do 30% dodatni popusti" },
  { icon: "star", title: "Prednostna podpora", description: "24/7 pomoč" },
];

const FAMILY_BONUS_FEATURES = [
  { icon: "people", title: "Do 3 uporabniki", description: "Deli Premium z družino" },
  { icon: "sync", title: "Deljenje seznamov", description: "Sinhronizacija v živo" },
  { icon: "shield-checkmark", title: "Varnostni nadzor", description: "GEO-lock zaščita" },
];

export default function PremiumScreen() {
  const router = useRouter();
  const profile = useQuery(api.userProfiles.getProfile);
  const upgradeToPremium = useMutation(api.userProfiles.upgradeToPremium);
  
  const [selectedPlan, setSelectedPlan] = useState<"solo" | "family">("family");
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

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

    // Continuous glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handlePayment = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setProcessing(true);

    try {
      // TODO: Real payment integration
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      await upgradeToPremium({});
      
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
            <Text style={styles.successTitle}>Čestitamo! 🎉</Text>
            <Text style={styles.successText}>
              Zdaj ste Premium {selectedPlan === "family" ? "Family" : "Solo"} uporabnik!
            </Text>
            <Text style={styles.successSubtext}>
              Uživajte v vseh funkcijah brez omejitev.
            </Text>
          </Animated.View>
        </View>
      </View>
    );
  }

  const price = selectedPlan === "family" ? "2,99" : "1,99";
  const features = selectedPlan === "family" 
    ? [...SOLO_FEATURES, ...FAMILY_BONUS_FEATURES]
    : SOLO_FEATURES;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0f0a1e", "#1a0a2e", "#270a3a"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated glow */}
      <Animated.View
        style={[
          styles.glowOrb,
          {
            opacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.2, 0.4],
            }),
          },
        ]}
      />

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
              <Text style={styles.mainTitle}>Nadgradite na Premium</Text>
              <Text style={styles.subtitle}>
                Odklenite vse funkcije in privarčujte več kot kdaj koli prej
              </Text>
            </View>

            {/* Plan Selector */}
            <View style={styles.planSelector}>
              {/* Solo Plan */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedPlan("solo");
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                style={[
                  styles.planCard,
                  selectedPlan === "solo" && styles.planCardActive,
                ]}
              >
                {selectedPlan === "solo" && (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                  </View>
                )}
                <View style={styles.planHeader}>
                  <Ionicons name="person" size={32} color="#8b5cf6" />
                  <Text style={styles.planName}>Solo</Text>
                </View>
                <Text style={styles.planPrice}>1,99€</Text>
                <Text style={styles.planPeriod}>na mesec</Text>
                <Text style={styles.planDescription}>
                  Popolno za posamezne uporabnike
                </Text>
              </TouchableOpacity>

              {/* Family Plan */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedPlan("family");
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                style={[
                  styles.planCard,
                  selectedPlan === "family" && styles.planCardActive,
                ]}
              >
                <View style={styles.popularBadge}>
                  <LinearGradient
                    colors={["#fbbf24", "#f59e0b"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.popularBadgeGradient}
                  >
                    <Text style={styles.popularBadgeText}>PRILJUBLJENO</Text>
                  </LinearGradient>
                </View>
                {selectedPlan === "family" && (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                  </View>
                )}
                <View style={styles.planHeader}>
                  <Ionicons name="people" size={32} color="#f59e0b" />
                  <Text style={styles.planName}>Family</Text>
                </View>
                <Text style={styles.planPrice}>2,99€</Text>
                <Text style={styles.planPeriod}>na mesec</Text>
                <Text style={styles.planDescription}>
                  Do 3 uporabnikov + deljenje seznamov
                </Text>
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>Prihraniš 3€/mesec</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Features List */}
            <View style={styles.featuresContainer}>
              <Text style={styles.featuresTitle}>Kaj dobite?</Text>
              {features.map((feature, index) => (
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
                        name={feature.icon as any}
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
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0deg", "360deg"],
                          }),
                        },
                      ],
                    }}
                  >
                    <Ionicons name="sync" size={24} color="#fff" />
                  </Animated.View>
                ) : (
                  <>
                    <Text style={styles.ctaText}>
                      Začni z {price}€/mesec
                    </Text>
                    <Ionicons name="arrow-forward" size={24} color="#fff" />
                  </>
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
  glowOrb: {
    position: "absolute",
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH * 1.5,
    backgroundColor: "#fbbf24",
    borderRadius: SCREEN_WIDTH,
    top: -SCREEN_WIDTH * 0.7,
    left: SCREEN_WIDTH * 0.1,
    opacity: 0.2,
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
    gap: 12,
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
  planCardActive: {
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    borderColor: "#8b5cf6",
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  selectedBadge: {
    position: "absolute",
    top: 12,
    right: 12,
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
  },
  ctaButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 12,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
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
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
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
});
