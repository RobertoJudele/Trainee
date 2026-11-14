// A client result a trainer shows on their profile: one before photo, one after
// photo and a short free-text caption ("−12 kg în 4 luni"). Max 5 per trainer.
export interface TrainerTransformationAttributes {
  id: number;
  trainerId: number;
  beforeImageUrl: string;
  afterImageUrl: string;
  description: string;
  displayOrder: number;
  createdAt: Date;
}

export interface TrainerTransformationCreationAttributes {
  trainerId: number;
  beforeImageUrl: string;
  afterImageUrl: string;
  description: string;
  displayOrder?: number;
}
