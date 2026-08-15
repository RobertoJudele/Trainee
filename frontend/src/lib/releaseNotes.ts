export interface ReleaseNotes {
  version: string;
  title: string;
  body: string;
}

/** AsyncStorage key holding the last app version this device has launched. */
export const LAST_SEEN_VERSION_KEY = "last_seen_app_version";

/**
 * Whether to show the "what's new" sheet on this launch.
 *
 * The rule that matters is the first one: a device with no stored version is a
 * fresh install, and a brand-new user must not be greeted by a changelog for
 * features they have never seen the absence of. The version is recorded on that
 * first launch so the *next* update is announced normally.
 *
 * This also covers everyone already on the app when this feature ships — they
 * have no stored version either, so they see nothing until their next update.
 */
export const shouldShowReleaseNotes = ({
  storedVersion,
  currentVersion,
  notes,
}: {
  storedVersion: string | null;
  currentVersion: string;
  notes: ReleaseNotes | null | undefined;
}): boolean => {
  if (!notes || !currentVersion) return false;
  // Server sent notes for a different version than the one running — ignore
  // rather than announce something the user does not have.
  if (notes.version !== currentVersion) return false;
  // Fresh install, or first launch after this feature shipped.
  if (!storedVersion) return false;
  // Already launched this version; the notes were shown then.
  return storedVersion !== currentVersion;
};
