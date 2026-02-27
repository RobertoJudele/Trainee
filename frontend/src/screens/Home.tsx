// frontend/src/screens/Home.tsx
// Replace the existing file with this

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSearchTrainersQuery, TrainerSearchItem } from "../../features/trainer/trainerApiSlice";
import { useSelector } from "react-redux";
import { selectCurrentToken, selectCurrentUser } from "../../features/auth/authSlice";
import { theme, typography } from "../lib/theme";

const { width } = Dimensions.get("window");

export default function Home() {
  const router = useRouter();
  const user = useSelector(selectCurrentUser);
  const [refreshing, setRefreshing] = useState(false);

  // Home screen shows featured / all trainers by default
  const { data, isLoading, isError, refetch } = useSearchTrainersQuery({
    sortBy: "totalRating",
    sortOrder: "desc",
    limit: 10,
  });

  const trainers = data?.data?.trainers ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const renderTrainerCard = ({ item }: { item: TrainerSearchItem }) => (
    <TouchableOpacity style={styles.trainerCard} activeOpacity={0.85}>
      {item.user?.profileImageUrl ? (
        <Image source={{ uri: item.user.profileImageUrl }} style={styles.trainerAvatar} />
      ) : (
        <View style={styles.trainerAvatarPlaceholder}>
          <Text style={styles.trainerInitials}>
            {item.user?.firstName?.[0]}
            {item.user?.lastName?.[0]}
          </Text>
        </View>
      )}

      <View style={styles.trainerInfo}>
        <Text style={styles.trainerName}>
          {item.user?.firstName} {item.user?.lastName}
        </Text>
        <Text style={styles.trainerBio} numberOfLines={1}>
          {item.bio || "Professional fitness trainer"}
        </Text>
        {item.specializations?.length > 0 && (
          <Text style={styles.trainerSpec} numberOfLines={1}>
            {item.specializations.map((s) => s.name).join(" · ")}
          </Text>
        )}
        <View style={styles.trainerMeta}>
          <Text style={styles.rating}>⭐ {Number(item.totalRating ?? 0).toFixed(1)}</Text>
          <Text style={styles.reviewCount}>({item.reviewCount})</Text>
          {(item.locationCity || item.locationState) && (
            <Text style={styles.location}>
              {"  "}📍 {[item.locationCity, item.locationState].filter(Boolean).join(", ")}
            </Text>
          )}
          <Text style={styles.hourlyRate}>
            {item.hourlyRate
              ? `$${item.hourlyRate}/hr`
              : item.sessionRate
              ? `$${item.sessionRate}/ses`
              : ""}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.userName}>
            {user?.firstName ? `${user.firstName}!` : "Welcome!"}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/TrainerProfile")}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitials}>{user?.firstName?.[0] ?? "U"}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search bar — tapping navigates to full search screen */}
      <TouchableOpacity
        style={styles.searchBarTouchable}
        onPress={() => router.push("/search")}
        activeOpacity={0.8}
      >
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search trainers, specializations...</Text>
        </View>
      </TouchableOpacity>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/search")}>
            <Text style={styles.actionIcon}>🔍</Text>
            <Text style={styles.actionTitle}>Find Trainers</Text>
            <Text style={styles.actionDesc}>Browse all trainers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/create-trainer")}
          >
            <Text style={styles.actionIcon}>💼</Text>
            <Text style={styles.actionTitle}>Become Trainer</Text>
            <Text style={styles.actionDesc}>Start your journey</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/TrainerProfile")}
          >
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={styles.actionTitle}>My Profile</Text>
            <Text style={styles.actionDesc}>View trainer profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Top Rated Trainers */}
      <View style={styles.trainersSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Rated Trainers</Text>
          <TouchableOpacity onPress={() => router.push("/search")}>
            <Text style={styles.seeAllButton}>See All</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Finding trainers...</Text>
          </View>
        ) : isError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>😞</Text>
            <Text style={styles.errorText}>Unable to load trainers</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : trainers.length > 0 ? (
          <FlatList
            data={trainers}
            renderItem={renderTrainerCard}
            keyExtractor={(_, i) => String(i)}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyText}>No trainers yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  greeting: { ...typography.body1, color: theme.colors.textSecondary },
  userName: { ...typography.h2, color: theme.colors.text, fontWeight: "700" },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitials: { ...typography.h3, color: "#FFFFFF", fontWeight: "600" },

  searchBarTouchable: { paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.lg },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
  },
  searchIcon: { fontSize: 20, marginRight: theme.spacing.sm },
  searchPlaceholder: { ...typography.body1, color: theme.colors.textSecondary },

  quickActions: { paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.lg },
  sectionTitle: { ...typography.h3, color: theme.colors.text, marginBottom: theme.spacing.md },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  actionCard: {
    width: (width - theme.spacing.lg * 2 - theme.spacing.sm) / 2,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.roundness,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionIcon: { fontSize: 32, marginBottom: theme.spacing.xs },
  actionTitle: { ...typography.body1, fontWeight: "600", color: theme.colors.text, marginBottom: 2 },
  actionDesc: { ...typography.caption, color: theme.colors.textSecondary, textAlign: "center" },

  trainersSection: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  seeAllButton: { ...typography.body2, color: theme.colors.primary, fontWeight: "600" },

  trainerCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  trainerAvatar: { width: 52, height: 52, borderRadius: 26, marginRight: theme.spacing.md },
  trainerAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.secondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: theme.spacing.md,
  },
  trainerInitials: { ...typography.h3, color: "#FFFFFF", fontWeight: "600" },
  trainerInfo: { flex: 1 },
  trainerName: { ...typography.body1, fontWeight: "700", color: theme.colors.text, marginBottom: 2 },
  trainerBio: { ...typography.body2, color: theme.colors.textSecondary, marginBottom: 2 },
  trainerSpec: { ...typography.caption, color: theme.colors.primary, fontWeight: "600", marginBottom: 4 },
  trainerMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  rating: { ...typography.caption, fontWeight: "600", color: theme.colors.text },
  reviewCount: { ...typography.caption, color: theme.colors.textSecondary, marginLeft: 2 },
  location: { ...typography.caption, color: theme.colors.textSecondary, flex: 1 },
  hourlyRate: { ...typography.caption, fontWeight: "700", color: theme.colors.primary },

  loadingContainer: { alignItems: "center", paddingVertical: theme.spacing.xl },
  loadingText: { ...typography.body2, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  errorContainer: { alignItems: "center", paddingVertical: theme.spacing.xl },
  errorIcon: { fontSize: 40, marginBottom: theme.spacing.sm },
  errorText: { ...typography.body1, color: theme.colors.text, marginBottom: theme.spacing.xs },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.roundness,
    marginTop: theme.spacing.sm,
  },
  retryButtonText: { ...typography.body2, color: "#FFFFFF", fontWeight: "600" },
  emptyContainer: { alignItems: "center", paddingVertical: theme.spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: theme.spacing.sm },
  emptyText: { ...typography.body1, color: theme.colors.text },
});
