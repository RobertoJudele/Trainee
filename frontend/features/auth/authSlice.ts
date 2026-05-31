import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { TrainerProfileAttributes } from "../../src/types/trainer";

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  profileImageUrl?: string | null;
  isVerified?: boolean;
  isActive?: boolean;
  lastLoginAt?: string | Date;
  emailVerificationToken?: string | null;
  emailVerificationExpires?: string | null;
  emailVerifiedAt?: string | Date | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

interface AuthState {
  user: User | null;
  token: string | null;
  trainer: TrainerProfileAttributes | null;
}

interface SetCredentialsPayload {
  user: User | null;
  token: string | null;
  trainer?: TrainerProfileAttributes | null;
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
    setCredentials: (state, action: PayloadAction<SetCredentialsPayload>) => {
      const { user, token, trainer } = action.payload;
      const previousUserId = state.user?.id ?? null;
      const previousRole = state.user?.role ?? null;
      const nextUserId = user?.id ?? null;
      const nextRole = user?.role ?? null;

      state.user = user;
      state.token = token;

      if (nextRole !== "trainer") {
        state.trainer = null;
        return;
      }

      if (trainer !== undefined) {
        state.trainer = trainer;
        return;
      }

      const accountChanged = previousUserId !== nextUserId;
      const roleChanged = previousRole !== nextRole;
      if (accountChanged || roleChanged) {
        state.trainer = null;
      }
    },
    setTrainerProfile: (state, action: PayloadAction<TrainerProfileAttributes | null>) => {
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
