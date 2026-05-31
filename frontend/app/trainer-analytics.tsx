import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "../features/auth/authSlice";
import { UserRole } from "../features/auth/authApiSlice";
import {
  TrainerAnalyticsBreakdown,
  useGetTrainerAnalyticsQuery,
} from "../features/trainer/trainerApiSlice";
import { theme, typography } from "../src/lib/theme";

const sourceLabels: Record<keyof TrainerAnalyticsBreakdown, string> = {
  search: "Search",
  map: "Map",
  direct: "Direct",
  other: "Other",
};

const ageLabels = [
  ["under_18", "Under 18"],
  ["18_24", "18-24"],
  ["25_34", "25-34"],
  ["35_44", "35-44"],
  ["45_54", "45-54"],
  ["55_plus", "55+"],
  ["unknown", "Unknown"],
] as const;

const sexLabels = [
  ["male", "Male"],
  ["female", "Female"],
  ["non_binary", "Non-binary"],
  ["other", "Other"],
  ["prefer_not_to_say", "Prefer not to say"],
  ["unknown", "Unknown"],
] as const;

const formatPercent = (value: number, total: number) => {
  if (!total) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
};

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </View>
  );
}

function BreakdownRow({
  label,
  value,
  total,
  accent,
}: {
  label: string;
  value: number;
  total: number;
  accent?: string;
}) {
  const ratio = total > 0 ? value / total : 0;

  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownLabelRow}>
        <View style={[styles.dot, { backgroundColor: accent ?? theme.colors.primary }]} />
        <Text style={styles.breakdownLabel}>{label}</Text>
      </View>
      <Text style={styles.breakdownValue}>
        {value} · {formatPercent(value, total)}
      </Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.max(ratio * 100, value > 0 ? 8 : 0)}%`,
              backgroundColor: accent ?? theme.colors.primary,
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function TrainerAnalyticsScreen() {
  const router = useRouter();
  const user = useSelector(selectCurrentUser);

  const { data, isLoading, isFetching, isError, refetch } = useGetTrainerAnalyticsQuery(undefined, {
    skip: user?.role !== UserRole.TRAINER,
  });

  if (user?.role !== UserRole.TRAINER) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Trainer analytics is available only for trainer accounts.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading || isFetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load trainer analytics.</Text>
        <Pressable style={styles.primaryButton} onPress={() => refetch()}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const totalSourceViews = Object.values(data.sourceBreakdown).reduce((sum, value) => sum + value, 0);
  const totalAgeViews = Object.values(data.ageBreakdown).reduce((sum, value) => sum + value, 0);
  const totalSexViews = Object.values(data.sexBreakdown).reduce((sum, value) => sum + value, 0);
  const maxDayCount = Math.max(...data.viewsByDay.map((item) => item.count), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIcon}>
            <Ionicons name="analytics" size={24} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Trainer Analytics</Text>
            <Text style={styles.heroSubtitle}>
              Profile views, discovery sources, and audience demographics.
            </Text>
          </View>
        </View>

        <View style={styles.heroMetrics}>
          <MetricCard label="Total views" value={data.totalViews} hint="Deduplicated views" />
          <MetricCard label="Unique events" value={data.uniqueViewEvents} hint="Counted sessions" />
          <MetricCard label="Tracked days" value={data.viewsByDay.length} hint="Last 7 days" />
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="trending-up-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>View Trends</Text>
        </View>
        <View style={styles.trendRow}>
          {data.viewsByDay.map((item) => {
            const height = Math.max((item.count / maxDayCount) * 120, item.count > 0 ? 16 : 6);
            return (
              <View key={item.date} style={styles.trendBarColumn}>
                <View style={[styles.trendBar, { height }]}>
                  <Text style={styles.trendBarValue}>{item.count}</Text>
                </View>
                <Text style={styles.trendLabel}>{item.label.slice(5)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="locate-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Source Breakdown</Text>
        </View>
        <View style={styles.breakdownStack}>
          {(Object.keys(data.sourceBreakdown) as Array<keyof TrainerAnalyticsBreakdown>).map((key) => (
            <BreakdownRow
              key={key}
              label={sourceLabels[key]}
              value={data.sourceBreakdown[key]}
              total={totalSourceViews}
              accent={key === "search" ? "#10B981" : key === "map" ? "#0EA5E9" : key === "direct" ? "#6366F1" : "#F59E0B"}
            />
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Audience Age</Text>
        </View>
        <View style={styles.breakdownStack}>
          {ageLabels.map(([key, label]) => (
            <BreakdownRow key={key} label={label} value={data.ageBreakdown[key]} total={totalAgeViews} />
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Audience Sex</Text>
        </View>
        <View style={styles.breakdownStack}>
          {sexLabels.map(([key, label]) => (
            <BreakdownRow key={key} label={label} value={data.sexBreakdown[key]} total={totalSexViews} />
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Recent Views</Text>
        </View>
        {data.recentViews.length > 0 ? (
          data.recentViews.slice(0, 8).map((view) => (
            <View key={view.id} style={styles.recentRow}>
              <View style={styles.recentMeta}>
                <Text style={styles.recentTitle}>{sourceLabels[view.sourceType]}</Text>
                <Text style={styles.recentSubtitle}>
                  {view.age !== null ? `${view.age} years` : "Age unknown"} · {view.sex.replace(/_/g, " ")}
                </Text>
              </View>
              <Text style={styles.recentTime}>{new Date(view.viewedAt).toLocaleDateString()}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No tracked views yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: 14,
    paddingBottom: 36,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    gap: 12,
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
  errorText: {
    ...typography.body1,
    color: theme.colors.text,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: 16,
    ...theme.shadows.small,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF5",
  },
  heroTitle: {
    ...typography.h3,
    color: theme.colors.text,
  },
  heroSubtitle: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  heroMetrics: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  metricLabel: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  metricValue: {
    ...typography.h2,
    color: theme.colors.text,
  },
  metricHint: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: 12,
    ...theme.shadows.small,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    ...typography.h3,
    color: theme.colors.text,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 150,
  },
  trendBarColumn: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  trendBar: {
    width: "100%",
    minHeight: 16,
    borderRadius: 14,
    backgroundColor: "#10B981",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 6,
  },
  trendBarValue: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  trendLabel: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  breakdownStack: {
    gap: 10,
  },
  breakdownRow: {
    gap: 6,
  },
  breakdownLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  breakdownLabel: {
    ...typography.body2,
    color: theme.colors.text,
    flex: 1,
  },
  breakdownValue: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 10,
  },
  recentMeta: {
    flex: 1,
  },
  recentTitle: {
    ...typography.body2,
    color: theme.colors.text,
    fontWeight: "700",
  },
  recentSubtitle: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textTransform: "none",
  },
  recentTime: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  emptyText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
});
