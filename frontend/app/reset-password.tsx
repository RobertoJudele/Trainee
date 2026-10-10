import React, { useEffect, useState } from "react";
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
import {
  useForgotPasswordMutation,
  useResetPasswordMutation,
} from "../features/auth/authApiSlice";
import { theme, typography } from "../src/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { FadeInUp, Field, GradientButton } from "../src/components/ui";
import { useLanguage } from "../src/lib/i18n/LanguageContext";
import { getApiErrorCode, getApiErrorMessage } from "../src/lib/errors";

/** Matches the server's per-user cooldown between two codes. */
const RESEND_COOLDOWN_S = 60;

const RESET_CODE_ERROR_KEYS: Record<string, string> = {
  RESET_CODE_INVALID: "resetCodeInvalid",
  RESET_CODE_EXPIRED: "resetCodeExpired",
  RESET_CODE_LOCKED: "resetCodeLocked",
};

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  // Arriving from the forgot-password screen means a code was just sent.
  const [resendIn, setResendIn] = useState(params.email ? RESEND_COOLDOWN_S : 0);
  const [resetPassword, { isLoading }] = useResetPasswordMutation();
  const [forgotPassword, { isLoading: isResending }] = useForgotPasswordMutation();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const normalizedEmail = email.trim().toLowerCase();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  const validatePassword = (value: string) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(value);

  const onResend = async () => {
    setError("");
    if (!isEmailValid) {
      setError(t("emailInvalid"));
      return;
    }
    try {
      await forgotPassword({ email: normalizedEmail }).unwrap();
      setResendIn(RESEND_COOLDOWN_S);
      Alert.alert(t("checkYourEmail"), t("resetCodeSent"));
    } catch (err: unknown) {
      Alert.alert(t("requestFailed"), getApiErrorMessage(err, t("couldNotSendReset")));
    }
  };

  const onSubmit = async () => {
    setError("");

    if (!isEmailValid) {
      setError(t("emailInvalid"));
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setError(t("resetCodeRequired"));
      return;
    }

    if (!validatePassword(newPassword)) {
      setError(t("passwordComplexity"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("passwordsDoNotMatch"));
      return;
    }

    try {
      await resetPassword({ email: normalizedEmail, code, newPassword }).unwrap();
      Alert.alert(t("success"), t("passwordResetDone"), [
        { text: t("goToLogin"), onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (err: unknown) {
      const key = RESET_CODE_ERROR_KEYS[getApiErrorCode(err) ?? ""];
      Alert.alert(
        t("resetFailed"),
        key ? t(key) : getApiErrorMessage(err, t("couldNotResetPassword"))
      );
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
          <Text style={styles.title}>{t("resetPassword")}</Text>
          <Text style={styles.subtitle}>
            {params.email
              ? t("resetPasswordForEmail").replace("{email}", params.email)
              : t("resetCodeInstructions")}
          </Text>
        </FadeInUp>

        {!params.email && (
          <FadeInUp delay={theme.motion.stagger}>
            <Field
              placeholder={t("email")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </FadeInUp>
        )}

        <FadeInUp delay={theme.motion.stagger}>
          <Field
            placeholder={t("resetCode")}
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            // iOS offers the code straight from Mail above the keyboard.
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
          />
        </FadeInUp>

        <FadeInUp delay={theme.motion.stagger * 2}>
          <Field
            placeholder={t("newPassword")}
            secure
            value={newPassword}
            onChangeText={setNewPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </FadeInUp>

        <FadeInUp delay={theme.motion.stagger * 3}>
          <Field
            placeholder={t("confirmNewPassword")}
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
            title={t("updatePassword")}
            icon="shield-checkmark-outline"
            onPress={onSubmit}
            loading={isLoading}
          />
        </FadeInUp>

        <FadeInUp delay={theme.motion.stagger * 5}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onResend}
            disabled={resendIn > 0 || isResending}
            accessibilityRole="button"
            accessibilityLabel={t("resendCode")}
          >
            <Text
              style={[styles.resendText, (resendIn > 0 || isResending) && styles.resendTextDisabled]}
            >
              {resendIn > 0
                ? t("resendCodeIn").replace("{seconds}", String(resendIn))
                : t("resendCode")}
            </Text>
          </TouchableOpacity>
        </FadeInUp>

        <FadeInUp delay={theme.motion.stagger * 5}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="button"
            accessibilityLabel={t("backToLogin")}
          >
            <Text style={styles.backButtonText}>{t("backToLogin")}</Text>
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
  resendText: { ...typography.body2, color: theme.colors.primary, fontWeight: "600" },
  resendTextDisabled: { color: theme.colors.textSecondary },
});
