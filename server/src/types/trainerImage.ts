// "gallery"    = trainer's showcase photos (max 5)
// "credential" = combined certifications & contest awards (max 5)
// Profile pictures are NOT stored here — they live on User.profileImageUrl.
export type TrainerImageCategory = "gallery" | "credential";

export interface TrainerImageAttributes {
  id: number;
  trainerId: number;
  imageUrl: string;
  category: TrainerImageCategory;
  altText?: string;
  isPrimary: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainerImageCreationAttributes {
  trainerId: number;
  imageUrl: string;
  category?: TrainerImageCategory;
  altText?: string;
  isPrimary?: boolean;
  displayOrder?: number;
}
