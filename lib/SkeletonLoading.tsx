/**
 * Skeleton Loading Components
 * Profesionalni placeholder-ji med nalaganjem
 */

import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Osnovni skeleton element z shimmer animacijo
 */
export function Skeleton({
  width = "100%",
  height = 20,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <View
      style={[
        styles.skeleton,
        {
          width: width as number,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <LinearGradient
          colors={[
            "rgba(139, 92, 246, 0)",
            "rgba(139, 92, 246, 0.15)",
            "rgba(139, 92, 246, 0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Skeleton za kartice produktov
 */
export function ProductCardSkeleton() {
  return (
    <View style={styles.productCard}>
      {/* Slika produkta */}
      <Skeleton width={80} height={80} borderRadius={12} />

      {/* Info del */}
      <View style={styles.productInfo}>
        {/* Ime */}
        <Skeleton width="85%" height={18} borderRadius={6} />
        <Skeleton
          width="60%"
          height={14}
          borderRadius={6}
          style={{ marginTop: 8 }}
        />

        {/* Cene */}
        <View style={styles.priceRow}>
          <Skeleton width={60} height={24} borderRadius={8} />
          <Skeleton width={60} height={24} borderRadius={8} />
          <Skeleton width={60} height={24} borderRadius={8} />
        </View>
      </View>
    </View>
  );
}

/**
 * Seznam skeleton kartic
 */
export function ProductListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </View>
  );
}

/**
 * Skeleton za leaderboard vrstico
 */
export function LeaderboardRowSkeleton() {
  return (
    <View style={styles.leaderboardRow}>
      <Skeleton width={44} height={44} borderRadius={14} />
      <View style={styles.leaderboardInfo}>
        <Skeleton width="70%" height={16} borderRadius={6} />
        <Skeleton
          width="40%"
          height={12}
          borderRadius={6}
          style={{ marginTop: 6 }}
        />
      </View>
    </View>
  );
}

/**
 * Skeleton za košarico
 */
export function CartItemSkeleton() {
  return (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Skeleton width="75%" height={16} borderRadius={6} />
        <Skeleton
          width="40%"
          height={12}
          borderRadius={6}
          style={{ marginTop: 6 }}
        />
      </View>
      <View style={styles.cartItemControls}>
        <Skeleton width={80} height={32} borderRadius={10} />
        <Skeleton width={60} height={18} borderRadius={6} />
      </View>
    </View>
  );
}

/**
 * Skeleton za profil header
 */
export function ProfileHeaderSkeleton() {
  return (
    <View style={styles.profileHeader}>
      <Skeleton width={100} height={100} borderRadius={50} />
      <Skeleton
        width={150}
        height={24}
        borderRadius={8}
        style={{ marginTop: 16 }}
      />
      <Skeleton
        width={200}
        height={14}
        borderRadius={6}
        style={{ marginTop: 8 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    overflow: "hidden",
  },
  shimmer: {
    width: 200,
    height: "100%",
    position: "absolute",
  },
  gradient: {
    flex: 1,
  },
  productCard: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.15)",
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
    marginLeft: 14,
  },
  priceRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  list: {
    gap: 12,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "rgba(30, 41, 59, 0.55)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.18)",
    marginBottom: 10,
  },
  leaderboardInfo: {
    flex: 1,
  },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.08)",
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 24,
  },
});
