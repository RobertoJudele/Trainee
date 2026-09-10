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

export type SocialProvider = "google" | "apple";

interface SocialAuthRequest {
  provider: SocialProvider;
  idToken: string;
  firstName?: string;
  lastName?: string;
}

/**
 * A first-time social sign-in cannot finish on its own: Salvio requires a phone
 * number and neither Google nor Apple supplies one. The server answers with
 * needsProfile plus a short-lived pendingToken instead of a session, and no
 * account exists until completeSocialSignup succeeds.
 */
interface SocialAuthResponse {
  data:
    | { token: string; refreshToken: string; user: UserAttributes }
    | {
        needsProfile: true;
        pendingToken: string;
        email: string;
        firstName: string;
        lastName: string;
      };
  message: string;
  success: boolean;
}

export const needsProfile = (
  data: SocialAuthResponse["data"]
): data is Extract<SocialAuthResponse["data"], { needsProfile: true }> =>
  "needsProfile" in data;

interface CompleteSocialSignupRequest {
  pendingToken: string;
  firstName: string;
  lastName: string;
  phone: string;
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
    socialAuth: builder.mutation<SocialAuthResponse, SocialAuthRequest>({
      query: (body) => ({
        url: "/auth/social",
        method: "POST",
        body,
      }),
    }),
    completeSocialSignup: builder.mutation<
      SignupResponse,
      CompleteSocialSignupRequest
    >({
      query: (body) => ({
        url: "/auth/social/complete",
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
  useSocialAuthMutation,
  useCompleteSocialSignupMutation,
} = authApiSlice;
