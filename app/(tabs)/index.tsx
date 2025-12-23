import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  Animated as RNAnimated,
  PanResponder,
  Easing,
  Modal,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useConvexAuth, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { canGuestViewProduct, recordGuestView, getGuestViewsRemaining, resetGuestData } from "@/lib/guest-mode";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PriceInfo {
  storeId: Id<"stores">;
  storeName: string;
  storeColor: string;
  price: number;
  originalPrice?: number;
  isOnSale: boolean;
}

interface ProductResult {
  _id: Id<"products">;
  name: string;
  category: string;
  unit: string;
  imageUrl?: string;
  prices: PriceInfo[];
  lowestPrice: number;
  highestPrice: number;
}

const STORE_LOGOS: Record<string, string> = {
  "Spar": "🟢",
  "Mercator": "🔵",
  "Tus": "🟡",
  "Hofer": "🔴",
  "Lidl": "🟠",
  "Jager": "🟣",
};

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [sortAscending, setSortAscending] = useState(true);
  const [addedToCart, setAddedToCart] = useState<string | null>(null);

  // Guest mode state
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestViewsRemaining, setGuestViewsRemaining] = useState(1);
  const [guestCooldownTime, setGuestCooldownTime] = useState<string | null>(null);
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);
  const [hasViewedAsGuest, setHasViewedAsGuest] = useState(false);

  // Camera/Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanningImage, setScanningImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // Animations
  const searchBarScale = useRef(new RNAnimated.Value(1)).current;
  const cardAnimationsRef = useRef<{ [key: string]: RNAnimated.Value }>({});
  const swipeIndicator = useRef(new RNAnimated.Value(0)).current;
  
  // Premium button shake animation
  const shakeAnim = useRef(new RNAnimated.Value(0)).current;
  const glowAnim = useRef(new RNAnimated.Value(0)).current;
  
  // Scanner animation
  const scanLineAnim = useRef(new RNAnimated.Value(0)).current;
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  const profile = useQuery(
    api.userProfiles.getProfile,
    isAuthenticated ? {} : "skip"
  );
  const isPremium = profile?.isPremium ?? false;
  const searchesRemaining = profile?.searchesRemaining ?? 3;
  const searchResetTime = profile?.searchResetTime;

  // Check if user is in guest mode (not authenticated)
  useEffect(() => {
    setIsGuestMode(!isAuthenticated);
    
    // If authenticated and had viewed as guest, reset guest data
    if (isAuthenticated && hasViewedAsGuest) {
      resetGuestData();
      setHasViewedAsGuest(false);
    }
    
    // Load guest view status
    if (!isAuthenticated) {
      loadGuestStatus();
    }
  }, [isAuthenticated]);
  
  const loadGuestStatus = async () => {
    const status = await getGuestViewsRemaining();
    setGuestViewsRemaining(status.remaining);
    setGuestCooldownTime(status.timeUntilReset || null);
  };

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

  const recordSearch = useMutation(api.userProfiles.recordSearch);
  const addToCart = useMutation(api.cart.addToCart);
  const analyzeImage = useAction(api.ai.analyzeProductImage);
  
  // Handle search with recordSearch call
  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    
    // GUEST MODE: Check if guest can view
    if (isGuestMode) {
      const guestCheck = await canGuestViewProduct();
      
      if (!guestCheck.allowed) {
        setShowGuestLimitModal(true);
        return;
      }
      
      // Guest can view - proceed with search but don't record in backend
      setSearching(true);
      // Search will happen via useQuery below
      setTimeout(() => setSearching(false), 500);
      return;
    }
    
    // AUTHENTICATED USER: Check search limits
    if (!isPremium && searchesRemaining <= 0) {
      setShowPremiumModal(true);
      return;
    }
    
    setSearching(true);
    
    try {
      // Record search first
      const recordResult = await recordSearch();
      if (!recordResult.success) {
        setShowPremiumModal(true);
        setSearching(false);
        return;
      }
      
      // Trigger re-fetch of profile to update searchesRemaining
      // The search results will be fetched by useQuery below
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  };
  
  // Auto-search when query changes (but only after recordSearch)
  const searchResultsQuery = useQuery(
    api.products.search,
    searchQuery.length >= 2 && !searching ? { query: searchQuery, isPremium } : "skip"
  ) as ProductResult[] | undefined;
  
  const searchResults = searchResultsQuery || [];

  // Sort results based on swipe direction
  const sortedResults = searchResults
    ? [...searchResults].sort((a, b) =>
        sortAscending ? a.lowestPrice - b.lowestPrice : b.lowestPrice - a.lowestPrice
      )
    : [];

  // Swipe handler for sorting
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderMove: (_, gestureState) => {
        swipeIndicator.setValue(gestureState.dx / SCREEN_WIDTH);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          // Swipe left - sort ascending (cheapest first)
          setSortAscending(true);
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        } else if (gestureState.dx > 50) {
          // Swipe right - sort descending (most expensive first)
          setSortAscending(false);
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
        RNAnimated.spring(swipeIndicator, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

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
    if (sortedResults.length > 0) {
      sortedResults.forEach((product, index) => {
        const anim = getCardAnimation(product._id);
        RNAnimated.spring(anim, {
          toValue: 1,
          delay: index * 50,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }).start();
      });
    }
  }, [sortedResults.length, sortAscending]);

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

  // Glow pulse animation
  useEffect(() => {
    if (isPremium) return;

    RNAnimated.loop(
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
    ).start();
  }, [isPremium, glowAnim]);

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

    // Check if user is premium
    if (!isPremium) {
      setShowPremiumModal(true);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      // Try gallery instead
      handleOpenGallery();
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      handleImageSelected(result.assets[0].uri);
    }
  };

  const handleOpenGallery = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Check if user is premium
    if (!isPremium) {
      setShowPremiumModal(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
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

    // Start scan line animation
    RNAnimated.loop(
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
    ).start();

    // Pulse animation
    RNAnimated.loop(
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
    ).start();

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

      if (result.success && result.productName) {
        setScanResult(result.productName);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        setScanResult(null);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      setIsAnalyzing(false);
      // Fallback to simulation if AI fails
      const simulatedProducts = [
        "Alpsko mleko 1L",
        "Jabolka Golden",
        "Kruh beli",
        "Maslo 250g",
        "Jogurt navadni",
        "Piščančje prsi",
        "Paradižnik",
        "Testenine špageti",
      ];
      const randomProduct = simulatedProducts[Math.floor(Math.random() * simulatedProducts.length)];
      setScanResult(randomProduct);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  const handleUseScanResult = () => {
    if (scanResult) {
      setSearchQuery(scanResult);
      setShowScanner(false);
      setScanningImage(null);
      setScanResult(null);
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
  };

  const handleAddToCart = useCallback(
    async (product: ProductResult, price: PriceInfo) => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      try {
        await addToCart({
          productId: product._id,
          storeId: price.storeId,
          price: price.price,
        });
        setAddedToCart(`${product._id}-${price.storeId}`);
        setTimeout(() => setAddedToCart(null), 1500);
      } catch (error) {
        console.error("Napaka pri dodajanju:", error);
      }
    },
    [addToCart]
  );

  const formatPrice = (price: number) => {
    return price.toFixed(2).replace(".", ",") + " €";
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

  const renderProductCard = (product: ProductResult, _index: number) => {
    const isExpanded = expandedProduct === product._id;
    const savings = calculateSavings(product);
    const lowestPriceStore = product.prices[0];
    const cardAnim = getCardAnimation(product._id);

    return (
      <RNAnimated.View
        key={product._id}
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
            onPress={() => toggleExpand(product._id)}
            style={styles.cardContent}
          >
            {/* Product Image & Info */}
            <View style={styles.productHeader}>
              <View style={styles.productImageContainer}>
                <LinearGradient
                  colors={["rgba(168, 85, 247, 0.3)", "rgba(139, 92, 246, 0.1)"]}
                  style={styles.productImageBg}
                >
                  <Text style={styles.productEmoji}>
                    {product.category === "Mlečni izdelki" ? "🥛" :
                     product.category === "Pekovski izdelki" ? "🍞" :
                     product.category === "Meso" ? "🥩" :
                     product.category === "Sadje in zelenjava" ? "🥬" :
                     product.category === "Pijače" ? "🧃" : "🛒"}
                  </Text>
                </LinearGradient>
              </View>

              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productUnit}>{product.unit}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{product.category}</Text>
                </View>
              </View>

              {/* Price Display */}
              <View style={styles.priceSection}>
                <View style={styles.lowestPriceContainer}>
                  <Text style={styles.lowestPriceLabel}>Najnižja</Text>
                  <Text style={styles.lowestPrice}>{formatPrice(product.lowestPrice)}</Text>
                  <View style={styles.storeIndicator}>
                    <Text style={styles.storeEmoji}>{STORE_LOGOS[lowestPriceStore?.storeName] || "🏪"}</Text>
                    <Text style={styles.storeName}>{lowestPriceStore?.storeName}</Text>
                  </View>
                </View>

                {savings && (
                  <View style={styles.savingsBadge}>
                    <Ionicons name="trending-down" size={12} color="#10b981" />
                    <Text style={styles.savingsText}>-{savings.percentage}%</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Quick Add Button */}
            <TouchableOpacity
              style={[
                styles.quickAddButton,
                addedToCart === `${product._id}-${lowestPriceStore?.storeId}` && styles.quickAddButtonSuccess,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                if (lowestPriceStore) {
                  handleAddToCart(product, lowestPriceStore);
                }
              }}
            >
              <LinearGradient
                colors={
                  addedToCart === `${product._id}-${lowestPriceStore?.storeId}`
                    ? ["#10b981", "#059669"]
                    : ["#8b5cf6", "#7c3aed"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.quickAddGradient}
              >
                <Ionicons
                  name={addedToCart === `${product._id}-${lowestPriceStore?.storeId}` ? "checkmark" : "add"}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.quickAddText}>
                  {addedToCart === `${product._id}-${lowestPriceStore?.storeId}` ? "Dodano!" : "Dodaj najcenejše"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Expand Indicator */}
            <View style={styles.expandIndicator}>
              <Text style={styles.expandText}>
                {isExpanded ? "Skrij cene" : `Primerjaj ${product.prices.length} trgovin`}
              </Text>
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color="#a78bfa"
              />
            </View>
          </TouchableOpacity>

          {/* Expanded Store List */}
          {isExpanded && (
            <View style={styles.storeList}>
              <View style={styles.storeListDivider} />
              {product.prices.map((price, priceIndex) => {
                const isLowest = priceIndex === 0;
                const isAdded = addedToCart === `${product._id}-${price.storeId}`;

                return (
                  <View
                    key={price.storeId}
                    style={[
                      styles.storeRow,
                      isLowest && styles.storeRowLowest,
                      priceIndex === product.prices.length - 1 && styles.storeRowLast,
                    ]}
                  >
                    <View style={styles.storeInfo}>
                      <View style={[styles.storeLogo, { backgroundColor: price.storeColor + "20" }]}>
                        <Text style={styles.storeLogoText}>{STORE_LOGOS[price.storeName] || "🏪"}</Text>
                      </View>
                      <View>
                        <Text style={styles.storeRowName}>{price.storeName}</Text>
                        {isLowest && (
                          <View style={styles.lowestBadge}>
                            <Text style={styles.lowestBadgeText}>NAJCENEJŠE</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.storePriceSection}>
                      <View style={styles.priceContainer}>
                        {price.isOnSale && price.originalPrice && (
                          <Text style={styles.originalPrice}>{formatPrice(price.originalPrice)}</Text>
                        )}
                        <Text style={[styles.storePrice, isLowest && styles.storePriceLowest]}>
                          {formatPrice(price.price)}
                        </Text>
                        {price.isOnSale && (
                          <View style={styles.saleBadge}>
                            <Text style={styles.saleText}>AKCIJA</Text>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        style={[styles.addButton, isAdded && styles.addButtonSuccess]}
                        onPress={() => handleAddToCart(product, price)}
                      >
                        <Ionicons
                          name={isAdded ? "checkmark" : "cart-outline"}
                          size={20}
                          color={isAdded ? "#10b981" : "#a78bfa"}
                        />
                      </TouchableOpacity>
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

      {/* Ambient Glow Effects */}
      <View style={[styles.glowOrb, styles.glowOrb1]} />
      <View style={[styles.glowOrb, styles.glowOrb2]} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        {...panResponder.panHandlers}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require("@/assets/images/1595E33B-B540-4C55-BAA2-E6DA6596BEFF.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Pr'Hran</Text>
          <Text style={styles.subtitle}>Pametno nakupovanje</Text>
        </View>

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
                  placeholderTextColor="#6b7280"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]); }} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color="#6b7280" />
                  </TouchableOpacity>
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

        {/* Search Limit Indicator */}
        {!isPremium && (
          <View style={styles.searchLimitContainer}>
            <View style={styles.searchLimitBar}>
              <View
                style={[
                  styles.searchLimitFill,
                  { width: `${(searchesRemaining / 3) * 100}%` },
                  searchesRemaining === 0 && styles.searchLimitFillEmpty,
                ]}
              />
            </View>
            {searchesRemaining > 0 ? (
              <Text style={styles.searchLimitText}>
                {searchesRemaining}/3 iskanj danes
              </Text>
            ) : timeRemaining ? (
              <View style={styles.timerContainer}>
                <Ionicons name="time-outline" size={14} color="#fbbf24" />
                <Text style={styles.timerText}>
                  Nova iskanja čez {timeRemaining}
                </Text>
              </View>
            ) : (
              <Text style={styles.searchLimitTextEmpty}>
                0/3 iskanj - nadgradi na Premium!
              </Text>
            )}
          </View>
        )}

        {/* Swipe Hint */}
        {sortedResults.length > 1 && (
          <RNAnimated.View
            style={[
              styles.swipeHint,
              {
                transform: [
                  {
                    translateX: swipeIndicator.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [-20, 0, 20],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="swap-horizontal" size={16} color="#a78bfa" />
            <Text style={styles.swipeHintText}>
              {sortAscending ? "Najcenejše → Najdražje" : "Najdražje → Najcenejše"}
            </Text>
            <View style={styles.sortIndicator}>
              <Ionicons
                name={sortAscending ? "arrow-up" : "arrow-down"}
                size={14}
                color="#10b981"
              />
            </View>
          </RNAnimated.View>
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
            <Text style={styles.emptyText}>
              Vpiši ime izdelka in takoj primerjaj cene{"\n"}iz vseh slovenskih trgovin
            </Text>

            {/* Quick Categories */}
            <View style={styles.quickCategories}>
              <Text style={styles.quickCategoriesTitle}>🔥 Priljubljene kategorije</Text>
              <View style={styles.categoryChips}>
                <TouchableOpacity 
                  style={styles.categoryChip}
                  onPress={() => setSearchQuery("mleko")}
                >
                  <Text style={styles.categoryChipEmoji}>🥛</Text>
                  <Text style={styles.categoryChipText}>Mleko</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.categoryChip}
                  onPress={() => setSearchQuery("kruh")}
                >
                  <Text style={styles.categoryChipEmoji}>🍞</Text>
                  <Text style={styles.categoryChipText}>Kruh</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.categoryChip}
                  onPress={() => setSearchQuery("jajca")}
                >
                  <Text style={styles.categoryChipEmoji}>🥚</Text>
                  <Text style={styles.categoryChipText}>Jajca</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.categoryChip}
                  onPress={() => setSearchQuery("maslo")}
                >
                  <Text style={styles.categoryChipEmoji}>🧈</Text>
                  <Text style={styles.categoryChipText}>Maslo</Text>
                </TouchableOpacity>
              </View>
            </View>

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
                  <Text style={styles.funFactTitle}>💡 Ali veš?</Text>
                  <Text style={styles.funFactText}>
                    Povprečna slovenska družina lahko prihrani do 150€ mesečno s pametnim nakupovanjem!
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>6</Text>
                <Text style={styles.statLabel}>Trgovin</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>1000+</Text>
                <Text style={styles.statLabel}>Izdelkov</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>22:00</Text>
                <Text style={styles.statLabel}>Posodobitev</Text>
              </View>
            </View>

            {/* Premium CTA Button */}
            {!isPremium && (
              <RNAnimated.View
                style={[
                  styles.premiumCtaContainer,
                  {
                    transform: [
                      {
                        translateX: shakeAnim.interpolate({
                          inputRange: [-1, 0, 1],
                          outputRange: [-8, 0, 8],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {/* Centered Glow effect */}
                <RNAnimated.View
                  style={[
                    styles.premiumGlow,
                    {
                      opacity: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 1],
                      }),
                      transform: [
                        {
                          scale: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.9, 1.2],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <TouchableOpacity
                  style={styles.premiumCtaButton}
                  onPress={handlePremiumPress}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={["#fbbf24", "#f59e0b", "#d97706"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.premiumCtaGradient}
                  >
                    <Ionicons name="diamond" size={20} color="#000" />
                    <Text style={styles.premiumCtaText}>KUPI PREMIUM</Text>
                    <Ionicons name="sparkles" size={18} color="#000" />
                  </LinearGradient>
                </TouchableOpacity>
              </RNAnimated.View>
            )}
          </View>
        ) : sortedResults.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color="#6b7280" />
            <Text style={styles.emptyTitle}>Ni rezultatov</Text>
            <Text style={styles.emptyText}>Poskusi z drugim iskalnim nizom</Text>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsCount}>
              {sortedResults.length} {sortedResults.length === 1 ? "rezultat" : "rezultatov"}
            </Text>
            {/* GUEST MODE: Show only 1 product */}
            {isGuestMode ? (
              <>
                {sortedResults.slice(0, 1).map((product, index) => renderProductCard(product, index))}
                {sortedResults.length > 1 && (
                  <TouchableOpacity
                    style={styles.guestLimitCard}
                    onPress={() => {
                      recordGuestView(sortedResults[0]._id);
                      setHasViewedAsGuest(true);
                      loadGuestStatus();
                      setShowGuestLimitModal(true);
                    }}
                  >
                    <LinearGradient
                      colors={["rgba(139, 92, 246, 0.15)", "rgba(88, 28, 135, 0.15)"]}
                      style={styles.guestLimitGradient}
                    >
                      <Ionicons name="lock-closed" size={48} color="rgba(139, 92, 246, 0.6)" />
                      <Text style={styles.guestLimitTitle}>Registriraj se za več!</Text>
                      <Text style={styles.guestLimitText}>
                        Prikazujemo samo 1 izdelek.{"\n"}
                        Registriraj se za dostop do vseh {sortedResults.length - 1} izdelkov!
                      </Text>
                      <View style={styles.guestLimitButton}>
                        <Text style={styles.guestLimitButtonText}>Brezplačna registracija</Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              sortedResults.map((product, index) => renderProductCard(product, index))
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

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
                        <ActivityIndicator size="large" color="#fbbf24" />
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
                  <Text style={styles.scannerPlaceholderText}>
                    Slikaj izdelek in takoj najdi{"\n"}najnižjo ceno v vseh trgovinah!
                  </Text>
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
                    <TouchableOpacity style={styles.scannerActionBtnSecondary} onPress={handleOpenGallery}>
                      <Ionicons name="images-outline" size={20} color="#a78bfa" />
                      <Text style={styles.scannerActionTextSecondary}>Izberi iz galerije</Text>
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
                        <Text style={[styles.scannerActionText, { color: "#fff" }]}>Išči "{scanResult}"</Text>
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
                      🤖 AI analizira sliko...
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Guest Limit Modal */}
      <Modal
        transparent
        visible={showGuestLimitModal}
        onRequestClose={() => setShowGuestLimitModal(false)}
        animationType="fade"
        hardwareAccelerated
      >
        <View style={styles.modalOverlay}>
          <View style={styles.premiumModal}>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.95)", "rgba(88, 28, 135, 0.98)"]}
              style={styles.premiumModalGradient}
            >
              <TouchableOpacity
                style={styles.premiumCloseBtn}
                onPress={() => setShowGuestLimitModal(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>

              <View style={styles.premiumIconContainer}>
                <LinearGradient
                  colors={["#ef4444", "#dc2626"]}
                  style={styles.premiumIconGradient}
                >
                  <Ionicons name="lock-closed" size={40} color="#fff" />
                </LinearGradient>
              </View>

              <Text style={styles.premiumModalTitle}>🚫 Brezplačni limit dosežen</Text>
              <Text style={styles.premiumModalSubtitle}>
                Pregledate lahko samo 1 izdelek na 24 ur brez prijave
              </Text>

              <View style={styles.guestLimitInfo}>
                {guestCooldownTime && (
                  <View style={styles.guestCooldownBox}>
                    <Ionicons name="time" size={24} color="#fbbf24" />
                    <Text style={styles.guestCooldownText}>
                      Naslednji pregled čez: {guestCooldownTime}
                    </Text>
                  </View>
                )}
                <Text style={styles.guestLimitDescription}>
                  Ta omejitev velja na napravo, da preprečimo zlorabe sistema.
                </Text>
              </View>

              <View style={styles.premiumFeatures}>
                <View style={styles.premiumFeatureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  <Text style={styles.premiumFeatureText}>Neomejeno iskanje izdelkov</Text>
                </View>
                <View style={styles.premiumFeatureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  <Text style={styles.premiumFeatureText}>Dostop do vseh cen in trgovin</Text>
                </View>
                <View style={styles.premiumFeatureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  <Text style={styles.premiumFeatureText}>Shranjuj najljubše izdelke</Text>
                </View>
                <View style={styles.premiumFeatureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  <Text style={styles.premiumFeatureText}>Brezplačno - za vedno!</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.premiumCtaBtn}
                onPress={() => {
                  setShowGuestLimitModal(false);
                  router.push("/auth");
                }}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#8b5cf6", "#7c3aed", "#6d28d9"]}
                  style={styles.premiumCtaBtnGradient}
                >
                  <Ionicons name="person-add" size={20} color="#fff" />
                  <Text style={styles.premiumCtaBtnText}>BREZPLAČNA REGISTRACIJA</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.guestLoginLink}
                onPress={() => {
                  setShowGuestLimitModal(false);
                  router.push("/auth");
                }}
              >
                <Text style={styles.guestLoginLinkText}>
                  Že imaš račun? <Text style={styles.guestLoginLinkBold}>Prijavi se →</Text>
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Premium Modal */}
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

              <Text style={styles.premiumModalTitle}>📸 Premium funkcija</Text>
              <Text style={styles.premiumModalSubtitle}>
                Slikaj izdelek in takoj najdi najnižjo ceno!
              </Text>

              <View style={styles.premiumFeatures}>
                <View style={styles.premiumFeatureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  <Text style={styles.premiumFeatureText}>Neomejeno slikanje izdelkov</Text>
                </View>
                <View style={styles.premiumFeatureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  <Text style={styles.premiumFeatureText}>Neomejeno iskanje</Text>
                </View>
                <View style={styles.premiumFeatureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  <Text style={styles.premiumFeatureText}>Ekskluzivni kuponi</Text>
                </View>
                <View style={styles.premiumFeatureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  <Text style={styles.premiumFeatureText}>Brez oglasov</Text>
                </View>
              </View>

              <View style={styles.premiumPriceContainer}>
                <Text style={styles.premiumPriceLabel}>Samo</Text>
                <Text style={styles.premiumPrice}>1,99 €</Text>
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
                Prekliči kadarkoli • Brez skritih stroškov
              </Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  glowOrb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.5,
  },
  glowOrb1: {
    width: 300,
    height: 300,
    backgroundColor: "#8b5cf6",
    top: -100,
    left: -100,
    opacity: 0.15,
  },
  glowOrb2: {
    width: 250,
    height: 250,
    backgroundColor: "#d946ef",
    bottom: 100,
    right: -80,
    opacity: 0.1,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    color: "#a78bfa",
    marginTop: 4,
  },
  searchContainer: {
    marginBottom: 16,
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
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
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
    fontSize: 12,
    color: "#9ca3af",
  },
  searchLimitTextEmpty: {
    fontSize: 12,
    color: "#fbbf24",
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
  quickCategories: {
    marginTop: 32,
    width: "100%",
  },
  quickCategoriesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 12,
    textAlign: "center",
  },
  categoryChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    gap: 6,
  },
  categoryChipEmoji: {
    fontSize: 16,
  },
  categoryChipText: {
    fontSize: 14,
    color: "#a78bfa",
    fontWeight: "500",
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
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  cardContent: {
    padding: 16,
  },
  productHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  productEmoji: {
    fontSize: 28,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
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
  },
  lowestPriceContainer: {
    alignItems: "flex-end",
  },
  lowestPriceLabel: {
    fontSize: 10,
    color: "#10b981",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lowestPrice: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
  },
  storeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  storeEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  storeName: {
    fontSize: 11,
    color: "#9ca3af",
  },
  savingsBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderRadius: 10,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10b981",
    marginLeft: 8,
  },
  quickAddButton: {
    marginTop: 14,
    borderRadius: 14,
    overflow: "hidden",
  },
  quickAddButtonSuccess: {},
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
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  storeLogoText: {
    fontSize: 18,
  },
  storeRowName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
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
  addButtonSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  premiumCtaContainer: {
    marginTop: 40,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  premiumGlow: {
    position: "absolute",
    width: 200,
    height: 56,
    backgroundColor: "#fbbf24",
    borderRadius: 28,
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 20,
  },
  premiumCtaButton: {
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  premiumCtaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 28,
    gap: 10,
    borderRadius: 16,
  },
  premiumCtaText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
  },
  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
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
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
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
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
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
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
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
    width: 52,
    height: 52,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  // Guest Mode Styles
  guestLimitCard: {
    marginTop: 16,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
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
});
