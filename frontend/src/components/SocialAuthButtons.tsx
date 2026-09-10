import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './ui';
import { theme, typography } from '../lib/theme';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { getApiErrorMessage } from '../lib/errors';
import { setCredentials } from '../../features/auth/authSlice';
import {
  needsProfile,
  useSocialAuthMutation,
  type SocialProvider,
} from '../../features/auth/authApiSlice';
import {
  isAppleSignInAvailable,
  isGoogleConfigured,
  signInWithApple,
  signInWithGoogle,
} from '../lib/socialAuth';

interface Props {
  /** Surfaced inline on SignUp, via Alert on Login — the caller decides. */
  onError: (message: string) => void;
}

/**
 * Google + Apple sign-in. Owns the whole press -> verify -> branch flow so both
 * Login and SignUp can drop it in below their "or" divider unchanged.
 */
export default function SocialAuthButtons({ onError }: Props) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useLanguage();

  const [appleAvailable, setAppleAvailable] = useState(false);
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [socialAuth] = useSocialAuthMutation();

  useEffect(() => {
    let active = true;
    void isAppleSignInAvailable().then((available) => {
      if (active) {
        setAppleAvailable(available);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const run = async (provider: SocialProvider) => {
    if (pending) {
      return;
    }
    setPending(provider);
    try {
      const credential =
        provider === 'google' ? await signInWithGoogle() : await signInWithApple();

      // Null means the user dismissed the native sheet. Not an error.
      if (!credential) {
        return;
      }

      const result = await socialAuth(credential).unwrap();

      if (needsProfile(result.data)) {
        router.push({
          pathname: '/(auth)/complete-profile',
          params: {
            pendingToken: result.data.pendingToken,
            email: result.data.email,
            firstName: result.data.firstName,
            lastName: result.data.lastName,
          },
        });
        return;
      }

      dispatch(setCredentials(result.data));
      router.replace('/');
    } catch (error: unknown) {
      onError(getApiErrorMessage(error, t('socialSignInFailed')));
    } finally {
      setPending(null);
    }
  };

  // Nothing to render if neither provider can work on this build.
  if (!isGoogleConfigured && !appleAvailable) {
    return null;
  }

  return (
    <View style={styles.container}>
      {isGoogleConfigured ? (
        <PressableScale
          onPress={() => void run('google')}
          style={styles.googleButton}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('continueWithGoogle')}
        >
          {pending === 'google' ? (
            <ActivityIndicator color={theme.colors.text} />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color="#4285F4" />
              <Text style={styles.googleText}>{t('continueWithGoogle')}</Text>
            </>
          )}
        </PressableScale>
      ) : null}

      {/* Apple's own button component, not a lookalike — App Review rejects
          custom-drawn Sign in with Apple buttons (HIG requirement). */}
      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={theme.roundness}
          style={styles.appleButton}
          onPress={() => void run('apple')}
        />
      ) : null}
    </View>
  );
}

// Apple's button sizes itself from this, and the Google button copies it so the
// pair reads as one stack.
const APPLE_BUTTON_HEIGHT = 52;

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: APPLE_BUTTON_HEIGHT,
    borderRadius: theme.roundness,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  googleText: {
    ...typography.h3,
    fontWeight: '700',
    color: theme.colors.text,
  },
  appleButton: {
    // Apple draws its own button, so the two only line up if the heights match.
    height: APPLE_BUTTON_HEIGHT,
    width: '100%',
  },
});
