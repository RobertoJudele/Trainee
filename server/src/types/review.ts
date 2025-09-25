export interface ReviewAttributes {
  id: number;
  trainer_id: number;
  client_id: number;
  rating: number;
  review_text?: string;
  is_verified: boolean;
  is_reported: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ReviewCreationAttributes {
  trainer_id: number;
  client_id: number;
  rating: number;
  review_text?: string;
}

export interface ReviewRequest {
  rating: number;
  review_text?: string;
}
