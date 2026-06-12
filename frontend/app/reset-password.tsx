import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useResetPasswordMutation } from "../features/auth/authApiSlice";
import { theme, typography } from "../src/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { FadeInUp, Field, GradientButton } from "../src/components/ui";

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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeInUp delay={0} style={styles.header}>
          <LinearGradient
            colors={theme.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconContainer}
          >
            <Ionicons name="key-outline" size={36} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            {hintEmail
              ? `Set a new password for ${hintEmail}`
              : "Paste your reset token and choose a new password."}
          </Text>
        </FadeInUp>

        <FadeInUp delay={theme.motion.stagger}>
          <Field
            placeholder="Reset token"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </FadeInUp>

        <FadeInUp delay={theme.motion.stagger * 2}>
          <Field
            placeholder="New password"
            secure
            value={newPassword}
            onChangeText={setNewPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </FadeInUp>

        <FadeInUp delay={theme.motion.stagger * 3}>
          <Field
            placeholder="Confirm new password"
            secure
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={error}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </FadeInUp>

        <FadeInUp delay={theme.motion.stagger * 4}>
          <GradientButton
            title="Update Password"
            icon="shield-checkmark-outline"
            onPress={onSubmit}
            loading={isLoading}
          />
        </FadeInUp>

        <FadeInUp delay={theme.motion.stagger * 5}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="button"
            accessibilityLabel="Back to login"
          >
            <Text style={styles.backButtonText}>Back to login</Text>
          </TouchableOpacity>
        </FadeInUp>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    justifyContent: "center",
    gap: theme.spacing.md,
  },
  header: { alignItems: "center", marginBottom: theme.spacing.sm },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: theme.spacing.md,
    ...theme.shadows.large,
  },
  title: { ...typography.h1, color: theme.colors.text, textAlign: "center" },
  subtitle: { ...typography.body2, color: theme.colors.textSecondary, textAlign: "center" },
  backButton: { alignItems: "center", marginTop: theme.spacing.sm },
  backButtonText: { ...typography.body2, color: theme.colors.textSecondary },
});
