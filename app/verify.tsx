import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Logo from "@/lib/Logo";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import FloatingBackground from "@/lib/FloatingBackground";

export default function VerifyEmailScreen() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [autoSent, setAutoSent] = useState(false);

  const profile = useQuery(api.userProfiles.getProfile);
  const verifyByCode = useMutation(api.emailVerification.verifyByCode);
  const requestEmailVerification = useAction(api.emailVerification.requestEmailVerification);

  // Auto-redirect if already verified
  useEffect(() => {
    if (profile && profile.emailVerified) {
      router.replace("/(tabs)");
    }
  }, [profile]);

  const handleVerify = async () => {
    if (!code.trim() || code.trim().length !== 6) {
      setError("Prosimo, vnesite 6-mestno kodo");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await verifyByCode({ code: code.trim() });
      if (res.success) {
        setSuccess("E-naslov potrjen! Preusmerjam...");
        setTimeout(() => router.replace("/(tabs)"), 1000);
      } else {
        setError("Neveljavna koda. Prosimo, poskusite znova.");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Napaka pri potrditvi";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await requestEmailVerification({});
      if (result.success) {
        setSuccess(`E-pošta ponovno poslana na ${result.email}.`);
      } else {
        setError("Napaka pri pošiljanju emaila. Prosimo, poskusite znova.");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Napaka pri pošiljanju";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile || profile.emailVerified || autoSent) return;
    setAutoSent(true);
    handleResend();
  }, [profile, autoSent]);


  if (!profile) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Nalaganje...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0a0a12", "#12081f", "#1a0a2e", "#270a3a", "#0f0a1e"]} style={StyleSheet.absoluteFill} />
      <FloatingBackground variant="sparse" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Logo size={100} />
          </View>

          {/* Title Section */}
          <View style={styles.headerSection}>
            <Ionicons name="mail-outline" size={48} color="#8b5cf6" />
            <Text style={styles.title}>Potrdi svoj e-naslov</Text>
            <Text style={styles.subtitle}>
              Poslali smo potrditveno kodo na{"\n"}
              <Text style={styles.emailText}>{profile.email}</Text>
            </Text>
            <Text style={styles.instructionText}>
              Preveri svojo e-pošto in vnesi 6-mestno kodo ali klikni na povezavo v e-pošti.
            </Text>
          </View>

          {/* Code Input */}
          <View style={styles.inputSection}>
            <View style={styles.inputContainer}>
              <Ionicons name="keypad-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="Vnesite 6-mestno kodo"
                placeholderTextColor="#6b7280"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleVerify}
              />
            </View>
          </View>

          {/* Error / Success Messages */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {success ? (
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          {/* Buttons */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading || code.trim().length !== 6}
          >
            <LinearGradient
              colors={loading ? ["#6b7280", "#4b5563"] : ["#c084fc", "#a855f7", "#7c3aed"]}
              style={styles.buttonGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Potrdi kodo</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, loading && styles.buttonDisabled]}
            onPress={handleResend}
            disabled={loading}
          >
            <Ionicons name="mail" size={18} color="#a78bfa" />
            <Text style={styles.secondaryButtonText}>Ponovno pošlji e-pošto</Text>
          </TouchableOpacity>

          {/* Help Text */}
          <View style={styles.helpSection}>
            <Ionicons name="help-circle-outline" size={16} color="#6b7280" />
            <Text style={styles.helpText}>
              Če ne vidiš e-pošte, preveri tudi mapo z neželeno pošto (spam).
            </Text>
          </View>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  loadingText: {
    color: "#a78bfa",
    marginTop: 16,
    fontSize: 16,
  },
  logoContainer: {
    marginBottom: 32,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginTop: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 22,
  },
  emailText: {
    color: "#8b5cf6",
    fontWeight: "700",
  },
  instructionText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  inputSection: {
    width: "100%",
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(31, 41, 55, 0.5)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 18,
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
    letterSpacing: 4,
    textAlign: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    width: "100%",
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    width: "100%",
  },
  successText: {
    color: "#6ee7b7",
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  button: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    gap: 8,
    marginBottom: 24,
  },
  secondaryButtonText: {
    color: "#a78bfa",
    fontSize: 15,
    fontWeight: "600",
  },
  helpSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  helpText: {
    color: "#6b7280",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
});

