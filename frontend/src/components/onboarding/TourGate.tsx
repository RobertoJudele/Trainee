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
  selectPendingTrainerTour,
  selectTrainerTourDone,
} from "../../../features/onboarding/onboardingSlice";
import { useTour } from "./TourContext";
import { clientTour } from "./clientTour";
import { trainerTour } from "./trainerTour";

export default function TourGate() {
  const user = useSelector(selectCurrentUser);
  const pendingTrainer = useSelector(selectPendingTrainerTour);
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

    if (pendingTrainer && !trainerDone) {
      startTour(trainerTour);
      return;
    }

    if (user.role === "client" && !clientDone) {
      startTour(clientTour);
    }
  }, [ready, isActive, user, pendingTrainer, trainerDone, clientDone, startTour]);

  return null;
}
