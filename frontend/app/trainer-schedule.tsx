import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  deviceTimeZone,
  useGenerateSlotsMutation,
  useGetBlockedDatesQuery,
  useGetTrainerSlotsQuery,
  useGetWorkingHoursQuery,
  useUpsertWorkingHourMutation,
} from "../features/schedule/scheduleApiSlice";
import { selectCurrentUser } from "../features/auth/authSlice";
import { UserRole } from "../features/auth/authApiSlice";
import { theme, typography } from "../src/lib/theme";
import { FadeInUp, Field, GradientButton } from "../src/components/ui";
import { DayPill, ScheduleCard, scheduleDayLabels } from "../src/components/schedule/SchedulePrimitives";
import { MonthCalendar } from "../src/components/schedule/MonthCalendar";

const pad = (n: number) => String(n).padStart(2, "0");
const monthStartKey = (year: number, month1: number) => `${year}-${pad(month1)}-01`;
const monthEndKey = (year: number, month1: number) =>
  `${year}-${pad(month1)}-${pad(new Date(year, month1, 0).getDate())}`;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function TrainerScheduleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useSelector(selectCurrentUser);

  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState<string>(
    monthStartKey(today.getFullYear(), today.getMonth() + 1)
  );

  const [vy, vm] = visibleMonth.split("-").map(Number);
  const fromKey = monthStartKey(vy, vm);
  const toKey = monthEndKey(vy, vm);

  // Working-hours template editor state.
  const [selectedDow, setSelectedDow] = useState<number>(1); // Monday
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [duration, setDuration] = useState("60");
  const [isActive, setIsActive] = useState(true);

  const isTrainer = user?.role === UserRole.TRAINER;

  const { data: slotsData } = useGetTrainerSlotsQuery(
    { from: fromKey, to: toKey },
    { skip: !isTrainer }
  );
  const { data: blockedData } = useGetBlockedDatesQuery(
    { from: fromKey, to: toKey },
    { skip: !isTrainer }
  );
  const { data: workingHoursData } = useGetWorkingHoursQuery(undefined, { skip: !isTrainer });

  const [upsertWorkingHour, { isLoading: savingTemplate }] = useUpsertWorkingHourMutation();
  const [generateSlots, { isLoading: generating }] = useGenerateSlotsMutation();

  const slots = slotsData?.data ?? [];
  const blockedDates = useMemo(() => (blockedData?.data ?? []).map((b) => b.date), [blockedData]);
  const workingHours = workingHoursData?.data ?? [];

  // Prefill the editor from the saved template whenever the selected day changes.
  useEffect(() => {
    const existing = workingHours.find((w) => w.dayOfWeek === selectedDow);
    if (existing) {
      setStartTime(existing.startTime.slice(0, 5));
      setEndTime(existing.endTime.slice(0, 5));
      setDuration(String(existing.slotDurationMin));
      setIsActive(existing.isActive);
    } else {
      setStartTime("09:00");
      setEndTime("17:00");
      setDuration("60");
      setIsActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDow, workingHoursData]);

  const onSaveTemplate = async () => {
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      Alert.alert("Invalid time", "Use HH:mm (24h) for start and end times.");
      return;
    }
    const dur = Number(duration);
    if (!Number.isFinite(dur) || dur < 5 || dur > 360) {
      Alert.alert("Invalid duration", "Slot duration must be between 5 and 360 minutes.");
      return;
    }
    if (startTime >= endTime) {
      Alert.alert("Invalid range", "End time must be after start time.");
      return;
    }
    try {
      await upsertWorkingHour({
        dayOfWeek: selectedDow,
        startTime,
        endTime,
        slotDurationMin: dur,
        isActive,
      }).unwrap();
      Alert.alert("Saved", `${scheduleDayLabels[selectedDow]} hours updated.`);
    } catch (err: any) {
      Alert.alert("Error", err?.data?.message || "Could not save the template.");
    }
  };

  const onGenerateMonth = async () => {
    try {
      const res = await generateSlots({
        fromDate: fromKey,
        toDate: toKey,
        timeZone: deviceTimeZone,
      }).unwrap();
      Alert.alert(
        "Slots generated",
        res.data.count > 0
          ? `Created ${res.data.count} new slot${res.data.count === 1 ? "" : "s"} for this month.`
          : "No new slots — this month is already filled from your template."
      );
    } catch (err: any) {
      Alert.alert("Error", err?.data?.message || "Could not generate slots.");
    }
  };

  if (!isTrainer) {
    return (
      <View style={styles.centered}>
        <View style={styles.lockIcon}>
          <Ionicons name="lock-closed-outline" size={34} color={theme.colors.primary} />
        </View>
        <Text style={styles.lockTitle}>Trainer access required</Text>
        <Text style={styles.lockText}>This planner is available to trainers.</Text>
        <GradientButton
          title="Go to Home"
          icon="home"
          onPress={() => router.replace("/")}
          style={{ marginTop: theme.spacing.md, alignSelf: "stretch" }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={theme.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: Math.max(insets.top + theme.spacing.sm, theme.spacing.xl) }]}
        >
          <Text style={styles.heroTitle}>Schedule</Text>
          <Text style={styles.heroSubtitle}>
            Set your weekly hours, generate a month, then tap any day to fine-tune it.
          </Text>
        </LinearGradient>

        <View style={styles.body}>
          <FadeInUp>
            <MonthCalendar
              month={visibleMonth}
              slots={slots}
              blockedDates={blockedDates}
              onMonthChange={(dateKey) => setVisibleMonth(dateKey)}
              onDayPress={(dateKey) => router.push(`/trainer-schedule/${dateKey}` as never)}
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger} style={styles.legendRow}>
            <Legend color={theme.colors.primary} label="Available" />
            <Legend color="#0D6EFD" label="Booked" />
            <Legend color="#94A3B8" label="Blocked" />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 2}>
            <GradientButton
              title={`Generate ${new Date(vy, vm - 1, 1).toLocaleString(undefined, { month: "long" })}`}
              icon="sparkles-outline"
              onPress={onGenerateMonth}
              loading={generating}
            />
          </FadeInUp>

          <FadeInUp delay={theme.motion.stagger * 3}>
            <ScheduleCard
              title="Working hours template"
              subtitle="Your reusable weekly availability — used when generating slots."
            >
              <View style={styles.dayPillRow}>
                {scheduleDayLabels.map((label, dow) => (
                  <DayPill
                    key={label}
                    label={label}
                    active={selectedDow === dow}
                    onPress={() => setSelectedDow(dow)}
                  />
                ))}
              </View>

              <View style={styles.timeRow}>
                <Field
                  label="Start"
                  placeholder="09:00"
                  value={startTime}
                  onChangeText={setStartTime}
                  autoCapitalize="none"
                  containerStyle={styles.timeField}
                />
                <Field
                  label="End"
                  placeholder="17:00"
                  value={endTime}
                  onChangeText={setEndTime}
                  autoCapitalize="none"
                  containerStyle={styles.timeField}
                />
                <Field
                  label="Mins"
                  placeholder="60"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="number-pad"
                  containerStyle={styles.durationField}
                />
              </View>

              <View style={styles.activeRow}>
                <Text style={styles.activeLabel}>Active on {scheduleDayLabels[selectedDow]}</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ true: theme.colors.primary, false: "#CBD5E1" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <GradientButton
                title={`Save ${scheduleDayLabels[selectedDow]} hours`}
                icon="save-outline"
                onPress={onSaveTemplate}
                loading={savingTemplate}
              />

              {workingHours.length > 0 && (
                <View style={styles.summaryWrap}>
                  {[...workingHours]
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                    .map((w) => (
                      <View key={w.id} style={styles.summaryRow}>
                        <Text style={styles.summaryDay}>{scheduleDayLabels[w.dayOfWeek]}</Text>
                        <Text style={[styles.summaryHours, !w.isActive && styles.summaryInactive]}>
                          {w.isActive
                            ? `${w.startTime.slice(0, 5)}–${w.endTime.slice(0, 5)} · ${w.slotDurationMin}m`
                            : "Off"}
                        </Text>
                      </View>
                    ))}
                </View>
              )}
            </ScheduleCard>
          </FadeInUp>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: theme.spacing.xxl },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background, padding: theme.spacing.lg },
  lockIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  lockTitle: { ...typography.h3, color: theme.colors.text },
  lockText: { ...typography.body2, color: theme.colors.textSecondary, textAlign: "center" },

  hero: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...theme.shadows.medium,
  },
  heroTitle: { ...typography.h1, color: "#FFFFFF" },
  heroSubtitle: { ...typography.body2, color: "rgba(255,255,255,0.9)", marginTop: 4 },

  body: { padding: theme.spacing.lg, gap: theme.spacing.md },

  legendRow: { flexDirection: "row", justifyContent: "center", gap: theme.spacing.lg },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...typography.caption, color: theme.colors.textSecondary, textTransform: "none" },

  dayPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  timeRow: { flexDirection: "row", gap: theme.spacing.sm },
  timeField: { flex: 1 },
  durationField: { width: 84 },
  activeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  activeLabel: { ...typography.body2, color: theme.colors.text, fontWeight: "600" },

  summaryWrap: {
    marginTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    gap: 4,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryDay: { ...typography.body2, color: theme.colors.text, fontWeight: "600" },
  summaryHours: { ...typography.body2, color: theme.colors.textSecondary },
  summaryInactive: { fontStyle: "italic" },
});
