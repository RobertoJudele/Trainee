import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, typography } from '../../src/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { FadeInUp, PressableScale } from '../../src/components/ui';
import { useLanguage } from '../../src/lib/i18n/LanguageContext';

const { width, height } = Dimensions.get('window');

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.tertiary]}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View style={styles.content}>
        <FadeInUp delay={80} duration={theme.motion.slow} style={styles.header}>
          <Image
            source={require('../../assets/salvio-mark.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.title}>Salvio</Text>
          <Text style={styles.subtitle}>
            {t("welcomeTagline")}
          </Text>
        </FadeInUp>

        <View style={styles.buttonContainer}>
          <FadeInUp delay={theme.motion.stagger * 3}>
            <PressableScale
              style={[styles.button, styles.primaryButton]}
              onPress={() => router.push('/(auth)/signup')}
              accessibilityRole="button"
              accessibilityLabel={t("getStarted")}
            >
              <Text style={styles.primaryButtonText}>{t("getStarted")}</Text>
              <Ionicons name="arrow-forward" size={20} color={theme.colors.primary} />
            </PressableScale>
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 4}>
            <PressableScale
              style={[styles.button, styles.secondaryButton]}
              onPress={() => router.push('/(auth)/login')}
              accessibilityRole="button"
              accessibilityLabel={t("signIn")}
            >
              <Text style={styles.secondaryButtonText}>{t("signIn")}</Text>
            </PressableScale>
          </FadeInUp>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: height * 0.12,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
  },
  logo: {
    // Mark is 419×721; keep its aspect ratio.
    height: 112,
    width: 112 * (419 / 721),
    marginBottom: theme.spacing.md,
  },
  title: {
    ...typography.h1,
    fontSize: 48,
    // h1's 42px line height is for 34px text; at 48px it clips the glyphs.
    lineHeight: 58,
    color: '#FFFFFF',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...typography.body1,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    maxWidth: width * 0.85,
  },
  buttonContainer: {
    gap: theme.spacing.md,
  },
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.roundness,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    ...theme.shadows.medium,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  primaryButtonText: {
    ...typography.h3,
    color: theme.colors.primary,
  },
  secondaryButtonText: {
    ...typography.h3,
    color: '#FFFFFF',
  },
});
