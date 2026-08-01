import type { Trainer } from "../../models/trainer";
import { BillingProvider, BillingState, subStatus } from "./types";

// Single source for mapping a Trainer row to the pure BillingState the billing
// domain understands. Previously duplicated in SequelizeBillingStateRepo and
// the trainer controller.
export function toBillingState(trainer: Trainer): BillingState {
  return {
    trainerId: trainer.id,
    userId: trainer.userId,
    billingProvider: (trainer.billingProvider as BillingProvider) || BillingProvider.NONE,
    subscriptionStatus: (trainer.subscriptionStatus as subStatus) || subStatus.CANCELED,
    stripeCustomerId: trainer.stripeCustomerId || undefined,
    stripeSubscriptionId: trainer.stripeSubscriptionId || undefined,
    trialEndsAt: trainer.trialEndsAt || undefined,
    currentPeriodEndsAt: trainer.currentPeriodEndsAt || undefined,
    iapProductId: trainer.iapProductId || undefined,
    iapExpiresAt: trainer.iapExpiresAt || undefined,
    iapLastVerifiedAt: trainer.iapLastVerifiedAt || undefined,
    appleOriginalTransactionId: trainer.appleOriginalTransactionId || undefined,
    googlePurchaseToken: trainer.googlePurchaseToken || undefined,
  };
}
