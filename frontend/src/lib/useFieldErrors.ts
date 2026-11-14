import { useCallback, useMemo, useState } from "react";

/**
 * Per-field validation messages for a form. Validation collects every problem
 * at once (`setAll`) so the user sees all of them under their fields, and a
 * field's message clears as soon as the user edits it (`clear`).
 */
export function useFieldErrors<K extends string>(): {
  errors: Partial<Record<K, string>>;
  hasErrors: boolean;
  setAll: (next: Partial<Record<K, string>>) => boolean;
  clear: (key: K) => void;
} {
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({});

  // Returns true when the form is valid, so callers can write `if (!setAll(e)) return;`.
  const setAll = useCallback((next: Partial<Record<K, string>>) => {
    setErrors(next);
    return Object.keys(next).length === 0;
  }, []);

  const clear = useCallback((key: K) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest as Partial<Record<K, string>>;
    });
  }, []);

  // Memoised so callbacks that depend on it only change when the messages do.
  return useMemo(
    () => ({ errors, hasErrors: Object.keys(errors).length > 0, setAll, clear }),
    [errors, setAll, clear],
  );
}
