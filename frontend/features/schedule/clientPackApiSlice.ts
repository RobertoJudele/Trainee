import { apiSlice } from "../../src/api/apiSlice";

export interface ClientSessionPack {
  id: number;
  trainerId: number;
  clientId: number;
  name: string | null;
  totalSessions: number;
  usedSessions: number;
  createdAt: string;
  updatedAt: string;
}

export interface MyClientPack extends ClientSessionPack {
  trainer?: {
    id: number;
    user?: { firstName: string; lastName: string };
  };
}

interface ApiResp<T> {
  success: boolean;
  message: string;
  data: T;
}

export const clientPackApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getClientPacks: builder.query<ApiResp<ClientSessionPack[]>, { clientId?: number } | void>({
      query: (args) =>
        args && args.clientId !== undefined
          ? `/client-packs?clientId=${args.clientId}`
          : "/client-packs",
      providesTags: ["ClientPacks"],
    }),

    getMyPacks: builder.query<ApiResp<MyClientPack[]>, void>({
      query: () => "/client-packs/mine",
      providesTags: ["ClientPacks"],
    }),

    createClientPack: builder.mutation<
      ApiResp<ClientSessionPack>,
      { clientId: number; totalSessions: number; name?: string }
    >({
      query: (body) => ({
        url: "/client-packs",
        method: "POST",
        body,
      }),
      invalidatesTags: ["ClientPacks"],
    }),

    updateClientPack: builder.mutation<
      ApiResp<ClientSessionPack>,
      { id: number; name?: string; totalSessions?: number; usedSessions?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/client-packs/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["ClientPacks"],
    }),

    deleteClientPack: builder.mutation<{ success: boolean; message: string }, number>({
      query: (id) => ({
        url: `/client-packs/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["ClientPacks"],
    }),
  }),
});

export const {
  useGetClientPacksQuery,
  useGetMyPacksQuery,
  useCreateClientPackMutation,
  useUpdateClientPackMutation,
  useDeleteClientPackMutation,
} = clientPackApiSlice;
