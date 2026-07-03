import { apiSlice } from "../../src/api/apiSlice";

export interface NotificationSettings {
  remindersEnabled: boolean;
  hasToken: boolean;
}

interface ApiResp<T> {
  success: boolean;
  message: string;
  data: T;
}

export const notificationApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getNotificationSettings: builder.query<ApiResp<NotificationSettings>, void>({
      query: () => "/notifications/settings",
      providesTags: ["NotificationSettings"],
    }),

    updateNotificationSettings: builder.mutation<
      ApiResp<NotificationSettings>,
      { expoPushToken?: string; remindersEnabled?: boolean; locale?: string }
    >({
      query: (body) => ({
        url: "/notifications/settings",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["NotificationSettings"],
    }),
  }),
});

export const {
  useGetNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
} = notificationApiSlice;
