import { useRef, useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "react-native";
import { getSeasonalLogoSource } from "@/lib/Logo";
import { createShadow } from "@/lib/shadow-helper";
import { useRouter } from "expo-router";
import FloatingBackground from "@/lib/FloatingBackground";
import { PLAN_FAMILY, PLAN_PLUS } from "@/lib/branding";

interface CartItemType {
  _id: Id<"cartItems">;
  productId: Id<"products">;
  productName: string;
  productUnit: string;
  productCategory: string;
  storeId: Id<"stores">;
  storeName: string;
  storeColor: string;
  quantity: number;
  priceAtAdd: number;
  currentPrice: number;
  isOnSale: boolean;
}

interface BestCoupon {
  couponId: Id<"coupons">;
  code: string;
  description: string;
  savings: number;
  appliedTo: string;
  finalSubtotal: number;
}

interface StackedCoupon {
  code: string;
  description: string;
  savings: number;
  appliedTo: string;
}

interface StoreGroup {
  storeId: Id<"stores">;
  storeName: string;
  storeColor: string;
  items: CartItemType[];
  subtotal: number;
  bestCoupon?: BestCoupon;
  stackedCoupons?: StackedCoupon[];
  stackingStrategy?: string;
}

type BrandAccent = { color: string; position?: "left" | "right"; width?: number };
type BrandRing = { color: string; width?: number };
type BrandLogo = "mercator";
type StoreBrand = {
  bg: string;
  border: string;
  text: string;
  accent?: BrandAccent;
  ring?: BrandRing;
  cornerIcon?: { char: string; color: string; top: number; left: number; fontSize: number };
  logo?: BrandLogo;
};

const STORE_BRANDS: Record<string, StoreBrand> = {
  mercator: {
    bg: "#d3003c",
    border: "#b60035",
    text: "#fff",
    logo: "mercator",
  },
  spar: {
    bg: "#c8102e",
    border: "#a70e27",
    text: "#fff",
  },
  tus: {
    bg: "#0d8a3c",
    border: "#0b6e30",
    text: "#fff",
    cornerIcon: { char: "%", color: "#facc15", top: 2, left: 20, fontSize: 9 },
  },
  hofer: {
    bg: "#0b3d7a",
    border: "#0b3d7a",
    text: "#fff",
    ring: { color: "#fbbf24", width: 1.2 },
  },
  lidl: {
    bg: "#0047ba",
    border: "#0047ba",
    text: "#fff",
  },
  jager: {
    bg: "#1f8a3c",
    border: "#b91c1c",
    text: "#fff",
    accent: { color: "#b91c1c", position: "left", width: 4 },
  },
};

const getStoreBrand = (name?: string, fallbackColor?: string) => {
  const key = (name || "").toLowerCase();
  const brand = STORE_BRANDS[key as keyof typeof STORE_BRANDS];
  if (brand) return brand;
  const color = fallbackColor || "#8b5cf6";
  return { bg: color, border: color, text: "#fff" };
};

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
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
  const seasonSummary = useQuery(
    api.leaderboard.getMySeasonSummary,
    isAuthenticated ? {} : "skip"
  );
  const leaderboard = useQuery(
    api.leaderboard.getLeaderboard,
    isAuthenticated ? { limit: 100 } : "skip"
  );
  const updateQuantity = useMutation(api.cart.updateQuantity);
  const removeFromCart = useMutation(api.cart.removeFromCart);
  const clearCart = useMutation(api.cart.clearCart);

  const isPremium = profile?.isPremium ?? false;
  const premiumType = profile?.premiumType;
  // Gost je anonymous uporabnik ali brez emaila
  const isGuest = profile ? (profile.isAnonymous || !profile.email) : false;
  const currentSavings = seasonSummary?.savings ?? 0;
  const top100Threshold =
    leaderboard?.entries?.length === 100
      ? leaderboard.entries[leaderboard.entries.length - 1]?.savings ?? null
      : null;
  const projectedSavings = currentSavings + (cart?.totalSavings ?? 0);
  const remainingToTop100 =
    top100Threshold !== null ? Math.max(0, top100Threshold - projectedSavings) : null;

  if (isGuest) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.guestLockCard, { paddingTop: insets.top + 40 }]}>
          <Ionicons name="lock-closed" size={48} color="#a78bfa" />
          <Text style={styles.guestLockTitle}>Košarica je zaklenjena</Text>
          <Text style={styles.guestLockText}>
            Za nadaljevanje se prijavi ali registriraj.
          </Text>
          <TouchableOpacity
            style={styles.guestLockButton}
            onPress={() => router.push({ pathname: "/auth", params: { mode: "register" } })}
          >
            <LinearGradient
              colors={["#8b5cf6", "#7c3aed"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.guestLockButtonGradient}
            >
              <Ionicons name="person-add" size={18} color="#fff" />
              <Text style={styles.guestLockButtonText}>Prijava / Registracija</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
    return price.toFixed(2).replace(".", ",") + " EUR";
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

    let message = " Moj nakupovalni seznam (Pr'Hran)\n\n";
    
    cart.groupedByStore.forEach((group: StoreGroup) => {
      message += ` ${group.storeName}\n`;
      group.items.forEach((item: CartItemType) => {
        message += `  -  ${item.productName} (${item.quantity}x) - ${formatPrice(item.currentPrice * item.quantity)}\n`;
      });
      message += `  Skupaj: ${formatPrice(group.subtotal)}\n\n`;
    });

    message += ` SKUPAJ: ${formatPrice(cart.total)}`;

    try {
      await Share.share({ message });
    } catch (error) {
      console.error("Napaka pri deljenju:", error);
    }
  };

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
      <FloatingBackground variant="sparse" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Image
            source={getSeasonalLogoSource()}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>
            {isPremium ? "Premium košarica" : "Tvoja košarica"}
          </Text>
          {isPremium && (
            <View style={styles.premiumBadgeContainer}>
              <LinearGradient
                colors={["#fbbf24", "#f59e0b"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.premiumBadge}
              >
                <Ionicons name="star" size={14} color="#0b0814" />
                <Text style={styles.premiumBadgeText}>PREMIUM</Text>
              </LinearGradient>
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
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={() => router.push("/(tabs)")}
            >
              <LinearGradient
                colors={["#8b5cf6", "#7c3aed"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.emptyCtaGradient}
              >
                <Ionicons name="search" size={18} color="#fff" />
                <Text style={styles.emptyCtaText}>Najdi najcenejši izdelek</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <>
            {/* Quick Summary */}
            <Animated.View style={[styles.quickSummary, { opacity: fadeAnim }]}>
              {isPremium && (
                <View style={styles.premiumSummaryBadge}>
                  <Ionicons name="star" size={16} color="#fbbf24" />
                  <Text style={styles.premiumSummaryText}>
                    {premiumType === "family" ? PLAN_FAMILY : PLAN_PLUS}
                  </Text>
                  {cart.totalSavings > 0 && (
                    <Text style={styles.premiumSummaryExtra}>
                      Prihranek: {formatPrice(cart.totalSavings)}
                    </Text>
                  )}
                </View>
              )}
              <View style={styles.quickSummaryMain}>
                <Text style={styles.quickSummaryMainLabel}>VSE SKUPAJ</Text>
                <Text style={[styles.quickSummaryMainValue, isPremium && styles.premiumMainValue]}>
                  {formatPrice(cart.totalSavings > 0 ? cart.totalWithCoupons : cart.total)}
                </Text>
              </View>
              <View style={styles.quickSummaryRow}>
                <View style={styles.quickSummaryItem}>
                  <Text style={styles.quickSummaryLabel}>Kolicina</Text>
                  <Text style={styles.quickSummaryValue}>{cart.itemCount} kom</Text>
                </View>
                <View style={styles.quickSummaryDivider} />
                <View style={styles.quickSummaryItem}>
                  <Text style={styles.quickSummaryLabel}>Trgovin</Text>
                  <Text style={styles.quickSummaryValue}>{cart.groupedByStore.length}</Text>
                </View>
              </View>
            </Animated.View>

            <Animated.View style={[styles.motivationCard, { opacity: fadeAnim }]}>
              <Text style={styles.motivationTitle}>Potencialni prihranek</Text>
              <Text style={styles.motivationValue}>{formatPrice(cart.totalSavings)}</Text>
              <Text style={styles.motivationText}>
                {remainingToTop100 !== null
                  ? `Ta nakup te je priblizal Top 100 za ${formatPrice(remainingToTop100)}.`
                  : "Ta nakup je korak blize do Top 100."}
              </Text>
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
                    {(() => {
                      const storeBrand = getStoreBrand(group.storeName, group.storeColor);
                      return (
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
                              {group.storeName.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View>
                            <Text style={styles.storeGroupName}>{group.storeName}</Text>
                            <Text style={styles.storeItemCount}>{group.items.length} izdelkov</Text>
                          </View>
                        </View>
                      );
                    })()}
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
                          {item.quantity > 1 && (
                            <Text style={styles.itemPerUnit}>Cena/kos: {formatPrice(item.currentPrice)}</Text>
                          )}
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

                  {/* Premium Stacked Coupons */}
                  {group.stackedCoupons && group.stackedCoupons.length > 0 && (
                    <View style={styles.stackedCouponsContainer}>
                      <View style={styles.stackedCouponsHeader}>
                        <Ionicons name="layers" size={18} color="#fbbf24" />
                        <Text style={styles.stackedCouponsTitle}>Premium Kuponiranje</Text>
                        <View style={styles.stackedCountBadge}>
                          <Text style={styles.stackedCountText}>{group.stackedCoupons.length}x</Text>
                        </View>
                      </View>
                      {group.stackedCoupons.map((coupon: StackedCoupon, idx: number) => (
                        <View key={idx} style={styles.stackedCouponItem}>
                          <LinearGradient
                            colors={["rgba(251, 191, 36, 0.15)", "rgba(245, 158, 11, 0.1)"]}
                            style={styles.stackedCouponGradient}
                          >
                            <View style={styles.stackedCouponIcon}>
                              <Ionicons name="pricetag" size={16} color="#fbbf24" />
                            </View>
                            <View style={styles.stackedCouponInfo}>
                              <Text style={styles.stackedCouponCode}>{coupon.code}</Text>
                              <Text style={styles.stackedCouponDesc}>{coupon.description}</Text>
                              <Text style={styles.stackedCouponApplied}>→ {coupon.appliedTo}</Text>
                            </View>
                            <Text style={styles.stackedCouponSavings}>-{formatPrice(coupon.savings)}</Text>
                          </LinearGradient>
                        </View>
                      ))}
                      {group.stackingStrategy && (
                        <Text style={styles.stackingStrategyText}>✨ {group.stackingStrategy}</Text>
                      )}
                    </View>
                  )}

                  {/* Single Coupon (Free users or single coupon) */}
                  {group.bestCoupon && !group.stackedCoupons && (
                    <View style={styles.couponBadge}>
                      <LinearGradient
                        colors={["rgba(16, 185, 129, 0.2)", "rgba(5, 150, 105, 0.1)"]}
                        style={styles.couponBadgeGradient}
                      >
                        <View style={styles.couponIconBig}>
                          <Ionicons name="checkmark-circle" size={28} color="#10b981" />
                        </View>
                        <View style={styles.couponMainInfo}>
                          <View style={styles.couponCodeSection}>
                            <Text style={styles.couponCodeLabel}>KUPON</Text>
                            <Text style={styles.couponCodeBig}>{group.bestCoupon.code}</Text>
                          </View>
                          <Text style={styles.couponDescription}>{group.bestCoupon.description}</Text>
                          <Text style={styles.couponAppliedStrong}>
                            Velja za: {group.bestCoupon.appliedTo}
                          </Text>
                        </View>
                        <View style={styles.couponSavingsBox}>
                          <Text style={styles.couponSavingsLabel}>Prihranek</Text>
                          <Text style={styles.couponSavingsValue}>-{formatPrice(group.bestCoupon.savings)}</Text>
                        </View>
                      </LinearGradient>
                    </View>
                  )}

                </LinearGradient>
              </Animated.View>
            ))}

            {/* Coupon Savings Banner - NA DNU */}
            {cart.totalSavings > 0 && (
              <Animated.View style={[styles.savingsBanner, { opacity: fadeAnim }]}>
                <LinearGradient
                  colors={["rgba(16, 185, 129, 0.25)", "rgba(5, 150, 105, 0.15)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.savingsBannerGradient}
                >
                  <View style={styles.savingsIcon}>
                    <Ionicons name="pricetag" size={24} color="#10b981" />
                  </View>
                  <View style={styles.savingsInfo}>
                    <Text style={styles.savingsTitle}> Prihranek s kuponi: {formatPrice(cart.totalSavings)}</Text>
                    <Text style={styles.savingsSubtitle}>
                      Avtomatsko izbrani najboljsi kuponi za vsako trgovino
                    </Text>
                  </View>
                </LinearGradient>
              </Animated.View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color="#a78bfa" />
                <Text style={styles.shareButtonText}>Deli košarico</Text>
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0a1e",
  },
  guestLockCard: {
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.35)",
    gap: 12,
  },
  guestLockTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  guestLockText: {
    fontSize: 14,
    color: "#cbd5f5",
    textAlign: "center",
    lineHeight: 20,
  },
  guestLockButton: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  guestLockButtonGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    gap: 8,
  },
  guestLockButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
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
    width: 58,
    height: 116,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  premiumBadgeContainer: {
    marginTop: 8,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.65)",
    ...createShadow("#fbbf24", 0, 6, 0.45, 14, 8),
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 1,
  },
  premiumSummaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  premiumSummaryText: {
    fontSize: 11,
    color: "#fbbf24",
    fontWeight: "600",
    flex: 1,
  },
  premiumTotalValue: {
    color: "#fbbf24",
    fontSize: 26,
  },
  originalTotal: {
    fontSize: 14,
    color: "#6b7280",
    textDecorationLine: "line-through",
    marginBottom: 2,
  },
  couponBadge: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  couponBadgeGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    gap: 14,
  },
  couponIconBig: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  couponMainInfo: {
    flex: 1,
  },
  couponCodeSection: {
    marginBottom: 8,
  },
  couponCodeLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#10b981",
    letterSpacing: 1,
    marginBottom: 2,
  },
  couponCodeBig: {
    fontSize: 18,
    fontWeight: "800",
    color: "#10b981",
    letterSpacing: 1,
  },
  couponDescription: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 4,
  },
  couponAppliedStrong: {
    fontSize: 11,
    color: "#e5e7eb",
    fontWeight: "600",
  },
  couponSavingsBox: {
    alignItems: "flex-end",
  },
  couponSavingsLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 3,
  },
  couponSavingsValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#10b981",
  },
  couponIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  couponInfo: {
    flex: 1,
  },
  couponCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  couponCode: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10b981",
    letterSpacing: 0.5,
  },
  couponApplied: {
    fontSize: 11,
    color: "#6b7280",
    fontStyle: "italic",
  },
  possibleCouponsContainer: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  possibleCouponsLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#60a5fa",
    marginBottom: 10,
  },
  possibleCouponsList: {
    gap: 8,
  },
  possibleCouponItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  possibleCouponText: {
    fontSize: 12,
    color: "#9ca3af",
    flex: 1,
  },
  couponSavings: {
    alignItems: "flex-end",
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
    ...createShadow("#8b5cf6", 0, 4, 0.3, 12, 6),
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
  emptyCta: {
    marginTop: 18,
    borderRadius: 14,
    overflow: "hidden",
  },
  emptyCtaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  emptyCtaText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  quickSummary: {
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  motivationCard: {
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  motivationTitle: {
    fontSize: 12,
    color: "#d1fae5",
    fontWeight: "700",
    marginBottom: 6,
  },
  motivationValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#10b981",
    marginBottom: 6,
  },
  motivationText: {
    fontSize: 13,
    color: "#e5e7eb",
    lineHeight: 18,
  },
  // duplicate premiumSummaryBadge/premiumSummaryText removed (defined earlier)
  premiumSummaryExtra: {
    fontSize: 14,
    color: "#10b981",
    fontWeight: "700",
    marginLeft: "auto",
  },
  quickSummaryMain: {
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.2)",
  },
  quickSummaryMainLabel: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 6,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  quickSummaryMainValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
  },
  premiumMainValue: {
    color: "#fbbf24",
  },
  quickSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  quickSummaryItem: {
    flex: 1,
    alignItems: "center",
  },
  quickSummaryLabel: {
    fontSize: 9,
    color: "#9ca3af",
    marginBottom: 3,
  },
  quickSummaryValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  quickSummaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    marginHorizontal: 12,
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
  summarySavingsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  savingsIconSmall: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  summarySavingsText: {
    fontSize: 13,
    color: "#10b981",
    fontWeight: "700",
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
    borderWidth: 2,
    position: "relative",
  },
  storeLogoText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  patternDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.9,
  },
  brandRingLarge: {
    position: "absolute",
    top: -1.5,
    left: -1.5,
    right: -1.5,
    bottom: -1.5,
    borderRadius: 14,
    opacity: 0.9,
  },
  cornerIcon: {
    position: "absolute",
    fontWeight: "900",
    opacity: 0.95,
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
  itemPerUnit: {
    fontSize: 12,
    color: "#c4d4ff",
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
  // Premium Stacked Coupons Styles
  stackedCouponsContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.25)",
  },
  stackedCouponsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  stackedCouponsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fbbf24",
    flex: 1,
  },
  stackedCountBadge: {
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stackedCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fbbf24",
  },
  stackedCouponItem: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
  stackedCouponGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
    borderRadius: 8,
  },
  stackedCouponIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  stackedCouponInfo: {
    flex: 1,
  },
  stackedCouponCode: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fbbf24",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  stackedCouponDesc: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 2,
  },
  stackedCouponApplied: {
    fontSize: 10,
    color: "#e5e7eb",
    fontWeight: "600",
  },
  stackedCouponSavings: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fbbf24",
  },
  stackingStrategyText: {
    fontSize: 11,
    color: "#cbd5e1",
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
});

