import type { TourId } from "../../../features/onboarding/onboardingSlice";

export interface TourDecisionInput {
  userId?: number | null;
  role?: string | null;
  /** Who asked for the trainer tour, from persisted onboarding state. */
  pendingTrainerTourUserId: number | null;
  clientDone: boolean;
  trainerDone: boolean;
}

/**
 * Which tour, if any, should auto-start for the signed-in user.
 *
 * Both branches are guarded on the role. The trainer tour is additionally
 * guarded on the pending request belonging to *this* user: the flag is
 * persisted, and a trainer who abandoned the tour used to leave it set for
 * whoever signed in next — including a brand-new client account, which then got
 * the trainer walkthrough.
 */
export const decideTour = ({
  userId,
  role,
  pendingTrainerTourUserId,
  clientDone,
  trainerDone,
}: TourDecisionInput): TourId | null => {
  if (!userId) return null;

  if (
    role === "trainer" &&
    pendingTrainerTourUserId === userId &&
    !trainerDone
  ) {
    return "trainer";
  }

  if (role === "client" && !clientDone) {
    return "client";
  }

  return null;
};
