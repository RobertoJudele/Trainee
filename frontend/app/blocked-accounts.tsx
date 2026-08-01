import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  BlockedUser,
  useGetBlockedUsersQuery,
  useUnblockUserMutation,
} from "../features/block/blockApiSlice";
import { theme, typography } from "../src/lib/theme";
import { useLanguage } from "../src/lib/i18n/LanguageContext";

export default function BlockedAccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const { data, isLoading } = useGetBlockedUsersQuery();
  const [unblockUser, { isLoading: isUnblocking }] = useUnblockUserMutation();
  const blocked = data?.data ?? [];

  const renderItem = ({ item }: { item: BlockedUser }) => (
    <View style={styles.row}>
      {item.profileImageUrl ? (
        <Image source={{ uri: item.profileImageUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>
            {(item.firstName?.[0] ?? "") + (item.lastName?.[0] ?? "")}
          </Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {`${item.firstName} ${item.lastName}`.trim() || t("blockedUserFallback")}
      </Text>
      <Pressable
        style={styles.unblockButton}
        onPress={() => void unblockUser(item.id)}
        disabled={isUnblocking}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t("unblock")}
      >
        <Text style={styles.unblockText}>{t("unblock")}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.md }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t("goBackButton")}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>{t("blockedAccounts")}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
      ) : blocked.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={36} color={theme.colors.textSecondary} />
          <Text style={styles.emptyText}>{t("noBlockedAccounts")}</Text>
        </View>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.h2, color: theme.colors.text },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    ...theme.shadows.small,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "700" },
  name: { ...typography.body1, color: theme.colors.text, flex: 1 },
  unblockButton: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.roundness,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  unblockText: { ...typography.body2, color: theme.colors.primary, fontWeight: "700" },
  empty: { alignItems: "center", justifyContent: "center", marginTop: 48, gap: 8 },
  emptyText: { ...typography.body2, color: theme.colors.textSecondary },
});
