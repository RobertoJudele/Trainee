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

interface TrainerUpdateRequest {
  bio?: string;
  experienceYears?: number;
  hourlyRate?: number;
  sessionRate?: number;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  whatsappUrl?: string | null;
  specializationIds?: number[];
}

export interface SpecializationItem {
  id: number;
  name: string;
  description?: string;
  iconUrl?: string;
  isActive: boolean;
}

interface SpecializationListResponse {
  success: boolean;
  message: string;
  data: SpecializationItem[];
}

export interface PublicTrainerGym {
  id: number;
  name: string;
  address: string;
  city: string;
  state?: string;
  country?: string;
  latitude: number;
  longitude: number;
  rating?: number;
  reviewCount?: number;
  imageUrl?: string;
}

export interface PublicTrainerUser {
  firstName: string;
  lastName: string;
  profileImageUrl?: string | null;
}

export interface PublicTrainerProfile {
  id: string;
  internalId?: number;
  userId: number;
  bio?: string;
  experienceYears?: number;
  hourlyRate?: number;
  sessionRate?: number;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  whatsappUrl?: string | null;
  isFeatured: boolean;
  isAvailable: boolean;
  profileViews: number;
  totalRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  user?: PublicTrainerUser;
  availableGyms?: PublicTrainerGym[];
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
  id: string;
  internalId?: number;
  bio?: string;
  experienceYears?: number;
  hourlyRate?: number;
  sessionRate?: number;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  whatsappUrl?: string | null;
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

    getTrainerById: builder.query<PublicTrainerProfile, string>({
      query: (trainerId) => `/trainer/${trainerId}`,
      transformResponse: (response: any) => {
        console.log("🎯 Public trainer response:", response);
        return response?.data ?? response;
      },
      transformErrorResponse: (response: any) => {
        console.log("🔴 Public trainer error:", response);
        return response;
      },
    }),

    getSpecializations: builder.query<SpecializationListResponse, void>({
      query: () => "/specialization",
      transformResponse: (response: any) => {
        console.log("🎯 Specializations response:", response);
        return response;
      },
      transformErrorResponse: (response: any) => {
        console.log("🔴 Specializations error:", response);
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

    updateTrainerProfile: builder.mutation<
      TrainerProfileResponse,
      TrainerUpdateRequest
    >({
      query: (body) => ({
        url: "/trainer",
        method: "PUT",
        body,
      }),
      transformErrorResponse: (response: any) => {
        console.log("🔴 Update trainer error:", JSON.stringify(response));
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
  useGetTrainerByIdQuery,
  useGetSpecializationsQuery,
  useDeleteTrainerProfileMutation,
  useUpdateTrainerProfileMutation,
  useSearchTrainersQuery,
} = trainerApiSlice;