export interface ReviewAttributes {
  id: string;
  trainerId: string;
  clientId: string;
  rating: number;
  reviewText?: string;
  is_verified: boolean;
  is_reported: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewCreationAttributes {
  trainerId: string;
  clientId: string;
  rating: number;
  reviewText?: string;
}

export interface ReviewRequest {
  rating: number;
  reviewText?: string;
}
