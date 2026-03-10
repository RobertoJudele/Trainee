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

export interface GymTrainer {
  id: number;
  bio?: string;
  experienceYears?: number;
  hourlyRate?: number;
  sessionRate?: number;
  totalRating: number;
  reviewCount: number;
  isAvailableAtGym: boolean;
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
  trainerGymId: number;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const gymApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // All gyms for map
    getAllGyms: builder.query<ApiResponse<GymMarker[]>, void>({
      query: () => "/gyms",
      providesTags: ["Gyms"],
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
    joinGym: builder.mutation<ApiResponse<any>, number>({
      query: (gymId) => ({
        url: `/gyms/${gymId}/join`,
        method: "POST",
      }),
      invalidatesTags: ["MyGyms", "Gyms"],
    }),

    // Toggle availability at a gym
    setGymAvailability: builder.mutation<
      ApiResponse<any>,
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
    leaveGym: builder.mutation<ApiResponse<any>, number>({
      query: (gymId) => ({
        url: `/gyms/${gymId}/leave`,
        method: "DELETE",
      }),
      invalidatesTags: ["MyGyms", "Gyms"],
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
} = gymApiSlice;