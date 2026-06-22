import { Trainer } from "../../../models/trainer";
import { BillingProvider, BillingState, subStatus } from "../types";
import { BillingStateRepository } from "../ports";

export class SequelizeBillingStateRepo implements BillingStateRepository {
  async findByUserId(userId: number): Promise<BillingState | null> {
    const trainer = await Trainer.findOne({ where: { userId } });
    return trainer ? this.toState(trainer) : null;
  }

  async findByStripeCustomerId(customerId: string): Promise<BillingState | null> {
    const trainer = await Trainer.findOne({ where: { stripeCustomerId: customerId } });
    return trainer ? this.toState(trainer) : null;
  }

  async save(state: BillingState): Promise<void> {
    await Trainer.update(
      {
        billingProvider: state.billingProvider,
        subscriptionStatus: state.subscriptionStatus,
        stripeCustomerId: state.stripeCustomerId,
        stripeSubscriptionId: state.stripeSubscriptionId,
        trialEndsAt: state.trialEndsAt,
        currentPeriodEndsAt: state.currentPeriodEndsAt,
        iapProductId: state.iapProductId,
        iapExpiresAt: state.iapExpiresAt,
        iapLastVerifiedAt: state.iapLastVerifiedAt,
        appleOriginalTransactionId: state.appleOriginalTransactionId,
        googlePurchaseToken: state.googlePurchaseToken,
      },
      { where: { id: state.trainerId } },
    );
  }

  private toState(trainer: Trainer): BillingState {
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
}
