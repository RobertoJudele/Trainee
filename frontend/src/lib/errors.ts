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
 * Extracts a human-readable message from an unknown error. Checks the RTK
 * Query `error.data.message` shape first, then a standard `Error.message`,
 * and finally returns `fallback`.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
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
