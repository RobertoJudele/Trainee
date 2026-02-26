export interface TrainerImageAttributes {
  id: string;
  trainerId: string;
  imageUrl: string;
  altText?: string;
  isPrimary: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainerImageCreationAttributes {
  trainerId: string;
  imageUrl: string;
  altText?: string;
  isPrimary?: boolean;
  displayOrder?: number;
}
