import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { createShadow } from "@/lib/shadow-helper";

export default function ResetScreen() {
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const errorParam = Array.isArray(params.error) ? params.error[0] : params.error;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const hasToken = typeof token === "string" && token.length > 0;

  useEffect(() => {
    if (errorParam || !hasToken) {
      setError("Povezava za ponastavitev je neveljavna ali je potekla.");
    }
  }, [errorParam, hasToken]);

  const passwordStrengthScore =
    (newPassword.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(newPassword) ? 1 : 0) +
    (/[0-9]/.test(newPassword) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(newPassword) ? 1 : 0);
  const passwordStrengthLevel =
    newPassword.length === 0 ? 0 : passwordStrengthScore <= 1 ? 1 : passwordStrengthScore <= 3 ? 2 : 3;
  const passwordStrengthLabel =
    passwordStrengthLevel === 1 ? "Šibko" : passwordStrengthLevel === 2 ? "Dobro" : "Močno";
  const passwordStrengthColor =
    passwordStrengthLevel === 1 ? "#f97316" : passwordStrengthLevel === 2 ? "#fbbf24" : "#22c55e";

  const canSubmit =
    !loading &&
    hasToken &&
    !errorParam &&
    newPassword.length >= 6 &&
    confirmPassword.length >= 6 &&
    newPassword === confirmPassword;

  const handleReset = async () => {
    if (!canSubmit) {
      if (!hasToken || errorParam) {
        setError("Povezava za ponastavitev ni veljavna.");
        return;
      }
      if (newPassword.length < 6) {
        setError("Geslo mora imeti vsaj 6 znakov.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Gesli se ne ujemata.");
        return;
      }
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await authClient.resetPassword({
        token,
        newPassword,
      });
      if (result.error) {
        setError("Ponastavitev ni uspela. Poskusite znova.");
        return;
      }
      setMessage("Geslo je posodobljeno. Prijavite se z novim geslom.");
      setTimeout(() => {
        router.replace({ pathname: "/auth", params: { mode: "login" } });
      }, 1400);
    } catch (err) {
      console.log("Reset password error:", err);
      setError("Ponastavitev ni uspela. Poskusite znova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a12", "#12081f", "#1a0a2e", "#0f0a1e"]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <View style={styles.card}>
            <Text style={styles.title}>Ponastavi geslo</Text>
            <Text style={styles.subtitle}>
              Vnesi novo geslo za svoj račun.
            </Text>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {message ? (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                <Text style={styles.successText}>{message}</Text>
              </View>
            ) : null}

            <View
              style={[
                styles.inputContainer,
                focusedField === "newPassword" && styles.inputContainerFocused,
              ]}
            >
              <Ionicons name="lock-closed-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Novo geslo"
                placeholderTextColor="#6b7280"
                value={newPassword}
                onChangeText={setNewPassword}
                onFocus={() => setFocusedField("newPassword")}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                autoCorrect={false}
                textContentType="newPassword"
                returnKeyType="next"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>

            {newPassword.length > 0 && (
              <View style={styles.strengthRow}>
                <View style={styles.strengthBars}>
                  {[0, 1, 2].map((index) => (
                    <View
                      key={index}
                      style={[
                        styles.strengthBar,
                        passwordStrengthLevel > index && { backgroundColor: passwordStrengthColor },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthText, { color: passwordStrengthColor }]}>
                  {passwordStrengthLabel}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.inputContainer,
                focusedField === "confirmPassword" && styles.inputContainerFocused,
              ]}
            >
              <Ionicons name="lock-closed-outline" size={20} color="#a78bfa" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ponovi geslo"
                placeholderTextColor="#6b7280"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setFocusedField("confirmPassword")}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                autoCorrect={false}
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleReset}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
              onPress={handleReset}
              disabled={!canSubmit}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={
                  !canSubmit
                    ? ["rgba(148, 163, 184, 0.5)", "rgba(71, 85, 105, 0.6)"]
                    : ["#c084fc", "#a855f7", "#7c3aed"]
                }
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text
                      style={[
                        styles.primaryButtonText,
                        !canSubmit && styles.primaryButtonTextDisabled,
                      ]}
                    >
                      Shrani novo geslo
                    </Text>
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={!canSubmit ? "#cbd5e1" : "#fff"}
                    />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace({ pathname: "/auth", params: { mode: "login" } })}
            >
              <Text style={styles.backText}>Nazaj na prijavo</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
  },
  keyboardView: {
    flex: 1,
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    backgroundColor: "rgba(17, 24, 39, 0.7)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    padding: 24,
    ...createShadow("#8b5cf6", 0, 10, 0.45, 20, 12),
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 20,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  successText: {
    color: "#bbf7d0",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 14,
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(31, 41, 55, 0.5)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  inputContainerFocused: {
    borderColor: "#c084fc",
    backgroundColor: "rgba(31, 41, 55, 0.7)",
    ...createShadow("#a78bfa", 0, 0, 0.35, 10, 4),
  },
  inputIcon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    padding: 16,
    paddingLeft: 12,
    fontSize: 16,
    color: "#fff",
  },
  eyeButton: {
    padding: 16,
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  strengthBars: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  strengthBar: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.35)",
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "700",
  },
  primaryButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 12,
    ...createShadow("#a78bfa", 0, 10, 0.55, 20, 12),
  },
  primaryButtonDisabled: {
    opacity: 0.85,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  primaryButtonText: {
    color: "#0b0814",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  primaryButtonTextDisabled: {
    color: "#e2e8f0",
  },
  backButton: {
    alignItems: "center",
    paddingVertical: 6,
  },
  backText: {
    color: "#a78bfa",
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
