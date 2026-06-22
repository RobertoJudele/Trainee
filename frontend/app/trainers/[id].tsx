import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  TextInput,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { useGetTrainerByIdQuery } from "../../features/trainer/trainerApiSlice";
import {
  useGetTrainerReviewsQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
  Review,
} from "../../features/review/reviewApiSlice";
import { selectCurrentUser } from "../../features/auth/authSlice";
import { useLanguage } from "../../src/lib/i18n/LanguageContext";
import { UserRole } from "../../features/auth/authApiSlice";
import { theme, typography } from "../../src/lib/theme";
import { Ionicons } from '@expo/vector-icons';
import TrainerImageCarousel from "../../src/components/TrainerImageCarousel";
import { useGetTrainerPackagesQuery } from "../../features/trainer/trainerPackageApiSlice";

type ContactOption = {
  label: "Instagram" | "Facebook" | "WhatsApp";
  url: string;
  fallbackUrl?: string;
};

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

const normalizeSocialUrl = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    new URL(normalized);
    return normalized;
  } catch {
    return null;
  }
};

const normalizeWhatsAppPhoneDigits = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedPrefix = trimmed.startsWith("00")
    ? `+${trimmed.slice(2)}`
    : trimmed;

  const digits = normalizedPrefix.replace(/\D/g, "");
  if (!digits || digits.length < 7 || digits.length > 15) {
    return null;
  }

  if (!/^[1-9]/.test(digits)) {
    return null;
  }

  return digits;
};

const getWhatsAppContactUrls = (
  value?: string | null
): { appUrl: string; webUrl: string } | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let phoneDigits = normalizeWhatsAppPhoneDigits(trimmed);

  if (!phoneDigits) {
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
      }

      phoneDigits = normalizeWhatsAppPhoneDigits(phoneCandidate);
    } catch {
      phoneDigits = null;
    }
  }

  if (!phoneDigits) {
    return null;
  }

  return {
    appUrl: `whatsapp://send?phone=${phoneDigits}`,
    webUrl: `https://wa.me/${phoneDigits}`,
  };
};

type ReviewFormMode = "idle" | "write" | "edit";

export default function TrainerDetailsScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const params = useLocalSearchParams<TrainerRouteParams>();
  const currentUser = useSelector(selectCurrentUser);

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
    refetchOnMountOrArgChange: true,
  });

  const trainerInternalId = trainer?.internalId;

  const { data: reviewsData } = useGetTrainerReviewsQuery(trainerInternalId!, {
    skip: !trainerInternalId,
  });
  const reviews = reviewsData?.data ?? [];

  const { data: packagesResponse } = useGetTrainerPackagesQuery(trainerInternalId!, {
    skip: !trainerInternalId,
  });
  const trainerPackages = packagesResponse?.data ?? [];

  const [createReview, { isLoading: isCreating }] = useCreateReviewMutation();
  const [updateReview, { isLoading: isUpdating }] = useUpdateReviewMutation();
  const [deleteReview, { isLoading: isDeleting }] = useDeleteReviewMutation();

  const [reviewMode, setReviewMode] = useState<ReviewFormMode>("idle");
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [formRating, setFormRating] = useState(5);
  const [formText, setFormText] = useState("");

  const myReview = reviews.find((r) => r.client?.id === currentUser?.id);
  const canWriteReview =
    currentUser?.role === UserRole.CLIENT &&
    !myReview &&
    reviewMode === "idle";

  const openWriteForm = useCallback(() => {
    setFormRating(5);
    setFormText("");
    setEditingReviewId(null);
    setReviewMode("write");
  }, []);

  const openEditForm = useCallback((review: Review) => {
    setFormRating(review.rating);
    setFormText(review.reviewText ?? "");
    setEditingReviewId(review.id);
    setReviewMode("edit");
  }, []);

  const cancelForm = useCallback(() => {
    setReviewMode("idle");
    setEditingReviewId(null);
  }, []);

  const submitReview = useCallback(async () => {
    if (!trainerInternalId) return;
    const text = formText.trim();
    if (text && text.length < 10) {
      Alert.alert(t("tooShort"), t("reviewTooShort"));
      return;
    }
    if (text && text.length > 100) {
      Alert.alert(t("tooLong"), t("reviewTooLong"));
      return;
    }
    try {
      if (reviewMode === "write") {
        await createReview({
          trainerId: trainerInternalId,
          rating: formRating,
          reviewText: text || undefined,
        }).unwrap();
      } else if (reviewMode === "edit" && editingReviewId) {
        await updateReview({
          reviewId: editingReviewId,
          trainerId: trainerInternalId,
          rating: formRating,
          reviewText: text || undefined,
        }).unwrap();
      }
      setReviewMode("idle");
      setEditingReviewId(null);
    } catch (err: any) {
      Alert.alert(t("error"), err?.data?.message || t("couldNotSaveReview"));
    }
  }, [trainerInternalId, reviewMode, formRating, formText, editingReviewId, createReview, updateReview, t]);

  const handleDeleteReview = useCallback((reviewId: number) => {
    if (!trainerInternalId) return;
    Alert.alert(t("deleteReview"), t("deleteReviewConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteReview({ reviewId, trainerId: trainerInternalId }).unwrap();
          } catch (err: any) {
            Alert.alert(t("error"), err?.data?.message || t("couldNotDeleteReview"));
          }
        },
      },
    ]);
  }, [trainerInternalId, deleteReview, t]);

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
  const bio = trainer?.bio ?? params.bio ?? t("noBioAvailable");
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

  const contactOptions = React.useMemo<ContactOption[]>(() => {
    const options: ContactOption[] = [];

    const instagramUrl = normalizeSocialUrl(trainer?.instagramUrl);
    if (instagramUrl) {
      options.push({ label: "Instagram", url: instagramUrl });
    }

    const facebookUrl = normalizeSocialUrl(trainer?.facebookUrl);
    if (facebookUrl) {
      options.push({ label: "Facebook", url: facebookUrl });
    }

    const whatsappContactUrls = getWhatsAppContactUrls(trainer?.whatsappUrl);
    if (whatsappContactUrls) {
      options.push({
        label: "WhatsApp",
        url: whatsappContactUrls.appUrl,
        fallbackUrl: whatsappContactUrls.webUrl,
      });
    }

    return options;
  }, [trainer?.facebookUrl, trainer?.instagramUrl, trainer?.whatsappUrl]);

  const openContactUrl = React.useCallback(async (url: string, fallbackUrl?: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return;
      }

      if (fallbackUrl) {
        const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
        if (canOpenFallback) {
          await Linking.openURL(fallbackUrl);
          return;
        }
      }

      Alert.alert(t("unavailable"), t("couldNotOpenSocial"));
    } catch {
      Alert.alert(t("error"), t("failedOpenSocial"));
    }
  }, [t]);

  const handleContactPress = React.useCallback(() => {
    if (contactOptions.length === 0) {
      return;
    }

    Alert.alert(
      t("contactTrainer"),
      t("choosePlatform"),
      contactOptions.slice(0, 3).map((option) => ({
        text: option.label,
        onPress: () => {
          void openContactUrl(option.url, option.fallbackUrl);
        },
      })),
      { cancelable: true }
    );
  }, [contactOptions, openContactUrl, t]);

  if (!hasValidTrainerId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t("invalidTrainer")}</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.back()}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t("goBackButton")}
        >
          <Text style={styles.primaryButtonText}>{t("goBackButton")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading || isFetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t("loadingTrainerDetails")}</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t("couldNotLoadTrainer")}</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => refetch()}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t("tryAgain")}
        >
          <Text style={styles.primaryButtonText}>{t("tryAgain")}</Text>
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
          <Text style={styles.availabilityText}>{isAvailable ? t("available") : t("unavailable")}</Text>
        </View>

        <View style={styles.ratingRow}>
          <Ionicons name="star" size={16} color="#F59E0B" />
          <Text style={styles.ratingText}>{Number(rating).toFixed(1)}</Text>
          <Text style={styles.reviewsText}>({reviewCount} {t("reviewsCount")})</Text>
        </View>

        <View style={styles.viewRow}>
          <Ionicons name="eye-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={styles.viewText}>{trainer?.profileViews ?? 0} {t("viewsCount")}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("about")}</Text>
        <Text style={styles.sectionText}>{bio}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("experienceAndRates")}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t("experience")}</Text>
          <Text style={styles.infoValue}>{experienceYears} {t("years")}</Text>
        </View>
        {sessionRate && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("sessionRate")}</Text>
            <Text style={styles.infoValue}>{t("fromPerSession").replace("%s", String(sessionRate))}</Text>
          </View>
        )}
      </View>

      {trainerPackages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("myPackages")}</Text>
          {trainerPackages.map((pkg) => (
            <View key={pkg.id} style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'}}>
              <View>
                <Text style={{fontSize: 15, fontWeight: '600', color: theme.colors.text}}>{pkg.name}</Text>
                <Text style={{fontSize: 13, color: theme.colors.textSecondary, marginTop: 2}}>
                  {pkg.sessionCount} {t("sessions")}
                </Text>
              </View>
              <Text style={{fontSize: 16, fontWeight: '700', color: theme.colors.primary}}>${Number(pkg.price).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("location")}</Text>
        <Text style={styles.sectionText}>{locationText || t("locationNotSpecified")}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("availableGyms")}</Text>
        {trainer?.availableGyms && trainer.availableGyms.length > 0 ? (
          trainer.availableGyms.map((gym) => (
            <View key={gym.id} style={styles.gymRow}>
              <View style={styles.gymMeta}>
                <Text style={styles.gymName}>{gym.name}</Text>
                <Text style={styles.gymAddress}>
                  {[gym.address, gym.city, gym.state].filter(Boolean).join(", ")}
                </Text>
              </View>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name="star" size={12} color="#F59E0B" style={{marginRight: 2}} />
                <Text style={styles.gymRating}>{Number(gym.rating ?? 0).toFixed(1)}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.sectionText}>{t("noAvailableGyms")}</Text>
        )}
      </View>

      {trainer?.galleryImages && trainer.galleryImages.length > 0 && (
        <TrainerImageCarousel title="Gallery" images={trainer.galleryImages} />
      )}

      {trainer?.credentialImages && trainer.credentialImages.length > 0 && (
        <TrainerImageCarousel
          title="Certifications & Awards"
          images={trainer.credentialImages}
          resizeMode="contain"
        />
      )}

      {/* ── Reviews ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("reviews")} ({reviews.length})</Text>

        {reviews.length === 0 && reviewMode === "idle" && (
          <Text style={styles.sectionText}>{t("noReviewsYet")}</Text>
        )}

        {reviews.map((review) => {
          const isOwn = review.client?.id === currentUser?.id;
          return (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewerAvatar}>
                  <Text style={styles.reviewerInitial}>
                    {review.client?.firstName?.[0] ?? "?"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewerName}>
                    {review.client
                      ? `${review.client.firstName} ${review.client.lastName}`
                      : "Anonymous"}
                  </Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= review.rating ? "star" : "star-outline"}
                        size={13}
                        color="#F59E0B"
                      />
                    ))}
                  </View>
                </View>
                {isOwn && (
                  <View style={styles.reviewActions}>
                    <Pressable
                      onPress={() => openEditForm(review)}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel="Edit review"
                      style={styles.reviewActionBtn}
                    >
                      <Ionicons name="pencil-outline" size={16} color={theme.colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteReview(review.id)}
                      disabled={isDeleting}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel="Delete review"
                      style={styles.reviewActionBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                    </Pressable>
                  </View>
                )}
              </View>
              {review.reviewText ? (
                <Text style={styles.reviewText}>{review.reviewText}</Text>
              ) : null}
            </View>
          );
        })}

        {/* Write / Edit form */}
        {(reviewMode === "write" || reviewMode === "edit") && (
          <View style={styles.reviewForm}>
            <Text style={styles.reviewFormTitle}>
              {reviewMode === "edit" ? t("editYourReview") : t("writeAReview")}
            </Text>
            <View style={styles.starSelector}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setFormRating(s)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${s} star${s !== 1 ? "s" : ""}`}
                >
                  <Ionicons
                    name={s <= formRating ? "star" : "star-outline"}
                    size={30}
                    color="#F59E0B"
                    style={{ marginHorizontal: 4 }}
                  />
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder={t("addComment")}
              placeholderTextColor={theme.colors.textSecondary}
              value={formText}
              onChangeText={setFormText}
              multiline
              maxLength={100}
            />
            <Text style={styles.charCount}>{formText.length}/100</Text>
            <View style={styles.reviewFormActions}>
              <Pressable
                style={styles.cancelFormBtn}
                onPress={cancelForm}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelFormBtnText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable
                style={[styles.submitFormBtn, (isCreating || isUpdating) && { opacity: 0.6 }]}
                onPress={submitReview}
                disabled={isCreating || isUpdating}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Submit review"
              >
                <Text style={styles.submitFormBtnText}>
                  {isCreating || isUpdating ? t("saving") : t("submit")}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {canWriteReview && (
          <Pressable
            style={styles.writeReviewBtn}
            onPress={openWriteForm}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Write a review"
          >
            <Ionicons name="star-outline" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.writeReviewBtnText}>{t("writeReview")}</Text>
          </Pressable>
        )}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.back()}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={t("backToMap")}
      >
        <Text style={styles.primaryButtonText}>{t("backToMap")}</Text>
      </TouchableOpacity>

      {contactOptions.length > 0 && (
        <TouchableOpacity
          style={styles.contactButton}
          onPress={handleContactPress}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t("contactTrainer")}
        >
          <Text style={styles.contactButtonText}>{t("contact")}</Text>
        </TouchableOpacity>
      )}

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
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={t("reportIssue")}
      >
        <Text style={styles.secondaryButtonText}>{t("reportIssue")}</Text>
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: theme.spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
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
  viewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
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
  viewText: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
    ...theme.shadows.small,
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
    borderRadius: theme.roundness,
    paddingVertical: 14,
    alignItems: "center",
    ...theme.shadows.medium,
  },
  primaryButtonText: {
    ...typography.body1,
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButton: {
    marginTop: 2,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.error,
    ...theme.shadows.small,
  },
  secondaryButtonText: {
    ...typography.body1,
    color: "#B91C1C",
    fontWeight: "700",
  },
  contactButton: {
    marginTop: 2,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness,
    paddingVertical: 14,
    alignItems: "center",
    ...theme.shadows.medium,
  },
  contactButtonText: {
    ...typography.body1,
    color: "#fff",
    fontWeight: "700",
  },
  reviewCard: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
    gap: 6,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  reviewerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewerInitial: {
    ...typography.caption,
    color: "#fff",
    fontWeight: "800",
  },
  reviewerName: {
    ...typography.body2,
    color: theme.colors.text,
    fontWeight: "700",
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },
  reviewActions: {
    flexDirection: "row",
    gap: 8,
    marginLeft: "auto",
  },
  reviewActionBtn: {
    padding: 4,
  },
  reviewText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginLeft: 44,
  },
  writeReviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignSelf: "flex-start",
  },
  writeReviewBtnText: {
    ...typography.body2,
    color: theme.colors.primary,
    fontWeight: "700",
  },
  reviewForm: {
    marginTop: 8,
    gap: 10,
  },
  reviewFormTitle: {
    ...typography.body1,
    color: theme.colors.text,
    fontWeight: "700",
  },
  starSelector: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    ...typography.body2,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  charCount: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    alignSelf: "flex-end",
  },
  reviewFormActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  cancelFormBtnText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    fontWeight: "700",
  },
  submitFormBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    ...theme.shadows.small,
  },
  submitFormBtnText: {
    ...typography.body2,
    color: "#fff",
    fontWeight: "700",
  },
});
