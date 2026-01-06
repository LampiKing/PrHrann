import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import FloatingBackground from "@/lib/FloatingBackground";

export default function NotificationsScreen() {
  const router = useRouter();
  const [priceDrops, setPriceDrops] = useState(true);
  const [newCoupons, setNewCoupons] = useState(true);
  const [weeklyDeals, setWeeklyDeals] = useState(false);
  const [cartReminders, setCartReminders] = useState(true);

  const handleToggle = (setter: (value: boolean) => void, value: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setter(!value);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
      />
      <FloatingBackground variant="sparse" />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Obvestila</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoCard}>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.15)", "rgba(59, 7, 100, 0.2)"]}
              style={styles.infoGradient}
            >
              <Ionicons name="notifications" size={24} color="#a78bfa" />
              <Text style={styles.infoText}>
                Nastavi obvestila, da ne zamudis najboljsih ponudb in prihrankov.
              </Text>
            </LinearGradient>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vrste obvestil</Text>

            <View style={styles.settingsList}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                    <Ionicons name="trending-down" size={20} color="#10b981" />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Padci cen</Text>
                    <Text style={styles.settingDescription}>
                      Ko pade cena izdelka na tvojem seznamu
                    </Text>
                  </View>
                </View>
                <Switch
                  value={priceDrops}
                  onValueChange={() => handleToggle(setPriceDrops, priceDrops)}
                  trackColor={{ false: "#374151", true: "#8b5cf6" }}
                  thumbColor={priceDrops ? "#fff" : "#9ca3af"}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: "rgba(251, 191, 36, 0.15)" }]}>
                    <Ionicons name="pricetag" size={20} color="#fbbf24" />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Novi kuponi</Text>
                    <Text style={styles.settingDescription}>
                      Ko so na voljo novi popusti in kuponi
                    </Text>
                  </View>
                </View>
                <Switch
                  value={newCoupons}
                  onValueChange={() => handleToggle(setNewCoupons, newCoupons)}
                  trackColor={{ false: "#374151", true: "#8b5cf6" }}
                  thumbColor={newCoupons ? "#fff" : "#9ca3af"}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
                    <Ionicons name="calendar" size={20} color="#3b82f6" />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Tedenske ponudbe</Text>
                    <Text style={styles.settingDescription}>
                      Povzetek najboljsih tedenskih akcij
                    </Text>
                  </View>
                </View>
                <Switch
                  value={weeklyDeals}
                  onValueChange={() => handleToggle(setWeeklyDeals, weeklyDeals)}
                  trackColor={{ false: "#374151", true: "#8b5cf6" }}
                  thumbColor={weeklyDeals ? "#fff" : "#9ca3af"}
                />
              </View>

              <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                    <Ionicons name="cart" size={20} color="#ef4444" />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Opomniki košarice</Text>
                    <Text style={styles.settingDescription}>
                      Opomnik, če imaš izdelke v košarici
                    </Text>
                  </View>
                </View>
                <Switch
                  value={cartReminders}
                  onValueChange={() => handleToggle(setCartReminders, cartReminders)}
                  trackColor={{ false: "#374151", true: "#8b5cf6" }}
                  thumbColor={cartReminders ? "#fff" : "#9ca3af"}
                />
              </View>
            </View>
          </View>

          <View style={styles.noteContainer}>
            <Ionicons name="information-circle" size={18} color="#6b7280" />
            <Text style={styles.noteText}>
              Obvestila lahko kadarkoli izklopis. Tvoji podatki so varni in jih ne delimo s tretjimi osebami.
            </Text>
          </View>

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
  infoCard: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: "hidden",
  },
  infoGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#d1d5db",
    lineHeight: 20,
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
  settingsList: {
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: 16,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.1)",
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: "#9ca3af",
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 4,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 18,
  },
});
