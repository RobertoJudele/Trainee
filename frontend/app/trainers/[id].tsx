import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGetTrainerByIdQuery } from "../../features/trainer/trainerApiSlice";
import { theme, typography } from "../../src/lib/theme";

type TrainerRouteParams = {
  id?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  bio?: string;
  totalRating?: string;
  reviewCount?: string;
  experienceYears?: string;
  hourlyRate?: string;
  sessionRate?: string;
  isAvailableAtGym?: string;
};

const toNumber = (value?: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function TrainerDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<TrainerRouteParams>();

  const trainerPublicId = typeof params.id === "string" ? params.id.trim() : "";
  const hasValidTrainerId = trainerPublicId.length > 0;

  const {
    data: trainer,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetTrainerByIdQuery(trainerPublicId, {
    skip: !hasValidTrainerId,
  });

  const fullName =
    [trainer?.user?.firstName ?? params.firstName, trainer?.user?.lastName ?? params.lastName]
      .filter(Boolean)
      .join(" ") || "Trainer";

  const rating = trainer?.totalRating ?? toNumber(params.totalRating) ?? 0;
  const reviewCount = trainer?.reviewCount ?? toNumber(params.reviewCount) ?? 0;
  const experienceYears =
    trainer?.experienceYears ?? toNumber(params.experienceYears) ?? 0;
  const hourlyRate = trainer?.hourlyRate ?? toNumber(params.hourlyRate);
  const sessionRate = trainer?.sessionRate ?? toNumber(params.sessionRate);
  const bio = trainer?.bio ?? params.bio ?? "No bio available";
  const locationText = [
    trainer?.locationCity,
    trainer?.locationState,
    trainer?.locationCountry,
  ]
    .filter(Boolean)
    .join(", ");

  const isAvailable =
    typeof trainer?.isAvailable === "boolean"
      ? trainer.isAvailable
      : params.isAvailableAtGym === "1";

  if (!hasValidTrainerId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Invalid trainer selected.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading || isFetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading trainer details...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load trainer details.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => refetch()}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        {params.profileImageUrl ? (
          <Image source={{ uri: params.profileImageUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>
              {(params.firstName?.[0] ?? "") + (params.lastName?.[0] ?? "")}
            </Text>
          </View>
        )}

        <Text style={styles.name}>{fullName}</Text>
        <View style={[styles.availabilityBadge, isAvailable ? styles.badgeOn : styles.badgeOff]}>
          <Text style={styles.availabilityText}>{isAvailable ? "Available" : "Unavailable"}</Text>
        </View>

        <View style={styles.ratingRow}>
          <Text style={styles.ratingText}>⭐ {Number(rating).toFixed(1)}</Text>
          <Text style={styles.reviewsText}>({reviewCount} reviews)</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.sectionText}>{bio}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Experience & Rates</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Experience</Text>
          <Text style={styles.infoValue}>{experienceYears} years</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Hourly rate</Text>
          <Text style={styles.infoValue}>{hourlyRate ? `$${hourlyRate}/hr` : "N/A"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Session rate</Text>
          <Text style={styles.infoValue}>{sessionRate ? `$${sessionRate}/session` : "N/A"}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Text style={styles.sectionText}>{locationText || "Location not specified"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Gyms</Text>
        {trainer?.availableGyms && trainer.availableGyms.length > 0 ? (
          trainer.availableGyms.map((gym) => (
            <View key={gym.id} style={styles.gymRow}>
              <View style={styles.gymMeta}>
                <Text style={styles.gymName}>{gym.name}</Text>
                <Text style={styles.gymAddress}>
                  {[gym.address, gym.city, gym.state].filter(Boolean).join(", ")}
                </Text>
              </View>
              <Text style={styles.gymRating}>⭐ {Number(gym.rating ?? 0).toFixed(1)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.sectionText}>No currently available gyms.</Text>
        )}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
        <Text style={styles.primaryButtonText}>Back to map</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() =>
          router.push({
            pathname: "/report-issue",
            params: {
              targetType: "trainer",
              trainerId: trainer?.internalId ? String(trainer.internalId) : "",
              trainerPublicId,
            },
          })
        }
      >
        <Text style={styles.secondaryButtonText}>Report Issue</Text>
      </TouchableOpacity>
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
    paddingBottom: 36,
    gap: 14,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: theme.spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 10,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarInitials: {
    ...typography.h3,
    color: "#fff",
    fontWeight: "800",
  },
  name: {
    ...typography.h3,
    color: theme.colors.text,
    marginBottom: 8,
  },
  availabilityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  badgeOn: { backgroundColor: "#DCFCE7" },
  badgeOff: { backgroundColor: "#FEE2E2" },
  availabilityText: {
    ...typography.caption,
    color: theme.colors.text,
    fontWeight: "700",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratingText: {
    ...typography.body1,
    color: theme.colors.text,
    fontWeight: "700",
  },
  reviewsText: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  sectionTitle: {
    ...typography.h3,
    color: theme.colors.text,
  },
  sectionText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  infoLabel: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    ...typography.body2,
    color: theme.colors.text,
    fontWeight: "700",
  },
  gymRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 10,
  },
  gymMeta: { flex: 1 },
  gymName: {
    ...typography.body1,
    color: theme.colors.text,
    fontWeight: "700",
  },
  gymAddress: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  gymRating: {
    ...typography.caption,
    color: theme.colors.text,
    fontWeight: "700",
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    ...typography.body1,
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButton: {
    marginTop: 2,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DC2626",
  },
  secondaryButtonText: {
    ...typography.body1,
    color: "#B91C1C",
    fontWeight: "700",
  },
});
