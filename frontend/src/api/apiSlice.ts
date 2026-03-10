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
  token: string;
}

const baseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      console.log("Attaching token to request:", token); // ✅ Add debug log
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
  console.log("Making API request:", args); // ✅ Add debug log

  let result = await baseQuery(args, api, extraOptions);
  console.log("🌐 API response:", result); // ✅ Add response debug log

  if (result.error?.status === 401) {
    console.log("Sending refresh token");
    const refreshResult = await baseQuery("/refresh", api, extraOptions);

    const refreshData = refreshResult.data as RefreshResponse;

    console.log(refreshResult);
    if (refreshResult.data) {
      const user = (api.getState() as RootState).auth.user;
      //store the new token
      api.dispatch(setCredentials({ ...refreshData, user }));
      //retry original query with new JWT
      result = await baseQuery(args, api, extraOptions);
    } else {
      api.dispatch(logOut());
    }
  }
  return result;
};

export const apiSlice = createApi({
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Gyms", "MyGyms"],  // ← add this line
  endpoints: (builder) => ({}),
});
