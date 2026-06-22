export interface TrainerPackageAttributes {
  id: number;
  trainerId: number;
  name: string;
  price: number;
  sessionCount: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainerPackageCreationAttributes {
  trainerId: number;
  name: string;
  price: number;
  sessionCount: number;
  sortOrder?: number;
}
