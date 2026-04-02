import { apiSlice } from "../../src/api/apiSlice";

export type IssueTargetType = "trainer" | "booking" | "app";
export type IssueCategory =
  | "trainer_behavior"
  | "booking_no_show"
  | "technical_bug"
  | "payment_issue"
  | "other";

export interface CreateIssueRequest {
  targetType: IssueTargetType;
  category: IssueCategory;
  title: string;
  description: string;
  trainerId?: number;
  bookingId?: number;
}

interface IssueRecord {
  id: number;
  reporterId: number;
  trainerId?: number;
  bookingId?: number;
  targetType: IssueTargetType;
  category: IssueCategory;
  title: string;
  description: string;
  status: "open" | "in_review" | "resolved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

interface CreateIssueResponse {
  success: boolean;
  message: string;
  data: IssueRecord;
}

interface MyIssuesResponse {
  success: boolean;
  message: string;
  data: IssueRecord[];
}

interface AdminIssuesResponse {
  success: boolean;
  message: string;
  data: IssueRecord[];
}

interface UpdateIssueStatusRequest {
  issueId: number;
  status: "open" | "in_review" | "resolved" | "rejected";
  resolutionNote?: string;
}

export const issueApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createIssue: builder.mutation<CreateIssueResponse, CreateIssueRequest>({
      query: (body) => ({
        url: "/issues",
        method: "POST",
        body,
      }),
    }),
    getMyIssues: builder.query<MyIssuesResponse, void>({
      query: () => "/issues/me",
    }),
    getIssuesAdmin: builder.query<AdminIssuesResponse, void>({
      query: () => "/issues",
    }),
    updateIssueStatusAdmin: builder.mutation<IssueRecord, UpdateIssueStatusRequest>({
      query: ({ issueId, status, resolutionNote }) => ({
        url: `/issues/${issueId}/status`,
        method: "PATCH",
        body: { status, resolutionNote },
      }),
      transformResponse: (response: any) => response?.data,
    }),
  }),
});

export const {
  useCreateIssueMutation,
  useGetMyIssuesQuery,
  useGetIssuesAdminQuery,
  useUpdateIssueStatusAdminMutation,
} = issueApiSlice;
