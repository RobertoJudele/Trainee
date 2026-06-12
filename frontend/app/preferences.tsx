import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { theme, typography } from "../src/lib/theme";
import { GradientButton } from "../src/components/ui";
import { useGetSpecializationsQuery, SpecializationItem } from "../features/trainer/trainerApiSlice";
import { useGetAllGymsQuery, GymMarker } from "../features/gym/gymApiSlice";
import {
  useGetMyPreferencesQuery,
  useUpdateMyPreferencesMutation,
  FitnessLevel,
  RateType,
} from "../features/recommendations/recommendationApiSlice";

const GOAL_OPTIONS = [
  "Weight loss",
  "Muscle gain",
  "Endurance",
  "Flexibility",
  "Rehab",
  "General fitness",
];

const FITNESS_LEVEL_OPTIONS: { value: FitnessLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "expert", label: "Expert" },
];

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

export default function PreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: preferencesResponse, isLoading: preferencesLoading } = useGetMyPreferencesQuery();
  const [updatePreferences, { isLoading: isSaving }] = useUpdateMyPreferencesMutation();
  const { data: specializationResponse, isLoading: specializationsLoading } = useGetSpecializationsQuery();
  const { data: gymsResponse, isLoading: gymsLoading } = useGetAllGymsQuery();

  const specializationOptions = specializationResponse?.data ?? [];
  const gymOptions = gymsResponse?.data ?? [];

  const [selectedSpecializationIds, setSelectedSpecializationIds] = useState<number[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [rateType, setRateType] = useState<RateType>("session");
  const [maxDistanceKm, setMaxDistanceKm] = useState("");
  const [preferredGymId, setPreferredGymId] = useState<number | null>(null);
  const [selectedGymLabel, setSelectedGymLabel] = useState<string | null>(null);
  const [gymSearch, setGymSearch] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [showAllSpecializations, setShowAllSpecializations] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    const prefs = preferencesResponse?.data;
    if (prefs === undefined) return;

    if (prefs) {
      setSelectedSpecializationIds(prefs.preferredSpecializationIds ?? []);
      setSelectedGoals(prefs.goals ?? []);
      setFitnessLevel(prefs.fitnessLevel ?? null);
      setBudgetMin(prefs.budgetMin != null ? String(prefs.budgetMin) : "");
      setBudgetMax(prefs.budgetMax != null ? String(prefs.budgetMax) : "");
      setRateType(prefs.preferredRateType ?? "session");
      setMaxDistanceKm(prefs.maxDistanceKm != null ? String(prefs.maxDistanceKm) : "");
      setPreferredGymId(prefs.preferredGymId ?? null);
      if (prefs.gym) {
        setSelectedGymLabel(`${prefs.gym.name} · ${[prefs.gym.city, prefs.gym.state].filter(Boolean).join(", ")}`);
      }
    }
    setHydrated(true);
  }, [preferencesResponse, hydrated]);

  const toggleSpecialization = (id: number) => {
    setSelectedSpecializationIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const selectGym = (gym: GymMarker) => {
    setPreferredGymId(gym.id);
    setSelectedGymLabel(`${gym.name} · ${[gym.city, gym.state].filter(Boolean).join(", ")}`);
    setGymSearch("");
  };

  const clearGym = () => {
    setPreferredGymId(null);
    setSelectedGymLabel(null);
  };

  const filteredGyms = gymSearch.trim()
    ? gymOptions.filter((g) =>
        `${g.name} ${g.city}`.toLowerCase().includes(gymSearch.trim().toLowerCase())
      )
    : gymOptions;

  const selectedGym = gymOptions.find((g) => g.id === preferredGymId) ?? null;

  const nearestGymsToSelected = selectedGym
    ? gymOptions
        .filter((g) => g.id !== selectedGym.id)
        .slice()
        .sort(
          (a, b) =>
            haversineKm(selectedGym.latitude, selectedGym.longitude, a.latitude, a.longitude) -
            haversineKm(selectedGym.latitude, selectedGym.longitude, b.latitude, b.longitude)
        )
        .slice(0, 5)
    : [];

  const displayedGyms = gymSearch.trim()
    ? filteredGyms
    : selectedGym
    ? nearestGymsToSelected
    : filteredGyms.slice(0, 5);

  const visibleSpecializations = showAllSpecializations
    ? specializationOptions
    : specializationOptions.slice(0, 4);

  const handleSave = async () => {
    const minVal = budgetMin.trim() ? parseFloat(budgetMin) : null;
    const maxVal = budgetMax.trim() ? parseFloat(budgetMax) : null;
    const distanceVal = maxDistanceKm.trim() ? parseFloat(maxDistanceKm) : null;

    if (minVal !== null && isNaN(minVal)) {
      Alert.alert("Invalid input", "Budget minimum must be a number.");
      return;
    }
    if (maxVal !== null && isNaN(maxVal)) {
      Alert.alert("Invalid input", "Budget maximum must be a number.");
      return;
    }
    if (distanceVal !== null && isNaN(distanceVal)) {
      Alert.alert("Invalid input", "Max distance must be a number.");
      return;
    }

    try {
      await updatePreferences({
        preferredSpecializationIds: selectedSpecializationIds,
        goals: selectedGoals,
        fitnessLevel,
        budgetMin: minVal,
        budgetMax: maxVal,
        preferredRateType: rateType,
        maxDistanceKm: distanceVal,
        preferredGymId,
      }).unwrap();

      Alert.alert("Preferences saved", "We'll use this to personalize your trainer suggestions.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Could not save your preferences. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.tertiary]}
          style={[styles.headerGradient, { paddingTop: Math.max(insets.top + 12, 48) }]}
        >
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Preferences</Text>
          <Text style={styles.headerSubtitle}>Tell us what you're looking for so we can suggest the right trainers</Text>
        </LinearGradient>

        {preferencesLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <View style={styles.form}>
            {/* Specializations */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Specializations</Text>
              <Text style={styles.sectionHint}>What kind of training are you interested in?</Text>
              {specializationsLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <View style={styles.chipGrid}>
                    {visibleSpecializations.map((spec: SpecializationItem) => {
                      const active = selectedSpecializationIds.includes(spec.id);
                      return (
                        <Pressable
                          key={spec.id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => toggleSpecialization(spec.id)}
                          accessible
                          accessibilityRole="button"
                          accessibilityLabel={spec.name}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{spec.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {specializationOptions.length > 4 ? (
                    <Pressable
                      style={styles.showMoreButton}
                      onPress={() => setShowAllSpecializations((prev) => !prev)}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={showAllSpecializations ? "Show less" : "Show more specializations"}
                    >
                      <Text style={styles.showMoreText}>
                        {showAllSpecializations
                          ? "Show less"
                          : `Show more (+${specializationOptions.length - 4})`}
                      </Text>
                      <Ionicons
                        name={showAllSpecializations ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={theme.colors.primary}
                      />
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>

            {/* Goals */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Goals</Text>
              <Text style={styles.sectionHint}>What do you want to achieve?</Text>
              <View style={styles.chipGrid}>
                {GOAL_OPTIONS.map((goal) => {
                  const active = selectedGoals.includes(goal);
                  return (
                    <Pressable
                      key={goal}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleGoal(goal)}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={goal}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{goal}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Fitness level */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Fitness Level</Text>
              <Text style={styles.sectionHint}>Helps us match you with trainers at the right level</Text>
              <View style={styles.segmentRow}>
                {FITNESS_LEVEL_OPTIONS.map((opt) => {
                  const active = fitnessLevel === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      style={[styles.segment, active && styles.segmentActive]}
                      onPress={() => setFitnessLevel(active ? null : opt.value)}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={opt.label}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Budget */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Budget</Text>
              <Text style={styles.sectionHint}>Your preferred price range</Text>
              <View style={styles.segmentRow}>
                {(["session", "hourly"] as RateType[]).map((type) => {
                  const active = rateType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.segment, active && styles.segmentActive]}
                      onPress={() => setRateType(type)}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={type === "hourly" ? "Hourly rate" : "Per session rate"}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {type === "hourly" ? "Hourly" : "Per session"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Text style={styles.label}>Min ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={budgetMin}
                    onChangeText={setBudgetMin}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Text style={styles.label}>Max ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={budgetMax}
                    onChangeText={setBudgetMax}
                    placeholder="100"
                    keyboardType="numeric"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                </View>
              </View>
            </View>

            {/* Preferred gym */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Preferred Gym</Text>
              <Text style={styles.sectionHint}>
                We'll prioritize trainers who work at this gym, and use its location for distance matching
              </Text>

              {selectedGymLabel ? (
                <View style={styles.selectedGym}>
                  <Ionicons name="business" size={18} color={theme.colors.primary} />
                  <Text style={styles.selectedGymText} numberOfLines={1}>{selectedGymLabel}</Text>
                  <Pressable
                    onPress={clearGym}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="Clear preferred gym"
                  >
                    <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                  </Pressable>
                </View>
              ) : null}

              <TextInput
                style={styles.input}
                value={gymSearch}
                onChangeText={setGymSearch}
                placeholder="Search gyms by name or city..."
                placeholderTextColor={theme.colors.textSecondary}
              />

              {gymsLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: theme.spacing.sm }} />
              ) : (
                <View style={styles.gymList}>
                  {!gymSearch.trim() && selectedGym ? (
                    <Text style={styles.sectionHint}>Gyms closest to {selectedGym.name}</Text>
                  ) : null}
                  {displayedGyms.map((gym) => {
                    const active = preferredGymId === gym.id;
                    return (
                      <Pressable
                        key={gym.id}
                        style={[styles.gymRow, active && styles.gymRowActive]}
                        onPress={() => selectGym(gym)}
                        accessible
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${gym.name}`}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.gymName}>{gym.name}</Text>
                          <Text style={styles.gymLocation}>
                            {[gym.city, gym.state].filter(Boolean).join(", ")}
                          </Text>
                        </View>
                        {active ? <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} /> : null}
                      </Pressable>
                    );
                  })}
                  {gymSearch.trim() && filteredGyms.length === 0 ? (
                    <Text style={styles.sectionHint}>No gyms found</Text>
                  ) : null}
                </View>
              )}
            </View>

            {/* Max distance */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Max Distance from Gym (km)</Text>
              <Text style={styles.sectionHint}>
                Used as a fallback when a trainer doesn't work at your preferred gym
              </Text>
              <TextInput
                style={styles.input}
                value={maxDistanceKm}
                onChangeText={setMaxDistanceKm}
                placeholder="50"
                keyboardType="numeric"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            <GradientButton
              title="Save Preferences"
              onPress={handleSave}
              loading={isSaving}
              style={{ marginTop: theme.spacing.md }}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: theme.spacing.xxl },
  headerGradient: {
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...theme.shadows.medium,
  },
  backButton: {
    position: "absolute",
    top: 0,
    left: 16,
    padding: 8,
    marginTop: 48,
  },
  headerTitle: { ...typography.h2, color: "#fff", marginTop: theme.spacing.xl, marginBottom: theme.spacing.xs },
  headerSubtitle: { ...typography.body2, color: "rgba(255,255,255,0.85)" },

  loadingContainer: { paddingVertical: theme.spacing.xxl, alignItems: "center" },

  form: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  section: { gap: theme.spacing.sm },
  sectionTitle: { ...typography.h3, color: theme.colors.text },
  sectionHint: { ...typography.body2, color: theme.colors.textSecondary },

  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: { ...typography.body2, color: theme.colors.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  showMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  showMoreText: { ...typography.body2, color: theme.colors.primary, fontWeight: "600" },

  segmentRow: { flexDirection: "row", gap: theme.spacing.sm },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
    backgroundColor: theme.colors.surface,
  },
  segmentActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  segmentText: { ...typography.body2, color: theme.colors.text, fontWeight: "600" },
  segmentTextActive: { color: "#fff" },

  row: { flexDirection: "row", gap: theme.spacing.md },
  halfWidth: { flex: 1, gap: theme.spacing.xs },
  label: { ...typography.body2, color: theme.colors.text, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    ...typography.body1,
    color: theme.colors.text,
  },

  selectedGym: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  selectedGymText: { ...typography.body2, color: theme.colors.text, flex: 1, fontWeight: "600" },

  gymList: { gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  gymRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  gymRowActive: { borderColor: theme.colors.primary },
  gymName: { ...typography.body2, color: theme.colors.text, fontWeight: "700" },
  gymLocation: { ...typography.caption, color: theme.colors.textSecondary, textTransform: "none" },
});
