export interface ReviewAttributes {
  id: number;
  trainerId: number;
  clientId: number;
  rating: number;
  reviewText?: string;
  is_verified: boolean;
  is_reported: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewCreationAttributes {
  trainerId: number;
  clientId: number;
  rating: number;
  reviewText?: string;
}

export interface ReviewRequest {
  rating: number;
  reviewText?: string;
}
