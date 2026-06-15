// src/components/onboarding/TourContext.tsx
//
// Lightweight, dependency-free coach-mark engine. A "tour" is an ordered list
// of steps; each step points at a UI element registered via `useTourTarget`.
// The provider measures the active step's target (with retries, so it survives
// cross-screen navigation), and exposes the current rect + nav actions to the
// CoachMark overlay. No native modules — just measure-in-window + a Modal.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { selectCurrentUser } from "../../../features/auth/authSlice";
import { markTourCompleted, TourId } from "../../../features/onboarding/onboardingSlice";

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TourStep {
  targetId: string;
  title: string;
  body: string;
  /** Pathname to navigate to before showing this step (e.g. "/search"). */
  route?: string;
}

export interface Tour {
  id: TourId;
  steps: TourStep[];
}

type MeasureFn = () => Promise<TourRect | null>;

interface TourContextValue {
  isActive: boolean;
  currentStep: TourStep | null;
  currentRect: TourRect | null;
  stepIndex: number;
  totalSteps: number;
  startTour: (tour: Tour) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  registerTarget: (id: string, measure: MeasureFn) => void;
  unregisterTarget: (id: string) => void;
}

const noop = () => {};

const defaultValue: TourContextValue = {
  isActive: false,
  currentStep: null,
  currentRect: null,
  stepIndex: 0,
  totalSteps: 0,
  startTour: noop,
  next: noop,
  back: noop,
  skip: noop,
  registerTarget: noop,
  unregisterTarget: noop,
};

const TourContext = createContext<TourContextValue>(defaultValue);

export const useTour = () => useContext(TourContext);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);

  const targetsRef = useRef<Map<string, MeasureFn>>(new Map());
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [currentRect, setCurrentRect] = useState<TourRect | null>(null);

  const registerTarget = useCallback((id: string, measure: MeasureFn) => {
    targetsRef.current.set(id, measure);
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    targetsRef.current.delete(id);
  }, []);

  const startTour = useCallback((tour: Tour) => {
    if (tour.steps.length === 0) return;
    setStepIndex(0);
    setCurrentRect(null);
    setActiveTour(tour);
  }, []);

  const finish = useCallback(() => {
    setActiveTour((tour) => {
      if (tour && user?.id) {
        dispatch(markTourCompleted({ tour: tour.id, userId: user.id }));
      }
      return null;
    });
    setStepIndex(0);
    setCurrentRect(null);
  }, [dispatch, user?.id]);

  const next = useCallback(() => {
    setStepIndex((idx) => {
      if (!activeTour) return idx;
      if (idx >= activeTour.steps.length - 1) {
        finish();
        return idx;
      }
      return idx + 1;
    });
  }, [activeTour, finish]);

  const back = useCallback(() => {
    setStepIndex((idx) => Math.max(0, idx - 1));
  }, []);

  // Resolve the active step: navigate to its screen if needed, then measure the
  // target with retries (the element may still be mounting after navigation).
  // If it never measures, currentRect stays null and the overlay centers the
  // tooltip — we teach the step rather than silently dropping it.
  useEffect(() => {
    if (!activeTour) {
      setCurrentRect(null);
      return;
    }
    const step = activeTour.steps[stepIndex];
    if (!step) return;

    let cancelled = false;
    setCurrentRect(null);

    const run = async () => {
      if (step.route && pathnameRef.current !== step.route) {
        try {
          router.push(step.route as never);
        } catch {
          // Navigation may not be ready yet; the retry loop still measures.
        }
      }

      for (let attempt = 0; attempt < 16 && !cancelled; attempt++) {
        const measure = targetsRef.current.get(step.targetId);
        if (measure) {
          const rect = await measure();
          if (rect && rect.width > 0 && rect.height > 0) {
            if (!cancelled) setCurrentRect(rect);
            return;
          }
        }
        await wait(130);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTour, stepIndex]);

  const value = useMemo<TourContextValue>(
    () => ({
      isActive: !!activeTour,
      currentStep: activeTour ? activeTour.steps[stepIndex] ?? null : null,
      currentRect,
      stepIndex,
      totalSteps: activeTour?.steps.length ?? 0,
      startTour,
      next,
      back,
      skip: finish,
      registerTarget,
      unregisterTarget,
    }),
    [activeTour, stepIndex, currentRect, startTour, next, back, finish, registerTarget, unregisterTarget]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

/**
 * Register a UI element as a tour target. Attach the returned ref to a host
 * View (use `collapsable={false}` on Android so it stays measurable).
 */
export function useTourTarget(id: string) {
  const { registerTarget, unregisterTarget } = useTour();
  const ref = useRef<View | null>(null);

  useEffect(() => {
    const measure: MeasureFn = () =>
      new Promise((resolve) => {
        const node = ref.current;
        if (!node || typeof node.measureInWindow !== "function") {
          resolve(null);
          return;
        }
        node.measureInWindow((x, y, width, height) => {
          resolve({ x, y, width, height });
        });
      });

    registerTarget(id, measure);
    return () => unregisterTarget(id);
  }, [id, registerTarget, unregisterTarget]);

  return ref;
}
