import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, typography } from '../../src/lib/theme';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.tertiary]}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="barbell" size={64} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Trainee</Text>
          <Text style={styles.subtitle}>
            Find your perfect fitness trainer and achieve your goals
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => router.push('/(auth)/signup')}
            activeOpacity={0.9}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Get Started"
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color={theme.colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.8}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Sign In"
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </TouchableOpacity>

          <View style={styles.features}>
            <FeatureItem icon="checkmark-circle" text="Certified Trainers" />
            <FeatureItem icon="checkmark-circle" text="Personalized Programs" />
            <FeatureItem icon="checkmark-circle" text="Track Your Progress" />
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

function FeatureItem({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Ionicons name={icon} size={22} color="#FFFFFF" />
      <Text style={styles.featureText}>{text}</Text>
    </View>
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
