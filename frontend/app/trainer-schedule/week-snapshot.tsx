import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { UserRole } from "../../features/auth/authApiSlice";
import { selectCurrentUser } from "../../features/auth/authSlice";
import { ScheduleSlot, useGetTrainerSlotsQuery } from "../../features/schedule/scheduleApiSlice";
import { theme, typography } from "../../src/lib/theme";
import {
  OutlineButton,
  ScheduleCard,
  StatusBadge,
  addDays,
  formatWeekLabel,
  scheduleDayLabels,
  shortTime,
  startOfWeek,
  toDateKey,
} from "../../src/components/schedule/SchedulePrimitives";

const isValidDateKey = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isFinite(parsed.getTime());
};

const fromDateKey = (value: string) => new Date(`${value}T00:00:00`);

export default function TrainerWeekSnapshotScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  const user = useSelector(selectCurrentUser);

  const initialWeekDate =
    typeof params.from === "string" && isValidDateKey(params.from)
      ? fromDateKey(params.from)
      : new Date();

  const [weekStartDate, setWeekStartDate] = useState<Date>(startOfWeek(initialWeekDate));

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index)), [weekStartDate]);
  const weekFrom = useMemo(() => toDateKey(weekDays[0]), [weekDays]);
  const weekTo = useMemo(() => toDateKey(weekDays[6]), [weekDays]);

  const { data: slotData, isLoading: slotsLoading } = useGetTrainerSlotsQuery({
    from: weekFrom,
    to: weekTo,
  });

  const slots = useMemo(
    () => [...(slotData?.data || [])].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [slotData?.data]
  );

  const slotsByDay = useMemo(() => {
    const grouped: Record<string, ScheduleSlot[]> = {};
    for (const slot of slots) {
      const dayKey = toDateKey(new Date(slot.startsAt));
      if (!grouped[dayKey]) grouped[dayKey] = [];
      grouped[dayKey].push(slot);
    }
    return grouped;
  }, [slots]);

  const countByStatus = useMemo(() => {
    return slots.reduce(
      (acc, slot) => {
        acc[slot.status] += 1;
        return acc;
      },
      {
        available: 0,
        assigned: 0,
        completed: 0,
        canceled: 0,
        no_show: 0,
      }
    );
  }, [slots]);

  const weekLabel = formatWeekLabel(weekDays);

  if (user?.role !== UserRole.TRAINER) {
    return (
      <View style={styles.deniedWrap}>
        <Text style={styles.deniedTitle}>Trainer access required</Text>
        <Text style={styles.deniedText}>This page is available only for trainer accounts.</Text>
        <OutlineButton label="Go to Home" onPress={() => router.replace("/")} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <OutlineButton label="Back" onPress={() => router.back()} />
          <View style={styles.heroTitleWrap}>
            <Text style={styles.heroEyebrow}>Week Overview</Text>
            <Text style={styles.heroTitle}>Week Snapshot</Text>
            <Text style={styles.weekLabel}>{weekLabel}</Text>
          </View>
        </View>

        <View style={styles.weekNavRow}>
          <OutlineButton label="Prev" onPress={() => setWeekStartDate(startOfWeek(addDays(weekStartDate, -7)))} />
          <OutlineButton label="Today" onPress={() => setWeekStartDate(startOfWeek(new Date()))} />
          <OutlineButton label="Next" onPress={() => setWeekStartDate(startOfWeek(addDays(weekStartDate, 7)))} />
        </View>
      </View>

      <ScheduleCard title="Status Summary" subtitle="All slots in the displayed week.">
        <View style={styles.metricGrid}>
          <View style={styles.metricChip}>
            <Text style={styles.metricLabel}>Available</Text>
            <Text style={styles.metricValue}>{countByStatus.available}</Text>
          </View>
          <View style={styles.metricChip}>
            <Text style={styles.metricLabel}>Assigned</Text>
            <Text style={styles.metricValue}>{countByStatus.assigned}</Text>
          </View>
          <View style={styles.metricChip}>
            <Text style={styles.metricLabel}>Completed</Text>
            <Text style={styles.metricValue}>{countByStatus.completed}</Text>
          </View>
          <View style={styles.metricChip}>
            <Text style={styles.metricLabel}>Canceled + No Show</Text>
            <Text style={styles.metricValue}>{countByStatus.canceled + countByStatus.no_show}</Text>
          </View>
        </View>
      </ScheduleCard>

      {slotsLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {weekDays.map((day) => {
        const dayKey = toDateKey(day);
        const daySlots = slotsByDay[dayKey] || [];

        return (
          <ScheduleCard
            key={dayKey}
            title={`${scheduleDayLabels[day.getDay()]} ${day.getDate()}`}
            subtitle={daySlots.length === 0 ? "No slots" : `${daySlots.length} slots`}
          >
            {daySlots.length === 0 ? (
              <Text style={styles.emptyText}>No slots created for this day.</Text>
            ) : (
              daySlots.map((slot) => (
                <View key={slot.id} style={styles.slotRow}>
                  <View style={styles.slotTimeWrap}>
                    <Text style={styles.slotTimeText}>
                      {shortTime(slot.startsAt)} - {shortTime(slot.endsAt)}
                    </Text>
                    {slot.client ? (
                      <Text style={styles.slotClientText}>
                        {slot.client.firstName} {slot.client.lastName}
                      </Text>
                    ) : (
                      <Text style={styles.slotClientPlaceholder}>No client assigned</Text>
                    )}
                  </View>
                  <StatusBadge status={slot.status} />
                </View>
              ))
            )}
          </ScheduleCard>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EEF3F8",
  },
  content: {
    padding: 14,
    gap: 12,
    paddingBottom: 24,
  },
  deniedWrap: {
    flex: 1,
    backgroundColor: "#EEF3F8",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  deniedTitle: {
    ...typography.h3,
    color: theme.colors.text,
  },
  deniedText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D6DEE9",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 10,
    ...theme.shadows.small,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroTitleWrap: {
    flex: 1,
    gap: 2,
  },
  heroEyebrow: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  heroTitle: {
    ...typography.h2,
    color: theme.colors.text,
    fontWeight: "800",
  },
  weekLabel: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
  weekNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricChip: {
    minWidth: "47%",
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DBE3EF",
    backgroundColor: "#F7FAFE",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  metricLabel: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  metricValue: {
    ...typography.h3,
    color: theme.colors.text,
    fontWeight: "800",
  },
  loadingWrap: {
    paddingVertical: 10,
    alignItems: "center",
  },
  slotRow: {
    borderWidth: 1,
    borderColor: "#DDE6F0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  slotTimeWrap: {
    flex: 1,
    gap: 2,
  },
  slotTimeText: {
    ...typography.body2,
    color: theme.colors.text,
    fontWeight: "700",
  },
  slotClientText: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  slotClientPlaceholder: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  emptyText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
});
