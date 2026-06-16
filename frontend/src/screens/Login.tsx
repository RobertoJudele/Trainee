import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useLoginMutation } from '../../features/auth/authApiSlice';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../features/auth/authSlice';
import { theme, typography } from '../../src/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeInUp, Field, GradientButton, OutlineButton } from '../components/ui';

export default function Login() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [login, { isLoading }] = useLoginMutation();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    setEmailError('');
    setPasswordError('');

    let hasError = false;

    if (!email) {
      setEmailError('Email is required');
      hasError = true;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email');
      hasError = true;
    }

    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      hasError = true;
    }

    if (hasError) return;

    try {
      const result = await login({ email, password }).unwrap();
      dispatch(
        setCredentials({
          user: result.data.user,
          token: result.data.token,
          refreshToken: result.data.refreshToken,
        })
      );
      router.replace('/');
    } catch (error: any) {
      const errorMessage = error?.data?.message || 'Login failed. Please try again.';
      Alert.alert('Login Failed', errorMessage);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeInUp
          delay={0}
          style={[
            styles.header,
            { paddingTop: Math.max(insets.top + theme.spacing.md, theme.spacing.xxl) },
          ]}
        >
          <LinearGradient
            colors={theme.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconContainer}
          >
            <Ionicons name="barbell" size={40} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your fitness journey</Text>
        </FadeInUp>

        <View style={styles.form}>
          <FadeInUp delay={theme.motion.stagger}>
            <Field
              label="Email Address"
              placeholder="your.email@example.com"
              value={email}
              error={emailError}
              onChangeText={(text) => {
                setEmail(text);
                setEmailError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 2}>
            <Field
              label="Password"
              placeholder="Enter your password"
              value={password}
              error={passwordError}
              secure
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 3}>
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => router.push('/forgot-password')}
              accessibilityRole="button"
              accessibilityLabel="Forgot Password"
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 4}>
            <GradientButton
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              iconRight="arrow-forward"
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 5} style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 6}>
            <OutlineButton
              title="Create New Account"
              onPress={() => router.push('/(auth)/signup')}
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 7}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back to Welcome"
            >
              <Text style={styles.backButtonText}>← Back to Welcome</Text>
            </TouchableOpacity>
          </FadeInUp>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  iconContainer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.large,
  },
  title: {
    ...typography.h1,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...typography.body1,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    gap: theme.spacing.md,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    ...typography.body2,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    marginHorizontal: theme.spacing.sm,
  },
  backButton: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  backButtonText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
});
