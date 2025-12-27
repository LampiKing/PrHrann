import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import Svg, { Rect } from "react-native-svg";
import { createShadow } from "@/lib/shadow-helper";
import Logo from "@/lib/Logo";

// Brezplačne kartice - dostopne vsem
const FREE_LOYALTY_CARDS = [
  {
    id: "spar",
    name: "Spar Plus",
    store: "Spar",
    color: "#c8102e",
    icon: "card",
    description: "Priljubljena kartica za zbiranje točk in popuste",
    perks: "Tedenske akcije in kuponi",
  },
  {
    id: "mercator",
    name: "Pika kartica",
    store: "Mercator",
    color: "#d3003c",
    icon: "card",
    description: "Zbiraj pike in prihrani pri vsakem nakupu",
    perks: "Pika popusti in točke",
  },
  {
    id: "tus",
    name: "Tuš Klub",
    store: "Tuš",
    color: "#0d8a3c",
    icon: "card",
    description: "Družinske ugodnosti in posebni popusti",
    perks: "Klubski kuponi in bonusi",
  },
];

// Premium kartice - samo za Premium uporabnike
const PREMIUM_LOYALTY_CARDS = [
  {
    id: "hofer",
    name: "Hofer kartica",
    store: "Hofer",
    color: "#0b3d7a",
    icon: "card",
    description: "Ekskluzivni popusti in tedenske akcije",
    perks: "Digitalni kuponi in akcije",
    isPremium: true,
  },
  {
    id: "lidl",
    name: "Lidl Plus",
    store: "Lidl",
    color: "#0047ba",
    icon: "card",
    description: "Digitalni kuponi in posebne ponudbe",
    perks: "Kuponi in tedenske ponudbe",
    isPremium: true,
  },
  {
    id: "jager",
    name: "Jager Klub",
    store: "Jager",
    color: "#1f8a3c",
    icon: "leaf",
    description: "Točke zvestobe in klub popusti",
    perks: "Klubski popusti in točke",
    isPremium: true,
  },
];

// Generate barcode pattern from card number
const generateBarcodePattern = (number: string): number[] => {
  const pattern: number[] = [];
  // Ensure card number has at least 12-13 digits for proper barcode
  const paddedNumber = number.padStart(13, '0');
  const seed = paddedNumber.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  // Generate more bars for a fuller barcode
  for (let i = 0; i < 60; i++) {
    pattern.push(((seed * (i + 1)) % 4) + 2);
  }
  return pattern;
};

// Simple Barcode Component
const BarcodeDisplay = ({ number }: { number: string; color: string }) => {
  const pattern = generateBarcodePattern(number);
  const BAR_WIDTH = 260;
  // Use full number, padded to 13 digits for EAN-13 format
  const displayNumber = number.padStart(13, '0');
  const totalWidth = pattern.reduce((acc, width) => acc + width + 1, -1); // subtract last spacer
  const startX = Math.max((BAR_WIDTH - totalWidth) / 2, 0);
  let x = startX;
  
  return (
    <View style={barcodeStyles.container}>
      <Svg height="100" width={BAR_WIDTH}>
        {pattern.map((width, index) => {
          const barX = x;
          x += width + 1;
          return (
            <Rect
              key={index}
              x={barX}
              y="0"
              width={width}
              height="100"
              fill={index % 2 === 0 ? "#000" : "#fff"}
            />
          );
        })}
      </Svg>
      <Text style={[barcodeStyles.number, { color: "#000" }]}>{displayNumber}</Text>
    </View>
  );
};

const barcodeStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 18,
    width: "100%",
  },
  number: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

export default function LoyaltyCardsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(
    api.userProfiles.getProfile,
    isAuthenticated ? {} : "skip"
  );
  const isPremium = profile?.isPremium ?? false;

  const [cards, setCards] = useState<Record<string, { number: string; label?: string }[]>>({});
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [showBarcodeModal, setShowBarcodeModal] = useState<
    { cardId: string; number: string } | null
  >(null);

  // Get card data for modal
  const activeCard = showBarcodeModal 
    ? [...FREE_LOYALTY_CARDS, ...PREMIUM_LOYALTY_CARDS].find(c => c.id === showBarcodeModal.cardId)
    : null;
  const activeNumber = showBarcodeModal?.number;

  const handleSaveCard = (cardId: string) => {
    // Validacija - kartica mora imeti vsaj 8 številk
    if (inputValue.length < 8) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      alert("Številka kartice mora imeti vsaj 8 številk!");
      return;
    }
    
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setCards((prev) => {
      const existing = prev[cardId] ?? [];
      const entry = labelInput.trim().length
        ? { number: inputValue, label: labelInput.trim() }
        : { number: inputValue };
      return { ...prev, [cardId]: [...existing, entry] };
    });
    setEditingCard(null);
    setInputValue("");
    setLabelInput("");
  };

  const handleRemoveCardNumber = (cardId: string, number: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setCards((prev) => {
      const remaining = (prev[cardId] ?? []).filter((n) => n.number !== number);
      if (!remaining.length) {
        const copy = { ...prev };
        delete copy[cardId];
        return copy;
      }
      return { ...prev, [cardId]: remaining };
    });
  };

  const handleEditCard = (cardId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setEditingCard(cardId);
    setInputValue(cards[cardId]?.[0]?.number || "");
  };

  const handleShowBarcode = (cardId: string, number: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowBarcodeModal({ cardId, number });
  };

  const renderCard = (card: typeof FREE_LOYALTY_CARDS[0] & { isPremium?: boolean }) => {
    return (
      <View key={card.id} style={styles.cardContainer}>
        <LinearGradient
          colors={["#151225", "#0d0b18"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <View style={[styles.brandStrip, { backgroundColor: card.color }]} />
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <View style={styles.cardLeft}>
              <View style={[styles.cardIconWrapper, { backgroundColor: "rgba(255,255,255,0.06)", borderColor: `${card.color}40` }]}> 
                <Ionicons name="card" size={22} color={card.color} />
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.cardNameRow}>
                  <Text style={styles.cardName}>{card.name}</Text>
                  {card.isPremium && (
                    <View style={styles.premiumTag}>
                      <Ionicons name="star" size={10} color="#fbbf24" />
                      <Text style={styles.premiumTagText}>PREMIUM</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardDescription}>{card.description}</Text>
                <View style={[styles.cardMetaRow, { borderColor: `${card.color}30`, backgroundColor: `${card.color}12` }]}>
                  <Ionicons name="pricetag-outline" size={14} color={card.color} />
                  <Text style={styles.cardMetaText}>Popusti: {card.perks}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Card Status Badge */}
          {cards[card.id]?.length ? (
            <View style={[styles.statusBadge, { backgroundColor: `${card.color}20`, borderColor: `${card.color}40` }]}> 
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.statusBadgeText}>Kartic: {cards[card.id].length}</Text>
            </View>
          ) : null}

          {/* Card Input or Saved State */}
          {editingCard === card.id ? (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Številka kartice (min. 8 številk)</Text>
              <TextInput
                style={[styles.input, { borderColor: `${card.color}70`, backgroundColor: `${card.color}12` }]}
                placeholder={`Vnesi številke kartice ${card.name}...`}
                placeholderTextColor="#cbd5e1"
                value={inputValue}
                onChangeText={setInputValue}
                keyboardType="number-pad"
                maxLength={20}
                autoFocus
              />
              <TextInput
                style={[styles.input, styles.inputSmall, { borderColor: `${card.color}40`, backgroundColor: `${card.color}08` }]}
                placeholder="Oznaka (npr. kartica od brata) - neobvezno"
                placeholderTextColor="#cbd5e1"
                value={labelInput}
                onChangeText={setLabelInput}
              />
              <View style={styles.inputButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setEditingCard(null);
                    setInputValue("");
                    setLabelInput("");
                  }}
                >
                  <Text style={styles.cancelButtonText}>Prekliči</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: card.color }]}
                  onPress={() => handleSaveCard(card.id)}
                >
                  <Text style={styles.saveButtonText}>Shrani</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : cards[card.id]?.length ? (
            <View style={styles.savedCardSection}>
              <Text style={styles.savedLabel}>Dodane kartice</Text>
              {cards[card.id].map((entry) => (
                <View
                  key={`${entry.number}-${entry.label ?? ""}`}
                  style={[styles.cardNumberDisplay, { backgroundColor: `${card.color}10`, borderColor: `${card.color}30` }]}
                >
                  <View style={styles.cardNumberLeft}>
                    <Ionicons name="card-outline" size={20} color={card.color} />
                    <View>
                      <Text style={styles.cardNumberText}>
                        •••• •••• •••• {entry.number.slice(-4)}
                      </Text>
                      {entry.label ? (
                        <Text style={styles.cardNumberLabel}>{entry.label}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleShowBarcode(card.id, entry.number)}
                    >
                      <Ionicons name="card" size={16} color="#10b981" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleRemoveCardNumber(card.id, entry.number)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.addButton, { borderColor: `${card.color}50` }]}
                onPress={() => handleEditCard(card.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={22} color={card.color} />
                <Text style={[styles.addButtonText, { color: card.color }]}> 
                  Dodaj še eno kartico
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addButton, { borderColor: `${card.color}50` }]}
              onPress={() => handleEditCard(card.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={22} color={card.color} />
              <Text style={[styles.addButtonText, { color: card.color }]}> 
                Dodaj kartico
              </Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </View>
    );
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
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <LinearGradient
            colors={["#19122f", "#120d25", "#0c0b17"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroGlowPrimary} />
            <View style={styles.heroGlowSecondary} />
            <View style={styles.heroContent}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>Kartice zvestobe</Text>
                <Text style={styles.heroSubtitle}>Vse kartice na enem mestu, pripravljene za popuste.</Text>
              </View>
              <View style={styles.heroLogoWrap}>
                <View style={styles.heroLogoHalo} />
                <Logo size={110} pulse={false} />
              </View>
            </View>
          </LinearGradient>

          {/* All Cards */}
          <View style={styles.section}>
            {/* Always show free cards */}
            {FREE_LOYALTY_CARDS.map(renderCard)}

            {/* Premium cards: show real cards if premium, otherwise gentle unlock callout */}
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
                  <Text style={styles.premiumLockedTitle}>Odkleni Hofer, Lidl, Jager</Text>
                  <Text style={styles.premiumLockedText}>
                    Nadgradi na Premium (1,99€/mesec) in dodaj kartice Hofer, Lidl Plus in Jager klub.
                  </Text>

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
                      <Text style={styles.premiumButtonText}>Nadgradi na Premium - 1,99€/mesec</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Barcode Modal */}
      <Modal
        transparent
        visible={!!showBarcodeModal}
        onRequestClose={() => setShowBarcodeModal(null)}
        animationType="fade"
        hardwareAccelerated
      >
        <View style={styles.barcodeModalOverlay}>
          <View style={styles.barcodeModal}>
            {activeCard && activeNumber && (
              <>
                <LinearGradient
                  colors={[activeCard.color, `${activeCard.color}cc`]}
                  style={styles.barcodeModalHeader}
                >
                  <View style={styles.barcodeModalIconWrapper}>
                    <View style={[styles.barcodeModalIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                      <Ionicons name="card" size={24} color="#fff" />
                    </View>
                    <View>
                      <Text style={styles.barcodeModalTitle}>{activeCard.name}</Text>
                      <Text style={styles.barcodeModalStore}>{activeCard.store}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setShowBarcodeModal(null)}
                  >
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </LinearGradient>

                <View style={styles.barcodeModalContent}>
                  <View style={styles.barcodeInstructionBox}>
                    <Ionicons name="scan-outline" size={20} color="#a78bfa" />
                    <Text style={styles.barcodeModalHint}>
                      Črtna koda pripravljena
                    </Text>
                  </View>
                  
                  <View style={styles.barcodeWrapper}>
                    <BarcodeDisplay 
                      number={activeNumber} 
                      color={activeCard.color}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.barcodeCloseBtn, { backgroundColor: activeCard.color }]}
                    onPress={() => setShowBarcodeModal(null)}
                  >
                    <Text style={styles.barcodeCloseBtnText}>Zapri</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  hero: {
    position: "relative",
    borderRadius: 24,
    padding: 20,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  heroGlowPrimary: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 120,
    backgroundColor: "rgba(168, 85, 247, 0.18)",
    top: -40,
    right: -60,
    transform: [{ rotate: "12deg" }],
  },
  heroGlowSecondary: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 100,
    backgroundColor: "rgba(251, 191, 36, 0.16)",
    bottom: -60,
    left: -40,
    transform: [{ rotate: "-18deg" }],
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "#d7d9e8",
    lineHeight: 20,
    marginTop: 4,
  },
  heroPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(168, 85, 247, 0.14)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
  },
  heroPillAlt: {
    backgroundColor: "rgba(14, 165, 233, 0.12)",
    borderColor: "rgba(14, 165, 233, 0.45)",
  },
  heroPillText: {
    color: "#dcd7ff",
    fontWeight: "700",
    fontSize: 12,
  },
  heroPillTextAlt: {
    color: "#bae6fd",
    fontWeight: "700",
    fontSize: 12,
  },
  heroLogoWrap: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLogoHalo: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 90,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    transform: [{ scale: 1.02 }],
  },
  section: {
    marginBottom: 24,
    gap: 18,
    paddingHorizontal: 0,
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
  cardContainer: {
    width: "100%",
    marginBottom: 0,
    borderRadius: 20,
    overflow: "hidden",
  },
  cardGradient: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  brandStrip: {
    height: 6,
    width: "100%",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardLeft: {
    alignItems: "flex-start",
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
  cardMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardMetaText: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "600",
  },
  cardName: {
    fontSize: 18,
    fontWeight: "800",
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
  cardIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    ...createShadow("#000", 0, 2, 0.3, 4, 4),
  },
  cardInfo: {
    flex: 1,
  },
  cardDescription: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
    lineHeight: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "center",
    marginTop: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10b981",
  },
  couponsSection: {
    marginTop: 24,
    paddingHorizontal: 0,
  },
  couponsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    marginLeft: 0,
  },
  couponsSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  couponsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  couponCard: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    padding: 14,
    alignItems: "flex-start",
  },
  couponBadge: {
    backgroundColor: "#10b981",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  couponBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  couponCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  couponCardStore: {
    fontSize: 11,
    color: "#6ee7b7",
  },
  couponsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  couponChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  couponDiscount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10b981",
  },
  couponName: {
    fontSize: 11,
    color: "#d1d5db",
    maxWidth: 100,
  },
  inputContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    gap: 10,
  },
  inputLabel: {
    fontSize: 14,
    color: "#e5e7eb",
    marginBottom: 2,
    fontWeight: "700",
    textAlign: "left",
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  savedCardSection: {
    marginTop: 12,
    gap: 12,
  },
  savedLabel: {
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  cardNumberDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  cardNumberLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardNumberText: {
    fontSize: 15,
    color: "#fff",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 1,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  inputButtons: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  inputSmall: {
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 12,
  },
  cardNumberLabel: {
    fontSize: 12,
    color: "#cbd5e1",
    marginTop: 2,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9ca3af",
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    paddingHorizontal: 0,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    width: "100%",
    lineHeight: 18,
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
    width: "100%",
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
    gap: 12,
    paddingHorizontal: 4,
    backgroundColor: "rgba(16, 185, 129, 0.05)",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.1)",
  },
  noteIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 18,
  },
  infoIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  infoContent: {
    alignItems: "center",
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
    textAlign: "center",
  },
  showBarcodeBtn: {
    borderRadius: 14,
    overflow: "hidden",
    ...createShadow("#8b5cf6", 0, 4, 0.3, 8, 4),
  },
  showBarcodeBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  showBarcodeBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  // Barcode Modal Styles
  barcodeModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  barcodeModal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#1a1a2e",
    borderRadius: 28,
    overflow: "hidden",
  },
  barcodeModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  barcodeModalIconWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  barcodeModalIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  barcodeModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  barcodeModalStore: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
  },
  barcodeModalContent: {
    padding: 24,
    alignItems: "center",
  },
  barcodeInstructionBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: "100%",
  },
  barcodeModalHint: {
    flex: 1,
    fontSize: 13,
    color: "#a78bfa",
    lineHeight: 18,
  },
  barcodeWrapper: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 20,
    ...createShadow("#000", 0, 4, 0.25, 8, 8),
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  modalCouponsSection: {
    width: "100%",
    backgroundColor: "rgba(16, 185, 129, 0.05)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  modalCouponsTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  modalCouponItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(16, 185, 129, 0.1)",
  },
  modalCouponDiscount: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  modalCouponDiscountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10b981",
  },
  modalCouponName: {
    flex: 1,
    fontSize: 13,
    color: "#d1d5db",
  },
  barcodeCloseBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  barcodeCloseBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
