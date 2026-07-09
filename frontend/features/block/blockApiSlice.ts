import { apiSlice } from "../../src/api/apiSlice";

export interface BlockedUser {
  id: number;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
}

interface ApiResp<T> {
  success: boolean;
  message: string;
  data: T;
}

export const blockApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBlockedUsers: builder.query<ApiResp<BlockedUser[]>, void>({
      query: () => "/blocks",
      providesTags: ["BlockedUsers"],
    }),
    blockUser: builder.mutation<ApiResp<void>, { blockedUserId: number }>({
      query: (body) => ({ url: "/blocks", method: "POST", body }),
      invalidatesTags: ["BlockedUsers"],
    }),
    unblockUser: builder.mutation<ApiResp<void>, number>({
      query: (userId) => ({ url: `/blocks/${userId}`, method: "DELETE" }),
      invalidatesTags: ["BlockedUsers"],
    }),
  }),
});

export const {
  useGetBlockedUsersQuery,
  useBlockUserMutation,
  useUnblockUserMutation,
} = blockApiSlice;
