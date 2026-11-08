// src/components/FreeSessionBadge.tsx
//
// "✓ Prima ședință gratis" — shown on the search card and next to the price on
// a trainer's profile when the trainer turned the offer on. Soft green so it
// reads with the price, not like the amber "Recomandat" badge.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import { fonts } from "../lib/fonts";
import { useLanguage } from "../lib/i18n/LanguageContext";

const BG = "#ECFDF5"; // Emerald 50
const FG = "#065F46"; // Emerald 800: 7.9:1 on BG

export default function FreeSessionBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const { t } = useLanguage();
  const md = size === "md";
  return (
    <View style={[styles.badge, md && styles.badgeMd]}>
      <Ionicons name="checkmark" size={md ? 14 : 12} color={FG} />
      <Text style={[styles.text, md && styles.textMd]}>{t("freeFirstSession")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.xs,
    backgroundColor: BG,
  },
  badgeMd: {
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    lineHeight: 16,
    color: FG,
  },
  textMd: {
    fontSize: 13,
    lineHeight: 18,
  },
});
