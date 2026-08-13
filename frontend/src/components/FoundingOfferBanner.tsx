import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme, typography } from "../lib/theme";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { useGetFoundingOfferQuery } from "../../features/billing/billingApiSlice";
import { describeFoundingOffer } from "../lib/foundingOffer";

/**
 * The founding-trainer offer, shown where it is actionable: the become-a-trainer
 * form. Renders nothing at all unless the server says the promo is open, so the
 * deadline can be moved or the promo ended without a new store build.
 */
export default function FoundingOfferBanner({
  /** Outer spacing from the host screen — applied here, not by a wrapper, so a
   *  closed promo leaves no empty gap behind. */
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) {
  const { t, language } = useLanguage();
  const { data } = useGetFoundingOfferQuery();

  const view = describeFoundingOffer(data?.data);
  if (!view) {
    return null;
  }

  const deadlineIso = data?.data?.deadline;
  const deadlineLabel = deadlineIso
    ? new Date(deadlineIso).toLocaleDateString(language === "ro" ? "ro-RO" : "en-GB", {
        day: "numeric",
        month: "long",
      })
    : "";

  const countdown =
    view.daysLeft <= 1
      ? t("foundingOfferLastDay")
      : (view.needsDe ? t("foundingOfferDaysLeftDe") : t("foundingOfferDaysLeft")).replace(
          "{n}",
          String(view.daysLeft)
        );

  return (
    <LinearGradient
      colors={theme.gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.banner, style]}
    >
      <View style={styles.header}>
        <Ionicons name="gift-outline" size={20} color="#FFFFFF" />
        <Text style={styles.title}>
          {t("foundingOfferTitle").replace("{n}", String(view.months))}
        </Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{countdown}</Text>
        </View>
      </View>
      <Text style={styles.body}>
        {t("foundingOfferBody")
          .replace("{date}", deadlineLabel)
          .replace("{n}", String(view.months))}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: theme.roundness,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    ...theme.shadows.medium,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    ...typography.body1,
    flex: 1,
    color: "#FFFFFF",
    fontWeight: "800",
  },
  pill: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    ...typography.caption,
    textTransform: "none",
    color: "#FFFFFF",
    fontWeight: "700",
  },
  body: {
    ...typography.body2,
    color: "rgba(255,255,255,0.92)",
    lineHeight: 20,
  },
});
