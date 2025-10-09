import { apiSlice } from "../../src/api/apiSlice";

interface ProfileRequest {}

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
  }),
});

export const { useGetProfileQuery, useCreateTrainerMutation } = usersApiSlice;
