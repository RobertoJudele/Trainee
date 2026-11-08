// src/components/TrainerTransformationSection.tsx
//
// The trainer's own management card for client transformations: one row per
// before/after pair with a delete button, and an "add" button that opens
// AddTransformationSheet until the max is reached. Presentational only — the
// parent owns the data and the upload/delete mutations.
import React, { useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, typography, presets } from "../lib/theme";
import { fonts } from "../lib/fonts";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { TrainerTransformationItem } from "../../features/trainer/trainerApiSlice";
import { PickedImage } from "../lib/imageUpload";
import AddTransformationSheet from "./AddTransformationSheet";

interface Props {
  transformations: TrainerTransformationItem[];
  max: number;
  submitting?: boolean;
  deletingId?: number | null;
  onCreate: (before: PickedImage, after: PickedImage, description: string) => Promise<boolean>;
  onDelete: (id: number) => void;
}

export default function TrainerTransformationSection({
  transformations,
  max,
  submitting = false,
  deletingId = null,
  onCreate,
  onDelete,
}: Props) {
  const { t } = useLanguage();
  const [sheetOpen, setSheetOpen] = useState(false);
  const atLimit = transformations.length >= max;

  const confirmDelete = (id: number) =>
    Alert.alert(t("deleteTransformationTitle"), t("deleteTransformationBody"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => onDelete(id) },
    ]);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("clientResults")}</Text>
        <Text style={styles.count}>
          {transformations.length}/{max}
        </Text>
      </View>
      <Text style={styles.subtitle}>{t("clientResultsSubtitle")}</Text>

      {transformations.length > 0 && (
        <View>
          {transformations.map((item, index) => (
            <View
              key={item.id}
              style={[styles.row, index === transformations.length - 1 && styles.rowLast]}
            >
              <View style={styles.thumbPair}>
                <Image source={{ uri: item.beforeImageUrl }} style={styles.thumb} />
                <Image source={{ uri: item.afterImageUrl }} style={styles.thumb} />
              </View>
              <Text style={styles.rowText} numberOfLines={2}>
                {item.description}
              </Text>
              <Pressable
                style={styles.deleteBtn}
                onPress={() => confirmDelete(item.id)}
                disabled={deletingId === item.id}
                accessibilityRole="button"
                accessibilityLabel={t("a11yDeleteTransformation")}
              >
                {deletingId === item.id ? (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={theme.colors.text} />
                )}
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {!atLimit && (
        <Pressable
          style={styles.addButton}
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={20} color={theme.colors.primary} />
          <Text style={styles.addText}>{t("addTransformation")}</Text>
        </Pressable>
      )}

      <AddTransformationSheet
        visible={sheetOpen}
        submitting={submitting}
        onClose={() => setSheetOpen(false)}
        onSubmit={onCreate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    ...presets.card,
    padding: theme.spacing.lg,
    gap: 10,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    ...typography.h3,
    color: theme.colors.text,
  },
  count: {
    ...typography.label,
    color: theme.colors.textSecondary,
    fontFamily: fonts.monoSemiBold,
  },
  subtitle: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  thumbPair: {
    flexDirection: "row",
    gap: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  thumb: {
    width: 40,
    height: 56,
    backgroundColor: theme.colors.surfaceSunken,
  },
  rowText: {
    ...typography.small,
    flex: 1,
    color: theme.colors.text,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    height: 52,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: theme.radius.control,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background,
  },
  addText: {
    ...typography.button,
    color: theme.colors.primary,
  },
});
