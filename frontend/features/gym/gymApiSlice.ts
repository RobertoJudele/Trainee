// frontend/features/gym/gymApiSlice.ts
import { apiSlice } from "../../src/api/apiSlice";

export interface GymMarker {
  id: number;
  name: string;
  address: string;
  city: string;
  state?: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  openingHours?: string;
  phone?: string;
  imageUrl?: string;
  availableTrainerCount: number;
}

/**
 * Gym-staff affiliation. The trainer requests it; an admin approves.
 * Only "approved" renders in the gym's staff section.
 */
export type GymStaffStatus = "none" | "pending" | "approved" | "rejected";

export interface GymStaffRequest {
  id: number;
  trainerId: number;
  gymId: number;
  staffRequestedAt: string | null;
  gymName: string;
  gymCity: string;
  trainerName: string;
}

export interface GymTrainer {
  id: number;
  bio?: string;
  experienceYears?: number;
  hourlyRate?: number;
  sessionRate?: number;
  /** Cheapest per-session price: best price/session across packages, else sessionRate. */
  minSessionPrice?: string | number | null;
  totalRating: number;
  reviewCount: number;
  isAvailableAtGym: boolean;
  /** Only "approved" renders in the gym's staff section. */
  staffStatus: GymStaffStatus;
  user: {
    firstName: string;
    lastName: string;
    profileImageUrl?: string | null;
  };
}

export interface GymDetail extends GymMarker {
  country?: string;
  isActive: boolean;
  trainers: GymTrainer[];
}

export interface MyGym {
  id: number;
  name: string;
  address: string;
  city: string;
  state?: string;
  latitude: number;
  longitude: number;
  openingHours?: string;
  imageUrl?: string;
  rating: number;
  isAvailable: boolean;    // trainer's availability at this specific gym
  staffStatus: GymStaffStatus;
  trainerGymId: number;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface GetAllGymsParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export const gymApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // All gyms for map
    getAllGyms: builder.query<ApiResponse<GymMarker[]>, GetAllGymsParams | void>({
      query: (params) => {
        if (!params) {
          return "/gyms";
        }

        const queryParams = new URLSearchParams();
        if (params.lat !== undefined) {
          queryParams.append("lat", String(params.lat));
        }
        if (params.lng !== undefined) {
          queryParams.append("lng", String(params.lng));
        }
        if (params.radiusKm !== undefined) {
          queryParams.append("radiusKm", String(params.radiusKm));
        }

        const queryString = queryParams.toString();
        return `/gyms${queryString ? `?${queryString}` : ""}`;
      },
      providesTags: ["Gyms"],
      keepUnusedDataFor: 300,
    }),

    // Single gym with trainers
    getGymById: builder.query<ApiResponse<GymDetail>, number>({
      query: (gymId) => `/gyms/${gymId}`,
      providesTags: (_result, _error, gymId) => [{ type: "Gyms", id: gymId }],
    }),

    // Gyms the logged-in trainer has joined
    getMyGyms: builder.query<ApiResponse<MyGym[]>, void>({
      query: () => "/gyms/my-gyms",
      providesTags: ["MyGyms"],
    }),

    // Join a gym
    joinGym: builder.mutation<ApiResponse<void>, number>({
      query: (gymId) => ({
        url: `/gyms/${gymId}/join`,
        method: "POST",
      }),
      invalidatesTags: ["MyGyms", "Gyms"],
    }),

    // Toggle availability at a gym
    setGymAvailability: builder.mutation<
      ApiResponse<void>,
      { gymId: number; isAvailable: boolean }
    >({
      query: ({ gymId, isAvailable }) => ({
        url: `/gyms/${gymId}/availability`,
        method: "PATCH",
        body: { isAvailable },
      }),
      invalidatesTags: ["MyGyms", "Gyms"],
    }),

    // Leave a gym
    leaveGym: builder.mutation<ApiResponse<void>, number>({
      query: (gymId) => ({
        url: `/gyms/${gymId}/leave`,
        method: "DELETE",
      }),
      invalidatesTags: ["MyGyms", "Gyms"],
    }),

    // Ask to be listed as this gym's staff (an admin reviews it)
    requestGymStaff: builder.mutation<ApiResponse<void>, number>({
      query: (gymId) => ({
        url: `/gyms/${gymId}/staff-request`,
        method: "POST",
      }),
      invalidatesTags: ["MyGyms", "GymStaffRequests"],
    }),

    // Admin: pending staff requests
    getGymStaffRequests: builder.query<ApiResponse<GymStaffRequest[]>, void>({
      query: () => "/gyms/staff-requests",
      providesTags: ["GymStaffRequests"],
    }),

    // Admin: approve or reject one
    reviewGymStaff: builder.mutation<
      ApiResponse<void>,
      { gymId: number; trainerId: number; approve: boolean }
    >({
      query: ({ gymId, trainerId, approve }) => ({
        url: `/gyms/${gymId}/staff-request/${trainerId}`,
        method: "PATCH",
        body: { approve },
      }),
      invalidatesTags: ["GymStaffRequests", "Gyms", "MyGyms"],
    }),
  }),
});

export const {
  useGetAllGymsQuery,
  useGetGymByIdQuery,
  useGetMyGymsQuery,
  useJoinGymMutation,
  useSetGymAvailabilityMutation,
  useLeaveGymMutation,
  useRequestGymStaffMutation,
  useGetGymStaffRequestsQuery,
  useReviewGymStaffMutation,
} = gymApiSlice;