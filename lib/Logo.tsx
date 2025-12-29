import React, { useEffect, useRef } from "react";
import { Image, View, StyleSheet, Animated, ImageSourcePropType } from "react-native";

type Props = {
  size?: number;
  pulse?: boolean;
};

const LOGO_DEFAULT = require("@/assets/images/Logo Default.png");
const LOGO_HALLOWEEN = require("@/assets/images/Logo Halloween.png");
const LOGO_WINTER = require("@/assets/images/Logo Bozicni.png");

export const getSeasonalLogoSource = (date = new Date()): ImageSourcePropType => {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (month === 10) {
    return LOGO_HALLOWEEN;
  }

  if (month === 11 && day >= 15) {
    return LOGO_WINTER;
  }

  if (month === 12) {
    return LOGO_WINTER;
  }

  return LOGO_DEFAULT;
};

export default function Logo({ size = 110, pulse = true }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const logoSource = getSeasonalLogoSource();

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
        source={logoSource}
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
