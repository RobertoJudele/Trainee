import { apiSlice } from "../../src/api/apiSlice";
import { setCredentials } from "../auth/authSlice";

interface ProfileRequest {}

interface ProfilePictureResponse {
  success: boolean;
  message: string;
  data?: { user: any };
}

// After a profile-picture change the server returns the updated user. Patch it
// into the auth slice (keeping the current tokens) so the new avatar shows
// everywhere immediately, without a re-login or full profile refetch.
async function syncUserAfterPicture(
  queryFulfilled: Promise<{ data: ProfilePictureResponse }>,
  dispatch: any,
  getState: any
) {
  try {
    const { data } = await queryFulfilled;
    const updatedUser = data?.data?.user;
    if (!updatedUser) return;
    const state = getState();
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
      query: (trainerData) => {
        console.log("Create trainer mutation with: ", trainerData);
        return { url: "/trainer/create", method: "POST", body: trainerData };
      },
      transformErrorResponse: (response: any) => {
        console.log("🔴 Signup error response:", JSON.stringify(response)); // ✅ Add error logging
        if (response?.data?.errors) {
          console.log(
            "🔴 Detailed errors:",
            JSON.stringify(response.data.errors, null, 2)
          );
          // Log each error individually
          response.data.errors.forEach((error: any, index: number) => {
            console.log(
              `🔴 Error ${index + 1}:`,
              JSON.stringify(error, null, 2)
            );
          });
        }
        return response;
      },
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
      query: () => {
        console.log("Mutation deleting user");
        return { url: "/users", method: "DELETE" };
      },
      transformErrorResponse: (response: any) => {
        console.log("🔴 Deleting error response:", JSON.stringify(response)); // ✅ Add error logging
        if (response?.data?.errors) {
          console.log(
            "🔴 Detailed errors:",
            JSON.stringify(response.data.errors, null, 2)
          );
          // Log each error individually
          response.data.errors.forEach((error: any, index: number) => {
            console.log(
              `🔴 Error ${index + 1}:`,
              JSON.stringify(error, null, 2)
            );
          });
        }
        return response;
      },
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
