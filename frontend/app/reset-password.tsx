import React, { useMemo, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useResetPasswordMutation } from "../features/auth/authApiSlice";
import { theme, typography } from "../src/lib/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const [token, setToken] = useState(params.token ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const hintEmail = useMemo(() => params.email ?? "", [params.email]);

  const validatePassword = (value: string) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(value);

  const onSubmit = async () => {
    setError("");

    if (!token.trim()) {
      setError("Reset token is required");
      return;
    }

    if (!validatePassword(newPassword)) {
      setError("Password must have 6+ chars, uppercase, lowercase and a number");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const res = await resetPassword({ token: token.trim(), newPassword }).unwrap();
      Alert.alert("Success", res.message, [
        { text: "Go to login", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (err: any) {
      const msg = err?.data?.message || "Could not reset password";
      Alert.alert("Reset failed", msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          {hintEmail
            ? `Set a new password for ${hintEmail}`
            : "Paste your reset token and choose a new password."}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Reset token"
          placeholderTextColor={theme.colors.textSecondary}
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor={theme.colors.textSecondary}
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor={theme.colors.textSecondary}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          autoCapitalize="none"
          autoCorrect={false}
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
            <Text style={styles.primaryButtonText}>Update Password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/(auth)/login")}>
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
  errorText: { ...typography.caption, color: theme.colors.error },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  primaryButtonText: { ...typography.body1, color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.7 },
  backButton: { alignItems: "center", marginTop: theme.spacing.sm },
  backButtonText: { ...typography.body2, color: theme.colors.textSecondary },
});
