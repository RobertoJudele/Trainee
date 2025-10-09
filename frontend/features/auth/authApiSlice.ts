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
  data: { token: string; user: UserAttributes };
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
  data: { token: string; user: UserAttributes };
  message: string;
  succes: boolean;
}

export const authApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => {
        console.log("Login mutation called wih:", credentials); // ✅ Debug log
        return {
          url: "/auth/login",
          method: "POST",
          body: credentials,
        };
      },
    }),
    signup: builder.mutation<SignupResponse, SignupRequest>({
      query: (client) => {
        console.log("Sign up mutation called with: ", client);
        return {
          url: "/auth/register",
          method: "POST",
          body: client,
        };
      },
      transformErrorResponse: (response: any) => {
        console.log("🔴 Signup error response:", JSON.stringify(response)); // ✅ Add error logging
        if (response?.data?.errors) {
          console.log(
            "🔴 Detailed errors:",
            JSON.stringify(response.data.errors, null, 2)
          );
          // Log each error individually
          response.data.errors.forEach((error: any, index: number) => {
            console.log(
              `🔴 Error ${index + 1}:`,
              JSON.stringify(error, null, 2)
            );
          });
        }
        return response;
      },
    }),
  }),
});

export const { useLoginMutation, useSignupMutation } = authApiSlice;
