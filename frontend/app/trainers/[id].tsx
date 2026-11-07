import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
  AlertButton,
  Linking,
  TextInput,
  Pressable,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useSelector } from "react-redux";
import {
  useGetTrainerByIdQuery,
  useRecordTrainerContactMutation,
} from "../../features/trainer/trainerApiSlice";
import {
  useGetTrainerReviewsQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
  Review,
} from "../../features/review/reviewApiSlice";
import { useGetMyTrainersQuery } from "../../features/trainer/trainerInviteApiSlice";
import { selectCurrentUser } from "../../features/auth/authSlice";
import {
  useGetBlockedUsersQuery,
  useBlockUserMutation,
  useUnblockUserMutation,
} from "../../features/block/blockApiSlice";
import { useLanguage } from "../../src/lib/i18n/LanguageContext";
import { UserRole } from "../../features/auth/authApiSlice";
import { theme, typography, presets } from "../../src/lib/theme";
import { Button, FieldError } from "../../src/components/ui";
import { useFieldErrors } from "../../src/lib/useFieldErrors";
import { Ionicons } from '@expo/vector-icons';
import TrainerImageCarousel from "../../src/components/TrainerImageCarousel";
import { useGetTrainerPackagesQuery } from "../../features/trainer/trainerPackageApiSlice";
import { getApiErrorMessage } from "../../src/lib/errors";
import { formatFromPerSession } from "../../src/lib/price";
import {
  summarizePrices,
  formatLei,
  roCount,
  contactButtonLabel,
  ContactChannel,
} from "../../src/lib/trainerPage";
// Extracted so they can be unit-tested: the raw-digit fallback used to turn any
// URL with enough digits in it (a Facebook profile id, say) into a WhatsApp
// number. See src/lib/__tests__/contactLinks.test.ts.
import {
  normalizeSocialUrl,
  getWhatsAppContactUrls,
} from "../../src/lib/contactLinks";
import { fonts } from '../../src/lib/fonts';

type ContactOption = {
  label: "Instagram" | "Facebook" | "WhatsApp";
  /** Reported to the server when tapped; see recordTrainerContact. */
  channel: "instagram" | "facebook" | "whatsapp";
  url: string;
  fallbackUrl?: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
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
    isError,
    refetch,
  } = useGetTrainerByIdQuery(trainerPublicId, {
    skip: !hasValidTrainerId,
    refetchOnMountOrArgChange: true,
  });

  const trainerInternalId = trainer?.internalId;
  const [recordTrainerContact] = useRecordTrainerContactMutation();

  const { data: blockedData } = useGetBlockedUsersQuery();
  const blockedIds = React.useMemo(
    () => new Set((blockedData?.data ?? []).map((u) => u.id)),
    [blockedData]
  );
  const [blockUser] = useBlockUserMutation();
  const [unblockUser] = useUnblockUserMutation();
  const trainerUserId = trainer?.userId;
  const isTrainerBlocked =
    typeof trainerUserId === "number" && blockedIds.has(trainerUserId);

  const { data: reviewsData } = useGetTrainerReviewsQuery(trainerInternalId!, {
    skip: !trainerInternalId,
  });
  // ponytail: block filtering is client-side. Reviews are served from a public
  // (unauthenticated) endpoint, so the blocker's identity isn't known server-side.
  // Move to server-side (optional-auth on GET /reviews) if network-level hiding is needed.
  const reviews = (reviewsData?.data ?? []).filter(
    (r) => !r.client || !blockedIds.has(r.client.id)
  );

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
  const fieldErrors = useFieldErrors<"text">();

  const myReview = reviews.find((r) => r.client?.id === currentUser?.id);

  // Reviews are limited to the trainer's own clients (server enforces it too, with a
  // 403). Checking here keeps the button from appearing only to fail on submit.
  const { data: myTrainersResp } = useGetMyTrainersQuery(undefined, {
    skip: currentUser?.role !== UserRole.CLIENT,
  });
  const isMyTrainer = (myTrainersResp?.data ?? []).some(
    (entry) => entry.trainerId === trainerInternalId
  );

  const canWriteReview =
    currentUser?.role === UserRole.CLIENT &&
    isMyTrainer &&
    !myReview &&
    reviewMode === "idle";
  const showReviewGateHint =
    currentUser?.role === UserRole.CLIENT &&
    !isMyTrainer &&
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
    fieldErrors.setAll({});
  }, [fieldErrors]);

  const submitReview = useCallback(async () => {
    if (!trainerInternalId) return;
    const text = formText.trim();
    const valid = fieldErrors.setAll({
      ...(text && text.length < 10 ? { text: t("reviewTooShort") } : {}),
      ...(text && text.length > 100 ? { text: t("reviewTooLong") } : {}),
    });
    if (!valid) return;
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
    } catch (err: unknown) {
      // 403 is the "not your trainer" gate; server messages are English-only.
      const message =
        (err as { status?: number })?.status === 403
          ? t("reviewRequiresSession")
          : getApiErrorMessage(err, t("couldNotSaveReview"));
      Alert.alert(t("error"), message);
    }
  }, [trainerInternalId, reviewMode, formRating, formText, editingReviewId, createReview, updateReview, fieldErrors, t]);

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
          } catch (err: unknown) {
            Alert.alert(t("error"), getApiErrorMessage(err, t("couldNotDeleteReview")));
          }
        },
      },
    ]);
  }, [trainerInternalId, deleteReview, t]);

  const doBlockUser = useCallback(async (userId: number) => {
    try {
      await blockUser({ blockedUserId: userId }).unwrap();
    } catch (err: unknown) {
      Alert.alert(t("error"), getApiErrorMessage(err, t("couldNotBlockUser")));
    }
  }, [blockUser, t]);

  const handleUnblockTrainer = useCallback(async () => {
    const userId = trainer?.userId;
    if (typeof userId !== "number") return;
    try {
      await unblockUser(userId).unwrap();
    } catch (err: unknown) {
      Alert.alert(t("error"), getApiErrorMessage(err, t("couldNotUnblockUser")));
    }
  }, [trainer?.userId, unblockUser, t]);

  const handleBlockTrainer = useCallback(() => {
    const userId = trainer?.userId;
    if (typeof userId !== "number") return;
    Alert.alert(t("blockTrainerTitle"), t("blockTrainerConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("block"), style: "destructive", onPress: () => void doBlockUser(userId) },
    ]);
  }, [trainer?.userId, doBlockUser, t]);

  const handleReviewOptions = useCallback((review: Review) => {
    const authorId = review.client?.id;
    const buttons: AlertButton[] = [
      {
        text: t("reportReview"),
        onPress: () =>
          router.push({
            pathname: "/report-issue",
            params: {
              targetType: "review",
              reviewId: String(review.id),
              trainerId: trainerInternalId ? String(trainerInternalId) : "",
            },
          }),
      },
    ];
    if (typeof authorId === "number") {
      buttons.push({
        text: t("blockUser"),
        style: "destructive",
        onPress: () => void doBlockUser(authorId),
      });
    }
    buttons.push({ text: t("cancel"), style: "cancel" });
    Alert.alert(t("reviewOptions"), undefined, buttons);
  }, [t, router, trainerInternalId, doBlockUser]);

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
  // Match the "from" price the card that led here advertised: cheapest per-session
  // across packages, falling back to the flat session rate.
  const minSessionPriceLabel = formatFromPerSession(
    trainer?.minSessionPrice ?? sessionRate,
    t
  );
  const bio = trainer?.bio ?? params.bio ?? t("noBioAvailable");
  const specializations = trainer?.specializations ?? [];
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

  const firstName = trainer?.user?.firstName ?? params.firstName ?? "";
  // The first message a shy client would otherwise have to write themselves.
  // WhatsApp opens with it typed in; Instagram and Facebook can't take text in a
  // link, so for those it goes to the clipboard instead (see handleContact).
  const prefilledMessage = firstName
    ? t("contactPrefill").replace("%s", firstName)
    : t("contactPrefill").replace(", %s", "").replace(" %s", "");

  // WhatsApp first: it is the only channel that can carry the pre-filled message.
  const contactOptions = React.useMemo<ContactOption[]>(() => {
    const options: ContactOption[] = [];

    const whatsappContactUrls = getWhatsAppContactUrls(trainer?.whatsappUrl, prefilledMessage);
    if (whatsappContactUrls) {
      options.push({
        label: "WhatsApp",
        channel: "whatsapp",
        url: whatsappContactUrls.appUrl,
        fallbackUrl: whatsappContactUrls.webUrl,
        icon: "logo-whatsapp",
        color: "#25D366",
      });
    }

    const instagramUrl = normalizeSocialUrl(trainer?.instagramUrl);
    if (instagramUrl) {
      options.push({ label: "Instagram", channel: "instagram", url: instagramUrl, icon: "logo-instagram", color: "#E1306C" });
    }

    const facebookUrl = normalizeSocialUrl(trainer?.facebookUrl);
    if (facebookUrl) {
      options.push({ label: "Facebook", channel: "facebook", url: facebookUrl, icon: "logo-facebook", color: "#1877F2" });
    }

    return options;
  }, [trainer?.facebookUrl, trainer?.instagramUrl, trainer?.whatsappUrl, prefilledMessage]);

  const primaryContact = contactOptions[0];
  const otherContacts = contactOptions.slice(1);

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

  const handleContact = useCallback(async (option: ContactOption) => {
    // Sent before opening the link: once WhatsApp or Instagram is in
    // front, the app may be suspended before a later request leaves.
    // A tracking failure must never get in the way of the contact.
    recordTrainerContact({ trainerId: trainerPublicId, channel: option.channel })
      .unwrap()
      .catch(() => {});
    if (option.channel !== "whatsapp") {
      await Clipboard.setStringAsync(prefilledMessage).catch(() => {});
    }
    await openContactUrl(option.url, option.fallbackUrl);
  }, [recordTrainerContact, trainerPublicId, prefilledMessage, openContactUrl]);

  const handleMoreOptions = useCallback(() => {
    Alert.alert(fullName, undefined, [
      {
        text: t("reportIssue"),
        onPress: () =>
          router.push({
            pathname: "/report-issue",
            params: {
              targetType: "trainer",
              trainerId: trainer?.internalId ? String(trainer.internalId) : "",
              trainerPublicId,
            },
          }),
      },
      { text: t("blockTrainer"), style: "destructive", onPress: handleBlockTrainer },
      { text: t("cancel"), style: "cancel" },
    ]);
  }, [fullName, t, router, trainer?.internalId, trainerPublicId, handleBlockTrainer]);

  // ── Price ──
  // One summary feeds the headline, the rows and the bottom bar, so they can't
  // disagree. "de la" only when there really are several prices.
  const priceSummary = summarizePrices(sessionRate, trainerPackages);
  const lang = language === "ro" ? "ro" : "en";
  const priceHeadline = priceSummary
    ? t(priceSummary.showFrom ? "priceFromHeadline" : "priceHeadline").replace(
        "%s",
        formatLei(priceSummary.lowest, lang)
      )
    : minSessionPriceLabel;

  // The bar repeats the price only once the price above has scrolled away.
  const insets = useSafeAreaInsets();
  const priceBottomRef = useRef(0);
  const [priceScrolledAway, setPriceScrolledAway] = useState(false);
  const onPriceLayout = useCallback((e: LayoutChangeEvent) => {
    priceBottomRef.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
  }, []);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const away = e.nativeEvent.contentOffset.y > priceBottomRef.current;
    setPriceScrolledAway((prev) => (prev === away ? prev : away));
  }, []);

  // ── Facts line: "Forță, slăbire · 6 ani · 4,8 din 23 de recenzii" ──
  const yearsText =
    experienceYears > 0
      ? lang === "ro"
        ? roCount(experienceYears, "an", "ani")
        : `${experienceYears} ${experienceYears === 1 ? "year" : "years"}`
      : null;
  const ratingText = Number(rating).toFixed(1).replace(".", lang === "ro" ? "," : ".");
  const reviewsText =
    reviewCount > 0
      ? t("reviewsSummary")
          .replace("%r", ratingText)
          .replace(
            "%n",
            lang === "ro"
              ? roCount(reviewCount, "recenzie", "recenzii")
              : `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`
          )
      : t("noReviewsOnSalvio");
  const factsLine = [
    specializations.map((spec) => spec.name).join(", "),
    yearsText,
    reviewsText,
  ]
    .filter(Boolean)
    .join(" · ");

  // The first sentence of the bio, in the trainer's own voice, reads as a quote.
  const bioText = (trainer?.bio ?? params.bio ?? "").trim();
  const bioMatch = bioText.match(/^(.{12,140}?[.!?])\s+([\s\S]+)$/);
  const bioQuote = bioMatch ? bioMatch[1] : null;
  const bioRest = bioMatch ? bioMatch[2] : bioText;

  const photoUrl = trainer?.user?.profileImageUrl ?? params.profileImageUrl ?? null;
  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

  // isLoading only: a refetch keeps the cached data, so there is no reason to replace
  // the whole screen with a spinner once something is already on it.
  if (isLoading) {
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

  if (isTrainerBlocked) {
    return (
      <View style={styles.centered}>
        <Ionicons name="ban-outline" size={48} color={theme.colors.textSecondary} />
        <Text style={styles.errorText}>{t("trainerBlocked")}</Text>
        <Text style={styles.loadingText}>{t("trainerBlockedHint")}</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleUnblockTrainer}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t("unblock")}
        >
          <Text style={styles.primaryButtonText}>{t("unblock")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t("goBackButton")}
          style={{ marginTop: 12 }}
        >
          <Text style={{ color: theme.colors.textSecondary }}>{t("goBackButton")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const barHeight = 52 + 24 + Math.max(insets.bottom, 12);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: barHeight + 32 }}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {/* ── Photo, with the name below it rather than over it ── */}
        <View style={styles.photoWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={[styles.photo, styles.photoFallback]}>
              <Text style={styles.photoInitials}>{initials}</Text>
            </View>
          )}
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            style={[styles.overlayButton, { top: insets.top + 8, left: 12 }]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t("goBack")}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={handleMoreOptions}
            style={[styles.overlayButton, { top: insets.top + 8, right: 12 }]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t("a11yMoreOptions")}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{fullName}</Text>
          {factsLine ? <Text style={styles.facts}>{factsLine}</Text> : null}
          <Text style={[styles.availability, !isAvailable && styles.availabilityOff]}>
            {isAvailable ? t("acceptsNewClients") : t("notTakingClients")}
          </Text>

          {/* ── Price, second thing on screen ── */}
          {priceHeadline ? (
            <View onLayout={onPriceLayout} style={styles.priceBlock}>
              <Text style={styles.priceHeadline}>{priceHeadline}</Text>
              {priceSummary && priceSummary.options.length > 1 ? (
                <View style={styles.priceRows}>
                  {priceSummary.options.map((option, index) => (
                    <View
                      key={`${option.kind}-${option.name ?? ""}-${index}`}
                      style={[styles.priceRow, index === priceSummary.options.length - 1 && styles.priceRowLast]}
                    >
                      <Text style={styles.priceRowLabel}>
                        {option.kind === "single" ? t("oneSessionRow") : option.name}
                        {option.kind === "package" ? (
                          <Text style={styles.priceRowMuted}>
                            {"  ·  "}
                            {t("perSessionSuffix").replace("%s", formatLei(option.perSession, lang))}
                          </Text>
                        ) : null}
                      </Text>
                      <Text style={styles.priceRowValue}>{formatLei(option.total, lang)} lei</Text>
                    </View>
                  ))}
                </View>
              ) : priceSummary ? (
                <Text style={styles.priceNote}>{t("singleSessionsOnly")}</Text>
              ) : null}
              {firstName ? (
                <Text style={styles.priceSetBy}>{t("pricesSetBy").replace("%s", firstName)}</Text>
              ) : null}
            </View>
          ) : null}

          {/* ── About ── */}
          {bioText ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {firstName ? t("aboutName").replace("%s", firstName) : t("about")}
              </Text>
              {bioQuote ? <Text style={styles.bioQuote}>„{bioQuote}”</Text> : null}
              {bioRest ? <Text style={styles.bodyText}>{bioRest}</Text> : null}
            </View>
          ) : null}

          {/* ── Where they train ── */}
          {trainer?.availableGyms && trainer.availableGyms.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("whereTheyTrain")}</Text>
              <View>
                {trainer.availableGyms.map((gym, index) => (
                  <View
                    key={gym.id}
                    style={[styles.gymRow, index === trainer.availableGyms!.length - 1 && styles.gymRowLast]}
                  >
                    <Text style={styles.gymName}>{gym.name}</Text>
                    <Text style={styles.gymAddress}>
                      {[gym.address, gym.city].filter(Boolean).join(", ")}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : locationText ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("whereTheyTrain")}</Text>
              <Text style={styles.bodyText}>{t("trainsIn").replace("%s", locationText)}</Text>
            </View>
          ) : null}

          {trainer?.galleryImages && trainer.galleryImages.length > 0 && (
            <TrainerImageCarousel title={t("gallery")} images={trainer.galleryImages} />
          )}

          {trainer?.credentialImages && trainer.credentialImages.length > 0 && (
            <TrainerImageCarousel
              title={t("certificationsAwards")}
              images={trainer.credentialImages}
              resizeMode="contain"
            />
          )}

          {/* ── Reviews ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("whatClientsSay")}</Text>

            {reviews.length === 0 && reviewMode === "idle" && (
              <Text style={styles.bodyText}>{t("noReviewsYet")}</Text>
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
                          accessibilityLabel={t("a11yEditReview")}
                          style={styles.reviewActionBtn}
                        >
                          <Ionicons name="pencil-outline" size={16} color={theme.colors.primary} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteReview(review.id)}
                          disabled={isDeleting}
                          accessible
                          accessibilityRole="button"
                          accessibilityLabel={t("deleteReview")}
                          style={styles.reviewActionBtn}
                        >
                          <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                        </Pressable>
                      </View>
                    )}
                    {!isOwn && (
                      <Pressable
                        onPress={() => handleReviewOptions(review)}
                        accessible
                        accessibilityRole="button"
                        accessibilityLabel={t("reviewOptions")}
                        style={styles.reviewActionBtn}
                      >
                        <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.textSecondary} />
                      </Pressable>
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
                  style={[styles.reviewInput, fieldErrors.errors.text && presets.inputError]}
                  placeholder={t("addComment")}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formText}
                  onChangeText={(v) => { fieldErrors.clear("text"); setFormText(v); }}
                  multiline
                  maxLength={100}
                />
                <FieldError message={fieldErrors.errors.text} />
                <Text style={styles.charCount}>{formText.length}/100</Text>
                <View style={styles.reviewFormActions}>
                  <Pressable
                    style={styles.cancelFormBtn}
                    onPress={cancelForm}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t("cancel")}
                  >
                    <Text style={styles.cancelFormBtnText}>{t("cancel")}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitFormBtn, (isCreating || isUpdating) && { opacity: 0.6 }]}
                    onPress={submitReview}
                    disabled={isCreating || isUpdating}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t("submit")}
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
                accessibilityLabel={t("writeReview")}
              >
                <Ionicons name="star-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.writeReviewBtnText}>{t("writeReview")}</Text>
              </Pressable>
            )}

            {showReviewGateHint && (
              <Text style={styles.bodyText}>{t("reviewRequiresSession")}</Text>
            )}
          </View>

          {/* ── Other ways to get in touch ── */}
          {otherContacts.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("otherContactWays")}</Text>
              <View style={styles.otherContacts}>
                {otherContacts.map((option) => (
                  <Button
                    key={option.channel}
                    title={option.label}
                    icon={option.icon}
                    variant="secondary"
                    size="md"
                    style={{ flex: 1 }}
                    onPress={() => void handleContact(option)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Contact bar, always within reach ── */}
      {primaryContact ? (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.barRow}>
            {priceScrolledAway && priceSummary ? (
              <View style={styles.barPrice}>
                {priceSummary.showFrom ? (
                  <Text style={styles.barPriceFrom}>{lang === "ro" ? "de la" : "from"}</Text>
                ) : null}
                <Text style={styles.barPriceValue}>{formatLei(priceSummary.lowest, lang)} lei</Text>
              </View>
            ) : null}
            <Button
              title={contactButtonLabel(
                primaryContact.channel as ContactChannel,
                lang,
                firstName,
                trainer?.contactNameDative
              )}
              style={{ flex: 1 }}
              onPress={() => void handleContact(primaryContact)}
            />
            {primaryContact.channel === "whatsapp" && otherContacts[0] ? (
              <Pressable
                onPress={() => void handleContact(otherContacts[0])}
                style={styles.barIconButton}
                accessibilityRole="button"
                accessibilityLabel={otherContacts[0].label}
              >
                <Ionicons name={otherContacts[0].icon} size={22} color={theme.colors.text} />
              </Pressable>
            ) : null}
          </View>
          {primaryContact.channel !== "whatsapp" ? (
            <Text style={styles.barHint}>{t("contactCopiedHint")}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  photoWrap: {
    position: "relative",
  },
  photo: {
    width: "100%",
    height: 300,
    backgroundColor: theme.colors.surfaceSunken,
  },
  photoFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  photoInitials: {
    ...typography.display,
    fontSize: 72,
    lineHeight: 80,
    color: theme.colors.textSecondary,
  },
  overlayButton: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  name: {
    ...typography.display,
    fontSize: 40,
    lineHeight: 44,
    color: theme.colors.text,
  },
  facts: {
    ...typography.small,
    fontSize: 15,
    lineHeight: 22,
    color: "#334155",
    marginTop: 6,
  },
  availability: {
    ...typography.small,
    fontSize: 15,
    fontFamily: fonts.uiSemiBold,
    color: "#065F46",
    marginTop: 4,
  },
  availabilityOff: {
    color: theme.colors.textSecondary,
  },
  priceBlock: {
    marginTop: 20,
  },
  priceHeadline: {
    fontFamily: fonts.uiBold,
    fontSize: 24,
    lineHeight: 30,
    color: theme.colors.text,
  },
  priceRows: {
    marginTop: 10,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  priceRowLast: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  priceRowLabel: {
    ...typography.body,
    fontSize: 15,
    color: theme.colors.text,
    flexShrink: 1,
  },
  priceRowMuted: {
    color: theme.colors.textSecondary,
  },
  priceRowValue: {
    ...typography.price,
    fontSize: 15,
    color: theme.colors.text,
  },
  priceNote: {
    ...typography.body,
    fontSize: 15,
    color: "#334155",
    marginTop: 6,
  },
  priceSetBy: {
    ...typography.small,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  section: {
    marginTop: 40,
    gap: 10,
  },
  sectionTitle: {
    ...typography.heading,
    color: theme.colors.text,
  },
  bioQuote: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 20,
    lineHeight: 28,
    color: theme.colors.text,
  },
  bodyText: {
    ...typography.body,
    color: "#334155",
  },
  gymRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  gymRowLast: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  gymName: {
    ...typography.body,
    fontFamily: fonts.uiBold,
    color: theme.colors.text,
  },
  gymAddress: {
    ...typography.small,
    color: theme.colors.textSecondary,
    textAlign: "right",
    flexShrink: 1,
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.control,
    height: 52,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    ...typography.button,
    color: "#fff",
  },
  otherContacts: {
    flexDirection: "row",
    gap: 10,
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    ...theme.shadows.medium,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  barPrice: {
    flexShrink: 0,
  },
  barPriceFrom: {
    ...typography.small,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },
  barPriceValue: {
    ...typography.price,
    color: theme.colors.text,
  },
  barIconButton: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.control,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  barHint: {
    ...typography.small,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
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
    ...typography.label,
    color: "#fff",
    fontFamily: fonts.monoSemiBold,
  },
  reviewerName: {
    ...typography.body2,
    color: theme.colors.text,
    fontFamily: fonts.uiBold,
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
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
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
    gap: 6,
    marginTop: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: theme.radius.control,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    alignSelf: "flex-start",
  },
  writeReviewBtnText: {
    ...typography.button,
    fontSize: 15,
    color: theme.colors.text,
  },
  reviewForm: {
    marginTop: 8,
    gap: 10,
  },
  reviewFormTitle: {
    ...typography.body1,
    color: theme.colors.text,
    fontFamily: fonts.uiBold,
  },
  starSelector: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewInput: {
    ...presets.input,
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  charCount: {
    ...typography.label,
    color: theme.colors.textSecondary,
    alignSelf: "flex-end",
  },
  reviewFormActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelFormBtn: {
    flex: 1,
    height: 52,
    borderRadius: theme.radius.control,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelFormBtnText: {
    ...typography.button,
    color: theme.colors.text,
  },
  submitFormBtn: {
    flex: 1,
    height: 52,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitFormBtnText: {
    ...typography.button,
    color: "#fff",
  },
});
