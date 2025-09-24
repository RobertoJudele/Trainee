export interface TrainerImageAttributes {
  id: number;
  trainerId: number;
  imageUrl: string;
  altText?: string;
  isPrimary: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainerImageCreationAttributes {
  trainerId: number;
  imageUrl: string;
  altText?: string;
  isPrimary?: boolean;
  displayOrder?: number;
}
