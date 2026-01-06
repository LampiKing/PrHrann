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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { useConvexAuth } from "convex/react";
import { getSeasonalLogoSource } from "@/lib/Logo";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
      await removeFamilyMember({ memberId: selectedMember.userId });
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
        setInviteError(result.error || "Vabilo ni uspelo");
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

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  // Loading state while auth is checking
  if (isAuthLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#f8fafc", "#f1f5f9", "#e2e8f0"]} style={StyleSheet.absoluteFill} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      </View>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#f8fafc", "#f1f5f9", "#e2e8f0"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.centerContent, { paddingTop: insets.top + 40 }]}>
          <Image source={getSeasonalLogoSource()} style={styles.logo} resizeMode="contain" />
          <Text style={styles.authTitle}>Prijava potrebna</Text>
          <Text style={styles.authSubtitle}>Prijavi se za dostop do profila</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/auth")}>
            <LinearGradient colors={["#8b5cf6", "#7c3aed"]} style={styles.buttonGradient}>
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
        <LinearGradient colors={["#f8fafc", "#f1f5f9", "#e2e8f0"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.centerContent, { paddingTop: insets.top + 40 }]}>
          <Image source={getSeasonalLogoSource()} style={styles.logo} resizeMode="contain" />
          <ActivityIndicator size="large" color="#8b5cf6" style={{ marginTop: 24 }} />
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
        <LinearGradient colors={["#f8fafc", "#f1f5f9", "#e2e8f0"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.centerContent, { paddingTop: insets.top + 40 }]}>
          <Image source={getSeasonalLogoSource()} style={styles.logo} resizeMode="contain" />
          <Text style={styles.authTitle}>Profil ni najden</Text>
          <Text style={styles.authSubtitle}>Ustvari svoj profil za začetek</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { opacity: retryingProfile ? 0.6 : 1 }]}
            onPress={handleRetryProfile}
            disabled={retryingProfile}
          >
            <LinearGradient colors={["#8b5cf6", "#7c3aed"]} style={styles.buttonGradient}>
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

  // ============================================================================
  // MAIN PROFILE UI
  // ============================================================================

  const hasFamilyPlan = profile.premiumType === "family";

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#f8fafc", "#f1f5f9", "#e2e8f0"]} style={StyleSheet.absoluteFill} />
      
      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ================================================================== */}
        {/* FAMILY MEMBERS SECTION (or single profile) */}
        {/* ================================================================== */}
        
        <View style={styles.profilesSection}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.profilesScroll}
          >
            {/* Current User (Owner) */}
            <TouchableOpacity 
              style={styles.profileItem}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.profileAvatarContainer, styles.profileAvatarSelected]}>
                {profile.profilePictureUrl ? (
                  <Image source={{ uri: profile.profilePictureUrl }} style={styles.profileAvatar} />
                ) : (
                  <LinearGradient colors={["#8b5cf6", "#7c3aed"]} style={styles.profileAvatarPlaceholder}>
                    <Text style={styles.profileAvatarInitial}>
                      {(profile.nickname || profile.name || "U").charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
              </View>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile.nickname || profile.name || "Ti"}
              </Text>
              {hasFamilyPlan && isOwner && (
                <View style={styles.ownerBadge}>
                  <Ionicons name="star" size={10} color="#fbbf24" />
                </View>
              )}
            </TouchableOpacity>

            {/* Family Members */}
            {hasFamilyPlan && familyMembers.map((member) => (
              <TouchableOpacity
                key={member.userId}
                style={styles.profileItem}
                onPress={() => handleMemberPress(member)}
                activeOpacity={0.8}
              >
                <View style={styles.profileAvatarContainer}>
                  {member.profilePictureUrl ? (
                    <Image source={{ uri: member.profilePictureUrl }} style={styles.profileAvatar} />
                  ) : (
                    <LinearGradient colors={["#94a3b8", "#64748b"]} style={styles.profileAvatarPlaceholder}>
                      <Text style={styles.profileAvatarInitial}>
                        {(member.nickname || "?").charAt(0).toUpperCase()}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
                <Text style={styles.profileName} numberOfLines={1}>{member.nickname}</Text>
              </TouchableOpacity>
            ))}

            {/* Pending Invites */}
            {hasFamilyPlan && pendingInvitations.map((invite) => (
              <TouchableOpacity
                key={invite.id}
                style={styles.profileItem}
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
                <View style={[styles.profileAvatarContainer, styles.pendingAvatar]}>
                  <Ionicons name="hourglass-outline" size={28} color="#94a3b8" />
                </View>
                <Text style={[styles.profileName, { color: "#94a3b8" }]} numberOfLines={1}>
                  Čaka...
                </Text>
              </TouchableOpacity>
            ))}

            {/* Add Profile Button */}
            {hasFamilyPlan && canInvite && (
              <TouchableOpacity
                style={styles.profileItem}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowInviteModal(true);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.profileAvatarContainer, styles.addProfileAvatar]}>
                  <Ionicons name="add" size={32} color="#94a3b8" />
                </View>
                <Text style={[styles.profileName, { color: "#94a3b8" }]}>Dodaj</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* ================================================================== */}
        {/* QUICK ACTIONS */}
        {/* ================================================================== */}
        
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => router.push("/shopping-lists")}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="list" size={24} color="#8b5cf6" />
            </View>
            <Text style={styles.quickActionText}>Seznami</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => router.push("/receipts")}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="receipt" size={24} color="#8b5cf6" />
            </View>
            <Text style={styles.quickActionText}>Računi</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => setShowSettingsModal(true)}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="settings" size={24} color="#8b5cf6" />
            </View>
            <Text style={styles.quickActionText}>Nastavitve</Text>
          </TouchableOpacity>
        </View>

        {/* ================================================================== */}
        {/* MENU ITEMS */}
        {/* ================================================================== */}
        
        <View style={styles.menuSection}>
          {/* Premium Status */}
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/premium")}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: profile.isPremium ? "#fef3c7" : "#f3e8ff" }]}>
                <Ionicons 
                  name={profile.isPremium ? "star" : "star-outline"} 
                  size={20} 
                  color={profile.isPremium ? "#f59e0b" : "#8b5cf6"} 
                />
              </View>
              <Text style={styles.menuItemText}>
                {profile.isPremium 
                  ? (profile.premiumType === "family" ? "Family Premium" : "Premium Plus")
                  : "Nadgradi na Premium"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>

          {/* Loyalty Cards */}
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/loyalty-cards")}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "#dbeafe" }]}>
                <Ionicons name="card" size={20} color="#3b82f6" />
              </View>
              <Text style={styles.menuItemText}>Kartice zvestobe</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/notifications")}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "#fce7f3" }]}>
                <Ionicons name="notifications" size={20} color="#ec4899" />
              </View>
              <Text style={styles.menuItemText}>Obvestila</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>

          {/* Help */}
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/help")}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "#d1fae5" }]}>
                <Ionicons name="help-circle" size={20} color="#10b981" />
              </View>
              <Text style={styles.menuItemText}>Pomoč</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>

          {/* Privacy */}
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/privacy")}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: "#e0e7ff" }]}>
                <Ionicons name="shield-checkmark" size={20} color="#6366f1" />
              </View>
              <Text style={styles.menuItemText}>Zasebnost</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Text style={styles.logoutText}>
            {signingOut ? "Odjavljam..." : "Odjava"}
          </Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Pr'Hran v2.0.0</Text>

        <View style={{ height: insets.bottom + 100 }} />
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
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowMemberModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Družinski član</Text>
              <TouchableOpacity onPress={() => setShowMemberModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            {selectedMember && (
              <View style={styles.memberDetail}>
                <View style={styles.memberDetailAvatar}>
                  {selectedMember.profilePictureUrl ? (
                    <Image source={{ uri: selectedMember.profilePictureUrl }} style={styles.memberDetailImage} />
                  ) : (
                    <LinearGradient colors={["#94a3b8", "#64748b"]} style={styles.memberDetailPlaceholder}>
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
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowInviteModal(false)}
        >
          <View style={[styles.modalContent, styles.inviteModal]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Povabi družinskega člana</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inviteDescription}>
              Vnesi email naslov osebe, ki jo želiš povabiti v svoj družinski načrt.
            </Text>
            
            <TextInput
              style={styles.inviteInput}
              placeholder="email@primer.com"
              placeholderTextColor="#94a3b8"
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
                <Text style={[styles.buttonText, { color: "#1e293b" }]}>
                  {inviting ? "Pošiljam..." : "Pošlji vabilo"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <Text style={styles.inviteNote}>
              Preostala mesta: {availableSlots}
            </Text>
          </View>
        </TouchableOpacity>
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
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowSettingsModal(false)}
        >
          <View style={[styles.modalContent, styles.settingsModal]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nastavitve</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
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
      </Modal>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
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
    color: "#1e293b",
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 32,
    textAlign: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#64748b",
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
    color: "#8b5cf6",
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
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
  },

  // Profiles Section
  profilesSection: {
    marginBottom: 24,
  },
  profilesScroll: {
    paddingVertical: 8,
    gap: 16,
  },
  profileItem: {
    alignItems: "center",
    marginRight: 16,
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
    borderColor: "#8b5cf6",
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
  profileName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    maxWidth: 72,
    textAlign: "center",
  },
  ownerBadge: {
    position: "absolute",
    top: 0,
    right: 4,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 2,
  },
  pendingAvatar: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  addProfileAvatar: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },

  // Quick Actions
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  quickActionItem: {
    alignItems: "center",
    flex: 1,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#f3e8ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },

  // Menu Section
  menuSection: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
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
    color: "#1e293b",
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
    color: "#94a3b8",
    marginTop: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "80%",
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
    color: "#1e293b",
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
    color: "#1e293b",
    marginBottom: 4,
  },
  memberDetailEmail: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 24,
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#fef2f2",
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
    color: "#64748b",
    marginBottom: 20,
    lineHeight: 22,
  },
  inviteInput: {
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1e293b",
    marginBottom: 12,
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
    color: "#94a3b8",
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
    color: "#8b5cf6",
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
    borderBottomColor: "#f1f5f9",
  },
  settingsLabel: {
    fontSize: 15,
    color: "#64748b",
  },
  settingsValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
});

