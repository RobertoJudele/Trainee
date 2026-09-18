/**
 * Both store listings, defaulted rather than required: the identifiers are fixed
 * and already documented in docs/force-update.md, and leaving them to env vars
 * meant the download link silently vanished wherever they weren't set.
 *
 * Shared so the public trainer page and the poster landing page cannot drift
 * apart on which listing they send people to.
 */
const DEFAULT_APPLE_STORE_URL = "https://apps.apple.com/app/id6775085258";
const DEFAULT_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.juroctech.frontend";

export const appleStoreUrl = (): string =>
  process.env.PUBLIC_APPLE_STORE_URL?.trim() || DEFAULT_APPLE_STORE_URL;

export const playStoreUrl = (): string =>
  process.env.PUBLIC_PLAY_STORE_URL?.trim() || DEFAULT_PLAY_STORE_URL;
