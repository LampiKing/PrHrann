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
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as Linking from "expo-linking";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PREMIUM_FEATURES = [
  { icon: "infinite", title: "Neomejeno iskanje", description: "Brez dnevnih omejitev" },
  { icon: "pricetag", title: "Ekskluzivni kuponi", description: "Do 30% dodatni popusti" },
  { icon: "notifications", title: "Obvestila o cenah", description: "Ko pade cena izdelka" },
  { icon: "analytics", title: "Analiza prihrankov", description: "Mesečna statistika" },
  { icon: "star", title: "Prednostna podpora", description: "24/7 pomoč" },
];

export default function PremiumScreen() {
  const router = useRouter();
  const upgradeToPremium = useMutation(api.userProfiles.upgradeToPremium);
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Animations
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const checkmarkAnims = useRef(PREMIUM_FEATURES.map(() => new Animated.Value(0))).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Card entrance
    Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered checkmarks
    checkmarkAnims.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: 200 + index * 100,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }).start();
    });

    // Glow animation
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

  const handlePayment = async (method: "apple" | "google" | "card") => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setProcessing(true);

    try {
      // Simulate payment processing - v produkciji bi tukaj bil pravi payment provider
      // Za Apple Pay: uporabi expo-apple-authentication + Stripe
      // Za Google Pay: uporabi @stripe/stripe-react-native
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Upgrade user to premium
      await upgradeToPremium({});
      
      // Show success animation
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

      // Navigate back after success
      setTimeout(() => {
        router.replace("/(tabs)");
      }, 2000);
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
          colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.successContainer}>
          <Animated.View
            style={[
              styles.successIcon,
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
              style={styles.successIconBg}
            >
              <Ionicons name="checkmark" size={60} color="#000" />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.successTitle}>Čestitke! 🎉</Text>
          <Text style={styles.successText}>
            Zdaj si Premium uporabnik!{"\n"}Uživaj v neomejenih iskanjih.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Background Glow */}
      <Animated.View
        style={[
          styles.backgroundGlow,
          {
            opacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0.6],
            }),
          },
        ]}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Premium</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Premium Badge */}
          <Animated.View
            style={[
              styles.premiumBadge,
              {
                opacity: cardOpacity,
                transform: [{ scale: cardScale }],
              },
            ]}
          >
            <LinearGradient
              colors={["#fbbf24", "#f59e0b", "#d97706"]}
              style={styles.badgeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="diamond" size={40} color="#000" />
              <Text style={styles.badgeTitle}>PREMIUM</Text>
              <Text style={styles.badgePrice}>1,99 €</Text>
              <Text style={styles.badgePeriod}>/ mesec</Text>
            </LinearGradient>
          </Animated.View>

          {/* Features List */}
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>Kaj dobiš?</Text>
            {PREMIUM_FEATURES.map((feature, index) => (
              <Animated.View
                key={feature.title}
                style={[
                  styles.featureRow,
                  {
                    opacity: checkmarkAnims[index],
                    transform: [
                      {
                        translateX: checkmarkAnims[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [-30, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.featureIcon}>
                  <LinearGradient
                    colors={["rgba(251, 191, 36, 0.3)", "rgba(245, 158, 11, 0.1)"]}
                    style={styles.featureIconBg}
                  >
                    <Ionicons
                      name={feature.icon as keyof typeof Ionicons.glyphMap}
                      size={22}
                      color="#fbbf24"
                    />
                  </LinearGradient>
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              </Animated.View>
            ))}
          </View>

          {/* Payment Buttons - Direct Action */}
          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Izberi način plačila</Text>

            {/* Apple Pay Button */}
            <TouchableOpacity
              style={styles.paymentButton}
              onPress={() => handlePayment("apple")}
              disabled={processing}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#000", "#1a1a1a"]}
                style={styles.paymentButtonGradient}
              >
                <Ionicons name="logo-apple" size={24} color="#fff" />
                <Text style={styles.paymentButtonText}>Plačaj z Apple Pay</Text>
                <Text style={styles.paymentButtonPrice}>1,99 €</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Google Pay Button */}
            <TouchableOpacity
              style={styles.paymentButton}
              onPress={() => handlePayment("google")}
              disabled={processing}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#fff", "#f5f5f5"]}
                style={styles.paymentButtonGradient}
              >
                <View style={styles.googlePayIcon}>
                  <Text style={styles.googleG}>G</Text>
                </View>
                <Text style={[styles.paymentButtonText, { color: "#000" }]}>
                  Plačaj z Google Pay
                </Text>
                <Text style={[styles.paymentButtonPrice, { color: "#000" }]}>1,99 €</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Card Button */}
            <TouchableOpacity
              style={styles.paymentButton}
              onPress={() => handlePayment("card")}
              disabled={processing}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#8b5cf6", "#7c3aed"]}
                style={styles.paymentButtonGradient}
              >
                <Ionicons name="card" size={24} color="#fff" />
                <Text style={styles.paymentButtonText}>Kreditna kartica</Text>
                <Text style={styles.paymentButtonPrice}>1,99 €</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Processing Overlay */}
          {processing && (
            <View style={styles.processingOverlay}>
              <View style={styles.processingCard}>
                <Animated.View
                  style={[
                    styles.processingSpinner,
                    {
                      transform: [
                        {
                          rotate: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0deg", "360deg"],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Ionicons name="sync" size={32} color="#fbbf24" />
                </Animated.View>
                <Text style={styles.processingText}>Obdelava plačila...</Text>
              </View>
            </View>
          )}

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark" size={16} color="#10b981" />
            <Text style={styles.securityText}>
              Varno plačilo • Prekliči kadarkoli
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a12",
  },
  safeArea: {
    flex: 1,
  },
  backgroundGlow: {
    position: "absolute",
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH * 1.5,
    backgroundColor: "#fbbf24",
    borderRadius: SCREEN_WIDTH,
    top: -SCREEN_WIDTH * 0.5,
    left: -SCREEN_WIDTH * 0.25,
    opacity: 0.1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  premiumBadge: {
    alignItems: "center",
    marginBottom: 32,
  },
  badgeGradient: {
    width: SCREEN_WIDTH - 80,
    paddingVertical: 32,
    borderRadius: 24,
    alignItems: "center",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  badgeTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#000",
    marginTop: 12,
    letterSpacing: 2,
  },
  badgePrice: {
    fontSize: 48,
    fontWeight: "900",
    color: "#000",
    marginTop: 8,
  },
  badgePeriod: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(0, 0, 0, 0.6)",
    marginTop: -4,
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.1)",
  },
  featureIcon: {
    marginRight: 14,
  },
  featureIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  featureDescription: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 2,
  },
  paymentSection: {
    marginBottom: 24,
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  paymentButton: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  paymentButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 12,
  },
  paymentButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  paymentButtonPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  googlePayIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  googleG: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4285F4",
  },
  processingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  processingCard: {
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  processingSpinner: {
    marginBottom: 16,
  },
  processingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 8,
  },
  securityText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  // Success screen styles
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  successIcon: {
    marginBottom: 24,
  },
  successIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  successText: {
    fontSize: 16,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 24,
  },
});
