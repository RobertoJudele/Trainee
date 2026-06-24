import { apiSlice } from "../../src/api/apiSlice";
import { setCredentials } from "../auth/authSlice";
import type { User } from "../auth/authSlice";
import type { AppDispatch, RootState } from "../../app/store";

interface ProfileRequest {}

interface ProfilePictureResponse {
  success: boolean;
  message: string;
  data?: { user: User };
}

// After a profile-picture change the server returns the updated user. Patch it
// into the auth slice (keeping the current tokens) so the new avatar shows
// everywhere immediately, without a re-login or full profile refetch.
async function syncUserAfterPicture(
  queryFulfilled: Promise<{ data: ProfilePictureResponse }>,
  dispatch: AppDispatch,
  getState: () => unknown
) {
  try {
    const { data } = await queryFulfilled;
    const updatedUser = data?.data?.user;
    if (!updatedUser) return;
    const state = getState() as RootState;
    dispatch(
      setCredentials({
        user: updatedUser,
        token: state.auth.token,
        refreshToken: state.auth.refreshToken,
      })
    );
  } catch {
    // mutation already surfaces the error to the caller
  }
}

export const usersApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query({
      query: () => "/auth/profile",
      keepUnusedDataFor: 5,
    }),
    createTrainer: builder.mutation({
      query: (trainerData) => ({
        url: "/trainer/create",
        method: "POST",
        body: trainerData,
      }),
    }),
    uploadProfilePicture: builder.mutation<ProfilePictureResponse, FormData>({
      query: (formData) => ({
        url: "/users/profile-picture",
        method: "POST",
        body: formData,
        // NOTE: do not set Content-Type — fetch adds the multipart boundary itself.
      }),
      async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
        await syncUserAfterPicture(queryFulfilled, dispatch, getState);
      },
    }),
    deleteProfilePicture: builder.mutation<ProfilePictureResponse, void>({
      query: () => ({ url: "/users/profile-picture", method: "DELETE" }),
      async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
        await syncUserAfterPicture(queryFulfilled, dispatch, getState);
      },
    }),
    deleteProfile: builder.mutation<void, void>({
      query: () => ({ url: "/users", method: "DELETE" }),
    }),
  }),
});

export const {
  useGetProfileQuery,
  useCreateTrainerMutation,
  useDeleteProfileMutation,
  useUploadProfilePictureMutation,
  useDeleteProfilePictureMutation,
} = usersApiSlice;
