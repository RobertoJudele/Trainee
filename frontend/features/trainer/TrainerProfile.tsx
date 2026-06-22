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
} from "react-native";
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
import { theme, typography } from "../../src/lib/theme";
import { useTour } from "../../src/components/onboarding/TourContext";
import { trainerTour } from "../../src/components/onboarding/trainerTour";
import { Ionicons } from "@expo/vector-icons";
import EditableAvatar from "../../src/components/EditableAvatar";
import TrainerImageSection from "../../src/components/TrainerImageSection";
import { useProfilePictureUpload } from "../../src/lib/useProfilePictureUpload";
import { useLanguage } from "../../src/lib/i18n/LanguageContext";
import {
  normalizeSocialUrlForSave,
  normalizeWhatsAppForSave,
} from "../../src/lib/validation";
import StarRating from "../../src/components/StarRating";
import ProfileMenuModal, { type ProfileMenuItem } from "../../src/components/ProfileMenuModal";
import { useAccountActions } from "../../src/hooks/useAccountActions";
import { useTrainerFormState } from "./hooks/useTrainerFormState";
import { useTrainerImages } from "./hooks/useTrainerImages";

const { height: SCREEN_H } = Dimensions.get("window");
const MAX_TRAINER_IMAGES = 5;

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
  const form = useTrainerFormState({ initialTrainer: trainer });

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
    const parsedHourly = form.hourlyRate.trim() === "" ? undefined : Number(form.hourlyRate);
    const parsedSession = form.sessionRate.trim() === "" ? undefined : Number(form.sessionRate);

    if (parsedExperience !== undefined && (!Number.isFinite(parsedExperience) || parsedExperience < 0)) {
      Alert.alert(t("invalidInput"), t("invalidExperience"));
      return;
    }
    if (parsedHourly !== undefined && (!Number.isFinite(parsedHourly) || parsedHourly < 0)) {
      Alert.alert(t("invalidInput"), t("invalidHourly"));
      return;
    }
    if (parsedSession !== undefined && (!Number.isFinite(parsedSession) || parsedSession < 0)) {
      Alert.alert(t("invalidInput"), t("invalidSession"));
      return;
    }
    if (form.selectedSpecializationIds.length === 0) {
      Alert.alert(t("invalidInput"), t("invalidSpecializations"));
      return;
    }

    const instagramPayload = normalizeSocialUrlForSave(form.instagramUrl);
    if (instagramPayload === "INVALID") { Alert.alert(t("invalidInput"), t("invalidInstagram")); return; }
    const facebookPayload = normalizeSocialUrlForSave(form.facebookUrl);
    if (facebookPayload === "INVALID") { Alert.alert(t("invalidInput"), t("invalidFacebook")); return; }
    const whatsappPayload = normalizeWhatsAppForSave(form.whatsappUrl);
    if (whatsappPayload === "INVALID") { Alert.alert(t("invalidInput"), t("invalidWhatsApp")); return; }

    try {
      const response = await updateTrainerProfile({
        bio: form.bio.trim() || undefined,
        experienceYears: parsedExperience,
        hourlyRate: parsedHourly,
        sessionRate: parsedSession,
        locationCity: form.locationCity.trim() || undefined,
        locationState: form.locationState.trim() || undefined,
        locationCountry: form.locationCountry.trim() || undefined,
        instagramUrl: instagramPayload,
        facebookUrl: facebookPayload,
        whatsappUrl: whatsappPayload,
        specializationIds: form.selectedSpecializationIds,
      }).unwrap();
      if (response?.data) dispatch(setTrainerProfile(response.data));
      setIsEditing(false);
      Alert.alert(t("success"), t("profileUpdated"));
    } catch (error: any) {
      Alert.alert(t("error"), error?.data?.message || t("updateError"));
    }
  }, [trainer, form, updateTrainerProfile, dispatch, t]);

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
  ], [t, language, setLanguage, isDeleting, isDeletingAccount, handleLogout, handleDeleteTrainer, handleDeleteAccount, startTour]);

  // ── Guards ──
  if (user?.role !== UserRole.TRAINER) {
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
        <ActivityIndicator size="large" color="#6366F1" />
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
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("trainerProfile")}</Text>
          {!isEditing && (
            <Pressable style={styles.menuIconButton} onPress={() => setMenuVisible(true)}>
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
            <Ionicons name="ellipse" size={10} color={trainer.isAvailable ? theme.colors.success : theme.colors.error} style={{marginRight: 4}} />
            <Text style={styles.statusText}>
              {trainer.isAvailable ? t("available") : t("unavailable")}
            </Text>
          </View>
        </View>
        {trainer.isFeatured && (
          <View style={styles.featuredBadge}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="star" size={14} color="#D97706" style={{marginRight: 4}} />
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

      {/* ── Gallery & credentials ── */}
      <TrainerImageSection
        title={t("gallery")}
        subtitle={t("gallerySubtitle")}
        images={images.galleryImages}
        max={MAX_TRAINER_IMAGES}
        uploading={images.isUploadingGallery}
        deletingId={images.deletingImageId}
        onAdd={() => images.addImages("gallery")}
        onDelete={images.removeImage}
      />
      <TrainerImageSection
        title={t("certificationsAwards")}
        subtitle={t("certificationsSubtitle")}
        images={images.credentialImages}
        max={MAX_TRAINER_IMAGES}
        uploading={images.isUploadingCredential}
        deletingId={images.deletingImageId}
        onAdd={() => images.addImages("credential")}
        onDelete={images.removeImage}
      />

      {/* ── Experience & Rates ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("experienceAndRates")}</Text>
        {isEditing ? (
          <View style={styles.editGrid}>
            <TextInput style={styles.input} keyboardType="number-pad" value={form.experienceYears} onChangeText={form.setExperienceYears} placeholder={t("experiencePlaceholder")} />
            <TextInput style={styles.input} keyboardType="decimal-pad" value={form.hourlyRate} onChangeText={form.setHourlyRate} placeholder={t("hourlyRatePlaceholder")} />
            <TextInput style={styles.input} keyboardType="decimal-pad" value={form.sessionRate} onChangeText={form.setSessionRate} placeholder={t("sessionRatePlaceholder")} />
          </View>
        ) : (
          <View style={styles.infoGrid}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{t("experience")}</Text>
              <Text style={styles.infoValue}>{trainer.experienceYears || 0} {t("years")}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{t("hourlyRate")}</Text>
              <Text style={styles.infoValue}>${trainer.hourlyRate || 0}{t("perHour")}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{t("sessionRate")}</Text>
              <Text style={styles.infoValue}>${trainer.sessionRate || 0}{t("perSession")}</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Location ── */}
      <View style={styles.section}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15}}>
          <Ionicons name="location" size={18} color={theme.colors.primary} style={{marginRight: 6}} />
          <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{t("location")}</Text>
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
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15}}>
          <Ionicons name="phone-portrait-outline" size={18} color={theme.colors.primary} style={{marginRight: 6}} />
          <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{t("socialMedia")}</Text>
        </View>
        {isEditing ? (
          <View style={styles.editGrid}>
            <TextInput style={styles.input} value={form.instagramUrl} onChangeText={form.setInstagramUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder={t("instagramPlaceholder")} />
            <TextInput style={styles.input} value={form.facebookUrl} onChangeText={form.setFacebookUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder={t("facebookPlaceholder")} />
            <TextInput style={styles.input} value={form.whatsappUrl} onChangeText={form.setWhatsappUrl} autoCapitalize="none" autoCorrect={false} keyboardType="phone-pad" placeholder={t("whatsappPlaceholder")} />
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
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15}}>
          <Ionicons name="pricetag-outline" size={18} color={theme.colors.primary} style={{marginRight: 6}} />
          <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{t("specializations")}</Text>
        </View>
        {isEditing ? (
          isSpecializationsLoading ? (
            <View style={styles.specLoadingRow}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.specLoadingText}>{t("loadingSpecializations")}</Text>
            </View>
          ) : specializationOptions.length > 0 ? (
            <View style={styles.specGrid}>
              {specializationOptions.map((spec) => {
                const active = form.selectedSpecializationIds.includes(spec.id);
                return (
                  <Pressable key={spec.id} style={[styles.specChip, active && styles.specChipActive]} onPress={() => form.toggleSpecialization(spec.id)}>
                    <Text style={[styles.specChipText, active && styles.specChipTextActive]}>{spec.name}</Text>
                  </Pressable>
                );
              })}
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
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15}}>
          <Ionicons name="bar-chart-outline" size={18} color={theme.colors.primary} style={{marginRight: 6}} />
          <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{t("statistics")}</Text>
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
            <View style={{flex: 1}}>
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
            <Pressable
              style={({ pressed }) => [styles.actionButton, styles.secondaryAction, pressed && styles.buttonPressed]}
              onPress={() => { if (trainer) form.resetToTrainer(trainer); setIsEditing(false); }}
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
  menuIconButton: { position: "absolute", right: 0, top: -5, padding: 10 },
  backBtn: { position: "absolute", left: 0, top: -5, padding: 10 },
  statusBadge: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginBottom: 10 },
  available: { backgroundColor: "#d4edda" },
  unavailable: { backgroundColor: "#f8d7da" },
  statusText: { fontSize: 14, fontWeight: "600", color: "#333" },
  featuredBadge: { backgroundColor: "#fff3cd", paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  featuredText: { fontSize: 14, fontWeight: "600", color: "#856404" },
  section: { backgroundColor: theme.colors.surface, borderRadius: theme.roundness, padding: 20, marginBottom: 20, ...theme.shadows.medium },
  sectionTitle: { ...typography.h3, color: theme.colors.text, marginBottom: 15 },
  bioText: { fontSize: 16, lineHeight: 24, color: "#666" },
  input: { borderWidth: 1, borderColor: "#D1D5DB", backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#111827" },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  editGrid: { gap: 10 },
  specGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  specLoadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  specLoadingText: { fontSize: 13, color: "#6B7280" },
  specFallbackBox: { backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, gap: 10 },
  specFallbackText: { fontSize: 13, color: "#6B7280" },
  specRetryButton: { alignSelf: "flex-start", backgroundColor: "#6366F1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  specRetryText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  specChip: { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  specChipActive: { backgroundColor: "#3B82F6", borderColor: "#3B82F6" },
  specChipText: { color: "#374151", fontSize: 13, fontWeight: "600" },
  specChipTextActive: { color: "#fff" },
  specChipReadOnly: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#E5E7EB" },
  specChipReadOnlyText: { color: "#374151", fontSize: 13, fontWeight: "600" },
  infoGrid: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  infoCard: { backgroundColor: "#f8f9fa", borderRadius: 8, padding: 15, flex: 1, minWidth: 100, alignItems: "center" },
  infoLabel: { fontSize: 12, color: "#999", marginBottom: 5, textTransform: "uppercase" },
  infoValue: { fontSize: 16, fontWeight: "bold", color: "#333" },
  locationText: { fontSize: 16, fontWeight: "600", color: "#333", marginBottom: 5 },
  locationSubtext: { fontSize: 14, color: "#666" },
  socialList: { gap: 6 },
  socialItem: { fontSize: 14, color: "#374151" },
  statsGrid: { flexDirection: "row", justifyContent: "space-around", gap: 15 },
  statCard: { alignItems: "center", flex: 1 },
  statNumber: { fontSize: 24, fontWeight: "bold", color: "#007AFF", marginBottom: 5 },
  statLabel: { fontSize: 12, color: "#666", textAlign: "center" },
  starsText: { fontSize: 12, marginTop: 2 },
  accountInfo: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  accountLabel: { fontSize: 14, color: "#666" },
  accountValue: { fontSize: 14, fontWeight: "600", color: "#333" },
  buttonSection: { gap: 15, marginTop: 20, marginBottom: 40 },
  gymsButton: { backgroundColor: "white", borderRadius: theme.roundness, borderWidth: 2, borderColor: theme.colors.primary, overflow: "hidden", ...theme.shadows.medium },
  gymsButtonInner: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  gymsButtonTitle: { ...typography.body1, fontWeight: "700", color: theme.colors.primary, marginBottom: 2 },
  gymsButtonSub: { fontSize: 12, color: "#6B7280" },
  buttonPressed: { opacity: 0.8 },
  actionContainer: { marginTop: theme.spacing.xl, gap: theme.spacing.md },
  actionHeader: { ...typography.h3, color: theme.colors.text, marginBottom: theme.spacing.xs },
  actionButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: theme.roundness, gap: 8 },
  primaryAction: { backgroundColor: theme.colors.primary, ...theme.shadows.small },
  primaryActionText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryAction: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  secondaryActionText: { color: theme.colors.textSecondary, fontSize: 16, fontWeight: "600" },
  analyticsButton: { backgroundColor: theme.colors.surface, borderRadius: theme.roundness, borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden", ...theme.shadows.small },
  analyticsButtonInner: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  analyticsButtonTitle: { ...typography.body1, fontWeight: "700", color: theme.colors.text, marginBottom: 2 },
  analyticsButtonSub: { fontSize: 12, color: theme.colors.textSecondary },
  buttonDisabled: { opacity: 0.6 },
  errorText: { fontSize: 16, color: theme.colors.error, textAlign: "center" },
  button: { backgroundColor: theme.colors.primary, padding: 16, borderRadius: theme.roundness, alignItems: "center", width: "100%" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  langBadge: { backgroundColor: theme.colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  langBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});

export default TrainerProfile;
