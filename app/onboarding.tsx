import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Platform,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FloatingBackground from "../lib/FloatingBackground";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

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

// Celebration particles config
const PARTICLE_COUNT = 20;
const DISCOUNT_BADGES = ["-30%", "-25%", "-20%", "-15%", "€€€", "-50%", "WOW!", "-40%"];
const PARTICLE_COLORS = ["#a855f7", "#22c55e", "#f59e0b", "#ec4899", "#3b82f6", "#ef4444"];

interface Particle {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  rotation: number;
  scale: number;
  delay: number;
}

const generateParticles = (): Particle[] => {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * SCREEN_WIDTH,
    y: SCREEN_HEIGHT + 50 + Math.random() * 200,
    text: DISCOUNT_BADGES[Math.floor(Math.random() * DISCOUNT_BADGES.length)],
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    rotation: Math.random() * 360,
    scale: 0.6 + Math.random() * 0.6,
    delay: Math.random() * 400,
  }));
};

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slideRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Celebration animations
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const rocketY = useRef(new Animated.Value(0)).current;
  const rocketScale = useRef(new Animated.Value(1)).current;
  const textScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
    }))
  ).current;
  const [particles] = useState(generateParticles);

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

  useEffect(() => {
    startPulse();
  }, [startPulse]);

  const playCelebration = useCallback(() => {
    setShowCelebration(true);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Fade in celebration screen
    Animated.timing(celebrationOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Animate particles flying up
    particleAnims.forEach((anim, index) => {
      const particle = particles[index];

      Animated.sequence([
        Animated.delay(particle.delay),
        Animated.parallel([
          Animated.timing(anim.y, {
            toValue: -SCREEN_HEIGHT - 200,
            duration: 2000 + Math.random() * 1000,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.delay(1500),
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim.rotate, {
            toValue: 1,
            duration: 2500,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });

    // Rocket animation
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(rocketY, {
          toValue: -SCREEN_HEIGHT,
          duration: 1500,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(rocketScale, {
            toValue: 1.3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(rocketScale, {
            toValue: 0.5,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    // Big text animation
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(textScale, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Navigate after animation
    setTimeout(async () => {
      try {
        await AsyncStorage.setItem(ONBOARDING_KEY, "true");
        router.replace("/auth");
      } catch (error) {
        console.error("Error saving onboarding state:", error);
        router.replace("/auth");
      }
    }, 2200);
  }, [celebrationOpacity, particleAnims, particles, rocketY, rocketScale, textScale, textOpacity, router]);

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
      // Last slide - play celebration!
      playCelebration();
    }
  }, [currentIndex, playCelebration]);

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

          <Text style={styles.mainTitle}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
          <Text style={styles.description}>{slide.description}</Text>

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

  // Celebration screen
  if (showCelebration) {
    return (
      <Animated.View style={[styles.celebrationContainer, { opacity: celebrationOpacity }]}>
        <LinearGradient
          colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
          style={StyleSheet.absoluteFill}
        />

        {/* Flying discount particles */}
        {particles.map((particle, index) => (
          <Animated.View
            key={particle.id}
            style={[
              styles.particle,
              {
                left: particle.x,
                top: particle.y,
                opacity: particleAnims[index].opacity,
                transform: [
                  { translateY: particleAnims[index].y },
                  { scale: particle.scale },
                  {
                    rotate: particleAnims[index].rotate.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", `${particle.rotation > 180 ? 360 : -360}deg`],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.particleBadge, { backgroundColor: particle.color }]}>
              <Text style={styles.particleText}>{particle.text}</Text>
            </View>
          </Animated.View>
        ))}

        {/* Rocket */}
        <Animated.View
          style={[
            styles.rocketContainer,
            {
              transform: [
                { translateY: rocketY },
                { scale: rocketScale },
              ],
            },
          ]}
        >
          <Text style={styles.rocketEmoji}>🚀</Text>
        </Animated.View>

        {/* Big celebration text */}
        <Animated.View
          style={[
            styles.celebrationTextContainer,
            {
              opacity: textOpacity,
              transform: [{ scale: textScale }],
            },
          ]}
        >
          <Text style={styles.celebrationTitle}>PRIHRANI!</Text>
          <Text style={styles.celebrationSubtitle}>Pripravljamo tvoj profil...</Text>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
      />
      <FloatingBackground variant="minimal" />

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

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        {renderDots()}

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
  // Celebration styles
  celebrationContainer: {
    flex: 1,
    backgroundColor: "#0a0a12",
    justifyContent: "center",
    alignItems: "center",
  },
  particle: {
    position: "absolute",
  },
  particleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  particleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  rocketContainer: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
  },
  rocketEmoji: {
    fontSize: 80,
  },
  celebrationTextContainer: {
    alignItems: "center",
  },
  celebrationTitle: {
    fontSize: 52,
    fontWeight: "900",
    color: "#22c55e",
    textAlign: "center",
    letterSpacing: 2,
    textShadowColor: "rgba(34, 197, 94, 0.5)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 20,
  },
  celebrationSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 16,
  },
});
