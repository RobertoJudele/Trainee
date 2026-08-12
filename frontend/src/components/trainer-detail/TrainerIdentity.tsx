import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, typography } from "../../lib/theme";

type TrainerIdentityProps = {
  fullName: string;
  /** "5 ani experiență · București" — either half may be missing. */
  subtitle?: string;
  rating: number;
  reviewCount: number;
  reviewsLabel: string;
};

export default function TrainerIdentity({
  fullName,
  subtitle,
  rating,
  reviewCount,
  reviewsLabel,
}: TrainerIdentityProps) {
  return (
    <View>
      <Text style={styles.name} numberOfLines={2}>
        {fullName}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.ratingRow}>
        <Ionicons name="star" size={15} color={theme.colors.primary} />
        <Text style={styles.rating}>{Number(rating).toFixed(1)}</Text>
        <Text style={styles.reviews}>
          ({reviewCount} {reviewsLabel})
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  name: {
    ...typography.h2,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: theme.colors.text,
  },
  subtitle: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    marginTop: 5,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
  },
  rating: {
    ...typography.body1,
    fontWeight: "800",
    color: theme.colors.text,
  },
  reviews: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
});
