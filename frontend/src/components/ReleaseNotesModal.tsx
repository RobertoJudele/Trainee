import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme, typography } from "../lib/theme";
import { useLanguage } from "../lib/i18n/LanguageContext";
import type { ReleaseNotes } from "../lib/releaseNotes";

/**
 * "What's new" sheet, shown once after the user updates. Dismissible, unlike the
 * force-update wall — this is an announcement, not a gate.
 */
export default function ReleaseNotesModal({
  notes,
  visible,
  onClose,
}: {
  notes: ReleaseNotes | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  if (!notes) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient
            colors={theme.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Ionicons name="sparkles" size={22} color="#FFFFFF" />
            <Text style={styles.version}>{notes.version}</Text>
          </LinearGradient>

          <View style={styles.body}>
            <Text style={styles.title}>{notes.title}</Text>
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.text}>{notes.body}</Text>
            </ScrollView>

            <Pressable
              style={styles.button}
              onPress={onClose}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("gotIt")}
            >
              <Text style={styles.buttonText}>{t("gotIt")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    overflow: "hidden",
    ...theme.shadows.medium,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  version: {
    ...typography.body2,
    color: "#FFFFFF",
    fontWeight: "800",
  },
  body: {
    padding: 18,
    gap: 12,
  },
  title: {
    ...typography.h3,
    color: theme.colors.text,
    fontWeight: "800",
  },
  // Capped so a long changelog scrolls instead of pushing the button off screen.
  scroll: {
    maxHeight: 260,
  },
  text: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
  },
  buttonText: {
    ...typography.body1,
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
