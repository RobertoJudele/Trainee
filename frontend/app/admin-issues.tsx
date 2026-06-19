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
  useGetIssuesAdminQuery,
  useUpdateIssueStatusAdminMutation,
} from "../features/support/issueApiSlice";
import { theme, typography } from "../src/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../src/lib/i18n/LanguageContext";

const statuses: Array<"open" | "in_review" | "resolved" | "rejected"> = [
  "open",
  "in_review",
  "resolved",
  "rejected",
];

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

  const handleStatusChange = async (
    issueId: number,
    status: "open" | "in_review" | "resolved" | "rejected"
  ) => {
    try {
      await updateStatus({ issueId, status }).unwrap();
      await refetch();
    } catch (error: any) {
      const message = error?.data?.message || "Could not update issue status.";
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

  const issues = data?.data || [];

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={issues}
      keyExtractor={(item) => String(item.id)}
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
