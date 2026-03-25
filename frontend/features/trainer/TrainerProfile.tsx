import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
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
  useGetSpecializationsQuery,
  useUpdateTrainerProfileMutation,
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
  } = useGetTrainerProfileQuery();
  const {
    data: specializationsResponse,
    isLoading: isSpecializationsLoading,
    refetch: refetchSpecializations,
  } = useGetSpecializationsQuery();
  const specializationOptions = useMemo(() => {
    const fetched = specializationsResponse?.data ?? [];
    if (fetched.length > 0) {
      return fetched;
    }

    const trainerSpecs = trainer?.specializations ?? [];
    return trainerSpecs.map((spec) => ({
      id: spec.id,
      name: spec.name,
      description: spec.description,
      iconUrl: spec.iconUrl,
      isActive: true,
    }));
  }, [specializationsResponse, trainer]);

  const [deleteTrainerProfile, { isLoading: isDeleting }] =
    useDeleteTrainerProfileMutation();
  const [updateTrainerProfile, { isLoading: isUpdating }] =
    useUpdateTrainerProfileMutation();

  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [sessionRate, setSessionRate] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationState, setLocationState] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [selectedSpecializationIds, setSelectedSpecializationIds] = useState<number[]>([]);

  useEffect(() => {
    if (trainerResponse?.data) {
      dispatch(setTrainerProfile(trainerResponse.data));
    }
  }, [trainerResponse, dispatch]);

  useEffect(() => {
    if (!trainer) return;
    setBio(trainer.bio ?? "");
    setExperienceYears(
      trainer.experienceYears !== undefined ? String(trainer.experienceYears) : ""
    );
    setHourlyRate(
      trainer.hourlyRate !== undefined ? String(trainer.hourlyRate) : ""
    );
    setSessionRate(
      trainer.sessionRate !== undefined ? String(trainer.sessionRate) : ""
    );
    setLocationCity(trainer.locationCity ?? "");
    setLocationState(trainer.locationState ?? "");
    setLocationCountry(trainer.locationCountry ?? "");
    setSelectedSpecializationIds(
      Array.isArray(trainer.specializations)
        ? trainer.specializations.map((spec) => spec.id)
        : []
    );
  }, [trainer]);

  const toggleSpecialization = useCallback((id: number) => {
    setSelectedSpecializationIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  }, []);

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

  const handleSaveProfile = useCallback(async () => {
    if (!trainer) return;

    const parsedExperience =
      experienceYears.trim() === "" ? undefined : Number(experienceYears);
    const parsedHourly = hourlyRate.trim() === "" ? undefined : Number(hourlyRate);
    const parsedSession =
      sessionRate.trim() === "" ? undefined : Number(sessionRate);

    if (
      parsedExperience !== undefined &&
      (!Number.isFinite(parsedExperience) || parsedExperience < 0)
    ) {
      Alert.alert("Invalid input", "Experience years must be 0 or greater.");
      return;
    }

    if (parsedHourly !== undefined && (!Number.isFinite(parsedHourly) || parsedHourly < 0)) {
      Alert.alert("Invalid input", "Hourly rate must be 0 or greater.");
      return;
    }

    if (
      parsedSession !== undefined &&
      (!Number.isFinite(parsedSession) || parsedSession < 0)
    ) {
      Alert.alert("Invalid input", "Session rate must be 0 or greater.");
      return;
    }

    if (selectedSpecializationIds.length === 0) {
      Alert.alert("Invalid input", "Select at least one specialization.");
      return;
    }

    try {
      const response = await updateTrainerProfile({
        bio: bio.trim() || undefined,
        experienceYears: parsedExperience,
        hourlyRate: parsedHourly,
        sessionRate: parsedSession,
        locationCity: locationCity.trim() || undefined,
        locationState: locationState.trim() || undefined,
        locationCountry: locationCountry.trim() || undefined,
        specializationIds: selectedSpecializationIds,
      }).unwrap();

      if (response?.data) {
        dispatch(setTrainerProfile(response.data));
      }
      setIsEditing(false);
      Alert.alert("Success", "Trainer profile updated.");
    } catch (error: any) {
      const message = error?.data?.message || "Failed to update profile";
      Alert.alert("Error", message);
    }
  }, [
    trainer,
    experienceYears,
    hourlyRate,
    sessionRate,
    updateTrainerProfile,
    bio,
    locationCity,
    locationState,
    locationCountry,
    selectedSpecializationIds,
    dispatch,
  ]);

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
        {isEditing ? (
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={bio}
            onChangeText={setBio}
            placeholder="Tell clients about your coaching style"
          />
        ) : (
          <Text style={styles.bioText}>{trainer.bio || "No bio available"}</Text>
        )}
      </View>

      {/* ── Experience & Rates ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Experience & Rates</Text>
        {isEditing ? (
          <View style={styles.editGrid}>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={experienceYears}
              onChangeText={setExperienceYears}
              placeholder="Experience years"
            />
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={hourlyRate}
              onChangeText={setHourlyRate}
              placeholder="Hourly rate"
            />
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={sessionRate}
              onChangeText={setSessionRate}
              placeholder="Session rate"
            />
          </View>
        ) : (
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
        )}
      </View>

      {/* ── Location ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Location</Text>
        {isEditing ? (
          <View style={styles.editGrid}>
            <TextInput
              style={styles.input}
              value={locationCity}
              onChangeText={setLocationCity}
              placeholder="City"
            />
            <TextInput
              style={styles.input}
              value={locationState}
              onChangeText={setLocationState}
              placeholder="State"
            />
            <TextInput
              style={styles.input}
              value={locationCountry}
              onChangeText={setLocationCountry}
              placeholder="Country"
            />
          </View>
        ) : (
          <>
            <Text style={styles.locationText}>
              {trainer.locationCity && trainer.locationState
                ? `${trainer.locationCity}, ${trainer.locationState}`
                : "Location not specified"}
            </Text>
            <Text style={styles.locationSubtext}>
              {trainer.locationCountry || "Country not specified"}
            </Text>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏷️ Specializations</Text>
        {isEditing ? (
          isSpecializationsLoading ? (
            <View style={styles.specLoadingRow}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.specLoadingText}>Loading specializations...</Text>
            </View>
          ) : specializationOptions.length > 0 ? (
            <View style={styles.specGrid}>
              {specializationOptions.map((spec) => {
                const active = selectedSpecializationIds.includes(spec.id);
                return (
                  <Pressable
                    key={spec.id}
                    style={[styles.specChip, active && styles.specChipActive]}
                    onPress={() => toggleSpecialization(spec.id)}
                  >
                    <Text style={[styles.specChipText, active && styles.specChipTextActive]}>
                      {spec.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.specFallbackBox}>
              <Text style={styles.specFallbackText}>
                No specialization options loaded.
              </Text>
              <Pressable
                style={styles.specRetryButton}
                onPress={() => {
                  void refetchSpecializations();
                  void refetch();
                }}
              >
                <Text style={styles.specRetryText}>Retry</Text>
              </Pressable>
            </View>
          )
        ) : trainer.specializations && trainer.specializations.length > 0 ? (
          <View style={styles.specGrid}>
            {trainer.specializations.map((spec) => (
              <View key={spec.id} style={styles.specChipReadOnly}>
                <Text style={styles.specChipReadOnlyText}>{spec.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.locationSubtext}>No specialization selected</Text>
        )}
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
          onPress={() => {
            if (isEditing) {
              void handleSaveProfile();
              return;
            }
            setIsEditing(true);
          }}
          disabled={isUpdating}
        >
          <Text style={styles.buttonText}>
            {isUpdating
              ? "🔄 Saving..."
              : isEditing
              ? "💾 Save Profile"
              : "✏️ Edit Profile"}
          </Text>
        </Pressable>

        {isEditing && (
          <Pressable
            style={styles.cancelButton}
            onPress={() => {
              if (trainer) {
                setBio(trainer.bio ?? "");
                setExperienceYears(
                  trainer.experienceYears !== undefined
                    ? String(trainer.experienceYears)
                    : ""
                );
                setHourlyRate(
                  trainer.hourlyRate !== undefined ? String(trainer.hourlyRate) : ""
                );
                setSessionRate(
                  trainer.sessionRate !== undefined
                    ? String(trainer.sessionRate)
                    : ""
                );
                setLocationCity(trainer.locationCity ?? "");
                setLocationState(trainer.locationState ?? "");
                setLocationCountry(trainer.locationCountry ?? "");
                setSelectedSpecializationIds(
                  Array.isArray(trainer.specializations)
                    ? trainer.specializations.map((spec) => spec.id)
                    : []
                );
              }
              setIsEditing(false);
            }}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
        )}

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
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  editGrid: {
    gap: 10,
  },
  specGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  specLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  specLoadingText: {
    fontSize: 13,
    color: "#6B7280",
  },
  specFallbackBox: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  specFallbackText: {
    fontSize: 13,
    color: "#6B7280",
  },
  specRetryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#6366F1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  specRetryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  specChip: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  specChipActive: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  specChipText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "600",
  },
  specChipTextActive: {
    color: "#fff",
  },
  specChipReadOnly: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#E5E7EB",
  },
  specChipReadOnlyText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "600",
  },

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
  cancelButton: {
    backgroundColor: "#6B7280",
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