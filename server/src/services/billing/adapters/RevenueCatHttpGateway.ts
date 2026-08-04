import { RevenueCatSubscriberData } from "../types";
import { RevenueCatGateway } from "../ports";
import { normalizeRevenueCatSubscriber } from "../domain";

const DEFAULT_API_URL = "https://api.revenuecat.com/v1";

export class RevenueCatHttpGateway implements RevenueCatGateway {
  constructor(
    private readonly config: {
      apiUrl?: string;
      secretApiKey: string;
      webhookAuth?: string;
    },
  ) {}

  private async request(
    path: string,
    init: { method: string; body?: string },
  ): Promise<any> {
    if (!this.config.secretApiKey) {
      throw new Error("Missing REVENUECAT_SECRET_API_KEY");
    }

    const baseUrl = this.config.apiUrl?.trim() || DEFAULT_API_URL;

    const fetchImpl = (globalThis as any).fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error("Global fetch is not available for RevenueCat API calls");
    }

    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.secretApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      throw new Error(`RevenueCat API request failed (${response.status}): ${errorPayload}`);
    }

    return response.json();
  }

  async fetchSubscriber(appUserId: string): Promise<RevenueCatSubscriberData> {
    const json = await this.request(
      `/subscribers/${encodeURIComponent(appUserId)}`,
      { method: "GET" },
    );
    // RevenueCat answers in snake_case; normalize here so the domain only ever
    // sees the shape it declares.
    return normalizeRevenueCatSubscriber(json?.subscriber ?? {});
  }

  // `duration` (incl. the `lifetime` preset) is deprecated by RevenueCat — an
  // explicit end_time_ms is the supported way to set a promo window.
  async grantPromotionalEntitlement(
    appUserId: string,
    entitlementId: string,
    endTimeMs: number,
  ): Promise<void> {
    await this.request(
      `/subscribers/${encodeURIComponent(appUserId)}`
        + `/entitlements/${encodeURIComponent(entitlementId)}/promotional`,
      { method: "POST", body: JSON.stringify({ end_time_ms: endTimeMs }) },
    );
  }

  isWebhookAuthorized(authorizationHeader: string | undefined): boolean {
    const expected = this.config.webhookAuth?.trim();
    // Fail closed. An unset REVENUECAT_WEBHOOK_AUTH used to accept every caller,
    // so one blank env var silently left an endpoint that mutates billing state
    // open to anyone who knew the path. Startup warns when it is missing.
    if (!expected) return false;

    if (typeof authorizationHeader !== "string") return false;

    const normalized = authorizationHeader.trim();
    return normalized === expected || normalized === `Bearer ${expected}`;
  }
}
