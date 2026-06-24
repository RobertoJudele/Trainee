// frontend/src/types/api.ts

export type UserRole = "client" | "trainer" | "admin";

export type UserSex = "male" | "female" | "non_binary" | "other" | "prefer_not_to_say";

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate?: string | null; // Dates are serialized as ISO strings in JSON responses
  sex?: UserSex | null;
  role: UserRole;
  profileImageUrl?: string | null;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt?: string | null;
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled";

export type BillingProvider = "none" | "stripe" | "apple" | "google";

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
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  whatsappUrl?: string | null;
  isFeatured: boolean;
  isAvailable: boolean;
  profileViews: number;
  totalRating: number;
  reviewCount: number;
  trialEndsAt?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus: SubscriptionStatus;
  billingProvider: BillingProvider;
  appleOriginalTransactionId?: string | null;
  googlePurchaseToken?: string | null;
  iapProductId?: string | null;
  iapExpiresAt?: string | null;
  iapLastVerifiedAt?: string | null;
  currentPeriodEndsAt?: string | null;
  createdAt: string;
  updatedAt: string;
  specializations?: Array<{
    id: number;
    name: string;
    description?: string;
    iconUrl?: string;
  }>;
}

export interface AuthResponse {
  user: User;
  token: string;
  trainer?: TrainerProfileAttributes | null;
}

/** Standard server response envelope: `{ success, message, data }`. */
export interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}
