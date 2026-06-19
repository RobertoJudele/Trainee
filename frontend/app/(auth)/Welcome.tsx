import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
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
          <View style={styles.iconContainer}>
            <Ionicons name="barbell" size={64} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Trainee</Text>
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

          <View style={styles.features}>
            <FeatureItem icon="checkmark-circle" text={t("certifiedTrainers")} delay={theme.motion.stagger * 5} />
            <FeatureItem icon="checkmark-circle" text={t("personalizedPrograms")} delay={theme.motion.stagger * 6} />
            <FeatureItem icon="checkmark-circle" text={t("trackYourProgress")} delay={theme.motion.stagger * 7} />
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

function FeatureItem({ icon, text, delay }: { icon: any; text: string; delay: number }) {
  return (
    <FadeInUp delay={delay} style={styles.featureItem}>
      <Ionicons name={icon} size={22} color="#FFFFFF" />
      <Text style={styles.featureText}>{text}</Text>
    </FadeInUp>
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
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: theme.spacing.md,
    borderRadius: 100,
    marginBottom: theme.spacing.md,
  },
  title: {
    ...typography.h1,
    fontSize: 48,
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
  features: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  featureText: {
    ...typography.body1,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '500',
  },
});
