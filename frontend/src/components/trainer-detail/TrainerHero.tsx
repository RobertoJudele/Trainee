import React from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme, typography } from "../../lib/theme";

type TrainerHeroProps = {
  height: number;
  /** First non-empty wins: profile photo, then the first gallery image. */
  imageUrl?: string | null;
  initials: string;
  topInset: number;
  /** Fades the floating buttons out as the sticky header fades in. */
  buttonOpacity: Animated.AnimatedInterpolation<number>;
  onBack: () => void;
  onOptions: () => void;
  backLabel: string;
  optionsLabel: string;
};

export default function TrainerHero({
  height,
  imageUrl,
  initials,
  topInset,
  buttonOpacity,
  onBack,
  onOptions,
  backLabel,
  optionsLabel,
}: TrainerHeroProps) {
  return (
    <View style={[styles.hero, { height }]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient colors={theme.gradients.primary} style={[StyleSheet.absoluteFill, styles.fallback]}>
          <Text style={styles.initials}>{initials}</Text>
        </LinearGradient>
      )}

      {/* Keeps the status bar and the floating buttons legible over a bright photo. */}
      <LinearGradient
        colors={["rgba(0,0,0,0.5)", "transparent"]}
        style={[styles.scrim, { height: topInset + 80 }]}
        pointerEvents="none"
      />

      <Animated.View
        style={[styles.buttonRow, { top: topInset + 8, opacity: buttonOpacity }]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={onBack}
          style={styles.fab}
          hitSlop={10}
          accessible
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>
        <Pressable
          onPress={onOptions}
          style={styles.fab}
          hitSlop={10}
          accessible
          accessibilityRole="button"
          accessibilityLabel={optionsLabel}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: "100%",
    backgroundColor: "#1F2937",
    overflow: "hidden",
  },
  fallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    ...typography.h1,
    fontSize: 56,
    lineHeight: 64,
    color: "#FFFFFF",
    fontWeight: "800",
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  buttonRow: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fab: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(17,24,39,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
});
