import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "@/lib/auth-client";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useConvexAuth } from "convex/react";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const FACTS = [
  "💡 Povprečna slovenska družina lahko prihrani do 150€ mesečno!",
  "🛒 Cene istega izdelka se razlikujejo do 40% med trgovinami!",
  "📊 Primerjamo cene iz 6 največjih slovenskih trgovin.",
  "⏰ Prihranite do 2 uri tedensko z avtomatskim iskanjem!",
  "🏆 Več kot 10.000 Slovencev že prihrani s Pr'Hran!",
  "📸 Premium: Slikaj izdelek in najdi najnižjo ceno!",
];

export default function AuthScreen() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [anonymousLoading, setAnonymousLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [currentFact, setCurrentFact] = useState(0);

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
    if (isAuthenticated && !authLoading) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, authLoading]);

  // Logo glow animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoGlow, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
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
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
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
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
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
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(orb2Anim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Rotate facts
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(factOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentFact((prev) => (prev + 1) % FACTS.length);
        Animated.timing(factOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
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

  const shakeError = () => {
    triggerErrorHaptic();
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const showSuccessAnimation = () => {
    triggerSuccessHaptic();
    Animated.sequence([
      Animated.timing(successAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(successAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleAuth = async () => {
    triggerHaptic();
    setError("");
    setSuccess("");

    // Validation
    if (!email.trim()) {
      setError("Prosimo, vnesite e-naslov");
      shakeError();
      return;
    }

    if (!validateEmail(email)) {
      setError("Prosimo, vnesite veljaven e-naslov");
      shakeError();
      return;
    }

    if (!password || password.length < 6) {
      setError("Geslo mora imeti vsaj 6 znakov");
      shakeError();
      return;
    }

    if (!isLogin) {
      if (password !== confirmPassword) {
        setError("Gesli se ne ujemata");
        shakeError();
        return;
      }
      if (!agreedToTerms) {
        setError("Strinjati se morate s pogoji uporabe");
        shakeError();
        return;
      }
      if (!name.trim()) {
        setError("Prosimo, vnesite ime");
        shakeError();
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const result = await authClient.signIn.email({ 
          email: email.trim().toLowerCase(), 
          password 
        });
        
        if (result.error) {
          console.log("Login error:", result.error);
          if (result.error.code === "INVALID_EMAIL_OR_PASSWORD" || 
              result.error.message?.includes("Invalid") ||
              result.error.message?.includes("password")) {
            setError("Napačen e-naslov ali geslo");
          } else if (result.error.message?.includes("not found") || 
                     result.error.message?.includes("exist")) {
            setError("Račun s tem e-naslovom ne obstaja. Registrirajte se!");
          } else {
            setError("Prijava ni uspela. Preverite podatke.");
          }
          shakeError();
          setLoading(false);
          return;
        }
        
        setSuccess("Uspešna prijava! 🎉");
        showSuccessAnimation();
        // Router will redirect automatically via useEffect
      } else {
        // Register
        const result = await authClient.signUp.email({ 
          email: email.trim().toLowerCase(), 
          password, 
          name: name.trim() 
        });
        
        if (result.error) {
          console.log("Register error:", result.error);
          if (result.error.message?.includes("exist") || 
              result.error.message?.includes("already") ||
              result.error.code === "USER_ALREADY_EXISTS") {
            setError("Račun s tem e-naslovom že obstaja. Prijavite se!");
          } else {
            setError("Registracija ni uspela. Poskusite znova.");
          }
          shakeError();
          setLoading(false);
          return;
        }
        
        setSuccess("Račun ustvarjen! Dobrodošli! 🚀");
        showSuccessAnimation();
        // Router will redirect automatically via useEffect
      }
    } catch (err: unknown) {
      console.log("Auth error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      if (isLogin) {
        if (errorMessage.includes("not found") || errorMessage.includes("exist")) {
          setError("Račun s tem e-naslovom ne obstaja. Registrirajte se!");
        } else {
          setError("Napačen e-naslov ali geslo");
        }
      } else {
        if (errorMessage.includes("exist") || errorMessage.includes("already")) {
          setError("Račun s tem e-naslovom že obstaja. Prijavite se!");
        } else {
          setError("Registracija ni uspela. Poskusite znova.");
        }
      }
      shakeError();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    triggerHaptic();
    setGoogleLoading(true);
    setError("");
    try {
      await authClient.signIn.social({ provider: "google" });
    } catch (err) {
      console.log("Google error:", err);
      setError("Google prijava ni uspela");
      shakeError();
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    triggerHaptic();
    setAppleLoading(true);
    setError("");
    try {
      await authClient.signIn.social({ provider: "apple" });
    } catch (err) {
      console.log("Apple error:", err);
      setError("Apple prijava ni uspela");
      shakeError();
      setAppleLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    triggerHaptic();
    setAnonymousLoading(true);
    setError("");
    try {
      const result = await authClient.signIn.anonymous();
      if (result.error) {
        setError("Anonimna prijava ni uspela");
        shakeError();
        setAnonymousLoading(false);
        return;
      }
      setSuccess("Dobrodošli! 👋");
      showSuccessAnimation();
    } catch (err) {
      console.log("Anonymous error:", err);
      setError("Anonimna prijava ni uspela");
      shakeError();
      setAnonymousLoading(false);
    }
  };

  if (authLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LinearGradient
          colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#a78bfa" />
        <Text style={styles.loadingText}>Nalaganje...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Success Overlay */}
      <Animated.View
        style={[
          styles.successOverlay,
          {
            opacity: successAnim,
            pointerEvents: "none",
          },
        ]}
      >
        <View style={styles.successContent}>
          <Ionicons name="checkmark-circle" size={80} color="#22c55e" />
          <Text style={styles.successText}>{success}</Text>
        </View>
      </Animated.View>

      {/* Animated Background Orbs */}
      <Animated.View
        style={[
          styles.backgroundOrb,
          styles.orb1,
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
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.backgroundOrb,
          styles.orb2,
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
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.backgroundOrb,
          styles.orb3,
          {
            opacity: orb1Anim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.3, 0.6, 0.3],
            }),
          },
        ]}
      />

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
                  source={require("@/assets/images/1595E33B-B540-4C55-BAA2-E6DA6596BEFF.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </Animated.View>
              <Text style={styles.appName}>Pr'Hran</Text>
              <Text style={styles.tagline}>Pametno nakupovanje 🛒</Text>
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
                    {isLogin ? "Dobrodošli nazaj! 👋" : "Ustvari račun 🚀"}
                  </Text>
                  <Text style={styles.subtitle}>
                    {isLogin
                      ? "Prijavite se in začnite prihranjevati"
                      : "Pridružite se tisočim, ki že prihranijo"}
                  </Text>

                  {error ? (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle" size={18} color="#ef4444" />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  {/* Social Login Buttons */}
                  <View style={styles.socialButtons}>
                    <TouchableOpacity
                      style={styles.socialButton}
                      onPress={handleGoogleSignIn}
                      disabled={googleLoading}
                    >
                      <LinearGradient
                        colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                        style={styles.socialButtonGradient}
                      >
                        {googleLoading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <View style={styles.googleIcon}>
                              <Text style={styles.googleG}>G</Text>
                            </View>
                            <Text style={styles.socialButtonText}>Google</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.socialButton}
                      onPress={handleAppleSignIn}
                      disabled={appleLoading}
                    >
                      <LinearGradient
                        colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                        style={styles.socialButtonGradient}
                      >
                        {appleLoading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="logo-apple" size={22} color="#fff" />
                            <Text style={styles.socialButtonText}>Apple</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>ali z e-pošto</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  {/* Form Fields */}
                  {!isLogin && (
                    <View style={styles.inputContainer}>
                      <Ionicons name="person-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Ime in priimek"
                        placeholderTextColor="#6b7280"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                      />
                    </View>
                  )}

                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="E-naslov"
                      placeholderTextColor="#6b7280"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Geslo (min. 6 znakov)"
                      placeholderTextColor="#6b7280"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
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

                  {!isLogin && (
                    <>
                      <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Potrdi geslo"
                          placeholderTextColor="#6b7280"
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          secureTextEntry={!showPassword}
                        />
                      </View>

                      {/* Birth Date Picker */}
                      <View style={styles.birthDateSection}>
                        <Text style={styles.birthDateLabel}>
                          <Ionicons name="calendar-outline" size={16} color="#a78bfa" /> Datum rojstva (opcijsko)
                        </Text>
                        <View style={styles.birthDateRow}>
                          <View style={styles.birthDateInputWrapper}>
                            <TextInput
                              style={styles.birthDateInput}
                              placeholder="Dan"
                              placeholderTextColor="#6b7280"
                              value={birthDay}
                              onChangeText={(text) => {
                                const num = text.replace(/[^0-9]/g, '');
                                if (num === '' || (parseInt(num) >= 1 && parseInt(num) <= 31)) {
                                  setBirthDay(num);
                                }
                              }}
                              keyboardType="number-pad"
                              maxLength={2}
                            />
                          </View>
                          <View style={styles.birthDateInputWrapper}>
                            <TextInput
                              style={styles.birthDateInput}
                              placeholder="Mesec"
                              placeholderTextColor="#6b7280"
                              value={birthMonth}
                              onChangeText={(text) => {
                                const num = text.replace(/[^0-9]/g, '');
                                if (num === '' || (parseInt(num) >= 1 && parseInt(num) <= 12)) {
                                  setBirthMonth(num);
                                }
                              }}
                              keyboardType="number-pad"
                              maxLength={2}
                            />
                          </View>
                          <View style={[styles.birthDateInputWrapper, styles.birthDateYearWrapper]}>
                            <TextInput
                              style={styles.birthDateInput}
                              placeholder="Leto"
                              placeholderTextColor="#6b7280"
                              value={birthYear}
                              onChangeText={(text) => {
                                const num = text.replace(/[^0-9]/g, '');
                                setBirthYear(num);
                              }}
                              keyboardType="number-pad"
                              maxLength={4}
                            />
                          </View>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.termsRow}
                        onPress={() => {
                          triggerHaptic();
                          setAgreedToTerms(!agreedToTerms);
                        }}
                      >
                        <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                          {agreedToTerms && (
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          )}
                        </View>
                        <Text style={styles.termsText}>
                          Strinjam se s{" "}
                          <Text style={styles.termsLink}>Pogoji uporabe</Text> in{" "}
                          <Text style={styles.termsLink}>Politiko zasebnosti</Text>
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Primary Button */}
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleAuth}
                    disabled={loading}
                    activeOpacity={0.9}
                  >
                    <LinearGradient
                      colors={["#8b5cf6", "#a855f7", "#7c3aed"]}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.primaryButtonText}>
                            {isLogin ? "Prijava" : "Registriraj se"}
                          </Text>
                          <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Switch Login/Register */}
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic();
                      setIsLogin(!isLogin);
                      setError("");
                      setSuccess("");
                    }}
                    style={styles.switchButton}
                  >
                    <Text style={styles.switchText}>
                      {isLogin ? "Še nimaš računa? " : "Že imaš račun? "}
                      <Text style={styles.switchLink}>
                        {isLogin ? "Registracija" : "Prijava"}
                      </Text>
                    </Text>
                  </TouchableOpacity>

                  {/* Anonymous Sign In */}
                  <View style={styles.anonymousDivider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>ali</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity
                    style={styles.anonymousButton}
                    onPress={handleAnonymousSignIn}
                    disabled={anonymousLoading}
                  >
                    {anonymousLoading ? (
                      <ActivityIndicator color="#a78bfa" size="small" />
                    ) : (
                      <>
                        <Ionicons name="eye-off-outline" size={18} color="#a78bfa" />
                        <Text style={styles.anonymousButtonText}>
                          Preizkusi brez računa
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
                    Slikaj izdelek <Text style={styles.premiumBadge}>PREMIUM</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  successContent: {
    alignItems: "center",
  },
  successText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
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
  },
  backgroundOrb: {
    position: "absolute",
    borderRadius: 999,
  },
  orb1: {
    width: 300,
    height: 300,
    backgroundColor: "#8b5cf6",
    top: -80,
    left: -100,
    opacity: 0.15,
  },
  orb2: {
    width: 250,
    height: 250,
    backgroundColor: "#d946ef",
    bottom: 100,
    right: -80,
    opacity: 0.12,
  },
  orb3: {
    width: 200,
    height: 200,
    backgroundColor: "#fbbf24",
    top: "40%",
    left: -60,
    opacity: 0.08,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 20,
    position: "relative",
  },
  logoGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    backgroundColor: "#8b5cf6",
    borderRadius: 80,
    top: -10,
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 50,
    elevation: 20,
  },
  logo: {
    width: 120,
    height: 120,
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
  },
  factGradient: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  factText: {
    fontSize: 14,
    color: "#d1d5db",
    textAlign: "center",
    lineHeight: 20,
  },
  cardContainer: {
    marginBottom: 24,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    overflow: "hidden",
  },
  cardInner: {
    padding: 24,
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
  googleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  googleG: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4285F4",
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
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
  inputContainer: {
    marginBottom: 14,
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(31, 41, 55, 0.5)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  inputIcon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    padding: 16,
    paddingLeft: 12,
    fontSize: 16,
    color: "#fff",
  },
  eyeButton: {
    padding: 16,
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
  termsLink: {
    color: "#a78bfa",
    fontWeight: "600",
  },
  primaryButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  switchButton: {
    paddingVertical: 8,
  },
  switchText: {
    color: "#9ca3af",
    textAlign: "center",
    fontSize: 15,
  },
  switchLink: {
    color: "#a78bfa",
    fontWeight: "700",
  },
  anonymousButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    backgroundColor: "rgba(139, 92, 246, 0.1)",
  },
  anonymousButtonText: {
    color: "#a78bfa",
    fontSize: 15,
    fontWeight: "600",
  },
  featuresSection: {
    marginTop: 8,
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
  birthDateSection: {
    marginBottom: 14,
  },
  birthDateLabel: {
    fontSize: 14,
    color: "#a78bfa",
    marginBottom: 10,
    fontWeight: "500",
  },
  birthDateRow: {
    flexDirection: "row",
    gap: 10,
  },
  birthDateInputWrapper: {
    flex: 1,
    backgroundColor: "rgba(31, 41, 55, 0.5)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  birthDateYearWrapper: {
    flex: 1.5,
  },
  birthDateInput: {
    padding: 16,
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
});
