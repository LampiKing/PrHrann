import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

const FAQ_ITEMS = [
  {
    question: "Kako deluje primerjava cen?",
    answer:
      "Pr'Hran avtomatsko primerja cene izdelkov v trgovinah (Spar, Mercator, Tus, Hofer, Lidl, Jager). Cene se posodabljajo dnevno ob 22:00, da vedno vidiš najnovejse podatke.",
  },
  {
    question: "Kako delujejo kuponi?",
    answer:
      "Sistem uposteva aktivne kupone in akcije v trgovinah. Pri izracunu koncne cene ti pokazemo, koliko lahko prihranis z uporabo kuponov. Premium uporabniki imajo dostop do ekskluzivnih kuponov.",
  },
  {
    question: "Kaj vkljucuje Premium narocnina?",
    answer:
      "Premium narocnina (1.99 EUR/mesec) vkljucuje: neomejeno iskanje izdelkov, dostop do vseh trgovin, obvestila o padcih cen in ekskluzivne kupone.",
  },
  {
    question: "Kako dodam izdelek v košarico?",
    answer:
      "Ko najdeš izdelek, klikni na gumb 'Dodaj v košarico' pri izbrani trgovini. V kosarici potem vidiš skupno ceno in prihranke za vsako trgovino posebej.",
  },
  {
    question: "Ali so cene vedno tocne?",
    answer:
      "Cene posodabljamo dnevno iz uradnih virov trgovin. Obcasno lahko pride do manjsih odstopanj zaradi lokalnih akcij ali zakasnitev. Priporocamo, da ceno preveris tudi v trgovini.",
  },
  {
    question: "Kako preklicem Premium narocnino?",
    answer:
      "Premium narocnino lahko kadarkoli preklices v nastavitvah profila. Po preklicu imas dostop do Premium funkcij do konca obracunskega obdobja.",
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const resetData = useAction(api.stores.resetAndSeedData);

  const handleToggle = (index: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleResetData = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    
    Alert.alert(
      "Resetiraj podatke",
      "Ali si preprican, da zelis resetirati in ponovno naloziti vse podatke? To bo izbrisalo vse obstojece podatke.",
      [
        { text: "Preklici", style: "cancel" },
        {
          text: "Resetiraj",
          style: "destructive",
          onPress: async () => {
            setIsResetting(true);
            try {
              const result = await resetData({});
              Alert.alert(
                "Uspesno!",
                `Nalozenih:\n${result.stores} trgovin\n${result.products} izdelkov\n${result.prices} cen\n${result.coupons} kuponov`
              );
            } catch {
              Alert.alert("Napaka", "Ni bilo mogoce resetirati podatkov.");
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  };

  const handleContact = (method: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (method === "email") {
      Linking.openURL("mailto:support@prhran.com");
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pomoc</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Contact Card */}
          <View style={styles.contactCard}>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.2)", "rgba(59, 7, 100, 0.3)"]}
              style={styles.contactGradient}
            >
              <View style={styles.contactIcon}>
                <Ionicons name="headset" size={32} color="#a78bfa" />
              </View>
              <Text style={styles.contactTitle}>Potrebujes pomoc?</Text>
              <Text style={styles.contactText}>
                Naša ekipa ti je na voljo za vsa vprašanja in težave.
              </Text>
              <TouchableOpacity
                style={styles.contactButton}
                onPress={() => handleContact("email")}
              >
                <LinearGradient
                  colors={["#8b5cf6", "#7c3aed"]}
                  style={styles.contactButtonGradient}
                >
                  <Ionicons name="mail" size={18} color="#fff" />
                  <Text style={styles.contactButtonText}>support@prhran.com</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* FAQ Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pogosta vprašanja</Text>

            {FAQ_ITEMS.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.faqItem}
                onPress={() => handleToggle(index)}
                activeOpacity={0.8}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{item.question}</Text>
                  <Ionicons
                    name={expandedIndex === index ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#a78bfa"
                  />
                </View>
                {expandedIndex === index && (
                  <Text style={styles.faqAnswer}>{item.answer}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={styles.appVersion}>Pr'Hran verzija 1.0.0</Text>
            <Text style={styles.appCopyright}>(c) 2024 Pr'Hran. Vse pravice pridrzane.</Text>
          </View>

          {/* Debug Reset Button */}
          <TouchableOpacity
            style={styles.debugButton}
            onPress={handleResetData}
            disabled={isResetting}
          >
            <LinearGradient
              colors={["rgba(239, 68, 68, 0.2)", "rgba(220, 38, 38, 0.3)"]}
              style={styles.debugButtonGradient}
            >
              <Ionicons name="refresh" size={20} color="#ef4444" />
              <Text style={styles.debugButtonText}>
                {isResetting ? "Resetiranje..." : "Resetiraj podatke (debug)"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a12",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  contactCard: {
    marginBottom: 28,
    borderRadius: 20,
    overflow: "hidden",
  },
  contactGradient: {
    padding: 24,
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  contactIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  contactTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 20,
  },
  contactButton: {
    borderRadius: 14,
    overflow: "hidden",
  },
  contactButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 10,
  },
  contactButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  faqItem: {
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.1)",
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginRight: 12,
  },
  faqAnswer: {
    fontSize: 14,
    color: "#9ca3af",
    lineHeight: 22,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(139, 92, 246, 0.1)",
  },
  appInfo: {
    alignItems: "center",
    paddingVertical: 20,
  },
  appVersion: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 4,
  },
  appCopyright: {
    fontSize: 12,
    color: "#4b5563",
  },
  debugButton: {
    marginTop: 20,
    borderRadius: 14,
    overflow: "hidden",
  },
  debugButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 14,
  },
  debugButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
});



