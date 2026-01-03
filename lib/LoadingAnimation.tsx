import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  size?: "small" | "medium" | "large";
  showProgress?: boolean;
  progress?: number; // 0-100
  color?: string;
};

export default function LoadingAnimation({
  size = "medium",
  showProgress = false,
  progress = 0,
  color = "#a855f7"
}: Props) {
  // Animations
  const cartMoveAnim = useRef(new Animated.Value(0)).current;
  const discount1Anim = useRef(new Animated.Value(0)).current;
  const discount2Anim = useRef(new Animated.Value(0)).current;
  const discount3Anim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Size configurations
  const sizeConfig = {
    small: { cart: 24, discount: 16, container: 60, fontSize: 10 },
    medium: { cart: 32, discount: 20, container: 80, fontSize: 12 },
    large: { cart: 48, discount: 28, container: 120, fontSize: 14 },
  };

  const config = sizeConfig[size];

  useEffect(() => {
    // Cart movement (back and forth)
    const cartAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(cartMoveAnim, {
          toValue: 20,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(cartMoveAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    // Discounts falling from cart
    const discountsAnimation = Animated.loop(
      Animated.stagger(400, [
        Animated.sequence([
          Animated.timing(discount1Anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(discount1Anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(discount2Anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(discount2Anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(discount3Anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(discount3Anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );

    // Rotation for discounts
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    cartAnimation.start();
    discountsAnimation.start();
    rotateAnimation.start();

    return () => {
      cartAnimation.stop();
      discountsAnimation.stop();
      rotateAnimation.stop();
    };
  }, [cartMoveAnim, discount1Anim, discount2Anim, discount3Anim, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const createDiscountStyle = (animValue: Animated.Value, delay: number) => ({
    transform: [
      {
        translateY: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, config.container - 20],
        }),
      },
      {
        translateX: animValue.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, delay * 5, -delay * 3],
        }),
      },
      { rotate },
    ],
    opacity: animValue.interpolate({
      inputRange: [0, 0.2, 0.8, 1],
      outputRange: [0, 1, 1, 0],
    }),
  });

  return (
    <View style={[styles.container, { height: config.container + 40 }]}>
      {/* Falling discounts */}
      <Animated.View
        style={[
          styles.discount,
          { top: -config.discount / 2, left: config.container / 2 - 15 },
          createDiscountStyle(discount1Anim, 1)
        ]}
      >
        <Text style={[styles.discountText, { fontSize: config.fontSize, color }]}>-20%</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.discount,
          { top: -config.discount / 2, left: config.container / 2 + 5 },
          createDiscountStyle(discount2Anim, 2)
        ]}
      >
        <Text style={[styles.discountText, { fontSize: config.fontSize, color }]}>-50%</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.discount,
          { top: -config.discount / 2, left: config.container / 2 - 25 },
          createDiscountStyle(discount3Anim, 3)
        ]}
      >
        <Text style={[styles.discountText, { fontSize: config.fontSize, color }]}>-30%</Text>
      </Animated.View>

      {/* Moving cart */}
      <Animated.View
        style={[
          styles.cartContainer,
          {
            transform: [{ translateX: cartMoveAnim }],
          },
        ]}
      >
        <Ionicons name="cart" size={config.cart} color={color} />
      </Animated.View>

      {/* Progress percentage */}
      {showProgress && (
        <View style={styles.progressContainer}>
          <Text style={[styles.progressText, { color }]}>
            {Math.round(progress)}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cartContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  discount: {
    position: "absolute",
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.4)",
  },
  discountText: {
    fontWeight: "800",
  },
  progressContainer: {
    marginTop: 12,
  },
  progressText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
