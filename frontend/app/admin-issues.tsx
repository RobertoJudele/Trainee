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
  IssueBillingSnapshot,
  IssueTargetType,
  useGetIssuesAdminQuery,
  useUpdateIssueStatusAdminMutation,
} from "../features/support/issueApiSlice";
import {
  useGetGymStaffRequestsQuery,
  useReviewGymStaffMutation,
} from "../features/gym/gymApiSlice";
import { theme, typography, presets } from "../src/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../src/lib/i18n/LanguageContext";
import { getApiErrorMessage } from "../src/lib/errors";
import { fonts } from "../src/lib/fonts";

const statuses: Array<"open" | "in_review" | "resolved" | "rejected"> = [
  "open",
  "in_review",
  "resolved",
  "rejected",
];

/** The issue tabs, plus the gym-staff review queue which is not an Issue. */
type AdminTab = IssueTargetType | "staff";

const TARGET_TABS: Array<{ value: AdminTab; labelKey: string }> = [
  { value: "trainer", labelKey: "tabTrainer" },
  { value: "booking", labelKey: "tabBooking" },
  { value: "app", labelKey: "tabApp" },
  { value: "gym", labelKey: "tabGymRequests" },
  { value: "staff", labelKey: "tabStaffRequests" },
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
  } = useGetIssuesAdminQuery(undefined, { skip: !isAdmin });
  const [updateStatus, { isLoading: isUpdating }] = useUpdateIssueStatusAdminMutation();

  const [activeTab, setActiveTab] = React.useState<AdminTab>("trainer");
  const [showOpen, setShowOpen] = React.useState(true);

  const { data: staffData } = useGetGymStaffRequestsQuery(undefined, {
    skip: !isAdmin || activeTab !== "staff",
  });
  const [reviewStaff, { isLoading: isReviewing }] = useReviewGymStaffMutation();

  const staffRequests = staffData?.data ?? [];

  const handleReviewStaff = async (
    gymId: number,
    trainerId: number,
    approve: boolean
  ) => {
    try {
      await reviewStaff({ gymId, trainerId, approve }).unwrap();
    } catch (err) {
      Alert.alert(t("error"), getApiErrorMessage(err, t("error")));
    }
  };

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

  // isLoading only: a refetch keeps the cached data, so there is no reason to replace
  // the whole screen with a spinner once something is already on it.
  if (isLoading) {
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
          accessibilityLabel={t("retry")}
        >
          <Text style={styles.retryText}>{t("retry")}</Text>
        </Pressable>
      </View>
    );
  }

  const tabBar = (
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
  );

  // The gym-staff queue is not an Issue, so it gets its own list.
  if (activeTab === "staff") {
    return (
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={staffRequests}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={<View>{tabBar}</View>}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t("noStaffRequests")}</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="ribbon-outline"
                size={20}
                color={theme.colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.title}>{item.trainerName}</Text>
            </View>
            <Text style={styles.meta}>
              {item.gymName}
              {item.gymCity ? ` • ${item.gymCity}` : ""}
            </Text>
            {item.staffRequestedAt ? (
              <Text style={styles.meta}>
                {t("requestedOn")}{" "}
                {new Date(item.staffRequestedAt).toLocaleDateString()}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                style={[styles.statusButton, styles.statusButtonActive]}
                onPress={() => handleReviewStaff(item.gymId, item.trainerId, true)}
                disabled={isReviewing}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t("approve")}
              >
                <Text style={styles.statusButtonTextActive}>{t("approve")}</Text>
              </Pressable>
              <Pressable
                style={styles.statusButton}
                onPress={() => handleReviewStaff(item.gymId, item.trainerId, false)}
                disabled={isReviewing}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t("reject")}
              >
                <Text style={styles.statusButtonText}>{t("reject")}</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
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
          {tabBar}
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
          {item.reporter ? (
            <Text style={styles.meta} selectable>
              {t("issueReporter")}:{" "}
              {[item.reporter.firstName, item.reporter.lastName].filter(Boolean).join(" ") || "—"}
              {" · "}
              {item.reporter.email} · #{item.reporter.id}
            </Text>
          ) : null}
          <Text style={styles.description}>{item.description}</Text>
          {item.category === "payment_issue" && item.metadata?.billing ? (
            <BillingSnapshotView
              billing={item.metadata.billing as IssueBillingSnapshot}
              t={t}
            />
          ) : null}
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

const formatDate = (value?: string | null): string =>
  value ? new Date(value).toLocaleDateString() : "—";

function BillingSnapshotView({
  billing,
  t,
}: {
  billing: IssueBillingSnapshot;
  t: (key: string) => string;
}): React.JSX.Element {
  if (billing.trainerId == null) {
    return (
      <View style={styles.billingBox}>
        <Text style={styles.billingTitle}>{t("issueBilling")}</Text>
        <Text style={styles.meta}>{t("issueBillingNone")}</Text>
      </View>
    );
  }

  const storeId =
    billing.appleOriginalTransactionId ??
    billing.googlePurchaseToken ??
    billing.stripeSubscriptionId ??
    null;
  const tx = billing.lastTransaction;

  return (
    <View style={styles.billingBox}>
      <Text style={styles.billingTitle}>{t("issueBilling")}</Text>
      <Text style={styles.meta} selectable>
        {t("issueBillingStatus")}: {billing.subscriptionStatus ?? "—"} · {t("issueBillingProvider")}:{" "}
        {billing.billingProvider ?? "—"}
      </Text>
      <Text style={styles.meta} selectable>
        {billing.productId ?? "—"} · {t("issueBillingExpires")}: {formatDate(billing.expiresAt)}
      </Text>
      {storeId ? (
        <Text style={styles.meta} selectable numberOfLines={1}>
          {t("issueBillingStoreId")}: {storeId}
        </Text>
      ) : null}
      <Text style={styles.meta} selectable>
        {t("issueBillingLastTx")}:{" "}
        {tx
          ? `${tx.amount ?? "?"} ${tx.currency ?? ""} · ${tx.status ?? "—"} · ${formatDate(tx.paidAt)} · ${tx.transactionId ?? `#${tx.id}`}`
          : t("issueBillingNoTx")}
      </Text>
    </View>
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
    ...presets.card,
    padding: 16,
    gap: 8,
    marginBottom: 12,
  },
  title: { ...typography.body1, color: theme.colors.text, fontFamily: fonts.uiBold },
  meta: { ...typography.caption, color: theme.colors.textSecondary },
  description: { ...typography.body2, color: theme.colors.text },
  status: { ...typography.label, color: theme.colors.textSecondary, marginTop: 4 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  statusButton: {
    ...presets.chip,
  },
  statusButtonActive: {
    ...presets.chipSelected,
  },
  statusButtonText: { ...presets.chipText },
  statusButtonTextActive: { ...presets.chipTextSelected },
  tabBar: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tab: {
    ...presets.chip,
  },
  tabActive: { ...presets.chipSelected },
  tabText: { ...presets.chipText },
  tabTextActive: { ...presets.chipTextSelected },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  filterChip: {
    ...presets.chip,
  },
  filterChipActive: {
    ...presets.chipSelected,
  },
  filterChipText: { ...presets.chipText },
  filterChipTextActive: { ...presets.chipTextSelected },
  gymMeta: { gap: 2, marginTop: 2 },
  billingBox: {
    gap: 2,
    marginTop: 4,
    padding: 10,
    borderRadius: theme.radius.control,
    backgroundColor: "#F8FAFC",
  },
  billingTitle: { ...typography.label, color: theme.colors.text },
  emptyText: { ...typography.body1, color: theme.colors.textSecondary },
  retryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.control,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: "center",
  },
  retryText: { ...typography.body2, color: "#fff", fontFamily: fonts.uiBold },
});
