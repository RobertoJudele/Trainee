import { createSlice } from "@reduxjs/toolkit";
import { TrainerProfileAttributes } from "../../src/types/trainer";

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
  trainer: TrainerProfileAttributes | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  trainer: null,
};

interface Authenticated {
  auth: AuthState;
}

const authSlice = createSlice({
  name: "auth",
  initialState: initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
    },
    setTrainerProfile: (state, action) => {
      const trainer = action.payload;
      state.trainer = trainer;
    },
    logOut: (state) => {
      state.user = null;
      state.token = null;
      state.trainer = null;
    },
  },
});

export const { setCredentials, logOut, setTrainerProfile } = authSlice.actions;

export default authSlice.reducer;

export const selectCurrentUser = (state: Authenticated) => state.auth.user;
export const selectCurrentToken = (state: Authenticated) => state.auth.token;
export const selectCurrentTrainer = (state: Authenticated) =>
  state.auth.trainer;
