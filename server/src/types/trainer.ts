export interface TrainerProfileAttributes {
  id: number;
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
  trialEndsAt:Date;
  stripeCustomerid:string;
  stripeSubscriptionId:string;
  subscriptionStatus: subStatus;
  currentPeriodEndsAt: Date|null;
}
