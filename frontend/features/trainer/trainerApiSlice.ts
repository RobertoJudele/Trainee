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

interface TrainerProfileResponse {
  success: boolean;
  message: string;
  data: TrainerProfileAttributes;
}

interface TrainerDeleteResponse {
  success: boolean;
  message: string;
}

export interface SearchParams {
  q?: string;
  city?: string;
  state?: string;
  country?: string;
  minRate?: number;
  maxRate?: number;
  rateType?: "hourly" | "session";
  minExperience?: number;
  maxExperience?: number;
  minRating?: number;
  specializations?: string; // comma-separated IDs e.g. "1,2,3"
  isAvailable?: boolean;
  isFeatured?: boolean;
  sortBy?: "totalRating" | "experienceYears" | "hourlyRate" | "sessionRate" | "reviewCount" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface TrainerSearchItem {
  bio?: string;
  experienceYears?: number;
  hourlyRate?: number;
  sessionRate?: number;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  isAvailable: boolean;
  isFeatured: boolean;
  profileViews: number;
  totalRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  user: {
    firstName: string;
    lastName: string;
    profileImageUrl?: string | null;
  };
  images: Array<{ imageUrl: string; isPrimary: boolean }>;
  specializations: Array<{ id: number; name: string; description?: string; iconUrl?: string }>;
}

export interface TrainerSearchResponse {
  success: boolean;
  message: string;
  data: {
    trainers: TrainerSearchItem[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}

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
      query: () => ({
        url: "/trainer",
        method: "DELETE",
      }),
      transformErrorResponse: (response: any) => {
        console.log("🔴 Delete trainer error:", JSON.stringify(response));
        return response;
      },
    }),

    searchTrainers: builder.query<TrainerSearchResponse, SearchParams | void>({
      query: (params) => {
        if (!params) return "/trainer/search";
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, val]) => {
          if (val !== undefined && val !== null && val !== "") {
            queryParams.append(key, String(val));
          }
        });
        const qs = queryParams.toString();
        return `/trainer/search${qs ? `?${qs}` : ""}`;
      },
      transformResponse: (response: any) => {
        console.log("🔍 Search response:", response);
        return response;
      },
      transformErrorResponse: (response: any) => {
        console.log("🔴 Search error:", response);
        return response;
      },
    }),
  }),
});

export const {
  useGetTrainerProfileQuery,
  useDeleteTrainerProfileMutation,
  useSearchTrainersQuery,
} = trainerApiSlice;