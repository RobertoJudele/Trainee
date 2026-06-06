import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useGenerateMyCheckInCodeMutation, useGetMyScheduleQuery, useUnassignClientFromSlotMutation } from "../features/schedule/scheduleApiSlice";
import { useSelector } from "react-redux";
import { useRouter } from "expo-router";
import { selectCurrentUser } from "../features/auth/authSlice";
import { UserRole } from "../features/auth/authApiSlice";
import { theme, typography } from "../src/lib/theme";
import { Ionicons } from "@expo/vector-icons";

export default function MyScheduleScreen() {
  const router = useRouter();
  const user = useSelector(selectCurrentUser);
  const { data, isLoading, isError, refetch, isFetching } = useGetMyScheduleQuery();
  const [generateCode, { isLoading: isGeneratingCode }] = useGenerateMyCheckInCodeMutation();
  const [unassignSlot] = useUnassignClientFromSlotMutation();
  const [cancellingSlotId, setCancellingSlotId] = useState<number | null>(null);
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

  const handleCancelBooking = useCallback((slotId: number, startsAt: string) => {
    const dateStr = new Date(startsAt).toLocaleString();
    Alert.alert(
      "Cancel Booking",
      `Are you sure you want to cancel your session on ${dateStr}? This cannot be undone.`,
      [
        { text: "Keep Booking", style: "cancel" },
        {
          text: "Cancel Booking",
          style: "destructive",
          onPress: async () => {
            setCancellingSlotId(slotId);
            try {
              await unassignSlot({ slotId }).unwrap();
            } catch (err: any) {
              Alert.alert("Error", err?.data?.message || "Could not cancel booking. Please try again.");
            } finally {
              setCancellingSlotId(null);
            }
          },
        },
      ]
    );
  }, [unassignSlot]);

  if (user?.role !== UserRole.CLIENT) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Client access required</Text>
        <Text style={styles.emptyText}>This page shows sessions assigned to clients.</Text>
        <Pressable
        style={styles.primaryBtn}
        onPress={() => router.replace("/")}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Go to Home"
      >
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
          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
            <Ionicons name="qr-code-outline" size={24} color={theme.colors.primary} style={{marginRight: 8}}/>
            <Text style={styles.title}>Generate Client Code</Text>
          </View>
          <Text style={styles.text}>Create a short-lived code and share it directly with your trainer.</Text>
          <Pressable
            style={[styles.primaryBtn, isGeneratingCode && styles.primaryBtnDisabled]}
            onPress={onGenerateCode}
            disabled={isGeneratingCode}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Generate Check-in Code"
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
          <View style={styles.cardHeader}>
            <Ionicons name="calendar" size={16} color={theme.colors.primary} style={{marginRight: 6}} />
            <Text style={styles.title}>Session #{item.id}</Text>
          </View>
          <Text style={styles.text}>Start: {new Date(item.startsAt).toLocaleString()}</Text>
          <Text style={styles.text}>End: {new Date(item.endsAt).toLocaleString()}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
          {item.status === "assigned" && (
            <Pressable
              style={[styles.cancelBtn, cancellingSlotId === item.id && styles.cancelBtnDisabled]}
              onPress={() => handleCancelBooking(item.id, item.startsAt)}
              disabled={cancellingSlotId === item.id}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Cancel this booking"
            >
              <Ionicons name="close-circle-outline" size={16} color={theme.colors.error} style={{marginRight: 6}} />
              <Text style={styles.cancelBtnText}>
                {cancellingSlotId === item.id ? "Cancelling..." : "Cancel Booking"}
              </Text>
            </Pressable>
          )}
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
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    padding: 16,
    gap: 8,
    marginBottom: 12,
    ...theme.shadows.small,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${theme.colors.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  statusText: { ...typography.caption, color: theme.colors.primary, fontWeight: '700', textTransform: 'uppercase' },
  title: { ...typography.body1, color: theme.colors.text, fontWeight: "700" },
  text: { ...typography.body2, color: theme.colors.textSecondary },
  emptyText: { ...typography.body1, color: theme.colors.textSecondary },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    ...theme.shadows.medium,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { ...typography.body2, color: "#fff", fontWeight: "700" },
  codeBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    padding: 14,
    backgroundColor: `${theme.colors.primary}10`,
    gap: 4,
  },
  codeLabel: { ...typography.caption, color: theme.colors.textSecondary },
  codeText: { ...typography.h3, color: theme.colors.primary, fontWeight: "800", letterSpacing: 2 },
  codeExpiry: { ...typography.caption, color: theme.colors.textSecondary },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.error,
    alignSelf: "flex-start",
  },
  cancelBtnDisabled: { opacity: 0.5 },
  cancelBtnText: { ...typography.caption, color: theme.colors.error, fontWeight: "700" },
});
