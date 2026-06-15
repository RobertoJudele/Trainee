import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type TourId = "client" | "trainer";

interface OnboardingState {
  // Keyed by user id (as string) so completion is per-account, per-role.
  clientDoneByUser: Record<string, boolean>;
  trainerDoneByUser: Record<string, boolean>;
  // Set right after a client creates a trainer account, so the trainer tour
  // auto-starts the first time the trainer area renders.
  pendingTrainerTour: boolean;
}

const initialState: OnboardingState = {
  clientDoneByUser: {},
  trainerDoneByUser: {},
  pendingTrainerTour: false,
};

const onboardingSlice = createSlice({
  name: "onboarding",
  initialState,
  reducers: {
    markTourCompleted: (
      state,
      action: PayloadAction<{ tour: TourId; userId: number }>
    ) => {
      const { tour, userId } = action.payload;
      const key = String(userId);
      if (tour === "client") {
        state.clientDoneByUser[key] = true;
      } else {
        state.trainerDoneByUser[key] = true;
        state.pendingTrainerTour = false;
      }
    },
    requestTrainerTour: (state) => {
      state.pendingTrainerTour = true;
    },
    clearPendingTrainerTour: (state) => {
      state.pendingTrainerTour = false;
    },
  },
});

export const { markTourCompleted, requestTrainerTour, clearPendingTrainerTour } =
  onboardingSlice.actions;

export default onboardingSlice.reducer;

interface WithOnboarding {
  onboarding: OnboardingState;
}

export const selectClientTourDone =
  (userId?: number | null) => (state: WithOnboarding) =>
    userId ? !!state.onboarding.clientDoneByUser[String(userId)] : false;

export const selectTrainerTourDone =
  (userId?: number | null) => (state: WithOnboarding) =>
    userId ? !!state.onboarding.trainerDoneByUser[String(userId)] : false;

export const selectPendingTrainerTour = (state: WithOnboarding) =>
  state.onboarding.pendingTrainerTour;
