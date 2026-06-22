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

export type TrainerImageCategory = "gallery" | "credential";

export interface TrainerImageItem {
  id: number;
  imageUrl: string;
  category?: TrainerImageCategory;
  displayOrder?: number;
  createdAt?: string;
}

export interface TrainerImagesResponse {
  success: boolean;
  message: string;
  data: {
    gallery: TrainerImageItem[];
    credential: TrainerImageItem[];
  };
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
  galleryImages?: TrainerImageItem[];
  credentialImages?: TrainerImageItem[];
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

export interface TrainerAnalyticsDayItem {
  date: string;
  label: string;
  count: number;
}

export interface TrainerAnalyticsBreakdown {
  search: number;
  map: number;
  direct: number;
  other: number;
}

export interface TrainerAnalyticsAgeBreakdown {
  under_18: number;
  "18_24": number;
  "25_34": number;
  "35_44": number;
  "45_54": number;
  "55_plus": number;
  unknown: number;
}

export interface TrainerAnalyticsSexBreakdown {
  male: number;
  female: number;
  non_binary: number;
  other: number;
  prefer_not_to_say: number;
  unknown: number;
}

export interface TrainerAnalyticsRecentView {
  id: number;
  viewedAt: string;
  sourceType: keyof TrainerAnalyticsBreakdown;
  viewerUserId?: number | null;
  viewerIpAddress: string;
  age: number | null;
  sex: string;
}

export interface TrainerAnalyticsResponseData {
  totalViews: number;
  uniqueViewEvents: number;
  viewsByDay: TrainerAnalyticsDayItem[];
  sourceBreakdown: TrainerAnalyticsBreakdown;
  ageBreakdown: TrainerAnalyticsAgeBreakdown;
  sexBreakdown: TrainerAnalyticsSexBreakdown;
  recentViews: TrainerAnalyticsRecentView[];
}

export const trainerApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTrainerProfile: builder.query<TrainerProfileResponse, void>({
      query: () => "/trainer",
    }),

    getTrainerById: builder.query<PublicTrainerProfile, string>({
      query: (trainerId) => `/trainer/${trainerId}`,
      transformResponse: (response: any) => {
        return response?.data ?? response;
      },
    }),

    getSpecializations: builder.query<SpecializationListResponse, void>({
      query: () => "/specialization",
    }),

    deleteTrainerProfile: builder.mutation<TrainerDeleteResponse, void>({
      query: () => ({
        url: "/trainer",
        method: "DELETE",
      }),
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
    }),

    getTrainerAnalytics: builder.query<TrainerAnalyticsResponseData, void>({
      query: () => "/trainer/analytics",
      transformResponse: (response: any) => {
        return response?.data ?? response;
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
    }),

    // The authenticated trainer's own gallery + credential images (for management).
    getTrainerImages: builder.query<TrainerImagesResponse, void>({
      query: () => "/trainer-images",
      providesTags: ["TrainerImages"],
    }),

    uploadGalleryImages: builder.mutation<any, FormData>({
      query: (formData) => ({
        url: "/trainer-images/gallery",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["TrainerImages"],
    }),

    uploadCredentialImages: builder.mutation<any, FormData>({
      query: (formData) => ({
        url: "/trainer-images/credential",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["TrainerImages"],
    }),

    deleteTrainerImage: builder.mutation<any, number>({
      query: (id) => ({ url: `/trainer-images/${id}`, method: "DELETE" }),
      invalidatesTags: ["TrainerImages"],
    }),
  }),
});

export const {
  useGetTrainerProfileQuery,
  useGetTrainerByIdQuery,
  useGetSpecializationsQuery,
  useGetTrainerAnalyticsQuery,
  useDeleteTrainerProfileMutation,
  useUpdateTrainerProfileMutation,
  useSearchTrainersQuery,
  useGetTrainerImagesQuery,
  useUploadGalleryImagesMutation,
  useUploadCredentialImagesMutation,
  useDeleteTrainerImageMutation,
} = trainerApiSlice;