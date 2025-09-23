// src/utils/response.ts
import { Response } from "express";
import { ApiResponse, ValidationError } from "../types/common";

export const sendSuccess = <T>(
  res: Response,
  statusCode: number = 200,
  message: string = "Success",
  data?: T
): Response<ApiResponse<T>> => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (
  res: Response,
  statusCode: number = 500,
  message: string = "Internal Server Error",
  errors?: ValidationError[]
): Response<ApiResponse> => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};
