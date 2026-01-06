import { useState, useRef, useEffect, useCallback } from "react";
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
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { useConvexAuth } from "convex/react";
import { getSeasonalLogoSource } from "@/lib/Logo";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 88 : 72;

// ============================================================================
// TYPES
// ============================================================================

type FamilyMember = {
  userId: string;
  nickname: string;
  email?: string;
  profilePictureUrl?: string;
  joinedAt?: number;
};

type PendingInvite = {
  id: string;
  email: string;
  token: string;
  createdAt: number;
  expiresAt: number;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

  // ============================================================================
  // STATE
  // ============================================================================
  
  const [profileLoadingTimedOut, setProfileLoadingTimedOut] = useState(false);
  const [retryingProfile, setRetryingProfile] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("improvement");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState<string | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const profile = useQuery(api.userProfiles.getProfile, isAuthenticated ? {} : "skip");
  const ensureProfile = useMutation(api.userProfiles.ensureProfile);
  
  // Family data - only fetch if user has family plan
  const familyData = useQuery(
    api.familyPlan.getFamilyMembers,
    isAuthenticated && profile?.premiumType === "family" ? {} : "skip"
  );
  const pendingInvites = useQuery(
    api.familyPlan.getPendingInvitations,
    isAuthenticated && profile?.premiumType === "family" ? {} : "skip"
  );

  // Mutations
  const inviteFamilyMember = useAction(api.familyPlan.inviteFamilyMember);
  const removeFamilyMember = useMutation(api.familyPlan.removeFamilyMember);
  const cancelInvitation = useMutation(api.familyPlan.cancelInvitation);
  const updateProfilePicture = useMutation(api.userProfiles.updateProfilePicture);
  const sendFeedback = useAction(api.feedback.sendFeedback);

  // Feedback categories
  const FEEDBACK_CATEGORIES = [
    { id: "bug", label: "Napaka / Bug", icon: "bug" as const },
    { id: "feature", label: "Nova funkcija", icon: "bulb" as const },
    { id: "improvement", label: "Izboljšava", icon: "trending-up" as const },
    { id: "design", label: "Dizajn / Izgled", icon: "color-palette" as const },
    { id: "other", label: "Drugo", icon: "chatbubble" as const },
  ];

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Profile loading timeout
  useEffect(() => {
    if (profile !== undefined || !isAuthenticated) {
      setProfileLoadingTimedOut(false);
      return;
    }
    
    const timeout = setTimeout(() => {
      if (profile === undefined && isAuthenticated) {
        console.warn("Profile loading timeout");
        setProfileLoadingTimedOut(true);
      }
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [isAuthenticated, profile]);

  // Entry animation
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

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isProfileLoading = isAuthenticated && profile === undefined && !profileLoadingTimedOut;
  const isOwner = familyData?.isOwner ?? false;
  const familyMembers: FamilyMember[] = familyData?.members ?? [];
  const pendingInvitations: PendingInvite[] = (pendingInvites ?? []) as PendingInvite[];
  const availableSlots = familyData?.availableSlots ?? 0;
  const canInvite = isOwner && availableSlots > 0;

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRetryProfile = useCallback(async () => {
    if (retryingProfile) return;
    setRetryingProfile(true);
    try {
      await ensureProfile({});
      setProfileLoadingTimedOut(false);
    } catch (error) {
      console.error("Profile creation error:", error);
      Alert.alert("Napaka", "Profila ni bilo mogoče ustvariti.");
    } finally {
      setRetryingProfile(false);
    }
  }, [retryingProfile, ensureProfile]);

  const handleMemberPress = useCallback((member: FamilyMember) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedMember(member);
    setShowMemberModal(true);
  }, []);

  const handleRemoveMember = useCallback(async () => {
    if (!selectedMember) return;
    
    try {
      await removeFamilyMember({ memberUserId: selectedMember.userId });
      setShowMemberModal(false);
      setSelectedMember(null);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Remove member error:", error);
      Alert.alert("Napaka", "Člana ni bilo mogoče odstraniti.");
    }
  }, [selectedMember, removeFamilyMember]);

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) {
      setInviteError("Vnesi email naslov");
      return;
    }
    
    setInviting(true);
    setInviteError("");
    
    try {
      const result = await inviteFamilyMember({ email: inviteEmail.trim().toLowerCase() });
      if (!result.success) {
        setInviteError(result.message || "Vabilo ni uspelo");
        return;
      }
      
      setShowInviteModal(false);
      setInviteEmail("");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Uspešno", "Vabilo poslano!");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Vabilo ni uspelo";
      setInviteError(errorMessage);
    } finally {
      setInviting(false);
    }
  }, [inviteEmail, inviteFamilyMember]);

  const handleCancelInvite = useCallback(async (inviteId: string) => {
    try {
      await cancelInvitation({ invitationId: inviteId as never });
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.error("Cancel invite error:", error);
    }
  }, [cancelInvitation]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.replace("/auth");
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setSigningOut(false);
    }
  }, [router]);

  // Handle profile picture change
  const handleChangeProfilePicture = useCallback(async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Dovoljenje potrebno", "Za izbiro slike potrebujemo dostop do galerije.");
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      setUploadingImage(true);

      // Convert to data URI (base64)
      const dataUri = `data:image/jpeg;base64,${asset.base64}`;
      
      // Save to Convex
      const response = await updateProfilePicture({ profilePictureUrl: dataUri });
      
      if (response.success) {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert("Uspešno", "Profilna slika je bila posodobljena!");
      } else {
        Alert.alert("Napaka", response.error || "Slike ni bilo mogoče shraniti.");
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Napaka", "Pri nalaganju slike je prišlo do napake.");
    } finally {
      setUploadingImage(false);
    }
  }, [updateProfilePicture]);

  // Handle feedback submission
  const handleSendFeedback = useCallback(async () => {
    if (!feedbackMessage.trim()) {
      Alert.alert("Napaka", "Prosim vnesite vaše sporočilo.");
      return;
    }

    setSendingFeedback(true);
    
    try {
      const result = await sendFeedback({
        category: feedbackCategory,
        message: feedbackMessage.trim(),
        userEmail: profile?.email || undefined,
        userName: profile?.nickname || profile?.name || undefined,
      });
      
      if (result.success) {
        setShowFeedbackModal(false);
        setFeedbackMessage("");
        setFeedbackCategory("improvement");
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert("Hvala! 💜", "Vaše sporočilo je bilo uspešno poslano. Hvala za vaš prispevek k izboljšavi aplikacije!");
      } else {
        Alert.alert("Napaka", result.error || "Sporočila ni bilo mogoče poslati.");
      }
    } catch (error) {
      console.error("Feedback error:", error);
      Alert.alert("Napaka", "Sporočila ni bilo mogoče poslati.");
    } finally {
      setSendingFeedback(false);
    }
  }, [feedbackMessage, feedbackCategory, profile?.email, profile?.nickname, profile?.name, sendFeedback]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  // Loading state while auth is checking
  if (isAuthLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0a0a0f", "#1a1025", "#0a0a0f"]} style={StyleSheet.absoluteFill} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#a855f7" />
        </View>
      </View>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0a0a0f", "#1a1025", "#0a0a0f"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.centerContent, { paddingTop: insets.top + 40 }]}>
          <Image source={getSeasonalLogoSource()} style={styles.logo} resizeMode="contain" />
          <Text style={styles.authTitle}>Prijava potrebna</Text>
          <Text style={styles.authSubtitle}>Prijavi se za dostop do profila</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/auth")}>
            <LinearGradient colors={["#a855f7", "#7c3aed"]} style={styles.buttonGradient}>
              <Text style={styles.buttonText}>Prijava</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Profile loading
  if (isProfileLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0a0a0f", "#1a1025", "#0a0a0f"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.centerContent, { paddingTop: insets.top + 40 }]}>
          <Image source={getSeasonalLogoSource()} style={styles.logo} resizeMode="contain" />
          <ActivityIndicator size="large" color="#a855f7" style={{ marginTop: 24 }} />
          <Text style={styles.loadingText}>Nalaganje profila...</Text>
          <TouchableOpacity
            style={[styles.secondaryButton, { marginTop: 20 }]}
            onPress={handleRetryProfile}
            disabled={retryingProfile}
          >
            <Text style={styles.secondaryButtonText}>
              {retryingProfile ? "Ustvarjam..." : "Osveži"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Profile not found / timeout - show create button
  if (profileLoadingTimedOut || profile === null) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0a0a0f", "#1a1025", "#0a0a0f"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.centerContent, { paddingTop: insets.top + 40 }]}>
          <Image source={getSeasonalLogoSource()} style={styles.logo} resizeMode="contain" />
          <Text style={styles.authTitle}>Profil ni najden</Text>
          <Text style={styles.authSubtitle}>Ustvari svoj profil za začetek</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { opacity: retryingProfile ? 0.6 : 1 }]}
            onPress={handleRetryProfile}
            disabled={retryingProfile}
          >
            <LinearGradient colors={["#a855f7", "#7c3aed"]} style={styles.buttonGradient}>
              <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>
                {retryingProfile ? "Ustvarjam..." : "Ustvari profil"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryButton, { marginTop: 16 }]} onPress={handleSignOut}>
            <Text style={styles.secondaryButtonText}>Odjava</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Safety check - should never reach here but TypeScript needs it
  if (!profile) {
    return null;
  }

  // ============================================================================
  // MAIN PROFILE UI
  // ============================================================================

  const hasFamilyPlan = profile.premiumType === "family";

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0a0a0f", "#1a1025", "#0a0a0f"]} style={StyleSheet.absoluteFill} />
      
      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={[
          styles.scrollContent, 
          { 
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 20 
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================== */}
        {/* PREMIUM HERO PROFILE CARD */}
        {/* ================================================================== */}
        
        <View style={styles.heroCard}>
          <LinearGradient
            colors={["rgba(168, 85, 247, 0.15)", "rgba(124, 58, 237, 0.05)"]}
            style={styles.heroCardGradient}
          />
          
          {/* Profile Avatar with Edit */}
          <TouchableOpacity 
            onPress={handleChangeProfilePicture}
            activeOpacity={0.8}
            disabled={uploadingImage}
            style={styles.heroAvatarWrapper}
          >
            <View style={styles.heroAvatarContainer}>
              {uploadingImage ? (
                <LinearGradient colors={["#a855f7", "#7c3aed"]} style={styles.heroAvatarGradient}>
                  <ActivityIndicator size="large" color="#fff" />
                </LinearGradient>
              ) : profile.profilePictureUrl ? (
                <Image source={{ uri: profile.profilePictureUrl }} style={styles.heroAvatar} />
              ) : (
                <LinearGradient colors={["#a855f7", "#7c3aed"]} style={styles.heroAvatarGradient}>
                  <Text style={styles.heroAvatarInitial}>
                    {(profile.nickname || profile.name || "U").charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
              {/* Animated ring for premium */}
              {profile.isPremium && (
                <View style={styles.premiumRing} />
              )}
            </View>
            {/* Camera badge */}
            <View style={styles.cameraEditBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          
          {/* Name & Email */}
          <Text style={styles.heroName}>
            {profile.nickname || profile.name || "Uporabnik"}
          </Text>
          <Text style={styles.heroEmail}>{profile.email}</Text>
          
          {/* Premium Badge */}
          {profile.isPremium ? (
            <View style={styles.premiumBadgeContainer}>
              <LinearGradient
                colors={["#fbbf24", "#f59e0b"]}
                style={styles.premiumBadge}
              >
                <Ionicons name="star" size={14} color="#0a0a0f" />
                <Text style={styles.premiumBadgeText}>
                  {profile.premiumType === "family" ? "Family Premium" : "Premium Plus"}
                </Text>
              </LinearGradient>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.upgradeBadge}
              onPress={() => router.push("/premium")}
            >
              <Ionicons name="sparkles" size={14} color="#a855f7" />
              <Text style={styles.upgradeBadgeText}>Nadgradi na Premium</Text>
              <Ionicons name="chevron-forward" size={14} color="#a855f7" />
            </TouchableOpacity>
          )}
        </View>

        {/* ================================================================== */}
        {/* FAMILY MEMBERS (if family plan) */}
        {/* ================================================================== */}
        
        {hasFamilyPlan && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>👨‍👩‍👧‍👦 Družinski člani</Text>
                <TouchableOpacity 
                  onPress={() => setShowInfoTooltip(showInfoTooltip === "family" ? null : "family")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="information-circle-outline" size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>
              {showInfoTooltip === "family" && (
                <View style={styles.tooltipBox}>
                  <Text style={styles.tooltipText}>
                    Z Family Premium lahko povabite do 5 članov, ki bodo imeli dostop do vseh premium funkcij. 
                    Vsi člani si delijo ugodnosti, vsak pa ima svoj profil.
                  </Text>
                </View>
              )}
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.familyScroll}
            >
              {/* Family Members */}
              {familyMembers.map((member) => (
                <TouchableOpacity
                  key={member.userId}
                  style={styles.familyMemberItem}
                  onPress={() => handleMemberPress(member)}
                  activeOpacity={0.8}
                >
                  <View style={styles.familyAvatarContainer}>
                    {member.profilePictureUrl ? (
                      <Image source={{ uri: member.profilePictureUrl }} style={styles.familyAvatar} />
                    ) : (
                      <LinearGradient colors={["#6366f1", "#4f46e5"]} style={styles.familyAvatarGradient}>
                        <Text style={styles.familyAvatarInitial}>
                          {(member.nickname || "?").charAt(0).toUpperCase()}
                        </Text>
                      </LinearGradient>
                    )}
                  </View>
                  <Text style={styles.familyMemberName} numberOfLines={1}>{member.nickname}</Text>
                </TouchableOpacity>
              ))}

              {/* Pending Invites */}
              {pendingInvitations.map((invite) => (
                <TouchableOpacity
                  key={invite.id}
                  style={styles.familyMemberItem}
                  onPress={() => {
                    Alert.alert(
                      "Čakajoče vabilo",
                      `Email: ${invite.email}\n\nŽeliš preklicati vabilo?`,
                      [
                        { text: "Prekliči vabilo", style: "destructive", onPress: () => handleCancelInvite(invite.id) },
                        { text: "Zapri", style: "cancel" },
                      ]
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.familyAvatarContainer, styles.pendingAvatarStyle]}>
                    <Ionicons name="hourglass-outline" size={24} color="#6b7280" />
                  </View>
                  <Text style={[styles.familyMemberName, { color: "#6b7280" }]} numberOfLines={1}>
                    Čaka...
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Add Member Button */}
              {canInvite && (
                <TouchableOpacity
                  style={styles.familyMemberItem}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowInviteModal(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.familyAvatarContainer, styles.addMemberAvatar]}>
                    <Ionicons name="person-add" size={24} color="#a855f7" />
                  </View>
                  <Text style={[styles.familyMemberName, { color: "#a855f7" }]}>Povabi</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            
            <Text style={styles.sectionSubtext}>
              {availableSlots > 0 
                ? `Še ${availableSlots} prost${availableSlots === 1 ? "o" : "a"} mest${availableSlots === 1 ? "o" : "a"}`
                : "Vsa mesta so zasedena"}
            </Text>
          </View>
        )}

        {/* ================================================================== */}
        {/* QUICK ACTIONS */}
        {/* ================================================================== */}
        
        <View style={styles.quickActionsCard}>
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => setShowFeedbackModal(true)}
          >
            <LinearGradient
              colors={["rgba(168, 85, 247, 0.2)", "rgba(124, 58, 237, 0.1)"]}
              style={styles.quickActionGradient}
            >
              <Ionicons name="chatbubble-ellipses" size={26} color="#a855f7" />
            </LinearGradient>
            <Text style={styles.quickActionLabel}>Predlogi</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => router.push("/receipts")}
          >
            <LinearGradient
              colors={["rgba(59, 130, 246, 0.2)", "rgba(37, 99, 235, 0.1)"]}
              style={styles.quickActionGradient}
            >
              <Ionicons name="receipt" size={26} color="#3b82f6" />
            </LinearGradient>
            <Text style={styles.quickActionLabel}>Računi</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => setShowSettingsModal(true)}
          >
            <LinearGradient
              colors={["rgba(99, 102, 241, 0.2)", "rgba(79, 70, 229, 0.1)"]}
              style={styles.quickActionGradient}
            >
              <Ionicons name="settings" size={26} color="#6366f1" />
            </LinearGradient>
            <Text style={styles.quickActionLabel}>Nastavitve</Text>
          </TouchableOpacity>
        </View>

        {/* ================================================================== */}
        {/* MENU ITEMS */}
        {/* ================================================================== */}
        
        <View style={styles.menuCard}>
          {/* Loyalty Cards */}
          <TouchableOpacity style={styles.menuItemNew} onPress={() => router.push("/loyalty-cards")}>
            <View style={styles.menuItemNewLeft}>
              <LinearGradient colors={["rgba(59, 130, 246, 0.2)", "rgba(37, 99, 235, 0.1)"]} style={styles.menuIconNew}>
                <Ionicons name="card" size={20} color="#3b82f6" />
              </LinearGradient>
              <Text style={styles.menuItemTextNew}>Kartice zvestobe</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#4b5563" />
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity style={styles.menuItemNew} onPress={() => router.push("/notifications")}>
            <View style={styles.menuItemNewLeft}>
              <LinearGradient colors={["rgba(236, 72, 153, 0.2)", "rgba(219, 39, 119, 0.1)"]} style={styles.menuIconNew}>
                <Ionicons name="notifications" size={20} color="#ec4899" />
              </LinearGradient>
              <Text style={styles.menuItemTextNew}>Obvestila</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#4b5563" />
          </TouchableOpacity>

          {/* Help */}
          <TouchableOpacity style={styles.menuItemNew} onPress={() => router.push("/help")}>
            <View style={styles.menuItemNewLeft}>
              <LinearGradient colors={["rgba(16, 185, 129, 0.2)", "rgba(5, 150, 105, 0.1)"]} style={styles.menuIconNew}>
                <Ionicons name="help-circle" size={20} color="#10b981" />
              </LinearGradient>
              <Text style={styles.menuItemTextNew}>Pomoč</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#4b5563" />
          </TouchableOpacity>

          {/* Privacy */}
          <TouchableOpacity style={[styles.menuItemNew, { borderBottomWidth: 0 }]} onPress={() => router.push("/privacy")}>
            <View style={styles.menuItemNewLeft}>
              <LinearGradient colors={["rgba(99, 102, 241, 0.2)", "rgba(79, 70, 229, 0.1)"]} style={styles.menuIconNew}>
                <Ionicons name="shield-checkmark" size={20} color="#6366f1" />
              </LinearGradient>
              <Text style={styles.menuItemTextNew}>Zasebnost</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#4b5563" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity 
          style={styles.logoutButtonNew} 
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutTextNew}>
            {signingOut ? "Odjavljam..." : "Odjava"}
          </Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionTextNew}>Pr'Hran v2.0.0</Text>

      </Animated.ScrollView>

      {/* ================================================================== */}
      {/* MEMBER DETAIL MODAL */}
      {/* ================================================================== */}
      
      <Modal
        visible={showMemberModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMemberModal(false)}
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowMemberModal(false)}
          >
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Družinski član</Text>
                <TouchableOpacity onPress={() => setShowMemberModal(false)}>
                  <Ionicons name="close" size={24} color="#9ca3af" />
                </TouchableOpacity>
              </View>
              
              {selectedMember && (
                <View style={styles.memberDetail}>
                  <View style={styles.memberDetailAvatar}>
                    {selectedMember.profilePictureUrl ? (
                      <Image source={{ uri: selectedMember.profilePictureUrl }} style={styles.memberDetailImage} />
                    ) : (
                      <LinearGradient colors={["#6366f1", "#4f46e5"]} style={styles.memberDetailPlaceholder}>
                        <Text style={styles.memberDetailInitial}>
                          {(selectedMember.nickname || "?").charAt(0).toUpperCase()}
                        </Text>
                      </LinearGradient>
                    )}
                  </View>
                  <Text style={styles.memberDetailName}>{selectedMember.nickname}</Text>
                  {selectedMember.email && (
                    <Text style={styles.memberDetailEmail}>{selectedMember.email}</Text>
                  )}
                  
                  {isOwner && (
                    <TouchableOpacity 
                      style={styles.removeButton}
                      onPress={() => {
                        Alert.alert(
                          "Odstrani člana",
                          `Ali res želiš odstraniti ${selectedMember.nickname} iz družinskega načrta?`,
                          [
                            { text: "Prekliči", style: "cancel" },
                            { text: "Odstrani", style: "destructive", onPress: handleRemoveMember },
                          ]
                        );
                      }}
                    >
                      <Ionicons name="person-remove" size={18} color="#ef4444" />
                      <Text style={styles.removeButtonText}>Odstrani iz družine</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* ================================================================== */}
      {/* INVITE MODAL */}
      {/* ================================================================== */}
      
      <Modal
        visible={showInviteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
          <Pressable 
            style={styles.modalOverlay} 
            onPress={() => setShowInviteModal(false)}
          >
            <Pressable style={[styles.modalContent, styles.inviteModal]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Povabi člana</Text>
                <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                  <Ionicons name="close" size={24} color="#9ca3af" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.inviteDescription}>
                Vnesi email naslov osebe, ki jo želiš povabiti v svoj družinski načrt.
              </Text>
              
              <TextInput
                style={styles.inviteInput}
                placeholder="email@primer.com"
                placeholderTextColor="#6b7280"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              {inviteError ? (
                <Text style={styles.inviteError}>{inviteError}</Text>
              ) : null}
              
              <TouchableOpacity
                style={[styles.inviteButton, { opacity: inviting ? 0.6 : 1 }]}
                onPress={handleInvite}
                disabled={inviting}
              >
                <LinearGradient colors={["#fbbf24", "#f59e0b"]} style={styles.buttonGradient}>
                  <Text style={[styles.buttonText, { color: "#0a0a0f" }]}>
                    {inviting ? "Pošiljam..." : "Pošlji vabilo"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <Text style={styles.inviteNote}>
                Preostala mesta: {availableSlots}
              </Text>
            </Pressable>
          </Pressable>
        </BlurView>
      </Modal>

      {/* ================================================================== */}
      {/* SETTINGS MODAL */}
      {/* ================================================================== */}
      
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowSettingsModal(false)}
          >
            <View style={[styles.modalContent, styles.settingsModal]} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nastavitve</Text>
                <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                  <Ionicons name="close" size={24} color="#9ca3af" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Račun</Text>
                
                <View style={styles.settingsItem}>
                  <Text style={styles.settingsLabel}>Email</Text>
                  <Text style={styles.settingsValue}>{profile.email || "Ni nastavljeno"}</Text>
                </View>
                
                <View style={styles.settingsItem}>
                  <Text style={styles.settingsLabel}>Vzdevek</Text>
                  <Text style={styles.settingsValue}>{profile.nickname || profile.name || "Ni nastavljeno"}</Text>
                </View>
                
                <View style={styles.settingsItem}>
                  <Text style={styles.settingsLabel}>Email potrjen</Text>
                  <Text style={styles.settingsValue}>
                    {profile.emailVerified ? "Da ✓" : "Ne"}
                  </Text>
                </View>
              </View>
              
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Naročnina</Text>
                
                <View style={styles.settingsItem}>
                  <Text style={styles.settingsLabel}>Načrt</Text>
                  <Text style={styles.settingsValue}>
                    {profile.isPremium 
                      ? (profile.premiumType === "family" ? "Family" : "Plus")
                      : "Brezplačno"}
                  </Text>
                </View>
                
                {profile.premiumUntil && (
                  <View style={styles.settingsItem}>
                    <Text style={styles.settingsLabel}>Veljavnost</Text>
                    <Text style={styles.settingsValue}>
                      {new Date(profile.premiumUntil).toLocaleDateString("sl-SI")}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* ================================================================== */}
      {/* FEEDBACK MODAL */}
      {/* ================================================================== */}
      
      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
          <Pressable 
            style={styles.modalOverlay} 
            onPress={() => setShowFeedbackModal(false)}
          >
            <Pressable style={styles.feedbackModalContent} onPress={(e) => e.stopPropagation()}>
              {/* Header */}
              <LinearGradient
                colors={["rgba(168, 85, 247, 0.3)", "rgba(124, 58, 237, 0.1)"]}
                style={styles.feedbackHeader}
              >
                <View style={styles.feedbackHeaderContent}>
                  <Ionicons name="chatbubble-ellipses" size={28} color="#a855f7" />
                  <Text style={styles.feedbackTitle}>Predlogi & Povratne informacije</Text>
                </View>
                <TouchableOpacity onPress={() => setShowFeedbackModal(false)} style={styles.feedbackClose}>
                  <Ionicons name="close" size={24} color="#9ca3af" />
                </TouchableOpacity>
              </LinearGradient>
              
              <View style={styles.feedbackBody}>
                <Text style={styles.feedbackSubtitle}>
                  Vaše mnenje nam pomaga izboljšati aplikacijo! 💜
                </Text>
                
                {/* Category Selector */}
                <Text style={styles.feedbackLabel}>Kategorija</Text>
                <View style={styles.categoryGrid}>
                  {FEEDBACK_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        feedbackCategory === cat.id && styles.categoryChipActive
                      ]}
                      onPress={() => setFeedbackCategory(cat.id)}
                    >
                      <Ionicons 
                        name={cat.icon} 
                        size={16} 
                        color={feedbackCategory === cat.id ? "#fff" : "#9ca3af"} 
                      />
                      <Text style={[
                        styles.categoryChipText,
                        feedbackCategory === cat.id && styles.categoryChipTextActive
                      ]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {/* Message Input */}
                <Text style={styles.feedbackLabel}>Vaše sporočilo</Text>
                <TextInput
                  style={styles.feedbackTextInput}
                  placeholder="Opišite vašo idejo, napako ali predlog..."
                  placeholderTextColor="#6b7280"
                  value={feedbackMessage}
                  onChangeText={setFeedbackMessage}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
                
                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.feedbackSubmitButton, { opacity: sendingFeedback ? 0.6 : 1 }]}
                  onPress={handleSendFeedback}
                  disabled={sendingFeedback}
                >
                  <LinearGradient colors={["#a855f7", "#7c3aed"]} style={styles.feedbackSubmitGradient}>
                    {sendingFeedback ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.feedbackSubmitText}>Pošlji sporočilo</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                
                <Text style={styles.feedbackNote}>
                  Sporočilo bo poslano direktno razvijalcu
                </Text>
              </View>
            </Pressable>
          </Pressable>
        </BlurView>
      </Modal>
    </View>
  );
}

// ============================================================================
// STYLES - DARK THEME
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: "#9ca3af",
    marginBottom: 32,
    textAlign: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#9ca3af",
    marginTop: 16,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
    maxWidth: 280,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: "#a855f7",
    fontWeight: "600",
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f1f5f9",
  },

  // Profiles Section
  profilesSection: {
    marginBottom: 24,
  },
  profilesScroll: {
    paddingVertical: 8,
  },
  profileItem: {
    alignItems: "center",
    marginRight: 20,
  },
  profileAvatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 8,
    overflow: "hidden",
  },
  profileAvatarSelected: {
    borderWidth: 3,
    borderColor: "#a855f7",
  },
  profileAvatar: {
    width: "100%",
    height: "100%",
  },
  profileAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarInitial: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  cameraIconOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#a855f7",
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: "#0a0a0f",
  },
  profileName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e5e7eb",
    maxWidth: 72,
    textAlign: "center",
  },
  ownerBadge: {
    position: "absolute",
    top: 0,
    right: 4,
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 3,
  },
  pendingAvatar: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#374151",
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  addProfileAvatar: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#374151",
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },

  // Quick Actions
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(31, 41, 55, 0.6)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  quickActionItem: {
    alignItems: "center",
    flex: 1,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e5e7eb",
  },

  // Menu Section
  menuSection: {
    backgroundColor: "rgba(31, 41, 55, 0.6)",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(55, 65, 81, 0.5)",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#e5e7eb",
  },

  // Logout
  logoutButton: {
    alignItems: "center",
    paddingVertical: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
  },

  // Version
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1f2937",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f1f5f9",
  },

  // Member Detail
  memberDetail: {
    alignItems: "center",
    paddingVertical: 20,
  },
  memberDetailAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 16,
  },
  memberDetailImage: {
    width: "100%",
    height: "100%",
  },
  memberDetailPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  memberDetailInitial: {
    fontSize: 40,
    fontWeight: "700",
    color: "#fff",
  },
  memberDetailName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 4,
  },
  memberDetailEmail: {
    fontSize: 16,
    color: "#9ca3af",
    marginBottom: 24,
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 12,
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
    marginLeft: 8,
  },

  // Invite Modal
  inviteModal: {
    paddingBottom: 40,
  },
  inviteDescription: {
    fontSize: 15,
    color: "#9ca3af",
    marginBottom: 20,
    lineHeight: 22,
  },
  inviteInput: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#f1f5f9",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  feedbackInput: {
    minHeight: 120,
    paddingTop: 14,
  },
  inviteError: {
    fontSize: 14,
    color: "#ef4444",
    marginBottom: 12,
  },
  inviteButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 8,
  },
  inviteNote: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 16,
  },

  // Settings Modal
  settingsModal: {
    paddingBottom: 40,
  },
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#a855f7",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingsItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(55, 65, 81, 0.5)",
  },
  settingsLabel: {
    fontSize: 15,
    color: "#9ca3af",
  },
  settingsValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f1f5f9",
  },

  // ============================================================================
  // NEW PREMIUM STYLES
  // ============================================================================

  // Hero Card
  heroCard: {
    backgroundColor: "rgba(17, 24, 39, 0.8)",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.2)",
    overflow: "hidden",
  },
  heroCardGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
  },
  heroAvatarWrapper: {
    marginBottom: 16,
  },
  heroAvatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "rgba(168, 85, 247, 0.5)",
  },
  heroAvatar: {
    width: "100%",
    height: "100%",
  },
  heroAvatarGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  heroAvatarInitial: {
    fontSize: 40,
    fontWeight: "700",
    color: "#fff",
  },
  premiumRing: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: "#fbbf24",
  },
  cameraEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#a855f7",
    borderRadius: 16,
    padding: 8,
    borderWidth: 3,
    borderColor: "#0a0a0f",
  },
  heroName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 4,
  },
  heroEmail: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 16,
  },
  premiumBadgeContainer: {
    marginTop: 4,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  premiumBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0a0a0f",
  },
  upgradeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    gap: 6,
  },
  upgradeBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#a855f7",
  },

  // Section Card
  sectionCard: {
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(55, 65, 81, 0.5)",
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  sectionSubtext: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 12,
  },
  tooltipBox: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  tooltipText: {
    fontSize: 13,
    color: "#d1d5db",
    lineHeight: 20,
  },

  // Family Members
  familyScroll: {
    paddingVertical: 4,
  },
  familyMemberItem: {
    alignItems: "center",
    marginRight: 20,
    width: 70,
  },
  familyAvatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  familyAvatar: {
    width: "100%",
    height: "100%",
  },
  familyAvatarGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  familyAvatarInitial: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  familyMemberName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e5e7eb",
    textAlign: "center",
  },
  pendingAvatarStyle: {
    borderStyle: "dashed",
    borderColor: "#374151",
    backgroundColor: "rgba(55, 65, 81, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  addMemberAvatar: {
    borderStyle: "dashed",
    borderColor: "rgba(168, 85, 247, 0.5)",
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Quick Actions Card
  quickActionsCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(55, 65, 81, 0.5)",
  },
  quickActionGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#d1d5db",
  },

  // Menu Card
  menuCard: {
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(55, 65, 81, 0.5)",
  },
  menuItemNew: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(55, 65, 81, 0.5)",
  },
  menuItemNewLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIconNew: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuItemTextNew: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e5e7eb",
  },

  // Logout Button
  logoutButtonNew: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    marginBottom: 16,
  },
  logoutTextNew: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
  },
  versionTextNew: {
    fontSize: 12,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 20,
  },

  // Feedback Modal
  feedbackModalContent: {
    backgroundColor: "#111827",
    borderRadius: 24,
    overflow: "hidden",
    maxWidth: 400,
    width: "100%",
    maxHeight: "85%",
  },
  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  feedbackHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  feedbackClose: {
    padding: 4,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  feedbackBody: {
    padding: 20,
  },
  feedbackSubtitle: {
    fontSize: 15,
    color: "#9ca3af",
    marginBottom: 20,
    lineHeight: 22,
  },
  feedbackLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#d1d5db",
    marginBottom: 10,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(55, 65, 81, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(55, 65, 81, 0.8)",
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: "rgba(168, 85, 247, 0.3)",
    borderColor: "#a855f7",
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9ca3af",
  },
  categoryChipTextActive: {
    color: "#fff",
  },
  feedbackTextInput: {
    backgroundColor: "rgba(17, 24, 39, 0.8)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#f1f5f9",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(55, 65, 81, 0.8)",
    minHeight: 120,
    textAlignVertical: "top",
  },
  feedbackSubmitButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
  },
  feedbackSubmitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  feedbackSubmitText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  feedbackNote: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
  },
});

