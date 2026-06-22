import { stripe } from "../../config/stripe";
import { BillingService } from "./BillingService";
import { SequelizeBillingStateRepo } from "./adapters/SequelizeBillingStateRepo";
import { SequelizeTransactionRepo } from "./adapters/SequelizeTransactionRepo";
import { SequelizeWebhookEventRepo } from "./adapters/SequelizeWebhookEventRepo";
import { StripeSdkGateway } from "./adapters/StripeSdkGateway";
import { RevenueCatHttpGateway } from "./adapters/RevenueCatHttpGateway";
import { EnvBillingConfig } from "./adapters/EnvBillingConfig";
import { SystemClock } from "./adapters/SystemClock";

export const billingService = new BillingService(
  new SequelizeBillingStateRepo(),
  new SequelizeTransactionRepo(),
  new SequelizeWebhookEventRepo(),
  new StripeSdkGateway(stripe),
  new RevenueCatHttpGateway({
    apiUrl: process.env.REVENUECAT_API_URL,
    secretApiKey: process.env.REVENUECAT_SECRET_API_KEY || "",
    webhookAuth: process.env.REVENUECAT_WEBHOOK_AUTH,
  }),
  new EnvBillingConfig(),
  new SystemClock(),
);
