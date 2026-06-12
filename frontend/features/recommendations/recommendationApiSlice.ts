import { apiSlice } from "../../src/api/apiSlice";
import { PublicTrainerUser } from "../trainer/trainerApiSlice";

export type FitnessLevel = "beginner" | "intermediate" | "expert";
export type RateType = "hourly" | "session";

export interface PreferredGymSummary {
  id: number;
  name: string;
  city: string;
  state?: string;
  latitude: number;
  longitude: number;
}

export interface ClientPreferences {
  id: number;
  userId: number;
  preferredSpecializationIds: number[];
  goals: string[];
  fitnessLevel?: FitnessLevel | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredRateType: RateType;
  maxDistanceKm?: number | null;
  preferredGymId?: number | null;
  gym?: PreferredGymSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertClientPreferencesRequest {
  preferredSpecializationIds?: number[];
  goals?: string[];
  fitnessLevel?: FitnessLevel | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredRateType?: RateType;
  maxDistanceKm?: number | null;
  preferredGymId?: number | null;
}

interface ApiResp<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface SuggestedTrainer {
  id: string;
  internalId: number;
  bio?: string;
  experienceYears?: number;
  hourlyRate?: number;
  sessionRate?: number;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  isAvailable: boolean;
  isFeatured: boolean;
  totalRating: number;
  reviewCount: number;
  user: PublicTrainerUser;
  images: Array<{ imageUrl: string; isPrimary: boolean }>;
  specializations: Array<{
    id: number;
    name: string;
    description?: string;
    iconUrl?: string;
    experienceLevel: "beginner" | "intermediate" | "expert";
  }>;
  distanceKm?: number;
  worksAtPreferredGym?: boolean;
  matchScore: number;
  matchPercent: number;
  matchBreakdown: {
    specialization: number;
    rating: number;
    distance: number;
    price: number;
    experienceLevel: number;
  };
}

export interface SuggestTrainersResponse {
  trainers: SuggestedTrainer[];
  hasPreferences: boolean;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export const recommendationApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMyPreferences: builder.query<ApiResp<ClientPreferences | null>, void>({
      query: () => "/recommendations/preferences",
      providesTags: ["ClientPreferences"],
    }),
    updateMyPreferences: builder.mutation<ApiResp<ClientPreferences>, UpsertClientPreferencesRequest>({
      query: (body) => ({
        url: "/recommendations/preferences",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["ClientPreferences"],
    }),
    getSuggestedTrainers: builder.query<ApiResp<SuggestTrainersResponse>, { page?: number; limit?: number } | void>({
      query: (params) => {
        if (!params) return "/recommendations/trainers";
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", String(params.page));
        if (params.limit) queryParams.append("limit", String(params.limit));
        const qs = queryParams.toString();
        return `/recommendations/trainers${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["SuggestedTrainers"],
    }),
  }),
});

export const {
  useGetMyPreferencesQuery,
  useUpdateMyPreferencesMutation,
  useGetSuggestedTrainersQuery,
} = recommendationApiSlice;
