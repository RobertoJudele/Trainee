export interface TrainerProfileAttributes {
  id: number;
  publicId?: string;
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
  isFeatured: boolean;
  isAvailable: boolean;
  profileViews: number;
  totalRating: number;
  reviewCount: number;
  trialEndsAt: Date;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: subStatus;
  currentPeriodEndsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum subStatus{
  TRIAL='trial', ACTIVE='active', PAST='past_due', CANCELED='canceled'
}

export interface TrainerProfileCreationAttributes {
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
  specializationIds?: number[];
  trialEndsAt: Date;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: subStatus;
  currentPeriodEndsAt?: Date;
}
