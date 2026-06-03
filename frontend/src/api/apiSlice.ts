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

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
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

      if (refreshResponse && refreshResponse.success && refreshResponse.data) {
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
      } else {
        api.dispatch(logOut());
        api.dispatch(apiSlice.util.resetApiState());
      }
    } else {
      api.dispatch(logOut());
      api.dispatch(apiSlice.util.resetApiState());
    }
  }
  return result;
};

export const apiSlice = createApi({
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Gyms", "MyGyms"],  // ← add this line
  endpoints: (builder) => ({}),
});
