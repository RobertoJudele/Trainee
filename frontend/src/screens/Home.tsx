// frontend/src/screens/Home.tsx
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
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSearchTrainersQuery, TrainerSearchItem } from "../../features/trainer/trainerApiSlice";
import { useGetSuggestedTrainersQuery, SuggestedTrainer } from "../../features/recommendations/recommendationApiSlice";
import { useDispatch, useSelector } from "react-redux";
import { selectCurrentUser } from "../../features/auth/authSlice";
import { apiSlice } from "../api/apiSlice";
import { UserRole } from "../../features/auth/authApiSlice";
import { theme, typography } from "../lib/theme";
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeInUp, PressableScale } from "../components/ui";
import { useTourTarget } from "../components/onboarding/TourContext";

const { width } = Dimensions.get("window");

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useSelector(selectCurrentUser);
  const [refreshing, setRefreshing] = useState(false);
  const userRole = user?.role;
  const isClient = userRole === UserRole.CLIENT;

  // Onboarding tour target — the "Find Trainers" quick action.
  const findTrainersTourRef = useTourTarget("home-find-trainers");

  const quickActions = [
    {
      icon: "search",
      title: "Find Trainers",
      desc: "Browse all trainers",
      route: "/search" as const,
      roles: [UserRole.CLIENT],
    },
    {
      icon: "briefcase",
      title: "Become Trainer",
      desc: "Start your journey",
      route: "/create-trainer" as const,
      hiddenIfRole: UserRole.TRAINER,
      roles: [UserRole.CLIENT],
    },
    {
      icon: "person",
      title: "My Profile",
      desc: "View trainer profile",
      route: "/TrainerProfile" as const,
      roles: [UserRole.TRAINER],
    },
    {
      icon: "person",
      title: "My Profile",
      desc: "View your account",
      route: "/UserProfile" as const,
      roles: [UserRole.CLIENT],
    },
    {
      icon: "map",
      title: "Gym Map",
      desc: "Find gyms near you",
      route: "/map" as const,
    },
    {
      icon: "calendar",
      title: "Trainer Schedule",
      desc: "Set hours and assign clients",
      route: "/trainer-schedule" as const,
      roles: [UserRole.TRAINER],
    },
    {
      icon: "receipt",
      title: "My Schedule",
      desc: "See assigned sessions",
      route: "/my-schedule" as const,
      roles: [UserRole.CLIENT],
    },
    {
      icon: "construct",
      title: "Admin Issues",
      desc: "Review reports",
      route: "/admin-issues" as const,
      roles: [UserRole.ADMIN],
    },
  ].filter((action) => {
    if (action.hiddenIfRole && userRole === action.hiddenIfRole) return false;
    if (action.roles && (!userRole || !action.roles.includes(userRole as UserRole))) return false;
    if ((action as any).requiresAuth && !user) return false;
    return true;
  });

  const { data, isLoading, isError, refetch } = useSearchTrainersQuery(
    {
      sortBy: "totalRating",
      sortOrder: "desc",
      limit: 5,
    },
    { skip: isClient }
  );

  const trainers = data?.data?.trainers ?? [];
  const topRatedTrainers = trainers.slice(0, 5);

  const {
    data: suggestedData,
    isLoading: suggestedLoading,
    isError: suggestedError,
    refetch: refetchSuggested,
  } = useGetSuggestedTrainersQuery({ limit: 5 }, { skip: !isClient });

  const suggestedTrainers = suggestedData?.data?.trainers ?? [];
  const hasPreferences = suggestedData?.data?.hasPreferences ?? true;

  const onRefresh = async () => {
    setRefreshing(true);
    if (isClient) {
      await refetchSuggested();
    } else {
      await refetch();
    }
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };



  const renderTrainerCard = ({ item, index }: { item: TrainerSearchItem; index: number }) => (
    <FadeInUp delay={index * theme.motion.stagger}>
    <PressableScale
      style={styles.trainerCard}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`View trainer ${item.user?.firstName ?? ""} ${item.user?.lastName ?? ""}`}
      onPress={() =>
        router.push({
          pathname: "/trainers/[id]",
          params: {
            id: String(item.id),
            firstName: item.user?.firstName ?? "",
            lastName: item.user?.lastName ?? "",
            profileImageUrl: item.user?.profileImageUrl ?? "",
            bio: item.bio ?? "",
            totalRating: String(Number(item.totalRating ?? 0)),
            reviewCount: String(item.reviewCount ?? 0),
            experienceYears: String(item.experienceYears ?? 0),
            hourlyRate: String(item.hourlyRate ?? 0),
            sessionRate: String(item.sessionRate ?? 0),
            isAvailableAtGym: item.isAvailable ? "1" : "0",
          },
        })
      }
    >
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
          <View style={styles.metaBadge}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.rating}>{Number(item.totalRating ?? 0).toFixed(1)}</Text>
            <Text style={styles.reviewCount}>({item.reviewCount})</Text>
          </View>
          {(item.locationCity || item.locationState) && (
            <View style={[styles.metaBadge, { marginLeft: 8 }]}>
              <Ionicons name="location" size={12} color={theme.colors.textSecondary} />
              <Text style={styles.location}>
                {[item.locationCity, item.locationState].filter(Boolean).join(", ")}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.priceTag}>
        <Text style={styles.hourlyRate}>
          {item.hourlyRate
            ? `$${item.hourlyRate}/hr`
            : item.sessionRate
              ? `$${item.sessionRate}/ses`
              : ""}
        </Text>
      </View>
    </PressableScale>
    </FadeInUp>
  );

  const renderSuggestedTrainerCard = ({ item, index }: { item: SuggestedTrainer; index: number }) => (
    <FadeInUp delay={index * theme.motion.stagger}>
    <PressableScale
      style={styles.trainerCard}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`View trainer ${item.user?.firstName ?? ""} ${item.user?.lastName ?? ""}`}
      onPress={() =>
        router.push({
          pathname: "/trainers/[id]",
          params: {
            id: String(item.internalId),
            firstName: item.user?.firstName ?? "",
            lastName: item.user?.lastName ?? "",
            profileImageUrl: item.user?.profileImageUrl ?? "",
            bio: item.bio ?? "",
            totalRating: String(Number(item.totalRating ?? 0)),
            reviewCount: String(item.reviewCount ?? 0),
            experienceYears: String(item.experienceYears ?? 0),
            hourlyRate: String(item.hourlyRate ?? 0),
            sessionRate: String(item.sessionRate ?? 0),
            isAvailableAtGym: item.isAvailable ? "1" : "0",
          },
        })
      }
    >
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
        <View style={styles.suggestedNameRow}>
          <Text style={[styles.trainerName, styles.suggestedNameText]} numberOfLines={1}>
            {item.user?.firstName} {item.user?.lastName}
          </Text>
          <View style={styles.matchBadge}>
            <Text style={styles.matchBadgeText}>{item.matchPercent}%</Text>
          </View>
        </View>
        <Text style={styles.trainerBio} numberOfLines={1}>
          {item.bio || "Professional fitness trainer"}
        </Text>
        {item.specializations?.length > 0 && (
          <Text style={styles.trainerSpec} numberOfLines={1}>
            {item.specializations.map((s) => s.name).join(" · ")}
          </Text>
        )}
        <View style={styles.trainerMeta}>
          <View style={styles.metaBadge}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.rating}>{Number(item.totalRating ?? 0).toFixed(1)}</Text>
            <Text style={styles.reviewCount}>({item.reviewCount})</Text>
          </View>
          {item.worksAtPreferredGym ? (
            <View style={[styles.metaBadge, { marginLeft: 8 }]}>
              <Ionicons name="business" size={12} color={theme.colors.primary} />
              <Text style={[styles.location, { color: theme.colors.primary, fontWeight: "700" }]}>
                Works at your gym
              </Text>
            </View>
          ) : (
            (item.locationCity || item.locationState) && (
              <View style={[styles.metaBadge, { marginLeft: 8 }]}>
                <Ionicons name="location" size={12} color={theme.colors.textSecondary} />
                <Text style={styles.location}>
                  {[item.locationCity, item.locationState].filter(Boolean).join(", ")}
                </Text>
              </View>
            )
          )}
        </View>
      </View>
      <View style={styles.priceTag}>
        <Text style={styles.hourlyRate}>
          {item.hourlyRate
            ? `$${item.hourlyRate}/hr`
            : item.sessionRate
              ? `$${item.sessionRate}/ses`
              : ""}
        </Text>
      </View>
    </PressableScale>
    </FadeInUp>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header Profile Area (Gradient) */}
      <LinearGradient colors={[theme.colors.primary, theme.colors.tertiary]} style={styles.headerGradient}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + theme.spacing.sm, theme.spacing.xxl) }]}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>
              {user?.firstName ? `${user.firstName}!` : "Welcome!"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (!user) { router.push("/login"); return; }
              router.push(user.role === UserRole.TRAINER ? "/TrainerProfile" : "/UserProfile");
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={user ? "View my profile" : "Sign in"}
          >
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitials}>{user?.firstName?.[0] ?? "U"}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.contentWrap}>
        {/* Search bar */}
        <FadeInUp delay={theme.motion.stagger} style={styles.searchBarTouchable}>
          <PressableScale
            scaleTo={0.98}
            onPress={() => router.push("/search")}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Search trainers"
          >
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={theme.colors.primary} style={styles.searchIcon} />
              <Text style={styles.searchPlaceholder}>Search trainers, specializations...</Text>
            </View>
          </PressableScale>
        </FadeInUp>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <FadeInUp delay={theme.motion.stagger * 2}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </FadeInUp>
          <View style={styles.actionGrid}>
            {quickActions.map((action, index) => (
              <FadeInUp
                key={action.title}
                delay={theme.motion.stagger * (3 + index)}
                style={styles.actionCardWrap}
              >
                <View
                  ref={action.route === "/search" ? findTrainersTourRef : undefined}
                  collapsable={false}
                >
                <PressableScale
                  style={styles.actionCard}
                  onPress={() => {
                    if (action.route) {
                      router.push(action.route as never);
                    }
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={action.title}
                >
                  <View style={styles.actionIconWrap}>
                    {/* @ts-ignore */}
                    <Ionicons name={action.icon} size={28} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDesc}>{action.desc}</Text>
                </PressableScale>
                </View>
              </FadeInUp>
            ))}
          </View>
        </View>

        {/* Suggested for You (clients only) */}
        {isClient && (
          <View style={styles.trainersSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Suggested for You</Text>
              <TouchableOpacity
                onPress={() => router.push("/preferences")}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Edit preferences"
              >
                <Text style={styles.seeAllButton}>Edit preferences</Text>
              </TouchableOpacity>
            </View>

            {!hasPreferences && (
              <PressableScale
                style={styles.preferencesPrompt}
                onPress={() => router.push("/preferences")}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Set your preferences"
              >
                <Ionicons name="sparkles" size={24} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.preferencesPromptTitle}>Get personalized matches</Text>
                  <Text style={styles.preferencesPromptText}>
                    Tell us your goals, budget and preferred gym to see trainers picked for you.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </PressableScale>
            )}

            {suggestedLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Finding your matches...</Text>
              </View>
            ) : suggestedError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
                <Text style={styles.errorText}>Unable to load suggestions</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => refetchSuggested()}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Try Again"
                >
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : suggestedTrainers.length > 0 ? (
              <FlatList
                data={suggestedTrainers}
                renderItem={renderSuggestedTrainerCard}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="barbell" size={48} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>No trainers yet</Text>
              </View>
            )}
          </View>
        )}

        {/* Top Rated Trainers */}
        {!isClient && (
          <View style={styles.trainersSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Rated Trainers</Text>
              <TouchableOpacity
                onPress={() => router.push("/search")}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="See all trainers"
              >
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
                <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
                <Text style={styles.errorText}>Unable to load trainers</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => refetch()}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Try Again"
                >
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : topRatedTrainers.length > 0 ? (
              <FlatList
                data={topRatedTrainers}
                renderItem={renderTrainerCard}
                keyExtractor={(item) => String(item.id)}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="barbell" size={48} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>No trainers yet</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  contentWrap: {
    paddingTop: theme.spacing.md,
  },

  headerGradient: {
    paddingBottom: theme.spacing.xl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...theme.shadows.medium,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl, 
  },
  greeting: { ...typography.body1, color: "rgba(255, 255, 255, 0.8)", fontWeight: "500" },
  userName: { ...typography.h1, color: "#FFFFFF", fontWeight: "800" },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  profileInitials: { ...typography.h3, color: "#FFFFFF", fontWeight: "700" },

  searchBarTouchable: { 
    paddingHorizontal: theme.spacing.lg, 
    marginTop: -theme.spacing.lg, 
    marginBottom: theme.spacing.lg,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    ...theme.shadows.medium,
  },
  searchIcon: { marginRight: theme.spacing.sm },
  searchPlaceholder: { ...typography.body1, color: theme.colors.textSecondary },

  quickActions: { paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.xl },
  sectionTitle: { ...typography.h2, color: theme.colors.text, marginBottom: theme.spacing.md },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
  actionCardWrap: {
    width: (width - theme.spacing.lg * 2 - theme.spacing.md) / 2,
  },
  actionCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.roundness,
    alignItems: "flex-start",
    ...theme.shadows.small,
  },
  actionIconWrap: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xs,
    borderRadius: 10,
    marginBottom: theme.spacing.sm,
  },
  actionTitle: { ...typography.body1, fontWeight: "700", color: theme.colors.text, marginBottom: 2 },
  actionDesc: { ...typography.caption, color: theme.colors.textSecondary, textTransform: "none" },

  trainersSection: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  seeAllButton: { ...typography.body2, color: theme.colors.primary, fontWeight: "700" },

  trainerCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.roundness,
    ...theme.shadows.small,
  },
  trainerAvatar: { width: 60, height: 60, borderRadius: 30, marginRight: theme.spacing.md },
  trainerAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginRight: theme.spacing.md,
  },
  trainerInitials: { ...typography.h3, color: theme.colors.primary, fontWeight: "700" },
  trainerInfo: { flex: 1, justifyContent: "center" },
  trainerName: { ...typography.h3, color: theme.colors.text, marginBottom: 2 },
  suggestedNameRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  suggestedNameText: { flexShrink: 1, marginBottom: 0 },
  matchBadge: {
    flexShrink: 0,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  matchBadgeText: { ...typography.caption, color: "#fff", fontWeight: "700", textTransform: "none" },
  preferencesPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  preferencesPromptTitle: { ...typography.body1, fontWeight: "700", color: theme.colors.text },
  preferencesPromptText: { ...typography.body2, color: theme.colors.textSecondary },
  trainerBio: { ...typography.body2, color: theme.colors.textSecondary, marginBottom: 4 },
  trainerSpec: { ...typography.caption, color: theme.colors.primary, fontWeight: "700", marginBottom: 6, textTransform: "uppercase" },
  trainerMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  metaBadge: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rating: { ...typography.caption, fontWeight: "700", color: theme.colors.text, marginLeft: 4 },
  reviewCount: { ...typography.caption, color: theme.colors.textSecondary, marginLeft: 2, textTransform: "none" },
  location: { ...typography.caption, color: theme.colors.textSecondary, marginLeft: 4, textTransform: "none" },
  
  priceTag: {
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: theme.spacing.xs,
  },
  hourlyRate: { ...typography.body2, fontWeight: "800", color: theme.colors.primary },

  loadingContainer: { alignItems: "center", paddingVertical: theme.spacing.xl },
  loadingText: { ...typography.body2, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  errorContainer: { alignItems: "center", paddingVertical: theme.spacing.xl },
  errorText: { ...typography.body1, color: theme.colors.text, marginTop: theme.spacing.sm, marginBottom: theme.spacing.md },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.roundness,
    ...theme.shadows.small,
  },
  retryButtonText: { ...typography.body2, color: "#FFFFFF", fontWeight: "700" },
  emptyContainer: { alignItems: "center", paddingVertical: theme.spacing.xl },
  emptyText: { ...typography.body1, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
});
