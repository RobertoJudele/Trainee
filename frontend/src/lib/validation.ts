export const normalizeSocialUrlForSave = (value: string): string | null | "INVALID" => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    new URL(withProtocol);
    return withProtocol;
  } catch {
    return "INVALID";
  }
};

export const normalizeWhatsAppPhone = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedPrefix = trimmed.startsWith("00")
    ? `+${trimmed.slice(2)}`
    : trimmed;

  const digitsOnly = normalizedPrefix.replace(/\D/g, "");

  if (!digitsOnly || digitsOnly.length < 7 || digitsOnly.length > 15) {
    return null;
  }

  if (!/^[1-9]/.test(digitsOnly)) {
    return null;
  }

  return `+${digitsOnly}`;
};

export const normalizeWhatsAppForSave = (value: string): string | null | "INVALID" => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const directPhone = normalizeWhatsAppPhone(trimmed);
  if (directPhone) {
    return `https://wa.me/${directPhone.slice(1)}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (
        url.hostname === "wa.me" ||
        url.hostname === "api.whatsapp.com" ||
        url.hostname === "chat.whatsapp.com"
      ) {
        return trimmed;
      }
    } catch {
      // fall through
    }
  }

  const parsedPhone = normalizeWhatsAppPhone(trimmed.replace(/^.*?(\+?\d)/, "$1"));
  if (parsedPhone) {
    return `https://wa.me/${parsedPhone.slice(1)}`;
  }

  return parsedPhone ?? "INVALID";
};
