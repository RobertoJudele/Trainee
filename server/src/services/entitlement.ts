import { Trainer } from "../models/trainer";
import { BillingProvider, subStatus } from "../types/trainer";
import { isRevenueCatOnlyMode } from "../config/billingMode";

export interface TrainerEntitlement {
  isActive: boolean;
  status: subStatus;
  source: BillingProvider;
  expiresAt?: Date;
  reason?: string;
}

const normalizeDate = (value?: Date | string | null): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
};

const hasFutureDate = (value?: Date): boolean =>
  Boolean(value && value.getTime() > Date.now());

const normalizeBillingProvider = (value?: string | null): BillingProvider => {
  if (value === BillingProvider.STRIPE) {
    return BillingProvider.STRIPE;
  }

  if (value === BillingProvider.APPLE) {
    return BillingProvider.APPLE;
  }

  if (value === BillingProvider.GOOGLE) {
    return BillingProvider.GOOGLE;
  }

  return BillingProvider.NONE;
};

export const resolveTrainerEntitlement = (trainer: Trainer): TrainerEntitlement => {
  const source = normalizeBillingProvider(trainer.billingProvider);

  const trialEndsAt = normalizeDate(trainer.trialEndsAt);
  const currentPeriodEndsAt = normalizeDate(trainer.currentPeriodEndsAt);
  const iapExpiresAt = normalizeDate(trainer.iapExpiresAt);

  const hasValidTrial = hasFutureDate(trialEndsAt);
  const hasValidStripePeriod = hasFutureDate(currentPeriodEndsAt);
  const hasValidIapPeriod = hasFutureDate(iapExpiresAt);

  if (trainer.subscriptionStatus === subStatus.PAST) {
    return {
      isActive: false,
      status: subStatus.PAST,
      source,
      expiresAt: currentPeriodEndsAt ?? iapExpiresAt ?? trialEndsAt,
      reason: "Subscription is past due.",
    };
  }

  if (trainer.subscriptionStatus === subStatus.CANCELED) {
    return {
      isActive: false,
      status: subStatus.CANCELED,
      source,
      expiresAt: currentPeriodEndsAt ?? iapExpiresAt ?? trialEndsAt,
      reason: "Subscription is canceled.",
    };
  }

  if (trainer.subscriptionStatus === subStatus.TRIAL) {
    if (hasValidTrial) {
      return {
        isActive: true,
        status: subStatus.TRIAL,
        source,
        expiresAt: trialEndsAt,
      };
    }

    return {
      isActive: false,
      status: subStatus.PAST,
      source,
      expiresAt: trialEndsAt,
      reason: "Free trial ended.",
    };
  }

  if (source === BillingProvider.APPLE || source === BillingProvider.GOOGLE) {
    if (hasValidIapPeriod) {
      return {
        isActive: true,
        status: subStatus.ACTIVE,
        source,
        expiresAt: iapExpiresAt,
      };
    }

    return {
      isActive: false,
      status: subStatus.PAST,
      source,
      expiresAt: iapExpiresAt,
      reason: "In-app purchase subscription expired.",
    };
  }

  if (source === BillingProvider.STRIPE) {
    if (isRevenueCatOnlyMode()) {
      return {
        isActive: false,
        status: subStatus.CANCELED,
        source,
        expiresAt: currentPeriodEndsAt,
        reason: "Stripe billing is currently disabled in runtime mode.",
      };
    }

    if (hasValidStripePeriod || !currentPeriodEndsAt) {
      return {
        isActive: true,
        status: subStatus.ACTIVE,
        source,
        expiresAt: currentPeriodEndsAt,
      };
    }

    return {
      isActive: false,
      status: subStatus.PAST,
      source,
      expiresAt: currentPeriodEndsAt,
      reason: "Stripe subscription period ended.",
    };
  }

  return {
    isActive: false,
    status: subStatus.CANCELED,
    source: BillingProvider.NONE,
    reason: "No active billing provider found.",
  };
};
