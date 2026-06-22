import { apiSlice } from "../../src/api/apiSlice";
export enum UserRole {
  CLIENT = "client",
  TRAINER = "trainer",
  ADMIN = "admin",
}

export interface UserAttributes {
  id: number;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  profileImageUrl?: string | null;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  emailVerifiedAt: Date;
}

interface SignupResponse {
  data: { token: string; refreshToken: string; user: UserAttributes };
  message: string;
  succes: boolean;
}

interface SignupRequest {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  data: { token: string; refreshToken: string; user: UserAttributes };
  message: string;
  succes: boolean;
}

interface GenericMessageResponse {
  success: boolean;
  message: string;
}

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export const authApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),
    signup: builder.mutation<SignupResponse, SignupRequest>({
      query: (client) => ({
        url: "/auth/register",
        method: "POST",
        body: client,
      }),
    }),
    forgotPassword: builder.mutation<GenericMessageResponse, ForgotPasswordRequest>({
      query: (body) => ({
        url: "/auth/forgot-password",
        method: "POST",
        body,
      }),
    }),
    resetPassword: builder.mutation<GenericMessageResponse, ResetPasswordRequest>({
      query: (body) => ({
        url: "/auth/reset-password",
        method: "POST",
        body,
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useSignupMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = authApiSlice;
