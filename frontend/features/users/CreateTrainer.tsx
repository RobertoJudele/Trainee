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
import { useCreateTrainerPackageMutation } from "../trainer/trainerPackageApiSlice";
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
import { useLanguage } from "../../src/lib/i18n/LanguageContext";
export default function CreateTrainer() {
  const { t } = useLanguage();
  const [bio, setBio] = useState("");
  const [exp, setExp] = useState("");
  const [packages, setPackages] = useState<Array<{ name: string; price: string; sessionCount: string }>>([
    { name: "", price: "", sessionCount: "" },
  ]);
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
  const [createPackage] = useCreateTrainerPackageMutation();
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

  const addPackageRow = useCallback(() => {
    if (packages.length >= 5) return;
    setPackages((prev) => [...prev, { name: "", price: "", sessionCount: "" }]);
  }, [packages.length]);

  const removePackageRow = useCallback((index: number) => {
    setPackages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updatePackageField = useCallback(
    (index: number, field: "name" | "price" | "sessionCount", value: string) => {
      setPackages((prev) =>
        prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
      );
    },
    []
  );

  const validateForm = () => {
    if (!bio.trim()) {
      setErrMsg(t("bioIsRequired"));
      return false;
    }
    if (!exp.trim()) {
      setErrMsg(t("experienceIsRequired"));
      return false;
    }
    if (packages.length === 0) {
      setErrMsg(t("packageNameRequired"));
      return false;
    }
    for (const pkg of packages) {
      if (!pkg.name.trim()) {
        setErrMsg(t("packageNameRequired"));
        return false;
      }
      if (!pkg.price.trim() || isNaN(parseFloat(pkg.price)) || parseFloat(pkg.price) <= 0) {
        setErrMsg(t("packagePriceRequired"));
        return false;
      }
      if (!pkg.sessionCount.trim() || isNaN(parseInt(pkg.sessionCount)) || parseInt(pkg.sessionCount) < 1) {
        setErrMsg(t("sessionCountRequired"));
        return false;
      }
    }
    if (!city.trim()) {
      setErrMsg(t("cityIsRequired"));
      return false;
    }
    if (!county.trim()) {
      setErrMsg(t("countyIsRequired"));
      return false;
    }
    if (!country.trim()) {
      setErrMsg(t("countryIsRequired"));
      return false;
    }
    if (country.trim().length < 2) {
      setErrMsg(t("countryMinLength"));
      return false;
    }
    if (county.trim().length < 2) {
      setErrMsg(t("countryMinLength"));
      return false;
    }
    if (city.trim().length < 2) {
      setErrMsg(t("cityIsRequired"));
      return false;
    }
    if (selectedSpecializationIds.length === 0) {
      setErrMsg(t("invalidSpecializations"));
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
        locationCity: city.trim(),
        locationState: county.trim(),
        locationCountry: country.trim(),
        specializationIds: selectedSpecializationIds,
      };

      const result = await creatingTrainer(trainerData);

      const responseData = (result as any)?.data?.data;
      if (responseData && user) {
        dispatch(setTrainerProfile(responseData));
        dispatch(setCredentials({ user: { ...user, role: "trainer" }, token: token || "" }));
        dispatch(requestTrainerTour());

        for (const pkg of packages) {
          await createPackage({
            name: pkg.name.trim(),
            price: parseFloat(pkg.price),
            sessionCount: parseInt(pkg.sessionCount),
          });
        }
      }

      Alert.alert(
        t("trainerCreated"),
        t("freeTrialPrompt"),
        [
          {
            text: t("maybeLater"),
            style: "cancel",
            onPress: () => router.replace("/"),
          },
          {
            text: t("startFreeTrial"),
            onPress: () => router.replace("/checkout?onboarding=1"),
          },
        ]
      );
    } catch (error: any) {
      if (!error.originalStatus) {
        setErrMsg(t("couldNotLoadTrainer"));
      } else if (error.response?.status === 400) {
        setErrMsg(t("invalidInput"));
      } else if (error.response?.status === 401) {
        setErrMsg(t("mustBeLoggedIn"));
      } else {
        setErrMsg(t("updateError"));
      }
      errRef.current;
    }
  }, [
    bio,
    packages,
    city,
    country,
    county,
    exp,
    selectedSpecializationIds,
    creatingTrainer,
    createPackage,
    dispatch,
  ]);
  if (!user) {
    return (
      <View style={styles.buttonContainer}>
        <Text style={styles.row}>
          {t("mustBeLoggedIn")}
        </Text>
        <Pressable style={styles.button} onPress={() => router.push("/(auth)/login")}>
          <Text>
            {t("logInToGetStarted")}
          </Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text>
            {t("back")}
          </Text>
        </Pressable>
      </View>
    );
  }

  else if (trainer) {
    return (
      <View style={styles.buttonContainer}>
        <Text style={styles.row}>
          {t("alreadyHaveTrainer")}
        </Text>
        <Pressable style={styles.button} onPress={() => router.push("/TrainerProfile")}>
          <Text>
            {t("goToTrainerProfile")}
          </Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text>
            {t("back")}
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
              <Text style={[styles.title, {marginBottom: 0}]}>{t("createTrainerProfile")}</Text>
            </View>
            <Text style={styles.subtitle}>
              {t("createTrainerSubtitle")}
            </Text>
          </View>

          <View style={styles.form}>
            {/* Error Message */}
            {errMsg ? (
              <View style={styles.errorContainer}>
                <Text ref={errRef} style={styles.errorText}>
                  {errMsg}
                </Text>
              </View>
            ) : null}

            {/* Bio Section */}
            <View style={styles.section}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
                <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{t("aboutYou")}</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("bioRequired")}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bio}
                  placeholder={t("bioPlaceholderLong")}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("experienceRequired")}</Text>
                <TextInput
                  style={styles.input}
                  value={exp}
                  placeholder={t("experiencePlaceholderLong")}
                  onChangeText={setExp}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Specializations Section */}
            <View style={styles.section}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                <Ionicons name="pricetags-outline" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
                <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{t("specializationsRequired")}</Text>
              </View>
              {specializationsLoading ? (
                <View style={styles.specLoadingRow}>
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text style={styles.specLoadingText}>{t("loadingSpecializations")}</Text>
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
                    {t("couldNotLoadSpecs")}
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
                      <Text style={styles.specRetryText}>{t("retry")}</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>

            {/* Packages Section */}
            <View style={styles.section}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                <Ionicons name="cash-outline" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
                <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{t("myPackages")}</Text>
              </View>

              {packages.map((pkg, index) => (
                <View key={index} style={{marginBottom: 16, padding: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border}}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                    <Text style={{fontSize: 14, fontWeight: '600', color: theme.colors.text}}>
                      {t("addPackage")} {index + 1}
                    </Text>
                    {packages.length > 1 && (
                      <Pressable onPress={() => removePackageRow(index)}>
                        <Ionicons name="trash-outline" size={20} color="#DC2626" />
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t("packageName")}</Text>
                    <TextInput
                      style={styles.input}
                      value={pkg.name}
                      placeholder="e.g. Starter Pack"
                      onChangeText={(v) => updatePackageField(index, "name", v)}
                    />
                  </View>
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, styles.halfWidth]}>
                      <Text style={styles.label}>{t("packagePrice")}</Text>
                      <TextInput
                        style={styles.input}
                        value={pkg.price}
                        placeholder="120"
                        onChangeText={(v) => updatePackageField(index, "price", v)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={[styles.inputGroup, styles.halfWidth]}>
                      <Text style={styles.label}>{t("sessionCount")}</Text>
                      <TextInput
                        style={styles.input}
                        value={pkg.sessionCount}
                        placeholder="4"
                        onChangeText={(v) => updatePackageField(index, "sessionCount", v)}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                </View>
              ))}

              {packages.length < 5 && (
                <Pressable
                  onPress={addPackageRow}
                  style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, borderStyle: 'dashed'}}
                >
                  <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
                  <Text style={{color: theme.colors.primary, fontWeight: '600'}}>{t("addPackage")}</Text>
                </Pressable>
              )}
            </View>

            {/* Location Section */}
            <View style={styles.section}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                <Ionicons name="location" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
                <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{t("location")}</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("cityRequired")}</Text>
                <TextInput
                  style={styles.input}
                  value={city}
                  placeholder={t("enterYourCity")}
                  onChangeText={setCity}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t("countyRequired")}</Text>
                  <TextInput
                    style={styles.input}
                    value={county}
                    placeholder={t("countyState")}
                    onChangeText={setCounty}
                  />
                </View>

                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t("countryRequired")}</Text>
                  <TextInput
                    style={styles.input}
                    value={country}
                    placeholder={t("country")}
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
                    <Text style={styles.buttonText}>{t("creatingProfile")}</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>{t("createTrainerButton")}</Text>
                )}
              </Pressable>

              <Text style={styles.footerText}>
                {t("requiredFields")}
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
