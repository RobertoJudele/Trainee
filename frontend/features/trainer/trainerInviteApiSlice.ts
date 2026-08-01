import { apiSlice } from "../../src/api/apiSlice";
import { PublicClient } from "../schedule/scheduleApiSlice";

interface ApiResp<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface RedeemInviteResult {
  trainerId: number;
  firstName: string;
  lastName: string;
  alreadyConnected: boolean;
}

export interface MyTrainer {
  trainerId: number;
  firstName: string;
  lastName: string;
}

export const trainerInviteApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMyInviteCode: builder.query<ApiResp<{ code: string }>, void>({
      query: () => "/trainer-invites/mine",
    }),

    getMyConnectedClients: builder.query<ApiResp<PublicClient[]>, void>({
      query: () => "/trainer-invites/clients",
      providesTags: ["TrainerClients"],
    }),

    getMyTrainers: builder.query<ApiResp<MyTrainer[]>, void>({
      query: () => "/trainer-invites/my-trainers",
      providesTags: ["MyTrainers"],
    }),

    redeemTrainerInvite: builder.mutation<ApiResp<RedeemInviteResult>, { code: string }>({
      query: (body) => ({
        url: "/trainer-invites/redeem",
        method: "POST",
        body,
      }),
      invalidatesTags: ["MyTrainers"],
    }),
  }),
});

export const {
  useGetMyInviteCodeQuery,
  useGetMyConnectedClientsQuery,
  useGetMyTrainersQuery,
  useRedeemTrainerInviteMutation,
} = trainerInviteApiSlice;
