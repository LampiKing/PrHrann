/**
 * Cart Animation Components
 * Micro-animacije za dodajanje v košarico
 */

import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, Platform, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

interface AddToCartBounceProps {
  visible: boolean;
  onComplete?: () => void;
}

/**
 * Bounce animacija za gumb ko dodaš izdelek
 */
export function useAddToCartBounce() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const trigger = () => {
    // Reset
    scaleAnim.setValue(1);
    rotateAnim.setValue(0);

    // Haptic feedback
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Bounce + slight rotation sequence
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1.15,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const animatedStyle = {
    transform: [
      { scale: scaleAnim },
      {
        rotate: rotateAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "-3deg"],
        }),
      },
    ],
  };

  return { trigger, animatedStyle, scaleAnim };
}

/**
 * Flying particle animation when item is added
 */
export function CartParticles({ visible, onComplete }: AddToCartBounceProps) {
  const particles = useRef(
    Array.from({ length: 6 }, () => ({
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (visible) {
      // Animate particles outward
      const animations = particles.map((particle, index) => {
        const angle = (index / particles.length) * Math.PI * 2;
        const distance = 40 + Math.random() * 20;
        const targetX = Math.cos(angle) * distance;
        const targetY = Math.sin(angle) * distance;

        return Animated.parallel([
          Animated.sequence([
            Animated.timing(particle.scale, {
              toValue: 1,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(particle.scale, {
              toValue: 0,
              duration: 300,
              delay: 100,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(particle.opacity, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(particle.translateX, {
            toValue: targetX,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(particle.translateY, {
            toValue: targetY,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(particle.rotate, {
            toValue: Math.random() * 2 - 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]);
      });

      Animated.parallel(animations).start(() => {
        // Reset particles
        particles.forEach((particle) => {
          particle.translateX.setValue(0);
          particle.translateY.setValue(0);
          particle.scale.setValue(0);
          particle.opacity.setValue(0);
          particle.rotate.setValue(0);
        });
        onComplete?.();
      });
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.particlesContainer} pointerEvents="none">
      {particles.map((particle, index) => (
        <Animated.View
          key={index}
          style={[
            styles.particle,
            {
              opacity: particle.opacity,
              transform: [
                { translateX: particle.translateX },
                { translateY: particle.translateY },
                { scale: particle.scale },
                {
                  rotate: particle.rotate.interpolate({
                    inputRange: [-1, 1],
                    outputRange: ["-180deg", "180deg"],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={["#10b981", "#059669"]}
            style={styles.particleGradient}
          >
            <Text style={styles.particleText}>+</Text>
          </LinearGradient>
        </Animated.View>
      ))}
    </View>
  );
}

/**
 * Checkmark animation for success state
 */
export function SuccessCheckmark({ visible }: { visible: boolean }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      style={[
        styles.checkmarkContainer,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={["#10b981", "#059669"]}
        style={styles.checkmarkGradient}
      >
        <Text style={styles.checkmarkText}>✓</Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  particlesContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  particle: {
    position: "absolute",
    width: 20,
    height: 20,
  },
  particleGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  particleText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  checkmarkContainer: {
    position: "absolute",
    right: -8,
    top: -8,
    width: 24,
    height: 24,
  },
  checkmarkGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  checkmarkText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
});
