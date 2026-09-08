export interface GymAttributes {
  id: number;
  name: string;
  address: string;
  city: string;
  state?: string;
  country?: string;
  latitude: number;
  longitude: number;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
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
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  phone?: string;
  openingHours?: string;
  imageUrl?: string;
}

/**
 * Gym-staff affiliation lifecycle. The trainer requests it; an admin approves.
 * Only "approved" affects ordering or client-visible rendering.
 */
export type GymStaffStatus = "none" | "pending" | "approved" | "rejected";

export interface TrainerGymAttributes {
  id: number;
  trainerId: number;
  gymId: number;
  isAvailable: boolean; // trainer is currently available at this gym
  staffStatus: GymStaffStatus;
  staffRequestedAt: Date | null;
  staffReviewedAt: Date | null;
  staffReviewedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainerGymCreationAttributes {
  trainerId: number;
  gymId: number;
  isAvailable?: boolean;
  staffStatus?: GymStaffStatus;
  staffRequestedAt?: Date | null;
  staffReviewedAt?: Date | null;
  staffReviewedBy?: number | null;
}