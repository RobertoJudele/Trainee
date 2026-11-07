// src/components/TrainerImageSection.tsx
//
// Reusable management grid for one image category (gallery OR certifications &
// awards). Shows existing images with a delete button and an "add" tile that is
// disabled once the category hits its max. Presentational only — the parent owns
// the data and the upload/delete mutations.
import React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, typography } from "../lib/theme";
import { TrainerImageItem } from "../../features/trainer/trainerApiSlice";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { fonts } from "../lib/fonts";

interface Props {
  title: string;
  subtitle?: string;
  images: TrainerImageItem[];
  max: number;
  uploading?: boolean;
  deletingId?: number | null;
  onAdd: () => void;
  onDelete: (id: number) => void;
}

const TILE = 100;

export default function TrainerImageSection({
  title,
  subtitle,
  images,
  max,
  uploading = false,
  deletingId = null,
  onAdd,
  onDelete,
}: Props) {
  const { t } = useLanguage();
  const atLimit = images.length >= max;

  const confirmDelete = (id: number) =>
    Alert.alert("Remove image", "Delete this image?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(id) },
    ]);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>
          {images.length}/{max}
        </Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.grid}>
        {images.map((img) => (
          <View key={img.id} style={styles.tile}>
            <Image source={{ uri: img.imageUrl }} style={styles.tileImage} />
            <Pressable
              style={styles.deleteBtn}
              hitSlop={10}
              onPress={() => confirmDelete(img.id)}
              disabled={deletingId === img.id}
              accessibilityRole="button"
              accessibilityLabel={t("a11yDeleteImage")}
            >
              {deletingId === img.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="close" size={16} color="#fff" />
              )}
            </Pressable>
          </View>
        ))}

        {!atLimit && (
          <Pressable
            style={[styles.tile, styles.addTile]}
            onPress={onAdd}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel={`Add to ${title}`}
          >
            {uploading ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <>
                <Ionicons name="add" size={28} color={theme.colors.primary} />
                <Text style={styles.addText}>Add</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
    marginBottom: 20,
    ...theme.shadows.small,
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: theme.roundness,
    overflow: "hidden",
  },
  tileImage: {
    width: "100%",
    height: "100%",
  },
  deleteBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  addTile: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background,
  },
  addText: {
    ...typography.button, fontSize: 14,
    color: theme.colors.primary,
    marginTop: 2,
  },
});
