// src/components/onboarding/TourContext.tsx
//
// Lightweight, dependency-free coach-mark engine. A "tour" is an ordered list
// of steps; each step can point at a UI element registered via `useTourTarget`.
//
// Steps can be:
//   • dimmed or not (`dim`) — non-dimmed steps keep the screen fully visible
//     (e.g. the map), so the overlay only shows a tooltip.
//   • interactive (`interactive`) — the user advances by tapping the real UI,
//     which the overlay lets through; auto-advance is driven by either a route
//     change (`advanceWhenRoute`) or an app event (`advanceOnEvent` + `notify`).
//
// The overlay is rendered as a pass-through root layer (NOT a Modal) so touches
// can reach the real screen and so measured coordinates line up exactly.
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
  /** Element to spotlight. Omit for steps with no anchor (e.g. the map). */
  targetId?: string;
  title: string;
  body: string;
  /** Pathname to navigate to before showing this step (e.g. "/search"). */
  route?: string;
  /** Darken the rest of the screen. Default true. Set false to keep it visible. */
  dim?: boolean;
  /** User advances by interacting with the real UI (no Next button). */
  interactive?: boolean;
  /** Auto-advance once the route becomes / starts with this (e.g. "/trainers/"). */
  advanceWhenRoute?: string;
  /** Auto-advance when `notify(name)` is called with this name. */
  advanceOnEvent?: string;
  /** Hint shown in place of Next on interactive steps. */
  hint?: string;
  /** Force tooltip placement instead of auto-positioning near the target. */
  tooltipAt?: "top" | "bottom" | "auto";
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
  notify: (event: string) => void;
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
  notify: noop,
  registerTarget: noop,
  unregisterTarget: noop,
};

const TourContext = createContext<TourContextValue>(defaultValue);

export const useTour = () => useContext(TourContext);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sameRect = (a: TourRect, b: TourRect) =>
  Math.abs(a.x - b.x) < 1 &&
  Math.abs(a.y - b.y) < 1 &&
  Math.abs(a.width - b.width) < 1 &&
  Math.abs(a.height - b.height) < 1;

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

  const notify = useCallback(
    (event: string) => {
      if (!activeTour) return;
      const step = activeTour.steps[stepIndex];
      if (step?.advanceOnEvent === event) {
        next();
      }
    },
    [activeTour, stepIndex, next]
  );

  // Auto-advance when the user navigates to the step's expected route.
  useEffect(() => {
    if (!activeTour) return;
    const step = activeTour.steps[stepIndex];
    const target = step?.advanceWhenRoute;
    if (!target) return;
    const matches = pathname === target || pathname.startsWith(target);
    if (matches && pathname !== step.route) {
      next();
    }
  }, [pathname, activeTour, stepIndex, next]);

  // Resolve the active step: navigate to its screen if needed, then measure the
  // target until the layout settles (the value stabilizes across reads). This
  // avoids the "spotlight too high" bug where we'd latch an early measurement
  // taken before the native header pushed the content down.
  useEffect(() => {
    if (!activeTour) {
      setCurrentRect(null);
      return;
    }
    const step = activeTour.steps[stepIndex];
    if (!step) return;

    const cancelled = { current: false };
    const navigating = !!(step.route && pathnameRef.current !== step.route);
    // Keep the previous spotlight while we re-measure on the SAME screen so the
    // highlight glides to the new target instead of flashing to centre and back.
    // Only clear when we're changing screens or the step has no anchor.
    if (navigating || !step.targetId) {
      setCurrentRect(null);
    }

    const run = async () => {
      if (navigating) {
        try {
          router.push(step.route as never);
        } catch {
          // Navigation may not be ready yet; measurement still retries below.
        }
        // Let the screen-transition animation finish before measuring, so we
        // don't latch a position from mid-slide. (The first step looked wrong
        // until you stepped away and back — that was a mid-transition reading.)
        await wait(320);
      }

      if (!step.targetId) {
        return; // No anchor → tooltip is shown centered / at the top.
      }

      // Keep measuring across the whole settle window and update whenever the
      // position changes — this both tracks the scroll (so the highlight moves
      // with the screen) and corrects any late layout shift. Never latch early.
      let last: TourRect | null = null;
      for (let attempt = 0; attempt < 30 && !cancelled.current; attempt++) {
        const measure = targetsRef.current.get(step.targetId);
        const rect = measure ? await measure() : null;
        if (rect && rect.width > 0 && rect.height > 0) {
          if (!last || !sameRect(last, rect)) {
            if (!cancelled.current) setCurrentRect(rect);
            last = rect;
          }
        }
        await wait(55);
      }
    };

    void run();
    return () => {
      cancelled.current = true;
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
      notify,
      registerTarget,
      unregisterTarget,
    }),
    [activeTour, stepIndex, currentRect, startTour, next, back, finish, notify, registerTarget, unregisterTarget]
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
