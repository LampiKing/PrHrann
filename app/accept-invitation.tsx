import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConvexAuth, useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import FloatingBackground from "@/lib/FloatingBackground";
import { PLAN_FAMILY } from "@/lib/branding";

export default function AcceptInvitationScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const inviteToken = Array.isArray(token) ? token[0] : token;

  const acceptInvite = useMutation(api.familyPlan.acceptFamilyInvitation);
  const declineInvite = useMutation(api.familyPlan.declineFamilyInvitation);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleAccept = async () => {
    if (!inviteToken) {
      setError("Manjka koda vabila.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const result = await acceptInvite({ inviteToken });
      setSuccess(result.message || "Vabilo sprejeto.");
      setTimeout(() => router.replace("/(tabs)"), 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sprejem vabila ni uspel.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!inviteToken) {
      setError("Manjka koda vabila.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await declineInvite({ inviteToken });
      setSuccess("Vabilo zavrnjeno.");
      setTimeout(() => router.replace("/(tabs)"), 900);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Zavrnitev vabila ni uspela.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = () => {
    router.push({ pathname: "/auth", params: { mode: "login" } });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
      />
      <FloatingBackground variant="minimal" />
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="people" size={30} color="#fbbf24" />
        </View>
        <Text style={styles.title}>{PLAN_FAMILY} vabilo</Text>
        <Text style={styles.subtitle}>
          Povabljen si v {PLAN_FAMILY}. Sprejmi ali zavrni vabilo.
        </Text>

        {!inviteToken ? (
          <Text style={styles.errorText}>Manjka koda vabila.</Text>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}

        {isLoading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 12 }} />
        ) : !isAuthenticated ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
            <Text style={styles.primaryButtonText}>Prijavi se za sprejem</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, submitting && styles.buttonDisabled]}
              onPress={handleAccept}
              disabled={submitting || !inviteToken}
            >
              {submitting ? (
                <ActivityIndicator color="#0b0814" />
              ) : (
                <Text style={styles.primaryButtonText}>Sprejmi vabilo</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, submitting && styles.buttonDisabled]}
              onPress={handleDecline}
              disabled={submitting || !inviteToken}
            >
              <Text style={styles.secondaryButtonText}>Zavrni</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#0a0a12",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    padding: 24,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.35)",
    alignItems: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#cbd5e1",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 13,
    color: "#fca5a5",
    textAlign: "center",
    marginTop: 6,
  },
  successText: {
    fontSize: 13,
    color: "#6ee7b7",
    textAlign: "center",
    marginTop: 6,
  },
  primaryButton: {
    width: "100%",
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: "#fbbf24",
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0b0814",
  },
  secondaryButton: {
    width: "100%",
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cbd5e1",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
