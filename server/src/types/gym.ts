export interface GymAttributes {
  id: number;
  name: string;
  address: string;
  city: string;
  state?: string;
  country?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  openingHours?: string; // e.g. "Mon-Fri 6:00-22:00, Sat-Sun 8:00-20:00"
  imageUrl?: string;
  rating: number;       // average rating 0-5
  reviewCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GymCreationAttributes {
  name: string;
  address: string;
  city: string;
  state?: string;
  country?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  openingHours?: string;
  imageUrl?: string;
}

export interface TrainerGymAttributes {
  id: number;
  trainerId: number;
  gymId: number;
  isAvailable: boolean; // trainer is currently available at this gym
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainerGymCreationAttributes {
  trainerId: number;
  gymId: number;
  isAvailable?: boolean;
}