export interface TrainerData {
  id: number;
  bio: string;
  experienceYears: number;
  hourlyRate: number;
  sessionRate: number;
  locationCity: string;
  locationState: string;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  whatsappUrl?: string | null;
  totalRating: number;
  reviewCount: number;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  };
  images: Array<{
    id: number;
    imageUrl: string;
    isPrimary: boolean;
  }>;
  specializations: Array<{
    id: number;
    name: string;
  }>;
}

export { TrainerProfileAttributes, SubscriptionStatus, BillingProvider } from "./api";
