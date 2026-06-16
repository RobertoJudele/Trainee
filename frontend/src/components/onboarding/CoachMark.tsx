// src/components/onboarding/CoachMark.tsx
//
// The floating overlay for the active tour step. Dims the screen, cuts out a
// "spotlight" around the current target (four dim panels + a highlight border),
// and shows a tooltip card with Next / Back / Skip and a step counter. If the
// target couldn't be measured, the tooltip is centered with no spotlight.
import React from "react";
import {
  Modal,
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

  if (!isActive || !currentStep) return null;

  const isLast = stepIndex >= totalSteps - 1;

  let spotlight: { x: number; y: number; w: number; h: number } | null = null;
  if (currentRect) {
    const x = Math.max(0, currentRect.x - SPOTLIGHT_PAD);
    const y = Math.max(0, currentRect.y - SPOTLIGHT_PAD);
    spotlight = {
      x,
      y,
      w: Math.min(screenW - x, currentRect.width + SPOTLIGHT_PAD * 2),
      h: Math.min(screenH - y, currentRect.height + SPOTLIGHT_PAD * 2),
    };
  }

  let tooltipPos: { top: number } | { bottom: number };
  if (spotlight) {
    const spaceBelow = screenH - (spotlight.y + spotlight.h) - insets.bottom;
    tooltipPos =
      spaceBelow > 210
        ? { top: spotlight.y + spotlight.h + 14 }
        : { bottom: screenH - spotlight.y + 14 };
  } else {
    tooltipPos = { top: Math.round(screenH * 0.36) };
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={skip}>
      <View style={StyleSheet.absoluteFill}>
        {spotlight ? (
          <>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: spotlight.y }]} />
            <View
              style={[
                styles.dim,
                { top: spotlight.y, left: 0, width: spotlight.x, height: spotlight.h },
              ]}
            />
            <View
              style={[
                styles.dim,
                {
                  top: spotlight.y,
                  left: spotlight.x + spotlight.w,
                  right: 0,
                  height: spotlight.h,
                },
              ]}
            />
            <View
              style={[
                styles.dim,
                { top: spotlight.y + spotlight.h, left: 0, right: 0, bottom: 0 },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.highlight,
                { left: spotlight.x, top: spotlight.y, width: spotlight.w, height: spotlight.h },
              ]}
            />
          </>
        ) : (
          <View style={[styles.dim, StyleSheet.absoluteFill]} />
        )}

        <View
          style={[
            styles.tooltip,
            { left: 16, right: 16, marginBottom: insets.bottom },
            tooltipPos,
          ]}
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
              <Pressable
                onPress={next}
                style={[styles.navBtn, styles.nextBtn]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={isLast ? "Finish tutorial" : "Next step"}
              >
                <Text style={styles.nextText}>{isLast ? "Done" : "Next"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    position: "absolute",
    backgroundColor: "rgba(15,23,42,0.74)",
  },
  highlight: {
    position: "absolute",
    borderWidth: 2,
    borderColor: theme.colors.primary,
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
});
