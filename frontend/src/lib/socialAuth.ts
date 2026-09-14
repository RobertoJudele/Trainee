import { Platform, TurboModuleRegistry } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import type * as GoogleSignInLib from '@react-native-google-signin/google-signin';
import { isCancellationError } from './socialAuthErrors';

export type SocialProvider = 'google' | 'apple';

export interface SocialCredential {
  provider: SocialProvider;
  idToken: string;
  /**
   * Apple hands the name over on the very first authorization only, and never
   * inside the token, so it travels alongside it. Google puts it in the token.
   */
  firstName?: string;
  lastName?: string;
}

// The library looks its native module up the moment it is imported and throws
// when the binary doesn't have it — Expo Go never does. So only load it when the
// module is there; without it Google simply stays hidden.
const google: typeof GoogleSignInLib | null = TurboModuleRegistry.get('RNGoogleSignin')
  ? require('@react-native-google-signin/google-signin')
  : null;

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

// The server validates the token's audience against the WEB client id on Android
// and the iOS one on iOS, so both have to be configured here.
google?.GoogleSignin.configure({
  webClientId,
  iosClientId,
  offlineAccess: false,
});

export const isGoogleConfigured = google !== null && Boolean(webClientId);

/** Apple only offers native Sign in with Apple on iOS 13+. */
export const isAppleSignInAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
};

const isCancellation = (error: unknown): boolean =>
  isCancellationError(error, google?.statusCodes.SIGN_IN_CANCELLED);

/**
 * Returns null when the user backs out of the native sheet — a cancel is not an
 * error and must not raise an alert.
 */
export const signInWithGoogle = async (): Promise<SocialCredential | null> => {
  if (!google) {
    throw new Error('Google Sign-In is not available in this build');
  }
  const { GoogleSignin } = google;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    // v16 returns a discriminated result rather than throwing on cancel.
    if (response.type === 'cancelled') {
      return null;
    }

    const idToken = response.data?.idToken;
    if (!idToken) {
      throw new Error('Google did not return an ID token');
    }

    return {
      provider: 'google',
      idToken,
      firstName: response.data.user.givenName ?? undefined,
      lastName: response.data.user.familyName ?? undefined,
    };
  } catch (error) {
    if (isCancellation(error)) {
      return null;
    }
    throw error;
  }
};

export const signInWithApple = async (): Promise<SocialCredential | null> => {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token');
    }

    return {
      provider: 'apple',
      idToken: credential.identityToken,
      // Populated on the first authorization only; undefined every time after.
      firstName: credential.fullName?.givenName ?? undefined,
      lastName: credential.fullName?.familyName ?? undefined,
    };
  } catch (error) {
    if (isCancellation(error)) {
      return null;
    }
    throw error;
  }
};

/** Clears the cached Google session so the next sign-in shows the account picker. */
export const signOutFromProviders = async (): Promise<void> => {
  try {
    await google?.GoogleSignin.signOut();
  } catch {
    // Nothing to sign out of; not worth surfacing.
  }
};
