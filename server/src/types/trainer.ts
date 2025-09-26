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
}
