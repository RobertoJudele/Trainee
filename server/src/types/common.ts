import { Request } from "express";
import { UserAttributes } from "./user";

// src/types/common.ts
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ValidationError[];
}

export interface AuthenticatedRequest extends Request {
  user?: Omit<UserAttributes, "password">;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export enum UserRole {
  CLIENT = "client",
  TRAINER = "trainer",
  ADMIN = "admin",
}
