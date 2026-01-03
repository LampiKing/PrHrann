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
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const logoSource = getSeasonalLogoSource();

  useEffect(() => {
    if (!pulse) return;

    const pulseAnimation = Animated.loop(
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

    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    );

    pulseAnimation.start();
    rotateAnimation.start();

    return () => {
      pulseAnimation.stop();
      rotateAnimation.stop();
    };
  }, [pulse, pulseAnim, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { width: size, height: size },
        pulse && { transform: [{ scale: pulseAnim }, { rotate }] },
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
