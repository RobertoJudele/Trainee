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

export interface TrainerProfileAttributes {
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
  createdAt: Date;
  updatedAt: Date;
  specializations?: Array<{
    id: number;
    name: string;
    description?: string;
    iconUrl?: string;
  }>;
}
