import { apiSlice } from "../../src/api/apiSlice";

export interface ReviewClient {
  id: number;
  firstName: string;
  lastName: string;
}

export interface Review {
  id: number;
  trainerId: number;
  clientId: number;
  rating: number;
  reviewText?: string;
  createdAt: string;
  updatedAt: string;
  client: ReviewClient;
}

interface ApiResp<T> {
  success: boolean;
  message: string;
  data: T;
}

export const reviewApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTrainerReviews: builder.query<ApiResp<Review[]>, number>({
      query: (trainerId) => `/reviews/${trainerId}`,
      providesTags: (_result, _error, trainerId) => [
        { type: "Reviews", id: trainerId },
      ],
    }),

    createReview: builder.mutation<
      ApiResp<Review>,
      { trainerId: number; rating: number; reviewText?: string }
    >({
      query: ({ trainerId, rating, reviewText }) => ({
        url: `/reviews/${trainerId}`,
        method: "POST",
        body: { rating, reviewText },
      }),
      invalidatesTags: (_result, _error, { trainerId }) => [
        { type: "Reviews", id: trainerId },
      ],
    }),

    updateReview: builder.mutation<
      ApiResp<void>,
      { reviewId: number; trainerId: number; rating?: number; reviewText?: string }
    >({
      query: ({ reviewId, rating, reviewText }) => ({
        url: `/reviews/${reviewId}`,
        method: "PUT",
        body: { rating, reviewText },
      }),
      invalidatesTags: (_result, _error, { trainerId }) => [
        { type: "Reviews", id: trainerId },
      ],
    }),

    deleteReview: builder.mutation<
      ApiResp<void>,
      { reviewId: number; trainerId: number }
    >({
      query: ({ reviewId }) => ({
        url: `/reviews/${reviewId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { trainerId }) => [
        { type: "Reviews", id: trainerId },
      ],
    }),
  }),
});

export const {
  useGetTrainerReviewsQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
} = reviewApiSlice;
