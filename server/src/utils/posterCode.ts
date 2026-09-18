import { randomInt } from "crypto";

/**
 * Lowercase alphanumerics minus the characters that are misread off a printed
 * poster: 0/o, 1/l/i.
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** What an admin-supplied code may look like. */
export const POSTER_CODE_PATTERN = /^[a-z0-9-]{3,32}$/;

/**
 * A short random code for a poster URL. Short matters: fewer characters make a
 * denser QR, which scans from further away on a gym wall.
 */
export const generatePosterCode = (length: number = 6): string => {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
};
