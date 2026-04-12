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

interface BillingEntitlement {
  isActive: boolean;
  status: "trial" | "active" | "past_due" | "canceled";
  source: BillingSource;
  expiresAt?: string;
  reason?: string;
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

export const billingApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createSubscription: builder.mutation<CreateSubscriptionResponse, void>({
      query: () => ({
        url: "/billing/subscribe",
        method: "POST",
      }),
      transformErrorResponse: (response: any) => {
        console.error("🔴 Subscription error:", response);
        return response;
      },
    }),
    getBillingEntitlement: builder.query<BillingEntitlementResponse, void>({
      query: () => "/billing/entitlement",
      transformErrorResponse: (response: any) => {
        console.error("🔴 Entitlement error:", response);
        return response;
      },
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
      transformErrorResponse: (response: any) => {
        console.error("🔴 IAP validation error:", response);
        return response;
      },
    }),
  }),
});

export const {
  useCreateSubscriptionMutation,
  useGetBillingEntitlementQuery,
  useValidateIapSubscriptionMutation,
} = billingApiSlice;
