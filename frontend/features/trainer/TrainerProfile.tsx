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
  Platform,
  Modal,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import {
  selectCurrentTrainer,
  selectCurrentUser,
  setTrainerProfile,
  setCredentials,
  selectCurrentToken,
  logOut,
} from "../auth/authSlice";
import { UserRole } from "../auth/authApiSlice";
import {
  useDeleteTrainerProfileMutation,
  useGetTrainerProfileQuery,
  useGetSpecializationsQuery,
  useUpdateTrainerProfileMutation,
  useGetTrainerImagesQuery,
  useUploadGalleryImagesMutation,
  useUploadCredentialImagesMutation,
  useDeleteTrainerImageMutation,
} from "./trainerApiSlice";
import { useDeleteProfileMutation } from "../users/usersApiSlicet";
import { router, useRouter } from "expo-router";
import { apiSlice } from "../../src/api/apiSlice";
import { theme, typography } from "../../src/lib/theme";
import { useTour } from "../../src/components/onboarding/TourContext";
import { trainerTour } from "../../src/components/onboarding/trainerTour";
import { Ionicons } from "@expo/vector-icons";
import Purchases from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EditableAvatar from "../../src/components/EditableAvatar";
import TrainerImageSection from "../../src/components/TrainerImageSection";
import { useProfilePictureUpload } from "../../src/lib/useProfilePictureUpload";
import { pickImages, toImageFormData } from "../../src/lib/imageUpload";
import { useLanguage } from "../../src/lib/i18n/LanguageContext";

const MAX_TRAINER_IMAGES = 5;

const normalizeSocialUrlForSave = (value: string): string | null | "INVALID" => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    new URL(withProtocol);
    return withProtocol;
  } catch {
    return "INVALID";
  }
};

const normalizeWhatsAppPhone = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedPrefix = trimmed.startsWith("00")
    ? `+${trimmed.slice(2)}`
    : trimmed;

  const digitsOnly = normalizedPrefix.replace(/\D/g, "");

  if (!digitsOnly || digitsOnly.length < 7 || digitsOnly.length > 15) {
    return null;
  }

  if (!/^[1-9]/.test(digitsOnly)) {
    return null;
  }

  return `+${digitsOnly}`;
};

const normalizeWhatsAppForSave = (value: string): string | null | "INVALID" => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const directPhone = normalizeWhatsAppPhone(trimmed);
  if (directPhone) {
    return directPhone;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const hostname = parsed.hostname.toLowerCase();

    const fromQuery = parsed.searchParams.get("phone") ?? "";
    const fromPath = parsed.pathname.split("/").filter(Boolean)[0] ?? "";

    let phoneCandidate = "";
    if (hostname === "wa.me" || hostname.endsWith(".wa.me")) {
      phoneCandidate = fromPath;
    } else if (
      hostname === "api.whatsapp.com" ||
      hostname === "whatsapp.com" ||
      hostname === "www.whatsapp.com"
    ) {
      phoneCandidate = fromQuery;
    } else {
      return "INVALID";
    }

    const parsedPhone = normalizeWhatsAppPhone(phoneCandidate);
    return parsedPhone ?? "INVALID";
  } catch {
    return "INVALID";
  }
};

function TrainerProfile() {
  const trainer = useSelector(selectCurrentTrainer);
  const user = useSelector(selectCurrentUser);
  const token = useSelector(selectCurrentToken);
  const dispatch = useDispatch();
  const { startTour } = useTour();
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage } = useLanguage();
  const {
    data: trainerResponse,
    isLoading,
    isError,
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
  const [deleteAccount, { isLoading: isDeletingAccount }] =
    useDeleteProfileMutation();
  const [updateTrainerProfile, { isLoading: isUpdating }] =
    useUpdateTrainerProfileMutation();

  // ── Profile picture + image galleries ──
  const { pickAndUpload, isUploading: isUploadingAvatar } = useProfilePictureUpload();
  const { data: imagesResp } = useGetTrainerImagesQuery(undefined, {
    skip: user?.role !== UserRole.TRAINER,
  });
  const galleryImages = imagesResp?.data?.gallery ?? [];
  const credentialImages = imagesResp?.data?.credential ?? [];
  const [uploadGallery, { isLoading: isUploadingGallery }] =
    useUploadGalleryImagesMutation();
  const [uploadCredential, { isLoading: isUploadingCredential }] =
    useUploadCredentialImagesMutation();
  const [deleteTrainerImage] = useDeleteTrainerImageMutation();
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

  const trainerInitials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "T";

  const addImages = useCallback(
    async (category: "gallery" | "credential") => {
      const current = category === "gallery" ? galleryImages.length : credentialImages.length;
      const picked = await pickImages(MAX_TRAINER_IMAGES - current);
      if (picked.length === 0) return;
      const form = toImageFormData("images", picked);
      try {
        if (category === "gallery") await uploadGallery(form).unwrap();
        else await uploadCredential(form).unwrap();
      } catch (err: any) {
        Alert.alert(t("uploadFailed"), err?.data?.message || t("uploadError"));
      }
    },
    [galleryImages.length, credentialImages.length, uploadGallery, uploadCredential, t]
  );

  const removeImage = useCallback(
    async (id: number) => {
      setDeletingImageId(id);
      try {
        await deleteTrainerImage(id).unwrap();
      } catch (err: any) {
        Alert.alert(t("error"), err?.data?.message || t("deleteImageError"));
      } finally {
        setDeletingImageId(null);
      }
    },
    [deleteTrainerImage]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [sessionRate, setSessionRate] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationState, setLocationState] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [selectedSpecializationIds, setSelectedSpecializationIds] = useState<number[]>([]);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (user?.role !== UserRole.TRAINER) {
      return;
    }

    if (trainerResponse?.data) {
      dispatch(setTrainerProfile(trainerResponse.data));
    }
  }, [trainerResponse, dispatch, user?.role]);

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
    setInstagramUrl(trainer.instagramUrl ?? "");
    setFacebookUrl(trainer.facebookUrl ?? "");
    setWhatsappUrl(trainer.whatsappUrl ?? "");
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
      t("deleteTrainerTitle"),
      t("deleteTrainerMessage"),
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("delete"), style: "destructive", onPress: () => performDelete() },
      ]
    );
  }, [t]);

  const performDelete = useCallback(async () => {
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
  }, [deleteTrainerProfile, dispatch, user, token, t]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t("deleteFullAccountTitle"),
      t("deleteFullAccountMessage"),
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("delete"), style: "destructive", onPress: performDeleteAccount },
      ]
    );
  }, [t]);

  const performDeleteAccount = useCallback(async () => {
    try {
      await deleteAccount().unwrap();
      dispatch(logOut());
      dispatch(apiSlice.util.resetApiState());
      try {
        if (Platform.OS === "ios" || Platform.OS === "android") {
          await Purchases.logOut();
        }
      } catch {
        // best-effort
      }
      router.replace("/(auth)/Welcome");
    } catch {
      Alert.alert(t("error"), t("deleteAccountError"));
    }
  }, [deleteAccount, dispatch, t]);

  const handleSubscribe = useCallback(async () => {
    setIsSubscribing(true);
    router.push("/checkout");
    setIsSubscribing(false);
  }, []);

  const handleLogout = useCallback(async () => {
    dispatch(logOut());
    dispatch(apiSlice.util.resetApiState());
    try {
      if (Platform.OS === "ios" || Platform.OS === "android") {
        await Purchases.logOut();
      }
    } catch (error) {
      console.log('RevenueCat logout error:', error);
    }
    router.replace("/(auth)/Welcome");
  }, [dispatch]);

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
      Alert.alert(t("invalidInput"), t("invalidExperience"));
      return;
    }

    if (parsedHourly !== undefined && (!Number.isFinite(parsedHourly) || parsedHourly < 0)) {
      Alert.alert(t("invalidInput"), t("invalidHourly"));
      return;
    }

    if (
      parsedSession !== undefined &&
      (!Number.isFinite(parsedSession) || parsedSession < 0)
    ) {
      Alert.alert(t("invalidInput"), t("invalidSession"));
      return;
    }

    if (selectedSpecializationIds.length === 0) {
      Alert.alert(t("invalidInput"), t("invalidSpecializations"));
      return;
    }

    const instagramPayload = normalizeSocialUrlForSave(instagramUrl);
    if (instagramPayload === "INVALID") {
      Alert.alert(t("invalidInput"), t("invalidInstagram"));
      return;
    }

    const facebookPayload = normalizeSocialUrlForSave(facebookUrl);
    if (facebookPayload === "INVALID") {
      Alert.alert(t("invalidInput"), t("invalidFacebook"));
      return;
    }

    const whatsappPayload = normalizeWhatsAppForSave(whatsappUrl);
    if (whatsappPayload === "INVALID") {
      Alert.alert(t("invalidInput"), t("invalidWhatsApp"));
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
        instagramUrl: instagramPayload,
        facebookUrl: facebookPayload,
        whatsappUrl: whatsappPayload,
        specializationIds: selectedSpecializationIds,
      }).unwrap();

      if (response?.data) {
        dispatch(setTrainerProfile(response.data));
      }
      setIsEditing(false);
      Alert.alert(t("success"), t("profileUpdated"));
    } catch (error: any) {
      const message = error?.data?.message || t("updateError");
      Alert.alert(t("error"), message);
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
    instagramUrl,
    facebookUrl,
    whatsappUrl,
    selectedSpecializationIds,
    dispatch,
  ]);

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

  const dateLocale = language === "ro" ? "ro-RO" : "en-US";
  const formatDate = (date: string | Date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString(dateLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderStars = (rating: number) => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Ionicons
          key={i}
          name={i < Math.floor(rating) ? "star" : "star-outline"}
          size={14}
          color={i < Math.floor(rating) ? "#F59E0B" : "#E5E7EB"}
          style={{ marginRight: 2 }}
        />
      ))}
    </View>
  );

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
            value={bio}
            onChangeText={setBio}
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
        images={galleryImages}
        max={MAX_TRAINER_IMAGES}
        uploading={isUploadingGallery}
        deletingId={deletingImageId}
        onAdd={() => addImages("gallery")}
        onDelete={removeImage}
      />
      <TrainerImageSection
        title={t("certificationsAwards")}
        subtitle={t("certificationsSubtitle")}
        images={credentialImages}
        max={MAX_TRAINER_IMAGES}
        uploading={isUploadingCredential}
        deletingId={deletingImageId}
        onAdd={() => addImages("credential")}
        onDelete={removeImage}
      />

      {/* ── Experience & Rates ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("experienceAndRates")}</Text>
        {isEditing ? (
          <View style={styles.editGrid}>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={experienceYears}
              onChangeText={setExperienceYears}
              placeholder={t("experiencePlaceholder")}
            />
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={hourlyRate}
              onChangeText={setHourlyRate}
              placeholder={t("hourlyRatePlaceholder")}
            />
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={sessionRate}
              onChangeText={setSessionRate}
              placeholder={t("sessionRatePlaceholder")}
            />
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
            <TextInput
              style={styles.input}
              value={locationCity}
              onChangeText={setLocationCity}
              placeholder={t("city")}
            />
            <TextInput
              style={styles.input}
              value={locationState}
              onChangeText={setLocationState}
              placeholder={t("state")}
            />
            <TextInput
              style={styles.input}
              value={locationCountry}
              onChangeText={setLocationCountry}
              placeholder={t("country")}
            />
          </View>
        ) : (
          <>
            <Text style={styles.locationText}>
              {trainer.locationCity && trainer.locationState
                ? `${trainer.locationCity}, ${trainer.locationState}`
                : t("locationNotSpecified")}
            </Text>
            <Text style={styles.locationSubtext}>
              {trainer.locationCountry || t("countryNotSpecified")}
            </Text>
          </>
        )}
      </View>

      <View style={styles.section}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15}}>
          <Ionicons name="phone-portrait-outline" size={18} color={theme.colors.primary} style={{marginRight: 6}} />
          <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{t("socialMedia")}</Text>
        </View>
        {isEditing ? (
          <View style={styles.editGrid}>
            <TextInput
              style={styles.input}
              value={instagramUrl}
              onChangeText={setInstagramUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder={t("instagramPlaceholder")}
            />
            <TextInput
              style={styles.input}
              value={facebookUrl}
              onChangeText={setFacebookUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder={t("facebookPlaceholder")}
            />
            <TextInput
              style={styles.input}
              value={whatsappUrl}
              onChangeText={setWhatsappUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="phone-pad"
              placeholder={t("whatsappPlaceholder")}
            />
          </View>
        ) : trainer.instagramUrl || trainer.facebookUrl || trainer.whatsappUrl ? (
          <View style={styles.socialList}>
            {trainer.instagramUrl ? (
              <Text style={styles.socialItem}>Instagram: {trainer.instagramUrl}</Text>
            ) : null}
            {trainer.facebookUrl ? (
              <Text style={styles.socialItem}>Facebook: {trainer.facebookUrl}</Text>
            ) : null}
            {trainer.whatsappUrl ? (
              <Text style={styles.socialItem}>WhatsApp: {trainer.whatsappUrl}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.locationSubtext}>{t("noSocialLinks")}</Text>
        )}
      </View>

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
                {t("noSpecOptions")}
              </Text>
              <Pressable
                style={styles.specRetryButton}
                onPress={() => {
                  void refetchSpecializations();
                  void refetch();
                }}
              >
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
            <View style={styles.starsText}>{renderStars(Number(trainer.totalRating || 0))}</View>
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
        {/* My Gyms — the new button */}
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
              style={({ pressed }) => [
                styles.actionButton,
                styles.primaryAction,
                isUpdating && styles.buttonDisabled,
                pressed && styles.buttonPressed
              ]}
              onPress={() => {
                void handleSaveProfile();
              }}
              disabled={isUpdating}
            >
              <Ionicons 
                name={isUpdating ? "sync" : "save-outline"} 
                size={18} 
                color="#fff" 
              />
              <Text style={styles.primaryActionText}>
                {isUpdating ? t("saving") : t("saveProfile")}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.secondaryAction,
                pressed && styles.buttonPressed
              ]}
              onPress={() => {
                if (trainer) {
                  setBio(trainer.bio ?? "");
                  setExperienceYears(trainer.experienceYears !== undefined ? String(trainer.experienceYears) : "");
                  setHourlyRate(trainer.hourlyRate !== undefined ? String(trainer.hourlyRate) : "");
                  setSessionRate(trainer.sessionRate !== undefined ? String(trainer.sessionRate) : "");
                  setLocationCity(trainer.locationCity ?? "");
                  setLocationState(trainer.locationState ?? "");
                  setLocationCountry(trainer.locationCountry ?? "");
                  setInstagramUrl(trainer.instagramUrl ?? "");
                  setFacebookUrl(trainer.facebookUrl ?? "");
                  setWhatsappUrl(trainer.whatsappUrl ?? "");
                  setSelectedSpecializationIds(
                    Array.isArray(trainer.specializations) ? trainer.specializations.map((spec) => spec.id) : []
                  );
                }
                setIsEditing(false);
              }}
            >
              <Text style={styles.secondaryActionText}>{t("cancel")}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>

    {/* ── Dropdown Modal ── */}
    <Modal visible={menuVisible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
        <View style={styles.dropdownMenu}>
          {/* Language toggle */}
          <Pressable style={styles.dropdownItem} onPress={() => { setLanguage(language === "en" ? "ro" : "en"); }}>
            <Ionicons name="language-outline" size={18} color={theme.colors.text} />
            <Text style={styles.dropdownItemText}>{t("language")}</Text>
            <View style={styles.langBadge}>
              <Text style={styles.langBadgeText}>{language === "en" ? "EN" : "RO"}</Text>
            </View>
          </Pressable>

          <View style={styles.dropdownDivider} />

          <Pressable style={styles.dropdownItem} onPress={() => { setMenuVisible(false); setIsEditing(true); }}>
            <Ionicons name="pencil" size={18} color={theme.colors.text} />
            <Text style={styles.dropdownItemText}>{t("editProfile")}</Text>
          </Pressable>

          <Pressable style={styles.dropdownItem} onPress={() => { setMenuVisible(false); handleSubscribe(); }} disabled={isSubscribing}>
            {isSubscribing ? <ActivityIndicator size="small" color={theme.colors.text} /> : <Ionicons name="receipt-outline" size={18} color={theme.colors.text} />}
            <Text style={styles.dropdownItemText}>{isSubscribing ? t("processing") : t("manageSubscription")}</Text>
          </Pressable>

          <Pressable style={styles.dropdownItem} onPress={() => { setMenuVisible(false); router.push("/legal"); }}>
            <Ionicons name="document-text-outline" size={18} color={theme.colors.text} />
            <Text style={styles.dropdownItemText}>{t("legalAndPolicies")}</Text>
          </Pressable>

          <Pressable style={styles.dropdownItem} onPress={() => { setMenuVisible(false); router.push({ pathname: "/report-issue", params: { targetType: "app" } }); }}>
            <Ionicons name="flag-outline" size={18} color={theme.colors.text} />
            <Text style={styles.dropdownItemText}>{t("reportIssue")}</Text>
          </Pressable>

          <Pressable style={styles.dropdownItem} onPress={() => { setMenuVisible(false); startTour(trainerTour); }} accessible accessibilityRole="button" accessibilityLabel={t("showTutorial")}>
            <Ionicons name="help-circle-outline" size={18} color={theme.colors.text} />
            <Text style={styles.dropdownItemText}>{t("showTutorial")}</Text>
          </Pressable>

          <View style={styles.dropdownDivider} />

          <Pressable style={styles.dropdownItem} onPress={() => { setMenuVisible(false); void handleLogout(); }}>
            <Ionicons name="log-out-outline" size={18} color={theme.colors.text} />
            <Text style={styles.dropdownItemText}>{t("logOut")}</Text>
          </Pressable>

          <Pressable style={styles.dropdownItem} onPress={() => { setMenuVisible(false); void handleDelete(); }} disabled={isDeleting}>
            <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
            <Text style={[styles.dropdownItemText, { color: theme.colors.error }]}>
              {isDeleting ? t("deleting") : t("deleteProfile")}
            </Text>
          </Pressable>

          <Pressable style={styles.dropdownItem} onPress={() => { setMenuVisible(false); void handleDeleteAccount(); }} disabled={isDeletingAccount} accessible accessibilityRole="button" accessibilityLabel={t("deleteAccount")}>
            <Ionicons name="person-remove-outline" size={18} color={theme.colors.error} />
            <Text style={[styles.dropdownItemText, { color: theme.colors.error }]}>
              {isDeletingAccount ? t("deleting") : t("deleteAccount")}
            </Text>
          </Pressable>
        </View>
      </Pressable>
      </Modal>
    </>
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
    zIndex: 1,
  },
  headerTop: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 15,
  },
  avatarRow: {
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    ...typography.h2,
    color: theme.colors.text,
  },
  menuIconButton: {
    position: "absolute",
    right: 0,
    top: -5,
    padding: 10,
  },
  backBtn: {
    position: "absolute",
    left: 0,
    top: -5,
    padding: 10,
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: 20,
    marginBottom: 20,
    ...theme.shadows.medium,
  },
  sectionTitle: {
    ...typography.h3,
    color: theme.colors.text,
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
  socialList: { gap: 6 },
  socialItem: { fontSize: 14, color: "#374151" },

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
    borderRadius: theme.roundness,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    overflow: "hidden",
    ...theme.shadows.medium,
  },
  gymsButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  gymsButtonIcon: { fontSize: 28 },
  gymsButtonTitle: {
    ...typography.body1,
    fontWeight: "700",
    color: theme.colors.primary,
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
  buttonPressed: { opacity: 0.8 },
  // ────────────────────────────────────────────────────────

  actionContainer: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  actionHeader: {
    ...typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: theme.roundness,
    gap: 8,
  },
  primaryAction: {
    backgroundColor: theme.colors.primary,
    ...theme.shadows.small,
  },
  primaryActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryAction: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryActionText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  analyticsButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    ...theme.shadows.small,
  },
  analyticsButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  analyticsButtonTitle: {
    ...typography.body1,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 2,
  },
  analyticsButtonSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  dangerZone: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    marginTop: theme.spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  actionRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRowText: {
    ...typography.body1,
    color: theme.colors.text,
    fontWeight: "600",
  },
  actionRowDestructiveText: {
    ...typography.body1,
    color: theme.colors.error,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 60,
  },
  buttonDisabled: { opacity: 0.6 },
  errorText: { fontSize: 16, color: theme.colors.error, textAlign: "center" },
  subscribeButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: theme.roundness,
    alignItems: "center",
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: theme.roundness,
    alignItems: "center",
    width: "100%",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  dropdownMenu: {
    position: "absolute",
    top: 60,
    right: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    minWidth: 220,
    ...theme.shadows.medium,
    elevation: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    ...typography.body1,
    color: theme.colors.text,
    marginLeft: 12,
    fontWeight: "600",
    flex: 1,
  },
  langBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  langBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
});

export default TrainerProfile;