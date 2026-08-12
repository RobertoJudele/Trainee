/**
 * Pure derivations for the public trainer profile header. Kept free of React and
 * react-native so the fallback chains — which are where the bugs actually live —
 * can be tested directly.
 */

export type HeroImageSources = {
  /** trainer.user.profileImageUrl from the detail query. */
  profileImageUrl?: string | null;
  /** The route param the search card passes, so the photo paints with no flash. */
  routeImageUrl?: string | null;
  galleryImageUrls?: (string | null | undefined)[];
};

const firstNonBlank = (
  values: (string | null | undefined)[]
): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
};

/**
 * Profile photo → route param → first gallery image → null (caller renders the
 * gradient-and-initials fallback).
 *
 * The screen used to read the route param and nothing else, so any entry point
 * that did not pass params — a deep link above all — showed initials even when
 * the trainer had a photo.
 */
export const resolveHeroImageUrl = ({
  profileImageUrl,
  routeImageUrl,
  galleryImageUrls = [],
}: HeroImageSources): string | null =>
  firstNonBlank([profileImageUrl, routeImageUrl, ...galleryImageUrls]);

export const buildFullName = (
  firstName?: string | null,
  lastName?: string | null,
  fallback = "Trainer"
): string => {
  const name = [firstName, lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return name || fallback;
};

export const buildInitials = (
  firstName?: string | null,
  lastName?: string | null
): string => {
  const initials = `${firstName?.trim()?.[0] ?? ""}${lastName?.trim()?.[0] ?? ""}`;
  return initials.toUpperCase() || "?";
};

/**
 * "5 ani experiență · București" — either half may be missing, and with neither
 * the caller drops the line entirely rather than rendering a stray separator.
 */
export const buildIdentitySubtitle = ({
  experienceYears,
  locationCity,
  yearsExperienceTemplate,
}: {
  experienceYears?: number | null;
  locationCity?: string | null;
  /** t("yearsExperience"), e.g. "{n} ani experiență". */
  yearsExperienceTemplate: string;
}): string | null => {
  const parts: string[] = [];

  if (typeof experienceYears === "number" && experienceYears > 0) {
    parts.push(yearsExperienceTemplate.replace("{n}", String(experienceYears)));
  }

  const city = locationCity?.trim();
  if (city) {
    parts.push(city);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
};
