import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type TourId = "client" | "trainer";

interface OnboardingState {
  // Keyed by user id (as string) so completion is per-account, per-role.
  clientDoneByUser: Record<string, boolean>;
  trainerDoneByUser: Record<string, boolean>;
  /**
   * Id of the user who just created a trainer profile, so the trainer tour
   * auto-starts the first time the trainer area renders.
   *
   * Holds an id rather than a boolean: this state is persisted, and a trainer
   * who never finished the tour left a global `true` behind. Logging out and
   * signing up as a client then started the *trainer* tour on the new account.
   */
  pendingTrainerTourUserId: number | null;
}

const initialState: OnboardingState = {
  clientDoneByUser: {},
  trainerDoneByUser: {},
  pendingTrainerTourUserId: null,
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
        if (state.pendingTrainerTourUserId === userId) {
          state.pendingTrainerTourUserId = null;
        }
      }
    },
    requestTrainerTour: (state, action: PayloadAction<number>) => {
      state.pendingTrainerTourUserId = action.payload;
    },
    clearPendingTrainerTour: (state) => {
      state.pendingTrainerTourUserId = null;
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

export const selectPendingTrainerTourUserId = (state: WithOnboarding) =>
  state.onboarding.pendingTrainerTourUserId ?? null;
