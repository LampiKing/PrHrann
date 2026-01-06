import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, Dimensions, PixelRatio } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Device from "expo-device";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHORT_SIDE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT);

// Different preset positions for icons
type IconConfig = {
  icon: string;
  size: number;
  color: string;
  opacity: number;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
};

const DEFAULT_ICON_CONFIGS: IconConfig[] = [
  { icon: "cart", size: 40, color: "#a855f7", top: "8%", left: "5%", opacity: 0.15 },
  { icon: "pricetag", size: 32, color: "#fbbf24", top: "15%", right: "8%", opacity: 0.12 },
  { icon: "flash", size: 28, color: "#ec4899", top: "35%", left: "3%", opacity: 0.1 },
  { icon: "gift", size: 30, color: "#d946ef", bottom: "35%", right: "5%", opacity: 0.12 },
  { icon: "basket", size: 34, color: "#06b6d4", bottom: "20%", left: "8%", opacity: 0.1 },
  { icon: "receipt", size: 26, color: "#10b981", top: "55%", right: "3%", opacity: 0.08 },
  { icon: "wallet", size: 28, color: "#f59e0b", bottom: "45%", left: "2%", opacity: 0.1 },
  { icon: "bag-handle", size: 36, color: "#8b5cf6", top: "70%", right: "10%", opacity: 0.08 },
];

type FloatingBackgroundProps = {
  variant?: "full" | "sparse" | "minimal";
  animated?: boolean;
  iconConfigs?: IconConfig[];
  deviceAdaptive?: boolean;
  performanceMode?: "auto" | "low" | "high";
};

export default function FloatingBackground({ 
  variant = "sparse", 
  animated = true,
  iconConfigs,
  deviceAdaptive = true,
  performanceMode = "auto",
}: FloatingBackgroundProps) {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;

  const isCompactScreen = SHORT_SIDE <= 360;
  const deviceType = Device.deviceType;
  const isTabletLike =
    deviceType === Device.DeviceType.TABLET ||
    deviceType === Device.DeviceType.DESKTOP ||
    SHORT_SIDE >= 768;
  const deviceVariant = isTabletLike ? "full" : isCompactScreen ? "minimal" : "sparse";
  const resolvedVariant = deviceAdaptive && variant === "sparse" ? deviceVariant : variant;
  const resolvedIcons = iconConfigs ?? DEFAULT_ICON_CONFIGS;

  const lowEndByYear = Device.deviceYearClass ? Device.deviceYearClass <= 2018 : false;
  const lowEndByMemory = Device.totalMemory ? Device.totalMemory <= 3 * 1024 ** 3 : false;
  const lowEndByDensity = isCompactScreen && PixelRatio.get() <= 2;
  const isLowEndDevice =
    performanceMode === "low" ||
    (performanceMode === "auto" && (lowEndByYear || lowEndByMemory || lowEndByDensity));
  const shouldRasterize = animated && isLowEndDevice;

  useEffect(() => {
    if (!animated) return;

    const createAnimation = (animValue: Animated.Value, duration: number) => {
      return Animated.loop(
        Animated.timing(animValue, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        })
      );
    };

    const animation1 = createAnimation(anim1, 8000);
    const animation2 = createAnimation(anim2, 12000);

    animation1.start();
    animation2.start();

    return () => {
      animation1.stop();
      animation2.stop();
    };
  }, [animated, anim1, anim2]);

  // Filter icons based on variant
  const getIcons = () => {
    switch (resolvedVariant) {
      case "full":
        return resolvedIcons;
      case "minimal":
        return resolvedIcons.slice(0, 3);
      case "sparse":
      default:
        return resolvedIcons.slice(0, 5);
    }
  };

  const icons = getIcons();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {icons.map((config, index) => {
        const animValue = index % 2 === 0 ? anim1 : anim2;
        const direction = index % 2 === 0 ? 1 : -1;

        const animatedStyle = animated ? {
          transform: [
            {
              translateY: animValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 15 * direction, 0],
              }),
            },
            {
              translateX: animValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 8 * direction, 0],
              }),
            },
            {
              rotate: animValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [`${-3 * direction}deg`, `${3 * direction}deg`, `${-3 * direction}deg`],
              }),
            },
          ],
        } : {};

        const positionStyle: any = {
          position: "absolute",
          opacity: config.opacity,
        };

        if (config.top) positionStyle.top = config.top;
        if (config.bottom) positionStyle.bottom = config.bottom;
        if (config.left) positionStyle.left = config.left;
        if (config.right) positionStyle.right = config.right;

        return (
          <Animated.View
            key={`${config.icon}-${index}`}
            shouldRasterizeIOS={shouldRasterize}
            renderToHardwareTextureAndroid={shouldRasterize}
            style={[positionStyle, animatedStyle]}
          >
            <Ionicons 
              name={config.icon as any} 
              size={config.size} 
              color={config.color} 
            />
          </Animated.View>
        );
      })}
    </View>
  );
}
