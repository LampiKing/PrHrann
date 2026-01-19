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
  iconColor: string;
  title: string;
  description: string;
  gradient: [string, string];
}

const slides: OnboardingSlide[] = [
  {
    id: 1,
    icon: "search",
    iconColor: "#a78bfa",
    title: "Poišči izdelke",
    description: "Išči med tisoči izdelki iz trgovin Spar, Mercator in Tuš. Primerjaj cene v trenutku!",
    gradient: ["#7c3aed", "#a855f7"],
  },
  {
    id: 2,
    icon: "pricetags",
    iconColor: "#34d399",
    title: "Primerjaj cene",
    description: "Takoj vidiš, kje je izdelek najcenejši. Nikoli več ne boš preplačal!",
    gradient: ["#059669", "#10b981"],
  },
  {
    id: 3,
    icon: "bag-outline",
    iconColor: "#fbbf24",
    title: "Ustvari seznam",
    description: "Dodaj izdelke na nakupovalni seznam. Aplikacija ti pokaže, kje boš najmanj zapravil.",
    gradient: ["#d97706", "#f59e0b"],
  },
  {
    id: 4,
    icon: "wallet",
    iconColor: "#f472b6",
    title: "Prihrani denar",
    description: "Spremljaj svoje prihranke in tekmuj z drugimi na lestvici najboljših!",
    gradient: ["#db2777", "#ec4899"],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slideRef = useRef<any>(null);

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

  const goToPrevSlide = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (currentIndex > 0) {
      slideRef.current?.scrollTo({
        x: (currentIndex - 1) * SCREEN_WIDTH,
        animated: true,
      });
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

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
      outputRange: [0.8, 1, 0.8],
      extrapolate: "clamp",
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4],
      extrapolate: "clamp",
    });

    return (
      <View key={slide.id} style={styles.slide}>
        <Animated.View style={[styles.slideContent, { transform: [{ scale }], opacity }]}>
          {/* Icon Circle */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={slide.gradient}
              style={styles.iconGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={slide.icon} size={64} color="#fff" />
            </LinearGradient>
          </View>

          {/* Title */}
          <Text style={styles.title}>{slide.title}</Text>

          {/* Description */}
          <Text style={styles.description}>{slide.description}</Text>
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
            outputRange: [8, 24, 8],
            extrapolate: "clamp",
          });

          const dotOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.4, 1, 0.4],
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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
      />
      <FloatingBackground variant="minimal" />

      {/* Skip Button */}
      <TouchableOpacity
        style={[styles.skipButton, { top: insets.top + 16 }]}
        onPress={completeOnboarding}
        activeOpacity={0.7}
      >
        <Text style={styles.skipText}>Preskoči</Text>
      </TouchableOpacity>

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

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 24 }]}>
        {/* Dots */}
        {renderDots()}

        {/* Navigation Buttons */}
        <View style={styles.navButtons}>
          {/* Back Button */}
          {currentIndex > 0 ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={goToPrevSlide}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#9ca3af" />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}

          {/* Next/Start Button */}
          <TouchableOpacity
            style={styles.nextButton}
            onPress={goToNextSlide}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#7c3aed", "#a855f7"]}
              style={styles.nextButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.nextButtonText}>
                {currentIndex === slides.length - 1 ? "Začni" : "Naprej"}
              </Text>
              <Ionicons
                name={currentIndex === slides.length - 1 ? "checkmark" : "arrow-forward"}
                size={20}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
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
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  slideContent: {
    alignItems: "center",
    maxWidth: 340,
  },
  iconContainer: {
    marginBottom: 40,
    borderRadius: 60,
    overflow: "hidden",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 16,
    fontWeight: "500",
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 24,
  },
  bottomNav: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  navButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonPlaceholder: {
    width: 48,
  },
  nextButton: {
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
