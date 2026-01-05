import { useState, useRef, useEffect } from "react";
import React from "react";
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
  Image,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { PLAN_FREE, PLAN_PLUS, PLAN_FAMILY } from "@/lib/branding";
import { authClient } from "@/lib/auth-client";
import { createShadow } from "@/lib/shadow-helper";
import { useConvexAuth } from "convex/react";
import { getSeasonalLogoSource } from "@/lib/Logo";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import BADGE_TOP_100 from "@/assets/images/Top 100 badge 2026.png";
import BADGE_TOP_10 from "@/assets/images/Top 10 badge 2026.png";
import BADGE_GOLD from "@/assets/images/Zlati badge 2026.png";
import BADGE_SILVER from "@/assets/images/Srebrni badge 2026.png";
import BADGE_BRONZE from "@/assets/images/Bronasti badge 2026.png";

type AwardEntry = {
  year: number;
  award: string;
  rank: number;
  leaderboard: "standard" | "family";
};

class ProfileErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; retryCount: number }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Profile screen render error:", error);
    if (this.state.retryCount < 2) {
      setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          retryCount: prev.retryCount + 1,
        }));
      }, 800);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.authPrompt, { paddingTop: 60 }]}>
            <Text style={styles.authTitle}>Nalaganje profila</Text>
            <Text style={styles.authText}>Samo trenutek...</Text>
            <ActivityIndicator size="large" color="#8b5cf6" style={{ marginTop: 16 }} />
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

function ProfileScreenInner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCancelSuccessModal, setShowCancelSuccessModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showSignOutToast] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [receiptSuccess, setReceiptSuccess] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [familyInviteEmail, setFamilyInviteEmail] = useState("");
  const [familyInviting, setFamilyInviting] = useState(false);
  const [familyError, setFamilyError] = useState("");
  const [familySuccess, setFamilySuccess] = useState("");
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [profilePictureOverride, setProfilePictureOverride] = useState<string | null>(null);
  const [showAdminUsersModal, setShowAdminUsersModal] = useState(false);
  const [adminUserType, setAdminUserType] = useState<"registered" | "active" | "guests" | null>(null);
  const [showAISuggestionsModal, setShowAISuggestionsModal] = useState(false);
  const [showUserSuggestionsModal, setShowUserSuggestionsModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"feature" | "improvement" | "bug" | "store" | "product" | "other">("feature");
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  // TODO: Uncomment when modals are implemented
  // const [showScraperStatsModal, setShowScraperStatsModal] = useState(false);
  // const [showUserSuggestionsModal, setShowUserSuggestionsModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const profile = useQuery(
    api.userProfiles.getProfile,
    isAuthenticated ? {} : "skip"
  ) ?? null;
  const adminStats = useQuery(
    api.admin.getStats,
    isAuthenticated && profile?.isAdmin ? {} : "skip"
  );
  const detailedAdminStats = useQuery(
    api.admin.getDetailedStats,
    isAuthenticated && profile?.isAdmin ? {} : "skip"
  );
  const adminUsers = useQuery(
    api.admin.getAllUsers,
    isAuthenticated && profile?.isAdmin && adminUserType
      ? { type: adminUserType, limit: 50 }
      : "skip"
  );
  // TODO: Uncomment when convex schema is regenerated
  // const aiSuggestions = useQuery(
  //   api.searchAnalytics.generateAISuggestions,
  //   isAuthenticated && profile?.isAdmin ? {} : "skip"
  // );
  // Placeholder until schema regenerated - will be empty array for now
  const aiSuggestions: Array<{
    type: string;
    priority: string;
    searchQuery: string;
    suggestion: string;
    metrics: {
      searchCount: number;
      averageResults: number;
      clickRate: number;
    };
  }> = [];

  const receipts = useQuery(
    api.receipts.getReceipts,
    isAuthenticated ? { limit: 20 } : "skip"
  );
  const awards = useQuery(
    api.awards.getMyAwards,
    isAuthenticated ? {} : "skip"
  );
  const familyMembers = useQuery(
    api.familyPlan.getFamilyMembers,
    isAuthenticated && profile?.premiumType === "family" ? {} : "skip"
  );
  const pendingInvites = useQuery(
    api.familyPlan.getPendingInvitations,
    isAuthenticated && profile?.premiumType === "family" ? {} : "skip"
  );

  const profileRef = useRef<typeof profile | null>(null);
  useEffect(() => {
    if (profile) {
      profileRef.current = profile;
    }
  }, [profile]);
  const resolvedProfile = profile ?? profileRef.current ?? null;
  const hasResolvedProfile = resolvedProfile !== null;
  const profilePictureUrl = profilePictureOverride ?? resolvedProfile?.profilePictureUrl;

  useEffect(() => {
    if (resolvedProfile?.profilePictureUrl) {
      setProfilePictureOverride(null);
    }
  }, [resolvedProfile?.profilePictureUrl]);

  // Check if user is guest (anonymous) - MUST be before queries that use it
  const isGuest = resolvedProfile?.isAnonymous ?? false;
  const isAdmin = resolvedProfile?.isAdmin ?? false;

  // Scraper monitoring & User suggestions - AFTER isGuest is defined
  // Use "skip" if APIs don't exist yet (before schema regeneration)
  const apiWithOptional = api as typeof api & {
    scraperMonitoring?: {
      getScraperStats: typeof api.admin.getStats;
    };
    userSuggestions?: {
      getAllSuggestions: typeof api.admin.getStats;
      getMySuggestions: typeof api.admin.getStats;
      getSuggestionStats: typeof api.admin.getStats;
    };
  };
  const hasScraperAPI = !!apiWithOptional.scraperMonitoring;
  const hasSuggestionsAPI = !!apiWithOptional.userSuggestions;

  const scraperStats = useQuery(
    apiWithOptional.scraperMonitoring?.getScraperStats ?? api.admin.getStats,
    !hasScraperAPI || !isAuthenticated || !profile?.isAdmin ? "skip" : {}
  );
  // TODO: Uncomment when modals are implemented
  // const userSuggestions = useQuery(
  //   apiWithOptional.userSuggestions?.getAllSuggestions ?? api.admin.getStats,
  //   !hasSuggestionsAPI || !isAuthenticated || !profile?.isAdmin ? "skip" : { limit: 50 }
  // );
  // const mySuggestions = useQuery(
  //   apiWithOptional.userSuggestions?.getMySuggestions ?? api.admin.getStats,
  //   !hasSuggestionsAPI || !isAuthenticated || isGuest ? "skip" : {}
  // );
  const suggestionStats = useQuery(
    apiWithOptional.userSuggestions?.getSuggestionStats ?? api.admin.getStats,
    !hasSuggestionsAPI || !isAuthenticated || !profile?.isAdmin ? "skip" : {}
  );
  const userSuggestions = useQuery(
    api.userSuggestions.getAllSuggestions,
    !hasSuggestionsAPI || !isAuthenticated || !isAdmin ? "skip" : { limit: 50 }
  );

  const submitReceipt = useAction(api.receipts.submitReceipt);
  const deleteAccount = useAction(api.userProfiles.deleteAccount);
  const inviteFamilyMember = useAction(api.familyPlan.inviteFamilyMember);
  const removeFamilyMember = useMutation(api.familyPlan.removeFamilyMember);
  const cancelInvitation = useMutation(api.familyPlan.cancelInvitation);
  const updateProfilePicture = useMutation(api.userProfiles.updateProfilePicture);
  const submitSuggestion = useMutation(api.userSuggestions.submitSuggestion);

  const isPremium = resolvedProfile?.isPremium ?? false;
  const premiumType = resolvedProfile?.premiumType ?? "solo";
  const feedbackTypeOptions: Array<{ value: "feature" | "improvement" | "bug" | "store" | "product" | "other"; label: string }> = [
    { value: "feature", label: "Nova funkcija" },
    { value: "improvement", label: "Izboljsava" },
    { value: "bug", label: "Napaka" },
    { value: "store", label: "Trgovina" },
    { value: "product", label: "Izdelek" },
    { value: "other", label: "Drugo" },
  ];
  const suggestionTypeLabels: Record<string, string> = {
    feature: "Nova funkcija",
    improvement: "Izboljsava",
    bug: "Napaka",
    store: "Trgovina",
    product: "Izdelek",
    other: "Drugo",
  };
  const suggestionStatusLabels: Record<string, string> = {
    pending: "Caka",
    reviewing: "V pregledu",
    approved: "Odobreno",
    implemented: "Vgrajeno",
    rejected: "Zavrnjeno",
    duplicate: "Duplikat",
  };
  const searchesRemaining = resolvedProfile?.searchesRemaining ?? (isGuest ? 1 : 3);
  const maxSearches = isPremium ? 999 : (isGuest ? 1 : 3);
  const searchProgress = isPremium ? 1 : Math.max(0, Math.min(1, searchesRemaining / maxSearches));
  const searchResetTime = resolvedProfile?.searchResetTime;
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const getLocalDateKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const formatDateShort = (timestamp?: number) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return null;
    const day = `${date.getDate()}`.padStart(2, "0");
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };
  const displayNickname =
    resolvedProfile?.nickname ??
    resolvedProfile?.name ??
    (resolvedProfile?.email ? resolvedProfile.email.split("@")[0] : "Uporabnik");
  const receiptLimit = premiumType === "family" ? 4 : 2;
  const todayKey = getLocalDateKey();
  const receiptsToday = receipts?.filter((receipt) => receipt.purchaseDateKey === todayKey) ?? [];
  const receiptsRemaining = Math.max(0, receiptLimit - receiptsToday.length);
  const premiumUntilLabel = formatDateShort(resolvedProfile?.premiumUntil);
  const premiumUntilMessage = premiumUntilLabel
    ? `Premium velja do ${premiumUntilLabel}.`
    : "Premium velja do konca trenutnega obdobja.";
  const awardsByYear = (awards ?? []).reduce<Record<string, AwardEntry[]>>((acc, award) => {
    const key = `${award.year}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(award);
    return acc;
  }, {});
  const suggestionsList = Array.isArray(userSuggestions) ? userSuggestions : [];
  const awardYears = Object.keys(awardsByYear).sort((a, b) => Number(b) - Number(a));
  const getAwardBadge = (award: AwardEntry) => {
    const label = award.award.toLowerCase();
    if (label.includes("zlati")) {
      return { image: BADGE_GOLD, title: award.award };
    }
    if (label.includes("srebrni")) {
      return { image: BADGE_SILVER, title: award.award };
    }
    if (label.includes("bronasti")) {
      return { image: BADGE_BRONZE, title: award.award };
    }
    if (label.includes("top 10")) {
      return { image: BADGE_TOP_10, title: award.award };
    }
    if (label.includes("top 100")) {
      return { image: BADGE_TOP_100, title: award.award };
    }
    return { image: BADGE_TOP_100, title: award.award };
  };
  const getSuggestionStatusStyle = (status?: string) => {
    switch (status) {
      case "approved":
      case "implemented":
        return styles.userSuggestionStatusApproved;
      case "rejected":
        return styles.userSuggestionStatusRejected;
      case "reviewing":
        return styles.userSuggestionStatusReviewing;
      case "duplicate":
        return styles.userSuggestionStatusDuplicate;
      default:
        return styles.userSuggestionStatusPending;
    }
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const update = () => {
      if (!isPremium && searchResetTime && searchesRemaining <= 0) {
        const diff = Math.max(0, searchResetTime - Date.now());
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      } else {
        setTimeRemaining(null);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [searchResetTime, isPremium, searchesRemaining, maxSearches]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: searchProgress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [searchProgress]);

  useEffect(() => {
    if (resolvedProfile?.nickname && !nicknameInput) {
      setNicknameInput(resolvedProfile.nickname);
    }
  }, [resolvedProfile?.nickname, nicknameInput]);

  const handleUpgrade = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.push("/premium");
  };

  const formatCurrency = (value: number) => {
    if (!Number.isFinite(value)) return "0.00 EUR";
    return value.toFixed(2).replace(".", ",") + " EUR";
  };

  const handleAdminStatClick = (type: "registered" | "active" | "guests") => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setAdminUserType(type);
    setShowAdminUsersModal(true);
  };

  const handleCaptureReceipt = async () => {
    if (receiptsRemaining <= 0) {
      setReceiptError("Dosežen dnevni limit računov.");
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setReceiptError("Dostop do kamere ni dovoljen.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setReceiptImage(result.assets[0].uri);
      setReceiptConfirmed(false);
      setReceiptError("");
      setReceiptSuccess("");
    }
  };

  const resetReceiptState = () => {
    setReceiptImage(null);
    setReceiptConfirmed(false);
    setReceiptError("");
    setReceiptSuccess("");
  };

  const handleSubmitReceipt = async () => {
    if (!receiptImage) {
      setReceiptError("Najprej posnemi račun.");
      return;
    }
    if (!receiptConfirmed) {
      setReceiptError("Potrdi, da je slikani račun tvoj.");
      return;
    }

    setReceiptSubmitting(true);
    setReceiptError("");
    setReceiptSuccess("");

    try {
      let base64Image = "";
      if (Platform.OS === "web") {
        const response = await fetch(receiptImage);
        const blob = await response.blob();
        base64Image = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } else {
        const base64 = await FileSystem.readAsStringAsync(receiptImage, {
          encoding: "base64",
        });
        base64Image = `data:image/jpeg;base64,${base64}`;
      }

      const result = await submitReceipt({
        imageBase64: base64Image,
        confirmed: receiptConfirmed,
      });

      if (!result.success) {
        setReceiptError(result.error ?? "Oddaja računa ni uspela.");
        return;
      }

      if (result.invalidReason) {
        setReceiptSuccess(`Račun shranjen, a neveljaven: ${result.invalidReason}`);
      } else {
        setReceiptSuccess("Račun potrjen in upoštevan.");
      }

      setTimeout(() => {
        setShowReceiptModal(false);
        resetReceiptState();
      }, 1200);
    } catch (error) {
      console.error("Receipt error:", error);
      setReceiptError("Oddaja računa ni uspela.");
    } finally {
      setReceiptSubmitting(false);
    }
  };

  const handleProfilePictureUpload = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const { status } =
        Platform.OS === "web"
          ? { status: "granted" as const }
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Dovoljenje potrebno", "Omogoči dostop do galerije, da lahko dodaš fotografijo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingProfilePic(true);
        let base64Image = "";
        if (Platform.OS === "web") {
          const response = await fetch(result.assets[0].uri);
          const blob = await response.blob();
          base64Image = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } else {
          const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
            encoding: "base64",
          });
          base64Image = `data:image/jpeg;base64,${base64}`;
        }

        const updateResult = await updateProfilePicture({ profilePictureUrl: base64Image });
        if (!updateResult.success) {
          Alert.alert("Napaka", updateResult.error ?? "Nalaganje fotografije ni uspelo.");
          return;
        }
        setProfilePictureOverride(base64Image);

        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error("Profile picture upload failed:", error);
      Alert.alert("Napaka", "Nalaganje fotografije ni uspelo. Poskusi znova.");
    } finally {
      setUploadingProfilePic(false);
    }
  };

  const openFeedbackModal = () => {
    if (!hasSuggestionsAPI) {
      Alert.alert("Predlogi", "Oddaja predlogov trenutno ni na voljo.");
      return;
    }
    setFeedbackError("");
    setFeedbackSuccess("");
    setShowFeedbackModal(true);
  };

  const closeFeedbackModal = () => {
    setShowFeedbackModal(false);
    setFeedbackError("");
    setFeedbackSuccess("");
  };

  const handleSubmitFeedback = async () => {
    if (submittingFeedback) return;
    const title = feedbackTitle.trim();
    const description = feedbackDescription.trim();

    if (title.length < 5) {
      setFeedbackError("Naslov mora imeti vsaj 5 znakov.");
      return;
    }
    if (description.length < 20) {
      setFeedbackError("Opis mora imeti vsaj 20 znakov.");
      return;
    }

    setSubmittingFeedback(true);
    setFeedbackError("");
    setFeedbackSuccess("");
    try {
      const result = await submitSuggestion({
        suggestionType: feedbackType,
        title,
        description,
      });

      if (!result.success) {
        setFeedbackError(result.error ?? "Oddaja predloga ni uspela.");
        return;
      }

      setFeedbackTitle("");
      setFeedbackDescription("");
      setFeedbackSuccess("Hvala! Predlog je poslan.");
      setTimeout(() => setShowFeedbackModal(false), 1200);
    } catch (error) {
      console.error("Submit suggestion failed:", error);
      setFeedbackError("Oddaja predloga ni uspela.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const timeoutMs = 6000;
    try {
      await Promise.race([
        authClient.signOut(),
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    } catch (error) {
      console.error("Napaka pri odjavi:", error);
    } finally {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace({ pathname: "/auth", params: { mode: "login" } });
      setSigningOut(false);
    }
  };

    const handleDeleteAccount = async () => {
    if (deletingAccount) {
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    setDeletingAccount(true);
    try {
      await deleteAccount({});
      await authClient.signOut();
      router.replace({ pathname: "/auth", params: { mode: "login" } });
    } catch (error) {
      console.error("Napaka pri brisanju:", error);
    } finally {
      setDeletingAccount(false);
      setShowDeleteModal(false);
    }
  };

  const handleInviteFamilyMember = async () => {
    const trimmedEmail = familyInviteEmail.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFamilyError("Vnesi veljaven e-naslov");
      return;
    }

    setFamilyInviting(true);
    setFamilyError("");
    setFamilySuccess("");

    try {
      await inviteFamilyMember({ email: trimmedEmail });
      setFamilySuccess(`Vabilo poslano na ${trimmedEmail}!`);
      setFamilyInviteEmail("");
      setTimeout(() => {
        setFamilySuccess("");
      }, 3000);
    } catch (error: unknown) {
      setFamilyError(error instanceof Error ? error.message : "Napaka pri pošiljanju vabila");
    } finally {
      setFamilyInviting(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    try {
      await removeFamilyMember({ memberUserId });
    } catch (error: unknown) {
      console.error("Remove member error:", error);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await cancelInvitation({ invitationId: invitationId as any });
    } catch (error: unknown) {
      console.error("Cancel invite error:", error);
    }
  };

  const handleCancelSubscription = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    try {
      // Note: Subscription cancellation would require payment provider integration
      // For now just close modal - backend would handle actual cancellation
      setShowCancelModal(false);
      setShowCancelSuccessModal(true);
    } catch (error) {
      console.error("Cancel subscription error:", error);
      setShowCancelModal(false);
    }
  };

  useEffect(() => {
    // Auto-retry refresh if profile stays undefined while authenticated
    let retry: ReturnType<typeof setTimeout> | null = null;
    if (isAuthenticated && profile === undefined && !hasResolvedProfile) {
      retry = setTimeout(() => {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.location.reload();
        } else {
          router.replace("/(tabs)/profile");
        }
      }, 5000);
    }
    return () => {
      if (retry) clearTimeout(retry);
    };
  }, [isAuthenticated, profile, hasResolvedProfile, router]);

  // Show loading state while auth is initializing
  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.authPrompt, { paddingTop: insets.top + 40 }]}>
          <Image
            source={getSeasonalLogoSource()}
            style={styles.authLogo}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color="#8b5cf6" style={{ marginTop: 24 }} />
          <Text style={styles.authText}>Nalaganje profila...</Text>
        </View>
      </View>
    );
  }

  // Only show auth prompt if truly not authenticated
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.authPrompt, { paddingTop: insets.top + 40 }]}>
          <Image
            source={getSeasonalLogoSource()}
            style={styles.authLogo}
            resizeMode="contain"
          />
          <Text style={styles.authTitle}>Prijava je potrebna</Text>
          <Text style={styles.authText}>
            Za dostop do profila in shranjevanje{"\n"}nastavitev se prijavi ali registriraj
          </Text>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => router.push({ pathname: "/auth", params: { mode: "register" } })}
          >
            <LinearGradient
              colors={["#8b5cf6", "#7c3aed"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.authButtonGradient}
            >
              <Text style={styles.authButtonText}>Prijava / Registracija</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show loading if profile is still loading
  if (!hasResolvedProfile) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.authPrompt, { paddingTop: insets.top + 40 }]}>
          <Image
            source={getSeasonalLogoSource()}
            style={styles.authLogo}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color="#8b5cf6" style={{ marginTop: 24 }} />
          <Text style={styles.authText}>Nalaganje profila...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0f0a1e", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />

      {/* Ambient Glow */}
      <View style={[styles.glowOrb, styles.glowOrb1]} />
      <View style={[styles.glowOrb, styles.glowOrb2]} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity
            style={styles.profilePictureContainer}
            onPress={handleProfilePictureUpload}
            disabled={uploadingProfilePic}
            activeOpacity={0.7}
          >
            {profilePictureUrl ? (
              <Image
                source={{ uri: profilePictureUrl }}
                style={styles.profilePicture}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={["#a855f7", "#8b5cf6"]}
                style={styles.profilePicturePlaceholder}
              >
                <Ionicons name="person" size={48} color="#fff" />
              </LinearGradient>
            )}
            {uploadingProfilePic && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
            <View style={styles.profilePictureEditBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>
            {premiumType === "family" ? `${displayNickname} Family profil` : `${displayNickname} profil`}
          </Text>
        </Animated.View>

        {/* Plan Card */}
        <Animated.View style={[styles.planCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient
            colors={
              isPremium
                ? ["rgba(251, 191, 36, 0.26)", "rgba(245, 158, 11, 0.2)"]
                : ["rgba(139, 92, 246, 0.15)", "rgba(59, 7, 100, 0.3)"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.planGradient,
              isPremium && styles.planGradientPremium,
              isPremium && styles.planPremiumShadow,
            ]}
          >
            <View style={styles.planHeader}>
              <View style={styles.planInfo}>
                <View style={styles.planBadge}>
                  {isPremium ? (
                    <Ionicons name="star" size={16} color="#fbbf24" />
                  ) : (
                    <Ionicons name="person" size={16} color="#a78bfa" />
                  )}
                  <Text style={[styles.planBadgeText, isPremium && styles.planBadgeTextPremium]}>
                    {isPremium ? (premiumType === "family" ? PLAN_FAMILY : PLAN_PLUS) : PLAN_FREE}
                  </Text>
                </View>
                <Text style={styles.planPrice}>
                  {isPremium ? (premiumType === "family" ? "2,99  EUR/mesec" : "1,99  EUR/mesec") : "Brezplačno"}
                </Text>
                {isPremium && (
                  <Text style={styles.planExpiry}>
                    {premiumUntilLabel ? `Velja do ${premiumUntilLabel}` : "Velja do konca obdobja"}
                  </Text>
                )}
              </View>
              {(!isPremium || (isPremium && premiumType === "solo")) && (
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={handleUpgrade}
                >
                  <LinearGradient
                    colors={["#fbbf24", "#f59e0b"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.upgradeGradient}
                  >
                    <Ionicons name="star" size={14} color="#0b0814" />
                    <Text style={styles.upgradeText}>
                      {isPremium ? "Nadgradi na Family" : "Nadgradi"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* Search Progress */}
            <View style={styles.searchProgress}>
              <View style={styles.searchProgressHeader}>
                <Text style={styles.searchProgressLabel}>Brezplačna iskanja</Text>
                <Text style={styles.searchProgressValue}>
                  {isPremium ? "neomejeno" : `${Math.max(0, searchesRemaining)}/${maxSearches}`}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    isPremium && styles.progressFillPremium,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              </View>
              {!isPremium && searchesRemaining <= 0 && timeRemaining ? (
                <View style={styles.searchTimer}>
                  <Ionicons name="time-outline" size={14} color="#fbbf24" />
                  <Text style={styles.searchTimerText}>Novo iskanje čez {timeRemaining}</Text>
                </View>
              ) : !isPremium && searchesRemaining === 1 ? (
                <Text style={styles.searchWarning}>
                  Še samo 1 brezplačno iskanje.
                </Text>
              ) : null}
            </View>

            {/* Plan Features */}
            <View style={styles.planFeatures}>
              <View style={styles.planFeature}>
                <Ionicons
                  name={isPremium ? "checkmark-circle" : "checkmark-circle-outline"}
                  size={18}
                  color={isPremium ? "#10b981" : "#6b7280"}
                />
                <Text style={[styles.planFeatureText, !isPremium && styles.planFeatureTextDisabled]}>
                  {isPremium
                    ? "Neomejeno iskanje"
                    : (maxSearches === 1 ? "1 iskanje na dan" : `${maxSearches} iskanja na dan`)}
                </Text>
              </View>
              <View style={styles.planFeature}>
                <Ionicons
                  name={isPremium ? "checkmark-circle" : "close-circle-outline"}
                  size={18}
                  color={isPremium ? "#10b981" : "#6b7280"}
                />
                <Text style={[styles.planFeatureText, !isPremium && styles.planFeatureTextDisabled]}>
                  {isPremium ? "Vse razpoložljive trgovine" : "Samo osnovne trgovine"}
                </Text>
              </View>
              <View style={styles.planFeature}>
                <Ionicons
                  name={isPremium ? "checkmark-circle" : "close-circle-outline"}
                  size={18}
                  color={isPremium ? "#10b981" : "#6b7280"}
                />
                <Text style={[styles.planFeatureText, !isPremium && styles.planFeatureTextDisabled]}>
                  {isPremium ? "Ekskluzivni kuponi" : "Osnovni kuponi"}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Achievements */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Dosežki</Text>
          <Text style={styles.sectionSubtitle}>Letni dosežki iz varčevanja</Text>
          {awardYears.length === 0 ? (
            <View style={styles.emptyAwards}>
              <Ionicons name="trophy-outline" size={26} color="#a78bfa" />
              <Text style={styles.emptyAwardsText}>
                Še ni dosežkov. Dodaj račune in začni varčevati.
              </Text>
            </View>
          ) : (
            awardYears.map((year) => (
              <View key={year} style={styles.awardYearCard}>
                <Text style={styles.awardYearTitle}>{year}</Text>
                <View style={styles.awardList}>
                  {awardsByYear[year].map((award, index) => {
                    const badge = getAwardBadge(award);
                    const leaderboardLabel =
                      award.leaderboard === "family" ? "Family lestvica" : "Skupna lestvica";
                    return (
                      <View key={`${year}-${award.rank}-${index}`} style={styles.awardBadgeCard}>
                        <Image source={badge.image} style={styles.awardBadgeImage} />
                        <View style={styles.awardBadgeInfo}>
                          <Text style={styles.awardBadgeTitle}>{badge.title}</Text>
                          <Text style={styles.awardBadgeMeta}>
                            {leaderboardLabel} - #{award.rank}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </Animated.View>

        {/* Receipts */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Računi</Text>
          <Text style={styles.sectionSubtitle}>
            Prihranek se računa iz potrjenih računov (max {receiptLimit}/dan).
          </Text>
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <View>
                <Text style={styles.receiptTitle}>Računi danes</Text>
                <Text style={styles.receiptMeta}>
                  {receiptsToday.length}/{receiptLimit} uporabljeno
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.receiptButton, receiptsRemaining <= 0 && styles.receiptButtonDisabled]}
                onPress={() => {
                  setShowReceiptModal(true);
                  resetReceiptState();
                }}
                disabled={receiptsRemaining <= 0}
              >
                <LinearGradient
                  colors={receiptsRemaining <= 0 ? ["#475569", "#334155"] : ["#22c55e", "#16a34a"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.receiptButtonGradient}
                >
                  <Ionicons name="camera" size={16} color="#fff" />
                  <Text style={styles.receiptButtonText}>Dodaj račun</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <Text style={styles.receiptHint}>
              Račun velja samo danes do 23:00. Brez potrditve se ne upošteva.
            </Text>
          </View>

          <View style={styles.receiptList}>
            {receipts && receipts.length > 0 ? (
              receipts.map((receipt) => (
                <View key={receipt._id} style={styles.receiptItem}>
                  <View style={styles.receiptItemRow}>
                    <Text style={styles.receiptStore}>{receipt.storeName ?? "Neznana trgovina"}</Text>
                    <Text style={styles.receiptDate}>{receipt.purchaseDateKey}</Text>
                  </View>
                  <View style={styles.receiptItemRow}>
                    <Text style={styles.receiptTotal}>Plačano: {formatCurrency(receipt.totalPaid)}</Text>
                    <Text style={styles.receiptSaved}>
                      Prihranek: {formatCurrency(receipt.savedAmount)}
                    </Text>
                  </View>
                  {!receipt.isValid && (
                    <Text style={styles.receiptInvalid}>
                      Neveljaven račun: {receipt.invalidReason ?? "Ni potrjen"}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.receiptEmpty}>Ni računov.</Text>
            )}
          </View>
        </Animated.View>

        {/* User Feedback Button - TODO: Add modal when implemented */}
        {!isGuest && (
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <TouchableOpacity style={styles.feedbackButton} onPress={openFeedbackModal} activeOpacity={0.85}>
              <LinearGradient
                colors={["rgba(236, 72, 153, 0.2)", "rgba(147, 51, 234, 0.2)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.feedbackButtonGradient}
              >
                <View style={styles.feedbackButtonContent}>
                  <View style={styles.feedbackButtonHeader}>
                    <Ionicons name="bulb-outline" size={24} color="#ec4899" />
                    <Text style={styles.feedbackButtonTitle}>Predlagaj izboljšavo</Text>
                  </View>
                  <Text style={styles.feedbackButtonSubtitle}>
                    Povej nam svoje mnenje in dobij 1 dan premium BREZPLAČNO za koristne predloge!
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ec4899" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {isAdmin && (
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <View style={styles.adminHeader}>
              <View>
                <Text style={styles.sectionTitle}>Admin Panel</Text>
                <Text style={styles.sectionSubtitle}>Pregled rasti v realnem času</Text>
              </View>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.2)", "rgba(15, 23, 42, 0.7)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.adminCard}
            >
              <View style={styles.adminRow}>
                <TouchableOpacity
                  style={styles.adminStat}
                  onPress={() => handleAdminStatClick("registered")}
                  activeOpacity={0.7}
                >
                  <Ionicons name="people" size={20} color="#8b5cf6" />
                  <Text style={styles.adminStatLabel}>Uporabniki</Text>
                  <Text style={styles.adminStatValue}>
                    {adminStats?.totalUsers ?? "--"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adminStat}
                  onPress={() => handleAdminStatClick("active")}
                  activeOpacity={0.7}
                >
                  <Ionicons name="flash" size={20} color="#10b981" />
                  <Text style={styles.adminStatLabel}>Aktivni</Text>
                  <Text style={styles.adminStatValue}>
                    {adminStats?.activeUsers ?? "--"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adminStat}
                  onPress={() => handleAdminStatClick("guests")}
                  activeOpacity={0.7}
                >
                  <Ionicons name="eye-outline" size={20} color="#f59e0b" />
                  <Text style={styles.adminStatLabel}>Gostje</Text>
                  <Text style={styles.adminStatValue}>
                    {adminStats?.totalGuests ?? "--"}
                  </Text>
                </TouchableOpacity>
              </View>

              {adminStats?.topCountries && adminStats.topCountries.length > 0 && (
                <View style={styles.geoSection}>
                  <View style={styles.geoHeader}>
                    <Ionicons name="globe-outline" size={18} color="#cbd5e1" />
                    <Text style={styles.geoTitle}>Top Države</Text>
                  </View>
                  <View style={styles.geoList}>
                    {adminStats.topCountries.map((item, index) => (
                      <View key={item.country} style={styles.geoItem}>
                        <View style={styles.geoRank}>
                          <Text style={styles.geoRankText}>{index + 1}</Text>
                        </View>
                        <Text style={styles.geoCountry}>{item.country}</Text>
                        <Text style={styles.geoCount}>{item.count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Additional Admin Stats */}
              {detailedAdminStats && (
                <View style={styles.detailedStatsSection}>
                  <Text style={styles.detailedStatsTitle}>📊 Podrobnosti</Text>
                  <View style={styles.detailedStatsGrid}>
                    <View style={styles.detailedStatItem}>
                      <Text style={styles.detailedStatValue}>{detailedAdminStats.premiumUsers}</Text>
                      <Text style={styles.detailedStatLabel}>Premium</Text>
                    </View>
                    <View style={styles.detailedStatItem}>
                      <Text style={styles.detailedStatValue}>{detailedAdminStats.freeUsers}</Text>
                      <Text style={styles.detailedStatLabel}>Free</Text>
                    </View>
                    <View style={styles.detailedStatItem}>
                      <Text style={styles.detailedStatValue}>{detailedAdminStats.totalSearchesToday}</Text>
                      <Text style={styles.detailedStatLabel}>Iskanja danes</Text>
                    </View>
                    <View style={styles.detailedStatItem}>
                      <Text style={styles.detailedStatValue}>{detailedAdminStats.recentSignups}</Text>
                      <Text style={styles.detailedStatLabel}>Novi (7d)</Text>
                    </View>
                  </View>
                  <View style={styles.savingsRow}>
                    <Ionicons name="trending-down" size={18} color="#10b981" />
                    <Text style={styles.savingsText}>
                      Skupaj prihranki: {formatCurrency(detailedAdminStats.totalSavings)}
                    </Text>
                  </View>
                </View>
              )}

              {/* AI Suggestions */}
              {aiSuggestions && aiSuggestions.length > 0 && (
                <TouchableOpacity
                  style={styles.aiSuggestionsCard}
                  onPress={() => setShowAISuggestionsModal(true)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={["rgba(236, 72, 153, 0.2)", "rgba(147, 51, 234, 0.2)"]}
                    style={styles.aiSuggestionsGradient}
                  >
                    <View style={styles.aiSuggestionsHeader}>
                      <Ionicons name="bulb" size={24} color="#ec4899" />
                      <Text style={styles.aiSuggestionsTitle}>AI Predlogi</Text>
                    </View>
                    <Text style={styles.aiSuggestionsCount}>
                      {aiSuggestions.length} {aiSuggestions.length === 1 ? "predlog" : aiSuggestions.length === 2 ? "predloga" : "predlogov"}
                    </Text>
                    <Text style={styles.aiSuggestionsSubtitle}>
                      Klikni za prikaz predlogov izboljšav
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Scraper Monitoring */}
              {scraperStats && hasScraperAPI && "dailyPrices" in scraperStats && "catalogSales" in scraperStats && (
                <View style={styles.scraperMonitoringCard}>
                  <View style={styles.scraperHeader}>
                    <Ionicons name="sync" size={20} color="#3b82f6" />
                    <Text style={styles.scraperTitle}>Scraper Status</Text>
                  </View>
                  <View style={styles.scraperRow}>
                    <View style={styles.scraperItem}>
                      <Text style={styles.scraperLabel}>Cene</Text>
                      <View style={styles.scraperStatus}>
                        <Ionicons
                          name={(scraperStats as { dailyPrices: { lastRun?: { status: string } } }).dailyPrices.lastRun?.status === "success" ? "checkmark-circle" : "alert-circle"}
                          size={16}
                          color={(scraperStats as { dailyPrices: { lastRun?: { status: string } } }).dailyPrices.lastRun?.status === "success" ? "#10b981" : "#ef4444"}
                        />
                        <Text style={styles.scraperTime}>
                          {(scraperStats as { dailyPrices: { lastRun?: { completedAt?: number; startedAt: number } } }).dailyPrices.lastRun
                            ? new Date((scraperStats as { dailyPrices: { lastRun: { completedAt?: number; startedAt: number } } }).dailyPrices.lastRun.completedAt || (scraperStats as { dailyPrices: { lastRun: { completedAt?: number; startedAt: number } } }).dailyPrices.lastRun.startedAt).toLocaleString("sl-SI", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "--"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.scraperItem}>
                      <Text style={styles.scraperLabel}>Katalogi</Text>
                      <View style={styles.scraperStatus}>
                        <Ionicons
                          name={(scraperStats as { catalogSales: { lastRun?: { status: string } } }).catalogSales.lastRun?.status === "success" ? "checkmark-circle" : "alert-circle"}
                          size={16}
                          color={(scraperStats as { catalogSales: { lastRun?: { status: string } } }).catalogSales.lastRun?.status === "success" ? "#10b981" : "#ef4444"}
                        />
                        <Text style={styles.scraperTime}>
                          {(scraperStats as { catalogSales: { lastRun?: { completedAt?: number; startedAt: number } } }).catalogSales.lastRun
                            ? new Date((scraperStats as { catalogSales: { lastRun: { completedAt?: number; startedAt: number } } }).catalogSales.lastRun.completedAt || (scraperStats as { catalogSales: { lastRun: { completedAt?: number; startedAt: number } } }).catalogSales.lastRun.startedAt).toLocaleString("sl-SI", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Ni podatkov"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* User Suggestions */}
              {suggestionStats && hasSuggestionsAPI && "total" in suggestionStats && "pending" in suggestionStats && "approved" in suggestionStats && "rewardsGiven" in suggestionStats && (
                <TouchableOpacity
                  style={styles.suggestionsCard}
                  onPress={() => setShowUserSuggestionsModal(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.suggestionsHeader}>
                    <Ionicons name="chatbubbles" size={20} color="#ec4899" />
                    <Text style={styles.suggestionsTitle}>Predlogi uporabnikov</Text>
                    {(suggestionStats as { pending: number }).pending > 0 && (
                      <View style={styles.suggestionsBadge}>
                        <Text style={styles.suggestionsBadgeText}>{(suggestionStats as { pending: number }).pending}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.suggestionsRow}>
                    <View style={styles.suggestionStat}>
                      <Text style={styles.suggestionStatValue}>{(suggestionStats as { total: number }).total}</Text>
                      <Text style={styles.suggestionStatLabel}>Skupaj</Text>
                    </View>
                    <View style={styles.suggestionStat}>
                      <Text style={[styles.suggestionStatValue, { color: "#fbbf24" }]}>{(suggestionStats as { pending: number }).pending}</Text>
                      <Text style={styles.suggestionStatLabel}>Čaka</Text>
                    </View>
                    <View style={styles.suggestionStat}>
                      <Text style={[styles.suggestionStatValue, { color: "#10b981" }]}>{(suggestionStats as { approved: number }).approved}</Text>
                      <Text style={styles.suggestionStatLabel}>Odobreno</Text>
                    </View>
                    <View style={styles.suggestionStat}>
                      <Text style={[styles.suggestionStatValue, { color: "#8b5cf6" }]}>{(suggestionStats as { rewardsGiven: number }).rewardsGiven}</Text>
                      <Text style={styles.suggestionStatLabel}>Nagrajeno</Text>
                    </View>
                  </View>
                  <View style={styles.suggestionsFooter}>
                    <Text style={styles.suggestionsFooterText}>Klikni za seznam predlogov</Text>
                    <Ionicons name="chevron-forward" size={16} color="#ec4899" />
                  </View>
                </TouchableOpacity>
              )}
            </LinearGradient>
          </Animated.View>
        )}

        {/* Family Plan Management */}
        {premiumType === "family" && (
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <View style={styles.familyHeader}>
              <Text style={styles.sectionTitle}>Family Plan</Text>
              <TouchableOpacity
                style={styles.addMemberButton}
                onPress={() => setShowFamilyModal(true)}
              >
                <Ionicons name="person-add" size={18} color="#fbbf24" />
                <Text style={styles.addMemberText}>Povabi</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              {familyMembers?.availableSlots || 0} / {familyMembers?.maxMembers || 3} prostih mest
            </Text>

            <View style={styles.familyList}>
              {/* Current Members */}
              {familyMembers?.members && familyMembers.members.length > 0 && (
                <>
                  {familyMembers.members.map((member: { userId: string; nickname: string; email: string | undefined }) => (
                    <View key={member.userId} style={styles.familyMemberCard}>
                      <View style={styles.familyMemberIcon}>
                        <Ionicons name="person" size={20} color="#10b981" />
                      </View>
                      <View style={styles.familyMemberInfo}>
                        <Text style={styles.familyMemberName}>{member.nickname}</Text>
                        <Text style={styles.familyMemberEmail}>{member.email}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeMemberButton}
                        onPress={() => handleRemoveMember(member.userId)}
                      >
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {/* Pending Invitations */}
              {pendingInvites && pendingInvites.length > 0 && (
                <>
                  {pendingInvites.map((invite: { id: string; email: string | undefined }) => (
                    <View key={invite.id} style={styles.familyPendingCard}>
                      <View style={styles.familyMemberIcon}>
                        <Ionicons name="mail" size={20} color="#f59e0b" />
                      </View>
                      <View style={styles.familyMemberInfo}>
                        <Text style={styles.familyMemberEmail}>{invite.email}</Text>
                        <Text style={styles.familyPendingText}>Vabilo poslano</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeMemberButton}
                        onPress={() => handleCancelInvite(invite.id)}
                      >
                        <Ionicons name="close-circle" size={20} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {/* Empty State */}
              {(!familyMembers?.members || familyMembers.members.length === 0) &&
                (!pendingInvites || pendingInvites.length === 0) && (
                  <View style={styles.familyEmpty}>
                    <Ionicons name="people-outline" size={40} color="#6b7280" />
                    <Text style={styles.familyEmptyText}>
                      Dodaj družinske člane in delite premium funkcije!
                    </Text>
                  </View>
                )}
            </View>
          </Animated.View>
        )}

        {/* Settings */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Nastavitve</Text>

          <View style={styles.settingsList}>
            <TouchableOpacity style={styles.settingItem} onPress={() => router.push("/notifications")}>
              <View style={styles.settingIcon}>
                <Ionicons name="notifications-outline" size={20} color="#a78bfa" />
              </View>
              <Text style={styles.settingText}>Obvestila</Text>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => router.push("/loyalty-cards")}>
              <View style={styles.settingIcon}>
                <Ionicons name="card-outline" size={20} color="#a78bfa" />
              </View>
              <Text style={styles.settingText}>Kartice zvestobe</Text>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => router.push("/help")}>
              <View style={styles.settingIcon}>
                <Ionicons name="help-circle-outline" size={20} color="#a78bfa" />
              </View>
              <Text style={styles.settingText}>Pomoč</Text>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => router.push("/terms")}>
              <View style={styles.settingIcon}>
                <Ionicons name="document-text-outline" size={20} color="#a78bfa" />
              </View>
              <Text style={styles.settingText}>Pogoji uporabe</Text>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>

            {isPremium && (
              <TouchableOpacity 
                style={styles.settingItem}
                onPress={() => setShowCancelModal(true)}
              >
                <View style={[styles.settingIcon, { backgroundColor: "rgba(251, 191, 36, 0.15)" }]}>
                  <Ionicons name="close-circle-outline" size={20} color="#fbbf24" />
                </View>
                <Text style={styles.settingText}>Prekliči naročnino</Text>
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.settingItem, styles.settingItemDanger]}
              onPress={() => setShowDeleteModal(true)}
            >
              <View style={[styles.settingIcon, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </View>
              <Text style={styles.settingTextDanger}>Izbriši račun</Text>
              <Ionicons name="chevron-forward" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} disabled={signingOut}>
          <Ionicons name="log-out-outline" size={20} color={signingOut ? "#9ca3af" : "#ef4444"} />
          <Text style={[styles.signOutText, signingOut && { color: "#9ca3af" }]}>
            {signingOut ? "Odjavljam..." : "Odjava"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      {showReceiptModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.receiptModal}>
            <LinearGradient
              colors={["rgba(34, 197, 94, 0.18)", "rgba(15, 23, 42, 0.9)"]}
              style={styles.receiptModalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => {
                  setShowReceiptModal(false);
                  resetReceiptState();
                }}
              >
                <Ionicons name="close" size={22} color="#9ca3af" />
              </TouchableOpacity>

              <Text style={styles.receiptModalTitle}>Dodaj račun</Text>

              {receiptImage ? (
                <Image source={{ uri: receiptImage }} style={styles.receiptPreview} />
              ) : (
                <View style={styles.receiptPlaceholder}>
                  <Ionicons name="receipt-outline" size={42} color="#a78bfa" />
                  <Text style={styles.receiptPlaceholderText}>Posnemi račun s kamero.</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.receiptCheckRow}
                onPress={() => setReceiptConfirmed((value) => !value)}
                activeOpacity={0.8}
              >
                <View style={[styles.receiptCheckBox, receiptConfirmed && styles.receiptCheckBoxChecked]}>
                  {receiptConfirmed && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={styles.receiptCheckText}>Potrdi, da je slikani račun tvoj.</Text>
              </TouchableOpacity>

              {receiptError ? <Text style={styles.receiptErrorText}>{receiptError}</Text> : null}
              {receiptSuccess ? <Text style={styles.receiptSuccessText}>{receiptSuccess}</Text> : null}

              <View style={styles.receiptModalActions}>
                <TouchableOpacity
                  style={[styles.receiptActionButton, receiptsRemaining <= 0 && styles.receiptActionDisabled]}
                  onPress={handleCaptureReceipt}
                  disabled={receiptsRemaining <= 0 || receiptSubmitting}
                >
                  <LinearGradient
                    colors={receiptsRemaining <= 0 ? ["#475569", "#334155"] : ["#8b5cf6", "#7c3aed"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.receiptActionGradient}
                  >
                    <Ionicons name="camera" size={18} color="#fff" />
                    <Text style={styles.receiptActionText}>Odpri kamero</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.receiptActionButton,
                    styles.receiptActionSecondary,
                    (!receiptImage || receiptSubmitting) && styles.receiptActionDisabled,
                  ]}
                  onPress={handleSubmitReceipt}
                  disabled={!receiptImage || receiptSubmitting}
                >
                  <LinearGradient
                    colors={!receiptImage || receiptSubmitting ? ["#475569", "#334155"] : ["#22c55e", "#16a34a"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.receiptActionGradient}
                  >
                    {receiptSubmitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        <Text style={styles.receiptActionText}>Oddaj račun</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}


      {showSignOutToast && (
        <View style={styles.toastOverlay}>
          <LinearGradient
            colors={["rgba(16, 185, 129, 0.25)", "rgba(16, 185, 129, 0.15)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.toastContainer}
          >
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.toastText}>Uspesno odjavljeno</Text>
          </LinearGradient>
        </View>
      )}

      {showFeedbackModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.feedbackModal}>
            <LinearGradient
              colors={["rgba(236, 72, 153, 0.25)", "rgba(15, 23, 42, 0.9)"]}
              style={styles.feedbackModalGradient}
            >
              <TouchableOpacity style={styles.modalClose} onPress={closeFeedbackModal}>
                <Ionicons name="close" size={22} color="#9ca3af" />
              </TouchableOpacity>

              <Text style={styles.feedbackModalTitle}>Predlagaj izboljsavo</Text>
              <Text style={styles.feedbackModalSubtitle}>
                Pomagaj nam izboljsati aplikacijo. Za koristne predloge dobis 1 dan premium.
              </Text>

              <View style={styles.feedbackTypeRow}>
                {feedbackTypeOptions.map((option) => {
                  const isActive = feedbackType === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.feedbackTypeChip, isActive && styles.feedbackTypeChipActive]}
                      onPress={() => setFeedbackType(option.value)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.feedbackTypeText, isActive && styles.feedbackTypeTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.feedbackInputContainer}>
                <TextInput
                  placeholder="Kratek naslov"
                  placeholderTextColor="#94a3b8"
                  style={styles.feedbackInput}
                  value={feedbackTitle}
                  onChangeText={setFeedbackTitle}
                  maxLength={120}
                />
              </View>

              <View style={styles.feedbackInputContainer}>
                <TextInput
                  placeholder="Opisi predlog ali napako"
                  placeholderTextColor="#94a3b8"
                  style={[styles.feedbackInput, styles.feedbackInputMultiline]}
                  value={feedbackDescription}
                  onChangeText={setFeedbackDescription}
                  multiline
                  maxLength={800}
                />
              </View>

              {feedbackError ? <Text style={styles.feedbackError}>{feedbackError}</Text> : null}
              {feedbackSuccess ? <Text style={styles.feedbackSuccess}>{feedbackSuccess}</Text> : null}

              <View style={styles.feedbackActions}>
                <TouchableOpacity style={styles.feedbackCancel} onPress={closeFeedbackModal}>
                  <Text style={styles.feedbackCancelText}>Preklici</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.feedbackSubmit, submittingFeedback && styles.feedbackSubmitDisabled]}
                  onPress={handleSubmitFeedback}
                  disabled={submittingFeedback}
                >
                  <LinearGradient
                    colors={["#ec4899", "#9333ea"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.feedbackSubmitGradient}
                  >
                    {submittingFeedback ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.feedbackSubmitText}>Poslji</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Premium Modal */}
      {showPremiumModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.2)", "rgba(59, 7, 100, 0.4)"]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowPremiumModal(false)}
              >
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>

              <Image
                source={getSeasonalLogoSource()}
                style={styles.modalLogo}
                resizeMode="contain"
              />

              <Text style={styles.modalTitle}>Pr'Hran Premium</Text>
              <Text style={styles.modalPrice}>1,99  EUR/mesec</Text>

              <View style={styles.modalFeatures}>
                <View style={styles.modalFeatureRow}>
                  <View style={styles.modalFeatureCol}>
                    <Text style={styles.modalFeatureLabel}>ZASTONJ</Text>
                    <View style={styles.modalFeature}>
                      <Ionicons name="checkmark" size={16} color="#10b981" />
                      <Text style={styles.modalFeatureText}>3 iskanja/dan</Text>
                    </View>
                    <View style={styles.modalFeature}>
                      <Ionicons name="close" size={16} color="#ef4444" />
                      <Text style={styles.modalFeatureTextDisabled}>Omejeno število trgovin</Text>
                    </View>
                    <View style={styles.modalFeature}>
                      <Ionicons name="close" size={16} color="#ef4444" />
                      <Text style={styles.modalFeatureTextDisabled}>Ekskluzivni kuponi</Text>
                    </View>
                  </View>
                  <View style={styles.modalFeatureDivider} />
                  <View style={styles.modalFeatureCol}>
                    <Text style={styles.modalFeatureLabelPremium}>PREMIUM</Text>
                    <View style={styles.modalFeature}>
                      <Ionicons name="checkmark" size={16} color="#10b981" />
                      <Text style={styles.modalFeatureText}>Neomejeno</Text>
                    </View>
                    <View style={styles.modalFeature}>
                      <Ionicons name="checkmark" size={16} color="#10b981" />
                      <Text style={styles.modalFeatureText}>Vse razpoložljive trgovine</Text>
                    </View>
                    <View style={styles.modalFeature}>
                      <Ionicons name="checkmark" size={16} color="#10b981" />
                      <Text style={styles.modalFeatureText}>Ekskluzivni kuponi</Text>
                    </View>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.modalButton} onPress={handleUpgrade}>
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalButtonGradient}
                >
                  <Ionicons name="star" size={18} color="#000" />
                  <Text style={styles.modalButtonText}>Nadgradi na PrHran Plus</Text>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.modalDisclaimer}>
                Prekliči kadarkoli. Brez skritih stroškov.
              </Text>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <LinearGradient
              colors={["rgba(239, 68, 68, 0.2)", "rgba(127, 29, 29, 0.4)"]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowDeleteModal(false)}
              >
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>

              <View style={styles.deleteIconContainer}>
                <LinearGradient
                  colors={["#ef4444", "#dc2626"]}
                  style={styles.deleteIconBg}
                >
                  <Ionicons name="warning" size={32} color="#fff" />
                </LinearGradient>
              </View>

              <Text style={styles.deleteTitle}>Izbriši račun?</Text>
              <Text style={styles.deleteDescription}>
                Ta dejanje je nepovratno. Vsi tvoji podatki, košarica in nastavitve bodo trajno izbrisani.
              </Text>

              <View style={styles.deleteButtons}>
                <TouchableOpacity 
                  style={styles.cancelDeleteButton}
                  onPress={() => setShowDeleteModal(false)}
                >
                  <Text style={styles.cancelDeleteText}>Prekliči</Text>
                </TouchableOpacity>

                                  <TouchableOpacity 
                    style={styles.confirmDeleteButton}
                    onPress={handleDeleteAccount}
                    disabled={deletingAccount}
                  >
                    <LinearGradient
                      colors={["#ef4444", "#dc2626"]}
                      style={styles.confirmDeleteGradient}
                    >
                      {deletingAccount ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.confirmDeleteText}>Izbriši</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <LinearGradient
              colors={["rgba(251, 191, 36, 0.2)", "rgba(180, 83, 9, 0.4)"]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowCancelModal(false)}
              >
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>

              <View style={styles.cancelIconContainer}>
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b"]}
                  style={styles.cancelIconBg}
                >
                  <Ionicons name="star" size={32} color="#000" />
                </LinearGradient>
              </View>

              <Text style={styles.cancelTitle}>Prekliči Premium?</Text>
              <Text style={styles.cancelDescription}>
                Ob preklicu boš izgubil dostop do:{"\n"}
                -  Neomejenega iskanja{"\n"}
                -  Vseh trgovin{"\n"}
                -  Ekskluzivnih kuponov
              </Text>

              <View style={styles.deleteButtons}>
                <TouchableOpacity 
                  style={styles.keepPremiumButton}
                  onPress={() => setShowCancelModal(false)}
                >
                  <LinearGradient
                    colors={["#fbbf24", "#f59e0b"]}
                    style={styles.keepPremiumGradient}
                  >
                    <Text style={styles.keepPremiumText}>Obdrži Premium</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.confirmCancelButton}
                  onPress={handleCancelSubscription}
                >
                  <Text style={styles.confirmCancelText}>Prekliči naročnino</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}

      {showCancelSuccessModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <LinearGradient
              colors={["rgba(16, 185, 129, 0.25)", "rgba(15, 23, 42, 0.75)"]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowCancelSuccessModal(false)}
              >
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>

              <View style={styles.cancelIconContainer}>
                <LinearGradient
                  colors={["#34d399", "#10b981"]}
                  style={styles.cancelIconBg}
                >
                  <Ionicons name="checkmark" size={32} color="#000" />
                </LinearGradient>
              </View>

              <Text style={styles.cancelTitle}>Naročnina preklicana</Text>
              <Text style={styles.cancelDescription}>{premiumUntilMessage}</Text>

              <TouchableOpacity
                style={styles.keepPremiumButton}
                onPress={() => setShowCancelSuccessModal(false)}
              >
                <LinearGradient
                  colors={["#34d399", "#10b981"]}
                  style={styles.keepPremiumGradient}
                >
                  <Text style={styles.keepPremiumText}>Zapri</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Family Invite Modal */}
      {showFamilyModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.2)", "rgba(59, 7, 100, 0.3)"]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => {
                  setShowFamilyModal(false);
                  setFamilyInviteEmail("");
                  setFamilyError("");
                  setFamilySuccess("");
                }}
              >
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>

              <View style={styles.familyModalIcon}>
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b"]}
                  style={styles.familyModalIconBg}
                >
                  <Ionicons name="people" size={32} color="#0b0814" />
                </LinearGradient>
              </View>

              <Text style={styles.modalTitle}>Povabi v Family Plan</Text>
              <Text style={styles.modalSubtitle}>
                Vnesi e-naslov osebe, ki jo želiš dodati v svojo družino.
              </Text>

              <TextInput
                style={styles.familyInput}
                placeholder="email@example.com"
                placeholderTextColor="#6b7280"
                value={familyInviteEmail}
                onChangeText={setFamilyInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {familyError ? (
                <Text style={styles.familyErrorText}>{familyError}</Text>
              ) : null}
              {familySuccess ? (
                <Text style={styles.familySuccessText}>{familySuccess}</Text>
              ) : null}

              <TouchableOpacity
                style={styles.familyInviteButton}
                onPress={handleInviteFamilyMember}
                disabled={familyInviting}
              >
                <LinearGradient
                  colors={["#fbbf24", "#f59e0b"]}
                  style={styles.familyInviteGradient}
                >
                  {familyInviting ? (
                    <ActivityIndicator size="small" color="#0b0814" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#0b0814" />
                      <Text style={styles.familyInviteText}>Pošlji vabilo</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Admin Users Modal */}
      {showAdminUsersModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.modalContent, { maxHeight: "85%" }]}>
            <LinearGradient
              colors={["rgba(139, 92, 246, 0.2)", "rgba(59, 7, 100, 0.3)"]}
              style={[styles.modalGradient, { height: "100%" }]}
            >
              <View style={styles.adminModalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {adminUserType === "registered" ? "Registrirani uporabniki" :
                     adminUserType === "active" ? "Aktivni uporabniki" : "Gostje"}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {adminUsers?.length || 0} uporabnikov
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => {
                    setShowAdminUsersModal(false);
                    setAdminUserType(null);
                  }}
                >
                  <Ionicons name="close" size={24} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.adminUsersList} showsVerticalScrollIndicator={false}>
                {adminUsers && adminUsers.length > 0 ? (
                  adminUsers.map((user: typeof adminUsers[0]) => (
                    <View key={user.userId} style={styles.adminUserCard}>
                      <View style={styles.adminUserHeader}>
                        <View style={[
                          styles.adminUserAvatar,
                          { backgroundColor: user.isPremium ? "#fbbf24" : "#8b5cf6" }
                        ]}>
                          <Text style={styles.adminUserAvatarText}>
                            {(user.nickname || user.name || user.email || "?").charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.adminUserInfo}>
                          <View style={styles.adminUserNameRow}>
                            <Text style={styles.adminUserName}>
                              {user.nickname || user.name || "Anonymous"}
                            </Text>
                            {user.isPremium && (
                              <View style={styles.premiumBadge}>
                                <Ionicons name="star" size={10} color="#0b0814" />
                                <Text style={styles.premiumBadgeText}>
                                  {user.premiumType === "family" ? "Family" : "Plus"}
                                </Text>
                              </View>
                            )}
                          </View>
                          {user.email && (
                            <Text style={styles.adminUserEmail}>{user.email}</Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.adminUserStats}>
                        <View style={styles.adminUserStatItem}>
                          <Ionicons name="search" size={14} color="#6b7280" />
                          <Text style={styles.adminUserStatText}>{user.dailySearches} iskanj</Text>
                        </View>
                        {user.totalSavings !== undefined && user.totalSavings > 0 && (
                          <View style={styles.adminUserStatItem}>
                            <Ionicons name="trending-down" size={14} color="#10b981" />
                            <Text style={styles.adminUserStatText}>
                              {formatCurrency(user.totalSavings)}
                            </Text>
                          </View>
                        )}
                        {user.location && (
                          <View style={styles.adminUserStatItem}>
                            <Ionicons name="location" size={14} color="#6b7280" />
                            <Text style={styles.adminUserStatText}>{user.location.country}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.adminUserMeta}>
                        <Text style={styles.adminUserMetaText}>
                          Registriran: {new Date(user._creationTime).toLocaleDateString('sl-SI')}
                        </Text>
                        {user.lastActivity && (
                          <Text style={styles.adminUserMetaText}>
                            Aktiven: {new Date(user.lastActivity).toLocaleDateString('sl-SI')}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyAdminUsers}>
                    <Ionicons name="people-outline" size={48} color="#6b7280" />
                    <Text style={styles.emptyAdminUsersText}>Ni uporabnikov</Text>
                  </View>
                )}
              </ScrollView>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* AI Suggestions Modal */}
      {showAISuggestionsModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.modalContent, { maxHeight: "85%" }]}>
            <LinearGradient
              colors={["rgba(236, 72, 153, 0.2)", "rgba(147, 51, 234, 0.3)"]}
              style={[styles.modalGradient, { height: "100%" }]}
            >
              <View style={styles.adminModalHeader}>
                <View>
                  <Text style={styles.modalTitle}>AI Predlogi za Izboljšave</Text>
                  <Text style={styles.modalSubtitle}>
                    {aiSuggestions?.length || 0} {aiSuggestions?.length === 1 ? "predlog" : "predlogov"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setShowAISuggestionsModal(false)}
                >
                  <Ionicons name="close" size={24} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.adminUsersList} showsVerticalScrollIndicator={false}>
                {aiSuggestions && aiSuggestions.length > 0 ? (
                  aiSuggestions.map((suggestion: {
                    type: string;
                    priority: string;
                    searchQuery: string;
                    suggestion: string;
                    metrics: {
                      searchCount: number;
                      averageResults: number;
                      clickRate: number;
                    };
                  }, index: number) => (
                    <View key={index} style={styles.aiSuggestionCard}>
                      {/* Priority Badge */}
                      <View style={[
                        styles.aiPriorityBadge,
                        suggestion.priority === "high"
                          ? styles.aiPriorityHigh
                          : suggestion.priority === "medium"
                          ? styles.aiPriorityMedium
                          : styles.aiPriorityLow
                      ]}>
                        <Text style={styles.aiPriorityText}>
                          {suggestion.priority === "high" ? "🔴 Visoka" :
                           suggestion.priority === "medium" ? "🟡 Srednja" : "🟢 Nizka"}
                        </Text>
                      </View>

                      {/* Type Badge */}
                      <View style={styles.aiTypeBadge}>
                        <Text style={styles.aiTypeText}>
                          {suggestion.type === "missing_product" ? "📦 Manjka izdelek" :
                           suggestion.type === "poor_results" ? "🔍 Slabi rezultati" :
                           suggestion.type === "poor_relevance" ? "❌ Slaba relevantnost" :
                           "✅ Popularno iskanje"}
                        </Text>
                      </View>

                      {/* Search Query */}
                      <View style={styles.aiQueryContainer}>
                        <Ionicons name="search" size={16} color="#cbd5e1" />
                        <Text style={styles.aiQueryText}>"{suggestion.searchQuery}"</Text>
                      </View>

                      {/* Suggestion */}
                      <Text style={styles.aiSuggestionText}>{suggestion.suggestion}</Text>

                      {/* Metrics */}
                      <View style={styles.aiMetricsContainer}>
                        <View style={styles.aiMetric}>
                          <Ionicons name="search-outline" size={14} color="#6b7280" />
                          <Text style={styles.aiMetricText}>
                            {suggestion.metrics.searchCount} iskanj
                          </Text>
                        </View>
                        <View style={styles.aiMetric}>
                          <Ionicons name="list-outline" size={14} color="#6b7280" />
                          <Text style={styles.aiMetricText}>
                            Avg {suggestion.metrics.averageResults.toFixed(1)} rezultatov
                          </Text>
                        </View>
                        <View style={styles.aiMetric}>
                          <Ionicons name="hand-left-outline" size={14} color="#6b7280" />
                          <Text style={styles.aiMetricText}>
                            {suggestion.metrics.clickRate.toFixed(1)}% click rate
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyAdminUsers}>
                    <Ionicons name="bulb-outline" size={48} color="#6b7280" />
                    <Text style={styles.emptyAdminUsersText}>Ni predlogov</Text>
                    <Text style={[styles.emptyAdminUsersText, { fontSize: 14, marginTop: 8 }]}>
                      AI bo analiziral iskanja v naslednjih 7 dneh
                    </Text>
                  </View>
                )}
              </ScrollView>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* User Suggestions Modal */}
      {showUserSuggestionsModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.modalContent, { maxHeight: "85%" }]}>
            <LinearGradient
              colors={["rgba(236, 72, 153, 0.2)", "rgba(59, 7, 100, 0.35)"]}
              style={[styles.modalGradient, { height: "100%" }]}
            >
              <View style={styles.adminModalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Predlogi uporabnikov</Text>
                  <Text style={styles.modalSubtitle}>
                    {suggestionsList.length} {suggestionsList.length === 1 ? "predlog" : "predlogov"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setShowUserSuggestionsModal(false)}
                >
                  <Ionicons name="close" size={24} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.adminUsersList} showsVerticalScrollIndicator={false}>
                {suggestionsList.length > 0 ? (
                  suggestionsList.map((suggestion: {
                    _id: string;
                    title: string;
                    description: string;
                    suggestionType: string;
                    status: string;
                    submittedAt: number;
                    userNickname?: string;
                  }) => (
                    <View key={suggestion._id} style={styles.userSuggestionCard}>
                      <View style={styles.userSuggestionHeader}>
                        <Text style={styles.userSuggestionTitle}>{suggestion.title}</Text>
                        <View style={[styles.userSuggestionStatus, getSuggestionStatusStyle(suggestion.status)]}>
                          <Text style={styles.userSuggestionStatusText}>
                            {suggestionStatusLabels[suggestion.status] ?? suggestion.status}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.userSuggestionMetaRow}>
                        <Text style={styles.userSuggestionMeta}>
                          {suggestion.userNickname || "Anonimen"}
                        </Text>
                        <Text style={styles.userSuggestionMeta}>•</Text>
                        <Text style={styles.userSuggestionMeta}>
                          {suggestionTypeLabels[suggestion.suggestionType] ?? suggestion.suggestionType}
                        </Text>
                        <Text style={styles.userSuggestionMeta}>•</Text>
                        <Text style={styles.userSuggestionMeta}>
                          {formatDateShort(suggestion.submittedAt) ?? "--"}
                        </Text>
                      </View>
                      <Text style={styles.userSuggestionDescription}>{suggestion.description}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyAdminUsers}>
                    <Ionicons name="chatbubbles-outline" size={48} color="#6b7280" />
                    <Text style={styles.emptyAdminUsersText}>Ni predlogov</Text>
                  </View>
                )}
              </ScrollView>
            </LinearGradient>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0a1e",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 120 : Platform.OS === "android" ? 100 : 60,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  glowOrb: {
    position: "absolute",
    borderRadius: 999,
  },
  glowOrb1: {
    width: 250,
    height: 250,
    backgroundColor: "#8b5cf6",
    top: -80,
    left: -80,
    opacity: 0.15,
  },
  glowOrb2: {
    width: 200,
    height: 200,
    backgroundColor: "#fbbf24",
    bottom: 150,
    right: -60,
    opacity: 0.08,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 51,
    height: 102,
    marginBottom: 8,
  },
  profilePictureContainer: {
    position: "relative",
    width: 102,
    height: 102,
    marginBottom: 16,
  },
  profilePicture: {
    width: 102,
    height: 102,
    borderRadius: 51,
    borderWidth: 3,
    borderColor: "rgba(168, 85, 247, 0.4)",
  },
  profilePicturePlaceholder: {
    width: 102,
    height: 102,
    borderRadius: 51,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(168, 85, 247, 0.4)",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 51,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  profilePictureEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#a855f7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#0a0a12",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  nicknameRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nicknameText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#a78bfa",
  },
  nicknameEditButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(139, 92, 246, 0.2)",
  },
  nicknameEditButtonDisabled: {
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  nicknameHint: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
  authPrompt: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  authLogo: {
    width: 200,
    height: 200,
    marginBottom: 24,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 12,
  },
  authText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  authButton: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
  },
  authButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  planCard: {
    marginBottom: 28,
    borderRadius: 24,
    overflow: "hidden",
  },
  planGradient: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  planGradientPremium: {
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  planPremiumShadow: {
    ...createShadow("#fbbf24", 0, 10, 0.35, 18, 10),
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  planInfo: {},
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#a78bfa",
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  planBadgeTextPremium: {
    color: "#fbbf24",
  },
  planPrice: {
    fontSize: 14,
    color: "#9ca3af",
  },
  planExpiry: {
    fontSize: 12,
    color: "#a7f3d0",
    marginTop: 4,
    fontWeight: "600",
  },
  upgradeButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  upgradeGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  upgradeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    marginLeft: 6,
  },
  searchProgress: {
    marginBottom: 20,
  },
  searchProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  searchProgressLabel: {
    fontSize: 13,
    color: "#9ca3af",
  },
  searchProgressValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#8b5cf6",
    borderRadius: 4,
  },
  progressFillPremium: {
    backgroundColor: "#fbbf24",
  },
  searchWarning: {
    fontSize: 12,
    color: "#fbbf24",
    marginTop: 8,
  },
  searchTimer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  searchTimerText: {
    fontSize: 12,
    color: "#fbbf24",
    marginLeft: 6,
  },
  planFeatures: {
    gap: 10,
  },
  planFeature: {
    flexDirection: "row",
    alignItems: "center",
  },
  planFeatureText: {
    fontSize: 14,
    color: "#fff",
    marginLeft: 10,
  },
  planFeatureTextDisabled: {
    color: "#6b7280",
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 16,
  },
  adminHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  liveText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10b981",
    letterSpacing: 0.8,
  },
  adminCard: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.4)",
    ...createShadow("#8b5cf6", 0, 4, 0.2),
  },
  adminRow: {
    flexDirection: "row",
    gap: 12,
  },
  adminStat: {
    flex: 1,
    minWidth: 90,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.25)",
    alignItems: "center",
    gap: 6,
  },
  adminStatLabel: {
    fontSize: 11,
    color: "#cbd5e1",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 2,
  },
  adminStatValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
  },
  geoSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(139, 92, 246, 0.2)",
  },
  geoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  geoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#cbd5e1",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  geoList: {
    gap: 8,
  },
  geoItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.15)",
  },
  geoRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(139, 92, 246, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  geoRankText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#a78bfa",
  },
  geoCountry: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#e2e8f0",
  },
  geoCount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#8b5cf6",
  },
  emptyAwards: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    alignItems: "center",
    gap: 10,
  },
  emptyAwardsText: {
    fontSize: 13,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 18,
  },
  awardYearCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.25)",
    marginBottom: 16,
    ...createShadow("#8b5cf6", 0, 4, 0.15),
  },
  awardYearTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 10,
  },
  awardList: {
    gap: 8,
  },
  awardBadgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    ...createShadow("#8b5cf6", 0, 2, 0.1),
  },
  awardBadgeImage: {
    width: 64,
    height: 64,
    resizeMode: "contain",
  },
  awardBadgeInfo: {
    flex: 1,
    gap: 4,
  },
  awardBadgeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  awardBadgeMeta: {
    fontSize: 12,
    color: "#cbd5e1",
  },
  receiptCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
    marginBottom: 18,
    ...createShadow("#22c55e", 0, 3, 0.12),
  },
  receiptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  receiptTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  receiptMeta: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  receiptButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  receiptButtonDisabled: {
    opacity: 0.7,
  },
  receiptButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  receiptButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  receiptHint: {
    fontSize: 12,
    color: "#d1fae5",
    lineHeight: 18,
  },
  receiptList: {
    gap: 10,
  },
  receiptItem: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    gap: 6,
  },
  receiptItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  receiptStore: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  receiptDate: {
    fontSize: 12,
    color: "#9ca3af",
  },
  receiptTotal: {
    fontSize: 12,
    color: "#e5e7eb",
  },
  receiptSaved: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "700",
  },
  receiptInvalid: {
    fontSize: 11,
    color: "#fca5a5",
  },
  receiptEmpty: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 8,
  },
  storesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  storeCard: {
    width: "31%",
    borderRadius: 16,
    overflow: "hidden",
  },
  storeCardActive: {},
  storeCardLocked: {
    opacity: 0.6,
  },
  storeCardGradient: {
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.15)",
  },
  storeEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  storeName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
  },
  lockBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    borderRadius: 8,
    padding: 4,
  },
  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 8,
    padding: 4,
  },
  settingsList: {
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: 16,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.15)",
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  settingText: {
    flex: 1,
    fontSize: 15,
    color: "#fff",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  toastOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 30,
    alignItems: "center",
  },
  toastContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    backgroundColor: "rgba(2, 44, 34, 0.6)",
  },
  toastText: {
    color: "#d1fae5",
    fontSize: 14,
    fontWeight: "600",
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ef4444",
    marginLeft: 8,
  },
  settingItemDanger: {
    borderBottomWidth: 0,
  },
  settingTextDanger: {
    flex: 1,
    fontSize: 15,
    color: "#ef4444",
  },
  deleteIconContainer: {
    alignSelf: "center",
    marginBottom: 20,
  },
  deleteIconBg: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  deleteDescription: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelDeleteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  cancelDeleteText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  confirmDeleteButton: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  confirmDeleteGradient: {
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmDeleteText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  cancelIconContainer: {
    alignSelf: "center",
    marginBottom: 20,
  },
  cancelIconBg: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  cancelDescription: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  keepPremiumButton: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  keepPremiumGradient: {
    paddingVertical: 14,
    alignItems: "center",
  },
  keepPremiumText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9ca3af",
  },
  receiptModal: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    overflow: "hidden",
  },
  receiptModalGradient: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  receiptModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 16,
  },
  receiptPreview: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginBottom: 16,
  },
  receiptPlaceholder: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  receiptPlaceholderText: {
    fontSize: 13,
    color: "#cbd5e1",
  },
  receiptCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  receiptCheckBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  receiptCheckBoxChecked: {
    backgroundColor: "#22c55e",
  },
  receiptCheckText: {
    fontSize: 13,
    color: "#d1fae5",
    flex: 1,
    lineHeight: 18,
  },
  receiptErrorText: {
    fontSize: 12,
    color: "#fca5a5",
    marginBottom: 8,
  },
  receiptSuccessText: {
    fontSize: 12,
    color: "#86efac",
    marginBottom: 8,
  },
  receiptModalActions: {
    gap: 10,
  },
  receiptActionButton: {
    borderRadius: 14,
    overflow: "hidden",
  },
  receiptActionDisabled: {
    opacity: 0.7,
  },
  receiptActionGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  receiptActionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  receiptActionSecondary: {
    marginTop: 2,
  },
  nicknameModal: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    overflow: "hidden",
  },
  nicknameModalGradient: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  nicknameModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 16,
  },
  nicknameInputContainer: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.4)",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    marginBottom: 10,
  },
  nicknameInput: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: "#fff",
    fontSize: 15,
  },
  nicknameAvailabilityText: {
    fontSize: 12,
    marginBottom: 8,
  },
  nicknameAvailable: {
    color: "#10b981",
  },
  nicknameUnavailable: {
    color: "#f87171",
  },
  nicknameErrorText: {
    fontSize: 12,
    color: "#fca5a5",
    marginBottom: 8,
  },
  nicknameActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  nicknameCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  nicknameCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#cbd5e1",
  },
  nicknameSaveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  nicknameSaveGradient: {
    paddingVertical: 12,
    alignItems: "center",
  },
  nicknameSaveText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    overflow: "hidden",
  },
  modalGradient: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  modalClose: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
  modalLogo: {
    width: 174,
    height: 174,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  modalPrice: {
    fontSize: 16,
    color: "#fbbf24",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  modalFeatures: {
    marginBottom: 24,
  },
  modalFeatureRow: {
    flexDirection: "row",
  },
  modalFeatureCol: {
    flex: 1,
  },
  modalFeatureDivider: {
    width: 1,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    marginHorizontal: 16,
  },
  modalFeatureLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  modalFeatureLabelPremium: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fbbf24",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  modalFeature: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  modalFeatureText: {
    fontSize: 13,
    color: "#fff",
    marginLeft: 8,
  },
  modalFeatureTextDisabled: {
    fontSize: 13,
    color: "#6b7280",
    marginLeft: 8,
  },
  modalButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
  },
  modalButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginLeft: 8,
  },
  modalDisclaimer: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  familyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addMemberButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  addMemberText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fbbf24",
  },
  familyList: {
    gap: 12,
  },
  familyMemberCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    ...createShadow("#10b981", 0, 2, 0.1),
  },
  familyPendingCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    ...createShadow("#f59e0b", 0, 2, 0.1),
  },
  familyMemberIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  familyMemberInfo: {
    flex: 1,
  },
  familyMemberName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  familyMemberEmail: {
    fontSize: 13,
    color: "#9ca3af",
  },
  familyPendingText: {
    fontSize: 12,
    color: "#f59e0b",
    fontWeight: "600",
    marginTop: 2,
  },
  removeMemberButton: {
    padding: 4,
  },
  familyEmpty: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  familyEmptyText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  familyModalIcon: {
    alignSelf: "center",
    marginBottom: 20,
  },
  familyModalIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  familyInput: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#fff",
    marginBottom: 16,
  },
  familyErrorText: {
    fontSize: 13,
    color: "#ef4444",
    marginBottom: 12,
    textAlign: "center",
  },
  familySuccessText: {
    fontSize: 13,
    color: "#10b981",
    marginBottom: 12,
    textAlign: "center",
  },
  familyInviteButton: {
    borderRadius: 14,
    overflow: "hidden",
  },
  familyInviteGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  familyInviteText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0b0814",
  },
  // Admin Detailed Stats
  detailedStatsSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(139, 92, 246, 0.2)",
  },
  detailedStatsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#e5e7eb",
    marginBottom: 12,
  },
  detailedStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  detailedStatItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  detailedStatValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  detailedStatLabel: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
  },
  savingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  savingsText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10b981",
  },
  // Admin Users Modal
  adminModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.2)",
    marginBottom: 16,
  },
  adminUsersList: {
    flex: 1,
  },
  adminUserCard: {
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  adminUserHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  adminUserAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  adminUserAvatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  adminUserInfo: {
    flex: 1,
  },
  adminUserNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  adminUserName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  adminUserEmail: {
    fontSize: 13,
    color: "#9ca3af",
  },
  adminUserStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  adminUserStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  adminUserStatText: {
    fontSize: 12,
    color: "#cbd5e1",
  },
  adminUserMeta: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(139, 92, 246, 0.15)",
  },
  adminUserMetaText: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 2,
  },
  emptyAdminUsers: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyAdminUsersText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 12,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fbbf24",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0b0814",
  },
  // AI Suggestions Styles
  aiSuggestionsCard: {
    marginTop: 16,
    borderRadius: 20,
    overflow: "hidden",
  },
  aiSuggestionsGradient: {
    padding: 20,
  },
  aiSuggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  aiSuggestionsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  aiSuggestionsCount: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ec4899",
    marginBottom: 4,
  },
  aiSuggestionsSubtitle: {
    fontSize: 13,
    color: "#9ca3af",
  },
  aiSuggestionCard: {
    backgroundColor: "rgba(15, 10, 30, 0.6)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(236, 72, 153, 0.2)",
  },
  aiPriorityBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  aiPriorityHigh: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  aiPriorityMedium: {
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.4)",
  },
  aiPriorityLow: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  aiPriorityText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  aiTypeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  aiTypeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#c4b5fd",
  },
  aiQueryContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: 10,
  },
  aiQueryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e9d5ff",
    flex: 1,
  },
  aiSuggestionText: {
    fontSize: 14,
    color: "#d1d5db",
    lineHeight: 20,
    marginBottom: 12,
  },
  aiMetricsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(236, 72, 153, 0.15)",
  },
  aiMetric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  aiMetricText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  // Scraper Monitoring Styles
  scraperMonitoringCard: {
    backgroundColor: "rgba(15, 10, 30, 0.4)",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  scraperHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  scraperTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  scraperRow: {
    flexDirection: "row",
    gap: 12,
  },
  scraperItem: {
    flex: 1,
    backgroundColor: "rgba(15, 10, 30, 0.6)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  scraperLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 6,
  },
  scraperStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scraperTime: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e2e8f0",
  },
  // User Suggestions Styles
  suggestionsCard: {
    backgroundColor: "rgba(15, 10, 30, 0.4)",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(236, 72, 153, 0.3)",
  },
  suggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
    flex: 1,
  },
  suggestionsBadge: {
    backgroundColor: "#fbbf24",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionsBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0b0814",
  },
  suggestionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  suggestionStat: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(15, 10, 30, 0.6)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(236, 72, 153, 0.2)",
  },
  suggestionStatValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f3f4f6",
    marginBottom: 4,
  },
  suggestionStatLabel: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
  },
  suggestionsFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(236, 72, 153, 0.15)",
  },
  suggestionsFooterText: {
    fontSize: 12,
    color: "#fbcfe8",
    fontWeight: "600",
  },
  userSuggestionCard: {
    backgroundColor: "rgba(15, 10, 30, 0.5)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(236, 72, 153, 0.2)",
  },
  userSuggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  userSuggestionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#f8fafc",
  },
  userSuggestionStatus: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  userSuggestionStatusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#f8fafc",
  },
  userSuggestionStatusPending: {
    backgroundColor: "rgba(251, 191, 36, 0.18)",
    borderColor: "rgba(251, 191, 36, 0.5)",
  },
  userSuggestionStatusReviewing: {
    backgroundColor: "rgba(59, 130, 246, 0.18)",
    borderColor: "rgba(59, 130, 246, 0.5)",
  },
  userSuggestionStatusApproved: {
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    borderColor: "rgba(16, 185, 129, 0.5)",
  },
  userSuggestionStatusRejected: {
    backgroundColor: "rgba(248, 113, 113, 0.2)",
    borderColor: "rgba(248, 113, 113, 0.5)",
  },
  userSuggestionStatusDuplicate: {
    backgroundColor: "rgba(148, 163, 184, 0.18)",
    borderColor: "rgba(148, 163, 184, 0.4)",
  },
  userSuggestionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  userSuggestionMeta: {
    fontSize: 11,
    color: "#cbd5e1",
  },
  userSuggestionDescription: {
    fontSize: 13,
    color: "#e2e8f0",
    lineHeight: 18,
  },
  // Feedback Button Styles
  feedbackButton: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(236, 72, 153, 0.3)",
  },
  feedbackButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 12,
  },
  feedbackButtonContent: {
    flex: 1,
  },
  feedbackButtonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  feedbackButtonTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  feedbackButtonSubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    lineHeight: 18,
  },
  feedbackModal: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    overflow: "hidden",
  },
  feedbackModalGradient: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(236, 72, 153, 0.3)",
  },
  feedbackModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 6,
  },
  feedbackModalSubtitle: {
    fontSize: 12,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 12,
  },
  feedbackTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  feedbackTypeChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  feedbackTypeChipActive: {
    backgroundColor: "rgba(236, 72, 153, 0.2)",
    borderColor: "rgba(236, 72, 153, 0.4)",
  },
  feedbackTypeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#cbd5e1",
  },
  feedbackTypeTextActive: {
    color: "#fce7f3",
  },
  feedbackInputContainer: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.25)",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    marginBottom: 10,
  },
  feedbackInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 14,
  },
  feedbackInputMultiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  feedbackError: {
    fontSize: 12,
    color: "#fca5a5",
    marginBottom: 6,
    textAlign: "center",
  },
  feedbackSuccess: {
    fontSize: 12,
    color: "#6ee7b7",
    marginBottom: 6,
    textAlign: "center",
  },
  feedbackActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  feedbackCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  feedbackCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#e2e8f0",
  },
  feedbackSubmit: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  feedbackSubmitDisabled: {
    opacity: 0.7,
  },
  feedbackSubmitGradient: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackSubmitText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.4,
  },
});

export default function ProfileScreen() {
  return (
    <ProfileErrorBoundary>
      <ProfileScreenInner />
    </ProfileErrorBoundary>
  );
}

