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
  TrainerAnalyticsChannels,
  TrainerAnalyticsSources,
  useGetTrainerAnalyticsQuery,
} from "../features/trainer/trainerApiSlice";
import { theme, typography, presets } from "../src/lib/theme";
import { useLanguage } from "../src/lib/i18n/LanguageContext";
import { fonts } from "../src/lib/fonts";

// The screen answers one question: does the profile turn views into messages?
// Views, contacts and the rate between them lead; the 7-day chart and the two
// breakdowns explain the numbers.

const VIEWS_COLOR = "#CBD5E1"; // Slate 300: the bar's background share
const CONTACTS_COLOR = theme.colors.primary;

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </View>
  );
}

function BreakdownRow({ label, value, total }: { label: string; value: number; total: number }) {
  const ratio = total > 0 ? value / total : 0;
  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownLabelRow}>
        <Text style={styles.breakdownLabel}>{label}</Text>
        <Text style={styles.breakdownValue}>
          {value} · {percent(value, total)}%
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${Math.max(ratio * 100, value > 0 ? 6 : 0)}%` }]}
        />
      </View>
    </View>
  );
}

function SectionHeader({ icon, title, note }: { icon: keyof typeof Ionicons.glyphMap; title: string; note?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
    </View>
  );
}

export default function TrainerAnalyticsScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const user = useSelector(selectCurrentUser);
  const locale = language === "ro" ? "ro-RO" : "en-US";

  const { data, isLoading, isError, refetch } = useGetTrainerAnalyticsQuery(undefined, {
    skip: user?.role !== UserRole.TRAINER,
  });

  if (user?.role !== UserRole.TRAINER) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t("analyticsTrainerOnly")}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("goBack")}
        >
          <Text style={styles.primaryButtonText}>{t("goBack")}</Text>
        </Pressable>
      </View>
    );
  }

  // isLoading only: a refetch keeps the cached data, so there is no reason to replace
  // the whole screen with a spinner once something is already on it.
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t("loadingAnalytics")}</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t("couldNotLoadAnalytics")}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel={t("tryAgain")}
        >
          <Text style={styles.primaryButtonText}>{t("tryAgain")}</Text>
        </Pressable>
      </View>
    );
  }

  const { thisWeek, lastWeek } = data;
  const delta = (now: number, before: number) => {
    const diff = now - before;
    if (diff === 0) return t("sameAsLastWeek");
    return t("vsLastWeek").replace("%s", diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`);
  };

  const sourceLabels: Record<keyof TrainerAnalyticsSources, string> = {
    search: t("sourceSearch"),
    map: t("sourceMap"),
    direct: t("sourceDirect"),
    other: t("sourceOther"),
  };
  const channelLabels: Record<keyof TrainerAnalyticsChannels, string> = {
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    facebook: "Facebook",
  };
  const totalSources = Object.values(data.sources).reduce((sum, v) => sum + v, 0);
  const totalChannels = Object.values(data.channels).reduce((sum, v) => sum + v, 0);
  const maxDayViews = Math.max(...data.days.map((d) => Math.max(d.views, d.contacts)), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{t("analyticsTitle")}</Text>
        <Text style={styles.heroSubtitle}>{t("analyticsDescription")}</Text>

        <Text style={styles.periodLabel}>{t("thisWeek").toUpperCase()}</Text>
        <View style={styles.heroMetrics}>
          <MetricCard
            label={t("analyticsViews")}
            value={thisWeek.views}
            hint={delta(thisWeek.views, lastWeek.views)}
          />
          <MetricCard
            label={t("contactsLabel")}
            value={thisWeek.contacts}
            hint={delta(thisWeek.contacts, lastWeek.contacts)}
          />
        </View>
        <View style={styles.rateRow}>
          <Text style={styles.rateValue}>{percent(thisWeek.contacts, thisWeek.views)}%</Text>
          <Text style={styles.rateHint}>{t("contactRateHint")}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <SectionHeader icon="calendar-outline" title={t("last7Days")} />
        <View style={styles.trendRow}>
          {data.days.map((day) => {
            const viewsHeight = Math.max((day.views / maxDayViews) * 110, day.views > 0 ? 10 : 4);
            const contactsHeight =
              day.contacts > 0 ? Math.max((day.contacts / maxDayViews) * 110, 10) : 0;
            const weekday = new Date(`${day.date}T12:00:00Z`).toLocaleDateString(locale, {
              weekday: "short",
            });
            return (
              <View
                key={day.date}
                style={styles.trendColumn}
                accessible
                accessibilityLabel={`${weekday}: ${day.views} ${t("legendViews")}, ${day.contacts} ${t("legendContacts")}`}
              >
                <Text style={styles.trendValue}>{day.views}</Text>
                <View style={[styles.trendBar, { height: viewsHeight }]}>
                  {contactsHeight > 0 ? (
                    <View style={[styles.trendContacts, { height: Math.min(contactsHeight, viewsHeight) }]} />
                  ) : null}
                </View>
                <Text style={styles.trendLabel}>{weekday}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: VIEWS_COLOR }]} />
            <Text style={styles.legendText}>{t("legendViews")}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: CONTACTS_COLOR }]} />
            <Text style={styles.legendText}>{t("legendContacts")}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <SectionHeader icon="locate-outline" title={t("whereViewersCome")} note={t("last30Days")} />
        <View style={styles.breakdownStack}>
          {(Object.keys(data.sources) as Array<keyof TrainerAnalyticsSources>).map((key) => (
            <BreakdownRow key={key} label={sourceLabels[key]} value={data.sources[key]} total={totalSources} />
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <SectionHeader icon="chatbubble-ellipses-outline" title={t("howTheyWrite")} note={t("last30Days")} />
        {totalChannels > 0 ? (
          <View style={styles.breakdownStack}>
            {(Object.keys(data.channels) as Array<keyof TrainerAnalyticsChannels>).map((key) => (
              <BreakdownRow key={key} label={channelLabels[key]} value={data.channels[key]} total={totalChannels} />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>{t("noContactsYet")}</Text>
        )}
      </View>

      <Text style={styles.footer}>
        {t("totalViewsAllTime").replace("%s", data.totalViews.toLocaleString(locale))}
      </Text>
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
    paddingHorizontal: 20,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: theme.radius.control,
  },
  primaryButtonText: {
    ...typography.button,
    color: "#fff",
  },
  heroCard: {
    ...presets.card,
    padding: theme.spacing.lg,
    gap: 6,
  },
  heroTitle: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 28,
    color: theme.colors.text,
  },
  heroSubtitle: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
  periodLabel: {
    ...typography.label,
    color: theme.colors.textSecondary,
    marginTop: 14,
  },
  heroMetrics: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.control,
    padding: 12,
    gap: 4,
  },
  metricLabel: {
    ...typography.label,
    color: theme.colors.textSecondary,
  },
  metricValue: {
    // Numbers read in mono, like prices: digits line up across the cards.
    ...typography.price,
    fontSize: 30,
    lineHeight: 36,
    color: theme.colors.text,
  },
  metricHint: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 10,
  },
  rateValue: {
    ...typography.price,
    fontSize: 22,
    lineHeight: 28,
    color: theme.colors.primary,
  },
  rateHint: {
    ...typography.body2,
    color: theme.colors.text,
    flex: 1,
  },
  sectionCard: {
    ...presets.card,
    padding: theme.spacing.lg,
    gap: 12,
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
  sectionNote: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginLeft: "auto",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    minHeight: 150,
  },
  trendColumn: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  trendValue: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 12,
    color: theme.colors.text,
  },
  trendBar: {
    width: "100%",
    borderRadius: 8,
    backgroundColor: VIEWS_COLOR,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  trendContacts: {
    width: "100%",
    backgroundColor: CONTACTS_COLOR,
  },
  trendLabel: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  legendRow: {
    flexDirection: "row",
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  breakdownStack: {
    gap: 12,
  },
  breakdownRow: {
    gap: 6,
  },
  breakdownLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  breakdownLabel: {
    ...typography.body2,
    color: theme.colors.text,
  },
  breakdownValue: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.border,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  emptyText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
  footer: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
});
