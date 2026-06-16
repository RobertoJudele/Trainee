// src/components/onboarding/CoachMark.tsx
//
// The floating overlay for the active tour step. Rendered as a pass-through
// root layer (NOT a Modal) so it shares the screen's coordinate space and can
// let touches reach the real UI on interactive steps.
//
//   • dimmed steps  → four dark panels around the spotlight + a touch blocker,
//     advanced with the Next button.
//   • non-dim steps → no darkening (e.g. the map / trainer planner stay visible);
//     the highlight outline shows what to look at and the message sits where the
//     step asks (`tooltipAt`).
//   • interactive   → no Next button and no touch blocking over the target.
//
// The spotlight position is animated so it glides between targets on the same
// screen instead of flashing to centre and snapping back.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme, typography } from "../../lib/theme";
import { useTour } from "./TourContext";

const SPOTLIGHT_PAD = 6;

export default function CoachMark() {
  const { isActive, currentStep, currentRect, stepIndex, totalSteps, next, back, skip } =
    useTour();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  // The overlay's own position in the window. `measureInWindow` on a target and
  // the overlay both report window coordinates, but the overlay's top-left is
  // NOT always (0,0) — on Android with edge-to-edge it's offset by the status
  // bar. Subtracting this frame makes the spotlight align on every platform
  // (same trick the day-planner drag overlay uses).
  const rootRef = useRef<View>(null);
  const [frame, setFrame] = useState({ x: 0, y: 0, width: screenW, height: screenH });
  const measureFrame = useCallback(() => {
    rootRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setFrame((prev) =>
          prev.x === x && prev.y === y && prev.width === width && prev.height === height
            ? prev
            : { x, y, width, height }
        );
      }
    });
  }, []);

  // Animated spotlight geometry (glides between targets on the same screen).
  const sx = useRef(new Animated.Value(0)).current;
  const sy = useRef(new Animated.Value(0)).current;
  const sw = useRef(new Animated.Value(0)).current;
  const sh = useRef(new Animated.Value(0)).current;
  const spotOpacity = useRef(new Animated.Value(0)).current;
  const mounted = useRef(false);

  // Tooltip fade on each step change.
  const tooltipOpacity = useRef(new Animated.Value(0)).current;

  // Express the target in overlay-local coordinates.
  const localX = currentRect ? currentRect.x - frame.x : 0;
  const localY = currentRect ? currentRect.y - frame.y : 0;
  const spotlight = currentRect
    ? {
        x: Math.max(0, localX - SPOTLIGHT_PAD),
        y: Math.max(0, localY - SPOTLIGHT_PAD),
        w: Math.min(frame.width, currentRect.width + SPOTLIGHT_PAD * 2),
        h: Math.min(frame.height, currentRect.height + SPOTLIGHT_PAD * 2),
      }
    : null;

  useEffect(() => {
    if (!spotlight) {
      Animated.timing(spotOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: false,
      }).start(() => {
        mounted.current = false;
      });
      return;
    }
    if (!mounted.current) {
      // Fresh appearance (new screen): jump into place, then fade in.
      sx.setValue(spotlight.x);
      sy.setValue(spotlight.y);
      sw.setValue(spotlight.w);
      sh.setValue(spotlight.h);
      mounted.current = true;
      spotOpacity.setValue(0);
      Animated.timing(spotOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      // Same screen → glide to the new target.
      Animated.parallel([
        Animated.spring(sx, { toValue: spotlight.x, useNativeDriver: false, speed: 18, bounciness: 0 }),
        Animated.spring(sy, { toValue: spotlight.y, useNativeDriver: false, speed: 18, bounciness: 0 }),
        Animated.spring(sw, { toValue: spotlight.w, useNativeDriver: false, speed: 18, bounciness: 0 }),
        Animated.spring(sh, { toValue: spotlight.h, useNativeDriver: false, speed: 18, bounciness: 0 }),
        Animated.timing(spotOpacity, { toValue: 1, duration: 120, useNativeDriver: false }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotlight?.x, spotlight?.y, spotlight?.w, spotlight?.h]);

  useEffect(() => {
    tooltipOpacity.setValue(0);
    Animated.timing(tooltipOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
    // Re-check the overlay's window offset in case the layout shifted.
    measureFrame();
  }, [stepIndex, tooltipOpacity, measureFrame]);

  if (!isActive || !currentStep) return null;

  const dim = currentStep.dim !== false;
  const interactive = !!currentStep.interactive;
  const isLast = stepIndex >= totalSteps - 1;
  // On non-interactive dimmed steps, block taps on the target too so the user
  // can't accidentally trigger it mid-tour. Interactive steps leave the hole
  // open; the dim panels always block the surrounding (darkened) area.
  const blockHole = !interactive && dim;

  // Tooltip placement.
  let tooltipPos: { top: number } | { bottom: number };
  if (currentStep.tooltipAt === "bottom") {
    tooltipPos = { bottom: insets.bottom + 16 };
  } else if (currentStep.tooltipAt === "top") {
    tooltipPos = { top: insets.top + 12 };
  } else if (spotlight) {
    const spaceBelow = frame.height - (spotlight.y + spotlight.h) - insets.bottom;
    tooltipPos =
      spaceBelow > 210
        ? { top: spotlight.y + spotlight.h + 14 }
        : { bottom: frame.height - spotlight.y + 14 };
  } else if (dim) {
    tooltipPos = { top: Math.round(frame.height * 0.36) };
  } else {
    tooltipPos = { top: insets.top + 12 };
  }

  const rightLeft = Animated.add(sx, sw);
  const bottomTop = Animated.add(sy, sh);
  const blockPanels = (dim ? "auto" : "none") as "auto" | "none";

  return (
    <View ref={rootRef} onLayout={measureFrame} style={styles.root} pointerEvents="box-none">
      {/* Animated spotlight (dim panels + highlight outline) */}
      {spotlight && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { opacity: spotOpacity }]}
          pointerEvents="box-none"
        >
          {dim && (
            <>
              <Animated.View
                style={[styles.dim, { top: 0, left: 0, right: 0, height: sy }]}
                pointerEvents={blockPanels}
              />
              <Animated.View
                style={[styles.dim, { top: sy, left: 0, width: sx, height: sh }]}
                pointerEvents={blockPanels}
              />
              <Animated.View
                style={[styles.dim, { top: sy, left: rightLeft, right: 0, height: sh }]}
                pointerEvents={blockPanels}
              />
              <Animated.View
                style={[styles.dim, { top: bottomTop, left: 0, right: 0, bottom: 0 }]}
                pointerEvents={blockPanels}
              />
            </>
          )}
          <Animated.View
            pointerEvents="none"
            style={[styles.highlight, { left: sx, top: sy, width: sw, height: sh }]}
          />
        </Animated.View>
      )}

      {/* Block taps on the spotlighted element for non-interactive dimmed steps. */}
      {spotlight && blockHole && (
        <View
          pointerEvents="auto"
          style={{
            position: "absolute",
            left: spotlight.x,
            top: spotlight.y,
            width: spotlight.w,
            height: spotlight.h,
          }}
        />
      )}

      {/* Tooltip card */}
      <Animated.View
        pointerEvents="auto"
        style={[styles.tooltip, { left: 16, right: 16, opacity: tooltipOpacity }, tooltipPos]}
      >
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.body}>{currentStep.body}</Text>

        <View style={styles.footer}>
          <Pressable onPress={skip} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip tutorial">
            <Text style={styles.skip}>Skip</Text>
          </Pressable>

          <Text style={styles.counter}>
            {stepIndex + 1} of {totalSteps}
          </Text>

          <View style={styles.navBtns}>
            {stepIndex > 0 && (
              <Pressable
                onPress={back}
                style={[styles.navBtn, styles.backBtn]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Previous step"
              >
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            )}
            {interactive ? (
              <Text style={styles.hint}>{currentStep.hint ?? "Tap to continue"}</Text>
            ) : (
              <Pressable
                onPress={next}
                style={[styles.navBtn, styles.nextBtn]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={isLast ? "Finish tutorial" : "Next step"}
              >
                <Text style={styles.nextText}>{isLast ? "Done" : "Next"}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  dim: {
    position: "absolute",
    backgroundColor: "rgba(15,23,42,0.74)",
  },
  highlight: {
    position: "absolute",
    borderWidth: 3,
    borderColor: "#FACC15",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  tooltip: {
    position: "absolute",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: theme.spacing.lg,
    gap: 8,
    ...theme.shadows.large,
    elevation: 24,
  },
  title: {
    ...typography.h3,
    color: theme.colors.text,
  },
  body: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    lineHeight: 21,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  skip: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  counter: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  navBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  backBtn: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backText: {
    ...typography.body2,
    color: theme.colors.text,
    fontWeight: "700",
  },
  nextBtn: {
    backgroundColor: theme.colors.primary,
  },
  nextText: {
    ...typography.body2,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  hint: {
    ...typography.caption,
    color: theme.colors.primary,
    fontWeight: "700",
    textTransform: "none",
    fontStyle: "italic",
  },
});
