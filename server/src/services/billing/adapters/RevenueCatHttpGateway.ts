import { RevenueCatSubscriberData } from "../types";
import { RevenueCatGateway } from "../ports";

const DEFAULT_API_URL = "https://api.revenuecat.com/v1";

export class RevenueCatHttpGateway implements RevenueCatGateway {
  constructor(
    private readonly config: {
      apiUrl?: string;
      secretApiKey: string;
      webhookAuth?: string;
    },
  ) {}

  async fetchSubscriber(appUserId: string): Promise<RevenueCatSubscriberData> {
    if (!this.config.secretApiKey) {
      throw new Error("Missing REVENUECAT_SECRET_API_KEY");
    }

    const baseUrl = this.config.apiUrl?.trim() || DEFAULT_API_URL;
    const endpoint = `${baseUrl}/subscribers/${encodeURIComponent(appUserId)}`;

    const fetchImpl = (globalThis as any).fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error("Global fetch is not available for RevenueCat API calls");
    }

    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.config.secretApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      throw new Error(`RevenueCat API request failed (${response.status}): ${errorPayload}`);
    }

    const json = await response.json();
    const subscriber = json?.subscriber;

    return {
      entitlements: subscriber?.entitlements ?? {},
      subscriptions: subscriber?.subscriptions ?? {},
    };
  }

  isWebhookAuthorized(authorizationHeader: string | undefined): boolean {
    const expected = this.config.webhookAuth?.trim();
    if (!expected) return true;

    if (typeof authorizationHeader !== "string") return false;

    const normalized = authorizationHeader.trim();
    return normalized === expected || normalized === `Bearer ${expected}`;
  }
}
