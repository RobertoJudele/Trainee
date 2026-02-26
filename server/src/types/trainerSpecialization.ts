export interface TrainerSpecializationAttributes {
  id: string;
  trainerId: string;
  specializationId: string;
  experienceLevel: "beginner" | "intermediate" | "expert";
  certification?: string;
  createdAt: Date;
}

export interface TrainerSpecializationCreationAttributes {
  specializationId: string;
  experienceLevel: "beginner" | "intermediate" | "expert";
  certification?: string;
}
