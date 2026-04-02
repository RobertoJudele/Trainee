export enum IssueCategory {
  TRAINER_BEHAVIOR = "trainer_behavior",
  BOOKING_NO_SHOW = "booking_no_show",
  TECHNICAL_BUG = "technical_bug",
  PAYMENT_ISSUE = "payment_issue",
  OTHER = "other",
}

export enum IssueTargetType {
  TRAINER = "trainer",
  BOOKING = "booking",
  APP = "app",
}

export enum IssueStatus {
  OPEN = "open",
  IN_REVIEW = "in_review",
  RESOLVED = "resolved",
  REJECTED = "rejected",
}

export interface IssueAttributes {
  id: number;
  reporterId: number;
  trainerId?: number;
  bookingId?: number;
  targetType: IssueTargetType;
  category: IssueCategory;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  status: IssueStatus;
  resolutionNote?: string;
  resolvedAt?: Date;
  resolvedBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueCreationAttributes {
  reporterId: number;
  trainerId?: number;
  bookingId?: number;
  targetType: IssueTargetType;
  category: IssueCategory;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface CreateIssueRequest {
  trainerId?: number;
  bookingId?: number;
  targetType: IssueTargetType;
  category: IssueCategory;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateIssueStatusRequest {
  status: IssueStatus;
  resolutionNote?: string;
}
