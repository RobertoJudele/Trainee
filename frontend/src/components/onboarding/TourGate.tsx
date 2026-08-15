// src/components/onboarding/TourGate.tsx
//
// Watches auth + onboarding state and auto-starts the right tour:
//   • CLIENT first login  → client tour (once, persisted)
//   • after creating a trainer account → trainer tour (once, persisted)
// Renders nothing.
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "../../../features/auth/authSlice";
import {
  selectClientTourDone,
  selectPendingTrainerTourUserId,
  selectTrainerTourDone,
} from "../../../features/onboarding/onboardingSlice";
import { useTour } from "./TourContext";
import { clientTour } from "./clientTour";
import { trainerTour } from "./trainerTour";
import { decideTour } from "./decideTour";

export default function TourGate() {
  const user = useSelector(selectCurrentUser);
  const pendingTrainerTourUserId = useSelector(selectPendingTrainerTourUserId);
  const clientDone = useSelector(selectClientTourDone(user?.id));
  const trainerDone = useSelector(selectTrainerTourDone(user?.id));
  const { startTour, isActive } = useTour();

  // Let the initial route settle (and persistence rehydrate) before a tour
  // takes over the screen.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 700);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || isActive || !user) return;

    const tour = decideTour({
      userId: user.id,
      role: user.role,
      pendingTrainerTourUserId,
      clientDone,
      trainerDone,
    });

    if (tour === "trainer") startTour(trainerTour);
    else if (tour === "client") startTour(clientTour);
  }, [
    ready,
    isActive,
    user,
    pendingTrainerTourUserId,
    trainerDone,
    clientDone,
    startTour,
  ]);

  return null;
}
