// Helpers for narrowing the `unknown` errors thrown by RTK Query's
// `.unwrap()` (a `FetchBaseQueryError | SerializedError`) or anything else
// caught in a `catch` block, into a user-displayable message.

interface ErrorWithDataMessage {
  data: { message?: unknown };
}

function hasDataMessage(error: unknown): error is ErrorWithDataMessage {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return false;
  }
  const data = (error as { data: unknown }).data;
  return typeof data === "object" && data !== null && "message" in data;
}

/**
 * Pulls the per-field messages out of the API's validation-error payload:
 * `{ message: "Validation failed", errors: [{ field, message }] }`. The
 * top-level message is always the generic "Validation failed", so without this
 * the user is told nothing about what they actually got wrong.
 */
function getFieldErrorMessages(error: unknown): string[] {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return [];
  }
  const data = (error as { data: unknown }).data;
  if (typeof data !== "object" || data === null || !("errors" in data)) {
    return [];
  }
  const errors = (data as { errors: unknown }).errors;
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors
    .map((entry) =>
      typeof entry === "object" && entry !== null
        ? (entry as { message?: unknown }).message
        : undefined
    )
    .filter((message): message is string => typeof message === "string" && message.length > 0);
}

/**
 * Extracts a human-readable message from an unknown error. Prefers the
 * per-field validation messages, then the RTK Query `error.data.message`
 * shape, then a standard `Error.message`, and finally returns `fallback`.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const fieldMessages = getFieldErrorMessages(error);
  if (fieldMessages.length > 0) {
    return fieldMessages.join("\n");
  }
  if (hasDataMessage(error)) {
    const message = error.data.message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}
