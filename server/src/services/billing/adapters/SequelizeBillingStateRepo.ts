import { Trainer } from "../../../models/trainer";
import { BillingState } from "../types";
import { BillingStateRepository } from "../ports";
import { toBillingState } from "../trainerBillingState";

export class SequelizeBillingStateRepo implements BillingStateRepository {
  async findByUserId(userId: number): Promise<BillingState | null> {
    const trainer = await Trainer.findOne({ where: { userId } });
    return trainer ? toBillingState(trainer) : null;
  }

  async findByStripeCustomerId(customerId: string): Promise<BillingState | null> {
    const trainer = await Trainer.findOne({ where: { stripeCustomerId: customerId } });
    return trainer ? toBillingState(trainer) : null;
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
}
