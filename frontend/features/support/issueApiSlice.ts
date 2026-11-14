import { apiSlice } from "../../src/api/apiSlice";

export type IssueTargetType = "trainer" | "booking" | "app" | "gym" | "review";
export type IssueCategory =
  | "trainer_behavior"
  | "booking_no_show"
  | "technical_bug"
  | "payment_issue"
  | "gym_request"
  | "objectionable_content"
  | "other";

export interface CreateIssueRequest {
  targetType: IssueTargetType;
  category: IssueCategory;
  title: string;
  description: string;
  trainerId?: number;
  trainerPublicId?: string;
  bookingId?: number;
  metadata?: Record<string, unknown>;
}

export interface IssueReporter {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

/** Server-built snapshot attached to payment_issue reports (metadata.billing). */
export interface IssueBillingSnapshot {
  capturedAt: string;
  trainerId: number | null;
  subscriptionStatus?: string | null;
  billingProvider?: string | null;
  productId?: string | null;
  expiresAt?: string | null;
  trialEndsAt?: string | null;
  appleOriginalTransactionId?: string | null;
  googlePurchaseToken?: string | null;
  stripeSubscriptionId?: string | null;
  lastTransaction: {
    id: number;
    transactionId?: string | null;
    productId?: string | null;
    provider?: string | null;
    status?: string | null;
    amount?: number | string | null;
    currency?: string | null;
    paidAt?: string | null;
  } | null;
}

interface IssueRecord {
  id: number;
  reporterId: number;
  reporter?: IssueReporter | null;
  trainerId?: number;
  bookingId?: number;
  targetType: IssueTargetType;
  category: IssueCategory;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
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
      transformResponse: (response: { data: IssueRecord }) => response.data,
    }),
  }),
});

export const {
  useCreateIssueMutation,
  useGetMyIssuesQuery,
  useGetIssuesAdminQuery,
  useUpdateIssueStatusAdminMutation,
} = issueApiSlice;
