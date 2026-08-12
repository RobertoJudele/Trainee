/**
 * Normalisation for the trainer-supplied contact links (Instagram, Facebook,
 * WhatsApp). Trainers type these by hand during onboarding, so the input is
 * anything from "instagram.com/andrei" to a full wa.me URL to a bare phone
 * number — these helpers turn that into something Linking can open, or null.
 */

export const normalizeSocialUrl = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    new URL(normalized);
    return normalized;
  } catch {
    return null;
  }
};

export const normalizeWhatsAppPhoneDigits = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedPrefix = trimmed.startsWith("00")
    ? `+${trimmed.slice(2)}`
    : trimmed;

  const digits = normalizedPrefix.replace(/\D/g, "");
  if (!digits || digits.length < 7 || digits.length > 15) {
    return null;
  }

  if (!/^[1-9]/.test(digits)) {
    return null;
  }

  return digits;
};

/**
 * WhatsApp needs two URLs: the app scheme, and an https fallback for when the
 * app isn't installed. Accepts a raw phone number or a wa.me / api.whatsapp.com
 * link and digs the number out of either.
 */
export const getWhatsAppContactUrls = (
  value?: string | null
): { appUrl: string; webUrl: string } | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // A phone number never contains letters, so anything that does is a link and
  // must be matched on its host. Stripping non-digits from the raw string first
  // would turn any URL with enough digits in it — a Facebook profile id, say —
  // into a plausible-looking but wrong WhatsApp number.
  const looksLikeLink = /[a-z]/i.test(trimmed);

  let phoneDigits = looksLikeLink ? null : normalizeWhatsAppPhoneDigits(trimmed);

  if (!phoneDigits && looksLikeLink) {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    try {
      const parsed = new URL(withProtocol);
      const hostname = parsed.hostname.toLowerCase();
      const fromQuery = parsed.searchParams.get("phone") ?? "";
      const fromPath = parsed.pathname.split("/").filter(Boolean)[0] ?? "";

      let phoneCandidate = "";
      if (hostname === "wa.me" || hostname.endsWith(".wa.me")) {
        phoneCandidate = fromPath;
      } else if (
        hostname === "api.whatsapp.com" ||
        hostname === "whatsapp.com" ||
        hostname === "www.whatsapp.com"
      ) {
        phoneCandidate = fromQuery;
      }

      phoneDigits = normalizeWhatsAppPhoneDigits(phoneCandidate);
    } catch {
      phoneDigits = null;
    }
  }

  if (!phoneDigits) {
    return null;
  }

  return {
    appUrl: `whatsapp://send?phone=${phoneDigits}`,
    webUrl: `https://wa.me/${phoneDigits}`,
  };
};
