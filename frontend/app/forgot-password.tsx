import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useForgotPasswordMutation } from "../features/auth/authApiSlice";
import { theme, typography } from "../src/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { FadeInUp, Field, GradientButton } from "../src/components/ui";
import { useLanguage } from "../src/lib/i18n/LanguageContext";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const onSubmit = async () => {
    setError("");

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError(t("emailRequired"));
      return;
    }

    if (!validateEmail(normalized)) {
      setError(t("emailInvalid"));
      return;
    }

    try {
      const res = await forgotPassword({ email: normalized }).unwrap();
      Alert.alert(t("checkYourEmail"), res.message);
      router.push({ pathname: "/reset-password", params: { email: normalized } });
    } catch (err: any) {
      const msg = err?.data?.message || t("couldNotSendReset");
      Alert.alert(t("requestFailed"), msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <FadeInUp delay={0} style={styles.header}>
          <LinearGradient
            colors={theme.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconContainer}
          >
            <Ionicons name="lock-closed-outline" size={36} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.title}>{t("forgotPasswordTitle")}</Text>
          <Text style={styles.subtitle}>
            {t("forgotPasswordSubtitle")}
          </Text>
        </FadeInUp>

        <FadeInUp delay={theme.motion.stagger}>
          <Field
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            error={error}
            onChangeText={(text) => {
              setEmail(text);
              setError("");
            }}
          />
        </FadeInUp>

        <FadeInUp delay={theme.motion.stagger * 2}>
          <GradientButton
            title={t("sendResetLink")}
            icon="mail-outline"
            onPress={onSubmit}
            loading={isLoading}
          />
        </FadeInUp>

        <FadeInUp delay={theme.motion.stagger * 3}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t("backToLogin")}
          >
            <Text style={styles.backButtonText}>{t("backToLogin")}</Text>
          </TouchableOpacity>
        </FadeInUp>
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
