import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import Logo from "@/lib/Logo";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { router } from "expo-router";

export default function VerifyEmailScreen() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const verifyByCode = useMutation(api.emailVerification.verifyByCode);
  const requestEmailVerification = useAction(api.emailVerification.requestEmailVerification);

  const handleVerify = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await verifyByCode({ code: code.trim() });
      if (res.success) {
        setSuccess("E-naslov potrjen! ");
        setTimeout(() => router.replace("/(tabs)"), 800);
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
    try {
      await requestEmailVerification({});
      setSuccess("Email ponovno poslan.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Napaka pri pošiljanju";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Potrditev e-naslova</Text>
      <Text style={styles.subtitle}>Vnesite 6-mestno kodo iz emaila ali kliknite povezavo v emailu.</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Koda (123456)"
        keyboardType="numeric"
        maxLength={6}
        style={styles.input}
      />
      {loading ? (
        <View style={{ alignItems: "center", marginVertical: 12 }}>
          <Logo size={80} />
        </View>
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleVerify}>
          <Text style={styles.buttonText}>Potrdi kodo</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[styles.button, styles.secondary]} onPress={handleResend}>
        <Text style={styles.buttonText}>Poslji email ponovno</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 8, color: "#fff" },
  subtitle: { fontSize: 14, color: "#ccc", marginBottom: 16 },
  input: { backgroundColor: "#1e1e2e", color: "#fff", padding: 12, borderRadius: 8, marginBottom: 12 },
  button: { backgroundColor: "#7c3aed", padding: 12, borderRadius: 8, alignItems: "center", marginBottom: 12 },
  secondary: { backgroundColor: "#374151" },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#ef4444", marginTop: 8 },
  success: { color: "#10b981", marginTop: 8 },
});

