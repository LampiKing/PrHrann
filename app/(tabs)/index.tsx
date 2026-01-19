import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  useWindowDimensions,
  Animated as RNAnimated,
  Easing,
  Modal,
  RefreshControl,
} from "react-native";
import Logo, { getSeasonalLogoSource } from "../../lib/Logo";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useConvexAuth, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Link } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { PLAN_PLUS } from "../../lib/branding";
import { createShadow, createTextShadow } from "../../lib/shadow-helper";
import FloatingBackground from "../../lib/FloatingBackground";
import {
  STORE_BRANDS,
  ALLOWED_STORE_KEYS,
  STORE_DISPLAY_ORDER,
  normalizeStoreKey,
  normalizeResultKey,
  getStoreBrand,
  isAllowedStoreName,
  type StoreBrand,
  type BrandAccent,
  type BrandRing,
  type BrandLogo,
} from "../../lib/store-brands";
import { ProductListSkeleton } from "../../lib/SkeletonLoading";


interface PriceInfo {
  storeId?: Id<"stores">;
  storeName: string;
  storeColor: string;
  price: number;
  originalPrice?: number;
  isOnSale: boolean;
}

interface DisplayPriceInfo extends PriceInfo {
  missing?: boolean;
}

interface ProductResult {
  _id?: Id<"products">;
  name: string;
  category: string;
  unit: string;
  imageUrl?: string;
  prices: PriceInfo[];
  lowestPrice: number;
  highestPrice: number;
}

// Store brands, helper functions moved to ../../lib/store-brands.ts

const buildDisplayPrices = (prices: PriceInfo[]): DisplayPriceInfo[] => {
  const byStore = new Map<string, PriceInfo>();
  for (const price of prices) {
    const key = normalizeStoreKey(price.storeName);
    if (!ALLOWED_STORE_KEYS.has(key)) continue;
    if (!byStore.has(key)) {
      byStore.set(key, price);
    }
  }

  return STORE_DISPLAY_ORDER.map(({ key, label }) => {
    const existing = byStore.get(key);
    if (existing) {
      const isAvailable = Number.isFinite(existing.price) && existing.price > 0;
      return {
        ...existing,
        storeName: existing.storeName || label,
        storeColor: existing.storeColor || getStoreBrand(label).bg,
        missing: !isAvailable,
      };
    }
    const brand = getStoreBrand(label);
    return {
      storeName: label,
      storeColor: brand.bg,
      price: 0,
      isOnSale: false,
      missing: true,
    };
  });
};

const FUN_FACTS = [
  "Ali veš, da primerjava cen pred tedenskim nakupom prinese največ prihrankov?",
  "Ali veš, da se prihranek na lestvici šteje le iz potrjenih računov?",
  "Ali veš, da seznam pokaže potencialni prihranek, račun pa potrdi dejanski?",
  "Ali veš, da se akcije in cene pogosto zamenjajo čez vikend?",
  "Ali veš, da redno preverjanje cen zmanjša nepotrebne nakupe?",
  "Ali veš, da je slikanje računa dovoljeno le isti dan do 23:00?",
  "Ali veš, da tudi majhni prihranki skozi leto ustvarijo velik rezultat?",
  "Ali veš, da načrtovan seznam pomaga pri pametnem nakupu?",
  "Ali veš, da lahko preveriš cene tik pred odhodom v trgovino?",
  "Ali veš, da prihranek temelji na dejanskem nakupu, ne na seznamu?",
  "Ali veš, da je tvoj rezultat vedno pošten, ker upošteva le račune?",
  "Ali veš, da pameten načrt nakupa zmanjša impulzivne odločitve?",
  "Ali veš, da primerjava cen pogosto prihrani več, kot pričakuješ?",
];

/*
const FUN_FACTS_LEGACY = [
  "Ali veš, da primerjava cen pred tedenskim nakupom prinese največ prihrankov?",
  "Ali veš, da se prihranek na lestvici šteje le iz potrjenih računov?",
  "Ali veš, da seznam pokaže potencialni prihranek, račun pa potrdi dejanski?",
  "Ali veš, da se akcije in cene pogosto zamenjajo čez vikend?",
  "Ali veš, da redno preverjanje cen zmanjša nepotrebne nakupe?",
  "Ali veš, da je slikanje računa dovoljeno le isti dan do 23:00?",
  "Ali veš, da tudi majhni prihranki skozi leto ustvarijo velik rezultat?",
  "Ali veš, da načrtovan seznam pomaga pri pametnem nakupu?",
  "Ali veš, da lahko preveriš cene tik pred odhodom v trgovino?",
  "Ali veš, da prihranek temelji na dejanskem nakupu, ne na seznamu?",
  "Ali veš, da je tvoj rezultat vedno pošten, ker upošteva le račune?",
  "Ali veš, da pameten načrt nakupa zmanjša impulzivne odločitve?",
  "Ali veš, da primerjava cen pogosto prihrani več, kot pričakuješ?",
];
*/

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 420;
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hasSearchedOnce, setHasSearchedOnce] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [autoSearchBlockedQuery, setAutoSearchBlockedQuery] = useState<string | null>(null);

  // Guest mode + search gating state
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);
  const [guestModalContext, setGuestModalContext] = useState<"search" | "cart" | "camera">("search");
  const [approvedQuery, setApprovedQuery] = useState("");
  const guestModalDismissedAtRef = useRef(0);

  // Camera/Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanningImage, setScanningImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [emailVerificationPrompt, setEmailVerificationPrompt] = useState("");
  const [emailVerificationMessage, setEmailVerificationMessage] = useState("");
  const [emailVerificationError, setEmailVerificationError] = useState("");
  const [emailVerificationSending, setEmailVerificationSending] = useState(false);
  const [, setCartToastMessage] = useState("");
  const [showCartToast, setShowCartToast] = useState(false);
  const [errorToastMessage, setErrorToastMessage] = useState("");
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [showCartPreview] = useState(false);
  const [recentCartItems, setRecentCartItems] = useState<
    Array<{ key: string; name: string; store: string; quantity: number }>
  >([]);

  // Image preview modal
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const searchBarScale = useRef(new RNAnimated.Value(1)).current;
  const cardAnimationsRef = useRef<{ [key: string]: RNAnimated.Value }>({});
  // Sorting fixed to cheapest-first; no swipe indicator needed
  
  // Premium button shake animation
  const shakeAnim = useRef(new RNAnimated.Value(0)).current;
  const glowAnim = useRef(new RNAnimated.Value(0)).current;
  
  // Scanner animation
  const scanLineAnim = useRef(new RNAnimated.Value(0)).current;
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const scanAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const pulseAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const cartToastAnim = useRef(new RNAnimated.Value(0)).current;
  const cartPreviewAnim = useRef(new RNAnimated.Value(0)).current;
  const errorToastAnim = useRef(new RNAnimated.Value(0)).current;
  const cartToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profile = useQuery(
    api.userProfiles.getProfile,
    isAuthenticated ? {} : "skip"
  );
  const seasonSummary = useQuery(
    api.leaderboard.getMySeasonSummary,
    isAuthenticated ? {} : "skip"
  );
  const isPremium = profile?.isPremium ?? false;
  const isGuest = profile ? (profile.isAnonymous || !profile.email) : false;
  const isGuestMode = !isAuthenticated || isGuest;
  const maxSearches = isPremium ? 999 : (isGuestMode ? 1 : 3);
  const searchesRemaining = profile?.searchesRemaining ?? (isGuestMode ? 1 : 3);
  const searchResetTime = profile?.searchResetTime;
  const searchLimitRatio = Math.max(0, Math.min(1, searchesRemaining / maxSearches));
  const searchLimitLabel = maxSearches === 1 ? "gostujoče iskanje" : "brezplačnih iskanj";
  const isGuestLimitContext = guestModalContext === "search";
  const isGuestCartContext = guestModalContext === "cart";
  const guestModalTitle = isGuestLimitContext
    ? "Dosegel si dnevni limit iskanj"
    : isGuestCartContext
    ? "Seznam je na voljo prijavljenim"
    : "Kamera je na voljo prijavljenim";
  const guestModalSubtitle = isGuestLimitContext
    ? "Odštevalnik do polnoči"
    : "Za nadaljevanje se prijavi ali registriraj.";
  const seasonSavings = seasonSummary?.savings ?? 0;
  const seasonRank = seasonSummary?.rank;
  const seasonYear = seasonSummary?.year;
  const currentYear = new Date().getFullYear();
  const displaySeasonYear = seasonYear && seasonYear >= currentYear ? seasonYear : currentYear;
  const showRegistrationCta = isGuestMode;
  const showPlusCta = true;
  const showWaitOption = isGuestLimitContext;
  const guestOptionsCount = (showRegistrationCta ? 1 : 0) + (showPlusCta ? 1 : 0);
  const guestOptionsSingle = guestOptionsCount === 1;
  const showTopFabs = !isPremium || isGuestMode;
  const fabTop = insets.top + (isCompact ? 4 : 12);
  const fabHorizontal = isCompact ? 10 : 16;
  const premiumIconSize = isCompact ? 16 : 18;
  const authIconSize = isCompact ? 16 : 18;
  const premiumFabLabel = isCompact ? PLAN_PLUS : `Kupi ${PLAN_PLUS}`;
  const authFabLabel = isCompact ? "Prijava" : "Prijava / Registracija";
  const fabScaleMin = isCompact ? 0.92 : 0.98;
  const fabScaleMax = isCompact ? 1.02 : 1.04;
  const scrollTopPadding = insets.top + (showTopFabs ? (isCompact ? 60 : 50) : 10);
  // Cart preview is disabled, so we don't need to fetch the full cart (which causes lag)
  const previewItems = recentCartItems;

  const [funFactIndex, setFunFactIndex] = useState(0);

  // Timer state for countdown
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // Countdown timer effect
  useEffect(() => {
    if (!searchResetTime || isPremium || searchesRemaining > 0) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = searchResetTime - now;

      if (diff <= 0) {
        setTimeRemaining(null);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [searchResetTime, isPremium, searchesRemaining]);

  useEffect(() => {
    if (FUN_FACTS.length <= 1) return;
    const interval = setInterval(() => {
      setFunFactIndex((current) => (current + 1) % FUN_FACTS.length);
    }, 9000);
    return () => clearInterval(interval);
  }, []);

  const recordSearch = useMutation(api.userProfiles.recordSearch);
  const requestEmailVerification = useAction(api.emailVerification.requestEmailVerification);
  const addToCart = useMutation(api.cart.addToCart);
  const addToCartFromSearch = useMutation(api.cart.addToCartFromSearch);
  const analyzeImage = useAction(api.ai.analyzeProductImage);

  const closeGuestModal = useCallback(() => {
    guestModalDismissedAtRef.current = Date.now();
    setShowGuestLimitModal(false);
  }, []);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Clear card animations for fresh entrance
    cardAnimationsRef.current = {};
    // Small delay to let queries refresh
    await new Promise((resolve) => setTimeout(resolve, 800));
    setRefreshing(false);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleResendVerificationEmail = useCallback(async () => {
    setEmailVerificationMessage("");
    setEmailVerificationError("");
    setEmailVerificationSending(true);
    try {
      const result = await requestEmailVerification({});
      if (result.success) {
        setEmailVerificationMessage(`Potrditvena koda je poslana na ${result.email}.`);
      } else {
        setEmailVerificationError("Pošiljanje potrditvene kode ni uspelo. Poskusi znova.");
      }
    } catch (error) {
      console.error("Failed to send verification code:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Napaka pri pošiljanju potrditvene kode.";
      setEmailVerificationError(message);
    } finally {
      setEmailVerificationSending(false);
    }
  }, [requestEmailVerification]);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (!autoSearchBlockedQuery) return;
    if (trimmedQuery.length < 2 || trimmedQuery !== autoSearchBlockedQuery) {
      setAutoSearchBlockedQuery(null);
    }
  }, [searchQuery, autoSearchBlockedQuery]);

  useEffect(() => {
    if (profile?.emailVerified) {
      setAutoSearchBlockedQuery(null);
    }
  }, [profile?.emailVerified]);

  const openGuestModal = useCallback((context: "search" | "cart" | "camera") => {
    const now = Date.now();
    if (now - guestModalDismissedAtRef.current < 400) {
      return;
    }
    setGuestModalContext(context);
    setShowGuestLimitModal(true);
  }, []);

  const handleGuestAuthPress = useCallback(() => {
    closeGuestModal();
    setTimeout(() => {
      router.push({ pathname: "/auth", params: { mode: "register" } });
    }, 80);
  }, [closeGuestModal, router]);

  const handleGuestPremiumPress = useCallback(() => {
    closeGuestModal();
    setTimeout(() => {
      router.push("/premium");
    }, 80);
  }, [closeGuestModal, router]);

  const triggerCartToast = useCallback((message: string) => {
    if (cartToastTimeoutRef.current) {
      clearTimeout(cartToastTimeoutRef.current);
    }
    setCartToastMessage(message);
    setShowCartToast(true);
    
    // Simple slide in - no extra animations
    RNAnimated.timing(cartToastAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    
    cartToastTimeoutRef.current = setTimeout(() => {
      RNAnimated.timing(cartToastAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => setShowCartToast(false));
    }, 1500);
  }, [cartToastAnim]);

  const triggerErrorToast = useCallback((message: string) => {
    if (errorToastTimeoutRef.current) {
      clearTimeout(errorToastTimeoutRef.current);
    }
    setErrorToastMessage(message);
    setShowErrorToast(true);

    RNAnimated.timing(errorToastAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    errorToastTimeoutRef.current = setTimeout(() => {
      RNAnimated.timing(errorToastAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => setShowErrorToast(false));
    }, 2500);
  }, [errorToastAnim]);

  // Debounce search input
  useEffect(() => {
    if (!isPremium) {
      return;
    }
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2 || trimmedQuery.length > 100) {
      return;
    }
    if (autoSearchBlockedQuery && autoSearchBlockedQuery === trimmedQuery) {
      return;
    }
    const timer = setTimeout(() => {
      if (!searching) {
        handleSearch();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, searching, isPremium, autoSearchBlockedQuery]);
  
  // Handle search with recordSearch call
  const handleSearch = async () => {
    const trimmedQuery = searchQuery.trim();
    
    // Validate query
    if (trimmedQuery.length < 2 || trimmedQuery.length > 100) {
      return;
    }
    
    setSearching(true);
    
    try {
      // Record search first
      const recordResult = await recordSearch();
      if (!recordResult.success) {
        // Check error type to show correct modal
        const isGuestLimit = recordResult.error?.includes("guest limit");
        const isPremiumLimit = recordResult.error?.includes("Daily search limit reached");
        const needsEmailVerification = recordResult.error?.includes("Email verification required");

        if (isGuestLimit) {
          openGuestModal("search");
        } else if (isPremiumLimit) {
          // Redirect to premium page
          router.push("/premium");
        } else if (needsEmailVerification) {
          setEmailVerificationPrompt(
            "Za nadaljevanje moraš potrditi svoj e-naslov. Preveri pošto ali potrdi z novim emailom."
          );
          setEmailVerificationMessage("");
          setEmailVerificationError("");
          setShowEmailVerificationModal(true);
        } else {
          // Other error - allow search to continue to avoid empty results
          console.warn("Search tracking failed, continuing search:", recordResult.error);
          setAutoSearchBlockedQuery(null);
          setApprovedQuery(trimmedQuery);
          setSearching(false);
          return;
        }

        if (isPremium) {
          setAutoSearchBlockedQuery(trimmedQuery);
        }
        setSearching(false);
        return;
      }
      setAutoSearchBlockedQuery(null);
      setApprovedQuery(trimmedQuery);
      setHasSearchedOnce(true);

      // Trigger re-fetch of profile to update searchesRemaining
      // The search results will be fetched by useQuery below
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  };
  
  // Auto-search when query changes (but only after recordSearch)
  const dbSearchResults = useQuery(
    api.products.search,
    approvedQuery.length >= 2 ? { query: approvedQuery, isPremium } : "skip"
  );

  // Use searchResults directly
  const rawResults = dbSearchResults ?? [];
  const searchResults = rawResults
    .map((product) => {
      const prices = product.prices
        .filter((price) => isAllowedStoreName(price.storeName))
        .filter((price) => Number.isFinite(price.price) && price.price > 0)
        .sort((a, b) => a.price - b.price);

      if (prices.length === 0) return null;

      return {
        ...product,
        prices,
        lowestPrice: prices[0].price,
        highestPrice: prices[prices.length - 1].price,
      };
    })
    .filter((product): product is ProductResult => product !== null);
  // Only show loading during actual search mutation, not during Convex re-fetches (prevents flickering)
  const isSearchResultsLoading = searching;

  // Sort results based on swipe direction
  const sortedResults = searchResults
    ? [...searchResults].sort((a, b) => a.lowestPrice - b.lowestPrice)
    : [];

  const limitedResults = sortedResults.slice(0, 20);

  const handleSearchFocus = () => {
    RNAnimated.spring(searchBarScale, {
      toValue: 1.02,
      useNativeDriver: true,
    }).start();
  };

  const handleSearchBlur = () => {
    RNAnimated.spring(searchBarScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const getCardAnimation = (productId: string): RNAnimated.Value => {
    if (!cardAnimationsRef.current[productId]) {
      cardAnimationsRef.current[productId] = new RNAnimated.Value(0);
    }
    return cardAnimationsRef.current[productId];
  };

  useEffect(() => {
    if (limitedResults.length > 0) {
      limitedResults.forEach((product, index) => {
        const resultKey = product._id ? String(product._id) : `sheet-${normalizeResultKey(product.name)}`;
        const anim = getCardAnimation(resultKey);
        RNAnimated.spring(anim, {
          toValue: 1,
          delay: index * 50,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }).start();
      });
    }
  }, [limitedResults.length]);

  // Premium button shake effect
  useEffect(() => {
    if (isPremium) return;

    const shakeSequence = () => {
      RNAnimated.sequence([
        RNAnimated.timing(shakeAnim, {
          toValue: 1,
          duration: 50,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        RNAnimated.timing(shakeAnim, {
          toValue: -1,
          duration: 100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        RNAnimated.timing(shakeAnim, {
          toValue: 1,
          duration: 100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        RNAnimated.timing(shakeAnim, {
          toValue: -1,
          duration: 100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        RNAnimated.timing(shakeAnim, {
          toValue: 0,
          duration: 50,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start();
    };

    // Shake every 5 seconds
    const interval = setInterval(shakeSequence, 5000);
    // Initial shake after 2 seconds
    const timeout = setTimeout(shakeSequence, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isPremium, shakeAnim]);

  // Glow pulse animation - properly stop when not needed
  useEffect(() => {
    if (isPremium) return;

    const animation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        RNAnimated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [isPremium, glowAnim]);

  useEffect(() => {
    return () => {
      if (cartToastTimeoutRef.current) {
        clearTimeout(cartToastTimeoutRef.current);
      }
      if (cartPreviewTimeoutRef.current) {
        clearTimeout(cartPreviewTimeoutRef.current);
      }
    };
  }, []);

  const handlePremiumPress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push("/premium");
  };

  // Camera/Scanner functions
  const handleOpenCamera = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (isGuestMode) {
      openGuestModal("camera");
      return;
    }

    // Check if user is premium
    if (!isPremium) {
      setShowPremiumModal(true);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // Omogoči polno sliko za boljši OCR
      quality: 0.9, // Višja kvaliteta za boljše prepoznavanje teksta
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      handleImageSelected(result.assets[0].uri);
    }
  };

  const handleImageSelected = async (uri: string) => {
    setScanningImage(uri);
    setShowScanner(true);
    setIsAnalyzing(true);
    setScanResult(null);

    // Start scan line animation - store ref to stop later
    scanAnimationRef.current = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        RNAnimated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    scanAnimationRef.current.start();

    // Pulse animation - store ref to stop later
    pulseAnimationRef.current = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimationRef.current.start();

    try {
      // Convert image to base64
      let base64Image = "";
      if (Platform.OS === "web") {
        // For web, fetch the blob and convert
        const response = await fetch(uri);
        const blob = await response.blob();
        base64Image = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } else {
        // For native, use FileSystem
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: "base64",
        });
        base64Image = `data:image/jpeg;base64,${base64}`;
      }

      // Call AI to analyze the image
      const result = await analyzeImage({ imageBase64: base64Image });

      setIsAnalyzing(false);
      // Stop scan animations
      scanAnimationRef.current?.stop();
      pulseAnimationRef.current?.stop();

      if (result.success && result.productName && result.confidence && result.confidence > 0.6) {
        // Only accept results with good confidence
        setScanResult(result.productName);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        // Low confidence or no product name - show "not recognized"
        setScanResult("❌ Ne prepozna - poskusi z boljšo sliko");
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      setIsAnalyzing(false);
      // Stop scan animations
      scanAnimationRef.current?.stop();
      pulseAnimationRef.current?.stop();
      setScanResult("❌ Napaka pri analizi - poskusi ponovno");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const handleUseScanResult = () => {
    if (scanResult && !scanResult.startsWith("❌")) {
      // Only use valid product names, not error messages
      setSearchQuery(scanResult);
      setShowScanner(false);
      setScanningImage(null);
      setScanResult(null);
      
      // Automatically trigger search with the scanned product
      setApprovedQuery(scanResult);
      setAutoSearchBlockedQuery(null);
      
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  };

  const handleCloseScanner = () => {
    setShowScanner(false);
    setScanningImage(null);
    setScanResult(null);
    setIsAnalyzing(false);
    // Stop scan animations
    scanAnimationRef.current?.stop();
    pulseAnimationRef.current?.stop();
  };

  const handleAddToCart = useCallback(
    async (product: ProductResult, price: PriceInfo) => {
      if (isGuestMode) {
        openGuestModal("cart");
        return;
      }
      if (!product._id || !price.storeId) {
        triggerErrorToast("Tega izdelka trenutno ni možno dodati na seznam.");
        return;
      }

      const cartKey = `${product._id}-${price.storeId}`;

      // Immediate haptic feedback on press
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Optimistic UI - show adding state immediately
      setAddingToCart(cartKey);

      try {
        await addToCart({
          productId: product._id,
          storeId: price.storeId,
          price: price.price,
        });

        // Success haptic
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        setAddedToCart(cartKey);
        setRecentCartItems((prev) => [
          {
            key: `${cartKey}-${Date.now()}`,
            name: product.name,
            store: price.storeName,
            quantity: 1,
          },
          ...prev,
        ].slice(0, 3));
        triggerCartToast("Dodano na seznam!");
        setTimeout(() => setAddedToCart(null), 1500);
      } catch (error) {
        console.error("Napaka pri dodajanju:", error);
      } finally {
        setAddingToCart(null);
      }
    },
    [addToCart, isGuestMode, triggerCartToast]
  );

  const handleAddToCartFromSearch = useCallback(
    async (product: ProductResult, price: PriceInfo) => {
      if (isGuestMode) {
        openGuestModal("cart");
        return;
      }
      if (!isPremium) {
        router.push("/premium");
        return;
      }

      const cartKey = `sheet-${normalizeResultKey(product.name)}-${normalizeResultKey(price.storeName)}`;

      // Immediate haptic feedback on press
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Optimistic UI - show adding state immediately
      setAddingToCart(cartKey);

      try {
        await addToCartFromSearch({
          productName: product.name,
          productCategory: product.category,
          productUnit: product.unit,
          storeName: price.storeName,
          storeColor: price.storeColor,
          price: price.price,
          isOnSale: price.isOnSale,
        });

        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        setAddedToCart(cartKey);
        setRecentCartItems((prev) => [
          {
            key: `${cartKey}-${Date.now()}`,
            name: product.name,
            store: price.storeName,
            quantity: 1,
          },
          ...prev,
        ].slice(0, 3));
        triggerCartToast("Dodano na seznam!");
        setTimeout(() => setAddedToCart(null), 1500);
      } catch (error) {
        console.error("Napaka pri dodajanju:", error);
        const errorMessage = error instanceof Error ? error.message : "Napaka pri dodajanju na seznam";
        triggerErrorToast(errorMessage);
      } finally {
        setAddingToCart(null);
      }
    },
    [addToCartFromSearch, isGuestMode, isPremium, router, triggerCartToast, triggerErrorToast]
  );

  const formatPrice = (price: number) => {
    if (!Number.isFinite(price) || price <= 0) return "--";
    return price.toFixed(2).replace(".", ",") + " EUR";
  };

  const formatSavings = (value: number) => {
    if (!Number.isFinite(value)) return "0.00 EUR";
    return value.toFixed(2).replace(".", ",") + " EUR";
  };

  const getProductEmoji = (productName: string) => {
    const normalize = (value: string) => {
      const lower = value.toLowerCase();
      if (typeof lower.normalize === "function") {
        return lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      }
      return lower
        .replace(/[čć]/g, "c")
        .replace(/š/g, "s")
        .replace(/ž/g, "z");
    };
    const nameLower = normalize(productName);
    const has = (...needles: string[]) =>
      needles.some((needle) => nameLower.includes(needle));

    // MLEKO & MLEČNI IZDELKI
    if (has("mleko") && !has("kokos", "sojin", "ovseni", "riževo", "riževo")) return "🥛";
    if (has("kokos", "sojin", "ovseni", "riževo", "riževo") && has("mleko")) return "🥥";
    if (has("jogurt", "kefir")) return "🥛";
    if (has("sir", "parmezan", "mocarela", "brie", "gorgonzola", "emmental")) return "🧀";
    if (has("maslo", "margarin")) return "🧈";
    if (has("skuta")) return "🥛";
    if (has("smetana", "kremni", "whipping")) return "🥛";
    
    // PIJAČE - SOK & LIMONADA
    if (has("sok", "juice", "smoothie")) return "🧃";
    if (has("limonada", "limunada", "gaziran", "fanta", "sprite")) return "🥤";
    if (has("coca", "cola", "pepsi", "cedevita")) return "🥤";
    if (has("energi", "red bull", "monster", "hell")) return "⚡";
    if (has("pivo", "beer", "lager", "lasko", "union", "heineken")) return "🍺";
    if (has("vino", "wine", "belo", "rdece", "rose")) return "🍷";
    if (has("voda", "water", "mineral", "gaziran")) return "💧";
    if (has("kava", "coffee", "espresso", "cappuccino")) return "☕";
    if (has("caj", "tea", "herbata")) return "🍵";
    
    // KRUH & PEKOVSKI IZDELKI
    if (has("kruh", "bread", "črn kruh", "crn kruh", "polbel", "toast")) return "🍞";
    if (has("zemlja", "bageta", "ciabatta")) return "🥖";
    if (has("burek", "gibanica", "pita")) return "🥐";
    if (has("croissant", "roglic")) return "🥐";
    if (has("pecivo", "kifle", "strucka", "stručka")) return "🥖";
    
    // MESO & MESNI IZDELKI
    if (has("pišcan", "piscan", "chicken", "piscance", "file", "prsa")) return "🍗";
    if (has("govedina", "beef", "govej", "steak", "zrezek")) return "🥩";
    if (has("svinjina", "pork", "svinjski", "šunka", "sunka")) return "🥓";
    if (has("salama", "klobasa", "hrenovka", "sausage", "kranjska")) return "🌭";
    if (has("pršut", "prsut", "prosciutto", "sušeno meso", "suseno meso")) return "🥓";
    if (has("bacon", "slanina")) return "🥓";
    
    // RIBE & MORSKI SADEŽI
    if (has("riba", "tuna", "losos", "salmon", "sardela", "pastrv")) return "🐟";
    if (has("škampi", "skampi", "lignji", "hobotnica", "seafood")) return "🦐";
    
    // SADJE
    if (has("jabolko", "apple", "jabolka")) return "🍎";
    if (has("banana", "banane")) return "🍌";
    if (has("pomaranča", "pomaranca", "orange")) return "🍊";
    if (has("jagoda", "jagode", "strawberry", "strawberries")) return "🍓";
    if (has("grozdje", "grape", "rozine")) return "🍇";
    if (has("kivi")) return "🥝";
    if (has("breskev", "peach", "nektarin")) return "🍑";
    if (has("ananas", "pineapple")) return "🍍";
    if (has("lubenica", "watermelon", "melona")) return "🍉";
    if (has("limona", "lemon", "lime")) return "🍋";
    if (has("češnja", "cesnja", "češnje", "cesnje", "cherry", "višnja", "visnja")) return "🍒";
    
    // ZELENJAVA
    if (has("paradiznik", "tomato", "pomidoro")) return "🍅";
    if (has("solata", "lettuce", "rukola", "iceberg")) return "🥬";
    if (has("krompir", "potato", "pomfri")) return "🥔";
    if (has("korenje", "carrot", "korenj")) return "🥕";
    if (has("paprika", "pepper", "chili")) return "🫑";
    if (has("kumara", "cucumber", "kumaric")) return "🥒";
    if (has("cebula", "onion", "čebula", "cebula")) return "🧅";
    if (has("česen", "cesen", "garlic")) return "🧄";
    if (has("brokoli", "broccoli")) return "🥦";
    if (has("grah", "grašic", "grasic", "peas")) return "🫛";
    if (has("fižol", "fizol", "bean", "pasulj")) return "🫘";
    if (has("kukuruz", "corn", "koruza")) return "🌽";
    
    // SLADKARIJE & DESERTI
    if (has("čokolada", "cokolada", "chocolate", "čoko", "coko")) return "🍫";
    if (has("milka", "nutella", "kinder")) return "🍫";
    if (has("bonbon", "candy", "lizika", "gumijast")) return "🍬";
    if (has("torta", "cake", "biskvit")) return "🍰";
    if (has("sladoled", "ice cream", "gelato")) return "🍦";
    if (has("keks", "piškot", "piskot", "cookie")) return "🍪";
    if (has("čupavci", "cupavci", "kokosov", "cokoladni desert")) return "🧁";
    if (has("med", "honey")) return "🍯";
    if (has("marmelada", "jam", "džem", "dzem")) return "🍓";
    
    // TESTENINE & ŽITA
    if (has("testenin", "pasta", "špageti", "spageti", "makaroni")) return "🍝";
    if (has("riž", "riz", "rice", "basmati", "risotto")) return "🍚";
    if (has("kruh", "zrnje", "kvinoja", "quinoa")) return "🌾";
    if (has("kosmiči", "kosmici", "muesli", "granola", "ovseni", "cornflakes")) return "🥣";
    
    // ZAČIMBE & PRIPOMOČKI
    if (has("moka", "flour", "bela moka", "polnozrnata")) return "🌾";
    if (has("sladkor", "sugar", "kristalni", "kokosov sladkor")) return "🧂";
    if (has("sol", "salt", "morska sol")) return "🧂";
    if (has("olje", "oil", "oljčno", "oljcno", "sončnično", "soncnicno", "oljna")) return "🫒";
    if (has("začimba", "zacimba", "poper", "pepper", "začimbe", "zacimbe")) return "🌶️";
    if (has("kvas", "yeast", "pecilni", "prašek", "prasek")) return "🧁";
    
    // JAJCA
    if (has("jajca", "jajce", "egg", "eggs")) return "🥚";
    
    // KONZERVIRANI IZDELKI
    if (has("konzerv", "canned", "tuna v konzervi")) return "🥫";
    if (has("juha", "soup", "minestrone")) return "🍲";
    
    // PRIGRIZKI
    if (has("chips", "čips", "cips", "hrustljav")) return "🍟";
    if (has("kokice", "popcorn")) return "🍿";
    if (has("smoki", "flips", "kreker", "snack")) return "🥨";
    if (has("orešček", "orescek", "oreški", "oreski", "arašid", "arasid", "mandelj", "lešnik", "lesnik", "nut")) return "🥜";
    
    // HIGIENA & KOZMETIKA
    if (has("milo", "soap", "tekoče", "tekoce")) return "🧼";
    if (has("šampon", "sampon", "shampoo", "balzam")) return "🧴";
    if (has("zobna", "pasta", "toothpaste", "zobni")) return "🦷";
    if (has("higiena", "papir", "toilet", "wc")) return "🧻";
    if (has("dezodorant", "deo", "deodorant")) return "💨";
    
    // ČIŠČENJE
    if (has("prašek", "prasek", "detergen", "pralno", "ariel", "persil")) return "🧺";
    if (has("mehčalec", "mehcalec", "softener", "lenor")) return "💧";
    if (has("čistilo", "cistilo", "mr proper", "domestos")) return "🧽";
    
    // PET ARTIKLI
    if (has("hrana za psa", "dog food", "psja", "chappi")) return "🐶";
    if (has("hrana za mačko", "macka", "macko", "cat food")) return "🐱";
    
    // DEFAULT
    return "🛒";
  };

  const calculateSavings = (product: ProductResult) => {
    if (product.prices.length < 2) return null;
    const savings = product.highestPrice - product.lowestPrice;
    const percentage = Math.round((savings / product.highestPrice) * 100);
    return { amount: savings, percentage };
  };

  const toggleExpand = (productId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpandedProduct(expandedProduct === productId ? null : productId);
  };

  const renderProductCard = (product: ProductResult) => {
    const resultKey = product._id ? String(product._id) : `sheet-${normalizeResultKey(product.name)}`;
    const isExpanded = expandedProduct === resultKey;
    const validPriceStores = product.prices.filter((p) => Number.isFinite(p.price) && p.price > 0);
    const displayPrices = buildDisplayPrices(product.prices);
    // Count only stores that actually have this product (not missing)
    const storeCount = displayPrices.filter(p => !p.missing).length;
    const lowestPriceStore = validPriceStores[0];
    const lowestStoreKey = lowestPriceStore ? normalizeStoreKey(lowestPriceStore.storeName) : null;
    const displayLowestPrice = lowestPriceStore?.price ?? product.lowestPrice;
    const lowestBrand = lowestPriceStore
      ? getStoreBrand(lowestPriceStore.storeName, lowestPriceStore.storeColor)
      : null;
    const savings = calculateSavings({
      ...product,
      prices: validPriceStores,
      lowestPrice: displayLowestPrice,
      highestPrice: product.highestPrice,
    });
    const cardAnim = getCardAnimation(resultKey);
    const cartLocked = isGuestMode;
    const lowestCartKey =
      product._id && lowestPriceStore?.storeId
        ? `${product._id}-${lowestPriceStore.storeId}`
        : null;
    const canQuickAdd = !!product._id && !!lowestPriceStore?.storeId;
    const isQuickAdded = !!lowestCartKey && addedToCart === lowestCartKey;

    return (
      <RNAnimated.View
        key={resultKey}
        style={[
          styles.productCard,
          {
            opacity: cardAnim,
            transform: [
              {
                translateY: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
              {
                scale: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1],
                }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(139, 92, 246, 0.15)", "rgba(59, 7, 100, 0.3)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          {/* Main Product Info */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => toggleExpand(resultKey)}
            style={styles.cardContent}
          >
            {/* Product Image & Info */}
            <View style={styles.productHeader}>
              <View style={styles.productInfoRow}>
                <Pressable
                  style={styles.productImageContainer}
                  onPress={() => {
                    if (product.imageUrl) {
                      setPreviewImage({ url: product.imageUrl, name: product.name });
                    }
                  }}
                  disabled={!product.imageUrl}
                >
                  {product.imageUrl ? (
                    <Image
                      source={{ uri: product.imageUrl }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <LinearGradient
                      colors={["rgba(168, 85, 247, 0.3)", "rgba(139, 92, 246, 0.1)"]}
                      style={styles.productImageBg}
                    >
                      <Text style={styles.productEmoji}>
                        {getProductEmoji(product.name)}
                      </Text>
                    </LinearGradient>
                  )}
                </Pressable>

                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={3} ellipsizeMode="tail" minimumFontScale={0.9}>
                    {product.name}
                  </Text>
                  <Text style={styles.productUnit} numberOfLines={1} ellipsizeMode="tail">
                    {product.unit}
                  </Text>
                </View>
              </View>

              {/* Price Display */}
              <View style={styles.priceSection}>
                <View style={styles.priceMetaRow}>
                  <Text style={styles.lowestPriceLabel}>Najnižja cena</Text>
                  {lowestBrand && lowestPriceStore && (
                    <View style={styles.storeChip}>
                      <View
                        style={[
                          styles.storeLogoSmall,
                          { backgroundColor: lowestBrand.bg, borderColor: lowestBrand.border },
                        ]}
                      >
                        {lowestBrand.ring && (
                          <View
                            style={[
                              styles.brandRingSmall,
                              { borderColor: lowestBrand.ring.color, borderWidth: lowestBrand.ring.width ?? 1.5 },
                            ]}
                          />
                        )}
                        {lowestBrand.cornerIcon && (
                          <Text
                            style={[
                              styles.cornerIcon,
                              {
                                top: lowestBrand.cornerIcon.top,
                                left: lowestBrand.cornerIcon.left,
                                color: lowestBrand.cornerIcon.color,
                                fontSize: lowestBrand.cornerIcon.fontSize,
                              },
                            ]}
                          >
                            {lowestBrand.cornerIcon.char}
                          </Text>
                        )}
                        <Text style={[styles.storeLogoSmallText, { color: lowestBrand.text }]}>
                          {lowestPriceStore.storeName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.storeChipName} numberOfLines={1} ellipsizeMode="tail">
                        {lowestPriceStore.storeName}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.priceValueRow}>
                  <Text style={styles.lowestPrice}>{formatPrice(displayLowestPrice)}</Text>
                  {savings && savings.amount > 0 && (
                    <View style={styles.savingsBadge}>
                      <Ionicons name="trending-down" size={14} color="#0ea35c" />
                      <Text style={styles.savingsText}>-{savings.percentage}%</Text>
                    </View>
                  )}
                </View>
              </View>
              </View>

            {/* Quick Add Button */}
            <TouchableOpacity
              style={[
                styles.quickAddButton,
                isQuickAdded && styles.quickAddButtonSuccess,
                cartLocked && styles.quickAddButtonLocked,
                (!lowestPriceStore || !canQuickAdd) && { opacity: 0.5 },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                if (lowestPriceStore) {
                  handleAddToCart(product, lowestPriceStore);
                }
              }}
              disabled={!lowestPriceStore || !canQuickAdd}
            >
              <LinearGradient
                colors={
                  cartLocked
                    ? ["rgba(148, 163, 184, 0.35)", "rgba(71, 85, 105, 0.45)"]
                    : isQuickAdded
                      ? ["#10b981", "#059669"]
                      : ["#8b5cf6", "#7c3aed"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.quickAddGradient}
              >
                <Ionicons
                  name={
                    cartLocked
                      ? "lock-closed"
                      : isQuickAdded
                        ? "checkmark"
                        : "add"
                  }
                  size={18}
                  color="#fff"
                />
                <Text style={styles.quickAddText}>
                  {cartLocked
                    ? "Prijava za Seznam"
                    : lowestPriceStore
                      ? isQuickAdded
                        ? "Dodano!"
                        : "Dodaj na seznam"
                      : "--"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Expand Indicator - Only show if multiple stores have this product */}
            {storeCount > 1 && (
              <View style={styles.expandIndicator}>
                <Text style={styles.expandText}>
                  {isExpanded ? "Skrij cene" : `Primerjaj ${storeCount} trgovin`}
                </Text>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#a78bfa"
                />
              </View>
            )}
          </TouchableOpacity>

          {/* Expanded Store List */}
          {isExpanded && (
            <View style={styles.storeList}>
              <View style={styles.storeListDivider} />
              {displayPrices.map((price, priceIndex) => {
                const isMissing = !!price.missing;
                const storeKey = normalizeStoreKey(price.storeName);
                const isLowest = !!lowestStoreKey && storeKey === lowestStoreKey && !isMissing;
                const cartKey = product._id && price.storeId
                  ? `${product._id}-${price.storeId}`
                  : `sheet-${normalizeResultKey(product.name)}-${normalizeResultKey(price.storeName)}`;
                const isAdded = addedToCart === cartKey;
                const isAddingThis = addingToCart === cartKey;
                const canAdd = !!product._id && !!price.storeId && !isMissing;
                const rowKey = price.storeId
                  ? String(price.storeId)
                  : `${resultKey}-${normalizeResultKey(price.storeName)}-${priceIndex}`;
                const storeBrand = getStoreBrand(price.storeName, price.storeColor);

                return (
                  <View
                    key={rowKey}
                    style={[
                      styles.storeRow,
                      isLowest && styles.storeRowLowest,
                      priceIndex === displayPrices.length - 1 && styles.storeRowLast,
                      isMissing && styles.storeRowMissing,
                    ]}
                  >
                    <View style={styles.storeInfo}>
                      <View style={[
                        styles.storeLogo,
                        { backgroundColor: storeBrand.bg, borderColor: storeBrand.border }
                      ]}>
                        {storeBrand.ring && (
                          <View
                            style={[
                              styles.brandRingLarge,
                              { borderColor: storeBrand.ring.color, borderWidth: storeBrand.ring.width ?? 1.6 },
                            ]}
                          />
                        )}
                        {storeBrand.cornerIcon && (
                          <Text
                            style={[
                              styles.cornerIcon,
                              {
                                top: storeBrand.cornerIcon.top,
                                left: storeBrand.cornerIcon.left,
                                color: storeBrand.cornerIcon.color,
                                fontSize: storeBrand.cornerIcon.fontSize,
                              },
                            ]}
                          >
                            {storeBrand.cornerIcon.char}
                          </Text>
                        )}
                        <Text style={[styles.storeLogoText, { color: storeBrand.text }]}>
                          {price.storeName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.storeRowName} numberOfLines={1} ellipsizeMode="tail">
                          {price.storeName.toUpperCase()}
                        </Text>
                        {isLowest && (
                          <View style={styles.lowestBadge}>
                            <Text style={styles.lowestBadgeText}>NAJCENEJŠE</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.storePriceSection}>
                      <View style={styles.priceContainer}>
                        {!isMissing && price.isOnSale && price.originalPrice && (
                          <Text style={styles.originalPrice}>{formatPrice(price.originalPrice)}</Text>
                        )}
                        <Text
                          style={[
                            styles.storePrice,
                            isLowest && styles.storePriceLowest,
                            isMissing && styles.storePriceMissing,
                          ]}
                        >
                          {isMissing ? "--" : formatPrice(price.price)}
                        </Text>
                        {!isMissing && price.isOnSale && (
                          <View style={styles.saleBadge}>
                            <Text style={styles.saleText}>AKCIJA</Text>
                          </View>
                        )}
                      </View>

                      {isMissing ? (
                        <View style={styles.addButtonDisabled}>
                          <Ionicons name="remove-circle-outline" size={20} color="#94a3b8" />
                        </View>
                      ) : canAdd ? (
                        <Pressable
                          style={({ pressed }) => [
                            styles.addButton,
                            isAdded && styles.addButtonSuccess,
                            isAddingThis && styles.addButtonAdding,
                            cartLocked && styles.addButtonLocked,
                            pressed && !cartLocked && styles.addButtonPressed,
                          ]}
                          onPress={() => handleAddToCart(product, price)}
                          disabled={cartLocked || isAddingThis}
                        >
                          {isAddingThis ? (
                            <ActivityIndicator size={16} color="#a78bfa" />
                          ) : (
                            <Ionicons
                              name={cartLocked ? "lock-closed" : isAdded ? "checkmark" : "cart-outline"}
                              size={20}
                              color={cartLocked ? "#cbd5e1" : isAdded ? "#10b981" : "#a78bfa"}
                            />
                          )}
                        </Pressable>
                      ) : (
                        <Pressable
                          style={({ pressed }) => [
                            styles.addToCartButton,
                            isAdded && styles.addToCartButtonSuccess,
                            !isPremium && styles.addToCartButtonLocked,
                            pressed && isPremium && !isAddingThis && styles.addToCartButtonPressed,
                          ]}
                          onPress={() => handleAddToCartFromSearch(product, price)}
                          disabled={isAddingThis || isGuestMode}
                        >
                          {!isPremium ? (
                            <View style={styles.premiumBadge}>
                              <Text style={styles.premiumBadgeText}>Premium</Text>
                            </View>
                          ) : (
                            <LinearGradient
                              colors={isAdded ? ["#10b981", "#059669"] : ["#8b5cf6", "#7c3aed"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.addToCartGradient}
                            >
                              {isAddingThis ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <>
                                  <Ionicons
                                    name={isAdded ? "checkmark" : "cart-outline"}
                                    size={16}
                                    color="#fff"
                                  />
                                  <Text style={styles.addToCartText}>
                                    {isAdded ? "Dodano" : "Dodaj"}
                                  </Text>
                                </>
                              )}
                            </LinearGradient>
                          )}
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </LinearGradient>
      </RNAnimated.View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
      />
      <FloatingBackground variant="sparse" />

      {!isPremium && (
        <RNAnimated.View
          style={[
            styles.premiumFab,
            {
              top: fabTop,
              left: fabHorizontal,
              transform: [
                {
                  translateX: shakeAnim.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [-3, 0, 3],
                  }),
                },
                {
                  scale: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [fabScaleMin, fabScaleMax],
                  }),
                },
              ],
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.85, 1],
              }),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.premiumFabButton}
            onPress={handlePremiumPress}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#fbbf24", "#f59e0b", "#d97706"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.premiumFabGradient,
                isCompact && styles.premiumFabGradientCompact,
              ]}
            >
              <Ionicons name="diamond" size={premiumIconSize} color="#000" />
              <Text style={[styles.premiumFabText, isCompact && styles.premiumFabTextCompact]}>
                {premiumFabLabel}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </RNAnimated.View>
      )}

      {isGuestMode && (
        <RNAnimated.View
          style={[
            styles.authFab,
            {
              top: fabTop,
              right: fabHorizontal,
              transform: [
                {
                  scale: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [fabScaleMin, fabScaleMax],
                  }),
                },
              ],
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.authFabButton}
            onPress={handleGuestAuthPress}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#8b5cf6", "#7c3aed"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.authFabGradient,
                isCompact && styles.authFabGradientCompact,
              ]}
            >
              <Ionicons name="person-add" size={authIconSize} color="#fff" />
              <Text style={[styles.authFabText, isCompact && styles.authFabTextCompact]}>
                {authFabLabel}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </RNAnimated.View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: scrollTopPadding }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[1]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#a78bfa"
            colors={["#8b5cf6", "#a78bfa"]}
            progressBackgroundColor="rgba(15, 10, 30, 0.9)"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={getSeasonalLogoSource()}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Pr'Hran</Text>
          <Text style={styles.subtitle}>Vsak evro šteje. Varčuj pametno!</Text>
        </View>

        <View style={styles.stickyHeader}>
          {isGuestMode && (
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.18)", "rgba(88, 28, 135, 0.28)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.guestBanner, isCompact && styles.guestBannerCompact]}
            >
              <View style={styles.guestBannerRow}>
                <View style={styles.guestBannerBadge}>
                  <Ionicons name="lock-closed" size={14} color="#c4b5fd" />
                  <Text style={styles.guestBannerBadgeText}>GOST</Text>
                </View>
                <Text style={[styles.guestBannerTitle, isCompact && styles.guestBannerTitleCompact]}>
                  Odkleni seznam in profil
                </Text>
                <Text style={[styles.guestBannerText, isCompact && styles.guestBannerTextCompact]}>
                  Registracija odklene še 2 iskanja danes + Seznam + Profil.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.guestBannerCta}
                onPress={handleGuestAuthPress}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#8b5cf6", "#7c3aed"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.guestBannerCtaGradient,
                    isCompact && styles.guestBannerCtaGradientCompact,
                  ]}
                >
                  <Ionicons name="person-add" size={16} color="#fff" />
                  <Text style={[styles.guestBannerCtaText, isCompact && styles.guestBannerCtaTextCompact]}>
                    Prijava / Registracija
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          )}
          {!isGuestMode && (
            <LinearGradient
              colors={["rgba(16, 185, 129, 0.2)", "rgba(15, 23, 42, 0.55)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statusBanner}
            >
              <View style={styles.statusTopRow}>
                <View style={styles.statusSeasonPill}>
                  <Ionicons name="sparkles" size={14} color="#a7f3d0" />
                  <Text style={styles.statusSeasonText}>
                    Sezona {displaySeasonYear}
                  </Text>
                </View>
                <View style={styles.statusDeadlinePill}>
                  <Ionicons name="time" size={14} color="#fcd34d" />
                  <Text style={styles.statusDeadlineText}>Do 24. decembra ob 17:00</Text>
                </View>
              </View>
              <View style={styles.statusMainRow}>
                <View style={styles.statusSavingsBlock}>
                  <Text style={styles.statusTitle}>Prihranil si letos</Text>
                  <Text style={styles.statusValue}>{formatSavings(seasonSavings)}</Text>
                  <Text style={styles.statusSubtext}>Prihranek iz potrjenih računov</Text>
                </View>
                <View style={styles.statusRankBlock}>
                  <Text style={styles.statusRankLabel}>Tvoje mesto</Text>
                  <Text style={styles.statusRankValue}>{seasonRank ? `#${seasonRank}` : "--"}</Text>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Link href={"/leaderboard" as any} asChild>
                    <TouchableOpacity
                      style={styles.statusRankBadge}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="trophy" size={14} color="#fbbf24" />
                      <Text style={styles.statusRankBadgeText}>Lestvica</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              </View>
            </LinearGradient>
          )}

          {/* Search Bar with Camera Button */}
          <View style={styles.searchRow}>
            <RNAnimated.View style={[styles.searchContainer, { transform: [{ scale: searchBarScale }], flex: 1 }]}>
              <BlurView intensity={40} tint="dark" style={styles.searchBlur}>
                <LinearGradient
                  colors={["rgba(139, 92, 246, 0.2)", "rgba(59, 7, 100, 0.3)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.searchGradient}
                >
                  <Ionicons name="search" size={22} color="#a78bfa" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Išči izdelke..."
                    placeholderTextColor="#ffffff"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onFocus={handleSearchFocus}
                    onBlur={handleSearchBlur}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    editable={isPremium || searchesRemaining > 0}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearButton}>
                      <Ionicons name="close-circle" size={20} color="#6b7280" />
                    </TouchableOpacity>
                  )}
                  {!isPremium && searchesRemaining <= 0 && (
                    <TouchableOpacity
                      style={styles.searchBlocker}
                      onPress={() => {
                        openGuestModal("search");
                      }}
                      activeOpacity={1}
                    />
                  )}
                </LinearGradient>
              </BlurView>
            </RNAnimated.View>

            {/* Camera Button */}
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handleOpenCamera}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#fbbf24", "#f59e0b"]}
                style={styles.cameraButtonGradient}
              >
                <Ionicons name="camera" size={24} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Limit Indicator */}
        {!isPremium && (
          <View style={styles.searchLimitContainer}>
            <View style={styles.searchLimitBar}>
              <View
                style={[
                  styles.searchLimitFill,
                  { width: `${searchLimitRatio * 100}%` },
                  searchesRemaining === 0 && styles.searchLimitFillEmpty,
                ]}
              />
            </View>
            {searchesRemaining > 0 ? (
              <Text style={styles.searchLimitText}>
                {searchesRemaining}/{maxSearches} {searchLimitLabel}
              </Text>
            ) : timeRemaining ? (
              <View style={styles.timerContainer}>
                <Ionicons name="time-outline" size={14} color="#fbbf24" />
                <Text style={styles.timerText}>
                  Novo iskanje čez {timeRemaining}
                </Text>
              </View>
            ) : (
              <Text style={styles.searchLimitTextEmpty}>
                {isGuestMode
                  ? "Registracija odklene še 2 iskanji danes + Seznam + Profil."
                  : `Dosegel si dnevni limit iskanj. Nadgradi na ${PLAN_PLUS} za neomejeno iskanje.`}
              </Text>
            )}
          </View>
        )}

        {/* Loading Indicator - Skeleton */}
        {isSearchResultsLoading && searchQuery.length >= 2 && limitedResults.length === 0 && (
          <View style={styles.loadingIndicatorContainer}>
            <Text style={styles.loadingIndicatorText}>Iskanje izdelkov...</Text>
            <ProductListSkeleton count={4} />
          </View>
        )}

        {/* Results */}
        {searchQuery.length < 2 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <LinearGradient
                colors={["rgba(139, 92, 246, 0.3)", "rgba(59, 7, 100, 0.2)"]}
                style={styles.emptyIconBg}
              >
                <Ionicons name="basket-outline" size={48} color="#a78bfa" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>Začni z iskanjem</Text>
            <Text style={styles.emptyText}>Vpiši ime izdelka in takoj primerjaj cene{"\n"}v trgovinah Spar, Mercator in Tuš.{"\n"}Kmalu pridejo še druge trgovine!</Text>

            {/* Fun Fact Card */}
            <View style={styles.funFactCard}>
              <LinearGradient
                colors={["rgba(16, 185, 129, 0.15)", "rgba(16, 185, 129, 0.05)"]}
                style={styles.funFactGradient}
              >
                <View style={styles.funFactIcon}>
                  <Ionicons name="bulb" size={20} color="#10b981" />
                </View>
                <View style={styles.funFactContent}>
                  <Text style={styles.funFactTitle}>Ali veš?</Text>
                  <Text style={styles.funFactText}>{FUN_FACTS[funFactIndex]}</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>3</Text>
                <Text style={styles.statLabel}>Trgovine</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{
                  (() => {
                    // Try to get a dynamic count from Convex by estimating via search index size
                    // We don't have a direct count query exposed; fallback to an approximate label when undefined
                    // If backend later exposes a count query, we can replace this with useQuery(api.products.count, {})
                    // Show cached label if available via seasonSummary metadata in future; use safe fallback now
                    return typeof (globalThis as unknown as { __PRHRAN_TOTAL_PRODUCTS?: number }).__PRHRAN_TOTAL_PRODUCTS === "number"
                      ? (globalThis as unknown as { __PRHRAN_TOTAL_PRODUCTS?: number }).__PRHRAN_TOTAL_PRODUCTS!.toLocaleString("sl-SI")
                      : "30,000+";
                  })()
                }</Text>
                <Text style={styles.statLabel}>Izdelkov</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>Dnevno</Text>
                <Text style={styles.statLabel}>Posodabljanje</Text>
              </View>
            </View>
          </View>
        ) : isSearchResultsLoading && limitedResults.length === 0 ? (
          <View style={styles.searchingHint}>
            <Ionicons name="time-outline" size={18} color="#fbbf24" />
            <Text style={styles.searchingHintText}>Iščem rezultate...</Text>
          </View>
        ) : limitedResults.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Izdelka nismo našli</Text>
            <Text style={styles.emptyText}>
              Preveri kaj si napisal ali pa tega izdelka{"\n"}še nimamo v bazi.
            </Text>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsCount}>
              {limitedResults.length} {limitedResults.length === 1 ? "rezultat" : "rezultatov"}
            </Text>
            {limitedResults.map((product) => renderProductCard(product))}
            {isGuestMode && searchesRemaining <= 0 && limitedResults.length > 0 && (
              <TouchableOpacity
                style={styles.guestLimitCard}
                onPress={() => {
                  openGuestModal("search");
                }}
              >
                <LinearGradient
                  colors={["rgba(139, 92, 246, 0.15)", "rgba(88, 28, 135, 0.15)"]}
                  style={styles.guestLimitGradient}
                >
                  <Ionicons name="lock-closed" size={48} color="rgba(139, 92, 246, 0.6)" />
                  <Text style={styles.guestLimitTitle}>Odkleni več možnosti</Text>
                  <Text style={styles.guestLimitText}>
                    Kot gost imaš 1 iskanje na dan.{"\n"}
                    Registracija odklene še 2 iskanja danes + Seznam + Profil.
                  </Text>
                  <View style={styles.guestLimitButton}>
                    <Text style={styles.guestLimitButtonText}>Prijava / Registracija</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {showCartToast && (
        <RNAnimated.View
          pointerEvents="none"
          style={[
            styles.cartToast,
            {
              opacity: cartToastAnim,
              transform: [
                {
                  translateY: cartToastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(16, 185, 129, 0.95)", "rgba(5, 150, 105, 0.9)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cartToastGradient}
          >
            <Ionicons name="bag-check" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.cartToastTitle}>DODANO NA SEZNAM</Text>
          </LinearGradient>
        </RNAnimated.View>
      )}

      {showErrorToast && (
        <RNAnimated.View
          pointerEvents="none"
          style={[
            styles.errorToast,
            {
              opacity: errorToastAnim,
              transform: [
                {
                  translateY: errorToastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(239, 68, 68, 0.95)", "rgba(220, 38, 38, 0.9)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.errorToastGradient}
          >
            <Ionicons name="alert-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.errorToastText} numberOfLines={2}>{errorToastMessage}</Text>
          </LinearGradient>
        </RNAnimated.View>
      )}

      {showCartPreview && previewItems.length > 0 && (
        <RNAnimated.View
          style={[
            styles.cartPreview,
            {
              transform: [
                {
                  translateY: cartPreviewAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [140, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(15, 23, 42, 0.95)", "rgba(30, 27, 75, 0.95)"]}
            style={styles.cartPreviewGradient}
          >
            <View style={styles.cartPreviewHeader}>
              <View style={styles.cartPreviewTitleRow}>
                <Ionicons name="cart-outline" size={18} color="#a78bfa" />
                <Text style={styles.cartPreviewTitle}>Seznam posodobljen</Text>
              </View>
              <Text style={styles.cartPreviewCount}>
                {previewItems.length} izdelkov
              </Text>
            </View>

            <View style={styles.cartPreviewList}>
              {previewItems.map((item) => (
                <View key={item.key} style={styles.cartPreviewItem}>
                  <Text style={styles.cartPreviewItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cartPreviewItemMeta}>
                    {item.store} - {item.quantity}x
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.cartPreviewButton}
              onPress={() => router.push("/cart")}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={["#8b5cf6", "#7c3aed"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cartPreviewButtonGradient}
              >
                <Text style={styles.cartPreviewButtonText}>Poglej Seznam</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </RNAnimated.View>
      )}

      {/* Scanner Modal */}
      <Modal
        transparent
        visible={showScanner}
        onRequestClose={handleCloseScanner}
        animationType="fade"
        hardwareAccelerated
      >
        <View style={styles.modalOverlay}>
          <View style={styles.scannerModal}>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.95)", "rgba(88, 28, 135, 0.98)"]}
              style={styles.scannerModalGradient}
            >
              {/* Header */}
              <View style={styles.scannerHeader}>
                <View style={styles.scannerTitleRow}>
                  <Ionicons name="camera" size={24} color="#fbbf24" />
                  <Text style={styles.scannerTitle}>Skeniraj izdelek</Text>
                </View>
                <TouchableOpacity onPress={handleCloseScanner} style={styles.scannerCloseBtn}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Image Preview */}
              {scanningImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: scanningImage }} style={styles.imagePreview} />
                  {isAnalyzing && (
                    <View style={styles.analyzingOverlay}>
                      <RNAnimated.View
                        style={[
                          styles.scanLineAnimated,
                          {
                            transform: [
                              {
                                translateY: scanLineAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 200],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                      <View style={styles.analyzingContent}>
                        <Logo size={240} />
                        <Text style={styles.analyzingText}>Analiziram sliko...</Text>
                      </View>
                    </View>
                  )}
                  {scanResult && !isAnalyzing && (
                    <View style={styles.scanResultOverlay}>
                      <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                      <Text style={styles.scanResultLabel}>Najden izdelek:</Text>
                      <Text style={styles.scanResultText}>{scanResult}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.scannerPlaceholder}>
                  <View style={styles.scannerIconContainer}>
                    <Ionicons name="scan-outline" size={64} color="#a78bfa" />
                  </View>
                  <Text style={styles.scannerPlaceholderText}>Slikaj izdelek in takoj najdi{"\n"}najnižjo ceno v trgovinah Spar, Mercator in Tuš!</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.scannerActions}>
                {!scanningImage ? (
                  <>
                    <TouchableOpacity style={styles.scannerActionBtn} onPress={handleOpenCamera}>
                      <LinearGradient
                        colors={["#fbbf24", "#f59e0b"]}
                        style={styles.scannerActionGradient}
                      >
                        <Ionicons name="camera" size={24} color="#000" />
                        <Text style={styles.scannerActionText}>Odpri kamero</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : scanResult ? (
                  <>
                    <TouchableOpacity style={styles.scannerActionBtn} onPress={handleUseScanResult}>
                      <LinearGradient
                        colors={["#22c55e", "#16a34a"]}
                        style={styles.scannerActionGradient}
                      >
                        <Ionicons name="search" size={24} color="#fff" />
                        <Text style={[styles.scannerActionText, { color: "#fff" }]}>
                          Išči "{scanResult}"
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.scannerActionBtnSecondary}
                      onPress={() => {
                        setScanningImage(null);
                        setScanResult(null);
                      }}
                    >
                      <Ionicons name="refresh" size={20} color="#a78bfa" />
                      <Text style={styles.scannerActionTextSecondary}>Poskusi znova</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.analyzingInfo}>
                    <Text style={styles.analyzingInfoText}>
                      AI analizira sliko...
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Guest Limit Modal - Polished Design */}
      <Modal
        transparent
        visible={showGuestLimitModal}
        onRequestClose={closeGuestModal}
        animationType="fade"
        hardwareAccelerated
      >
        <View style={styles.modalOverlay}>
          <View style={styles.premiumModal}>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.98)", "rgba(88, 28, 135, 0.99)"]}
              style={styles.premiumModalGradient}
            >
              <TouchableOpacity
                style={styles.premiumCloseBtn}
                onPress={closeGuestModal}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>

              <View style={styles.premiumIconContainer}>
                <LinearGradient
                  colors={isGuestLimitContext ? ["#ef4444", "#dc2626"] : ["#8b5cf6", "#7c3aed"]}
                  style={styles.premiumIconGradient}
                >
                  <Ionicons
                    name={isGuestLimitContext ? "time" : isGuestCartContext ? "cart-outline" : "camera-outline"}
                    size={44}
                    color="#fff"
                  />
                </LinearGradient>
              </View>

              <Text style={styles.premiumModalTitle}>{guestModalTitle}</Text>

              {isGuestLimitContext ? (
                <View style={styles.guestTimerBox}>
                  <Text style={styles.guestTimerLabel}>Odštevalnik do polnoči</Text>
                  <Text style={styles.guestTimerValue}>{timeRemaining ?? "--:--:--"}</Text>
                  {!timeRemaining && (
                    <Text style={styles.guestLimitDescription}>
                      Novo iskanje bo na voljo ob polnoči.
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={styles.premiumModalSubtitle}>{guestModalSubtitle}</Text>
              )}

              <View
                style={[
                  styles.guestOptionsContainer,
                  guestOptionsSingle && styles.guestOptionsContainerSingle,
                ]}
              >
                {showRegistrationCta && (
                  <View style={[styles.guestOptionCard, guestOptionsSingle && styles.guestOptionCardFull]}>
                    <View style={styles.guestOptionBadge}>
                    <Text style={styles.guestOptionBadgeText}>BREZPLAČNO</Text>
                    </View>
                    <Text style={styles.guestOptionTitle}>Registracija</Text>
                    <Text style={styles.guestOptionDesc}>+2 iskanja danes + Seznam + Profil</Text>
                    <TouchableOpacity
                      style={styles.guestOptionBtn}
                      onPress={handleGuestAuthPress}
                    >
                      <LinearGradient
                        colors={["#8b5cf6", "#7c3aed"]}
                        style={styles.guestOptionBtnGradient}
                      >
                        <Ionicons name="person-add" size={18} color="#fff" />
                        <Text style={styles.guestOptionBtnText}>REGISTRIRAJ SE</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                {showPlusCta && (
                  <View style={[
                    styles.guestOptionCard,
                    styles.guestOptionCardPremium,
                    guestOptionsSingle && styles.guestOptionCardFull,
                  ]}>
                    <View style={[styles.guestOptionBadge, styles.guestOptionBadgePremium]}>
                      <Text style={styles.guestOptionBadgeTextPremium}>PRIPOROČENO</Text>
                    </View>
                    <Text style={styles.guestOptionTitle}>{PLAN_PLUS}</Text>
                    <Text style={styles.guestOptionDesc}>Neomejeno iskanje + slikanje izdelkov</Text>
                    <Text style={styles.guestOptionPrice}>1,99 EUR/mesec</Text>
                    <TouchableOpacity
                      style={styles.guestOptionBtn}
                      onPress={handleGuestPremiumPress}
                    >
                      <LinearGradient
                        colors={["#fbbf24", "#f59e0b"]}
                        style={styles.guestOptionBtnGradient}
                      >
                        <Ionicons name="diamond" size={18} color="#000" />
                        <Text style={[styles.guestOptionBtnText, { color: "#000" }]}>NADGRADI</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {showWaitOption && (
                <TouchableOpacity
                  style={styles.guestWaitBtn}
                  onPress={closeGuestModal}
                >
                  <Text style={styles.guestWaitBtnText}>Počakam do jutri -{"\u003e"}</Text>
                </TouchableOpacity>
              )}
            </LinearGradient>
          </View>
        </View>
      </Modal>
      {/* Premium Modal - Camera Upsell */}
      <Modal
        transparent
        visible={showPremiumModal}
        onRequestClose={() => setShowPremiumModal(false)}
        animationType="fade"
        hardwareAccelerated
      >
        <View style={styles.modalOverlay}>
          <View style={styles.premiumModal}>
            <LinearGradient
              colors={["rgba(251, 191, 36, 0.15)", "rgba(139, 92, 246, 0.95)", "rgba(88, 28, 135, 0.98)"]}
              style={styles.premiumModalGradient}
            >
              <TouchableOpacity
                style={styles.premiumCloseBtn}
                onPress={() => setShowPremiumModal(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>

              <View style={styles.premiumIconContainer}>
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b"]}
                  style={styles.premiumIconGradient}
                >
                  <Ionicons name="camera" size={40} color="#000" />
                </LinearGradient>
              </View>

              <Text style={styles.premiumModalTitle}>📸 {PLAN_PLUS} – odkleni kamero</Text>
              <Text style={styles.premiumModalSubtitle}>
                Slikanje izdelkov je del {PLAN_PLUS}. Z nadgradnjo dobiš neomejeno iskanje,
                pametne kupone in pregled prihrankov.
              </Text>

              <View style={styles.premiumFeatures}>
                <View style={styles.premiumFeatureItem}>
                  <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                  <Text style={styles.premiumFeatureText}>✨ Neomejeno iskanje vseh izdelkov</Text>
                </View>
                <View style={styles.premiumFeatureItem}>
                  <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                  <Text style={styles.premiumFeatureText}>📸 Slikaj izdelek in najdi najnižjo ceno</Text>
                </View>
                <View style={styles.premiumFeatureItem}>
                  <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                  <Text style={styles.premiumFeatureText}>🎟️ Pametni kuponi in akcije v trgovinah</Text>
                </View>
                <View style={styles.premiumFeatureItem}>
                  <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                  <Text style={styles.premiumFeatureText}>📊 Pregled prihrankov in lestvic</Text>
                </View>
              </View>

              <View style={styles.premiumPriceContainer}>
                <Text style={styles.premiumPriceLabel}>{PLAN_PLUS}</Text>
                <Text style={styles.premiumPrice}>1,99 EUR</Text>
                <Text style={styles.premiumPricePeriod}>/ mesec</Text>
              </View>

              <TouchableOpacity
                style={styles.premiumCtaBtn}
                onPress={() => {
                  setShowPremiumModal(false);
                  router.push("/premium");
                }}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b", "#d97706"]}
                  style={styles.premiumCtaBtnGradient}
                >
                  <Ionicons name="diamond" size={20} color="#000" />
                  <Text style={styles.premiumCtaBtnText}>NADGRADI ZDAJ</Text>
                  <Ionicons name="arrow-forward" size={20} color="#000" />
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.premiumNote}>
                💚 Prekliči kadarkoli • Brez skritih stroškov • 100% varno
              </Text>
            </LinearGradient>
          </View>
        </View>
      </Modal>
      {/* Email verification prompt */}
      <Modal
        transparent
        visible={showEmailVerificationModal}
        animationType="fade"
        hardwareAccelerated
        onRequestClose={() => setShowEmailVerificationModal(false)}
      >
        <View style={styles.emailModalOverlay}>
          <View style={styles.emailModal}>
            <Text style={styles.emailModalTitle}>Potrdi e-pošto</Text>
            <Text style={styles.emailModalBody}>
              {emailVerificationPrompt ||
                `Preveri e-poštni naslov ${
                  profile?.email ?? "na svojem računu"
                } in potrdi povezavo.`}
            </Text>
            {emailVerificationError ? (
              <Text style={styles.emailModalError}>{emailVerificationError}</Text>
            ) : null}
            {emailVerificationMessage ? (
              <Text style={styles.emailModalSuccess}>{emailVerificationMessage}</Text>
            ) : null}
            <TouchableOpacity
              style={[
                styles.emailModalButton,
                emailVerificationSending && styles.emailModalButtonDisabled,
              ]}
              onPress={handleResendVerificationEmail}
              disabled={emailVerificationSending}
            >
              {emailVerificationSending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.emailModalButtonText}>POTRDI EMAIL</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.emailModalSecondary}
              onPress={() => setShowEmailVerificationModal(false)}
            >
              <Text style={styles.emailModalSecondaryText}>Zapri</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <Pressable
          style={styles.imagePreviewOverlay}
          onPress={() => setPreviewImage(null)}
        >
          <View style={styles.imagePreviewContainer}>
            {previewImage && (
              <>
                <Image
                  source={{ uri: previewImage.url }}
                  style={styles.imagePreviewImage}
                  resizeMode="contain"
                />
                <Text style={styles.imagePreviewName} numberOfLines={2}>
                  {previewImage.name}
                </Text>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.imagePreviewClose}
            onPress={() => setPreviewImage(null)}
          >
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
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
  header: {
    alignItems: "center",
    marginBottom: 8,
    marginTop: 0,
  },
  logo: {
    width: 80,
    height: 120,
    marginBottom: 2,
  },
  searchingHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  searchingHintText: {
    color: "#fcd34d",
    fontSize: 15,
    fontWeight: "600",
  },
  loadingIndicatorContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  loadingIndicatorText: {
    color: "#a78bfa",
    fontSize: 15,
    fontWeight: "600",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -1,
    textShadowColor: "rgba(139, 92, 246, 0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#c4b5fd",
    marginTop: 1,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  searchContainer: {
    borderRadius: 20,
    overflow: "hidden",
  },
  searchBlur: {
    borderRadius: 20,
    overflow: "hidden",
  },
  searchGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(139, 92, 246, 0.4)",
    ...createShadow("#8b5cf6", 0, 2, 0.2, 8, 4),
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  clearButton: {
    padding: 4,
  },
  searchBlocker: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  searchLimitContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  searchLimitBar: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    borderRadius: 2,
    marginRight: 12,
    overflow: "hidden",
  },
  searchLimitFill: {
    height: "100%",
    backgroundColor: "#8b5cf6",
    borderRadius: 2,
  },
  searchLimitFillEmpty: {
    backgroundColor: "#ef4444",
    width: "100%",
  },
  searchLimitText: {
    fontSize: 13,
    color: "#d1d5db",
    fontWeight: "500",
  },
  searchLimitTextEmpty: {
    fontSize: 13,
    color: "#ef4444",
    fontWeight: "600",
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timerText: {
    fontSize: 12,
    color: "#fbbf24",
    fontWeight: "600",
  },
  swipeHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: 20,
    alignSelf: "center",
  },
  swipeHintText: {
    fontSize: 12,
    color: "#a78bfa",
    marginLeft: 8,
  },
  sortIndicator: {
    marginLeft: 8,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderRadius: 10,
    padding: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    marginBottom: 20,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
  },
  funFactCard: {
    marginTop: 24,
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  funFactGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  funFactIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  funFactContent: {
    flex: 1,
  },
  funFactTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10b981",
    marginBottom: 4,
  },
  funFactText: {
    fontSize: 13,
    color: "#9ca3af",
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: 16,
    width: "100%",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  statLabel: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    marginBottom: 4,
  },
  resultsContainer: {
    paddingBottom: 20,
  },
  resultsCount: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 16,
  },
  productCard: {
    marginBottom: 16,
    borderRadius: 24,
    overflow: "hidden",
  },
  cardGradient: {
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(139, 92, 246, 0.35)",
    ...createShadow("#8b5cf6", 0, 6, 0.35, 14, 8),
  },
  cardContent: {
    padding: 16,
  },
  productHeader: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  productInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    minWidth: 0,
    marginBottom: 12,
  },
  productImageContainer: {
    marginRight: 14,
  },
  productImageBg: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  productEmoji: {
    fontSize: 28,
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
    lineHeight: 20,
    flexShrink: 1,
  },
  productUnit: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 6,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 11,
    color: "#a78bfa",
  },
  priceSection: {
    alignItems: "flex-end",
    alignSelf: "flex-end",
  },
  lowestPriceContainer: {
    alignItems: "flex-end",
  },
  priceMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  lowestPriceLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  priceValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lowestPrice: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.2,
  },
  storeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    alignSelf: "flex-start",
  },
  storeEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  storeName: {
    fontSize: 10,
    color: "#a78bfa",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  storeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  storeChipName: {
    marginLeft: 8,
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  savingsBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(16, 185, 129, 0.14)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  savingsText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0ea35c",
    marginLeft: 6,
  },
  quickAddButton: {
    marginTop: 14,
    borderRadius: 14,
    overflow: "hidden",
  },
  quickAddButtonSuccess: {},
  quickAddButtonLocked: {
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  quickAddGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  quickAddText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginLeft: 8,
  },
  expandIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(139, 92, 246, 0.1)",
  },
  expandText: {
    fontSize: 13,
    color: "#a78bfa",
    marginRight: 4,
  },
  storeList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  storeListDivider: {
    height: 1,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    marginBottom: 12,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.08)",
  },
  storeRowMissing: {
    opacity: 0.65,
  },
  storeRowLowest: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  storeRowLast: {
    borderBottomWidth: 0,
  },
  storeInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  storeLogo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 2.5,
    position: "relative",
  },
  storeLogoText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    ...createTextShadow("rgba(0, 0, 0, 0.3)", 0, 1, 2),
  },
  storeRowName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  lowestBadge: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderRadius: 4,
  },
  lowestBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#10b981",
    letterSpacing: 0.5,
  },
  storeLogoSmall: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 2,
    position: "relative",
  },
  storeLogoSmallText: {
    fontSize: 12,
    fontWeight: "800",
  },
  patternDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.9,
  },
  brandRingSmall: {
    position: "absolute",
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 11,
    opacity: 0.9,
  },
  brandRingLarge: {
    position: "absolute",
    top: -1.5,
    left: -1.5,
    right: -1.5,
    bottom: -1.5,
    borderRadius: 16,
    opacity: 0.9,
  },
  cornerIcon: {
    position: "absolute",
    fontWeight: "900",
    opacity: 0.95,
  },
  storePriceSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceContainer: {
    alignItems: "flex-end",
    marginRight: 12,
  },
  originalPrice: {
    fontSize: 12,
    color: "#6b7280",
    textDecorationLine: "line-through",
  },
  storePrice: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  storePriceLowest: {
    color: "#10b981",
  },
  storePriceMissing: {
    color: "#94a3b8",
    fontWeight: "600",
  },
  saleBadge: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 4,
  },
  saleText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#ef4444",
    letterSpacing: 0.5,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    borderStyle: "dashed",
  },
  addButtonDisabled: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  addButtonSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  addButtonLocked: {
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  addButtonPressed: {
    transform: [{ scale: 0.9 }],
    backgroundColor: "rgba(139, 92, 246, 0.25)",
  },
  addButtonAdding: {
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    borderColor: "rgba(139, 92, 246, 0.4)",
  },
  addToCartButton: {
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 80,
  },
  addToCartButtonSuccess: {
    opacity: 1,
  },
  addToCartButtonLocked: {
    opacity: 0.7,
  },
  addToCartButtonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  addToCartGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  addToCartText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  premiumBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fbbf24",
  },
  premiumFab: {
    position: "absolute",
    left: 16,
    zIndex: 30,
    borderRadius: 16,
    overflow: "hidden",
    ...createShadow("#fbbf24", 0, 8, 0.5, 20, 12),
  },
  premiumFabButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  premiumFabGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  premiumFabGradientCompact: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  premiumFabText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 0.2,
  },
  premiumFabTextCompact: {
    fontSize: 12,
    letterSpacing: 0,
  },
  authFab: {
    position: "absolute",
    right: 16,
    zIndex: 30,
    borderRadius: 16,
    overflow: "hidden",
    ...createShadow("#7c3aed", 0, 8, 0.35, 18, 10),
  },
  authFabButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  authFabGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  authFabGradientCompact: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  authFabText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.1,
  },
  authFabTextCompact: {
    fontSize: 12,
    letterSpacing: 0,
  },
  cartToast: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 110,
    borderRadius: 18,
    overflow: "visible",
    zIndex: 100,
  },
  cartToastGlow: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 28,
    backgroundColor: "rgba(16, 185, 129, 0.25)",
  },
  cartToastGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: "rgba(16, 185, 129, 0.5)",
    borderRadius: 18,
    backgroundColor: "rgba(6, 78, 59, 0.95)",
    ...createShadow("#10b981", 0, 8, 0.4, 20, 10),
  },
  cartToastIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
  },
  cartToastIconGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cartToastContent: {
    flex: 1,
  },
  cartToastTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ecfdf5",
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  cartToastText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#a7f3d0",
  },
  cartToastBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  confettiParticle: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    left: "50%",
    top: "50%",
    marginLeft: -4,
    marginTop: -4,
  },
  errorToast: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 110,
    borderRadius: 18,
    overflow: "visible",
    zIndex: 100,
  },
  errorToastGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.5)",
    borderRadius: 18,
    backgroundColor: "rgba(127, 29, 29, 0.95)",
    ...createShadow("#ef4444", 0, 8, 0.4, 20, 10),
  },
  errorToastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#fef2f2",
    letterSpacing: 0.2,
  },
  cartPreview: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 20,
    overflow: "hidden",
    ...createShadow("#000", 0, 10, 0.4, 18, 12),
  },
  cartPreviewGradient: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  cartPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cartPreviewTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cartPreviewTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  cartPreviewCount: {
    fontSize: 12,
    color: "#a78bfa",
    fontWeight: "600",
  },
  cartPreviewList: {
    gap: 8,
    marginBottom: 14,
  },
  cartPreviewItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cartPreviewItemName: {
    flex: 1,
    fontSize: 13,
    color: "#e5e7eb",
    fontWeight: "600",
    marginRight: 10,
  },
  cartPreviewItemMeta: {
    fontSize: 12,
    color: "#9ca3af",
  },
  cartPreviewButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  cartPreviewButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  cartPreviewButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emailModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emailModal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#0a0b1e",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.4)",
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  emailModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  emailModalBody: {
    fontSize: 14,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 20,
  },
  emailModalError: {
    fontSize: 13,
    color: "#fca5a5",
    textAlign: "center",
    marginTop: 4,
  },
  emailModalSuccess: {
    fontSize: 13,
    color: "#6ee7b7",
    textAlign: "center",
    marginTop: 4,
  },
  emailModalButton: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
    backgroundColor: "#8b5cf6",
  },
  emailModalButtonDisabled: {
    opacity: 0.7,
  },
  emailModalButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 14,
    letterSpacing: 0.8,
  },
  emailModalSecondary: {
    marginTop: 8,
  },
  emailModalSecondaryText: {
    color: "#a78bfa",
    fontSize: 14,
    fontWeight: "600",
  },
  // Scanner Modal
  scannerModal: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    overflow: "hidden",
  },
  scannerModalGradient: {
    padding: 24,
  },
  scannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  scannerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scannerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
  },
  scannerCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  imagePreviewContainer: {
    width: "100%",
    height: 220,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
    position: "relative",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanLineAnimated: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#fbbf24",
    ...createShadow("#fbbf24", 0, 0, 1, 10, 5),
  },
  analyzingContent: {
    alignItems: "center",
    gap: 12,
  },
  analyzingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  scanResultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  scanResultLabel: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 12,
  },
  scanResultText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  scannerPlaceholder: {
    alignItems: "center",
    paddingVertical: 40,
  },
  scannerIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "rgba(139, 92, 246, 0.3)",
    borderStyle: "dashed",
  },
  scannerPlaceholderText: {
    color: "#9ca3af",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 24,
  },
  scannerActions: {
    gap: 12,
  },
  scannerActionBtn: {
    borderRadius: 16,
    overflow: "hidden",
  },
  scannerActionGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
    borderRadius: 16,
  },
  scannerActionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  scannerActionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    backgroundColor: "rgba(139, 92, 246, 0.1)",
  },
  scannerActionTextSecondary: {
    fontSize: 15,
    fontWeight: "600",
    color: "#a78bfa",
  },
  analyzingInfo: {
    alignItems: "center",
    paddingVertical: 16,
  },
  analyzingInfoText: {
    color: "#fbbf24",
    fontSize: 16,
    fontWeight: "600",
  },
  // Premium Modal
  premiumModal: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    overflow: "hidden",
  },
  premiumModalGradient: {
    padding: 28,
    alignItems: "center",
  },
  premiumCloseBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  premiumIconContainer: {
    marginBottom: 20,
    marginTop: 10,
  },
  premiumIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    ...createShadow("#fbbf24", 0, 8, 0.6, 20, 15),
  },
  premiumModalTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  premiumModalSubtitle: {
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalTimerContainer: {
    width: "100%",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "rgba(239, 68, 68, 0.3)",
    alignItems: "center",
  },
  timerKicker: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ef4444",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  timerExplanation: {
    fontSize: 14,
    fontWeight: "500",
    color: "#d1d5db",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 16,
  },
  timerDisplay: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  timerValue: {
    fontSize: 56,
    fontWeight: "900",
    color: "#ef4444",
    fontFamily: "monospace",
    letterSpacing: 3,
    textAlign: "center",
  },
  timerHint: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
  },
  premiumFeatures: {
    width: "100%",
    gap: 12,
    marginBottom: 24,
  },
  premiumFeatureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  premiumFeatureText: {
    color: "#d1d5db",
    fontSize: 15,
    fontWeight: "500",
  },
  premiumPriceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 24,
    gap: 4,
  },
  premiumPriceLabel: {
    color: "#9ca3af",
    fontSize: 16,
  },
  premiumPrice: {
    color: "#fbbf24",
    fontSize: 36,
    fontWeight: "900",
  },
  premiumPricePeriod: {
    color: "#9ca3af",
    fontSize: 16,
  },
  premiumCtaBtn: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    ...createShadow("#fbbf24", 0, 8, 0.5, 16, 12),
  },
  premiumCtaBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
    borderRadius: 16,
  },
  premiumCtaBtnText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
  },
  premiumNote: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 16,
    textAlign: "center",
  },
  // Search Row
  stickyHeader: {
    backgroundColor: "rgba(15, 10, 30, 0.96)",
    paddingHorizontal: 20,
    paddingBottom: 8,
    marginHorizontal: -20,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.12)",
  },
  guestBanner: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.28)",
    ...createShadow("#8b5cf6", 0, 6, 0.25, 12, 8),
  },
  guestBannerCompact: {
    padding: 10,
    borderRadius: 14,
  },
  guestBannerRow: {
    gap: 6,
  },
  guestBannerBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(139, 92, 246, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.4)",
  },
  guestBannerBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#c4b5fd",
    letterSpacing: 0.6,
  },
  guestBannerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  guestBannerTitleCompact: {
    fontSize: 13,
  },
  guestBannerText: {
    fontSize: 12,
    color: "#cbd5e1",
    lineHeight: 18,
  },
  guestBannerTextCompact: {
    fontSize: 10,
    lineHeight: 14,
  },
  guestBannerCta: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  guestBannerCtaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  guestBannerCtaGradientCompact: {
    paddingVertical: 8,
    gap: 6,
  },
  guestBannerCtaText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  guestBannerCtaTextCompact: {
    fontSize: 11,
  },
  statusBanner: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    ...createShadow("#10b981", 0, 4, 0.2, 10, 6),
  },
  statusTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusSeasonPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  statusSeasonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#a7f3d0",
    letterSpacing: 0.3,
  },
  statusDeadlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  statusDeadlineText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fde68a",
  },
  statusMainRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  statusSavingsBlock: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#cbd5e1",
  },
  statusValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  statusSubtext: {
    marginTop: 4,
    fontSize: 11,
    color: "rgba(226, 232, 240, 0.7)",
  },
  statusRankBlock: {
    alignItems: "flex-end",
  },
  statusRankLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
  },
  statusRankValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fbbf24",
  },
  statusRankBadge: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.35)",
  },
  statusRankBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fde68a",
    letterSpacing: 0.5,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  cameraButton: {
    borderRadius: 20,
    overflow: "hidden",
  },
  cameraButtonGradient: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...createShadow("#fbbf24", 0, 4, 0.4, 12, 8),
  },
  // Guest Mode Styles
  guestLimitCard: {
    marginTop: 16,
    borderRadius: 20,
    overflow: "hidden",
    ...createShadow("#8b5cf6", 0, 4, 0.3, 12, 6),
  },
  guestLimitGradient: {
    padding: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: "rgba(139, 92, 246, 0.3)",
    borderRadius: 20,
  },
  guestLimitTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#8b5cf6",
    marginTop: 8,
  },
  guestLimitText: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
  },
  guestLimitButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  guestLimitButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  guestLimitInfo: {
    width: "100%",
    gap: 12,
    marginBottom: 16,
  },
  guestCooldownBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  guestCooldownText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#fbbf24",
  },
  guestLimitDescription: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
  },
  guestLoginLink: {
    marginTop: 12,
    paddingVertical: 8,
  },
  guestLoginLinkText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  guestLoginLinkBold: {
    fontWeight: "700",
    color: "#fff",
  },
  // Guest Modal - Polished Styles
  guestTimerBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 24,
    alignItems: "center",
  },
  guestTimerLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 6,
  },
  guestTimerValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fbbf24",
    letterSpacing: 1,
  },
  guestOptionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    width: "100%",
  },
  guestOptionsContainerSingle: {
    flexDirection: "column",
  },
  guestOptionCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  guestOptionCardFull: {
    width: "100%",
  },
  guestOptionCardPremium: {
    borderColor: "rgba(251, 191, 36, 0.4)",
    backgroundColor: "rgba(251, 191, 36, 0.08)",
  },
  guestOptionBadge: {
    backgroundColor: "rgba(139, 92, 246, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  guestOptionBadgePremium: {
    backgroundColor: "rgba(251, 191, 36, 0.3)",
  },
  guestOptionBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#a78bfa",
    letterSpacing: 0.5,
  },
  guestOptionBadgeTextPremium: {
    color: "#fbbf24",
  },
  guestOptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  guestOptionDesc: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 8,
  },
  guestOptionPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fbbf24",
    marginBottom: 8,
  },
  guestOptionBtn: {
    width: "100%",
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 4,
  },
  guestOptionBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  guestOptionBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
  },
  guestWaitBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  guestWaitBtnText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center",
  },
  // Image Preview Modal
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePreviewContainer: {
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
  },
  imagePreviewImage: {
    width: "100%",
    height: 350,
    borderRadius: 16,
    backgroundColor: "#1a1a2e",
  },
  imagePreviewName: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  imagePreviewClose: {
    position: "absolute",
    top: 60,
    right: 20,
  },
});








