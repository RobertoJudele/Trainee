import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import { useRouter } from "expo-router";
import {
  ScheduleSlot,
  useAssignSlotByClientCodeMutation,
  useGenerateSlotsMutation,
  useGetTrainerSlotsQuery,
  useGetWorkingHoursQuery,
  useUpsertWorkingHourMutation,
} from "../features/schedule/scheduleApiSlice";
import { selectCurrentUser } from "../features/auth/authSlice";
import { UserRole } from "../features/auth/authApiSlice";
import { theme, typography } from "../src/lib/theme";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const startOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const statusColor = (status: ScheduleSlot["status"]) => {
  if (status === "available") return "#198754";
  if (status === "assigned") return "#0D6EFD";
  if (status === "completed") return "#6F42C1";
  if (status === "canceled") return "#DC3545";
  return "#B54708";
};

const slotShortTime = (iso: string) => {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function TrainerScheduleScreen() {
  const router = useRouter();
  const user = useSelector(selectCurrentUser);

  const [weekStartDate, setWeekStartDate] = useState<Date>(startOfWeek(new Date()));
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i)), [weekStartDate]);
  const weekFrom = useMemo(() => toDateKey(weekDays[0]), [weekDays]);
  const weekTo = useMemo(() => toDateKey(weekDays[6]), [weekDays]);

  const { data: whData, refetch: refetchWh } = useGetWorkingHoursQuery();
  const { data: slotData, isLoading: slotsLoading, refetch: refetchSlots } = useGetTrainerSlotsQuery({
    from: weekFrom,
    to: weekTo,
  });

  const [upsertWorkingHour, { isLoading: saveWhLoading }] = useUpsertWorkingHourMutation();
  const [generateSlots, { isLoading: generateLoading }] = useGenerateSlotsMutation();
  const [assignSlotByCode, { isLoading: assignByCodeLoading }] = useAssignSlotByClientCodeMutation();

  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [duration, setDuration] = useState("60");

  const [fromDate, setFromDate] = useState(weekFrom);
  const [toDate, setToDate] = useState(toDateKey(addDays(weekStartDate, 13)));

  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [clientCode, setClientCode] = useState("");
  const [assignNote, setAssignNote] = useState("");

  const workingHours = whData?.data || [];
  const slots = useMemo(
    () => [...(slotData?.data || [])].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [slotData?.data]
  );
  const availableSlots = useMemo(() => slots.filter((s) => s.status === "available"), [slots]);
  const slotsByDay = useMemo(() => {
    const grouped: Record<string, ScheduleSlot[]> = {};
    for (const slot of slots) {
      const key = toDateKey(new Date(slot.startsAt));
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(slot);
    }
    return grouped;
  }, [slots]);

  const weekLabel = `${weekDays[0].toLocaleDateString()} - ${weekDays[6].toLocaleDateString()}`;

  if (user?.role !== UserRole.TRAINER) {
    return (
      <View style={styles.deniedWrap}>
        <Text style={styles.deniedTitle}>Trainer access required</Text>
        <Text style={styles.deniedText}>This page is available only for trainer accounts.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace("/")}>
          <Text style={styles.primaryBtnText}>Go to Home</Text>
        </Pressable>
      </View>
    );
  }

  const onSaveWorkingHour = async () => {
    const parsedDay = Number(dayOfWeek);
    const parsedDuration = Number(duration);

    if (!Number.isInteger(parsedDay) || parsedDay < 0 || parsedDay > 6) {
      Alert.alert("Validation", "Day must be between 0 and 6.");
      return;
    }

    if (!Number.isFinite(parsedDuration) || parsedDuration < 15) {
      Alert.alert("Validation", "Duration should be at least 15 minutes.");
      return;
    }

    try {
      await upsertWorkingHour({
        dayOfWeek: parsedDay,
        startTime,
        endTime,
        slotDurationMin: parsedDuration,
        isActive: true,
      }).unwrap();

      Alert.alert("Saved", "Working day updated.");
      await refetchWh();
    } catch (error: any) {
      Alert.alert("Error", error?.data?.message || "Could not save working day.");
    }
  };

  const onGenerateSlots = async () => {
    try {
      await generateSlots({ fromDate, toDate }).unwrap();
      Alert.alert("Done", "Slots generated successfully.");
      await refetchSlots();
    } catch (error: any) {
      Alert.alert("Error", error?.data?.message || "Could not generate slots.");
    }
  };

  const onAssignByCode = async () => {
    if (!selectedSlotId) {
      Alert.alert("Validation", "Select an available slot first.");
      return;
    }

    if (!/^\d{6}$/.test(clientCode.trim())) {
      Alert.alert("Validation", "Client code must be 6 digits.");
      return;
    }

    try {
      await assignSlotByCode({
        slotId: selectedSlotId,
        code: clientCode.trim(),
        note: assignNote.trim() || undefined,
      }).unwrap();

      Alert.alert("Assigned", "Slot assigned based on client code.");
      setClientCode("");
      setAssignNote("");
      setSelectedSlotId(null);
      await refetchSlots();
    } catch (error: any) {
      Alert.alert("Error", error?.data?.message || "Could not assign slot by code.");
    }
  };

  const onPickWeek = (offset: number) => {
    const nextStart = addDays(weekStartDate, offset * 7);
    setWeekStartDate(startOfWeek(nextStart));
  };

  const onJumpToday = () => {
    setWeekStartDate(startOfWeek(new Date()));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Trainer Schedule</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Week Calendar</Text>
        <Text style={styles.hint}>{weekLabel}</Text>

        <View style={styles.weekNavRow}>
          <Pressable style={styles.secondaryBtn} onPress={() => onPickWeek(-1)}>
            <Text style={styles.secondaryBtnText}>Previous</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onJumpToday}>
            <Text style={styles.secondaryBtnText}>Today</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => onPickWeek(1)}>
            <Text style={styles.secondaryBtnText}>Next</Text>
          </Pressable>
        </View>

        {slotsLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.weekGrid}>
            {weekDays.map((day) => {
              const dateKey = toDateKey(day);
              const daySlots = slotsByDay[dateKey] || [];

              return (
                <View key={dateKey} style={styles.dayColumn}>
                  <Text style={styles.dayColumnTitle}>
                    {dayLabels[day.getDay()]} {day.getDate()}
                  </Text>

                  {daySlots.length === 0 ? (
                    <Text style={styles.emptyDayText}>No slots</Text>
                  ) : (
                    daySlots.map((slot) => {
                      const selected = selectedSlotId === slot.id;
                      const selectable = slot.status === "available";

                      return (
                        <Pressable
                          key={slot.id}
                          onPress={() => {
                            if (!selectable) return;
                            setSelectedSlotId(slot.id);
                          }}
                          style={[
                            styles.slotPill,
                            { borderColor: statusColor(slot.status) },
                            selected && styles.slotPillSelected,
                          ]}
                        >
                          <Text style={styles.slotPillTime}>
                            {slotShortTime(slot.startsAt)}-{slotShortTime(slot.endsAt)}
                          </Text>
                          <Text style={[styles.slotPillStatus, { color: statusColor(slot.status) }]}>
                            {slot.status}
                          </Text>
                          {slot.client ? (
                            <Text style={styles.slotPillClient}>
                              {slot.client.firstName} {slot.client.lastName}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1) Working Day Template</Text>
        <Text style={styles.hint}>Choose a day and define your reusable template.</Text>
        <View style={styles.dayRow}>
          {dayLabels.map((label, idx) => {
            const active = dayOfWeek === String(idx);
            return (
              <Pressable
                key={label}
                onPress={() => setDayOfWeek(String(idx))}
                style={[styles.dayChip, active && styles.dayChipActive]}
              >
                <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder="Start HH:mm" />
        <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} placeholder="End HH:mm" />
        <TextInput style={styles.input} value={duration} onChangeText={setDuration} placeholder="Duration min" keyboardType="number-pad" />
        <Pressable style={styles.primaryBtn} onPress={onSaveWorkingHour} disabled={saveWhLoading}>
          <Text style={styles.primaryBtnText}>{saveWhLoading ? "Saving..." : "Save Working Day"}</Text>
        </Pressable>

        <View style={styles.listWrap}>
          {workingHours.map((w) => (
            <Text key={w.id} style={styles.listItem}>
              {dayLabels[w.dayOfWeek]} {w.startTime}-{w.endTime} ({w.slotDurationMin}m)
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2) Generate Slots</Text>
        <View style={styles.inlineRow}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              setFromDate(weekFrom);
              setToDate(weekTo);
            }}
          >
            <Text style={styles.secondaryBtnText}>Use displayed week</Text>
          </Pressable>
        </View>
        <TextInput style={styles.input} value={fromDate} onChangeText={setFromDate} placeholder="from YYYY-MM-DD" />
        <TextInput style={styles.input} value={toDate} onChangeText={setToDate} placeholder="to YYYY-MM-DD" />
        <Pressable style={styles.primaryBtn} onPress={onGenerateSlots} disabled={generateLoading}>
          <Text style={styles.primaryBtnText}>{generateLoading ? "Generating..." : "Generate Slots"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3) Assign Slot by Client Code</Text>
        <Text style={styles.hint}>Client generates a 6-digit code and gives it to trainer. No client search needed.</Text>
        <TextInput
          style={styles.input}
          value={selectedSlotId ? String(selectedSlotId) : ""}
          onChangeText={(v) => setSelectedSlotId(Number(v) || null)}
          placeholder="Slot ID"
          keyboardType="number-pad"
        />
        <TextInput
          style={styles.input}
          value={clientCode}
          onChangeText={setClientCode}
          placeholder="Client code (6 digits)"
          keyboardType="number-pad"
        />
        <TextInput style={styles.input} value={assignNote} onChangeText={setAssignNote} placeholder="Optional note" />

        <Pressable style={styles.primaryBtn} onPress={onAssignByCode} disabled={assignByCodeLoading}>
          <Text style={styles.primaryBtnText}>{assignByCodeLoading ? "Assigning..." : "Assign by Code"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Available Slots (Week)</Text>
        <View style={styles.listWrap}>
          {availableSlots.map((s) => (
            <View key={s.id} style={styles.slotCard}>
              <Text style={styles.slotCardTitle}>#{s.id} • {new Date(s.startsAt).toLocaleDateString()}</Text>
              <Text style={styles.listItem}>
                {new Date(s.startsAt).toLocaleTimeString()} - {new Date(s.endsAt).toLocaleTimeString()}
              </Text>
              <Text style={styles.slotStatus}>{s.status}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Assigned / Completed Slots</Text>
        <View style={styles.listWrap}>
          {slots
            .filter((s) => s.status !== "available")
            .map((s) => (
              <View key={s.id} style={styles.slotCard}>
                <Text style={styles.slotCardTitle}>#{s.id} • {new Date(s.startsAt).toLocaleString()}</Text>
                <Text style={styles.listItem}>{s.client ? `${s.client.firstName} ${s.client.lastName}` : "No client"}</Text>
                <Text style={styles.slotStatus}>{s.status}</Text>
              </View>
            ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  deniedWrap: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  deniedTitle: { ...typography.h3, color: theme.colors.text },
  deniedText: { ...typography.body2, color: theme.colors.textSecondary, textAlign: "center" },
  title: { ...typography.h2, color: theme.colors.text },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  sectionTitle: { ...typography.body1, color: theme.colors.text, fontWeight: "700" },
  hint: { ...typography.caption, color: theme.colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: "#fff",
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  primaryBtnText: { ...typography.body2, color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  secondaryBtnText: { ...typography.caption, color: theme.colors.text, fontWeight: "700" },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  weekNavRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  weekGrid: { flexDirection: "row", gap: 10, marginTop: 10, paddingBottom: 2 },
  dayColumn: {
    width: 170,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 8,
    backgroundColor: "#fff",
    gap: 6,
  },
  dayColumnTitle: { ...typography.body2, color: theme.colors.text, fontWeight: "700" },
  emptyDayText: { ...typography.caption, color: theme.colors.textSecondary },
  slotPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: "#fff",
    gap: 1,
  },
  slotPillSelected: {
    backgroundColor: "#EEF2FF",
    borderColor: theme.colors.primary,
  },
  slotPillTime: { ...typography.caption, color: theme.colors.text, fontWeight: "700" },
  slotPillStatus: { ...typography.caption, fontWeight: "700", textTransform: "capitalize" },
  slotPillClient: { ...typography.caption, color: theme.colors.textSecondary },
  listWrap: { gap: 6, marginTop: 4 },
  listItem: { ...typography.caption, color: theme.colors.textSecondary },
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dayChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  dayChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: "#EEF2FF",
  },
  dayChipText: { ...typography.caption, color: theme.colors.textSecondary, fontWeight: "600" },
  dayChipTextActive: { color: theme.colors.primary },
  slotCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
    gap: 2,
  },
  slotCardTitle: { ...typography.body2, color: theme.colors.text, fontWeight: "700" },
  slotStatus: { ...typography.caption, color: theme.colors.primary, fontWeight: "700" },
});
