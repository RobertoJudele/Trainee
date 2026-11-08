import { apiSlice } from "../../src/api/apiSlice";
import { ApiEnvelope } from "../../src/types/api";
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
  contactNameDative?: string | null;
  freeFirstSession?: boolean;
  gender?: TrainerGender;
  specializationIds?: number[];
}

export interface SpecializationItem {
  id: number;
  name: string;
  description?: string;
  iconUrl?: string;
  isActive: boolean;
}

/**
 * A specialization as it comes back attached to a trainer. Narrower than
 * SpecializationItem: the trainer endpoints select only these four columns, so it has
 * no isActive.
 */
export interface TrainerSpecializationItem {
  id: number;
  name: string;
  description?: string;
  iconUrl?: string;
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

export interface TrainerTransformationItem {
  id: number;
  beforeImageUrl: string;
  afterImageUrl: string;
  description: string;
  displayOrder?: number;
}

export interface PublicTrainerProfile {
  id: string;
  internalId?: number;
  userId: number;
  bio?: string;
  experienceYears?: number;
  hourlyRate?: number;
  sessionRate?: number;
  /** Cheapest per-session price: best price/session across packages, else sessionRate. */
  minSessionPrice?: string | number | null;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  whatsappUrl?: string | null;
  /** Name in the dative for the contact button ("lui Andrei"); typed in at onboarding. */
  contactNameDative?: string | null;
  isFeatured: boolean;
  freeFirstSession?: boolean;
  isAvailable: boolean;
  profileViews: number;
  totalRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  user?: PublicTrainerUser;
  availableGyms?: PublicTrainerGym[];
  specializations?: TrainerSpecializationItem[];
  credentialImages?: TrainerImageItem[];
  transformations?: TrainerTransformationItem[];
}

/** Stored on the account (users.sex); only these two are offered. */
export type TrainerGender = "male" | "female";

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
  freeFirstSession?: boolean;
  gender?: TrainerGender;
  sortBy?: "totalRating" | "experienceYears" | "hourlyRate" | "sessionRate" | "minSessionPrice" | "reviewCount" | "createdAt";
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
  /** Cheapest per-session price: best price/session across packages, else sessionRate. */
  minSessionPrice?: string | number | null;
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
  freeFirstSession?: boolean;
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
  specializations: TrainerSpecializationItem[];
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
  views: number;
  contacts: number;
}

export interface TrainerAnalyticsSources {
  search: number;
  map: number;
  direct: number;
  other: number;
}

export interface TrainerAnalyticsChannels {
  whatsapp: number;
  instagram: number;
  facebook: number;
}

export interface TrainerAnalyticsPeriod {
  views: number;
  /** Distinct people who tapped a contact button. */
  contacts: number;
}

export interface TrainerAnalyticsResponseData {
  totalViews: number;
  thisWeek: TrainerAnalyticsPeriod;
  lastWeek: TrainerAnalyticsPeriod;
  /** The last 7 days, oldest first, ending today. */
  days: TrainerAnalyticsDayItem[];
  /** Last 30 days. */
  sources: TrainerAnalyticsSources;
  /** Last 30 days, distinct people per channel. */
  channels: TrainerAnalyticsChannels;
}

export const trainerApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTrainerProfile: builder.query<TrainerProfileResponse, void>({
      query: () => "/trainer",
      providesTags: ["TrainerProfile"],
    }),

    getTrainerById: builder.query<PublicTrainerProfile, string>({
      query: (trainerId) => `/trainer/${trainerId}`,
      transformResponse: (response: ApiEnvelope<PublicTrainerProfile>) =>
        response.data ?? (response as unknown as PublicTrainerProfile),
    }),

    // Fire-and-forget: counts a tap on a trainer's contact button. The server
    // emails the Salvio team once 5 different people have tapped.
    recordTrainerContact: builder.mutation<
      void,
      { trainerId: string; channel: "whatsapp" | "instagram" | "facebook" }
    >({
      query: ({ trainerId, channel }) => ({
        url: `/trainer/${trainerId}/contact`,
        method: "POST",
        body: { channel },
      }),
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
      // The profile screen copies GET /trainer into the auth slice on mount, so a
      // stale cached copy would write the pre-save profile back over the saved one.
      invalidatesTags: ["TrainerProfile"],
    }),

    getTrainerAnalytics: builder.query<TrainerAnalyticsResponseData, void>({
      query: () => "/trainer/analytics",
      transformResponse: (response: ApiEnvelope<TrainerAnalyticsResponseData>) =>
        response.data ?? (response as unknown as TrainerAnalyticsResponseData),
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

    // The authenticated trainer's own credential images (for management).
    getTrainerImages: builder.query<TrainerImagesResponse, void>({
      query: () => "/trainer-images",
      providesTags: ["TrainerImages"],
    }),

    uploadCredentialImages: builder.mutation<ApiEnvelope<void>, FormData>({
      query: (formData) => ({
        url: "/trainer-images/credential",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["TrainerImages"],
    }),

    deleteTrainerImage: builder.mutation<ApiEnvelope<void>, number>({
      query: (id) => ({ url: `/trainer-images/${id}`, method: "DELETE" }),
      invalidatesTags: ["TrainerImages"],
    }),

    // The authenticated trainer's own client transformations (for management).
    getTrainerTransformations: builder.query<ApiEnvelope<TrainerTransformationItem[]>, void>({
      query: () => "/trainer-transformations",
      providesTags: ["TrainerTransformations"],
    }),

    // FormData: "before" + "after" files, "description", "consent" = "true".
    createTrainerTransformation: builder.mutation<ApiEnvelope<TrainerTransformationItem>, FormData>({
      query: (formData) => ({
        url: "/trainer-transformations",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["TrainerTransformations"],
    }),

    deleteTrainerTransformation: builder.mutation<ApiEnvelope<void>, number>({
      query: (id) => ({ url: `/trainer-transformations/${id}`, method: "DELETE" }),
      invalidatesTags: ["TrainerTransformations"],
    }),
  }),
});

export const {
  useGetTrainerProfileQuery,
  useGetTrainerByIdQuery,
  useRecordTrainerContactMutation,
  useGetSpecializationsQuery,
  useGetTrainerAnalyticsQuery,
  useDeleteTrainerProfileMutation,
  useUpdateTrainerProfileMutation,
  useSearchTrainersQuery,
  useGetTrainerImagesQuery,
  useUploadCredentialImagesMutation,
  useDeleteTrainerImageMutation,
  useGetTrainerTransformationsQuery,
  useCreateTrainerTransformationMutation,
  useDeleteTrainerTransformationMutation,
} = trainerApiSlice;