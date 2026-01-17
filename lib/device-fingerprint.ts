import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";

export interface DeviceInfo {
  deviceName: string;
  deviceHash: string;
  platform: string;
}

/**
 * Ustvari unikaten fingerprint naprave
 */
export async function getDeviceFingerprint(): Promise<DeviceInfo> {
  const platform = Platform.OS; // "ios", "android", "web"

  let deviceName = "Neznana naprava";
  let fingerprintData = "";

  if (Platform.OS === "web") {
    // Web - uporabi user agent in screen info
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent;
      const screenInfo = typeof screen !== "undefined"
        ? `${screen.width}x${screen.height}`
        : "unknown";
      fingerprintData = `web-${ua}-${screenInfo}`;

      // Poskusi prepoznati brskalnik
      if (ua.includes("Chrome")) deviceName = "Chrome brskalnik";
      else if (ua.includes("Firefox")) deviceName = "Firefox brskalnik";
      else if (ua.includes("Safari")) deviceName = "Safari brskalnik";
      else if (ua.includes("Edge")) deviceName = "Edge brskalnik";
      else deviceName = "Spletni brskalnik";
    }
  } else {
    // Mobile - uporabi Device info
    const brand = Device.brand || "Unknown";
    const modelName = Device.modelName || Device.deviceName || "Unknown";
    const osVersion = Device.osVersion || "";
    const deviceId = Constants.installationId || "";

    deviceName = `${brand} ${modelName}`.trim();
    fingerprintData = `${platform}-${brand}-${modelName}-${osVersion}-${deviceId}`;
  }

  // Ustvari hash
  const deviceHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    fingerprintData
  );

  return {
    deviceName,
    deviceHash,
    platform,
  };
}
