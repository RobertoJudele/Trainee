import React, { useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { theme, typography } from "../../lib/theme";

export const scheduleDayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ScheduleStatus = "available" | "assigned" | "completed" | "canceled" | "no_show";

export const scheduleStatusColor = (status: ScheduleStatus) => {
  if (status === "available") return "#198754";
  if (status === "assigned") return "#0D6EFD";
  if (status === "completed") return "#6F42C1";
  if (status === "canceled") return "#DC3545";
  return "#B54708";
};

export const scheduleStatusBackground = (status: ScheduleStatus) => {
  const color = scheduleStatusColor(status);
  return `${color}18`;
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const startOfWeek = (date: Date) => {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const shortTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatWeekLabel = (weekDays: Date[]) => {
  if (weekDays.length === 0) return "";
  return `${weekDays[0].toLocaleDateString()} - ${weekDays[weekDays.length - 1].toLocaleDateString()}`;
};

type ScheduleCardProps = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
  pinScrollRef?: React.RefObject<ScrollView | null>;
};

export function ScheduleCard({
  title,
  subtitle,
  rightSlot,
  children,
  style,
  contentStyle,
  collapsible,
  defaultCollapsed = true,
  onToggle,
  pinScrollRef,
}: ScheduleCardProps) {
  const [collapsed, setCollapsed] = useState(collapsible ? defaultCollapsed : false);
  const anim = useRef(new Animated.Value(defaultCollapsed ? 0 : 1)).current;
  // State (not ref) so a new measurement re-renders the maxHeight interpolation.
  // ponytail: keep the tallest height ever seen — a clamped mid-animation onLayout
  // pass must not shrink it and clip the content. Trades a little extra bottom
  // padding if the content genuinely shrinks; revisit only if that shows.
  const [contentHeight, setContentHeight] = useState(0);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    // Expand: pin the bottom on every frame so the reveal and the scroll move together
    // instead of scroll-after-open. As maxHeight grows, scrollToEnd tracks the growing
    // content. Collapse needs no scroll — the height shrinks smoothly without clamping.
    let scrollSub: string | undefined;
    if (pinScrollRef && !next) {
      scrollSub = anim.addListener(() => pinScrollRef.current?.scrollToEnd({ animated: false }));
    }
    Animated.timing(anim, {
      toValue: next ? 0 : 1,
      duration: 550,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      if (scrollSub) anim.removeListener(scrollSub);
    });
    onToggle?.(next);
  };

  if (!collapsible) {
    return (
      <View style={[styles.card, style]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderTextWrap}>
            <Text style={styles.cardTitle}>{title}</Text>
            {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
          </View>
          {rightSlot}
        </View>
        <View style={[styles.cardContent, contentStyle]}>{children}</View>
      </View>
    );
  }

  // ponytail: maxHeight animation is JS-driven (layout props can't use the native
  // driver); fine for one card, revisit if many animate at once.
  const maxHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight || 2000],
  });

  return (
    // gap:0 — the card gap would reserve space below the header even when the body is
    // collapsed to height 0; the body carries its own top padding inside the clip instead.
    <View style={[styles.card, { gap: 0 }, style]}>
      <Pressable onPress={toggle}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Ionicons name={collapsed ? "chevron-down" : "chevron-up"} size={20} color={theme.colors.textSecondary} />
        </View>
      </Pressable>
      <Animated.View style={{ maxHeight, overflow: "hidden", opacity: anim }}>
        <View
          style={styles.collapsibleBody}
          onLayout={(e) => {
            const h = Math.ceil(e.nativeEvent.layout.height);
            setContentHeight((prev) => (h > prev ? h : prev));
          }}
        >
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
          <View style={[styles.cardContent, contentStyle]}>{children}</View>
        </View>
      </Animated.View>
    </View>
  );
}

type OutlineButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function OutlineButton({ label, onPress, disabled }: OutlineButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.outlineBtn, pressed && styles.outlineBtnPressed, disabled && styles.btnDisabled]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.outlineBtnText}>{label}</Text>
    </Pressable>
  );
}

type GradientActionButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function GradientActionButton({ label, onPress, disabled }: GradientActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.gradientBtnWrap, pressed && styles.gradientPressed, disabled && styles.btnDisabled]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <LinearGradient
        colors={[theme.colors.secondary, theme.colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBtn}
      >
        <Text style={styles.gradientBtnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

type DayPillProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

export function DayPill({ label, active, onPress }: DayPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dayPill, active && styles.dayPillActive, pressed && styles.dayPillPressed]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{label}</Text>
    </Pressable>
  );
}

type StatusBadgeProps = {
  status: ScheduleStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <View style={[styles.statusBadge, { backgroundColor: scheduleStatusBackground(status) }]}>
      <Text style={[styles.statusText, { color: scheduleStatusColor(status) }]}>{status}</Text>
    </View>
  );
}

type BottomSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function BottomSheet({ visible, title, subtitle, onClose, children, footer }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheetRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={onClose}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
        />
        <View style={styles.sheetPanel}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleWrap}>
            <Text style={styles.sheetTitle}>{title}</Text>
            {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.sheetBody}>{children}</View>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DEE5EE",
    padding: 14,
    gap: 10,
    ...theme.shadows.small,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardHeaderTextWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    ...typography.body1,
    color: theme.colors.text,
    fontWeight: "700",
  },
  cardSubtitle: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  cardContent: {
    gap: 8,
  },
  collapsibleBody: {
    paddingTop: 10,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: "#CED7E3",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  outlineBtnPressed: {
    opacity: 0.82,
  },
  outlineBtnText: {
    ...typography.body2,
    color: theme.colors.text,
    fontWeight: "700",
    lineHeight: 18,
  },
  gradientBtnWrap: {
    borderRadius: 12,
    overflow: "hidden",
  },
  gradientBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  gradientBtnText: {
    ...typography.body2,
    color: "#FFFFFF",
    fontWeight: "700",
    lineHeight: 18,
  },
  gradientPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  dayPill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#D8E1EC",
    backgroundColor: "#FFFFFF",
  },
  dayPillActive: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}18`,
  },
  dayPillPressed: {
    opacity: 0.82,
  },
  dayPillText: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
    fontWeight: "700",
  },
  dayPillTextActive: {
    color: theme.colors.primary,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    ...typography.caption,
    textTransform: "capitalize",
    fontWeight: "700",
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetPanel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 12,
    maxHeight: "84%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D4DCE7",
  },
  sheetTitleWrap: {
    gap: 4,
  },
  sheetTitle: {
    ...typography.h3,
    color: theme.colors.text,
    fontWeight: "700",
  },
  sheetSubtitle: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
  sheetBody: {
    gap: 10,
  },
  sheetFooter: {
    paddingTop: 4,
  },
});
