import { apiSlice } from "../../src/api/apiSlice";

export interface TrainerPackageItem {
  id: number;
  trainerId: number;
  name: string;
  price: number;
  sessionCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface TrainerPackagesResponse {
  success: boolean;
  message: string;
  data: TrainerPackageItem[];
}

interface TrainerPackageMutationResponse {
  success: boolean;
  message: string;
  data: TrainerPackageItem;
}

interface CreateTrainerPackageRequest {
  name: string;
  price: number;
  sessionCount: number;
  sortOrder?: number;
}

interface UpdateTrainerPackageRequest {
  id: number;
  name?: string;
  price?: number;
  sessionCount?: number;
  sortOrder?: number;
}

export const trainerPackageApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTrainerPackages: builder.query<TrainerPackagesResponse, number>({
      query: (trainerId) => `/trainer-packages/${trainerId}`,
      providesTags: ["TrainerPackages"],
    }),

    createTrainerPackage: builder.mutation<
      TrainerPackageMutationResponse,
      CreateTrainerPackageRequest
    >({
      query: (body) => ({
        url: "/trainer-packages",
        method: "POST",
        body,
      }),
      invalidatesTags: ["TrainerPackages"],
    }),

    updateTrainerPackage: builder.mutation<
      TrainerPackageMutationResponse,
      UpdateTrainerPackageRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/trainer-packages/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["TrainerPackages"],
    }),

    deleteTrainerPackage: builder.mutation<
      { success: boolean; message: string },
      number
    >({
      query: (id) => ({
        url: `/trainer-packages/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TrainerPackages"],
    }),
  }),
});

export const {
  useGetTrainerPackagesQuery,
  useCreateTrainerPackageMutation,
  useUpdateTrainerPackageMutation,
  useDeleteTrainerPackageMutation,
} = trainerPackageApiSlice;
