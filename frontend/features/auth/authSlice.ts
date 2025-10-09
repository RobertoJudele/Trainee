import { createSlice } from "@reduxjs/toolkit";

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  profileImageUrl: string;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt: string;
  emailVerificationToken: string | null;
  emailVerificationExpires: string | null;
  emailVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
};

interface Authenticated {
  auth: AuthState;
}

const authSlice = createSlice({
  name: "auth",
  initialState: initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, accesToken } = action.payload;
      state.user = user;
      state.token = accesToken;
    },
    logOut: (state) => {
      state.user = null;
      state.token = null;
    },
  },
});

export const { setCredentials, logOut } = authSlice.actions;

export default authSlice.reducer;

export const selectCurrentUser = (state: Authenticated) => state.auth.user;
export const selectCurrentToken = (state: Authenticated) => state.auth.token;
