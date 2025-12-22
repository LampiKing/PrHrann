import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "react-native";
import { useRouter } from "expo-router";

interface CartItemType {
  _id: Id<"cartItems">;
  productId: Id<"products">;
  productName: string;
  productUnit: string;
  storeId: Id<"stores">;
  storeName: string;
  storeColor: string;
  quantity: number;
  priceAtAdd: number;
  currentPrice: number;
}

interface StoreGroup {
  storeId: Id<"stores">;
  storeName: string;
  storeColor: string;
  items: CartItemType[];
  subtotal: number;
}

const STORE_LOGOS: Record<string, string> = {
  "Spar": "🟢",
  "Mercator": "🔵",
  "Tus": "🟡",
  "Hofer": "🔴",
  "Lidl": "🟠",
  "Jager": "🟣",
};

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [error, setError] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const cart = useQuery(
    api.cart.getCart,
    isAuthenticated ? {} : "skip"
  );
  const profile = useQuery(
    api.userProfiles.getProfile,
    isAuthenticated ? {} : "skip"
  );
  const updateQuantity = useMutation(api.cart.updateQuantity);
  const removeFromCart = useMutation(api.cart.removeFromCart);
  const clearCart = useMutation(api.cart.clearCart);

  const isPremium = profile?.isPremium ?? false;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
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

  const formatPrice = (price: number) => {
    return price.toFixed(2).replace(".", ",") + " €";
  };

  const handleQuantityChange = async (itemId: Id<"cartItems">, currentQuantity: number, delta: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const newQuantity = currentQuantity + delta;
      await updateQuantity({ cartItemId: itemId, quantity: newQuantity });
    } catch (error) {
      console.error("Napaka:", error);
    }
  };

  const handleRemove = async (itemId: Id<"cartItems">) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    try {
      await removeFromCart({ cartItemId: itemId });
    } catch (error) {
      console.error("Napaka:", error);
    }
  };

  const handleClearCart = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    try {
      await clearCart({});
    } catch (error) {
      console.error("Napaka:", error);
    }
  };

  const handleShare = async () => {
    if (!cart || cart.items.length === 0) return;

    let message = "🛒 Moj nakupovalni seznam (Pr'Hran)\n\n";
    
    cart.groupedByStore.forEach((group: StoreGroup) => {
      message += `📍 ${group.storeName}\n`;
      group.items.forEach((item: CartItemType) => {
        message += `  • ${item.productName} (${item.quantity}x) - ${formatPrice(item.currentPrice * item.quantity)}\n`;
      });
      message += `  Skupaj: ${formatPrice(group.subtotal)}\n\n`;
    });

    message += `💰 SKUPAJ: ${formatPrice(cart.total)}`;

    try {
      await Share.share({ message });
    } catch (error) {
      console.error("Napaka pri deljenju:", error);
    }
  };

  // Calculate potential savings
  const calculatePotentialSavings = () => {
    if (!cart || cart.groupedByStore.length <= 1) return null;
    
    const totals = cart.groupedByStore.map((g: StoreGroup) => g.subtotal);
    const min = Math.min(...totals);
    const max = Math.max(...totals);
    const savings = max - min;
    
    if (savings < 0.1) return null;
    
    const cheapestStore = cart.groupedByStore.find((g: StoreGroup) => g.subtotal === min);
    return {
      amount: savings,
      percentage: Math.round((savings / max) * 100),
      cheapestStore: cheapestStore?.storeName || "",
    };
  };

  const potentialSavings = calculatePotentialSavings();

  if (!cart) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Nalagam...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
      
      {/* Ambient Glow */}
      <View style={[styles.glowOrb, styles.glowOrb1]} />
      <View style={[styles.glowOrb, styles.glowOrb2]} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Image
            source={require("@/assets/images/1595E33B-B540-4C55-BAA2-E6DA6596BEFF.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>
            {isPremium ? "Premium košarica" : "Tvoja košarica"}
          </Text>
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={12} color="#fbbf24" />
              <Text style={styles.premiumBadgeText}>PREMIUM</Text>
            </View>
          )}
        </Animated.View>

        {cart.items.length === 0 ? (
          <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
            <View style={styles.emptyIconContainer}>
              <LinearGradient
                colors={["rgba(139, 92, 246, 0.3)", "rgba(59, 7, 100, 0.2)"]}
                style={styles.emptyIconBg}
              >
                <Ionicons name="cart-outline" size={48} color="#a78bfa" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>Košarica je prazna</Text>
            <Text style={styles.emptyText}>
              Dodaj izdelke iz iskalnika in{"\n"}primerjaj cene med trgovinami
            </Text>
          </Animated.View>
        ) : (
          <>
            {/* Savings Banner */}
            {potentialSavings && (
              <Animated.View style={[styles.savingsBanner, { opacity: fadeAnim }]}>
                <LinearGradient
                  colors={["rgba(16, 185, 129, 0.2)", "rgba(5, 150, 105, 0.1)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.savingsBannerGradient}
                >
                  <View style={styles.savingsIcon}>
                    <Ionicons name="trending-down" size={24} color="#10b981" />
                  </View>
                  <View style={styles.savingsInfo}>
                    <Text style={styles.savingsTitle}>Prihrani do {formatPrice(potentialSavings.amount)}</Text>
                    <Text style={styles.savingsSubtitle}>
                      Najcenejše v {potentialSavings.cheapestStore} (-{potentialSavings.percentage}%)
                    </Text>
                  </View>
                </LinearGradient>
              </Animated.View>
            )}

            {/* Summary Card */}
            <Animated.View style={[styles.summaryCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <LinearGradient
                colors={["rgba(139, 92, 246, 0.15)", "rgba(59, 7, 100, 0.3)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.summaryGradient}
              >
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Izdelkov</Text>
                  <Text style={styles.summaryValue}>{cart.itemCount}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Trgovin</Text>
                  <Text style={styles.summaryValue}>{cart.groupedByStore.length}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>SKUPAJ</Text>
                  <Text style={styles.totalValue}>{formatPrice(cart.total)}</Text>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Store Groups */}
            {cart.groupedByStore.map((group: StoreGroup, groupIndex: number) => (
              <Animated.View
                key={group.storeId}
                style={[
                  styles.storeGroup,
                  {
                    opacity: fadeAnim,
                    transform: [
                      {
                        translateY: slideAnim.interpolate({
                          inputRange: [0, 50],
                          outputRange: [0, 50 + groupIndex * 20],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={["rgba(139, 92, 246, 0.1)", "rgba(59, 7, 100, 0.2)"]}
                  style={styles.storeGroupGradient}
                >
                  {/* Store Header */}
                  <View style={styles.storeHeader}>
                    <View style={styles.storeInfo}>
                      <View style={[styles.storeLogo, { backgroundColor: group.storeColor + "20" }]}>
                        <Text style={styles.storeLogoText}>{STORE_LOGOS[group.storeName] || "🏪"}</Text>
                      </View>
                      <View>
                        <Text style={styles.storeGroupName}>{group.storeName}</Text>
                        <Text style={styles.storeItemCount}>{group.items.length} izdelkov</Text>
                      </View>
                    </View>
                    <View style={styles.storeSubtotal}>
                      <Text style={styles.storeSubtotalLabel}>Skupaj</Text>
                      <Text style={styles.storeSubtotalValue}>{formatPrice(group.subtotal)}</Text>
                    </View>
                  </View>

                  {/* Items */}
                  <View style={styles.itemsList}>
                    {group.items.map((item: CartItemType, itemIndex: number) => (
                      <View
                        key={item._id}
                        style={[
                          styles.cartItem,
                          itemIndex === group.items.length - 1 && styles.cartItemLast,
                        ]}
                      >
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>{item.productName}</Text>
                          <Text style={styles.itemUnit}>{item.productUnit}</Text>
                        </View>

                        <View style={styles.itemControls}>
                          <View style={styles.quantityContainer}>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => handleQuantityChange(item._id, item.quantity, -1)}
                            >
                              <Ionicons name="remove" size={16} color="#a78bfa" />
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>{item.quantity}</Text>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => handleQuantityChange(item._id, item.quantity, 1)}
                            >
                              <Ionicons name="add" size={16} color="#a78bfa" />
                            </TouchableOpacity>
                          </View>

                          <Text style={styles.itemPrice}>
                            {formatPrice(item.currentPrice * item.quantity)}
                          </Text>

                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => handleRemove(item._id)}
                          >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              </Animated.View>
            ))}

            {/* Premium Optimize CTA */}
            {!isPremium && cart.groupedByStore.length > 1 && (
              <TouchableOpacity
                style={styles.optimizeCta}
                onPress={() => setShowOptimizeModal(true)}
              >
                <LinearGradient
                  colors={["rgba(251, 191, 36, 0.15)", "rgba(245, 158, 11, 0.1)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.optimizeGradient}
                >
                  <View style={styles.optimizeIcon}>
                    <Ionicons name="flash" size={24} color="#fbbf24" />
                  </View>
                  <View style={styles.optimizeInfo}>
                    <Text style={styles.optimizeTitle}>Optimiziraj košarico</Text>
                    <Text style={styles.optimizeSubtitle}>
                      Premium najde najcenejšo kombinacijo izdelkov med vsemi trgovinami.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#fbbf24" />
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color="#a78bfa" />
                <Text style={styles.shareButtonText}>Deli seznam</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.clearButton} onPress={handleClearCart}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                <Text style={styles.clearButtonText}>Izprazni</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Optimize Modal */}
      {showOptimizeModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.2)", "rgba(59, 7, 100, 0.4)"]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowOptimizeModal(false)}
              >
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>

              <View style={styles.modalIcon}>
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b"]}
                  style={styles.modalIconBg}
                >
                  <Ionicons name="star" size={32} color="#fff" />
                </LinearGradient>
              </View>

              <Text style={styles.modalTitle}>Premium optimizacija</Text>
              <Text style={styles.modalDescription}>
                Naš algoritem analizira tvojo košarico in najde najcenejšo kombinacijo izdelkov med vsemi trgovinami.
              </Text>

              <View style={styles.modalFeatures}>
                <View style={styles.modalFeature}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={styles.modalFeatureText}>Avtomatska optimizacija</Text>
                </View>
                <View style={styles.modalFeature}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={styles.modalFeatureText}>Prikaz prihrankov</Text>
                </View>
                <View style={styles.modalFeature}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={styles.modalFeatureText}>Vse trgovine vključene</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.modalButton} onPress={() => router.push("/premium")}>
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Nadgradi na Premium</Text>
                  <Text style={styles.modalButtonPrice}>1,99 €/mesec</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      )}
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
  },
  glowOrb1: {
    width: 300,
    height: 300,
    backgroundColor: "#8b5cf6",
    top: -100,
    right: -100,
    opacity: 0.15,
  },
  glowOrb2: {
    width: 200,
    height: 200,
    backgroundColor: "#d946ef",
    bottom: 200,
    left: -80,
    opacity: 0.1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#9ca3af",
    fontSize: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 70,
    height: 70,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fbbf24",
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
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
  savingsBanner: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  savingsBannerGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  savingsIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  savingsInfo: {
    flex: 1,
  },
  savingsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10b981",
  },
  savingsSubtitle: {
    fontSize: 13,
    color: "#6ee7b7",
    marginTop: 2,
  },
  summaryCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: "hidden",
  },
  summaryGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#9ca3af",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#a78bfa",
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
  },
  storeGroup: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: "hidden",
  },
  storeGroupGradient: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.15)",
  },
  storeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.1)",
  },
  storeInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  storeLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  storeLogoText: {
    fontSize: 20,
  },
  storeGroupName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  storeItemCount: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  storeSubtotal: {
    alignItems: "flex-end",
  },
  storeSubtotalLabel: {
    fontSize: 11,
    color: "#9ca3af",
  },
  storeSubtotalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  itemsList: {
    padding: 16,
    paddingTop: 8,
  },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.08)",
  },
  cartItemLast: {
    borderBottomWidth: 0,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  itemUnit: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  itemControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: 10,
    marginRight: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    minWidth: 24,
    textAlign: "center",
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    minWidth: 60,
    textAlign: "right",
    marginRight: 12,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  optimizeCta: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  optimizeGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  optimizeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  optimizeInfo: {
    flex: 1,
  },
  optimizeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fbbf24",
  },
  optimizeSubtitle: {
    fontSize: 12,
    color: "#fcd34d",
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  shareButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#a78bfa",
    marginLeft: 8,
  },
  clearButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
    marginLeft: 8,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    overflow: "hidden",
  },
  modalGradient: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  modalClose: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
  modalIcon: {
    alignSelf: "center",
    marginBottom: 20,
  },
  modalIconBg: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  modalFeatures: {
    marginBottom: 24,
  },
  modalFeature: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  modalFeatureText: {
    fontSize: 14,
    color: "#fff",
    marginLeft: 12,
  },
  modalButton: {
    borderRadius: 14,
    overflow: "hidden",
  },
  modalButtonGradient: {
    alignItems: "center",
    paddingVertical: 16,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  modalButtonPrice: {
    fontSize: 12,
    color: "rgba(0, 0, 0, 0.6)",
    marginTop: 2,
  },
});
