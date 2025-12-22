import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";

// Brezplačne kartice - dostopne vsem
const FREE_LOYALTY_CARDS = [
  {
    id: "spar",
    name: "Spar Plus",
    store: "Spar",
    color: "#22c55e",
    icon: "card",
    benefits: ["Zbiranje točk", "Ekskluzivni popusti", "Personalizirane ponudbe"],
  },
  {
    id: "mercator",
    name: "Pika kartica",
    store: "Mercator",
    color: "#3b82f6",
    icon: "card",
    benefits: ["Zbiranje pik", "Popusti do 25%", "Posebne akcije"],
  },
  {
    id: "tus",
    name: "Tus Klub",
    store: "Tus",
    color: "#eab308",
    icon: "card",
    benefits: ["Zbiranje točk", "Družinski popusti", "Rojstnodnevni bon"],
  },
];

// Premium kartice - samo za Premium uporabnike
const PREMIUM_LOYALTY_CARDS = [
  {
    id: "jager",
    name: "Jager kartica",
    store: "Jager",
    color: "#a855f7",
    icon: "card",
    benefits: ["Ekskluzivni popusti", "Posebne ponudbe", "Zbiranje točk"],
    isPremium: true,
  },
  {
    id: "lidl",
    name: "Lidl Plus",
    store: "Lidl",
    color: "#f97316",
    icon: "card",
    benefits: ["Digitalni kuponi", "Tedenske ponudbe", "Posebni popusti"],
    isPremium: true,
  },
];

export default function LoyaltyCardsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(
    api.userProfiles.getProfile,
    isAuthenticated ? {} : "skip"
  );
  const isPremium = profile?.isPremium ?? false;

  const [cards, setCards] = useState<Record<string, string>>({});
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  const handleSaveCard = (cardId: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setCards((prev) => ({ ...prev, [cardId]: inputValue }));
    setEditingCard(null);
    setInputValue("");
  };

  const handleRemoveCard = (cardId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setCards((prev) => {
      const newCards = { ...prev };
      delete newCards[cardId];
      return newCards;
    });
  };

  const handleEditCard = (cardId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setEditingCard(cardId);
    setInputValue(cards[cardId] || "");
  };

  const renderCard = (card: typeof FREE_LOYALTY_CARDS[0] & { isPremium?: boolean }) => (
    <View key={card.id} style={styles.cardContainer}>
      <LinearGradient
        colors={[`${card.color}20`, `${card.color}10`]}
        style={styles.cardGradient}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <View style={[styles.cardIcon, { backgroundColor: `${card.color}30` }]}>
              <Ionicons name={card.icon as keyof typeof Ionicons.glyphMap} size={24} color={card.color} />
            </View>
            <View>
              <View style={styles.cardNameRow}>
                <Text style={styles.cardName}>{card.name}</Text>
                {card.isPremium && (
                  <View style={styles.premiumTag}>
                    <Ionicons name="star" size={10} color="#fbbf24" />
                    <Text style={styles.premiumTagText}>PREMIUM</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardStore}>{card.store}</Text>
            </View>
          </View>
          {cards[card.id] ? (
            <View style={styles.cardStatus}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.cardStatusText}>Povezano</Text>
            </View>
          ) : (
            <View style={styles.cardStatus}>
              <Ionicons name="add-circle-outline" size={20} color="#6b7280" />
              <Text style={styles.cardStatusTextInactive}>Dodaj</Text>
            </View>
          )}
        </View>

        {/* Benefits */}
        <View style={styles.benefitsList}>
          {card.benefits.map((benefit, index) => (
            <View key={index} style={styles.benefitItem}>
              <Ionicons name="checkmark" size={14} color={card.color} />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>

        {/* Card Number Input/Display */}
        {editingCard === card.id ? (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Vnesi številko kartice"
              placeholderTextColor="#6b7280"
              value={inputValue}
              onChangeText={setInputValue}
              keyboardType="number-pad"
              autoFocus
            />
            <View style={styles.inputButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setEditingCard(null);
                  setInputValue("");
                }}
              >
                <Text style={styles.cancelButtonText}>Prekliči</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => handleSaveCard(card.id)}
              >
                <LinearGradient
                  colors={[card.color, card.color]}
                  style={styles.saveButtonGradient}
                >
                  <Text style={styles.saveButtonText}>Shrani</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        ) : cards[card.id] ? (
          <View style={styles.savedCard}>
            <View style={styles.savedCardNumber}>
              <Ionicons name="barcode-outline" size={18} color="#9ca3af" />
              <Text style={styles.savedCardText}>
                •••• •••• •••• {cards[card.id].slice(-4)}
              </Text>
            </View>
            <View style={styles.savedCardActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => handleEditCard(card.id)}
              >
                <Ionicons name="pencil" size={16} color="#a78bfa" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveCard(card.id)}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleEditCard(card.id)}
          >
            <Ionicons name="add" size={18} color={card.color} />
            <Text style={[styles.addButtonText, { color: card.color }]}>
              Dodaj kartico
            </Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );

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
          <Text style={styles.headerTitle}>Lojalnostne kartice</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Info Card */}
          <View style={styles.infoCard}>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.15)", "rgba(59, 7, 100, 0.2)"]}
              style={styles.infoGradient}
            >
              <Ionicons name="card" size={24} color="#a78bfa" />
              <Text style={styles.infoText}>
                Dodaj svoje lojalnostne kartice za avtomatsko upoštevanje popustov pri izračunu cen.
              </Text>
            </LinearGradient>
          </View>

          {/* Free Cards Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Brezplačne kartice</Text>
              <View style={styles.freeBadge}>
                <Ionicons name="gift-outline" size={14} color="#10b981" />
                <Text style={styles.freeBadgeText}>ZASTONJ</Text>
              </View>
            </View>

            {FREE_LOYALTY_CARDS.map(renderCard)}
          </View>

          {/* Premium Cards Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Premium kartice</Text>
              <View style={styles.premiumBadge}>
                <Ionicons name="star" size={14} color="#fbbf24" />
                <Text style={styles.premiumBadgeText}>PREMIUM</Text>
              </View>
            </View>

            {isPremium ? (
              PREMIUM_LOYALTY_CARDS.map(renderCard)
            ) : (
              <View style={styles.premiumLockedContainer}>
                <LinearGradient
                  colors={["rgba(251, 191, 36, 0.1)", "rgba(245, 158, 11, 0.05)"]}
                  style={styles.premiumLockedGradient}
                >
                  <View style={styles.premiumLockedIcon}>
                    <Ionicons name="lock-closed" size={32} color="#fbbf24" />
                  </View>
                  <Text style={styles.premiumLockedTitle}>
                    Odkleni Premium kartice
                  </Text>
                  <Text style={styles.premiumLockedText}>
                    Z nadgradnjo na Premium dobiš dostop do kartic Jager in Lidl Plus ter ekskluzivnih popustov.
                  </Text>
                  
                  {/* Preview of locked cards */}
                  <View style={styles.lockedCardsPreview}>
                    {PREMIUM_LOYALTY_CARDS.map((card) => (
                      <View key={card.id} style={styles.lockedCardPreview}>
                        <View style={[styles.lockedCardIcon, { backgroundColor: `${card.color}30` }]}>
                          <Ionicons name="card" size={20} color={card.color} />
                        </View>
                        <Text style={styles.lockedCardName}>{card.name}</Text>
                        <Ionicons name="lock-closed" size={14} color="#6b7280" />
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.premiumButton}
                    onPress={() => router.push("/premium")}
                  >
                    <LinearGradient
                      colors={["#fbbf24", "#f59e0b"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.premiumButtonGradient}
                    >
                      <Ionicons name="star" size={18} color="#000" />
                      <Text style={styles.premiumButtonText}>
                        Nadgradi na Premium - 1,99 €/mesec
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            )}
          </View>

          {/* Privacy Note */}
          <View style={styles.noteContainer}>
            <Ionicons name="shield-checkmark" size={18} color="#10b981" />
            <Text style={styles.noteText}>
              Tvoji podatki so varno shranjeni in šifrirani. Številke kartic uporabljamo samo za izračun popustov in jih ne delimo s tretjimi osebami.
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  freeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  freeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10b981",
    letterSpacing: 0.5,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fbbf24",
    letterSpacing: 0.5,
  },
  cardContainer: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: "hidden",
  },
  cardGradient: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  premiumTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    borderRadius: 6,
  },
  premiumTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fbbf24",
  },
  cardStore: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 2,
  },
  cardStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardStatusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10b981",
  },
  cardStatusTextInactive: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  benefitsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  benefitText: {
    fontSize: 11,
    color: "#d1d5db",
  },
  inputContainer: {
    marginTop: 4,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#fff",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    marginBottom: 12,
  },
  inputButtons: {
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
  },
  saveButton: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  saveButtonGradient: {
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  savedCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 12,
  },
  savedCardNumber: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  savedCardText: {
    fontSize: 14,
    color: "#d1d5db",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  savedCardActions: {
    flexDirection: "row",
    gap: 12,
  },
  editButton: {
    padding: 8,
  },
  removeButton: {
    padding: 8,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderStyle: "dashed",
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  premiumLockedContainer: {
    borderRadius: 20,
    overflow: "hidden",
  },
  premiumLockedGradient: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
    alignItems: "center",
  },
  premiumLockedIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  premiumLockedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  premiumLockedText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  lockedCardsPreview: {
    width: "100%",
    gap: 10,
    marginBottom: 20,
  },
  lockedCardPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  lockedCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedCardName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
  },
  premiumButton: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
  },
  premiumButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  premiumButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
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
