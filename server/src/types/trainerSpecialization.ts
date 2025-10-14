export interface TrainerSpecializationAttributes {
  id: number;
  trainerId: number;
  specializationId: number;
  experienceLevel: "beginner" | "intermediate" | "expert";
  certification?: string;
  createdAt: Date;
}

export interface TrainerSpecializationCreationAttributes {
  specializationId: number;
  experienceLevel: "beginner" | "intermediate" | "expert";
  certification?: string;
}
