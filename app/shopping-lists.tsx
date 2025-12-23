import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Animated,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export default function ShoppingListsScreen() {
  const router = useRouter();
  const lists = useQuery(api.shoppingLists.getLists);
  const createList = useMutation(api.shoppingLists.createList);
  const deleteList = useMutation(api.shoppingLists.deleteList);
  
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("🛒");
  const [creating, setCreating] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const ICONS = ["🛒", "🛍️", "🎉", "🍕", "🏠", "💼", "🎁", "🌟"];

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setCreating(true);
    try {
      await createList({
        name: newListName,
        icon: selectedIcon,
      });

      setNewListName("");
      setSelectedIcon("🛒");
      setShowNewListModal(false);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Create list error:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteList = async (listId: Id<"shoppingLists">) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    try {
      await deleteList({ listId });
    } catch (error) {
      console.error("Delete list error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0f0a1e", "#1a0a2e", "#270a3a"]}
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
          <Text style={styles.headerTitle}>Seznami</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowNewListModal(true)}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Lists */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!lists ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8b5cf6" />
            </View>
          ) : lists.length === 0 ? (
            <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
              <View style={styles.emptyIcon}>
                <Ionicons name="list" size={64} color="#6b7280" />
              </View>
              <Text style={styles.emptyTitle}>Še ni seznamov</Text>
              <Text style={styles.emptyText}>
                Ustvari svoj prvi nakupovalni seznam in začni varčevati!
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowNewListModal(true)}
              >
                <LinearGradient
                  colors={["#8b5cf6", "#7c3aed"]}
                  style={styles.emptyButtonGradient}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                  <Text style={styles.emptyButtonText}>Ustvari seznam</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              {lists.map((list, index) => (
                <TouchableOpacity
                  key={list._id}
                  style={styles.listCard}
                  onPress={() => {
                    // TODO: Navigate to list detail screen when implemented
                    console.log('Navigate to list:', list._id);
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      list.isShared
                        ? ["rgba(251, 191, 36, 0.15)", "rgba(245, 158, 11, 0.05)"]
                        : ["rgba(139, 92, 246, 0.15)", "rgba(124, 58, 237, 0.05)"]
                    }
                    style={styles.listCardGradient}
                  >
                    <View style={styles.listHeader}>
                      <View style={styles.listIconContainer}>
                        <Text style={styles.listIcon}>{list.icon || "🛒"}</Text>
                      </View>
                      <View style={styles.listInfo}>
                        <Text style={styles.listName}>{list.name}</Text>
                        <View style={styles.listMeta}>
                          <Ionicons name="basket" size={14} color="#9ca3af" />
                          <Text style={styles.listMetaText}>
                            {list.totalItems} izdelkov
                          </Text>
                          {list.checkedItems > 0 && (
                            <>
                              <Text style={styles.listMetaSeparator}>•</Text>
                              <Ionicons
                                name="checkmark-circle"
                                size={14}
                                color="#10b981"
                              />
                              <Text style={[styles.listMetaText, { color: "#10b981" }]}>
                                {list.checkedItems} kupl.
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                      <View style={styles.listActions}>
                        {list.isShared && !list.isOwner && (
                          <View style={styles.sharedBadge}>
                            <Ionicons name="people" size={12} color="#fbbf24" />
                            <Text style={styles.sharedBadgeText}>Deljeno</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            if (list.isOwner) {
                              handleDeleteList(list._id);
                            }
                          }}
                          style={styles.deleteButton}
                        >
                          <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                      </View>
                    </View>

                    {/* Progress bar */}
                    {list.totalItems > 0 && (
                      <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${(list.checkedItems / list.totalItems) * 100}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}
        </ScrollView>

        {/* Floating Add Button */}
        {lists && lists.length > 0 && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setShowNewListModal(true)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#8b5cf6", "#7c3aed", "#6d28d9"]}
              style={styles.fabGradient}
            >
              <Ionicons name="add" size={32} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* New List Modal */}
      <Modal
        visible={showNewListModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewListModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nov seznam</Text>
              <TouchableOpacity
                onPress={() => setShowNewListModal(false)}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Ime seznama</Text>
              <TextInput
                style={styles.input}
                placeholder="npr. Tedenski nakup"
                placeholderTextColor="#6b7280"
                value={newListName}
                onChangeText={setNewListName}
                autoFocus
              />

              <Text style={styles.inputLabel}>Ikona</Text>
              <View style={styles.iconGrid}>
                {ICONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconButton,
                      selectedIcon === icon && styles.iconButtonSelected,
                    ]}
                    onPress={() => {
                      setSelectedIcon(icon);
                      if (Platform.OS !== "web") {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                  >
                    <Text style={styles.iconButtonText}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.createButton,
                  (!newListName.trim() || creating) && styles.createButtonDisabled,
                ]}
                onPress={handleCreateList}
                disabled={!newListName.trim() || creating}
              >
                <LinearGradient
                  colors={["#8b5cf6", "#7c3aed", "#6d28d9"]}
                  style={styles.createButtonGradient}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.createButtonText}>Ustvari</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(139, 92, 246, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 100,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 40,
    marginBottom: 32,
  },
  emptyButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  emptyButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 16,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  listCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: "hidden",
  },
  listCardGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    borderRadius: 20,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  listIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  listIcon: {
    fontSize: 28,
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
  },
  listMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  listMetaText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  listMetaSeparator: {
    fontSize: 13,
    color: "#6b7280",
    marginHorizontal: 2,
  },
  listActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sharedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fbbf24",
  },
  deleteButton: {
    padding: 4,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 3,
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1a0a2e",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.1)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  modalClose: {
    padding: 4,
  },
  modalBody: {
    padding: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#fff",
    marginBottom: 24,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 32,
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderWidth: 2,
    borderColor: "rgba(139, 92, 246, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonSelected: {
    backgroundColor: "rgba(139, 92, 246, 0.3)",
    borderColor: "#8b5cf6",
  },
  iconButtonText: {
    fontSize: 28,
  },
  createButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
