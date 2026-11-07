import { useCallback, useRef, useState } from "react";
import { useCreateTrainerMutation } from "./usersApiSlicet";
import { useDispatch, useSelector } from "react-redux";
import { selectCurrentToken, selectCurrentTrainer, selectCurrentUser, setCredentials, setTrainerProfile } from "../../features/auth/authSlice";
import { requestTrainerTour } from "../../features/onboarding/onboardingSlice";
import { router } from "expo-router";
import { useGetProfileQuery } from "./usersApiSlicet";
import ScreenHeader from "../../src/components/ScreenHeader";
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
  ActivityIndicator,
  Alert,
} from "react-native";
import React from "react";
import { theme, typography, presets } from "../../src/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../src/lib/i18n/LanguageContext";
import { ApiEnvelope, TrainerProfileAttributes } from "../../src/types/api";
import { fonts } from "../../src/lib/fonts";
import { FieldError } from "../../src/components/ui";
import { useFieldErrors } from "../../src/lib/useFieldErrors";
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
  // Keys: bio, exp, specs, city, county, country, and pkg{i}.{name|price|sessionCount}.
  const fieldErrors = useFieldErrors<string>();
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
    fieldErrors.clear("specs");
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
    // Package messages are keyed by row index, which just shifted.
    fieldErrors.setAll(
      Object.fromEntries(Object.entries(fieldErrors.errors).filter(([k]) => !k.startsWith("pkg")))
    );
  }, [fieldErrors]);

  const updatePackageField = useCallback(
    (index: number, field: "name" | "price" | "sessionCount", value: string) => {
      fieldErrors.clear(`pkg${index}.${field}`);
      setPackages((prev) =>
        prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
      );
    },
    []
  );

  // Collects every problem at once so each shows under its own field.
  const validateForm = () => {
    const next: Record<string, string> = {};
    if (!bio.trim()) next.bio = t("bioIsRequired");
    if (!exp.trim()) next.exp = t("experienceIsRequired");
    if (selectedSpecializationIds.length === 0) next.specs = t("invalidSpecializations");
    packages.forEach((pkg, i) => {
      if (!pkg.name.trim()) next[`pkg${i}.name`] = t("packageNameRequired");
      if (!pkg.price.trim() || isNaN(parseFloat(pkg.price)) || parseFloat(pkg.price) <= 0) {
        next[`pkg${i}.price`] = t("packagePriceRequired");
      }
      if (!pkg.sessionCount.trim() || isNaN(parseInt(pkg.sessionCount)) || parseInt(pkg.sessionCount) < 1) {
        next[`pkg${i}.sessionCount`] = t("sessionCountRequired");
      }
    });
    if (city.trim().length < 2) next.city = t("cityIsRequired");
    if (!county.trim()) next.county = t("countyIsRequired");
    else if (county.trim().length < 2) next.county = t("countyMinLength");
    if (!country.trim()) next.country = t("countryIsRequired");
    else if (country.trim().length < 2) next.country = t("countryMinLength");
    return fieldErrors.setAll(next);
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

      const responseData = (result as ApiEnvelope<{ data?: TrainerProfileAttributes }>)?.data?.data;
      if (responseData && user) {
        dispatch(setTrainerProfile(responseData));
        dispatch(setCredentials({ user: { ...user, role: "trainer" }, token: token || "" }));
        // Scoped to this user: an unfinished tour used to leave a global flag
        // that started the trainer walkthrough for whoever signed in next.
        dispatch(requestTrainerTour(user.id));

        // .unwrap() so a rejected package reaches a catch. Without it RTK Query
        // resolves with { error } and the failure vanished — the trainer landed
        // on the home screen believing packages they had typed were saved.
        // Caught separately from the profile: the profile is already created, so
        // the only honest thing left is to say the packages are not.
        try {
          for (const pkg of packages) {
            await createPackage({
              name: pkg.name.trim(),
              price: parseFloat(pkg.price),
              sessionCount: parseInt(pkg.sessionCount),
            }).unwrap();
          }
        } catch (packageError) {
          console.error("Package creation failed after trainer signup", packageError);
          Alert.alert(t("myPackages"), t("packagesNotSaved"));
        }
      }

      router.replace("/");
    } catch (error: unknown) {
      const err =
        typeof error === "object" && error !== null
          ? (error as Record<string, unknown>)
          : null;
      if (!err || !err.originalStatus) {
        setErrMsg(t("couldNotLoadTrainer"));
      } else {
        const resp = (err as { response?: { status?: number } }).response;
        if (resp?.status === 400) {
          setErrMsg(t("invalidInput"));
        } else if (resp?.status === 401) {
          setErrMsg(t("mustBeLoggedIn"));
        } else {
          setErrMsg(t("updateError"));
        }
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
          <ScreenHeader
            title={t("createTrainerProfile")}
            subtitle={t("createTrainerSubtitle")}
          />

          <View style={styles.form}>
            {/* Bio Section */}
            <View style={styles.section}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
                <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{t("aboutYou")}</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("bioRequired")}</Text>
                <TextInput
                  style={[styles.input, styles.textArea, fieldErrors.errors.bio && presets.inputError]}
                  value={bio}
                  placeholder={t("bioPlaceholderLong")}
                  onChangeText={(v) => { fieldErrors.clear("bio"); setBio(v); }}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <FieldError message={fieldErrors.errors.bio} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("experienceRequired")}</Text>
                <TextInput
                  style={[styles.input, fieldErrors.errors.exp && presets.inputError]}
                  value={exp}
                  placeholder={t("experiencePlaceholderLong")}
                  onChangeText={(v) => { fieldErrors.clear("exp"); setExp(v); }}
                  keyboardType="number-pad"
                />
                <FieldError message={fieldErrors.errors.exp} />
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
                  <ActivityIndicator size="small" color={theme.colors.primary} />
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
                    accessibilityLabel={t("retry")}
                  >
                    {specializationsFetching ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.specRetryText}>{t("retry")}</Text>
                    )}
                  </Pressable>
                </View>
              )}
              <FieldError message={fieldErrors.errors.specs} />
            </View>

            {/* Packages Section */}
            <View style={styles.section}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                <Ionicons name="cash-outline" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
                <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{t("myPackages")}</Text>
              </View>

              {packages.map((pkg, index) => (
                <View key={index} style={{marginBottom: 16, padding: 16, backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.control}}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                    <Text style={{fontSize: 14, fontFamily: fonts.uiSemiBold, color: theme.colors.text}}>
                      {t("addPackage")} {index + 1}
                    </Text>
                    {packages.length > 1 && (
                      <Pressable onPress={() => removePackageRow(index)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("a11yRemovePackage")}>
                        <Ionicons name="trash-outline" size={20} color="#DC2626" />
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t("packageName")}</Text>
                    <TextInput
                      style={[styles.input, fieldErrors.errors[`pkg${index}.name`] && presets.inputError]}
                      value={pkg.name}
                      placeholder="e.g. Starter Pack"
                      onChangeText={(v) => updatePackageField(index, "name", v)}
                    />
                    <FieldError message={fieldErrors.errors[`pkg${index}.name`]} />
                  </View>
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, styles.halfWidth]}>
                      <Text style={styles.label}>{t("packagePrice")}</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.errors[`pkg${index}.price`] && presets.inputError]}
                        value={pkg.price}
                        placeholder="120"
                        onChangeText={(v) => updatePackageField(index, "price", v)}
                        keyboardType="numeric"
                      />
                      <FieldError message={fieldErrors.errors[`pkg${index}.price`]} />
                    </View>
                    <View style={[styles.inputGroup, styles.halfWidth]}>
                      <Text style={styles.label}>{t("sessionCount")}</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.errors[`pkg${index}.sessionCount`] && presets.inputError]}
                        value={pkg.sessionCount}
                        placeholder="4"
                        onChangeText={(v) => updatePackageField(index, "sessionCount", v)}
                        keyboardType="number-pad"
                      />
                      <FieldError message={fieldErrors.errors[`pkg${index}.sessionCount`]} />
                    </View>
                  </View>
                </View>
              ))}

              {packages.length < 5 && (
                <Pressable
                  onPress={addPackageRow}
                  style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: theme.radius.control, borderWidth: 1.5, borderColor: theme.colors.primary, borderStyle: 'dashed'}}
                >
                  <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
                  <Text style={{color: theme.colors.primary, fontFamily: fonts.uiSemiBold }}>{t("addPackage")}</Text>
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
                  style={[styles.input, fieldErrors.errors.city && presets.inputError]}
                  value={city}
                  placeholder={t("enterYourCity")}
                  onChangeText={(v) => { fieldErrors.clear("city"); setCity(v); }}
                />
                <FieldError message={fieldErrors.errors.city} />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t("countyRequired")}</Text>
                  <TextInput
                    style={[styles.input, fieldErrors.errors.county && presets.inputError]}
                    value={county}
                    placeholder={t("countyState")}
                    onChangeText={(v) => { fieldErrors.clear("county"); setCounty(v); }}
                  />
                  <FieldError message={fieldErrors.errors.county} />
                </View>

                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t("countryRequired")}</Text>
                  <TextInput
                    style={[styles.input, fieldErrors.errors.country && presets.inputError]}
                    value={country}
                    placeholder={t("country")}
                    onChangeText={(v) => { fieldErrors.clear("country"); setCountry(v); }}
                  />
                  <FieldError message={fieldErrors.errors.country} />
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

              {/* Next to the button: on this long form the field messages can be
                  off screen when the user taps it. */}
              <FieldError message={fieldErrors.hasErrors ? t("fixHighlightedFields") : undefined} />
              {errMsg ? (
                <View style={styles.errorContainer}>
                  <Text ref={errRef} style={styles.errorText}>
                    {errMsg}
                  </Text>
                </View>
              ) : null}

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
    fontFamily: fonts.ui,
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    ...presets.input,
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
    fontFamily: fonts.ui,
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  button: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: theme.radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: theme.colors.textDisabled, // keeps the white label visible
  },
  buttonText: {
    ...typography.button,
    color: "#fff",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerText: {
    fontFamily: fonts.ui,
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
    ...typography.small,
    color: theme.colors.textSecondary,
  },
  specFallbackBox: {
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  specFallbackText: {
    ...typography.small,
    color: theme.colors.textSecondary,
  },
  specRetryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: theme.radius.control,
    minWidth: 84,
    alignItems: "center",
  },
  specRetryText: {
    ...typography.button,
    fontSize: 14,
    color: "#fff",
  },
  specGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  specChip: {
    ...presets.chip,
  },
  specChipActive: {
    ...presets.chipSelected,
  },
  specChipText: {
    ...presets.chipText,
  },
  specChipTextActive: {
    ...presets.chipTextSelected,
  },
});
