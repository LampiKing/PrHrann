import React, { useEffect, useRef } from "react";
import { Image, View, StyleSheet, Animated } from "react-native";

type Props = {
  size?: number;
  pulse?: boolean;
};

export default function Logo({ size = 110, pulse = true }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [pulse, pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        { width: size, height: size },
        pulse && { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <Image
        source={require("@/assets/images/1595E33B-B540-4C55-BAA2-E6DA6596BEFF.png")}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
