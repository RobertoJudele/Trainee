import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Alert,
  AlertButton,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useGetTrainerByIdQuery } from "../../features/trainer/trainerApiSlice";
import {
  useGetTrainerReviewsQuery,
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
import { theme, typography } from "../../src/lib/theme";
import TrainerImageCarousel from "../../src/components/TrainerImageCarousel";
import { useGetTrainerPackagesQuery } from "../../features/trainer/trainerPackageApiSlice";
import { getApiErrorMessage } from "../../src/lib/errors";
import { formatFromPerSession } from "../../src/lib/price";
import { GradientButton } from "../../src/components/ui";
import TrainerHero from "../../src/components/trainer-detail/TrainerHero";
import TrainerIdentity from "../../src/components/trainer-detail/TrainerIdentity";
import TrainerStatusScreen from "../../src/components/trainer-detail/TrainerStatusScreen";
import TrainerReviews from "../../src/components/trainer-detail/TrainerReviews";
import { useReviewComposer } from "../../src/components/trainer-detail/useReviewComposer";
import ContactSheet from "../../src/components/trainer-detail/ContactSheet";
import { useTrainerContact } from "../../src/components/trainer-detail/useTrainerContact";
import {
  SpecializationsSection,
  AboutSection,
  PricingSection,
  GymsSection,
} from "../../src/components/trainer-detail/TrainerSections";
import {
  detailStyles,
  HERO_HEIGHT_RATIO,
  SHEET_PADDING,
} from "../../src/components/trainer-detail/styles";
import {
  resolveHeroImageUrl,
  buildFullName,
  buildInitials,
  buildIdentitySubtitle,
} from "../../src/components/trainer-detail/trainerProfileView";

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

export default function TrainerDetailsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<TrainerRouteParams>();
  const currentUser = useSelector(selectCurrentUser);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const heroHeight = Math.round(windowHeight * HERO_HEIGHT_RATIO);

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

  const { data: blockedData } = useGetBlockedUsersQuery();
  const blockedIds = useMemo(
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

  const composer = useReviewComposer(trainerInternalId, t);
  const contact = useTrainerContact(trainer, t);

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
    composer.mode === "idle";
  const showReviewGateHint =
    currentUser?.role === UserRole.CLIENT &&
    !isMyTrainer &&
    !myReview &&
    composer.mode === "idle";

  /* ── Scroll-driven header ────────────────────────────────────────────────
     The hero scrolls away like any other content; once it is nearly gone a
     solid bar fades in with the name. No Reanimated in this project, so this
     is a plain Animated interpolation on the native driver. */
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [heroHeight - 100, heroHeight - 60],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const heroButtonOpacity = scrollY.interpolate({
    inputRange: [heroHeight - 100, heroHeight - 60],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // Opacity alone isn't enough: a fully transparent header still swallows the
  // taps meant for the buttons on the photo underneath it. This mirrors the
  // interpolation above so the bar only takes touches once it is actually
  // visible. Guarded on a ref so scrolling doesn't re-render every frame.
  const [headerActive, setHeaderActive] = useState(false);
  const headerActiveRef = useRef(false);
  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const active = event.nativeEvent.contentOffset.y > heroHeight - 80;
      if (active !== headerActiveRef.current) {
        headerActiveRef.current = active;
        setHeaderActive(active);
      }
    },
    [heroHeight]
  );

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

  const goToReportIssue = useCallback(() => {
    router.push({
      pathname: "/report-issue",
      params: {
        targetType: "trainer",
        trainerId: trainer?.internalId ? String(trainer.internalId) : "",
        trainerPublicId,
      },
    });
  }, [router, trainer?.internalId, trainerPublicId]);

  /** The ⋯ on the hero — replaces the two full-width red buttons that used to
   *  sit at the very bottom of the page. */
  const handleTrainerOptions = useCallback(() => {
    Alert.alert(t("trainerOptions"), undefined, [
      { text: t("reportIssue"), onPress: goToReportIssue },
      { text: t("blockTrainer"), style: "destructive", onPress: handleBlockTrainer },
      { text: t("cancel"), style: "cancel" },
    ]);
  }, [t, goToReportIssue, handleBlockTrainer]);

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

  const firstName = trainer?.user?.firstName ?? params.firstName;
  const lastName = trainer?.user?.lastName ?? params.lastName;
  const fullName = buildFullName(firstName, lastName);
  const initials = buildInitials(firstName, lastName);

  const rating = trainer?.totalRating ?? toNumber(params.totalRating) ?? 0;
  const reviewCount = trainer?.reviewCount ?? toNumber(params.reviewCount) ?? 0;
  const experienceYears =
    trainer?.experienceYears ?? toNumber(params.experienceYears) ?? 0;
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

  const identitySubtitle = buildIdentitySubtitle({
    experienceYears,
    locationCity: trainer?.locationCity,
    yearsExperienceTemplate: t("yearsExperience"),
  });

  const heroImageUrl = resolveHeroImageUrl({
    profileImageUrl: trainer?.user?.profileImageUrl,
    routeImageUrl: params.profileImageUrl,
    galleryImageUrls: trainer?.galleryImages?.map((image) => image.imageUrl),
  });

  if (!hasValidTrainerId) {
    return (
      <TrainerStatusScreen
        title={t("invalidTrainer")}
        actionLabel={t("goBackButton")}
        onAction={() => router.back()}
      />
    );
  }

  // isLoading only: a refetch keeps the cached data, so there is no reason to replace
  // the whole screen with a spinner once something is already on it.
  if (isLoading) {
    return <TrainerStatusScreen loading hint={t("loadingTrainerDetails")} />;
  }

  if (isError) {
    return (
      <TrainerStatusScreen
        title={t("couldNotLoadTrainer")}
        actionLabel={t("tryAgain")}
        onAction={() => refetch()}
      />
    );
  }

  if (isTrainerBlocked) {
    return (
      <TrainerStatusScreen
        icon="ban-outline"
        title={t("trainerBlocked")}
        hint={t("trainerBlockedHint")}
        actionLabel={t("unblock")}
        onAction={handleUnblockTrainer}
        secondaryLabel={t("goBackButton")}
        onSecondary={() => router.back()}
      />
    );
  }

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: (contact.hasContact ? 88 : 24) + insets.bottom,
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true, listener: handleScroll }
        )}
      >
        <TrainerHero
          height={heroHeight}
          imageUrl={heroImageUrl}
          initials={initials}
          topInset={insets.top}
          buttonOpacity={heroButtonOpacity}
          onBack={() => router.back()}
          onOptions={handleTrainerOptions}
          backLabel={t("goBackButton")}
          optionsLabel={t("trainerOptions")}
        />

        <View style={detailStyles.sheet}>
          <TrainerIdentity
            fullName={fullName}
            subtitle={identitySubtitle ?? undefined}
            rating={rating}
            reviewCount={reviewCount}
            reviewsLabel={t("reviewsCount")}
          />

          <View style={detailStyles.divider} />

          {/* Prose reads flat; comparable data sits in tinted blocks; media
              runs edge to edge. Three registers, so six sections stop looking
              like one undifferentiated stack. */}
          <SpecializationsSection specializations={specializations} t={t} />
          <AboutSection bio={bio} t={t} />

          <PricingSection
            priceLabel={minSessionPriceLabel}
            packages={trainerPackages}
            t={t}
          />
          <GymsSection
            gyms={trainer?.availableGyms ?? []}
            locationText={locationText}
            t={t}
          />

          {trainer?.galleryImages && trainer.galleryImages.length > 0 && (
            <View style={detailStyles.mediaBlock}>
              <TrainerImageCarousel
                title={t("gallery")}
                images={trainer.galleryImages}
                bleed={SHEET_PADDING}
              />
            </View>
          )}

          {trainer?.credentialImages && trainer.credentialImages.length > 0 && (
            <View style={detailStyles.mediaBlock}>
              <TrainerImageCarousel
                title={t("certificationsAwards")}
                images={trainer.credentialImages}
                resizeMode="contain"
                bleed={SHEET_PADDING}
              />
            </View>
          )}

          <View style={detailStyles.divider} />

          <TrainerReviews
            reviews={reviews}
            currentUserId={currentUser?.id}
            mode={composer.mode}
            formRating={composer.formRating}
            formText={composer.formText}
            isSaving={composer.isSaving}
            isDeleting={composer.isDeleting}
            canWriteReview={canWriteReview}
            showGateHint={showReviewGateHint}
            onRatingChange={composer.setFormRating}
            onTextChange={composer.setFormText}
            onOpenWrite={composer.openWriteForm}
            onOpenEdit={composer.openEditForm}
            onCancel={composer.cancelForm}
            onSubmit={composer.submitReview}
            onDelete={composer.handleDeleteReview}
            onOptions={handleReviewOptions}
            t={t}
          />
        </View>
      </Animated.ScrollView>

      {/* Fades in once the hero has scrolled past. */}
      <Animated.View
        style={[
          styles.stickyHeader,
          { paddingTop: insets.top, opacity: headerOpacity },
        ]}
        pointerEvents={headerActive ? "box-none" : "none"}
      >
        <View style={styles.stickyHeaderRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.stickyHeaderBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("goBackButton")}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.stickyHeaderTitle} numberOfLines={1}>
            {fullName}
          </Text>
          <Pressable
            onPress={handleTrainerOptions}
            hitSlop={10}
            style={styles.stickyHeaderBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("trainerOptions")}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.text} />
          </Pressable>
        </View>
      </Animated.View>

      {/* No socials means nothing for the button to do — a disabled CTA would
          just advertise a dead end. */}
      {contact.hasContact && (
        <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
          <LinearGradient
            colors={["rgba(255,255,255,0)", "#FFFFFF"]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <GradientButton
            title={t("contactTrainer")}
            onPress={contact.handlePress}
            style={styles.cta}
          />
        </View>
      )}

      <ContactSheet
        visible={contact.sheetVisible}
        options={contact.options}
        trainerName={fullName}
        title={t("contactVia")}
        onSelect={contact.handleSelect}
        onClose={contact.closeSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  stickyHeaderRow: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  stickyHeaderBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  stickyHeaderTitle: {
    ...typography.body1,
    flex: 1,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
  },
  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  cta: {
    borderRadius: 999,
    overflow: "hidden",
  },
});
