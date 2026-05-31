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
import { theme, typography } from "../src/lib/theme";

const categories: Array<{ value: IssueCategory; label: string }> = [
  { value: "trainer_behavior", label: "Trainer behavior" },
  { value: "booking_no_show", label: "Booking no-show" },
  { value: "technical_bug", label: "Technical bug" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "other", label: "Other" },
];

const targetLabels: Record<IssueTargetType, string> = {
  app: "General app issue",
  trainer: "Trainer issue",
  booking: "Booking issue",
};

export default function ReportIssueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    targetType?: IssueTargetType;
    trainerId?: string;
    trainerPublicId?: string;
    bookingId?: string;
  }>();

  const [createIssue, { isLoading }] = useCreateIssueMutation();

  const targetType: IssueTargetType =
    params.targetType === "trainer" ||
    params.targetType === "booking" ||
    params.targetType === "app"
      ? params.targetType
      : "app";

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

  const [category, setCategory] = useState<IssueCategory>(
    targetType === "trainer"
      ? "trainer_behavior"
      : targetType === "booking"
      ? "booking_no_show"
      : "technical_bug"
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const onSubmit = async () => {
    if (title.trim().length < 5) {
      Alert.alert("Validation", "Title must be at least 5 characters.");
      return;
    }

    if (description.trim().length < 10) {
      Alert.alert("Validation", "Description must be at least 10 characters.");
      return;
    }

    const payload: CreateIssueRequest = {
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
      Alert.alert("Submitted", "Issue reported successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      const message = error?.data?.message || "Could not submit issue.";
      Alert.alert("Error", message);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Report Issue</Text>
      <Text style={styles.subtitle}>Help us resolve problems faster.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Issue Type</Text>
        <Text style={styles.contextText}>{targetLabels[targetType]}</Text>
        {trainerId ? <Text style={styles.contextText}>Trainer ID: {trainerId}</Text> : null}
        {trainerPublicId ? <Text style={styles.contextText}>Trainer Code: {trainerPublicId}</Text> : null}
        {bookingId ? <Text style={styles.contextText}>Booking ID: {bookingId}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.chipsWrap}>
          {categories.map((item) => {
            const active = item.value === category;
            return (
              <Pressable
                key={item.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCategory(item.value)}
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
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Short summary"
          maxLength={140}
        />

        <Text style={[styles.label, styles.marginTop]}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          placeholder="Describe what happened, when, and what you expected"
          maxLength={2000}
        />
      </View>

      <Pressable
        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
        onPress={onSubmit}
        disabled={isLoading}
      >
        <Text style={styles.submitText}>{isLoading ? "Submitting..." : "Submit Report"}</Text>
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 12,
    ...theme.shadows.small,
  },
  label: { ...typography.body2, color: theme.colors.text, fontWeight: "700" },
  contextText: { ...typography.caption, color: theme.colors.textSecondary },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { ...typography.caption, color: theme.colors.text },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  },
  textArea: { minHeight: 120 },
  marginTop: { marginTop: 6 },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness,
    paddingVertical: 14,
    alignItems: "center",
    ...theme.shadows.medium,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { ...typography.body1, color: "#fff", fontWeight: "700" },
});
