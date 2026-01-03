import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { useAction, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as Haptics from "expo-haptics";

export default function ReceiptsScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const myReceipts = useQuery(
    api.receipts.getMyReceipts,
    isAuthenticated ? {} : "skip"
  );

  // Show loading during auth check
  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.guestLock}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={styles.guestText}>Nalaganje...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const submitReceipt = useAction(api.receipts.submitReceipt);

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      handleImageSelected(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      handleImageSelected(result.assets[0].uri);
    }
  };

  const handleImageSelected = async (uri: string) => {
    setAnalyzing(true);
    setUploading(true);

    try {
      // Convert image to base64
      let base64Image = "";
      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        base64Image = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: "base64",
        });
        base64Image = `data:image/jpeg;base64,${base64}`;
      }

      // Submit receipt with OCR
      await submitReceipt({ imageBase64: base64Image, confirmed: true });

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Receipt upload error:", error);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setAnalyzing(false);
      setUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.guestLock}>
            <Ionicons name="receipt-outline" size={64} color="#8b5cf6" />
            <Text style={styles.guestTitle}>Računi so zaklenjeni</Text>
            <Text style={styles.guestText}>
              Prijavi se za dostop do sistema računov in tekmovanja.
            </Text>
            <TouchableOpacity
              style={styles.guestButton}
              onPress={() => router.push({ pathname: "/auth", params: { mode: "login" } })}
            >
              <LinearGradient
                colors={["#8b5cf6", "#7c3aed"]}
                style={styles.guestButtonGradient}
              >
                <Text style={styles.guestButtonText}>Prijava / Registracija</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Moji Računi</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Upload Section */}
          <View style={styles.uploadSection}>
            <Text style={styles.uploadTitle}>📸 Naloži Račun</Text>
            <Text style={styles.uploadSubtitle}>
              Slikaj ali naloži račun za avtomatsko obdelavo
            </Text>

            <View style={styles.uploadButtons}>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={pickImage}
                disabled={uploading}
              >
                <LinearGradient
                  colors={["#8b5cf6", "#7c3aed"]}
                  style={styles.uploadButtonGradient}
                >
                  <Ionicons name="camera" size={28} color="#fff" />
                  <Text style={styles.uploadButtonText}>Slikaj</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.uploadButton}
                onPress={pickFromGallery}
                disabled={uploading}
              >
                <LinearGradient
                  colors={["#10b981", "#059669"]}
                  style={styles.uploadButtonGradient}
                >
                  <Ionicons name="images" size={28} color="#fff" />
                  <Text style={styles.uploadButtonText}>Galerija</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {analyzing && (
              <View style={styles.analyzingBox}>
                <ActivityIndicator size="small" color="#8b5cf6" />
                <Text style={styles.analyzingText}>Analiziram račun...</Text>
              </View>
            )}
          </View>

          {/* Receipt List */}
          <View style={styles.receiptList}>
            <Text style={styles.listTitle}>📋 Zgodovina ({myReceipts?.length ?? 0})</Text>

            {!myReceipts || myReceipts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color="#6b7280" />
                <Text style={styles.emptyTitle}>Ni računov</Text>
                <Text style={styles.emptyText}>
                  Naloži prvi račun za začetek sledenja prihrankom
                </Text>
              </View>
            ) : (
              myReceipts.map((receipt) => (
                <View key={receipt._id} style={styles.receiptCard}>
                  <View style={styles.receiptHeader}>
                    <View style={styles.receiptIconBox}>
                      <Ionicons name="receipt" size={20} color="#8b5cf6" />
                    </View>
                    <View style={styles.receiptInfo}>
                      <Text style={styles.receiptStore}>
                        {receipt.storeName ?? "Neznana trgovina"}
                      </Text>
                      <Text style={styles.receiptDate}>
                        {new Date(receipt.purchaseDate).toLocaleDateString("sl-SI")}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.receiptStatus,
                        receipt.isValid
                          ? styles.receiptStatusValid
                          : styles.receiptStatusInvalid,
                      ]}
                    >
                      <Text style={styles.receiptStatusText}>
                        {receipt.isValid ? "✓" : "✗"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.receiptFooter}>
                    <View style={styles.receiptStat}>
                      <Text style={styles.receiptStatLabel}>Znesek</Text>
                      <Text style={styles.receiptStatValue}>
                        {receipt.totalPaid.toFixed(2)} EUR
                      </Text>
                    </View>
                    <View style={styles.receiptStat}>
                      <Text style={styles.receiptStatLabel}>Prihranek</Text>
                      <Text style={[styles.receiptStatValue, styles.receiptSavings]}>
                        {receipt.savedAmount.toFixed(2)} EUR
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0a1e",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(139, 92, 246, 0.2)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  uploadSection: {
    marginBottom: 32,
  },
  uploadTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 20,
  },
  uploadButtons: {
    flexDirection: "row",
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  uploadButtonGradient: {
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  analyzingBox: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  analyzingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#a78bfa",
  },
  receiptList: {
    marginBottom: 20,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#9ca3af",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
  },
  receiptCard: {
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  receiptHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  receiptIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  receiptInfo: {
    flex: 1,
  },
  receiptStore: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  receiptDate: {
    fontSize: 12,
    color: "#9ca3af",
  },
  receiptStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptStatusValid: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
  },
  receiptStatusInvalid: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  receiptStatusText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  receiptFooter: {
    flexDirection: "row",
    gap: 16,
  },
  receiptStat: {
    flex: 1,
  },
  receiptStatLabel: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 4,
  },
  receiptStatValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  receiptSavings: {
    color: "#10b981",
  },
  guestLock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginTop: 20,
    marginBottom: 12,
  },
  guestText: {
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  guestButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  guestButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  guestButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
