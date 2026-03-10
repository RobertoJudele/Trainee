// frontend/app/map.tsx
import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  Image,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import {
  useGetAllGymsQuery,
  useGetGymByIdQuery,
  GymMarker,
  GymTrainer,
} from "../features/gym/gymApiSlice";
import { theme, typography } from "../src/lib/theme";

const { height: SCREEN_H } = Dimensions.get("window");

// ── Snap points ──────────────────────────────────────────────
const SNAP_CLOSED = SCREEN_H;           // fully hidden
const SNAP_PEEK   = SCREEN_H - 460;    // first tap: comfortable preview
const SNAP_HALF   = SCREEN_H * 0.42;   // mid drag
const SNAP_FULL   = SCREEN_H * 0.06;   // nearly full screen

const DEFAULT_REGION: Region = {
  latitude: 44.4468,
  longitude: 26.0977,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function MapScreen() {
  const mapRef      = useRef<MapView>(null);
  const [selectedGymId, setSelectedGymId] = useState<number | null>(null);
  const sheetAnim   = useRef(new Animated.Value(SNAP_CLOSED)).current;
  const currentSnap = useRef(SNAP_CLOSED); // track where we are between gestures

  const { data: gymsResponse, isLoading: gymsLoading } = useGetAllGymsQuery();
  const gyms = gymsResponse?.data ?? [];

  const { data: gymDetailResponse, isFetching: detailFetching } =
    useGetGymByIdQuery(selectedGymId!, { skip: selectedGymId === null });
  const gymDetail = gymDetailResponse?.data ?? null;

  // ── Animate to a snap point ──────────────────────────────
  const snapTo = useCallback(
    (toValue: number, onDone?: () => void) => {
      currentSnap.current = toValue;
      Animated.spring(sheetAnim, {
        toValue,
        useNativeDriver: true,
        tension: 68,
        friction: 12,
      }).start(onDone);
    },
    [sheetAnim]
  );

  const openSheet  = useCallback(() => snapTo(SNAP_PEEK), [snapTo]);
  const closeSheet = useCallback(
    () => snapTo(SNAP_CLOSED, () => setSelectedGymId(null)),
    [snapTo]
  );

  // ── PanResponder: drag handle only ───────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),

      onPanResponderMove: (_, g) => {
        const next = currentSnap.current + g.dy;
        if (next >= SNAP_FULL && next <= SNAP_CLOSED) {
          sheetAnim.setValue(next);
        }
      },

      onPanResponderRelease: (_, g) => {
        const pos = currentSnap.current + g.dy;
        const vel = g.vy;

        if (vel > 0.8)  { snapTo(SNAP_CLOSED, () => setSelectedGymId(null)); return; }
        if (vel < -0.8) { snapTo(SNAP_FULL); return; }

        const snaps   = [SNAP_FULL, SNAP_HALF, SNAP_PEEK, SNAP_CLOSED];
        const nearest = snaps.reduce((a, b) =>
          Math.abs(b - pos) < Math.abs(a - pos) ? b : a
        );

        if (nearest === SNAP_CLOSED) {
          snapTo(SNAP_CLOSED, () => setSelectedGymId(null));
        } else {
          snapTo(nearest);
        }
      },
    })
  ).current;

  // ── Marker press ─────────────────────────────────────────
  const handleMarkerPress = useCallback(
    (gym: GymMarker) => {
      setSelectedGymId(gym.id);
      mapRef.current?.animateToRegion(
        {
          latitude: Number(gym.latitude) - 0.02,
          longitude: Number(gym.longitude),
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        },
        400
      );
      openSheet();
    },
    [openSheet]
  );

  // ── Helpers ───────────────────────────────────────────────
  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <Text key={i} style={i < Math.floor(rating) ? styles.starOn : styles.starOff}>
        ★
      </Text>
    ));

  const renderTrainerRow = (trainer: GymTrainer, idx: number) => (
    <View key={idx} style={styles.trainerRow}>
      {trainer.user?.profileImageUrl ? (
        <Image
          source={{ uri: trainer.user.profileImageUrl }}
          style={styles.trainerAvatar}
        />
      ) : (
        <View style={styles.trainerAvatarFallback}>
          <Text style={styles.trainerInitials}>
            {trainer.user?.firstName?.[0]}
            {trainer.user?.lastName?.[0]}
          </Text>
        </View>
      )}
      <View style={styles.trainerMeta}>
        <View style={styles.trainerNameRow}>
          <Text style={styles.trainerName}>
            {trainer.user?.firstName} {trainer.user?.lastName}
          </Text>
          <View
            style={[
              styles.availBadge,
              trainer.isAvailableAtGym ? styles.availBadgeOn : styles.availBadgeOff,
            ]}
          >
            <Text style={styles.availBadgeText}>
              {trainer.isAvailableAtGym ? "Available" : "Busy"}
            </Text>
          </View>
        </View>
        <Text style={styles.trainerBio} numberOfLines={1}>
          {trainer.bio ?? "Fitness trainer"}
        </Text>
        <View style={styles.trainerStats}>
          <Text style={styles.trainerStat}>
            ⭐ {Number(trainer.totalRating).toFixed(1)}
          </Text>
          {trainer.experienceYears ? (
            <Text style={styles.trainerStat}> · {trainer.experienceYears}yr exp</Text>
          ) : null}
          {trainer.hourlyRate ? (
            <Text style={styles.trainerStatPrice}> · ${trainer.hourlyRate}/hr</Text>
          ) : null}
        </View>
      </View>
    </View>
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {gymsLoading ? (
        <View style={styles.mapLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.mapLoadingText}>Loading gyms...</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={DEFAULT_REGION}
          onPress={closeSheet}
          showsUserLocation
          showsMyLocationButton
        >
          {gyms.map((gym) => (
            <Marker
              key={gym.id}
              coordinate={{
                latitude: Number(gym.latitude),
                longitude: Number(gym.longitude),
              }}
              onPress={() => handleMarkerPress(gym)}
              tracksViewChanges={false}
              stopPropagation
            >
              <View pointerEvents="none" style={styles.markerWrap}>
                <View style={styles.markerBubble}>
                  <Text style={styles.markerEmoji}>🏋️</Text>
                  {gym.availableTrainerCount > 0 && (
                    <View style={styles.markerBadge}>
                      <Text style={styles.markerBadgeText}>
                        {gym.availableTrainerCount}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.markerTip} />
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {/* ── Bottom sheet ───────────────────────────────── */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}
      >
        {/* Drag handle zone — attached to PanResponder */}
        <View {...panResponder.panHandlers} style={styles.dragZone}>
          <View style={styles.handleBar} />

          {gymDetail && !detailFetching ? (
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <Text style={styles.sheetGymName} numberOfLines={1}>
                  {gymDetail.name}
                </Text>
                <Text style={styles.sheetGymCity}>
                  {gymDetail.city}{gymDetail.state ? `, ${gymDetail.state}` : ""}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={closeSheet}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetGymName}>Loading…</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={closeSheet}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Pull-up hint pill */}
          <View style={styles.expandHintRow}>
            <Text style={styles.expandHintText}>↑ pull up for full screen</Text>
          </View>
        </View>

        {/* Scrollable content */}
        {detailFetching || !gymDetail ? (
          <View style={styles.sheetLoading}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.sheetLoadingText}>Loading gym details...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 60 }}
            scrollEventThrottle={16}
          >
            {/* Quick info row */}
            <View style={styles.quickInfoRow}>
              <View style={styles.quickInfoChip}>
                <Text style={styles.quickInfoIcon}>🕐</Text>
                <Text style={styles.quickInfoText} numberOfLines={1}>
                  {gymDetail.openingHours ?? "Hours N/A"}
                </Text>
              </View>
              {gymDetail.phone && (
                <View style={styles.quickInfoChip}>
                  <Text style={styles.quickInfoIcon}>📞</Text>
                  <Text style={styles.quickInfoText}>{gymDetail.phone}</Text>
                </View>
              )}
            </View>

            {/* Rating */}
            <View style={styles.ratingRow}>
              {renderStars(Number(gymDetail.rating))}
              <Text style={styles.ratingVal}>
                {Number(gymDetail.rating).toFixed(1)}
              </Text>
              <Text style={styles.ratingCount}>
                ({gymDetail.reviewCount} reviews)
              </Text>
            </View>

            <Text style={styles.gymAddress}>
              📍 {gymDetail.address}
            </Text>

            <View style={styles.divider} />

            {/* Trainers */}
            <View style={styles.trainersHeader}>
              <Text style={styles.trainersTitle}>Trainers here</Text>
              <View style={styles.trainerCountBadge}>
                <Text style={styles.trainerCountText}>
                  {gymDetail.trainers.length}
                </Text>
              </View>
            </View>

            {gymDetail.trainers.length === 0 ? (
              <View style={styles.noTrainers}>
                <Text style={styles.noTrainersText}>
                  No trainers registered here yet
                </Text>
              </View>
            ) : (
              gymDetail.trainers.map(renderTrainerRow)
            )}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  mapLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.background,
  },
  mapLoadingText: { ...typography.body2, color: theme.colors.textSecondary },

  // ── Marker ──────────────────────────────────────────────
  markerWrap: { alignItems: "center" },
  markerBubble: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 8,
    borderWidth: 2.5,
    borderColor: theme.colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 6,
  },
  markerEmoji: { fontSize: 28 },
  markerBadge: {
    position: "absolute",
    top: -7,
    right: -9,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },
  markerBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  markerTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: theme.colors.primary,
    marginTop: -1,
  },

  // ── Sheet ────────────────────────────────────────────────
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    // height fills from current translateY to bottom of screen
    height: SCREEN_H,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 20,
  },

  // drag zone — the touchable area for pull gesture
  dragZone: {
    paddingTop: 10,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  handleBar: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  sheetHeaderLeft: { flex: 1, marginRight: 12 },
  sheetGymName: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 2,
  },
  sheetGymCity: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: { fontSize: 14, color: "#6B7280", fontWeight: "700" },
  expandHintRow: {
    alignItems: "center",
    marginTop: 8,
  },
  expandHintText: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
    letterSpacing: 0.3,
  },

  sheetLoading: { paddingTop: 48, alignItems: "center", gap: 12 },
  sheetLoadingText: { ...typography.body2, color: theme.colors.textSecondary },
  sheetScroll: { paddingHorizontal: theme.spacing.lg, paddingTop: 14 },

  // Quick info chips
  quickInfoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  quickInfoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickInfoIcon: { fontSize: 13 },
  quickInfoText: {
    ...typography.caption,
    color: theme.colors.text,
    fontWeight: "500",
  },

  gymAddress: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 3,
  },
  starOn: { fontSize: 15, color: "#F59E0B" },
  starOff: { fontSize: 15, color: "#E5E7EB" },
  ratingVal: {
    ...typography.body2,
    fontWeight: "700",
    color: theme.colors.text,
    marginLeft: 4,
  },
  ratingCount: { ...typography.caption, color: theme.colors.textSecondary },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 16,
  },

  // Trainers
  trainersHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  trainersTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.colors.text,
  },
  trainerCountBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    minWidth: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  trainerCountText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  noTrainers: { alignItems: "center", paddingVertical: theme.spacing.lg },
  noTrainersText: { ...typography.body2, color: theme.colors.textSecondary },

  trainerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  trainerAvatar: { width: 52, height: 52, borderRadius: 26 },
  trainerAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  trainerInitials: {
    ...typography.body1,
    color: "#fff",
    fontWeight: "700",
  },
  trainerMeta: { flex: 1 },
  trainerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  trainerName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
    flex: 1,
  },
  availBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
  },
  availBadgeOn:  { backgroundColor: "#D1FAE5" },
  availBadgeOff: { backgroundColor: "#FEE2E2" },
  availBadgeText: { fontSize: 11, fontWeight: "700", color: "#374151" },
  trainerBio: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 5,
  },
  trainerStats: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  trainerStat: { ...typography.caption, color: theme.colors.textSecondary },
  trainerStatPrice: {
    ...typography.caption,
    color: theme.colors.primary,
    fontWeight: "700",
  },
});