import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSignupMutation, UserRole } from '../../features/auth/authApiSlice';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../features/auth/authSlice';
import { theme, typography } from '../../src/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeInUp, Field, GradientButton, OutlineButton } from '../components/ui';
import { useLanguage } from '../lib/i18n/LanguageContext';

export default function SignUp() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  const [errMsg, setErrMsg] = useState('');

  const [signup, { isLoading }] = useSignupMutation();

  const handleSignup = async () => {
    setErrMsg('');

    if (!firstName || !lastName || !email || !password) {
      setErrMsg(t('fillRequiredFields'));
      return;
    }

    try {
      const result = await signup({
        email,
        password,
        phone,
        firstName,
        lastName,
        role: UserRole.CLIENT,
      }).unwrap();

      if (result.data) {
        dispatch(setCredentials(result.data));
      }

      router.replace('/');
    } catch (error: any) {
      const errorMessage = error?.data?.message || t('signupFailed');
      setErrMsg(errorMessage);
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
            <Ionicons name="person-add" size={38} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.title}>{t("createAccount")}</Text>
          <Text style={styles.subtitle}>{t("signUpSubtitle")}</Text>
        </FadeInUp>

        {errMsg ? (
          <FadeInUp>
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
              <Text style={styles.mainErrorText}>{errMsg}</Text>
            </View>
          </FadeInUp>
        ) : null}

        <View style={styles.form}>
          <FadeInUp delay={theme.motion.stagger} style={styles.row}>
            <Field
              label={t("firstName")}
              placeholder="John"
              value={firstName}
              onChangeText={setFirstName}
              containerStyle={{ flex: 1 }}
            />
            <Field
              label={t("lastName")}
              placeholder="Doe"
              value={lastName}
              onChangeText={setLastName}
              containerStyle={{ flex: 1 }}
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 2}>
            <Field
              label={t("emailAddress")}
              placeholder={t("emailPlaceholder")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 3}>
            <Field
              label={t("phoneNumber")}
              placeholder="(555) 123-4567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 4}>
            <Field
              label={t("password")}
              placeholder={t("createStrongPassword")}
              value={password}
              onChangeText={setPassword}
              secure
              autoCapitalize="none"
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 5}>
            <GradientButton
              title={t("signUp")}
              onPress={handleSignup}
              loading={isLoading}
              iconRight="arrow-forward"
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 6} style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t("or")}</Text>
            <View style={styles.dividerLine} />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 7}>
            <OutlineButton
              title={t("alreadyHaveAccount")}
              onPress={() => router.push('/(auth)/login')}
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 8}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t("backToWelcome")}
            >
              <Text style={styles.backButtonText}>{t("backToWelcome")}</Text>
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
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
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
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: `${theme.colors.error}12`,
    borderRadius: theme.roundness,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  mainErrorText: {
    ...typography.body2,
    color: theme.colors.error,
    flex: 1,
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
