import { apiSlice } from "../../src/api/apiSlice";

export interface WorkingHour {
  id: number;
  trainerId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMin: number;
  isActive: boolean;
}

export interface ScheduleSlot {
  id: number;
  trainerId: number;
  clientId?: number;
  startsAt: string;
  endsAt: string;
  status: "available" | "assigned" | "completed" | "canceled" | "no_show";
  note?: string;
  checkedInAt?: string;
  client?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface GeneratedCheckInCode {
  code: string;
  expiresAt: string;
}

export interface PublicClient {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export interface PendingClientCode {
  checkInCodeId: number;
  expiresAt: string;
  client: PublicClient;
}

export interface BlockedDate {
  id: number;
  trainerId: number;
  date: string; // "YYYY-MM-DD"
  reason?: string | null;
}

// Resolved on-device once; passed to slot-mutating endpoints so the server can
// compute correct UTC instants from the trainer's wall-clock hours.
export const deviceTimeZone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

interface ApiResp<T> {
  success: boolean;
  message: string;
  data: T;
}

export const scheduleApiSlice = apiSlice.injectEndpoints(
  {
  endpoints: (builder) => ({
    upsertWorkingHour: builder.mutation<
      ApiResp<WorkingHour>,
      {
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        slotDurationMin?: number;
        isActive?: boolean;
      }
    >({
      query: (body) => ({
        url: "/trainer-schedule/working-hours",
        method: "POST",
        body,
      }),
    }),
    getWorkingHours: builder.query<ApiResp<WorkingHour[]>, void>({
      query: () => "/trainer-schedule/working-hours",
    }),
    generateSlots: builder.mutation<
      ApiResp<{ count: number; slots: ScheduleSlot[] }>,
      { fromDate: string; toDate: string; timeZone?: string }
    >({
      query: (body) => ({
        url: "/trainer-schedule/generate-slots",
        method: "POST",
        body,
      }),
      // After generating slots the trainer's slot list must refresh
      invalidatesTags: ["TrainerSlots"],
    }),
    getTrainerSlots: builder.query<ApiResp<ScheduleSlot[]>, { from?: string; to?: string } | void>({
      query: (params) => {
        if (!params) {
          return "/trainer-schedule/slots";
        }

        const queryParams = new URLSearchParams();
        if (params.from) queryParams.append("from", params.from);
        if (params.to) queryParams.append("to", params.to);
        const qs = queryParams.toString();
        return `/trainer-schedule/slots${qs ? `?${qs}` : ""}`;
      },
      // Tag this data so mutations can invalidate it
      providesTags: ["TrainerSlots"],
    }),
    searchClients: builder.query<ApiResp<PublicClient[]>, string>({
      query: (q) => `/trainer-schedule/clients/search?q=${encodeURIComponent(q)}`,
    }),
    assignClientToSlot: builder.mutation<
      ApiResp<{ slot: ScheduleSlot }>,
      { slotId: number; clientId: number; note?: string }
    >({
      query: ({ slotId, ...body }) => ({
        url: `/trainer-schedule/slots/${slotId}/assign-client`,
        method: "POST",
        body,
      }),
      // Refresh both the trainer's view AND the client's schedule
      invalidatesTags: ["TrainerSlots", "MySchedule"],
    }),
    unassignClientFromSlot: builder.mutation<ApiResp<{ slot: ScheduleSlot }>, { slotId: number }>({
      query: ({ slotId }) => ({
        url: `/trainer-schedule/slots/${slotId}/unassign-client`,
        method: "POST",
      }),
      invalidatesTags: ["TrainerSlots", "MySchedule"],
    }),
    trainerCheckInSlot: builder.mutation<ApiResp<ScheduleSlot>, { slotId: number; code: string }>({
      query: ({ slotId, code }) => ({
        url: `/trainer-schedule/slots/${slotId}/check-in`,
        method: "POST",
        body: { code },
      }),
      invalidatesTags: ["TrainerSlots", "MySchedule"],
    }),
    assignSlotByClientCode: builder.mutation<
      ApiResp<{ slot: ScheduleSlot }>,
      { slotId: number; code: string; note?: string }
    >({
      query: ({ slotId, ...body }) => ({
        url: `/trainer-schedule/slots/${slotId}/assign-by-code`,
        method: "POST",
        body,
      }),
      // This is the drag-and-drop one — refresh both sides!
      invalidatesTags: ["TrainerSlots", "MySchedule", "PendingClientCodes"],
    }),
    getPendingClientCodes: builder.query<ApiResp<PendingClientCode[]>, void>({
      query: () => "/trainer-schedule/client-codes/pending",
      providesTags: ["PendingClientCodes"],
    }),
    resolveClientCode: builder.mutation<ApiResp<PendingClientCode>, { code: string }>({
      query: (body) => ({
        url: "/trainer-schedule/client-codes/resolve",
        method: "POST",
        body,
      }),
    }),
    assignSlotByCodeId: builder.mutation<
      ApiResp<{ slot: ScheduleSlot }>,
      { slotId: number; checkInCodeId: number; note?: string }
    >({
      query: ({ slotId, ...body }) => ({
        url: `/trainer-schedule/slots/${slotId}/assign-by-code-id`,
        method: "POST",
        body,
      }),
      // Also the drag-and-drop variant — refresh both sides!
      invalidatesTags: ["TrainerSlots", "MySchedule", "PendingClientCodes"],
    }),
    getBlockedDates: builder.query<
      ApiResp<BlockedDate[]>,
      { from?: string; to?: string } | void
    >({
      query: (params) => {
        if (!params) {
          return "/trainer-schedule/blocked-dates";
        }
        const queryParams = new URLSearchParams();
        if (params.from) queryParams.append("from", params.from);
        if (params.to) queryParams.append("to", params.to);
        const qs = queryParams.toString();
        return `/trainer-schedule/blocked-dates${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["BlockedDates"],
    }),
    regenerateDay: builder.mutation<
      ApiResp<{ created: number; removed: number; preserved: number; slots: ScheduleSlot[] }>,
      { date: string; startTime?: string; endTime?: string; slotDurationMin?: number; timeZone?: string }
    >({
      query: ({ date, ...body }) => ({
        url: `/trainer-schedule/days/${date}/regenerate`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["TrainerSlots"],
    }),
    createOneOffSlot: builder.mutation<
      ApiResp<{ slot: ScheduleSlot }>,
      { date: string; startTime: string; endTime: string; note?: string; timeZone?: string }
    >({
      query: (body) => ({
        url: "/trainer-schedule/slots",
        method: "POST",
        body,
      }),
      invalidatesTags: ["TrainerSlots"],
    }),
    deleteSlot: builder.mutation<ApiResp<{ slotId: number }>, { slotId: number }>({
      query: ({ slotId }) => ({
        url: `/trainer-schedule/slots/${slotId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TrainerSlots"],
    }),
    blockDate: builder.mutation<
      ApiResp<{ blockedDate: BlockedDate; removedAvailable: number }>,
      { date: string; reason?: string; timeZone?: string }
    >({
      query: (body) => ({
        url: "/trainer-schedule/blocked-dates",
        method: "POST",
        body,
      }),
      invalidatesTags: ["TrainerSlots", "BlockedDates"],
    }),
    unblockDate: builder.mutation<ApiResp<{ date: string }>, { date: string }>({
      query: ({ date }) => ({
        url: `/trainer-schedule/blocked-dates/${date}`,
        method: "DELETE",
      }),
      invalidatesTags: ["BlockedDates"],
    }),
    getMySchedule: builder.query<ApiResp<ScheduleSlot[]>, { from?: string; to?: string } | void>({
      query: (params) => {
        if (!params) {
          return "/trainer-schedule/my-schedule";
        }

        const queryParams = new URLSearchParams();
        if (params.from) queryParams.append("from", params.from);
        if (params.to) queryParams.append("to", params.to);
        const qs = queryParams.toString();
        return `/trainer-schedule/my-schedule${qs ? `?${qs}` : ""}`;
      },
      // Tag this data so assignment mutations can invalidate it
      providesTags: ["MySchedule"],
    }),
    generateMyCheckInCode: builder.mutation<ApiResp<GeneratedCheckInCode>, void>({
      query: () => ({
        url: "/trainer-schedule/my-schedule/generate-check-in-code",
        method: "POST",
      }),
    }),
  }),
});

export const {
  useUpsertWorkingHourMutation,
  useGetWorkingHoursQuery,
  useGenerateSlotsMutation,
  useGetTrainerSlotsQuery,
  useSearchClientsQuery,
  useAssignClientToSlotMutation,
  useUnassignClientFromSlotMutation,
  useTrainerCheckInSlotMutation,
  useAssignSlotByClientCodeMutation,
  useGetPendingClientCodesQuery,
  useResolveClientCodeMutation,
  useAssignSlotByCodeIdMutation,
  useGetMyScheduleQuery,
  useGenerateMyCheckInCodeMutation,
  useGetBlockedDatesQuery,
  useRegenerateDayMutation,
  useCreateOneOffSlotMutation,
  useDeleteSlotMutation,
  useBlockDateMutation,
  useUnblockDateMutation,
} = scheduleApiSlice;
