import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { useAction, useQuery, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import * as Haptics from "expo-haptics";
import FloatingBackground from "../lib/FloatingBackground";

type ReceiptResult = {
  success: boolean;
  savedAmount?: number;
  storeName?: string;
  totalPaid?: number;
  error?: string;
  invalidReason?: string;  // If set, receipt doesn't count for competition
};

type ReceiptMode = "select" | "single" | "multi";

export default function ReceiptsScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [showResultModal, setShowResultModal] = useState(false);
  const [receiptResult, setReceiptResult] = useState<ReceiptResult | null>(null);

  // Multi-image state
  const [receiptMode, setReceiptMode] = useState<ReceiptMode>("select");
  const [topImage, setTopImage] = useState<string | null>(null);
  const [bottomImage, setBottomImage] = useState<string | null>(null);

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

  // Single image mode handlers
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

  // Multi-image mode handlers
  const pickMultiImage = async (part: "top" | "bottom", source: "camera" | "gallery") => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    let result;
    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return;
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
    }

    if (!result.canceled && result.assets[0]) {
      if (part === "top") {
        setTopImage(result.assets[0].uri);
      } else {
        setBottomImage(result.assets[0].uri);
      }
    }
  };

  const handleMultiImageSubmit = async () => {
    if (!topImage || !bottomImage) return;

    setAnalyzing(true);
    setUploading(true);
    setLoadingStage("Pripravljam slike...");

    try {
      // Convert both images to base64
      const convertToBase64 = async (uri: string) => {
        if (Platform.OS === "web") {
          const response = await fetch(uri);
          const blob = await response.blob();
          return await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } else {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: "base64",
          });
          return `data:image/jpeg;base64,${base64}`;
        }
      };

      const [topBase64, bottomBase64] = await Promise.all([
        convertToBase64(topImage),
        convertToBase64(bottomImage),
      ]);

      setLoadingStage("Berem račun z AI...");

      // Submit receipt with both images (combined)
      const result = await submitReceipt({
        imageBase64: topBase64,
        imageBase64Bottom: bottomBase64,
        confirmed: true
      });

      if (result.success && result.receiptId) {
        setReceiptResult({
          success: true,
          savedAmount: result.savedAmount ?? 0,
          storeName: result.storeName ?? "Trgovina",
          totalPaid: result.totalPaid ?? 0,
          invalidReason: result.invalidReason,
        });
        setShowResultModal(true);
        // Reset multi-image state
        setTopImage(null);
        setBottomImage(null);
        setReceiptMode("select");

        if (Platform.OS !== "web") {
          Haptics.notificationAsync(
            result.invalidReason
              ? Haptics.NotificationFeedbackType.Warning
              : Haptics.NotificationFeedbackType.Success
          );
        }
      } else {
        let errorMessage = result.error || "Napaka pri obdelavi računa";
        if (result.error?.includes("Duplicate")) {
          errorMessage = "Ta račun je že dodan! Isti račun ne more biti dodan dvakrat.";
        } else if (result.error?.includes("Daily")) {
          errorMessage = "Dnevna omejitev dosežena. Jutri lahko dodaš nov račun.";
        } else if (result.error?.includes("parse")) {
          errorMessage = "Račun ni bil prepoznan. Prosim poskusi z bolj jasno sliko.";
        }

        setReceiptResult({
          success: false,
          error: errorMessage,
        });
        setShowResultModal(true);

        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    } catch (error) {
      console.error("Receipt upload error:", error);
      setReceiptResult({
        success: false,
        error: "Napaka pri nalaganju. Preveri internetno povezavo.",
      });
      setShowResultModal(true);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setAnalyzing(false);
      setUploading(false);
      setLoadingStage("");
    }
  };

  const resetMultiMode = () => {
    setTopImage(null);
    setBottomImage(null);
    setReceiptMode("select");
  };

  const handleImageSelected = async (uri: string) => {
    setAnalyzing(true);
    setUploading(true);
    setLoadingStage("Pripravljam sliko...");

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

      setLoadingStage("Berem račun z AI...");

      // Submit receipt with OCR
      const result = await submitReceipt({ imageBase64: base64Image, confirmed: true });

      if (result.success && result.receiptId) {
        setReceiptResult({
          success: true,
          savedAmount: result.savedAmount ?? 0,
          storeName: result.storeName ?? "Trgovina",
          totalPaid: result.totalPaid ?? 0,
          invalidReason: result.invalidReason,  // May be set if receipt doesn't count
        });
        setShowResultModal(true);

        if (Platform.OS !== "web") {
          // Warning haptic if invalid, success if valid
          Haptics.notificationAsync(
            result.invalidReason
              ? Haptics.NotificationFeedbackType.Warning
              : Haptics.NotificationFeedbackType.Success
          );
        }
      } else {
        // Show error
        let errorMessage = result.error || "Napaka pri obdelavi računa";
        if (result.error?.includes("Duplicate")) {
          errorMessage = "Ta račun je že dodan! Isti račun ne more biti dodan dvakrat.";
        } else if (result.error?.includes("Daily")) {
          errorMessage = "Dnevna omejitev dosežena. Jutri lahko dodaš nov račun.";
        } else if (result.error?.includes("parse")) {
          errorMessage = "Račun ni bil prepoznan. Prosim poskusi z bolj jasno sliko.";
        }

        setReceiptResult({
          success: false,
          error: errorMessage,
        });
        setShowResultModal(true);

        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    } catch (error) {
      console.error("Receipt upload error:", error);
      setReceiptResult({
        success: false,
        error: "Napaka pri nalaganju. Preveri internetno povezavo.",
      });
      setShowResultModal(true);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setAnalyzing(false);
      setUploading(false);
      setLoadingStage("");
    }
  };

  const closeResultModal = () => {
    setShowResultModal(false);
    setReceiptResult(null);
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
      <FloatingBackground variant="sparse" />

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

            {/* Mode Selection */}
            {receiptMode === "select" && (
              <View style={styles.modeSelection}>
                <TouchableOpacity
                  style={styles.modeCard}
                  onPress={() => setReceiptMode("single")}
                  disabled={uploading}
                >
                  <LinearGradient
                    colors={["rgba(139, 92, 246, 0.15)", "rgba(139, 92, 246, 0.05)"]}
                    style={styles.modeCardGradient}
                  >
                    <View style={styles.modeIconCircle}>
                      <Ionicons name="receipt-outline" size={32} color="#a78bfa" />
                    </View>
                    <Text style={styles.modeTitle}>Kratek račun</Text>
                    <Text style={styles.modeDesc}>Cel račun se vidi na eni sliki</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modeCard}
                  onPress={() => setReceiptMode("multi")}
                  disabled={uploading}
                >
                  <LinearGradient
                    colors={["rgba(16, 185, 129, 0.15)", "rgba(16, 185, 129, 0.05)"]}
                    style={styles.modeCardGradient}
                  >
                    <View style={[styles.modeIconCircle, styles.modeIconCircleGreen]}>
                      <Ionicons name="documents-outline" size={32} color="#10b981" />
                    </View>
                    <Text style={styles.modeTitle}>Dolg račun</Text>
                    <Text style={styles.modeDesc}>Račun potrebuje 2 sliki</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* Single Image Mode */}
            {receiptMode === "single" && (
              <>
                <TouchableOpacity style={styles.backToModeBtn} onPress={() => setReceiptMode("select")}>
                  <Ionicons name="arrow-back" size={16} color="#a78bfa" />
                  <Text style={styles.backToModeText}>Nazaj na izbiro</Text>
                </TouchableOpacity>

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
              </>
            )}

            {/* Multi Image Mode */}
            {receiptMode === "multi" && (
              <>
                <TouchableOpacity style={styles.backToModeBtn} onPress={resetMultiMode}>
                  <Ionicons name="arrow-back" size={16} color="#a78bfa" />
                  <Text style={styles.backToModeText}>Nazaj na izbiro</Text>
                </TouchableOpacity>

                {/* Top Part */}
                <View style={styles.multiImageSection}>
                  <View style={styles.multiImageHeader}>
                    <View style={styles.multiImageNumber}>
                      <Text style={styles.multiImageNumberText}>1</Text>
                    </View>
                    <View style={styles.multiImageInfo}>
                      <Text style={styles.multiImageTitle}>Zgornji del računa</Text>
                      <Text style={styles.multiImageDesc}>
                        Slikaj vrh računa z imenom trgovine, datumom in prvimi izdelki
                      </Text>
                    </View>
                  </View>

                  {topImage ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: topImage }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => setTopImage(null)}
                      >
                        <Ionicons name="close-circle" size={28} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.multiUploadButtons}>
                      <TouchableOpacity
                        style={styles.multiUploadBtn}
                        onPress={() => pickMultiImage("top", "camera")}
                        disabled={uploading}
                      >
                        <Ionicons name="camera" size={22} color="#8b5cf6" />
                        <Text style={styles.multiUploadBtnText}>Slikaj</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.multiUploadBtn}
                        onPress={() => pickMultiImage("top", "gallery")}
                        disabled={uploading}
                      >
                        <Ionicons name="images" size={22} color="#10b981" />
                        <Text style={styles.multiUploadBtnText}>Galerija</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Bottom Part */}
                <View style={styles.multiImageSection}>
                  <View style={styles.multiImageHeader}>
                    <View style={[styles.multiImageNumber, styles.multiImageNumberGreen]}>
                      <Text style={styles.multiImageNumberText}>2</Text>
                    </View>
                    <View style={styles.multiImageInfo}>
                      <Text style={styles.multiImageTitle}>Spodnji del računa</Text>
                      <Text style={styles.multiImageDesc}>
                        Slikaj spodnji del s skupnim zneskom in zadnjimi izdelki
                      </Text>
                    </View>
                  </View>

                  {bottomImage ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: bottomImage }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => setBottomImage(null)}
                      >
                        <Ionicons name="close-circle" size={28} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.multiUploadButtons}>
                      <TouchableOpacity
                        style={styles.multiUploadBtn}
                        onPress={() => pickMultiImage("bottom", "camera")}
                        disabled={uploading}
                      >
                        <Ionicons name="camera" size={22} color="#8b5cf6" />
                        <Text style={styles.multiUploadBtnText}>Slikaj</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.multiUploadBtn}
                        onPress={() => pickMultiImage("bottom", "gallery")}
                        disabled={uploading}
                      >
                        <Ionicons name="images" size={22} color="#10b981" />
                        <Text style={styles.multiUploadBtnText}>Galerija</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Submit Button */}
                {topImage && bottomImage && (
                  <TouchableOpacity
                    style={styles.submitMultiBtn}
                    onPress={handleMultiImageSubmit}
                    disabled={uploading}
                  >
                    <LinearGradient
                      colors={["#8b5cf6", "#7c3aed"]}
                      style={styles.submitMultiBtnGradient}
                    >
                      <Ionicons name="cloud-upload" size={24} color="#fff" />
                      <Text style={styles.submitMultiBtnText}>Naloži račun</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </>
            )}

            {analyzing && (
              <View style={styles.analyzingBox}>
                <ActivityIndicator size="small" color="#8b5cf6" />
                <Text style={styles.analyzingText}>{loadingStage || "Analiziram račun..."}</Text>
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

        {/* Result Modal */}
        <Modal
          visible={showResultModal}
          transparent={true}
          animationType="fade"
          onRequestClose={closeResultModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {receiptResult?.success ? (
                <>
                  <View style={styles.successIconCircle}>
                    <Ionicons name="checkmark" size={48} color="#10b981" />
                  </View>
                  <Text style={styles.modalTitle}>Super!</Text>
                  <Text style={styles.modalSubtitle}>Račun uspešno dodan</Text>
                  <View style={styles.savingsDisplay}>
                    <Text style={styles.savingsLabel}>Prihranek</Text>
                    <Text style={styles.savingsAmount}>
                      {(receiptResult.savedAmount ?? 0).toFixed(2)} EUR
                    </Text>
                    <Text style={styles.storeInfo}>
                      {receiptResult.storeName} • {(receiptResult.totalPaid ?? 0).toFixed(2)} EUR
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.errorIconCircle}>
                    <Ionicons name="close" size={48} color="#ef4444" />
                  </View>
                  <Text style={styles.modalTitle}>Ojoj!</Text>
                  <Text style={styles.modalErrorText}>{receiptResult?.error}</Text>
                </>
              )}
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeResultModal}>
                <Text style={styles.modalCloseText}>Zapri</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1a1a2e",
    borderRadius: 24,
    padding: 32,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#9ca3af",
    marginBottom: 20,
  },
  modalErrorText: {
    fontSize: 15,
    color: "#f87171",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  savingsDisplay: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  savingsLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  savingsAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: "#10b981",
    marginBottom: 8,
  },
  storeInfo: {
    fontSize: 14,
    color: "#9ca3af",
  },
  modalCloseButton: {
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.4)",
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#a78bfa",
  },
  // Mode selection styles
  modeSelection: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modeCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  modeCardGradient: {
    padding: 20,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  modeIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modeIconCircleGreen: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  modeDesc: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
  },
  backToModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    paddingVertical: 8,
  },
  backToModeText: {
    fontSize: 14,
    color: "#a78bfa",
    fontWeight: "600",
  },
  // Multi image styles
  multiImageSection: {
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  multiImageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  multiImageNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#8b5cf6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  multiImageNumberGreen: {
    backgroundColor: "#10b981",
  },
  multiImageNumberText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  multiImageInfo: {
    flex: 1,
  },
  multiImageTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  multiImageDesc: {
    fontSize: 13,
    color: "#9ca3af",
    lineHeight: 18,
  },
  multiUploadButtons: {
    flexDirection: "row",
    gap: 10,
  },
  multiUploadBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  multiUploadBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  imagePreviewContainer: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: 120,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 14,
  },
  submitMultiBtn: {
    marginTop: 8,
    borderRadius: 16,
    overflow: "hidden",
  },
  submitMultiBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  submitMultiBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
