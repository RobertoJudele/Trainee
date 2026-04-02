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
  }),
});

export const { useCreateSubscriptionMutation } = billingApiSlice;
