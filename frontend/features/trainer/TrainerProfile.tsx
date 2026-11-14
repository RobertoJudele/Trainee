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
  Dimensions,
  Share,
  Switch,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSelector, useDispatch } from "react-redux";
import {
  selectCurrentTrainer,
  selectCurrentUser,
  setTrainerProfile,
  setCredentials,
  selectCurrentToken,
} from "../auth/authSlice";
import { UserRole } from "../auth/authApiSlice";
import {
  useDeleteTrainerProfileMutation,
  useGetTrainerProfileQuery,
  useGetSpecializationsQuery,
  useUpdateTrainerProfileMutation,
} from "./trainerApiSlice";
import { useDeleteProfileMutation } from "../users/usersApiSlicet";
import { router, useRouter } from "expo-router";
import { apiSlice } from "../../src/api/apiSlice";
import { theme, typography, presets } from "../../src/lib/theme";
import { useTour } from "../../src/components/onboarding/TourContext";
import { trainerTour } from "../../src/components/onboarding/trainerTour";
import { Ionicons } from "@expo/vector-icons";
import EditableAvatar from "../../src/components/EditableAvatar";
import TrainerImageSection from "../../src/components/TrainerImageSection";
import TrainerTransformationSection from "../../src/components/TrainerTransformationSection";
import { useProfilePictureUpload } from "../../src/lib/useProfilePictureUpload";
import { useLanguage } from "../../src/lib/i18n/LanguageContext";
import { getApiErrorMessage } from "../../src/lib/errors";
import {
  normalizeSocialUrlForSave,
  normalizeWhatsAppForSave,
} from "../../src/lib/validation";
import StarRating from "../../src/components/StarRating";
import ProfileMenuModal, { type ProfileMenuItem } from "../../src/components/ProfileMenuModal";
import { useAccountActions } from "../../src/hooks/useAccountActions";
import { useTrainerFormState } from "./hooks/useTrainerFormState";
import { useTrainerImages } from "./hooks/useTrainerImages";
import { useTrainerTransformations, MAX_TRANSFORMATIONS } from "./hooks/useTrainerTransformations";
import {
  useGetTrainerPackagesQuery,
  useCreateTrainerPackageMutation,
  useUpdateTrainerPackageMutation,
  useDeleteTrainerPackageMutation,
  TrainerPackageItem,
} from "./trainerPackageApiSlice";
import { fonts } from "../../src/lib/fonts";
import { FieldError } from "../../src/components/ui";
import { useFieldErrors } from "../../src/lib/useFieldErrors";
import { summarizePrices, formatLei } from "../../src/lib/trainerPage";

const { height: SCREEN_H } = Dimensions.get("window");
const MAX_TRAINER_IMAGES = 5;
/** Long enough for the menu Modal's fade to finish before a native sheet opens. */
const MENU_DISMISS_MS = 350;

function TrainerProfile() {
  const trainer = useSelector(selectCurrentTrainer);
  const user = useSelector(selectCurrentUser);
  const token = useSelector(selectCurrentToken);
  const dispatch = useDispatch();
  const { startTour } = useTour();
  const { t, language, setLanguage } = useLanguage();

  const {
    data: trainerResponse,
    isLoading,
    refetch,
  } = useGetTrainerProfileQuery(undefined, {
    skip: user?.role !== UserRole.TRAINER,
  });

  // Built server-side: the app knows the API host, not the public website's.
  const publicProfileUrl = trainerResponse?.data?.publicProfileUrl ?? null;

  const handleShareProfileLink = useCallback(async () => {
    if (!publicProfileUrl) return;

    // Both the dialog and the share sheet are native presentations, and neither
    // can appear while the menu Modal is still fading out — the call resolves
    // having shown nothing. The other menu entries get away with it because
    // router.push and setState present nothing native.
    await new Promise<void>((resolve) => setTimeout(resolve, MENU_DISMISS_MS));

    // The URL is shown, not just handed to the share sheet. Putting a link in an
    // Instagram bio means copying it, and a sheet that silently fails leaves the
    // trainer with nothing at all — this way the link is always at least legible.
    Alert.alert(t("shareMyLink"), publicProfileUrl, [
      {
        text: t("copyLink"),
        onPress: () => {
          void Clipboard.setStringAsync(publicProfileUrl).then(() =>
            Alert.alert(t("copied"), t("linkCopied"))
          );
        },
      },
      {
        text: t("share"),
        onPress: () => {
          void Share.share({
            message: `${t("shareMyLinkMessage")}\n${publicProfileUrl}`,
            url: publicProfileUrl,
          }).catch(() => Alert.alert(t("error"), t("couldNotShareLink")));
        },
      },
      { text: t("cancel"), style: "cancel" },
    ]);
  }, [publicProfileUrl, t]);
  const {
    data: specializationsResponse,
    isLoading: isSpecializationsLoading,
    refetch: refetchSpecializations,
  } = useGetSpecializationsQuery();
  const specializationOptions = useMemo(() => {
    const fetched = specializationsResponse?.data ?? [];
    if (fetched.length > 0) return fetched;
    const trainerSpecs = trainer?.specializations ?? [];
    return trainerSpecs.map((spec) => ({
      id: spec.id,
      name: spec.name,
      description: spec.description,
      iconUrl: spec.iconUrl,
      isActive: true,
    }));
  }, [specializationsResponse, trainer]);

  const [deleteTrainerProfile, { isLoading: isDeleting }] = useDeleteTrainerProfileMutation();
  const [deleteAccount, { isLoading: isDeletingAccount }] = useDeleteProfileMutation();
  const [updateTrainerProfile, { isLoading: isUpdating }] = useUpdateTrainerProfileMutation();

  // ── Extracted hooks ──
  const { pickAndUpload, isUploading: isUploadingAvatar } = useProfilePictureUpload();
  const images = useTrainerImages();
  const transformations = useTrainerTransformations();
  const form = useTrainerFormState({ initialTrainer: trainer });
  const fieldErrors = useFieldErrors<"experience" | "specs" | "instagram" | "facebook" | "whatsapp">();
  // Keys: {row}.{name|price|sessionCount}
  const packageErrors = useFieldErrors<string>();

  // ── Packages ──
  const { data: packagesResponse } = useGetTrainerPackagesQuery(trainer?.id ?? 0, { skip: !trainer?.id });
  const trainerPackages = packagesResponse?.data ?? [];
  // Same price summary the clients see on the trainer page. The old session rate
  // is a leftover trainers can't edit, so it only counts without packages.
  const ownPriceSummary = summarizePrices(trainer?.sessionRate, trainerPackages);
  const [createPkg] = useCreateTrainerPackageMutation();
  const [updatePkg] = useUpdateTrainerPackageMutation();
  const [deletePkg] = useDeleteTrainerPackageMutation();
  const [editingPackages, setEditingPackages] = useState<Array<{ id?: number; name: string; price: string; sessionCount: string }>>([]);

  useEffect(() => {
    if (trainerPackages.length > 0) {
      setEditingPackages(trainerPackages.map((p) => ({
        id: p.id,
        name: p.name,
        price: String(p.price),
        sessionCount: String(p.sessionCount),
      })));
    }
  }, [trainerPackages]);

  const [isEditing, setIsEditing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (user?.role !== UserRole.TRAINER) return;
    if (trainerResponse?.data) {
      dispatch(setTrainerProfile(trainerResponse.data));
    }
  }, [trainerResponse, dispatch, user?.role]);

  // ── Account actions ──
  const { handleLogout, handleDeleteAccount } = useAccountActions({
    deleteAccount,
    isDeleting: isDeletingAccount,
  });

  const handleDeleteTrainer = useCallback(async () => {
    Alert.alert(
      t("deleteTrainerTitle"),
      t("deleteTrainerMessage"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTrainerProfile().unwrap();
              dispatch(setTrainerProfile(null));
              if (user) {
                dispatch(setCredentials({ user: { ...user, role: "client" }, token: token || "" }));
              }
              router.push("/(auth)/Welcome");
            } catch {
              Alert.alert(t("error"), t("deleteTrainerError"));
            }
          },
        },
      ],
    );
  }, [deleteTrainerProfile, dispatch, user, token, t]);

  // ── Save profile ──
  const handleSaveProfile = useCallback(async () => {
    if (!trainer) return;

    const parsedExperience = form.experienceYears.trim() === "" ? undefined : Number(form.experienceYears);
    const instagramPayload = normalizeSocialUrlForSave(form.instagramUrl);
    const facebookPayload = normalizeSocialUrlForSave(form.facebookUrl);
    const whatsappPayload = normalizeWhatsAppForSave(form.whatsappUrl);

    // Every problem at once, each under its own field.
    const valid = fieldErrors.setAll({
      ...(parsedExperience !== undefined && (!Number.isFinite(parsedExperience) || parsedExperience < 0)
        ? { experience: t("invalidExperience") } : {}),
      ...(form.selectedSpecializationIds.length === 0 ? { specs: t("invalidSpecializations") } : {}),
      ...(instagramPayload === "INVALID" ? { instagram: t("invalidInstagram") } : {}),
      ...(facebookPayload === "INVALID" ? { facebook: t("invalidFacebook") } : {}),
      ...(whatsappPayload === "INVALID" ? { whatsapp: t("invalidWhatsApp") } : {}),
    });
    // The payload checks repeat `valid` so TypeScript narrows "INVALID" out below.
    if (!valid || instagramPayload === "INVALID" || facebookPayload === "INVALID" || whatsappPayload === "INVALID") return;

    try {
      const response = await updateTrainerProfile({
        bio: form.bio.trim() || undefined,
        experienceYears: parsedExperience,
        locationCity: form.locationCity.trim() || undefined,
        locationState: form.locationState.trim() || undefined,
        locationCountry: form.locationCountry.trim() || undefined,
        instagramUrl: instagramPayload,
        facebookUrl: facebookPayload,
        whatsappUrl: whatsappPayload,
        freeFirstSession: form.freeFirstSession,
        ...(form.gender ? { gender: form.gender } : {}),
        specializationIds: form.selectedSpecializationIds,
      }).unwrap();
      if (response?.data) dispatch(setTrainerProfile(response.data));
      setIsEditing(false);
      Alert.alert(t("success"), t("profileUpdated"));
    } catch (error: unknown) {
      Alert.alert(t("error"), getApiErrorMessage(error, t("updateError")));
    }
  }, [trainer, form, fieldErrors, updateTrainerProfile, dispatch, t]);

  // ── Package editing ──
  const addEditPackageRow = useCallback(() => {
    if (editingPackages.length >= 5) return;
    setEditingPackages((prev) => [...prev, { name: "", price: "", sessionCount: "" }]);
  }, [editingPackages.length]);

  const removeEditPackageRow = useCallback((index: number) => {
    setEditingPackages((prev) => prev.filter((_, i) => i !== index));
    packageErrors.setAll({}); // keyed by row index, which just shifted
  }, [packageErrors]);

  const updateEditPackageField = useCallback(
    (index: number, field: "name" | "price" | "sessionCount", value: string) => {
      packageErrors.clear(`${index}.${field}`);
      setEditingPackages((prev) =>
        prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
      );
    },
    [packageErrors]
  );

  const handleSavePackages = useCallback(async () => {
    if (!trainer) return;

    // Validate every row before touching the server. This used to run inside the
    // save loop, after deletions and earlier rows had already been written, so one
    // bad price left the packages half saved.
    const problems: Record<string, string> = {};
    editingPackages.forEach((pkg, i) => {
      const price = parseFloat(pkg.price);
      const sessionCount = parseInt(pkg.sessionCount);
      if (!pkg.name.trim()) problems[`${i}.name`] = t("packageNameRequired");
      if (isNaN(price) || price <= 0) problems[`${i}.price`] = t("packagePriceRequired");
      if (isNaN(sessionCount) || sessionCount < 1) problems[`${i}.sessionCount`] = t("sessionCountRequired");
    });
    if (!packageErrors.setAll(problems)) return;

    try {
      const existingIds = new Set(editingPackages.filter((p) => p.id).map((p) => p.id!));
      const deletedPackages = trainerPackages.filter((p) => !existingIds.has(p.id));
      for (const pkg of deletedPackages) {
        await deletePkg(pkg.id);
      }

      for (let i = 0; i < editingPackages.length; i++) {
        const pkg = editingPackages[i];
        const price = parseFloat(pkg.price);
        const sessionCount = parseInt(pkg.sessionCount);

        if (pkg.id) {
          await updatePkg({ id: pkg.id, name: pkg.name.trim(), price, sessionCount, sortOrder: i });
        } else {
          await createPkg({ name: pkg.name.trim(), price, sessionCount, sortOrder: i });
        }
      }

      Alert.alert(t("success"), t("packageUpdated"));
    } catch (error: unknown) {
      Alert.alert(t("error"), getApiErrorMessage(error, t("updateError")));
    }
  }, [trainer, editingPackages, trainerPackages, packageErrors, createPkg, updatePkg, deletePkg, t]);

  // ── Menu items ──
  const menuItems: ProfileMenuItem[] = useMemo(() => [
    {
      key: "lang", icon: "language-outline", label: t("language"),
      onPress: () => setLanguage(language === "en" ? "ro" : "en"),
      trailing: (
        <View style={styles.langBadge}>
          <Text style={styles.langBadgeText}>{language === "en" ? "EN" : "RO"}</Text>
        </View>
      ),
    },
    {
      key: "edit", icon: "pencil", label: t("editProfile"),
      onPress: () => { setMenuVisible(false); setIsEditing(true); },
    },
    // Only when the server sends a URL, which it does once PUBLIC_WEB_URL is
    // configured. Without it there is no public page to share yet.
    ...(publicProfileUrl
      ? [{
          key: "share", icon: "share-social-outline" as const, label: t("shareMyLink"),
          onPress: () => { setMenuVisible(false); void handleShareProfileLink(); },
        }]
      : []),
    {
      key: "sub", icon: "receipt-outline", label: t("manageSubscription"),
      onPress: () => { setMenuVisible(false); router.push("/checkout"); },
    },
    {
      key: "legal", icon: "document-text-outline", label: t("legalAndPolicies"),
      onPress: () => { setMenuVisible(false); router.push("/legal"); },
    },
    {
      key: "report", icon: "flag-outline", label: t("reportIssue"),
      onPress: () => { setMenuVisible(false); router.push({ pathname: "/report-issue", params: { targetType: "app" } }); },
    },
    {
      key: "tour", icon: "help-circle-outline", label: t("showTutorial"),
      onPress: () => { setMenuVisible(false); startTour(trainerTour); },
    },
    {
      key: "logout", icon: "log-out-outline", label: t("logOut"),
      onPress: () => { setMenuVisible(false); void handleLogout(); },
    },
    {
      key: "delTrainer", icon: "trash-outline",
      label: isDeleting ? t("deleting") : t("deleteProfile"),
      onPress: () => { setMenuVisible(false); void handleDeleteTrainer(); },
      destructive: true, disabled: isDeleting, loading: isDeleting,
    },
    {
      key: "delAccount", icon: "person-remove-outline",
      label: isDeletingAccount ? t("deleting") : t("deleteAccount"),
      onPress: () => { setMenuVisible(false); void handleDeleteAccount(); },
      destructive: true, disabled: isDeletingAccount, loading: isDeletingAccount,
    },
    // publicProfileUrl arrives with the profile query, after the first render.
    // Without it here the memo keeps the initial value — null — and the share
    // entry never appears no matter how the server is configured.
  ], [t, language, setLanguage, isDeleting, isDeletingAccount, handleLogout, handleDeleteTrainer, handleDeleteAccount, startTour, publicProfileUrl, handleShareProfileLink]);

  // ── Guards ──
  // No user means a logout is in flight and this screen is fading out: render
  // nothing rather than an error the user would see for a moment.
  if (!user) return null;

  if (user.role !== UserRole.TRAINER) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t("trainerOnly")}</Text>
        <Pressable style={styles.button} onPress={() => router.push("/")}>
          <Text style={styles.buttonText}>{t("goHome")}</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!trainer) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t("noTrainerFound")}</Text>
        <Pressable style={styles.button} onPress={() => router.push("/login")}>
          <Text style={styles.buttonText}>{t("login")}</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => router.push("/")}>
          <Text style={styles.buttonText}>{t("goBack")}</Text>
        </Pressable>
      </View>
    );
  }

  const trainerInitials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "T";
  const dateLocale = language === "ro" ? "ro-RO" : "en-US";
  const formatDate = (date: string | Date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString(dateLocale, { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t("goBack")}>
              <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
            </Pressable>
            <Text style={styles.title}>{t("trainerProfile")}</Text>
            {!isEditing && (
              <Pressable style={styles.menuIconButton} onPress={() => setMenuVisible(true)} accessibilityRole="button" accessibilityLabel={t("a11yMoreOptions")}>
                <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.text} />
              </Pressable>
            )}
          </View>
          <View style={styles.avatarRow}>
            <EditableAvatar
              imageUrl={user?.profileImageUrl}
              initials={trainerInitials}
              size={92}
              editable
              uploading={isUploadingAvatar}
              onPress={pickAndUpload}
            />
          </View>
          <View style={[styles.statusBadge, trainer.isAvailable ? styles.available : styles.unavailable]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="ellipse" size={10} color={trainer.isAvailable ? theme.colors.success : theme.colors.error} style={{ marginRight: 4 }} />
              <Text style={styles.statusText}>
                {trainer.isAvailable ? t("available") : t("unavailable")}
              </Text>
            </View>
          </View>
          {trainer.isFeatured && (
            <View style={styles.featuredBadge}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="star" size={14} color="#D97706" style={{ marginRight: 4 }} />
                <Text style={styles.featuredText}>{t("featuredTrainer")}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Bio ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("aboutMe")}</Text>
          {isEditing ? (
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              value={form.bio}
              onChangeText={form.setBio}
              placeholder={t("bioPlaceholder")}
            />
          ) : (
            <Text style={styles.bioText}>{trainer.bio || t("noBio")}</Text>
          )}
        </View>

        {/* ── Credentials ── */}
        <TrainerImageSection
          title={t("certificationsAwards")}
          subtitle={t("certificationsSubtitle")}
          images={images.credentialImages}
          max={MAX_TRAINER_IMAGES}
          uploading={images.isUploadingCredential}
          deletingId={images.deletingImageId}
          onAdd={images.addImages}
          onDelete={images.removeImage}
        />
        <TrainerTransformationSection
          transformations={transformations.transformations}
          max={MAX_TRANSFORMATIONS}
          submitting={transformations.isCreating}
          deletingId={transformations.deletingId}
          onCreate={transformations.create}
          onDelete={transformations.remove}
        />

        {/* ── Experience & Rates ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("experience")}</Text>
          {isEditing ? (
            <View style={styles.editGrid}>
              <TextInput style={[styles.input, fieldErrors.errors.experience && presets.inputError]} keyboardType="number-pad" value={form.experienceYears} onChangeText={(v) => { fieldErrors.clear("experience"); form.setExperienceYears(v); }} placeholder={t("experiencePlaceholder")} />
              <FieldError message={fieldErrors.errors.experience} />
              <Text style={styles.switchLabel}>{t("yourGender")}</Text>
              {!form.gender ? <Text style={styles.switchHint}>{t("genderMissingHint")}</Text> : null}
              <View style={styles.genderRow}>
                {([
                  ["female", t("genderFemale")],
                  ["male", t("genderMale")],
                  ["non_binary", t("genderNonBinary")],
                ] as const).map(([value, label]) => {
                  const active = form.gender === value;
                  return (
                    <Pressable
                      key={value}
                      style={[presets.chip, active && presets.chipSelected]}
                      onPress={() => form.setGender(value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[presets.chipText, active && presets.chipTextSelected]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.switchRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.switchLabel}>{t("offerFreeFirstSession")}</Text>
                  <Text style={styles.switchHint}>{t("offerFreeFirstSessionHint")}</Text>
                </View>
                <Switch
                  value={form.freeFirstSession}
                  onValueChange={form.setFreeFirstSession}
                  trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primary }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel={t("offerFreeFirstSession")}
                />
              </View>
            </View>
          ) : (
            <View style={styles.infoGrid}>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>{t("experience")}</Text>
                <Text style={styles.infoValue}>{trainer.experienceYears || 0} {t("years")}</Text>
              </View>
              {ownPriceSummary ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>{t("sessionRate")}</Text>
                  <Text style={styles.infoValue}>
                    {t(ownPriceSummary.showFrom ? "priceFromHeadline" : "priceHeadline").replace(
                      "%s",
                      formatLei(ownPriceSummary.lowest, language === "ro" ? "ro" : "en")
                    )}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* ── Packages ── */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <Ionicons name="pricetags-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t("myPackages")}</Text>
          </View>
          {isEditing ? (
            <View>
              {editingPackages.map((pkg, index) => (
                <View key={pkg.id ?? `new-${index}`} style={{ marginBottom: 12, padding: 14, backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.control }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, fontFamily: fonts.uiSemiBold, color: theme.colors.text }}>
                      {t("addPackage")} {index + 1}
                    </Text>
                    {editingPackages.length > 0 && (
                      <Pressable onPress={() => removeEditPackageRow(index)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("a11yRemovePackage")}>
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </Pressable>
                    )}
                  </View>
                  <TextInput style={[styles.input, packageErrors.errors[`${index}.name`] && presets.inputError]} value={pkg.name} onChangeText={(v) => updateEditPackageField(index, "name", v)} placeholder={t("packageName")} />
                  <FieldError message={packageErrors.errors[`${index}.name`]} />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <TextInput style={[styles.input, packageErrors.errors[`${index}.price`] && presets.inputError]} value={pkg.price} onChangeText={(v) => updateEditPackageField(index, "price", v)} placeholder={t("packagePrice")} keyboardType="numeric" />
                      <FieldError message={packageErrors.errors[`${index}.price`]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextInput style={[styles.input, packageErrors.errors[`${index}.sessionCount`] && presets.inputError]} value={pkg.sessionCount} onChangeText={(v) => updateEditPackageField(index, "sessionCount", v)} placeholder={t("sessionCount")} keyboardType="number-pad" />
                      <FieldError message={packageErrors.errors[`${index}.sessionCount`]} />
                    </View>
                  </View>
                </View>
              ))}
              {editingPackages.length < 5 && (
                <Pressable onPress={addEditPackageRow} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: theme.radius.control, borderWidth: 1.5, borderColor: theme.colors.primary, borderStyle: 'dashed', marginTop: 4 }}>
                  <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={{ color: theme.colors.primary, fontFamily: fonts.uiSemiBold, fontSize: 14 }}>{t("addPackage")}</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [{ marginTop: 14, backgroundColor: theme.colors.primary, height: 52, justifyContent: 'center', borderRadius: theme.radius.control, alignItems: 'center' }, pressed && { backgroundColor: theme.colors.primaryPressed }]}
                onPress={() => { void handleSavePackages(); }}
              >
                <Text style={{ color: '#fff', fontFamily: fonts.uiSemiBold }}>{t("saveChanges")}</Text>
              </Pressable>
            </View>
          ) : trainerPackages.length > 0 ? (
            <View>
              {trainerPackages.map((pkg) => (
                <View key={pkg.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                  <View>
                    <Text style={{ fontSize: 15, fontFamily: fonts.uiSemiBold, color: theme.colors.text }}>{pkg.name}</Text>
                    <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 }}>
                      {pkg.sessionCount} {t("sessions")} — {(Number(pkg.price) / pkg.sessionCount).toFixed(2)} lei{t("perSession")}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 16, fontFamily: fonts.uiBold, color: theme.colors.primary }}>{Number(pkg.price).toFixed(2)} lei</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.ui, color: theme.colors.textSecondary, fontSize: 14 }}>{t("noPackages")}</Text>
          )}
        </View>

        {/* ── Location ── */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <Ionicons name="location" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t("location")}</Text>
          </View>
          {isEditing ? (
            <View style={styles.editGrid}>
              <TextInput style={styles.input} value={form.locationCity} onChangeText={form.setLocationCity} placeholder={t("city")} />
              <TextInput style={styles.input} value={form.locationState} onChangeText={form.setLocationState} placeholder={t("state")} />
              <TextInput style={styles.input} value={form.locationCountry} onChangeText={form.setLocationCountry} placeholder={t("country")} />
            </View>
          ) : (
            <>
              <Text style={styles.locationText}>
                {trainer.locationCity && trainer.locationState
                  ? `${trainer.locationCity}, ${trainer.locationState}`
                  : t("locationNotSpecified")}
              </Text>
              <Text style={styles.locationSubtext}>{trainer.locationCountry || t("countryNotSpecified")}</Text>
            </>
          )}
        </View>

        {/* ── Social Media ── */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <Ionicons name="phone-portrait-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t("socialMedia")}</Text>
          </View>
          {isEditing ? (
            <View style={styles.editGrid}>
              <TextInput style={[styles.input, fieldErrors.errors.instagram && presets.inputError]} value={form.instagramUrl} onChangeText={(v) => { fieldErrors.clear("instagram"); form.setInstagramUrl(v); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder={t("instagramPlaceholder")} />
              <FieldError message={fieldErrors.errors.instagram} />
              <TextInput style={[styles.input, fieldErrors.errors.facebook && presets.inputError]} value={form.facebookUrl} onChangeText={(v) => { fieldErrors.clear("facebook"); form.setFacebookUrl(v); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder={t("facebookPlaceholder")} />
              <FieldError message={fieldErrors.errors.facebook} />
              <TextInput style={[styles.input, fieldErrors.errors.whatsapp && presets.inputError]} value={form.whatsappUrl} onChangeText={(v) => { fieldErrors.clear("whatsapp"); form.setWhatsappUrl(v); }} autoCapitalize="none" autoCorrect={false} keyboardType="phone-pad" placeholder={t("whatsappPlaceholder")} />
              <FieldError message={fieldErrors.errors.whatsapp} />
            </View>
          ) : trainer.instagramUrl || trainer.facebookUrl || trainer.whatsappUrl ? (
            <View style={styles.socialList}>
              {trainer.instagramUrl ? <Text style={styles.socialItem}>Instagram: {trainer.instagramUrl}</Text> : null}
              {trainer.facebookUrl ? <Text style={styles.socialItem}>Facebook: {trainer.facebookUrl}</Text> : null}
              {trainer.whatsappUrl ? <Text style={styles.socialItem}>WhatsApp: {trainer.whatsappUrl}</Text> : null}
            </View>
          ) : (
            <Text style={styles.locationSubtext}>{t("noSocialLinks")}</Text>
          )}
        </View>

        {/* ── Specializations ── */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <Ionicons name="pricetag-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t("specializations")}</Text>
          </View>
          {isEditing ? (
            isSpecializationsLoading ? (
              <View style={styles.specLoadingRow}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.specLoadingText}>{t("loadingSpecializations")}</Text>
              </View>
            ) : specializationOptions.length > 0 ? (
              <View style={styles.specGrid}>
                {specializationOptions.map((spec) => {
                  const active = form.selectedSpecializationIds.includes(spec.id);
                  return (
                    <Pressable key={spec.id} style={[styles.specChip, active && styles.specChipActive]} onPress={() => { fieldErrors.clear("specs"); form.toggleSpecialization(spec.id); }}>
                      <Text style={[styles.specChipText, active && styles.specChipTextActive]}>{spec.name}</Text>
                    </Pressable>
                  );
                })}
                <FieldError message={fieldErrors.errors.specs} style={{ width: "100%" }} />
              </View>
            ) : (
              <View style={styles.specFallbackBox}>
                <Text style={styles.specFallbackText}>{t("noSpecOptions")}</Text>
                <Pressable style={styles.specRetryButton} onPress={() => { void refetchSpecializations(); void refetch(); }}>
                  <Text style={styles.specRetryText}>{t("retry")}</Text>
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
            <Text style={styles.locationSubtext}>{t("noSpecSelected")}</Text>
          )}
        </View>

        {/* ── Stats ── */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <Ionicons name="bar-chart-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t("statistics")}</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{trainer.profileViews || 0}</Text>
              <Text style={styles.statLabel}>{t("profileViews")}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{trainer.reviewCount || 0}</Text>
              <Text style={styles.statLabel}>{t("reviews")}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{Number(trainer.totalRating || 0).toFixed(1)}</Text>
              <View style={styles.starsText}>
                <StarRating rating={Number(trainer.totalRating || 0)} />
              </View>
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.analyticsButton, pressed && styles.buttonPressed]}
          onPress={() => router.push("/trainer-analytics")}
        >
          <View style={styles.analyticsButtonInner}>
            <Ionicons name="analytics-outline" size={26} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.analyticsButtonTitle}>{t("trainerAnalytics")}</Text>
              <Text style={styles.analyticsButtonSub}>{t("analyticsSubtitle")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
          </View>
        </Pressable>

        {/* ── Account info ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("accountInformation")}</Text>
          <View style={styles.accountInfo}>
            <Text style={styles.accountLabel}>{t("profileCreated")}</Text>
            <Text style={styles.accountValue}>{formatDate(trainer.createdAt)}</Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountLabel}>{t("lastUpdated")}</Text>
            <Text style={styles.accountValue}>{formatDate(trainer.updatedAt)}</Text>
          </View>
        </View>

        {/* ── Actions ── */}
        <View style={styles.buttonSection}>
          <Pressable
            style={({ pressed }) => [styles.gymsButton, pressed && styles.buttonPressed]}
            onPress={() => router.push("/my-gyms")}
          >
            <View style={styles.gymsButtonInner}>
              <Ionicons name="barbell" size={28} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.gymsButtonTitle}>{t("myGyms")}</Text>
                <Text style={styles.gymsButtonSub}>{t("gymsSubtitle")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
            </View>
          </Pressable>

          {isEditing && (
            <View style={styles.actionContainer}>
              <Text style={styles.actionHeader}>{t("saveChanges")}</Text>
              <Pressable
                style={({ pressed }) => [styles.actionButton, styles.primaryAction, isUpdating && styles.buttonDisabled, pressed && styles.buttonPressed]}
                onPress={() => { void handleSaveProfile(); }}
                disabled={isUpdating}
              >
                <Ionicons name={isUpdating ? "sync" : "save-outline"} size={18} color="#fff" />
                <Text style={styles.primaryActionText}>{isUpdating ? t("saving") : t("saveProfile")}</Text>
              </Pressable>
              {/* The field messages can be far above; say so next to the button. */}
              <FieldError message={fieldErrors.hasErrors ? t("fixHighlightedFields") : undefined} />
              <Pressable
                style={({ pressed }) => [styles.actionButton, styles.secondaryAction, pressed && styles.buttonPressed]}
                onPress={() => { if (trainer) form.resetToTrainer(trainer); fieldErrors.setAll({}); setIsEditing(false); }}
              >
                <Text style={styles.secondaryActionText}>{t("cancel")}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <ProfileMenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={menuItems}
        dividerAfter={[0, 5]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa", padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, gap: 12 },
  header: { alignItems: "center", marginBottom: 30, paddingTop: 20, zIndex: 1 },
  headerTop: { width: "100%", alignItems: "center", justifyContent: "center", position: "relative", marginBottom: 15 },
  avatarRow: { alignItems: "center", marginBottom: 12 },
  title: { ...typography.h2, color: theme.colors.text },
  menuIconButton: {
    position: "absolute",
    right: 0,
    top: -5,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    position: "absolute",
    left: 0,
    top: -5,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    marginBottom: 10,
  },
  available: { backgroundColor: "#d4edda" },
  unavailable: { backgroundColor: "#f8d7da" },
  statusText: { ...typography.label, color: theme.colors.text },
  featuredBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  featuredText: { fontSize: 14, fontFamily: fonts.uiSemiBold, color: "#856404" },
  section: { ...presets.card, padding: 20, marginBottom: 20 },
  sectionTitle: { ...typography.h3, color: theme.colors.text, marginBottom: 15 },
  bioText: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 24, color: "#666" },
  input: { ...presets.input },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  editGrid: { gap: 10 },
  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, marginTop: 4 },
  switchLabel: { ...typography.body, fontFamily: fonts.uiBold, color: theme.colors.text },
  switchHint: { ...typography.small, fontSize: 13, color: theme.colors.textSecondary },
  specGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  specLoadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  specLoadingText: { ...typography.small, color: theme.colors.textSecondary },
  specFallbackBox: {
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.control,
    padding: 12,
    gap: 10,
  },
  specFallbackText: { ...typography.small, color: theme.colors.textSecondary },
  specRetryButton: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.control,
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: "center",
  },
  specRetryText: { ...typography.button, fontSize: 14, color: "#fff" },
  specChip: { ...presets.chip },
  specChipActive: { ...presets.chipSelected },
  specChipText: { ...presets.chipText },
  specChipTextActive: { ...presets.chipTextSelected },
  specChipReadOnly: {
    borderRadius: theme.radius.xs,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: `${theme.colors.primary}15`,
  },
  specChipReadOnlyText: { ...typography.label, color: theme.colors.primary },
  infoGrid: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  infoCard: {
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.control,
    padding: 15,
    flex: 1,
    minWidth: 100,
    alignItems: "center",
  },
  infoLabel: {
    ...typography.label,
    color: theme.colors.textSecondary,
    marginBottom: 5,
  },
  infoValue: { ...typography.price, color: theme.colors.text },
  locationText: { fontSize: 16, fontFamily: fonts.uiSemiBold, color: "#333", marginBottom: 5 },
  locationSubtext: { fontFamily: fonts.ui, fontSize: 14, color: "#666" },
  socialList: { gap: 6 },
  socialItem: { fontFamily: fonts.ui, fontSize: 14, color: "#374151" },
  statsGrid: { flexDirection: "row", justifyContent: "space-around", gap: 15 },
  statCard: { alignItems: "center", flex: 1 },
  statNumber: { fontSize: 24, fontFamily: fonts.uiBold, color: "#007AFF", marginBottom: 5 },
  statLabel: { fontFamily: fonts.ui, fontSize: 12, color: "#666", textAlign: "center" },
  starsText: { fontFamily: fonts.ui, fontSize: 12, marginTop: 2 },
  accountInfo: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  accountLabel: { fontFamily: fonts.ui, fontSize: 14, color: "#666" },
  accountValue: { fontSize: 14, fontFamily: fonts.uiSemiBold, color: "#333" },
  buttonSection: { gap: 15, marginTop: 20, marginBottom: 40 },
  gymsButton: {
    ...presets.card,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    overflow: "hidden",
  },
  gymsButtonInner: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  gymsButtonTitle: { ...typography.body1, fontFamily: fonts.uiBold, color: theme.colors.primary, marginBottom: 2 },
  gymsButtonSub: { ...typography.caption, color: theme.colors.textSecondary },
  buttonPressed: { opacity: 0.8 },
  actionContainer: { marginTop: theme.spacing.xl, gap: theme.spacing.md },
  actionHeader: { ...typography.h3, color: theme.colors.text, marginBottom: theme.spacing.xs },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    paddingHorizontal: 20,
    borderRadius: theme.radius.control,
    gap: 8,
  },
  primaryAction: { backgroundColor: theme.colors.primary },
  primaryActionText: { color: "#fff", fontSize: 16, fontFamily: fonts.uiSemiBold },
  secondaryAction: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  secondaryActionText: { color: theme.colors.textSecondary, fontSize: 16, fontFamily: fonts.uiSemiBold },
  analyticsButton: { ...presets.card, overflow: "hidden", marginBottom: 20 },
  analyticsButtonInner: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  analyticsButtonTitle: { ...typography.body1, fontFamily: fonts.uiBold, color: theme.colors.text, marginBottom: 2 },
  analyticsButtonSub: { ...typography.caption, color: theme.colors.textSecondary },
  buttonDisabled: { opacity: 0.6 },
  errorText: { fontFamily: fonts.ui, fontSize: 16, color: theme.colors.error, textAlign: "center" },
  button: {
    backgroundColor: theme.colors.primary,
    height: 52,
    justifyContent: "center",
    borderRadius: theme.radius.control,
    alignItems: "center",
    width: "100%",
  },
  buttonText: { ...typography.button, color: "#fff" },
  langBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  langBadgeText: { ...typography.label, fontSize: 11, color: "#fff" },
});

export default TrainerProfile;
