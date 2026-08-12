import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, typography } from "../../lib/theme";

type TrainerStatusScreenProps = {
  /** Renders a spinner instead of icon/title — `hint` becomes the caption. */
  loading?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title?: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

/**
 * The full-screen states this route can land in before (or instead of) the
 * profile: invalid id, loading, load failure, and blocked trainer.
 */
export default function TrainerStatusScreen({
  loading = false,
  icon,
  title,
  hint,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: TrainerStatusScreenProps) {
  return (
    <View style={styles.centered}>
      {loading && <ActivityIndicator size="large" color={theme.colors.primary} />}
      {!loading && icon && (
        <Ionicons name={icon} size={48} color={theme.colors.textSecondary} />
      )}
      {!loading && title ? <Text style={styles.title}>{title}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onAction}
          accessible
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}

      {secondaryLabel && onSecondary ? (
        <TouchableOpacity
          onPress={onSecondary}
          accessible
          accessibilityRole="button"
          accessibilityLabel={secondaryLabel}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    gap: 12,
    backgroundColor: theme.colors.background,
  },
  title: {
    ...typography.body1,
    color: theme.colors.text,
    textAlign: "center",
  },
  hint: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 4,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness,
    paddingVertical: 14,
    alignItems: "center",
    ...theme.shadows.medium,
  },
  primaryButtonText: {
    ...typography.body1,
    color: "#fff",
    fontWeight: "700",
  },
  secondary: {
    marginTop: 4,
  },
  secondaryText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
});
