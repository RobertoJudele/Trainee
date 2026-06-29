import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "../features/auth/authSlice";
import {
  IssueTargetType,
  useGetIssuesAdminQuery,
  useUpdateIssueStatusAdminMutation,
} from "../features/support/issueApiSlice";
import { theme, typography } from "../src/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../src/lib/i18n/LanguageContext";
import { getApiErrorMessage } from "../src/lib/errors";

const statuses: Array<"open" | "in_review" | "resolved" | "rejected"> = [
  "open",
  "in_review",
  "resolved",
  "rejected",
];

const TARGET_TABS: Array<{ value: IssueTargetType; labelKey: string }> = [
  { value: "trainer", labelKey: "tabTrainer" },
  { value: "booking", labelKey: "tabBooking" },
  { value: "app", labelKey: "tabApp" },
  { value: "gym", labelKey: "tabGymRequests" },
];

const OPEN_STATUSES = ["open", "in_review"];

export default function AdminIssuesScreen() {
  const { t } = useLanguage();
  const user = useSelector(selectCurrentUser);
  const isAdmin = user?.role === "admin";

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useGetIssuesAdminQuery(undefined, { skip: !isAdmin });
  const [updateStatus, { isLoading: isUpdating }] = useUpdateIssueStatusAdminMutation();

  const [activeTab, setActiveTab] = React.useState<IssueTargetType>("trainer");
  const [showOpen, setShowOpen] = React.useState(true);

  const handleStatusChange = async (
    issueId: number,
    status: "open" | "in_review" | "resolved" | "rejected"
  ) => {
    try {
      await updateStatus({ issueId, status }).unwrap();
      await refetch();
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Could not update issue status.");
      Alert.alert(t("error"), message);
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{t("adminAccessRequired")}</Text>
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
        <Text style={styles.emptyText}>{t("couldNotLoadIssues")}</Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => refetch()}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Retry loading issues"
        >
          <Text style={styles.retryText}>{t("retry")}</Text>
        </Pressable>
      </View>
    );
  }

  const allIssues = data?.data || [];
  const issues = allIssues.filter((i) => {
    if (i.targetType !== activeTab) return false;
    const isOpen = OPEN_STATUSES.includes(i.status);
    return showOpen ? isOpen : !isOpen;
  });

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={issues}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <View>
          <View style={styles.tabBar}>
            {TARGET_TABS.map((tab) => (
              <Pressable
                key={tab.value}
                style={[styles.tab, activeTab === tab.value && styles.tabActive]}
                onPress={() => setActiveTab(tab.value)}
                accessibilityRole="button"
                accessibilityLabel={t(tab.labelKey)}
              >
                <Text
                  style={[styles.tabText, activeTab === tab.value && styles.tabTextActive]}
                >
                  {t(tab.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.filterRow}>
            {[
              { open: true, labelKey: "filterOpen" },
              { open: false, labelKey: "filterClosed" },
            ].map((f) => (
              <Pressable
                key={f.labelKey}
                style={[styles.filterChip, showOpen === f.open && styles.filterChipActive]}
                onPress={() => setShowOpen(f.open)}
                accessibilityRole="button"
                accessibilityLabel={t(f.labelKey)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    showOpen === f.open && styles.filterChipTextActive,
                  ]}
                >
                  {t(f.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={styles.emptyText}>{t("noIssuesFound")}</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
            <Text style={styles.title}>{item.title}</Text>
          </View>
          <Text style={styles.meta}>
            #{item.id} • {item.category} • {item.targetType}
          </Text>
          <Text style={styles.description}>{item.description}</Text>
          {item.targetType === "gym" && item.metadata ? (
            <View style={styles.gymMeta}>
              <Text style={styles.meta}>
                {t("gymAddress")}: {String(item.metadata.address ?? "—")}
              </Text>
              <Text style={styles.meta}>
                {t("gymLocationLabel")}: {String(item.metadata.latitude ?? "?")},{" "}
                {String(item.metadata.longitude ?? "?")}
              </Text>
            </View>
          ) : null}
          <Text style={styles.status}>{t("currentStatus")} {item.status}</Text>

          <View style={styles.actions}>
            {statuses.map((status) => (
              <Pressable
                key={status}
                style={[
                  styles.statusButton,
                  item.status === status && styles.statusButtonActive,
                ]}
                onPress={() => handleStatusChange(item.id, status)}
                disabled={isUpdating}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Set issue status to ${status}`}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    item.status === status && styles.statusButtonTextActive,
                  ]}
                >
                  {status}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 14, gap: 10, paddingBottom: 24 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    gap: 10,
  },
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
  title: { ...typography.body1, color: theme.colors.text, fontWeight: "700" },
  meta: { ...typography.caption, color: theme.colors.textSecondary },
  description: { ...typography.body2, color: theme.colors.text },
  status: { ...typography.caption, color: theme.colors.textSecondary, marginTop: 4 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  statusButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  statusButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  statusButtonText: { ...typography.caption, color: theme.colors.text },
  statusButtonTextActive: { color: "#fff", fontWeight: "700" },
  tabBar: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tab: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { ...typography.caption, color: theme.colors.text },
  tabTextActive: { color: "#fff", fontWeight: "700" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  filterChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  filterChipActive: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  filterChipText: { ...typography.caption, color: theme.colors.text },
  filterChipTextActive: { color: "#fff", fontWeight: "700" },
  gymMeta: { gap: 2, marginTop: 2 },
  emptyText: { ...typography.body1, color: theme.colors.textSecondary },
  retryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...theme.shadows.small,
  },
  retryText: { ...typography.body2, color: "#fff", fontWeight: "700" },
});
