export type FitnessLevel = "beginner" | "intermediate" | "expert";
export type RateType = "hourly" | "session";

export interface ClientPreferenceAttributes {
  id: number;
  userId: number;
  preferredSpecializationIds: number[];
  goals: string[];
  fitnessLevel?: FitnessLevel | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredRateType: RateType;
  maxDistanceKm?: number | null;
  preferredGymId?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientPreferenceCreationAttributes {
  userId: number;
  preferredSpecializationIds?: number[];
  goals?: string[];
  fitnessLevel?: FitnessLevel | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredRateType?: RateType;
  maxDistanceKm?: number | null;
  preferredGymId?: number | null;
}
