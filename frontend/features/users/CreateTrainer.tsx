import { useCallback, useRef, useState } from "react";
import { useCreateTrainerMutation } from "./usersApiSlicet";
import { useDispatch, useSelector } from "react-redux";
import { selectCurrentToken, selectCurrentTrainer, selectCurrentUser, setCredentials, setTrainerProfile } from "../../features/auth/authSlice";
import { requestTrainerTour } from "../../features/onboarding/onboardingSlice";
import { router } from "expo-router";
import { useGetProfileQuery } from "./usersApiSlicet";
import {
  useGetSpecializationsQuery,
  SpecializationItem,
} from "../trainer/trainerApiSlice";
import {
  KeyboardAvoidingView,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import React from "react";
import { theme, typography } from "../../src/lib/theme";
import { Ionicons } from "@expo/vector-icons";
export default function CreateTrainer() {
  const [bio, setBio] = useState("");
  const [exp, setExp] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [sessionRate, setSessionRate] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState("0");
  const [longitude, setLongitude] = useState("0");
  const [selectedSpecializationIds, setSelectedSpecializationIds] = useState<number[]>([]);
  const user = useSelector(selectCurrentUser);
  const trainer = useSelector(selectCurrentTrainer)
  const errRef = useRef<Text>(null);
  const [errMsg, setErrMsg] = useState("");
  const token = useSelector(selectCurrentToken);
  const [creatingTrainer, { isLoading }] = useCreateTrainerMutation();
  const {
    data: specializationResponse,
    isLoading: specializationsLoading,
    isFetching: specializationsFetching,
    refetch: refetchSpecializations,
  } = useGetSpecializationsQuery();
  const specializationOptions = specializationResponse?.data ?? [];
  const dispatch = useDispatch();

  const toggleSpecialization = useCallback((id: number) => {
    setSelectedSpecializationIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  }, []);

  const validateForm = () => {
    if (!bio.trim()) {
      setErrMsg("Bio is required");
      return false;
    }
    if (!exp.trim()) {
      setErrMsg("Experience is required");
      return false;
    }
    if (!hourlyRate.trim()) {
      setErrMsg("Hourly rate is required");
      return false;
    }
    if (!sessionRate.trim()) {
      setErrMsg("Session rate is required");
      return false;
    }
    if (!city.trim()) {
      setErrMsg("City is required");
      return false;
    }
    if (!county.trim()) {
      setErrMsg("County is required");
      return false;
    }
    if (!country.trim()) {
      setErrMsg("Country is required");
      return false;
    }
    if (country.trim().length < 2) {
      setErrMsg("Country must be at least 2 characters long");
      return false;
    }
    if (county.trim().length < 2) {
      setErrMsg("County must be at least 2 characters long");
      return false;
    }
    if (city.trim().length < 2) {
      setErrMsg("City must be at least 2 characters long");
      return false;
    }
    if (selectedSpecializationIds.length === 0) {
      setErrMsg("Please select at least one specialization");
      return false;
    }

    // Validate rates are numbers
    if (isNaN(parseFloat(hourlyRate)) || parseFloat(hourlyRate) <= 0) {
      setErrMsg("Please enter a valid hourly rate");
      return false;
    }
    if (isNaN(parseFloat(sessionRate)) || parseFloat(sessionRate) <= 0) {
      setErrMsg("Please enter a valid session rate");
      return false;
    }

    return true;
  };

  const handleSubmit = useCallback(async () => {

    if (!validateForm()) {
      return;
    }

    setErrMsg("");

    try {
      const trainerData = {
        bio: bio.trim(),
        experienceYears: parseInt(exp, 10),
        hourlyRate: parseFloat(hourlyRate),
        sessionRate: parseFloat(sessionRate),
        locationCity: city.trim(),
        locationState: county.trim(),
        locationCountry: country.trim(),
        specializationIds: selectedSpecializationIds,
      };
      console.log("Trainer data: ", trainerData);

      const result = await creatingTrainer(trainerData);
      console.log(user);


      const responseData = (result as any)?.data?.data;
      if (responseData && user) {
        dispatch(setTrainerProfile(responseData));
        dispatch(setCredentials({ user: { ...user, role: "trainer" }, token: token || "" }));
        // Queue the trainer onboarding tour for their first trainer-area visit.
        dispatch(requestTrainerTour());
      }

      Alert.alert(
        "You're a trainer now! 🎉",
        "Want to start your 1-month free trial? It's free for the first month, then RON 100/month — cancel anytime. You can also start it later from your profile.",
        [
          {
            text: "Maybe later",
            style: "cancel",
            onPress: () => router.replace("/"),
          },
          {
            text: "Start free trial",
            onPress: () => router.replace("/checkout?onboarding=1"),
          },
        ]
      );
    } catch (error: any) {
      if (!error.originalStatus) {
        setErrMsg("No server response. Please check your connection.");
      } else if (error.response?.status === 400) {
        setErrMsg("Invalid data provided. Please check your inputs.");
      } else if (error.response?.status === 401) {
        setErrMsg("Unauthorized. Please log in again.");
      } else {
        setErrMsg("Failed to create profile. Please try again.");
      }
      errRef.current;
    }
  }, [
    bio,
    hourlyRate,
    sessionRate,
    city,
    country,
    county,
    exp,
    selectedSpecializationIds,
    creatingTrainer,
    dispatch,
  ]);
  if (!user) {
    return (
      <View style={styles.buttonContainer}>
        <Text style={styles.row}>
          You must be logged in to create a trainer profile.
        </Text>
        <Pressable style={styles.button} onPress={() => router.push("/(auth)/login")}>
          <Text>
            Log in or sign up to get started!
          </Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text>
            Back
          </Text>
        </Pressable>
      </View>
    );
  }

  else if (trainer) {
    return (
      <View style={styles.buttonContainer}>
        <Text style={styles.row}>
          You already have a trainer profile.
        </Text>
        <Pressable style={styles.button} onPress={() => router.push("/TrainerProfile")}>
          <Text>
            Go to trainer profile
          </Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text>
            Back
          </Text>
        </Pressable>
      </View>
    );
  }
  else {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8}}>
              <Ionicons name="sparkles" size={24} color={theme.colors.primary} style={{marginRight: 8}} />
              <Text style={[styles.title, {marginBottom: 0}]}>Create Your Trainer Profile</Text>
            </View>
            <Text style={styles.subtitle}>
              Tell us about yourself and start connecting with clients
            </Text>
          </View>

          <View style={styles.form}>
            {/* Error Message */}
            {errMsg ? (
              <View style={styles.errorContainer}>
                <Text ref={errRef} style={styles.errorText}>
                  ⚠️ {errMsg}
                </Text>
              </View>
            ) : null}

            {/* Bio Section */}
            <View style={styles.section}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
                <Text style={[styles.sectionTitle, {marginBottom: 0}]}>About You</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Bio *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bio}
                  placeholder="Tell clients about yourself, your passion for fitness, and what makes you unique..."
                  onChangeText={setBio}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Experience *</Text>
                <TextInput
                  style={styles.input}
                  value={exp}
                  placeholder="Years of experience (e.g. 5)"
                  onChangeText={setExp}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Specializations Section */}
            <View style={styles.section}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                <Ionicons name="pricetags-outline" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
                <Text style={[styles.sectionTitle, {marginBottom: 0}]}>Specializations *</Text>
              </View>
              {specializationsLoading ? (
                <View style={styles.specLoadingRow}>
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text style={styles.specLoadingText}>Loading specializations...</Text>
                </View>
              ) : specializationOptions.length > 0 ? (
                <View style={styles.specGrid}>
                  {specializationOptions.map((spec: SpecializationItem) => {
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
                    Couldn't load specializations. Check your connection and try again.
                  </Text>
                  <Pressable
                    style={styles.specRetryButton}
                    onPress={() => { void refetchSpecializations(); }}
                    disabled={specializationsFetching}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading specializations"
                  >
                    {specializationsFetching ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.specRetryText}>Retry</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>

            {/* Pricing Section */}
            <View style={styles.section}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                <Ionicons name="cash-outline" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
                <Text style={[styles.sectionTitle, {marginBottom: 0}]}>Pricing</Text>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>Hourly Rate * ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={hourlyRate}
                    placeholder="50"
                    onChangeText={setHourlyRate}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>Session Rate * ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={sessionRate}
                    placeholder="75"
                    onChangeText={setSessionRate}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* Location Section */}
            <View style={styles.section}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                <Ionicons name="location" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
                <Text style={[styles.sectionTitle, {marginBottom: 0}]}>Location</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={styles.input}
                  value={city}
                  placeholder="Enter your city"
                  onChangeText={setCity}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>County *</Text>
                  <TextInput
                    style={styles.input}
                    value={county}
                    placeholder="County/State"
                    onChangeText={setCounty}
                  />
                </View>

                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>Country *</Text>
                  <TextInput
                    style={styles.input}
                    value={country}
                    placeholder="Country"
                    onChangeText={setCountry}
                  />
                </View>
              </View>
            </View>

            {/* Submit Button */}
            <View style={styles.buttonContainer}>
              <Pressable
                onPress={handleSubmit}
                disabled={isLoading}
                style={[
                  styles.button,
                  isLoading && styles.buttonDisabled
                ]}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="white" size="small" />
                    <Text style={styles.buttonText}>Creating Profile...</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>Create Trainer Profile</Text>
                )}
              </Pressable>

              <Text style={styles.footerText}>
                * Required fields
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 30,
    backgroundColor: "white",
    borderBottomLeftRadius: theme.roundness,
    borderBottomRightRadius: theme.roundness,
    ...theme.shadows.medium,
  },
  title: {
    ...typography.h2,
    fontWeight: "bold",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  form: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    ...typography.h3,
    color: theme.colors.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    borderRadius: theme.roundness,
    padding: 16,
    ...typography.body1,
    color: theme.colors.text,
    ...theme.shadows.small,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  errorContainer: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "500",
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 18,
    borderRadius: theme.roundness,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.medium,
  },
  buttonDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerText: {
    textAlign: "center",
    marginTop: 16,
    fontSize: 14,
    color: "#6B7280",
    fontStyle: "italic",
  },
  specLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  specLoadingText: {
    color: "#6B7280",
    fontSize: 14,
  },
  specFallbackBox: {
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  specFallbackText: {
    color: "#6B7280",
    fontSize: 14,
  },
  specRetryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 84,
    alignItems: "center",
  },
  specRetryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  specGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
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
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  specChipText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "600",
  },
  specChipTextActive: {
    color: "#fff",
  },
});
