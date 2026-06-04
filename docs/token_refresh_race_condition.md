# Token Refresh Race Condition & Unintended Logouts

## Overview
During development, we encountered a critical edge case where the user was randomly getting logged out while navigating the app, sometimes accompanied by weird backend errors (e.g., "You are not a trainer").

## The Root Cause
This was caused by a **race condition** in the RTK Query API interceptor (`frontend/src/api/apiSlice.ts`), specifically during the token refresh process.

1. The user's JWT access token is configured to expire after **15 minutes**.
2. When the token expires, if the user navigates to a new screen that triggers **multiple simultaneous API requests** (e.g., fetching Gyms and fetching Trainer Profile data), all of those requests simultaneously hit the backend.
3. Every single request receives a `401 Unauthorized` error because the 15 minutes are up.
4. Because the frontend interceptor (`baseQueryWithReauth`) did not have a concurrency lock, **every failed request simultaneously tried to refresh the token** using the exact same Refresh Token.
5. The very first request reaches the `/auth/refresh` endpoint, generates a new token, and **revokes the old refresh token**.
6. Milliseconds later, the second request reaches the `/auth/refresh` endpoint with the same (now revoked) token, receiving a `401 Unauthorized` from the refresh endpoint itself.
7. The frontend interprets a failed refresh as a completely expired session, triggering `api.dispatch(logOut())` and forcing the user out of the app.
8. The "You are not a trainer" error was simply a byproduct of one of these simultaneous requests failing midway through the process and falling back to a generic access error.

## The Solution
We implemented the officially recommended Redux Toolkit pattern for handling concurrent token refreshes by introducing a **Mutex (Mutual Exclusion Lock)** using the `async-mutex` package.

### Code Changes (`frontend/src/api/apiSlice.ts`)
```typescript
import { Mutex } from "async-mutex";

const mutex = new Mutex();

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // Wait until the mutex is available without locking it
  await mutex.waitForUnlock();
  let result = await baseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    // Check if the mutex is currently locked by another request
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        const refreshToken = (api.getState() as RootState).auth.refreshToken;
        if (refreshToken) {
          // Attempt the token refresh
          // ...
          // If successful, dispatch new credentials and retry the original query
        } else {
          api.dispatch(logOut());
        }
      } finally {
        release(); // ALWAYS release the lock so other requests can proceed
      }
    } else {
      // The mutex was locked by another request. This means a refresh is ALREADY happening.
      // Wait for the other request to finish and unlock the mutex.
      await mutex.waitForUnlock();
      // Retry the original query using the fresh token that the other request just acquired!
      result = await baseQuery(args, api, extraOptions);
    }
  }
  return result;
};
```

By adding this lock, simultaneous requests now form a queue. The first request locks the door, refreshes the token, and leaves the new token on the table. The other requests wait outside the door, and when it opens, they simply pick up the new token and retry their original queries without logging the user out.
