import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useGenerateMyCheckInCodeMutation, useGetMyScheduleQuery } from "../features/schedule/scheduleApiSlice";
import { useSelector } from "react-redux";
import { useRouter } from "expo-router";
import { selectCurrentUser } from "../features/auth/authSlice";
import { UserRole } from "../features/auth/authApiSlice";
import { theme, typography } from "../src/lib/theme";

export default function MyScheduleScreen() {
  const router = useRouter();
  const user = useSelector(selectCurrentUser);
  const { data, isLoading, isError, refetch, isFetching } = useGetMyScheduleQuery();
  const [generateCode, { isLoading: isGeneratingCode }] = useGenerateMyCheckInCodeMutation();
  const [generatedCode, setGeneratedCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const slots = data?.data || [];

  const onGenerateCode = async () => {
    try {
      const resp = await generateCode().unwrap();
      setGeneratedCode({
        code: resp.data.code,
        expiresAt: resp.data.expiresAt,
      });
    } catch (error: any) {
      Alert.alert("Error", error?.data?.message || "Could not generate check-in code.");
    }
  };

  if (user?.role !== UserRole.CLIENT) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Client access required</Text>
        <Text style={styles.emptyText}>This page shows sessions assigned to clients.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace("/")}>
          <Text style={styles.primaryBtnText}>Go to Home</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading || isFetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Could not load your schedule.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={slots}
      keyExtractor={(item) => String(item.id)}
      refreshing={isFetching}
      onRefresh={refetch}
      ListHeaderComponent={
        <View style={styles.card}>
          <Text style={styles.title}>Generate Client Code</Text>
          <Text style={styles.text}>Create a short-lived code and share it directly with your trainer.</Text>
          <Pressable
            style={[styles.primaryBtn, isGeneratingCode && styles.primaryBtnDisabled]}
            onPress={onGenerateCode}
            disabled={isGeneratingCode}
          >
            <Text style={styles.primaryBtnText}>{isGeneratingCode ? "Generating..." : "Generate Check-in Code"}</Text>
          </Pressable>
          {generatedCode && (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Give this code to your trainer</Text>
              <Text style={styles.codeText}>{generatedCode.code}</Text>
              <Text style={styles.codeExpiry}>Expires: {new Date(generatedCode.expiresAt).toLocaleString()}</Text>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={<Text style={styles.emptyText}>No upcoming sessions yet. You can still generate a code above.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.title}>Session #{item.id}</Text>
          <Text style={styles.text}>Start: {new Date(item.startsAt).toLocaleString()}</Text>
          <Text style={styles.text}>End: {new Date(item.endsAt).toLocaleString()}</Text>
          <Text style={styles.text}>Status: {item.status}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 10, paddingBottom: 24 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginBottom: 10,
  },
  title: { ...typography.body1, color: theme.colors.text, fontWeight: "700" },
  text: { ...typography.body2, color: theme.colors.textSecondary },
  emptyText: { ...typography.body1, color: theme.colors.textSecondary },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { ...typography.body2, color: "#fff", fontWeight: "700" },
  codeBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#F8FAFF",
    gap: 2,
  },
  codeLabel: { ...typography.caption, color: theme.colors.textSecondary },
  codeText: { ...typography.h3, color: theme.colors.primary, fontWeight: "800", letterSpacing: 2 },
  codeExpiry: { ...typography.caption, color: theme.colors.textSecondary },
});
