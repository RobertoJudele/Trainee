import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useForgotPasswordMutation } from "../features/auth/authApiSlice";
import { theme, typography } from "../src/lib/theme";
import { Ionicons } from "@expo/vector-icons";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const onSubmit = async () => {
    setError("");

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Email is required");
      return;
    }

    if (!validateEmail(normalized)) {
      setError("Please enter a valid email");
      return;
    }

    try {
      const res = await forgotPassword({ email: normalized }).unwrap();
      Alert.alert("Check your email", res.message);
      router.push({ pathname: "/reset-password", params: { email: normalized } });
    } catch (err: any) {
      const msg = err?.data?.message || "Could not send reset email";
      Alert.alert("Request failed", msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Ionicons name="lock-closed-outline" size={48} color={theme.colors.primary} style={{marginBottom: 8}} />
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter your email address and we will send a reset link.
        </Text>

        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          placeholder="you@example.com"
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError("");
          }}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, isLoading && styles.disabled]}
          onPress={onSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: "center",
    gap: theme.spacing.md,
  },
  title: { ...typography.h1, color: theme.colors.text },
  subtitle: { ...typography.body2, color: theme.colors.textSecondary },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    padding: theme.spacing.md,
    ...typography.body1,
    color: theme.colors.text,
  },
  inputError: { borderColor: theme.colors.error },
  errorText: { ...typography.caption, color: theme.colors.error },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    ...theme.shadows.medium,
  },
  primaryButtonText: { ...typography.body1, color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.7 },
  backButton: { alignItems: "center", marginTop: theme.spacing.sm },
  backButtonText: { ...typography.body2, color: theme.colors.textSecondary },
});
