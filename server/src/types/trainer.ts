export interface TrainerProfileAttributes {
  id: number;
  publicId?: string;
  /** Readable identifier for the public web page at /t/<slug>. */
  slug?: string;
  userId: number;
  bio?: string;
  experienceYears?: number;
  hourlyRate?: number;
  sessionRate?: number;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  instagramUrl?: string;
  facebookUrl?: string;
  whatsappUrl?: string;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  isFeatured: boolean;
  isAvailable: boolean;
  profileViews: number;
  totalRating: number;
  reviewCount: number;
  trialEndsAt: Date;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: subStatus;
  billingProvider: BillingProvider;
  appleOriginalTransactionId?: string;
  googlePurchaseToken?: string;
  iapProductId?: string;
  iapExpiresAt?: Date;
  iapLastVerifiedAt?: Date;
  currentPeriodEndsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum subStatus{
  TRIAL='trial', ACTIVE='active', PAST='past_due', CANCELED='canceled'
}

export enum BillingProvider {
  NONE = "none",
  STRIPE = "stripe",
  APPLE = "apple",
  GOOGLE = "google",
}

export interface TrainerProfileCreationAttributes {
  userId: number;
  /** Set once at creation; never regenerated, so printed links keep working. */
  slug?: string;
  bio?: string;
  experienceYears?: number;
  hourlyRate?: number;
  sessionRate?: number;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  instagramUrl?: string;
  facebookUrl?: string;
  whatsappUrl?: string;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  specializationIds?: number[];
  trialEndsAt: Date;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: subStatus;
  billingProvider?: BillingProvider;
  appleOriginalTransactionId?: string;
  googlePurchaseToken?: string;
  iapProductId?: string;
  iapExpiresAt?: Date;
  iapLastVerifiedAt?: Date;
  currentPeriodEndsAt?: Date;
}
