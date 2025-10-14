import { apiSlice } from "../../src/api/apiSlice";
import { TrainerProfileAttributes } from "../../src/types/trainer";

interface TrainerProfileResponse {
  success: boolean;
  message: string;
  data: TrainerProfileAttributes;
}

interface TrainerDeleteResponse {
  success: boolean;
  message: string;
}

interface TrainerSearchResponse {
  trainers: TrainerProfileResponse;
}
[];

export const trainerApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTrainerProfile: builder.query<TrainerProfileResponse, void>({
      query: () => "/trainer",
      transformResponse: (response: any) => {
        console.log("🎯 Trainer profile response:", response);
        return response;
      },
      transformErrorResponse: (response: any) => {
        console.log("🔴 Trainer profile error:", response);
        return response;
      },
    }),
    deleteTrainerProfile: builder.mutation<TrainerDeleteResponse, void>({
      query: () => {
        console.log("Deleting trainer profile");
        return {
          url: "/trainer",
          method: "DELETE",
        };
      },
      transformErrorResponse: (response: any) => {
        console.log(
          "🔴 Delete trainer error response:",
          JSON.stringify(response)
        ); // ✅ Add error logging
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
      },
    }),
    searchTrainer: builder.query<TrainerSearchResponse, void>({
      query: () => "/trainer/index",
    }),
  }),
});

export const {
  useGetTrainerProfileQuery,
  useDeleteTrainerProfileMutation,
  useSearchTrainerQuery,
} = trainerApiSlice;
