// src/components/AddTransformationSheet.tsx
//
// Bottom sheet where a trainer adds one client transformation: a before photo,
// an after photo, a short caption and a confirmation that the client agreed to
// publishing. Publish stays disabled until all four are there. The parent owns
// the upload; this only collects the inputs.
import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme, typography } from "../lib/theme";
import { fonts } from "../lib/fonts";
import { Button } from "./ui";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { pickImage, PickedImage } from "../lib/imageUpload";

const DESCRIPTION_MAX = 200;

interface Props {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (before: PickedImage, after: PickedImage, description: string) => Promise<boolean>;
}

export default function AddTransformationSheet({ visible, submitting = false, onClose, onSubmit }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [before, setBefore] = useState<PickedImage | null>(null);
  const [after, setAfter] = useState<PickedImage | null>(null);
  const [description, setDescription] = useState("");
  const [consent, setConsent] = useState(false);

  const reset = () => {
    setBefore(null);
    setAfter(null);
    setDescription("");
    setConsent(false);
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const canPublish = Boolean(before && after && description.trim() && consent) && !submitting;

  const publish = async () => {
    if (!before || !after) return;
    const ok = await onSubmit(before, after, description);
    if (ok) {
      reset();
      onClose();
    }
  };

  const renderSlot = (
    label: string,
    image: PickedImage | null,
    setImage: (img: PickedImage | null) => void,
  ) => (
    <View style={styles.slotColumn}>
      <Text style={styles.slotLabel}>{label}</Text>
      {image ? (
        <View style={styles.slot}>
          <Image source={{ uri: image.uri }} style={styles.slotImage} />
          <Pressable
            style={styles.slotRemove}
            hitSlop={10}
            onPress={() => setImage(null)}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={t("a11yDeleteImage")}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.slot, styles.slotEmpty]}
          onPress={async () => {
            const picked = await pickImage();
            if (picked) setImage(picked);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${t("choosePhoto")}: ${label}`}
        >
          <Ionicons name="add" size={28} color={theme.colors.primary} />
          <Text style={styles.slotEmptyText}>{t("choosePhoto")}</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t("close")} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.title} accessibilityRole="header">
              {t("newTransformation")}
            </Text>

            <View style={styles.slotsRow}>
              {renderSlot(t("transformationBefore"), before, setBefore)}
              {renderSlot(t("transformationAfter"), after, setAfter)}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t("description")}</Text>
              <TextInput
                style={styles.input}
                multiline
                maxLength={DESCRIPTION_MAX}
                value={description}
                onChangeText={setDescription}
                placeholder={t("transformationDescriptionPlaceholder")}
                placeholderTextColor={theme.colors.textSecondary}
                editable={!submitting}
                accessibilityLabel={t("description")}
              />
              <Text style={styles.counter}>
                {description.length}/{DESCRIPTION_MAX}
              </Text>
            </View>

            <Pressable
              style={styles.consentRow}
              onPress={() => setConsent((v) => !v)}
              disabled={submitting}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
            >
              <Ionicons
                name={consent ? "checkbox" : "square-outline"}
                size={24}
                color={consent ? theme.colors.primary : theme.colors.borderInput}
              />
              <Text style={styles.consentText}>{t("transformationConsent")}</Text>
            </Pressable>

            <Button title={t("publish")} onPress={publish} disabled={!canPublish} loading={submitting} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.48)",
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    paddingTop: 12,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.borderStrong,
    marginBottom: 6,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 18,
  },
  title: {
    ...typography.title,
    color: theme.colors.text,
  },
  slotsRow: {
    flexDirection: "row",
    gap: 12,
  },
  slotColumn: {
    flex: 1,
    gap: 8,
  },
  slotLabel: {
    ...typography.label,
    color: theme.colors.textSecondary,
  },
  slot: {
    height: 200,
    borderRadius: theme.radius.control,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceSunken,
  },
  slotImage: {
    width: "100%",
    height: "100%",
  },
  slotRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  slotEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background,
  },
  slotEmptyText: {
    ...typography.button,
    fontSize: 15,
    color: theme.colors.primary,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 14,
    color: theme.colors.text,
  },
  input: {
    ...typography.body,
    color: theme.colors.text,
    minHeight: 84,
    borderWidth: 1,
    borderColor: theme.colors.borderInput,
    borderRadius: theme.radius.control,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },
  counter: {
    alignSelf: "flex-end",
    fontFamily: fonts.mono,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
  },
  consentText: {
    ...typography.small,
    flex: 1,
    color: theme.colors.text,
  },
});
