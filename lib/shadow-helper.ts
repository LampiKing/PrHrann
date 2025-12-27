import { Platform, ViewStyle, TextStyle } from "react-native";

/**
 * Cross-platform shadow helper
 * Generates proper shadow styles for iOS, Android, and Web
 */
export function createShadow(
  color: string,
  offsetX: number = 0,
  offsetY: number = 0,
  opacity: number = 0.3,
  radius: number = 8,
  elevation: number = 4
): ViewStyle {
  const isWeb = Platform.OS === "web";
  const shadowColor = hexToRgba(color, opacity);
  return {
    ...(isWeb
      ? { boxShadow: `${offsetX}px ${offsetY}px ${radius}px ${shadowColor}` }
      : {
          shadowColor: color,
          shadowOffset: { width: offsetX, height: offsetY },
          shadowOpacity: opacity,
          shadowRadius: radius,
        }),
    ...(Platform.OS === "android" ? { elevation } : {}),
  } as ViewStyle;
}

/**
 * Cross-platform text shadow helper
 * Generates proper text shadow styles for iOS, Android, and Web
 */
export function createTextShadow(
  color: string,
  offsetX: number = 0,
  offsetY: number = 1,
  radius: number = 2
): TextStyle {
  // Use textShadow for all platforms (works on web, and react-native-web handles it)
  return {
    textShadow: `${offsetX}px ${offsetY}px ${radius}px ${color}`,
  } as TextStyle;
}

/**
 * Convert hex color to rgba with opacity
 */
function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  hex = hex.replace("#", "");

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
