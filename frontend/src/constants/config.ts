// frontend/src/constants/config.ts
const normalizeUrl = (value: string): string => value.replace(/\/+$/, "");

const resolveApiUrl = (): string => {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) {
    return normalizeUrl(explicit);
  }

  const devUrl = process.env.EXPO_PUBLIC_API_URL_DEV?.trim();
  if (__DEV__ && devUrl) {
    return normalizeUrl(devUrl);
  }

  const prodUrl = process.env.EXPO_PUBLIC_API_URL_PROD?.trim();
  if (!__DEV__ && prodUrl) {
    return normalizeUrl(prodUrl);
  }

  if (!__DEV__) {
    throw new Error("EXPO_PUBLIC_API_URL or EXPO_PUBLIC_API_URL_PROD must be set for production builds.");
  }
  return "http://localhost:8000";
};

export const API_URL = resolveApiUrl();