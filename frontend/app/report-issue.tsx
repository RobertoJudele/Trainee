import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CreateIssueRequest,
  IssueCategory,
  IssueTargetType,
  useCreateIssueMutation,
} from "../features/support/issueApiSlice";
import { theme, typography, presets } from "../src/lib/theme";
import { FieldError } from "../src/components/ui";
import { useFieldErrors } from "../src/lib/useFieldErrors";
import { useLanguage } from "../src/lib/i18n/LanguageContext";
import { getApiErrorMessage } from "../src/lib/errors";
import { fonts } from "../src/lib/fonts";

export default function ReportIssueScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();

  const params = useLocalSearchParams<{
    targetType?: IssueTargetType;
    trainerId?: string;
    trainerPublicId?: string;
    bookingId?: string;
    reviewId?: string;
  }>();

  const [createIssue, { isLoading }] = useCreateIssueMutation();

  const targetType: IssueTargetType =
    params.targetType === "trainer" ||
    params.targetType === "booking" ||
    params.targetType === "app" ||
    params.targetType === "review"
      ? params.targetType
      : "app";

  const categories: Array<{ value: IssueCategory; label: string }> =
    targetType === "review"
      ? [
          { value: "objectionable_content", label: t("objectionableContent") },
          { value: "other", label: t("other") },
        ]
      : [
          { value: "trainer_behavior", label: t("trainerBehavior") },
          { value: "booking_no_show", label: t("bookingNoShow") },
          { value: "technical_bug", label: t("technicalBug") },
          { value: "payment_issue", label: t("paymentIssue") },
          { value: "other", label: t("other") },
        ];

  const targetLabels: Partial<Record<IssueTargetType, string>> = {
    app: t("generalAppIssue"),
    trainer: t("trainerIssue"),
    booking: t("bookingIssue"),
    review: t("reviewIssue"),
  };

  const trainerId = useMemo(() => {
    const value = Number(params.trainerId);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [params.trainerId]);

  const trainerPublicId = useMemo(() => {
    if (typeof params.trainerPublicId !== "string") return undefined;
    const value = params.trainerPublicId.trim();
    return value.length > 0 ? value : undefined;
  }, [params.trainerPublicId]);

  const bookingId = useMemo(() => {
    const value = Number(params.bookingId);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [params.bookingId]);

  const reviewId = useMemo(() => {
    const value = Number(params.reviewId);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [params.reviewId]);

  const [category, setCategory] = useState<IssueCategory>(
    targetType === "review"
      ? "objectionable_content"
      : targetType === "trainer"
      ? "trainer_behavior"
      : targetType === "booking"
      ? "booking_no_show"
      : "technical_bug"
  );
  const [title, setTitle] = useState("");
  const fieldErrors = useFieldErrors<"title" | "description">();
  const [description, setDescription] = useState("");

  const onSubmit = async () => {
    const valid = fieldErrors.setAll({
      ...(title.trim().length < 5 ? { title: t("titleMinLength") } : {}),
      ...(description.trim().length < 10 ? { description: t("descriptionMinLength") } : {}),
    });
    if (!valid) return;

    const payload: CreateIssueRequest =
      targetType === "review"
        ? {
            targetType,
            category,
            title: title.trim(),
            description: description.trim(),
            metadata: { reviewId, trainerId },
          }
        : {
            targetType,
            category,
            title: title.trim(),
            description: description.trim(),
            trainerId,
            trainerPublicId,
            bookingId,
          };

    try {
      await createIssue(payload).unwrap();
      Alert.alert(t("submitted"), t("issueReported"), [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, t("error"));
      Alert.alert(t("error"), message);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t("reportIssueTitle")}</Text>
      <Text style={styles.subtitle}>{t("reportIssueSubtitle")}</Text>

      <Pressable
        style={styles.gymRequestCta}
        onPress={() => router.push("/request-gym")}
        accessibilityRole="button"
        accessibilityLabel={t("requestGymCta")}
      >
        <Text style={styles.gymRequestCtaText}>{t("requestGymCta")}</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.label}>{t("issueType")}</Text>
        <Text style={styles.contextText}>{targetLabels[targetType]}</Text>
        {trainerId ? <Text style={styles.contextText}>Trainer ID: {trainerId}</Text> : null}
        {trainerPublicId ? <Text style={styles.contextText}>Trainer Code: {trainerPublicId}</Text> : null}
        {bookingId ? <Text style={styles.contextText}>Booking ID: {bookingId}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t("category")}</Text>
        <View style={styles.chipsWrap}>
          {categories.map((item) => {
            const active = item.value === category;
            return (
              <Pressable
                key={item.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCategory(item.value)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t("title")}</Text>
        <TextInput
          style={[styles.input, fieldErrors.errors.title && presets.inputError]}
          value={title}
          onChangeText={(v) => { fieldErrors.clear("title"); setTitle(v); }}
          placeholder={t("shortSummary")}
          maxLength={140}
        />
        <FieldError message={fieldErrors.errors.title} />

        <Text style={[styles.label, styles.marginTop]}>{t("description")}</Text>
        <TextInput
          style={[styles.input, styles.textArea, fieldErrors.errors.description && presets.inputError]}
          value={description}
          onChangeText={(v) => { fieldErrors.clear("description"); setDescription(v); }}
          multiline
          textAlignVertical="top"
          placeholder={t("describeWhatHappened")}
          maxLength={2000}
        />
        <FieldError message={fieldErrors.errors.description} />
      </View>

      <Pressable
        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
        onPress={onSubmit}
        disabled={isLoading}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={t("submitReport")}
      >
        <Text style={styles.submitText}>{isLoading ? t("submitting") : t("submitReport")}</Text>
      </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { ...typography.h2, color: theme.colors.text },
  subtitle: { ...typography.body2, color: theme.colors.textSecondary },
  card: {
    ...presets.card,
    padding: 16,
    gap: 12,
  },
  label: { ...typography.body2, color: theme.colors.text, fontFamily: fonts.uiBold },
  gymRequestCta: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.roundness,
    paddingVertical: 12,
    alignItems: "center",
  },
  gymRequestCtaText: { ...typography.body2, color: theme.colors.primary, fontFamily: fonts.uiBold },
  contextText: { ...typography.caption, color: theme.colors.textSecondary },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    ...presets.chip,
  },
  chipActive: { ...presets.chipSelected },
  chipText: { ...presets.chipText },
  chipTextActive: { ...presets.chipTextSelected },
  input: {
    ...presets.input,
  },
  textArea: { minHeight: 120 },
  marginTop: { marginTop: 6 },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.control,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { ...typography.body1, color: "#fff", fontFamily: fonts.uiBold },
});
