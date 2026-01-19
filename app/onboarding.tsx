import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FloatingBackground from "../lib/FloatingBackground";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ONBOARDING_KEY = "prhran_onboarding_completed";

interface OnboardingSlide {
  id: number;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  description: string;
  highlight?: string;
  gradient: [string, string];
}

const slides: OnboardingSlide[] = [
  {
    id: 1,
    icon: "cash-outline",
    title: "Hrana je draga.",
    subtitle: "Mi ti pomagamo prihraniti!",
    description: "Primerjamo cene v trgovinah,\nda ti ni treba.",
    highlight: "Brezplačno.",
    gradient: ["#dc2626", "#ef4444"],
  },
  {
    id: 2,
    icon: "search",
    title: "Vpiši izdelek.",
    subtitle: "Mi poiščemo najnižjo ceno.",
    description: "Spar, Mercator, Tuš...\nVse na enem mestu.",
    highlight: "V sekundi.",
    gradient: ["#7c3aed", "#a855f7"],
  },
  {
    id: 3,
    icon: "bag-check",
    title: "Naredi seznam.",
    subtitle: "Vidiš, kje je najceneje.",
    description: "Dodaj vse kar rabiš.\nAplikacija izračuna prihranek.",
    highlight: "Avtomatsko.",
    gradient: ["#059669", "#10b981"],
  },
  {
    id: 4,
    icon: "wallet",
    title: "Prihrani denar!",
    subtitle: "Vsak teden. Vsak mesec. Vsako leto.",
    description: "Povprečen uporabnik prihrani\ndo 30% na mesečnih nakupih.",
    highlight: "Začni zdaj!",
    gradient: ["#d97706", "#f59e0b"],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slideRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the highlight text
  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Start pulse on mount
  useState(() => {
    startPulse();
  });

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace("/auth");
    } catch (error) {
      console.error("Error saving onboarding state:", error);
      router.replace("/auth");
    }
  }, [router]);

  const goToNextSlide = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (currentIndex < slides.length - 1) {
      slideRef.current?.scrollTo({
        x: (currentIndex + 1) * SCREEN_WIDTH,
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    } else {
      completeOnboarding();
    }
  }, [currentIndex, completeOnboarding]);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        if (index !== currentIndex && index >= 0 && index < slides.length) {
          setCurrentIndex(index);
        }
      },
    }
  );

  const renderSlide = (slide: OnboardingSlide, index: number) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.85, 1, 0.85],
      extrapolate: "clamp",
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.5, 1, 0.5],
      extrapolate: "clamp",
    });

    const isLastSlide = index === slides.length - 1;

    return (
      <View key={slide.id} style={styles.slide}>
        <Animated.View style={[styles.slideContent, { transform: [{ scale }], opacity }]}>
          {/* Big Icon */}
          <View style={styles.iconWrapper}>
            <LinearGradient
              colors={slide.gradient}
              style={styles.iconCircle}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={slide.icon} size={80} color="#fff" />
            </LinearGradient>
          </View>

          {/* Main Title - Big and Bold */}
          <Text style={styles.mainTitle}>{slide.title}</Text>

          {/* Subtitle - Friendly */}
          <Text style={styles.subtitle}>{slide.subtitle}</Text>

          {/* Description - Simple */}
          <Text style={styles.description}>{slide.description}</Text>

          {/* Highlight - Eye-catching */}
          {slide.highlight && (
            <Animated.View style={[
              styles.highlightBadge,
              isLastSlide && { transform: [{ scale: pulseAnim }] }
            ]}>
              <LinearGradient
                colors={slide.gradient}
                style={styles.highlightGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.highlightText}>{slide.highlight}</Text>
              </LinearGradient>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    );
  };

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {slides.map((_, index) => {
          const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
          ];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [10, 28, 10],
            extrapolate: "clamp",
          });

          const dotOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity: dotOpacity,
                  backgroundColor: currentIndex === index ? "#a855f7" : "#6b7280",
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
      />
      <FloatingBackground variant="minimal" />

      {/* Skip - Only show if not last slide */}
      {!isLastSlide && (
        <TouchableOpacity
          style={[styles.skipButton, { top: insets.top + 16 }]}
          onPress={completeOnboarding}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Preskoči</Text>
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.ScrollView
        ref={slideRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {slides.map((slide, index) => renderSlide(slide, index))}
      </Animated.ScrollView>

      {/* Bottom */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        {renderDots()}

        {/* Big Action Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={goToNextSlide}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isLastSlide ? ["#059669", "#10b981"] : ["#7c3aed", "#a855f7"]}
            style={styles.actionButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.actionButtonText}>
              {isLastSlide ? "ZAČNI PRIHRANJEVAT" : "NAPREJ"}
            </Text>
            <Ionicons
              name={isLastSlide ? "rocket" : "arrow-forward"}
              size={22}
              color="#fff"
              style={{ marginLeft: 10 }}
            />
          </LinearGradient>
        </TouchableOpacity>

        {/* Trust indicators on last slide */}
        {isLastSlide && (
          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <Ionicons name="shield-checkmark" size={16} color="#10b981" />
              <Text style={styles.trustText}>Brezplačno</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="lock-closed" size={16} color="#10b981" />
              <Text style={styles.trustText}>Varno</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="flash" size={16} color="#10b981" />
              <Text style={styles.trustText}>Hitro</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a12",
  },
  skipButton: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
    marginRight: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
  },
  slide: {
    width: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  slideContent: {
    alignItems: "center",
    maxWidth: 360,
  },
  iconWrapper: {
    marginBottom: 32,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  mainTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#c4b5fd",
    textAlign: "center",
    marginBottom: 20,
  },
  description: {
    fontSize: 17,
    fontWeight: "500",
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 24,
  },
  highlightBadge: {
    borderRadius: 30,
    overflow: "hidden",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  highlightGradient: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 30,
  },
  highlightText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  dot: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  actionButton: {
    borderRadius: 30,
    overflow: "hidden",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  actionButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  trustRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    gap: 24,
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trustText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
});
