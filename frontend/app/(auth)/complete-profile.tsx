import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeInUp, Field, GradientButton } from '../../src/components/ui';
import { theme, typography } from '../../src/lib/theme';
import { useLanguage } from '../../src/lib/i18n/LanguageContext';
import { getApiErrorMessage } from '../../src/lib/errors';
import { setCredentials } from '../../features/auth/authSlice';
import { useCompleteSocialSignupMutation } from '../../features/auth/authApiSlice';

/**
 * Step 2 of Google/Apple sign-in. Google and Apple never return a phone number
 * and Salvio requires one, so a first-time social user lands here. No account
 * exists until this form is submitted — backing out leaves nothing behind.
 */
export default function CompleteProfile() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const params = useLocalSearchParams<{
    pendingToken: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }>();

  // Prefilled when the provider gave us a name. Apple only does so on the very
  // first authorization, so these are often blank and the user fills them in.
  const [firstName, setFirstName] = useState(params.firstName ?? '');
  const [lastName, setLastName] = useState(params.lastName ?? '');
  const [phone, setPhone] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const [completeSignup, { isLoading }] = useCompleteSocialSignupMutation();

  const handleSubmit = async () => {
    setErrMsg('');

    if (!firstName || !lastName || !phone) {
      setErrMsg(t('fillRequiredFields'));
      return;
    }

    if (!params.pendingToken) {
      setErrMsg(t('socialSignInFailed'));
      return;
    }

    try {
      const result = await completeSignup({
        pendingToken: params.pendingToken,
        firstName,
        lastName,
        phone,
      }).unwrap();

      dispatch(setCredentials(result.data));
      router.replace('/');
    } catch (error: unknown) {
      setErrMsg(getApiErrorMessage(error, t('signupFailed')));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            <Ionicons name="person-add" size={40} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.title}>{t('completeProfileTitle')}</Text>
          <Text style={styles.subtitle}>{t('completeProfileSubtitle')}</Text>
          {params.email ? <Text style={styles.email}>{params.email}</Text> : null}
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
              label={t('firstName')}
              placeholder="John"
              value={firstName}
              onChangeText={setFirstName}
              containerStyle={{ flex: 1 }}
            />
            <Field
              label={t('lastName')}
              placeholder="Doe"
              value={lastName}
              onChangeText={setLastName}
              containerStyle={{ flex: 1 }}
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 2}>
            <Field
              label={t('phoneNumber')}
              // Romanian mobile format — a US example here left an App Store
              // reviewer unable to sign up (rejection 04b9a669).
              placeholder="0712 345 678"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 3}>
            <GradientButton
              title={t('finishSignUp')}
              onPress={handleSubmit}
              loading={isLoading}
              iconRight="arrow-forward"
            />
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
  email: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontWeight: '600',
  },
  form: {
    gap: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: `${theme.colors.error}15`,
    borderRadius: theme.roundness,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  mainErrorText: {
    ...typography.body2,
    color: theme.colors.error,
    flex: 1,
  },
});
