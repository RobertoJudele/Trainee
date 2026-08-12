import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, typography } from "../../lib/theme";
import { BottomSheet } from "../ui/BottomSheet";

export type ContactOption = {
  label: "Instagram" | "Facebook" | "WhatsApp";
  url: string;
  /** WhatsApp only: https://wa.me/… when the app scheme can't be opened. */
  fallbackUrl?: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
};

type ContactSheetProps = {
  visible: boolean;
  options: ContactOption[];
  trainerName: string;
  title: string;
  onSelect: (option: ContactOption) => void;
  onClose: () => void;
};

export default function ContactSheet({
  visible,
  options,
  trainerName,
  title,
  onSelect,
  onClose,
}: ContactSheetProps) {
  return (
    <BottomSheet visible={visible} title={title} subtitle={trainerName} onClose={onClose}>
      {options.map((option) => (
        <Pressable
          key={option.label}
          style={styles.row}
          onPress={() => onSelect(option)}
          accessible
          accessibilityRole="button"
          accessibilityLabel={option.label}
        >
          <View style={[styles.iconWrap, { backgroundColor: `${option.color}18` }]}>
            <Ionicons name={option.icon} size={22} color={option.color} />
          </View>
          <Text style={styles.label}>{option.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </Pressable>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    ...typography.body1,
    flex: 1,
    color: theme.colors.text,
    fontWeight: "600",
  },
});
