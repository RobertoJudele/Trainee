import { apiSlice } from "../../src/api/apiSlice";

interface CreateSubscriptionResponse {
  success: boolean;
  message: string;
  data: {
    paymentIntent?: string;
    setupIntent?: string;
    ephemeralKey: string;
    customer: string;
    subscriptionId: string;
  };
}

type BillingSource = "none" | "stripe" | "apple" | "google";

/**
 * The founding-trainer promo, served rather than hardcoded: the deadline and the
 * number of free months are env-overridable on the server, so extending or
 * ending the promo must not require a new store build.
 */
export interface FoundingGrantOffer {
  /** False once the deadline has passed, or if the promo is switched off. */
  isOpen: boolean;
  /** Free months granted at trainer-profile creation. 0 when closed. */
  months: number;
  /** ISO end of the last eligible day. Absent when closed. */
  deadline?: string;
}

interface BillingEntitlement {
  isActive: boolean;
  status: "trial" | "active" | "past_due" | "canceled";
  source: BillingSource;
  expiresAt?: string;
  reason?: string;
  /** Free early-adopter grant rather than a paid or store-trial subscription. */
  isPromotional?: boolean;
  foundingGrant?: FoundingGrantOffer;
}

interface BillingEntitlementResponse {
  success: boolean;
  message: string;
  data: BillingEntitlement;
}

interface ValidateIapSubscriptionRequest {
  platform: "ios" | "android";
  productId: string;
  purchaseToken?: string;
  expiresAt?: string | number;
  originalTransactionId?: string;
}

interface ValidateIapSubscriptionResponse {
  success: boolean;
  message: string;
  data: {
    entitlement: BillingEntitlement;
    provider: BillingSource;
    iapProductId?: string;
    iapExpiresAt?: string;
    iapLastVerifiedAt?: string;
    placeholderValidation: boolean;
    validatedBy?: string;
  };
}

export interface BillingTransaction {
  id: number;
  trainerId: number;
  amount: string | number;
  currency: string;
  status: string;
  provider: string;
  transactionId: string;
  productId: string;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
}

interface BillingTransactionsResponse {
  success: boolean;
  message: string;
  data: BillingTransaction[];
}

export const billingApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createSubscription: builder.mutation<CreateSubscriptionResponse, void>({
      query: () => ({
        url: "/billing/subscribe",
        method: "POST",
      }),
    }),
    getBillingEntitlement: builder.query<BillingEntitlementResponse, void>({
      query: () => "/billing/entitlement",
    }),
    validateIapSubscription: builder.mutation<
      ValidateIapSubscriptionResponse,
      ValidateIapSubscriptionRequest
    >({
      query: (body) => ({
        url: "/billing/revenuecat/sync",
        method: "POST",
        body,
      }),
    }),
    getBillingTransactions: builder.query<BillingTransactionsResponse, void>({
      query: () => "/billing/transactions",
    }),
  }),
});

export const {
  useCreateSubscriptionMutation,
  useGetBillingEntitlementQuery,
  useValidateIapSubscriptionMutation,
  useGetBillingTransactionsQuery,
} = billingApiSlice;
