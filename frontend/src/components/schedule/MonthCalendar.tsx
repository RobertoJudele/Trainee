import React, { useMemo } from "react";
import { Calendar, DateData } from "react-native-calendars";
import { theme } from "../../lib/theme";
import { ScheduleSlot } from "../../../features/schedule/scheduleApiSlice";
import { toDateKey } from "./SchedulePrimitives";

const AVAILABLE_COLOR = theme.colors.primary; // emerald
const BOOKED_COLOR = "#0D6EFD"; // blue
const BLOCKED_COLOR = "#94A3B8"; // slate

type MarkedDates = Record<
  string,
  {
    dots?: { key: string; color: string }[];
    selected?: boolean;
    selectedColor?: string;
    marked?: boolean;
  }
>;

type Props = {
  /** Any date inside the visible month (YYYY-MM-DD). */
  month: string;
  slots: ScheduleSlot[];
  blockedDates: string[];
  selectedDate?: string;
  onDayPress: (dateKey: string) => void;
  onMonthChange: (dateKey: string) => void;
};

export function MonthCalendar({
  month,
  slots,
  blockedDates,
  selectedDate,
  onDayPress,
  onMonthChange,
}: Props) {
  const markedDates = useMemo<MarkedDates>(() => {
    const marks: MarkedDates = {};

    // Group slots by calendar day and classify.
    const perDay = new Map<string, { available: number; booked: number }>();
    for (const slot of slots) {
      const key = toDateKey(new Date(slot.startsAt));
      const entry = perDay.get(key) ?? { available: 0, booked: 0 };
      if (slot.status === "available") {
        entry.available += 1;
      } else if (slot.status === "assigned" || slot.status === "completed") {
        entry.booked += 1;
      }
      perDay.set(key, entry);
    }

    for (const [key, { available, booked }] of perDay) {
      const dots: { key: string; color: string }[] = [];
      if (available > 0) dots.push({ key: "available", color: AVAILABLE_COLOR });
      if (booked > 0) dots.push({ key: "booked", color: BOOKED_COLOR });
      if (dots.length) marks[key] = { dots };
    }

    // Blocked days override with a single grey dot.
    for (const key of blockedDates) {
      marks[key] = { dots: [{ key: "blocked", color: BLOCKED_COLOR }] };
    }

    if (selectedDate) {
      marks[selectedDate] = {
        ...(marks[selectedDate] ?? {}),
        selected: true,
        selectedColor: theme.colors.primary,
      };
    }

    return marks;
  }, [slots, blockedDates, selectedDate]);

  return (
    <Calendar
      current={month}
      onDayPress={(day: DateData) => onDayPress(day.dateString)}
      onMonthChange={(m: DateData) => onMonthChange(m.dateString)}
      markedDates={markedDates}
      markingType="multi-dot"
      enableSwipeMonths
      firstDay={1}
      theme={{
        backgroundColor: theme.colors.surface,
        calendarBackground: theme.colors.surface,
        textSectionTitleColor: theme.colors.textSecondary,
        todayTextColor: theme.colors.primary,
        dayTextColor: theme.colors.text,
        textDisabledColor: "#CBD5E1",
        monthTextColor: theme.colors.text,
        arrowColor: theme.colors.primary,
        selectedDayBackgroundColor: theme.colors.primary,
        selectedDayTextColor: "#FFFFFF",
        textMonthFontWeight: "700",
        textDayFontWeight: "500",
      }}
      style={{
        borderRadius: theme.roundness,
        paddingBottom: theme.spacing.sm,
        ...theme.shadows.small,
      }}
    />
  );
}
