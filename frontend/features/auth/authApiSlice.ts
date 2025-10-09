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
  }),
});

export const { useLoginMutation } = authApiSlice;
