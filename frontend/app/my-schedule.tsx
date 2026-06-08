import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { useGenerateMyCheckInCodeMutation, useGetMyScheduleQuery, useUnassignClientFromSlotMutation } from "../features/schedule/scheduleApiSlice";
import { useSelector } from "react-redux";
import { useRouter } from "expo-router";
import { selectCurrentUser } from "../features/auth/authSlice";
import { UserRole } from "../features/auth/authApiSlice";
import { theme, typography } from "../src/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { FadeInUp, GradientButton, PressableScale } from "../src/components/ui";

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
        <FadeInUp style={styles.centeredInner}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="lock-closed-outline" size={36} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>Client access required</Text>
          <Text style={styles.emptyText}>This page shows sessions assigned to clients.</Text>
          <GradientButton
            title="Go to Home"
            icon="home"
            onPress={() => router.replace("/")}
            style={{ marginTop: theme.spacing.md, alignSelf: "stretch" }}
          />
        </FadeInUp>
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
        <FadeInUp style={styles.centeredInner}>
          <View style={[styles.emptyIconWrap, { backgroundColor: `${theme.colors.error}15` }]}>
            <Ionicons name="cloud-offline-outline" size={36} color={theme.colors.error} />
          </View>
          <Text style={styles.emptyText}>Could not load your schedule.</Text>
          <GradientButton title="Try Again" icon="refresh" onPress={refetch} style={{ marginTop: theme.spacing.md }} />
        </FadeInUp>
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
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <FadeInUp style={styles.codeCard}>
          <View style={styles.codeCardHeader}>
            <View style={styles.codeIconWrap}>
              <Ionicons name="qr-code-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Generate Client Code</Text>
              <Text style={styles.text}>Share a short-lived code directly with your trainer.</Text>
            </View>
          </View>
          <GradientButton
            title={isGeneratingCode ? "Generating..." : "Generate Check-in Code"}
            icon="key-outline"
            onPress={onGenerateCode}
            loading={isGeneratingCode}
            style={{ marginTop: theme.spacing.md }}
          />
          {generatedCode && (
            <FadeInUp style={styles.codeBox}>
              <Text style={styles.codeLabel}>Give this code to your trainer</Text>
              <Text style={styles.codeText}>{generatedCode.code}</Text>
              <Text style={styles.codeExpiry}>Expires: {new Date(generatedCode.expiresAt).toLocaleString()}</Text>
            </FadeInUp>
          )}
        </FadeInUp>
      }
      ListEmptyComponent={
        <FadeInUp delay={theme.motion.stagger} style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="calendar-outline" size={36} color={theme.colors.primary} />
          </View>
          <Text style={styles.emptyText}>No upcoming sessions yet.</Text>
          <Text style={styles.text}>You can still generate a code above.</Text>
        </FadeInUp>
      }
      renderItem={({ item, index }) => {
        const status = String(item.status).toLowerCase();
        const statusColor =
          status === "completed"
            ? theme.colors.secondary
            : status === "cancelled"
              ? theme.colors.error
              : theme.colors.primary;
        return (
          <FadeInUp delay={index * theme.motion.stagger}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.sessionIconWrap}>
                  <Ionicons name="calendar" size={16} color={theme.colors.primary} />
                </View>
                <Text style={styles.title}>Session #{item.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                </View>
              </View>
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={15} color={theme.colors.textSecondary} />
                <Text style={styles.text}>{new Date(item.startsAt).toLocaleString()}</Text>
              </View>
              <View style={styles.timeRow}>
                <Ionicons name="flag-outline" size={15} color={theme.colors.textSecondary} />
                <Text style={styles.text}>{new Date(item.endsAt).toLocaleString()}</Text>
              </View>
              {item.status === "assigned" && (
                <PressableScale
                  style={[styles.cancelBtn, cancellingSlotId === item.id && styles.cancelBtnDisabled]}
                  onPress={() => handleCancelBooking(item.id, item.startsAt)}
                  disabled={cancellingSlotId === item.id}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel this booking"
                >
                  <Ionicons name="close-circle-outline" size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
                  <Text style={styles.cancelBtnText}>
                    {cancellingSlotId === item.id ? "Cancelling..." : "Cancel Booking"}
                  </Text>
                </PressableScale>
              )}
            </View>
          </FadeInUp>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background, padding: theme.spacing.lg },
  centeredInner: { alignItems: "center", alignSelf: "stretch", gap: theme.spacing.xs },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  emptyState: { alignItems: "center", paddingVertical: theme.spacing.xl, gap: 2 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: theme.spacing.md,
    gap: 6,
    marginBottom: theme.spacing.md,
    ...theme.shadows.small,
  },
  codeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
  },
  codeCardHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  codeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.small,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginBottom: 2 },
  sessionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusBadge: {
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: { ...typography.caption, fontWeight: '700', textTransform: 'uppercase' },
  title: { ...typography.body1, color: theme.colors.text, fontWeight: "700" },
  text: { ...typography.body2, color: theme.colors.textSecondary },
  emptyText: { ...typography.h3, color: theme.colors.text, textAlign: "center" },
  codeBox: {
    marginTop: theme.spacing.md,
    borderRadius: theme.roundness,
    padding: theme.spacing.md,
    backgroundColor: `${theme.colors.primary}10`,
    alignItems: "center",
    gap: 4,
  },
  codeLabel: { ...typography.caption, color: theme.colors.textSecondary, textTransform: "none" },
  codeText: { ...typography.h1, color: theme.colors.primary, fontWeight: "800", letterSpacing: 6 },
  codeExpiry: { ...typography.caption, color: theme.colors.textSecondary, textTransform: "none" },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.roundness,
    borderWidth: 1.5,
    borderColor: theme.colors.error,
    alignSelf: "flex-start",
  },
  cancelBtnDisabled: { opacity: 0.5 },
  cancelBtnText: { ...typography.caption, color: theme.colors.error, fontWeight: "700", textTransform: "none" },
});
