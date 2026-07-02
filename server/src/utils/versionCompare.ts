// Parse a dotted version into numeric segments. Returns null if any segment
// is missing or non-numeric so callers can fail open on malformed input.
const parse = (value: string): number[] | null => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const segments = value.trim().split(".");
  const nums: number[] = [];
  for (const seg of segments) {
    if (!/^\d+$/.test(seg)) return null;
    nums.push(Number(seg));
  }
  return nums;
};

/**
 * True when `current` is strictly older than `minimum`.
 * Missing trailing segments are treated as 0 (1.2 == 1.2.0).
 * Any malformed input returns false (fail-open — never block on bad data).
 */
export const isUpdateRequired = (current: string, minimum: string): boolean => {
  const cur = parse(current);
  const min = parse(minimum);
  if (!cur || !min) return false;

  const len = Math.max(cur.length, min.length);
  for (let i = 0; i < len; i++) {
    const c = cur[i] ?? 0;
    const m = min[i] ?? 0;
    if (c < m) return true;
    if (c > m) return false;
  }
  return false; // equal
};
