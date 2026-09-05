/**
 * Pure helpers for the Google/Apple sign-in flow.
 *
 * Kept free of react-native and native-SDK imports on purpose, so the branching
 * here is unit-testable under the project's jest config (see jest.config.js).
 */

/**
 * Apple's own cancellation codes. Backing out of the native sheet raises one of
 * these, and it must be treated as "nothing happened" rather than an error --
 * otherwise dismissing the sheet pops an error alert every time.
 */
const APPLE_CANCEL_CODES = ['ERR_REQUEST_CANCELED', 'ERR_CANCELED'] as const;

/**
 * @param sdkCancelCode The Google SDK's own cancel code, passed in rather than
 *   imported so this module stays free of the native SDK.
 */
export const isCancellationError = (
  error: unknown,
  sdkCancelCode?: string
): boolean => {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (typeof code !== 'string') {
    return false;
  }
  if (sdkCancelCode !== undefined && code === sdkCancelCode) {
    return true;
  }
  return (APPLE_CANCEL_CODES as readonly string[]).includes(code);
};
