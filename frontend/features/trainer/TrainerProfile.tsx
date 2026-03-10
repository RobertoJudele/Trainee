import React, { useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import {
  selectCurrentTrainer,
  selectCurrentUser,
  setTrainerProfile,
  setCredentials,
  selectCurrentToken,
} from "../auth/authSlice";
import {
  useDeleteTrainerProfileMutation,
  useGetTrainerProfileQuery,
} from "./trainerApiSlice";
import { router } from "expo-router";

function TrainerProfile() {
  const trainer = useSelector(selectCurrentTrainer);
  const user = useSelector(selectCurrentUser);
  const token = useSelector(selectCurrentToken);
  const dispatch = useDispatch();

  const {
    data: trainerResponse,
    isLoading,
    isError,
    refetch,
  } = useGetTrainerProfileQuery(undefined, {
    skip: !!trainer,
  });

  const [deleteTrainerProfile, { isLoading: isDeleting }] =
    useDeleteTrainerProfileMutation();

  useEffect(() => {
    if (trainerResponse?.data && !trainer) {
      dispatch(setTrainerProfile(trainerResponse.data));
    }
  }, [trainerResponse, trainer, dispatch]);

  const handleDelete = useCallback(async () => {
    Alert.alert(
      "Delete Trainer Profile",
      "Are you sure you want to delete your trainer profile? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => performDelete() },
      ]
    );
  }, []);

  const performDelete = useCallback(async () => {
    try {
      await deleteTrainerProfile().unwrap();
      dispatch(setTrainerProfile(null));
      if (user) {
        dispatch(setCredentials({ user: { ...user, role: "client" }, token: token || "" }));
      }
      router.push("/(auth)/Welcome");
    } catch {
      Alert.alert("Error", "Failed to delete trainer profile");
    }
  }, [deleteTrainerProfile, dispatch, user, token]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!trainer) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No trainer profile found</Text>
        <Pressable style={styles.button} onPress={() => router.push("/login")}>
          <Text style={styles.buttonText}>Login</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => router.push("/")}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const formatDate = (date: string | Date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) =>
      i < Math.floor(rating) ? "⭐" : "☆"
    ).join("");

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Trainer Profile</Text>
        <View style={[styles.statusBadge, trainer.isAvailable ? styles.available : styles.unavailable]}>
          <Text style={styles.statusText}>
            {trainer.isAvailable ? "🟢 Available" : "🔴 Unavailable"}
          </Text>
        </View>
        {trainer.isFeatured && (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>⭐ Featured Trainer</Text>
          </View>
        )}
      </View>

      {/* ── Bio ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About Me</Text>
        <Text style={styles.bioText}>{trainer.bio || "No bio available"}</Text>
      </View>

      {/* ── Experience & Rates ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Experience & Rates</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Experience</Text>
            <Text style={styles.infoValue}>{trainer.experienceYears || 0} years</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Hourly Rate</Text>
            <Text style={styles.infoValue}>${trainer.hourlyRate || 0}/hr</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Session Rate</Text>
            <Text style={styles.infoValue}>${trainer.sessionRate || 0}/session</Text>
          </View>
        </View>
      </View>

      {/* ── Location ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Location</Text>
        <Text style={styles.locationText}>
          {trainer.locationCity && trainer.locationState
            ? `${trainer.locationCity}, ${trainer.locationState}`
            : "Location not specified"}
        </Text>
        <Text style={styles.locationSubtext}>
          {trainer.locationCountry || "Country not specified"}
        </Text>
      </View>

      {/* ── Stats ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{trainer.profileViews || 0}</Text>
            <Text style={styles.statLabel}>Profile Views</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{trainer.reviewCount || 0}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{Number(trainer.totalRating || 0).toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
            <Text style={styles.starsText}>{renderStars(Number(trainer.totalRating || 0))}</Text>
          </View>
        </View>
      </View>

      {/* ── Account info ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        <View style={styles.accountInfo}>
          <Text style={styles.accountLabel}>Profile Created:</Text>
          <Text style={styles.accountValue}>{formatDate(trainer.createdAt)}</Text>
        </View>
        <View style={styles.accountInfo}>
          <Text style={styles.accountLabel}>Last Updated:</Text>
          <Text style={styles.accountValue}>{formatDate(trainer.updatedAt)}</Text>
        </View>
      </View>

      {/* ── Actions ── */}
      <View style={styles.buttonSection}>

        {/* My Gyms — the new button */}
        <Pressable
          style={({ pressed }) => [styles.gymsButton, pressed && styles.buttonPressed]}
          onPress={() => router.push("/my-gyms")}
        >
          <View style={styles.gymsButtonInner}>
            <Text style={styles.gymsButtonIcon}>🏋️</Text>
            <View>
              <Text style={styles.gymsButtonTitle}>My Gyms</Text>
              <Text style={styles.gymsButtonSub}>Manage your gym locations & availability</Text>
            </View>
            <Text style={styles.gymsButtonArrow}>›</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.editButton}
          onPress={() => Alert.alert("Coming Soon", "Edit functionality will be available soon!")}
        >
          <Text style={styles.buttonText}>✏️ Edit Profile</Text>
        </Pressable>

        <Pressable
          style={[styles.deleteButton, isDeleting && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={isDeleting}
        >
          <Text style={styles.buttonText}>
            {isDeleting ? "🔄 Deleting..." : "🗑️ Delete Profile"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.backButton}
          onPress={() => router.push("/(auth)/Welcome")}
        >
          <Text style={styles.buttonText}>← Back to Welcome</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 12,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  statusBadge: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 10,
  },
  available: { backgroundColor: "#d4edda" },
  unavailable: { backgroundColor: "#f8d7da" },
  statusText: { fontSize: 14, fontWeight: "600", color: "#333" },
  featuredBadge: {
    backgroundColor: "#fff3cd",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  featuredText: { fontSize: 14, fontWeight: "600", color: "#856404" },

  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  bioText: { fontSize: 16, lineHeight: 24, color: "#666" },

  infoGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  infoCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 15,
    flex: 1,
    minWidth: 100,
    alignItems: "center",
  },
  infoLabel: { fontSize: 12, color: "#999", marginBottom: 5, textTransform: "uppercase" },
  infoValue: { fontSize: 16, fontWeight: "bold", color: "#333" },

  locationText: { fontSize: 16, fontWeight: "600", color: "#333", marginBottom: 5 },
  locationSubtext: { fontSize: 14, color: "#666" },

  statsGrid: { flexDirection: "row", justifyContent: "space-around", gap: 15 },
  statCard: { alignItems: "center", flex: 1 },
  statNumber: { fontSize: 24, fontWeight: "bold", color: "#007AFF", marginBottom: 5 },
  statLabel: { fontSize: 12, color: "#666", textAlign: "center" },
  starsText: { fontSize: 12, marginTop: 2 },

  accountInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  accountLabel: { fontSize: 14, color: "#666" },
  accountValue: { fontSize: 14, fontWeight: "600", color: "#333" },

  buttonSection: { gap: 15, marginTop: 20, marginBottom: 40 },

  // ── My Gyms button ──────────────────────────────────────
  gymsButton: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#6366F1",
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  gymsButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  gymsButtonIcon: { fontSize: 28 },
  gymsButtonTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6366F1",
    marginBottom: 2,
  },
  gymsButtonSub: {
    fontSize: 12,
    color: "#6B7280",
  },
  gymsButtonArrow: {
    fontSize: 24,
    color: "#6366F1",
    marginLeft: "auto",
    fontWeight: "300",
  },
  buttonPressed: { opacity: 0.85 },
  // ────────────────────────────────────────────────────────

  editButton: {
    backgroundColor: "#28A745",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteButton: {
    backgroundColor: "#DC3545",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  backButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#ccc" },
  buttonText: { color: "white", fontSize: 16, fontWeight: "bold" },
  errorText: { fontSize: 16, color: "red", textAlign: "center" },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
  },
});

export default TrainerProfile;