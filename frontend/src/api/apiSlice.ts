import {
  BaseQueryFn,
  createApi,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { setCredentials, logOut } from "../../features/auth/authSlice";
import { RootState } from "../../app/store";
import { User } from "../types/user";
import { API_URL } from "../constants/config";

interface RefreshResponse {
  success: boolean;
  data: {
    token: string;
    refreshToken: string;
  };
}

const baseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

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
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        const refreshToken = (api.getState() as RootState).auth.refreshToken;
        if (refreshToken) {
          const refreshResult = await baseQuery(
            {
              url: "/auth/refresh",
              method: "POST",
              body: { refreshToken },
            },
            api,
            extraOptions
          );

          const refreshResponse = refreshResult.data as RefreshResponse;

          if (refreshResponse?.success && refreshResponse.data) {
            const user = (api.getState() as RootState).auth.user;
            // Store the new access token and rotated refresh token
            api.dispatch(
              setCredentials({
                token: refreshResponse.data.token,
                refreshToken: refreshResponse.data.refreshToken,
                user,
              })
            );
            // Retry original query with new JWT
            result = await baseQuery(args, api, extraOptions);
          } else if (
            refreshResult.error &&
            (refreshResult.error.status === 401 || refreshResult.error.status === 400)
          ) {
            // Server explicitly rejected the refresh token — it's invalid or expired.
            // Safe to log out.
            api.dispatch(logOut());
            api.dispatch(apiSlice.util.resetApiState());
          }
          // Network error or 5xx: don't log out. The original 401 is returned to
          // the caller so the user sees an error and can retry manually.
        } else {
          // No refresh token stored at all — definitely not authenticated.
          api.dispatch(logOut());
          api.dispatch(apiSlice.util.resetApiState());
        }
      } finally {
        release();
      }
    } else {
      // Another request is already refreshing — wait for it to finish,
      // then retry with whatever token is now in state.
      await mutex.waitForUnlock();
      result = await baseQuery(args, api, extraOptions);
    }
  }
  return result;
};

export const apiSlice = createApi({
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Gyms", "MyGyms", "TrainerSlots", "MySchedule", "PendingClientCodes", "Reviews", "BlockedDates"],
  endpoints: (builder) => ({}),
});
