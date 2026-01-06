import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "@/lib/auth-client";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { createShadow } from "@/lib/shadow-helper";
import { useConvexAuth, useQuery, useAction } from "convex/react";
import Logo, { getSeasonalLogoSource } from "@/lib/Logo";
import { api } from "@/convex/_generated/api";

const FACTS = [
  "Pametna primerjava cen ti prihrani čas in denar.",
  "Prihranek na lestvici se šteje samo iz potrjenih računov.",
  "Košarica pokaže potencialni prihranek pred nakupom.",
  "Slikanje računa traja manj kot minuto.",
  "Cene istega izdelka se razlikujejo med trgovinami.",
  "Z rednim spremljanjem cen hitreje opaziš prave akcije.",
];

/*
const FACTS_LEGACY = [
  "Pametna primerjava cen ti prihrani čas in denar.",
  "Prihranek na lestvici se šteje samo iz potrjenih računov.",
  "Košarica pokaže potencialni prihranek pred nakupom.",
  "Slikanje računa traja manj kot minuto.",
  "Cene istega izdelka se razlikujejo med trgovinami.",
  "Z rednim spremljanjem cen hitreje opaziš prave akcije.",
];
*/


export default function AuthScreen() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [anonymousLoading, setAnonymousLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<"login" | "register" | "guest" | null>(
    null
  );
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [currentFact, setCurrentFact] = useState(0);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const nicknameAvailability = useQuery(
    api.userProfiles.isNicknameAvailable,
    !isLogin && nickname.trim().length >= 3 ? { nickname: nickname.trim() } : "skip"
  );
  const profile = useQuery(
    api.userProfiles.getProfile,
    isAuthenticated ? {} : "skip"
  );
  const requestEmailVerification = useAction(api.emailVerification.requestEmailVerification);

  const modeInitialized = useRef(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);

  // Timeout for loading screen to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoadingScreen(false);
    }, 3000); // Max 3 seconds loading
    return () => clearTimeout(timer);
  }, []);

  const switchMode = (login: boolean) => {
    triggerHaptic();
    const nextMode = login ? "login" : "register";
    if (mode !== nextMode) {
      router.replace({ pathname: "/auth", params: { mode: nextMode } });
    }
    setIsLogin(login);
    setError("");
    setSuccess("");
    setShowSuccessOverlay(false);
    setPendingRedirect(null);
    setFocusedField(null);
    setResetLoading(false);
  };

  useEffect(() => {
    // Default to login mode if no mode is specified
    const shouldLogin = mode === "login" || !mode;
    if (modeInitialized.current && shouldLogin === isLogin) {
      return;
    }
    modeInitialized.current = true;
    setIsLogin(shouldLogin);
    setError("");
    setSuccess("");
    setFocusedField(null);
  }, [mode]);

  // Animations
  const logoGlow = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const cardSlide = useRef(new Animated.Value(50)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const factOpacity = useRef(new Animated.Value(1)).current;
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Redirect if authenticated
  useEffect(() => {
    // Only redirect if fully authenticated and not in a loading state
    if (isAuthenticated && !authLoading && profile && !profile.isAnonymous && !showSuccessOverlay && !loading && !resetLoading && !anonymousLoading) {
      // CRITICAL: Block users without verified email - redirect to verify screen
      if (!profile.emailVerified) {
        router.replace("/verify");
      } else {
        router.replace("/(tabs)");
      }
    }
  }, [isAuthenticated, authLoading, profile, showSuccessOverlay, loading, resetLoading, anonymousLoading]);

  // Logo glow animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(logoGlow, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  // Logo pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.05,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  // Card entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardSlide, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: false,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  // Floating orbs animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(orb1Anim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      })
    ).start();

    Animated.loop(
      Animated.timing(orb2Anim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      })
    ).start();
  }, []);

  // Rotate facts
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(factOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setCurrentFact((prev) => (prev + 1) % FACTS.length);
        Animated.timing(factOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const triggerHaptic = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const triggerSuccessHaptic = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const triggerErrorHaptic = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const getResetRedirectUrl = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const rawEnvUrl = process.env.EXPO_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
      const envUrl = rawEnvUrl && /^https?:\/\//i.test(rawEnvUrl) ? rawEnvUrl : undefined;
      const baseUrl = envUrl || window.location.origin;
      return `${baseUrl}/reset`;
    }
    return "myapp://reset";
  };

  const shakeError = () => {
    triggerErrorHaptic();
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: false }),
    ]).start();
  };

  const openSuccessOverlay = (
    message: string,
    redirect: "login" | "register" | "guest" | null = null
  ) => {
    triggerSuccessHaptic();
    setSuccess(message);
    setPendingRedirect(redirect);
    setShowSuccessOverlay(true);
    Animated.timing(successAnim, { toValue: 1, duration: 250, useNativeDriver: false }).start();
  };

  const closeSuccessOverlay = () => {
    const redirectTarget = pendingRedirect;
    Animated.timing(successAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start(
      () => {
        setShowSuccessOverlay(false);
        setPendingRedirect(null);
        setSuccess("");
        setLoading(false);
        if (redirectTarget === "register") {
          router.replace("/verify");
        } else if (redirectTarget) {
          router.replace("/(tabs)");
        }
      }
    );
  };

  // Auto-close success overlay and redirect after registration
  useEffect(() => {
    if (showSuccessOverlay && pendingRedirect === "register") {
      // Auto redirect to verify screen after 1.5 seconds for registrations
      const timer = setTimeout(() => {
        closeSuccessOverlay();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showSuccessOverlay, pendingRedirect]);

  const validateEmail = (email: string) => {
    // More robust email validation
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email) && email.length <= 254 && email.includes('.');
  };

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedNickname = nickname.trim();
  const emailValid = validateEmail(trimmedEmail);
  const passwordValid = password.length >= 8;
  const nicknameValid = isLogin
    ? true
    : trimmedNickname.length >= 3 && trimmedNickname.length <= 20;
  const nicknameAvailable = isLogin ? true : nicknameAvailability?.available ?? false;
  const canSubmit = isLogin
    ? emailValid && passwordValid
    : emailValid && passwordValid && nicknameValid && nicknameAvailable && acceptedTerms;
  const isPrimaryDisabled = loading || resetLoading || !canSubmit;

  const passwordStrengthScore =
    (password.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
  const passwordStrengthLevel =
    password.length === 0 ? 0 : passwordStrengthScore <= 1 ? 1 : passwordStrengthScore <= 3 ? 2 : 3;
  const passwordStrengthLabelSafe =
    passwordStrengthLevel === 1 ? "Šibko" : passwordStrengthLevel === 2 ? "Dobro" : "Močno";
  const passwordStrengthColor =
    passwordStrengthLevel === 1 ? "#f97316" : passwordStrengthLevel === 2 ? "#fbbf24" : "#22c55e";

  const handleAuth = async () => {
    if (loading) {
      return;
    }
    triggerHaptic();
    setError("");
    setSuccess("");

    // Validation
    if (!trimmedEmail) {
      setError("Prosimo, vnesite e-naslov");
      shakeError();
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError("Prosimo, vnesite veljaven e-naslov");
      shakeError();
      return;
    }

    if (!password || password.length < 8) {
      setError("Geslo mora imeti vsaj 8 znakov");
      shakeError();
      return;
    }

    if (!isLogin) {
      if (!trimmedNickname || trimmedNickname.length < 3) {
        setError("Vzdevek mora imeti vsaj 3 znake");
        shakeError();
        return;
      }
      if (!nicknameAvailable) {
        setError("Vzdevek je že zaseden");
        shakeError();
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const result = await authClient.signIn.email({ 
          email: trimmedEmail, 
          password 
        });
        
        if (result.error) {
          console.error("Login error details:", JSON.stringify(result.error));
          if (result.error.code === "EMAIL_NOT_VERIFIED" ||
              result.error.message?.toLowerCase().includes("verify")) {
            setError("Najprej potrdi e-naslov. Preveri e-posto za potrditveno povezavo.");
          } else if (result.error.code === "INVALID_EMAIL_OR_PASSWORD" || 
              result.error.message?.includes("Invalid") ||
              result.error.message?.includes("password")) {
            setError("Napačen e-naslov ali geslo");
          } else if (result.error.message?.includes("not found") || 
                     result.error.message?.includes("exist")) {
            setError("Račun s tem e-naslovom ne obstaja. Registriraj se!");
          } else {
            setError(`Prijava ni uspela: ${result.error.message || "Neznana napaka"}`);
          }
          shakeError();
          setLoading(false);
          return;
        }
        
        openSuccessOverlay("Uspešna prijava!", "login");
        // Router will redirect automatically via useEffect
      } else {
        // Register
        const result = await authClient.signUp.email({ 
          email: trimmedEmail, 
          password, 
          name: trimmedNickname 
        });
        
        if (result.error) {
          console.error("Register error details:", JSON.stringify(result.error));
          if (result.error.message?.includes("exist") || 
              result.error.message?.includes("already") ||
              result.error.code === "USER_ALREADY_EXISTS") {
            setError("Račun s tem e-naslovom že obstaja. Prijavi se!");
          } else {
            setError(`Registracija ni uspela: ${result.error.message || "Neznana napaka"}`);
          }
          shakeError();
          setLoading(false);
          return;
        }
        
        if (!result.data?.user) {
          const signInResult = await authClient.signIn.email({
            email: trimmedEmail,
            password,
          });
          if (signInResult.error) {
            setError("Prijava po registraciji ni uspela. Poskusite znova.");
            shakeError();
            setLoading(false);
            return;
          }
        }

        // Send verification email
        try {
          await requestEmailVerification({});
        } catch (emailErr) {
          console.warn("Failed to send verification email:", emailErr);
        }

        setLoading(false);
        openSuccessOverlay(
          "Račun ustvarjen! Preveri e-pošto za potrditveno povezavo.",
          "register"
        );
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      if (isLogin) {
        if (errorMessage.includes("not found") || errorMessage.includes("exist")) {
          setError("Račun s tem e-naslovom ne obstaja. Registriraj se!");
        } else {
          setError("Napačen e-naslov ali geslo");
        }
      } else {
        if (errorMessage.includes("exist") || errorMessage.includes("already")) {
          setError("Račun s tem e-naslovom že obstaja. Prijavi se!");
        } else {
          setError("Registracija ni uspela. Poskusite znova.");
        }
      }
      shakeError();
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (resetLoading || loading) {
      return;
    }
    triggerHaptic();
    setError("");
    setSuccess("");

    if (!trimmedEmail) {
      setError("Vnesite e-naslov za ponastavitev gesla");
      shakeError();
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError("Prosimo, vnesite veljaven e-naslov");
      shakeError();
      return;
    }

    const resetRedirectUrl = getResetRedirectUrl();

    setResetLoading(true);
    try {
      // Use $fetch for direct API call to request-password-reset endpoint
      const result = await authClient.$fetch("/request-password-reset", {
        method: "POST",
        body: {
          email: trimmedEmail,
          redirectURL: resetRedirectUrl,
          redirectTo: resetRedirectUrl,
        },
      });
      if (result.error) {
        setError("Pošiljanje povezave ni uspelo. Poskusite znova.");
        shakeError();
        return;
      }
      openSuccessOverlay("Če račun obstaja, smo poslali povezavo za ponastavitev.");
    } catch (error) {
      console.warn("Password reset request failed:", error);
      // For security, show success message anyway
      openSuccessOverlay("Če račun obstaja, smo poslali povezavo za ponastavitev.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    triggerHaptic();
    setAnonymousLoading(true);
    setError("");
    if (isAuthenticated && !authLoading) {
      setAnonymousLoading(false);
      router.replace("/(tabs)");
      return;
    }
    try {
      const result = await authClient.signIn.anonymous();
      if (result.error) {
        setError("Prijava kot gost ni uspela. Poskusite znova.");
        shakeError();
        setAnonymousLoading(false);
        return;
      }
      openSuccessOverlay("Dobrodošli!", "guest");
      setAnonymousLoading(false);
    } catch (error) {
      console.error("Anonymous sign-in error:", error);
      setError("Prijava kot gost ni uspela. Poskusite znova.");
      shakeError();
      setAnonymousLoading(false);
    }
  };

  const handleTermsPress = () => {
    triggerHaptic();
    router.push("/terms");
  };

  const handlePrivacyPress = () => {
    triggerHaptic();
    router.push("/privacy");
  };

  if (authLoading && showLoadingScreen) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LinearGradient
          colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
          style={StyleSheet.absoluteFill}
        />
        <Logo size={90} />
        <Text style={styles.loadingText}>Nalaganje...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a12", "#12081f", "#1a0a2e", "#270a3a", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Success Overlay */}
      {showSuccessOverlay && (
        <Animated.View
          pointerEvents={showSuccessOverlay ? "auto" : "none"}
          style={[
            styles.successOverlay,
            {
              opacity: successAnim,
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(15, 10, 30, 0.98)", "rgba(30, 17, 55, 0.98)"]}
            style={styles.successCard}
          >
            <TouchableOpacity style={styles.successClose} onPress={closeSuccessOverlay}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
            <Text style={styles.successTitle}>Uspešno</Text>
            <Text style={styles.successText}>{success}</Text>
            <TouchableOpacity style={styles.successAction} onPress={closeSuccessOverlay}>
              <Text style={styles.successActionText}>Zapri</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Animated Floating Icons - Shopping Related */}
      {/* Shopping Cart Icon */}
      <Animated.View
        style={[
          styles.floatingIcon,
          styles.iconCart,
          {
            transform: [
              {
                translateY: orb1Anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 30, 0],
                }),
              },
              {
                translateX: orb1Anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, -20, 0],
                }),
              },
              {
                rotate: orb1Anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: ['-5deg', '5deg', '-5deg'],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons name="cart" size={56} color="#a855f7" />
      </Animated.View>

      {/* Floating Price Tag Icon */}
      <Animated.View
        style={[
          styles.floatingIcon,
          styles.iconPriceTag,
          {
            transform: [
              {
                translateY: orb2Anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, -40, 0],
                }),
              },
              {
                translateX: orb2Anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 30, 0],
                }),
              },
              {
                rotate: orb2Anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: ['5deg', '-5deg', '5deg'],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons name="pricetag" size={48} color="#fbbf24" />
      </Animated.View>

      {/* Floating Discount Badge */}
      <Animated.View
        style={[
          styles.floatingIcon,
          styles.iconDiscount,
          {
            opacity: orb1Anim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.3, 0.7, 0.3],
            }),
            transform: [
              {
                scale: orb1Anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.9, 1.1, 0.9],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons name="flash" size={42} color="#ec4899" />
      </Animated.View>

      {/* Floating Gift/Savings Icon */}
      <Animated.View
        style={[
          styles.floatingIcon,
          styles.iconGift,
          {
            transform: [
              {
                translateY: orb2Anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 50, 0],
                }),
              },
              {
                translateX: orb2Anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, -50, 0],
                }),
              },
              {
                rotate: orb2Anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: ['-10deg', '10deg', '-10deg'],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons name="gift" size={40} color="#d946ef" />
      </Animated.View>

      {/* Floating Basket Icon */}
      <Animated.View
        style={[
          styles.floatingIcon,
          styles.iconBasket,
          {
            opacity: orb1Anim.interpolate({
              inputRange: [0, 0.25, 0.5, 0.75, 1],
              outputRange: [0.4, 0.7, 1.0, 0.7, 0.4],
            }),
            transform: [
              {
                translateY: orb2Anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, -20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons name="basket" size={44} color="#06b6d4" />
      </Animated.View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo with Glow Effect */}
            <View style={styles.logoSection}>
              <Animated.View
                style={[
                  styles.logoGlow,
                  {
                    opacity: logoGlow.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 0.9],
                    }),
                    transform: [
                      {
                        scale: logoGlow.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.3],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View style={{ transform: [{ scale: logoScale }] }}>
                <Image
                  source={getSeasonalLogoSource()}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </Animated.View>
              <Text style={styles.appName}>Pr'Hran</Text>
                <Text style={styles.tagline}>Pametno nakupovanje in varčevanje</Text>
            </View>

            {/* Fact Banner */}
            <Animated.View style={[styles.factBanner, { opacity: factOpacity }]}>
              <LinearGradient
                colors={["rgba(139, 92, 246, 0.15)", "rgba(168, 85, 247, 0.08)"]}
                style={styles.factGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.factText}>{FACTS[currentFact]}</Text>
              </LinearGradient>
            </Animated.View>

            {/* Auth Card */}
            <Animated.View
              style={[
                styles.cardContainer,
                {
                  opacity: cardOpacity,
                  transform: [{ translateY: cardSlide }, { translateX: shakeAnim }],
                },
              ]}
            >
              <LinearGradient
                colors={[
                  "rgba(139, 92, 246, 0.2)",
                  "rgba(88, 28, 135, 0.3)",
                  "rgba(59, 7, 100, 0.25)",
                ]}
                style={styles.card}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.cardInner}>
                  <Text style={styles.title}>
                    {isLogin ? "Dobrodošli nazaj!" : "Ustvari račun"}
                  </Text>
                  <Text style={styles.subtitle}>
                    {isLogin
                      ? "Prijavi se in začni prihranjevati"
                      : "Vzdevek, e-naslov in geslo – in si notri"}
                  </Text>

                  <View style={styles.modeSwitch}>
                    <TouchableOpacity
                      style={[styles.modeOption, isLogin ? styles.modeOptionActive : styles.modeOptionInactive]}
                      onPress={() => switchMode(true)}
                    >
                      <Ionicons name="log-in-outline" size={16} color={isLogin ? "#0f172a" : "#e5e7eb"} />
                      <Text style={[styles.modeOptionText, isLogin ? styles.modeOptionTextActive : styles.modeOptionTextInactive]}>
                        Prijava
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modeOption, !isLogin ? styles.modeOptionActive : styles.modeOptionInactive]}
                      onPress={() => switchMode(false)}
                    >
                      <Ionicons name="person-add-outline" size={16} color={!isLogin ? "#0f172a" : "#e5e7eb"} />
                      <Text style={[styles.modeOptionText, !isLogin ? styles.modeOptionTextActive : styles.modeOptionTextInactive]}>
                        Registracija
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {error ? (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle" size={18} color="#ef4444" />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  

                  {/* Removed email divider for cleaner layout */}

                  <View style={styles.formSection}>
                    {!isLogin && (
                      <View
                        style={[
                          styles.inputContainer,
                          focusedField === "nickname" && styles.inputContainerFocused,
                        ]}
                      >
                        <Ionicons name="person-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Vzdevek"
                          placeholderTextColor="#6b7280"
                          value={nickname}
                          onChangeText={setNickname}
                          onFocus={() => setFocusedField("nickname")}
                          onBlur={() => setFocusedField(null)}
                          autoComplete="username"
                          autoCapitalize="none"
                          autoCorrect={false}
                          textContentType="username"
                          returnKeyType="next"
                        />
                      </View>
                    )}
                    {!isLogin && trimmedNickname.length >= 3 && (
                      <Text
                        style={[
                          styles.helperText,
                          nicknameAvailable ? styles.helperTextSuccess : styles.helperTextError,
                        ]}
                      >
                        {nicknameAvailable ? "Vzdevek je prost" : "Vzdevek je že zaseden"}
                      </Text>
                    )}

                    <View
                      style={[
                        styles.inputContainer,
                        focusedField === "email" && styles.inputContainerFocused,
                      ]}
                    >
                      <Ionicons name="mail-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="E-naslov"
                        placeholderTextColor="#6b7280"
                        value={email}
                        onChangeText={setEmail}
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => setFocusedField(null)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                        returnKeyType="next"
                      />
                    </View>

                    <View
                      style={[
                        styles.inputContainer,
                        focusedField === "password" && styles.inputContainerFocused,
                      ]}
                    >
                      <Ionicons name="lock-closed-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Geslo (min. 8 znakov)"
                        placeholderTextColor="#6b7280"
                        value={password}
                        onChangeText={setPassword}
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => setFocusedField(null)}
                        secureTextEntry={!showPassword}
                        autoCorrect={false}
                        autoComplete={isLogin ? "current-password" : "new-password"}
                        textContentType={isLogin ? "password" : "newPassword"}
                        returnKeyType={isLogin ? "done" : "next"}
                        onSubmitEditing={() => {
                          if (isLogin) {
                            handleAuth();
                          }
                        }}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowPassword(!showPassword)}
                      >
                        <Ionicons
                          name={showPassword ? "eye-off" : "eye"}
                          size={20}
                          color="#6b7280"
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Ostani prijavljen + Pozabljeno geslo - v isti vrstici pod password */}
                    {isLogin && (
                      <View style={styles.loginAssist}>
                        <TouchableOpacity
                          style={styles.rememberRow}
                          onPress={() => setRememberMe((prev) => !prev)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.rememberCheckbox,
                              rememberMe && styles.rememberCheckboxChecked,
                            ]}
                          >
                            {rememberMe && (
                              <Ionicons name="checkmark" size={14} color="#fff" />
                            )}
                          </View>
                          <Text style={styles.rememberText}>Ostani prijavljen</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={handleForgotPassword}
                          disabled={resetLoading}
                          activeOpacity={0.8}
                          style={styles.forgotPasswordLink}
                        >
                          <Text
                            style={[
                              styles.forgotPasswordText,
                              resetLoading && styles.forgotPasswordTextDisabled,
                            ]}
                          >
                            {resetLoading ? "Pošiljam..." : "Pozabljeno geslo?"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {!isLogin && (
                      <View style={styles.helperRow}>
                        <Ionicons name="shield-checkmark-outline" size={16} color="#6b7280" />
                        <Text style={styles.helperText}>Vsaj 8 znakov; najbolj varno je črke + številke + posebni znaki.</Text>
                      </View>
                    )}

                    {!isLogin && password.length > 0 && (
                      <View style={styles.strengthRow}>
                        <View style={styles.strengthBars}>
                          {[0, 1, 2].map((index) => (
                            <View
                              key={index}
                              style={[
                                styles.strengthBar,
                                passwordStrengthLevel > index && { backgroundColor: passwordStrengthColor },
                              ]}
                            />
                          ))}
                        </View>
                        <Text style={[styles.strengthText, { color: passwordStrengthColor }]}>
                          {passwordStrengthLabelSafe}
                        </Text>
                      </View>
                    )}

                    {!isLogin && (
                      <TouchableOpacity
                        style={styles.termsRow}
                        onPress={() => setAcceptedTerms((prev) => !prev)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            acceptedTerms && styles.checkboxChecked,
                          ]}
                        >
                          {acceptedTerms && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          )}
                        </View>
                        <Text style={styles.legalText}>
                          Strinjam se s{" "}
                          <Text style={styles.termsLink} onPress={(e) => { e.stopPropagation(); handleTermsPress(); }}>
                            Pogoji uporabe
                          </Text>{" "}
                          in{" "}
                          <Text style={styles.termsLink} onPress={(e) => { e.stopPropagation(); handlePrivacyPress(); }}>
                            Politiko zasebnosti
                          </Text>
                          .
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Separator above actions for breathing room */}
                  <View style={styles.actionsSeparator} />

                  {/* Actions Row: Primary */}
                  <View style={styles.actionsRowSingle}>
                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        styles.primaryButtonFlex,
                        isPrimaryDisabled && styles.primaryButtonDisabled,
                      ]}
                      onPress={handleAuth}
                      disabled={isPrimaryDisabled}
                      activeOpacity={0.9}
                    >
                      <LinearGradient
                        colors={
                          isPrimaryDisabled
                            ? ["rgba(148, 163, 184, 0.5)", "rgba(71, 85, 105, 0.6)"]
                            : ["#c084fc", "#a855f7", "#7c3aed"]
                        }
                        style={styles.buttonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        {loading ? (
                          <Logo size={22} />
                        ) : (
                          <>
                            <Text
                              style={[
                                styles.primaryButtonText,
                                isPrimaryDisabled && styles.primaryButtonTextDisabled,
                              ]}
                            >
                              {isLogin ? "Prijava" : "Registriraj se"}
                            </Text>
                            <Ionicons
                              name="arrow-forward"
                              size={20}
                              color={isPrimaryDisabled ? "#cbd5e1" : "#fff"}
                            />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  {/* Anonymous Sign In */}
                  <View style={styles.anonymousDivider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>ali</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.anonymousButton,
                      anonymousLoading && styles.anonymousButtonDisabled,
                    ]}
                    onPress={handleAnonymousSignIn}
                    disabled={anonymousLoading}
                  >
                    {anonymousLoading ? (
                      <Logo size={18} />
                    ) : (
                      <>
                        <Ionicons name="eye-off-outline" size={18} color="#a78bfa" />
                        <Text style={styles.anonymousButtonText}>
                          Nadaljuj kot gost
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Features Preview */}
            <View style={styles.featuresSection}>
              <Text style={styles.featuresTitle}>Zakaj Pr'Hran?</Text>
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <View style={styles.featureIcon}>
                    <Ionicons name="search" size={20} color="#a78bfa" />
                  </View>
                  <Text style={styles.featureText}>Primerjaj cene v sekundi</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureIcon}>
                    <Ionicons name="pricetag" size={20} color="#22c55e" />
                  </View>
                  <Text style={styles.featureText}>Avtomatski kuponi</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, styles.premiumFeatureIcon]}>
                    <Ionicons name="camera" size={20} color="#fbbf24" />
                  </View>
                  <Text style={styles.featureText}>
                    Slikaj izdelek – takoj najde najnižjo ceno{" "}
                    <Text style={styles.premiumBadge}>PREMIUM PLUS</Text>
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a12",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#a78bfa",
    marginTop: 16,
    fontSize: 16,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 6, 12, 0.88)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 100,
  },
  successCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.35)",
    ...createShadow("#000", 0, 10, 0.45, 24, 12),
  },
  successClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  successTitle: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  successText: {
    color: "#d1d5db",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
  },
  successAction: {
    marginTop: 18,
    width: "100%",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#8b5cf6",
    alignItems: "center",
  },
  successActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    alignItems: "center",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  floatingIcon: {
    position: "absolute",
    opacity: 0.25,
  },
  iconCart: {
    top: -40,
    left: -20,
  },
  iconPriceTag: {
    bottom: 120,
    right: -10,
  },
  iconDiscount: {
    top: "38%",
    left: -10,
  },
  iconGift: {
    bottom: "22%",
    right: 10,
  },
  iconBasket: {
    top: "58%",
    right: "8%",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 20,
    position: "relative",
  },
  logoGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    backgroundColor: "#8b5cf6",
    borderRadius: 130,
    top: -22,
    ...createShadow("#8b5cf6", 0, 0, 1, 60, 25),
  },
  logo: {
    width: 174,
    height: 174,
    zIndex: 1,
  },
  appName: {
    fontSize: 36,
    fontWeight: "900",
    color: "#fff",
    marginTop: 12,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: "#a78bfa",
    marginTop: 4,
    fontWeight: "500",
  },
  factBanner: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
    maxWidth: 480,
  },
  factGradient: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.35)",
  },
  factText: {
    fontSize: 14,
    color: "#d1d5db",
    textAlign: "center",
    lineHeight: 20,
  },
  cardContainer: {
    marginBottom: 24,
    width: "100%",
    maxWidth: 480,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "rgba(139, 92, 246, 0.4)",
    overflow: "hidden",
    ...createShadow("#8b5cf6", 0, 4, 0.3, 12, 6),
  },
  cardInner: {
    padding: 28,
    paddingBottom: 46,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 24,
  },
  modeSwitch: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.45)",
    gap: 10,
    marginBottom: 24,
  },
  modeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    minHeight: 50,
  },
  modeOptionActive: {
    backgroundColor: "#a78bfa",
    ...createShadow("#a78bfa", 0, 6, 0.35, 12, 8),
  },
  modeOptionInactive: {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(167, 139, 250, 0.4)",
  },
  modeOptionText: {
    fontSize: 15,
    fontWeight: "700",
  },
  modeOptionTextActive: {
    color: "#0f0a1e",
  },
  modeOptionTextInactive: {
    color: "#e5e7eb",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  helperTextSuccess: {
    color: "#10b981",
  },
  helperTextError: {
    color: "#f87171",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionLabel: {
    color: "#e5e7eb",
    fontSize: 15,
    fontWeight: "700",
  },
  sectionTag: {
    color: "#a78bfa",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(167, 133, 247, 0.4)",
    backgroundColor: "rgba(167, 133, 247, 0.12)",
    overflow: "hidden",
  },
  socialButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  socialButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 14,
  },
  dividerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.25)",
  },
  dividerBadgeText: {
    color: "#c4c8d4",
    fontSize: 13,
    fontWeight: "600",
  },
  anonymousDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
  },
  dividerText: {
    color: "#6b7280",
    paddingHorizontal: 14,
    fontSize: 13,
  },
  formSection: {
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.15)",
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  inputContainer: {
    marginBottom: 16,
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(31, 41, 55, 0.5)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  inputContainerFocused: {
    borderColor: "#c084fc",
    backgroundColor: "rgba(31, 41, 55, 0.7)",
    ...createShadow("#a78bfa", 0, 0, 0.35, 10, 4),
  },
  inputIcon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
    paddingLeft: 12,
    fontSize: 16,
    color: "#fff",
  },
  eyeButton: {
    padding: 16,
  },
  helperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -4,
    marginBottom: 8,
  },
  loginAssist: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 4,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rememberCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#8b5cf6",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(139, 92, 246, 0.12)",
  },
  rememberCheckboxChecked: {
    backgroundColor: "#8b5cf6",
  },
  rememberText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#cbd5e1",
  },
  forgotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  forgotText: {
    color: "#a78bfa",
    fontSize: 13,
    fontWeight: "600",
  },
  forgotTextDisabled: {
    color: "#94a3b8",
  },
  forgotPasswordLink: {
    flexDirection: "row",
    alignItems: "center",
  },
  forgotPasswordText: {
    color: "#a78bfa",
    fontSize: 13,
    fontWeight: "600",
  },
  forgotPasswordTextDisabled: {
    color: "#94a3b8",
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  strengthBars: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  strengthBar: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.35)",
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "700",
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#8b5cf6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: "#8b5cf6",
  },
  termsText: {
    color: "#9ca3af",
    fontSize: 14,
    flex: 1,
    lineHeight: 22,
  },
  legalText: {
    color: "#9ca3af",
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  termsLink: {
    color: "#a78bfa",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  primaryButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    ...createShadow("#a78bfa", 0, 10, 0.55, 20, 12),
  },
  primaryButtonDisabled: {
    opacity: 0.85,
  },
  primaryButtonFlex: {
    width: "100%",
    marginBottom: 0,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22,
    paddingHorizontal: 18,
    minHeight: 62,
    gap: 12,
  },
  primaryButtonText: {
    color: "#0b0814",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  primaryButtonTextDisabled: {
    color: "#e2e8f0",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    marginBottom: 16,
  },
  actionsRowSingle: {
    width: "100%",
    alignItems: "stretch",
    marginTop: 20,
    marginBottom: 20,
  },
  actionsSeparator: {
    height: 1,
    backgroundColor: "rgba(139, 92, 246, 0.18)",
    marginTop: 16,
    marginBottom: 10,
  },
  anonymousButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    backgroundColor: "rgba(139, 92, 246, 0.1)",
  },
  anonymousButtonDisabled: {
    opacity: 0.6,
  },
  anonymousButtonText: {
    color: "#a78bfa",
    fontSize: 15,
    fontWeight: "600",
  },
  featuresSection: {
    marginTop: 8,
    width: "100%",
    maxWidth: 480,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 16,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumFeatureIcon: {
    backgroundColor: "rgba(251, 191, 36, 0.2)",
  },
  featureText: {
    color: "#d1d5db",
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  premiumBadge: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "800",
  },
});
