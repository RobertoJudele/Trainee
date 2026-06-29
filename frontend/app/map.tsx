// frontend/app/map.tsx
import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
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
  Platform,
  TextInput,
  Modal,
  Pressable,
  Switch,
  Keyboard,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { skipToken } from "@reduxjs/toolkit/query";
import {
  useGetAllGymsQuery,
  useGetGymByIdQuery,
  GymMarker,
  GymTrainer,
} from "../features/gym/gymApiSlice";
import { theme, typography } from "../src/lib/theme";
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../src/lib/i18n/LanguageContext";

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");

// ── Snap points ──────────────────────────────────────────────
const SNAP_CLOSED = SCREEN_H;           // fully hidden
const SNAP_PEEK = SCREEN_H - 460;    // first tap: comfortable preview
const SNAP_HALF = SCREEN_H * 0.42;   // mid drag
const SNAP_FULL = SCREEN_H * 0.06;   // nearly full screen

const DEFAULT_REGION: Region = {
  latitude: 44.4468,
  longitude: 26.0977,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const RATING_OPTIONS = [0, 3, 4, 4.5];

const CLUSTER_RADIUS_PX = 56;
const MIN_CLUSTER_DELTA = 0.0006;
const MIN_RADIUS_KM = 2;
const MAX_RADIUS_KM = 14;
const MAP_REGION_UPDATE_DEBOUNCE_MS = 650;
const MIN_REGION_MOVE_DELTA = 0.007;
const MIN_REGION_ZOOM_DELTA = 0.012;
const MAX_RENDERED_MAP_ITEMS = 120;
const MAX_CLUSTER_INPUT_GYMS = 900;
const VIEWPORT_BUFFER_MULTIPLIER = 1.35;
const MIN_MS_BETWEEN_REGION_APPLY = 900;
const MARKER_TAP_THROTTLE_MS = 220;
const MARKER_RECENTER_ANIMATION_MS = 400;
const SUPPRESS_REGION_UPDATES_AFTER_SELECTION_MS = 900;

interface GymClusterItem {
  type: "cluster";
  key: string;
  latitude: number;
  longitude: number;
  gyms: GymMarker[];
}

interface GymSingleItem {
  type: "gym";
  key: string;
  latitude: number;
  longitude: number;
  gym: GymMarker;
}

interface ClusterBucket {
  gyms: GymMarker[];
  latitudeSum: number;
  longitudeSum: number;
}

type MapItem = GymClusterItem | GymSingleItem;

const clampLatitude = (latitude: number): number =>
  Math.max(-90, Math.min(90, latitude));

const getDensityClusterMultiplier = (gymCount: number): number => {
  if (gymCount >= 1400) return 3;
  if (gymCount >= 900) return 2.4;
  if (gymCount >= 500) return 1.8;
  if (gymCount >= 250) return 1.4;
  return 1;
};

const getCellSizeForRegion = (
  region: Region,
  gymCount: number
): { lat: number; lon: number } => {
  const densityMultiplier = getDensityClusterMultiplier(gymCount);
  const lat = Math.max(
    ((region.latitudeDelta * CLUSTER_RADIUS_PX) / SCREEN_H) * densityMultiplier,
    MIN_CLUSTER_DELTA
  );
  const lon = Math.max(
    ((region.longitudeDelta * CLUSTER_RADIUS_PX) / SCREEN_W) * densityMultiplier,
    MIN_CLUSTER_DELTA
  );
  return { lat, lon };
};

const getClusteredMapItems = (gyms: GymMarker[], region: Region): MapItem[] => {
  if (gyms.length === 0) {
    return [];
  }

  const { lat: latCellSize, lon: lonCellSize } = getCellSizeForRegion(region, gyms.length);

  const buckets = new Map<string, ClusterBucket>();

  gyms.forEach((gym) => {
    const latitude = Number(gym.latitude);
    const longitude = Number(gym.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    // Keep cluster cells anchored globally so minor pans do not reshuffle every marker.
    const latCellIndex = Math.floor((latitude + 90) / latCellSize);
    const lonCellIndex = Math.floor((longitude + 180) / lonCellSize);
    const key = `${latCellIndex}:${lonCellIndex}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { gyms: [], latitudeSum: 0, longitudeSum: 0 };
      buckets.set(key, bucket);
    }

    bucket.gyms.push(gym);
    bucket.latitudeSum += latitude;
    bucket.longitudeSum += longitude;
  });

  const items: MapItem[] = [];
  buckets.forEach((bucket, key) => {
    if (bucket.gyms.length === 1) {
      const gym = bucket.gyms[0];
      const latitude = Number(gym.latitude);
      const longitude = Number(gym.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      items.push({
        type: "gym",
        key: `gym-${gym.id}`,
        gym,
        latitude,
        longitude,
      });
      return;
    }

    items.push({
      type: "cluster",
      key: `cluster-${key}`,
      gyms: bucket.gyms,
      latitude: bucket.latitudeSum / bucket.gyms.length,
      longitude: bucket.longitudeSum / bucket.gyms.length,
    });
  });

  return items;
};

const getClusterSize = (pointCount: number): number => {
  if (pointCount >= 50) return 60;
  if (pointCount >= 20) return 54;
  if (pointCount >= 10) return 48;
  return 42;
};

const getRadiusKmForRegion = (region: Region): number => {
  const radiusFromLatitudeDelta = (region.latitudeDelta * 111) / 2;
  return Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, radiusFromLatitudeDelta));
};

const hasMeaningfulRegionChange = (previous: Region, next: Region): boolean => {
  const hasCenterChange =
    Math.abs(previous.latitude - next.latitude) >= MIN_REGION_MOVE_DELTA ||
    Math.abs(previous.longitude - next.longitude) >= MIN_REGION_MOVE_DELTA;

  const hasZoomChange =
    Math.abs(previous.latitudeDelta - next.latitudeDelta) >= MIN_REGION_ZOOM_DELTA ||
    Math.abs(previous.longitudeDelta - next.longitudeDelta) >= MIN_REGION_ZOOM_DELTA;

  return hasCenterChange || hasZoomChange;
};

const hasSubstantialRegionChange = (previous: Region, next: Region): boolean => {
  const hasCenterChange =
    Math.abs(previous.latitude - next.latitude) >= MIN_REGION_MOVE_DELTA * 2.4 ||
    Math.abs(previous.longitude - next.longitude) >= MIN_REGION_MOVE_DELTA * 2.4;

  const hasZoomChange =
    Math.abs(previous.latitudeDelta - next.latitudeDelta) >= MIN_REGION_ZOOM_DELTA * 2.4 ||
    Math.abs(previous.longitudeDelta - next.longitudeDelta) >= MIN_REGION_ZOOM_DELTA * 2.4;

  return hasCenterChange || hasZoomChange;
};

const getRegionBounds = (region: Region, multiplier = 1): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} => {
  const latHalf = (region.latitudeDelta * multiplier) / 2;
  const lonHalf = (region.longitudeDelta * multiplier) / 2;

  return {
    minLat: clampLatitude(region.latitude - latHalf),
    maxLat: clampLatitude(region.latitude + latHalf),
    minLon: region.longitude - lonHalf,
    maxLon: region.longitude + lonHalf,
  };
};

const isGymInsideBounds = (
  gym: GymMarker,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): boolean => {
  const latitude = Number(gym.latitude);
  const longitude = Number(gym.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }

  return (
    latitude >= bounds.minLat &&
    latitude <= bounds.maxLat &&
    longitude >= bounds.minLon &&
    longitude <= bounds.maxLon
  );
};

const getSquaredDistance = (
  latitude: number,
  longitude: number,
  centerLatitude: number,
  centerLongitude: number
): number => {
  const dLat = latitude - centerLatitude;
  const dLon = longitude - centerLongitude;
  return dLat * dLat + dLon * dLon;
};

// react-native-maps 1.x on the New Architecture (Fabric) snapshots a custom
// marker's children into a single bitmap. A global/shared `tracksViewChanges`
// toggle is unreliable here: the bitmap is often captured once before the view
// has laid out, so it freezes at the wrong size and the bubble renders as a
// clipped wedge. Instead, each marker tracks changes on mount and only freezes
// a couple of frames AFTER layout has *settled*.
//
// Critically, Android fires `onLayout` more than once (an early pass can report
// a premature/zero-ish size before the final measure). If we freeze off the
// first pass, the snapshot captures the wrong size — that's the wedge. So we
// debounce: every `onLayout` re-enables tracking and restarts the freeze timer,
// and we only stop tracking once layout has been quiet for the delay window,
// guaranteeing the final snapshot is taken at the settled size.
const MARKER_FREEZE_DELAY_MS = 150;

const useMarkerRecapture = (): {
  tracksViewChanges: boolean;
  onLayout: () => void;
} => {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLayout = useCallback(() => {
    // Keep capturing while layout is still changing, then freeze once it stops.
    setTracksViewChanges(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(
      () => setTracksViewChanges(false),
      MARKER_FREEZE_DELAY_MS
    );
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    []
  );

  return { tracksViewChanges, onLayout };
};

const ClusterMarkerView = React.memo(function ClusterMarkerView({
  item,
  onPress,
}: {
  item: GymClusterItem;
  onPress: () => void;
}) {
  const pointCount = item.gyms.length;
  const clusterSize = getClusterSize(pointCount);
  const { tracksViewChanges, onLayout } = useMarkerRecapture();

  // Android snapshots the marker into a bitmap sized to its width and clips the
  // overflowing height (circle + tip is taller than it is wide), which lops the
  // top off the bubble. A centered square wrapper keeps width >= height so the
  // whole pin is captured. CLUSTER_TIP_HEIGHT + generous margin = +24.
  const wrapSize = clusterSize + 24;

  return (
    <Marker
      coordinate={{ latitude: item.latitude, longitude: item.longitude }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      stopPropagation
    >
      <View
        pointerEvents="none"
        collapsable={false}
        style={[styles.clusterWrap, { width: wrapSize, height: wrapSize }]}
        onLayout={onLayout}
      >
        <View
          style={[
            styles.clusterBubble,
            {
              width: clusterSize,
              height: clusterSize,
              borderRadius: clusterSize / 2,
            },
          ]}
        >
          <Text style={styles.clusterCount}>{pointCount}</Text>
        </View>
        <View style={styles.clusterTip} />
      </View>
    </Marker>
  );
});

const GymMarkerView = React.memo(function GymMarkerView({
  item,
  onPress,
}: {
  item: GymSingleItem;
  onPress: () => void;
}) {
  const { gym } = item;
  const { tracksViewChanges, onLayout } = useMarkerRecapture();

  return (
    <Marker
      coordinate={{ latitude: item.latitude, longitude: item.longitude }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      stopPropagation
    >
      <View
        pointerEvents="none"
        collapsable={false}
        style={styles.markerWrap}
        onLayout={onLayout}
      >
        <View style={styles.markerBubble}>
          <Ionicons name="barbell" size={24} color={theme.colors.primary} />
          {gym.availableTrainerCount > 0 && (
            <View style={styles.markerBadge}>
              <Text style={styles.markerBadgeText}>{gym.availableTrainerCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.markerTip} />
      </View>
    </Marker>
  );
});

export default function MapScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [selectedGymId, setSelectedGymId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [stableGyms, setStableGyms] = useState<GymMarker[]>([]);
  const sheetAnim = useRef(new Animated.Value(SNAP_CLOSED)).current;
  const currentSnap = useRef(SNAP_CLOSED); // track where we are between gestures
  const regionUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markerAnimationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMarkerTapAtRef = useRef(0);
  const isMarkerAnimationInFlightRef = useRef(false);
  const skipNextRegionChangeRef = useRef(false);
  const suppressRegionUpdatesUntilRef = useRef(0);
  const pendingRegionRef = useRef<Region>(DEFAULT_REGION);
  const mapRegionRef = useRef<Region>(DEFAULT_REGION);
  const lastAppliedRegionAtRef = useRef(0);
  const didCenterOnUserRef = useRef(false);
  const userLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);

  const applyMapRegionSafely = useCallback((nextRegion: Region): boolean => {
    const currentRegion = mapRegionRef.current;

    if (!hasMeaningfulRegionChange(currentRegion, nextRegion)) {
      return false;
    }

    const now = Date.now();
    const inCooldown = now - lastAppliedRegionAtRef.current < MIN_MS_BETWEEN_REGION_APPLY;
    if (inCooldown && !hasSubstantialRegionChange(currentRegion, nextRegion)) {
      return false;
    }

    mapRegionRef.current = nextRegion;
    lastAppliedRegionAtRef.current = now;
    setMapRegion(nextRegion);
    return true;
  }, []);

  const {
    data: gymsResponse,
    isLoading: gymsLoading,
  } = useGetAllGymsQuery();

  useEffect(() => {
    if (Array.isArray(gymsResponse?.data)) {
      setStableGyms(gymsResponse.data);
    }
  }, [gymsResponse?.data]);

  // On open, ask for location permission and center the map on the user (the
  // blue dot comes from `showsUserLocation`). Falls back to the default region
  // if permission is denied or the position can't be read.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled || status !== "granted") return;
        setLocationGranted(true);
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        userLocationRef.current = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        if (didCenterOnUserRef.current) return;
        const region: Region = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        didCenterOnUserRef.current = true;
        // Move the camera ONLY. Do NOT also setMapRegion here: that fires an
        // immediate marker recompute while animateToRegion fires a second one
        // via onRegionChangeComplete, and the two overlapping marker mutations
        // crash react-native-maps' Fabric interop on open (see the deferred-
        // marker note below). Letting onRegionChangeComplete drive the region
        // through the debounced applyMapRegionSafely path keeps it to a single,
        // interop-safe marker update.
        mapRef.current?.animateToRegion(region, 650);
      } catch {
        // Ignore — the map stays on the default region.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      if (regionUpdateTimeoutRef.current) {
        clearTimeout(regionUpdateTimeoutRef.current);
      }

      if (markerAnimationTimeoutRef.current) {
        clearTimeout(markerAnimationTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedGymId !== null) {
      return;
    }

    void applyMapRegionSafely(pendingRegionRef.current);
  }, [selectedGymId, applyMapRegionSafely]);

  useEffect(() => {
    mapRegionRef.current = mapRegion;
  }, [mapRegion]);

  const gyms = gymsResponse?.data ?? stableGyms;

  // Active filters narrow the whole gym set, so both map markers and the search
  // results list respect them.
  const filteredGyms = useMemo(
    () =>
      gyms.filter(
        (gym) =>
          Number(gym.rating) >= minRating &&
          (!onlyAvailable || gym.availableTrainerCount > 0)
      ),
    [gyms, minRating, onlyAvailable]
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return filteredGyms
      .filter(
        (gym) =>
          gym.name.toLowerCase().includes(q) ||
          (gym.city ?? "").toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [filteredGyms, searchQuery]);

  const hasActiveFilters = minRating > 0 || onlyAvailable;
  const resetFilters = useCallback(() => {
    setMinRating(0);
    setOnlyAvailable(false);
  }, []);

  const gymsForClustering = useMemo(() => {
    if (filteredGyms.length === 0) {
      return filteredGyms;
    }

    const bufferedBounds = getRegionBounds(mapRegion, VIEWPORT_BUFFER_MULTIPLIER);
    const visibleGyms = filteredGyms.filter((gym) => isGymInsideBounds(gym, bufferedBounds));

    if (visibleGyms.length <= MAX_CLUSTER_INPUT_GYMS) {
      return visibleGyms;
    }

    return visibleGyms
      .map((gym) => {
        const latitude = Number(gym.latitude);
        const longitude = Number(gym.longitude);

        return {
          gym,
          distanceScore: getSquaredDistance(
            latitude,
            longitude,
            mapRegion.latitude,
            mapRegion.longitude
          ),
        };
      })
      .sort((a, b) => a.distanceScore - b.distanceScore)
      .slice(0, MAX_CLUSTER_INPUT_GYMS)
      .map((entry) => entry.gym);
  }, [
    filteredGyms,
    mapRegion.latitude,
    mapRegion.longitude,
    mapRegion.latitudeDelta,
    mapRegion.longitudeDelta,
  ]);

  const mapItems = useMemo(
    () => getClusteredMapItems(gymsForClustering, mapRegion),
    [gymsForClustering, mapRegion]
  );
  const mapItemsToRender = useMemo(() => {
    if (mapItems.length <= MAX_RENDERED_MAP_ITEMS) {
      return mapItems;
    }

    const prioritizedClusters = mapItems
      .filter((item): item is GymClusterItem => item.type === "cluster")
      .sort((a, b) => b.gyms.length - a.gyms.length)
      .slice(0, MAX_RENDERED_MAP_ITEMS);

    if (prioritizedClusters.length >= MAX_RENDERED_MAP_ITEMS) {
      return prioritizedClusters;
    }

    const remainingSlots = MAX_RENDERED_MAP_ITEMS - prioritizedClusters.length;
    const nearestSingles = mapItems
      .filter((item): item is GymSingleItem => item.type === "gym")
      .sort(
        (a, b) =>
          getSquaredDistance(
            a.latitude,
            a.longitude,
            mapRegion.latitude,
            mapRegion.longitude
          ) -
          getSquaredDistance(
            b.latitude,
            b.longitude,
            mapRegion.latitude,
            mapRegion.longitude
          )
      )
      .slice(0, remainingSlots);

    return [...prioritizedClusters, ...nearestSingles];
  }, [mapItems, mapRegion.latitude, mapRegion.longitude]);
  const hiddenMapItemCount = Math.max(0, mapItems.length - mapItemsToRender.length);
  const hiddenGymsCount = Math.max(0, gyms.length - gymsForClustering.length);

  // ── Deferred marker rendering (Fabric interop crash fix) ──
  // react-native-maps runs through RCTLegacyViewManagerInteropComponentView
  // under New Architecture. Rapid child-list mutations cause an
  // NSMutableArray out-of-bounds crash. We clear → wait one frame → re-set
  // so the native view never receives conflicting insert instructions.
  const [deferredMarkers, setDeferredMarkers] = useState<MapItem[]>([]);
  const deferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear markers immediately so native view removes all children first
    setDeferredMarkers([]);

    if (deferTimerRef.current) {
      clearTimeout(deferTimerRef.current);
    }

    // Re-add the new set on the next frame after the clear has flushed.
    // Clearing first also unmounts every marker component, so each one
    // remounts fresh and runs its own snapshot-recapture cycle (see
    // ClusterMarkerView / GymMarkerView) at the correct, settled size.
    deferTimerRef.current = setTimeout(() => {
      setDeferredMarkers(mapItemsToRender);
      deferTimerRef.current = null;
    }, 80);

    return () => {
      if (deferTimerRef.current) {
        clearTimeout(deferTimerRef.current);
      }
    };
  }, [mapItemsToRender]);

  const gymDetailQueryArg = selectedGymId ?? skipToken;
  const { data: gymDetailResponse, isFetching: detailFetching } =
    useGetGymByIdQuery(gymDetailQueryArg);
  const gymDetailData = gymDetailResponse?.data ?? null;
  const gymDetail =
    selectedGymId !== null && gymDetailData && gymDetailData.id === selectedGymId
      ? gymDetailData
      : null;
  const gymTrainers = Array.isArray(gymDetail?.trainers) ? gymDetail.trainers : [];

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

  const openSheet = useCallback(() => snapTo(SNAP_PEEK), [snapTo]);
  const closeSheet = useCallback(
    () => snapTo(SNAP_CLOSED, () => setSelectedGymId(null)),
    [snapTo]
  );

  const suppressRegionUpdatesFor = useCallback((ms: number) => {
    suppressRegionUpdatesUntilRef.current = Date.now() + ms;
  }, []);

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

        if (vel > 0.8) { snapTo(SNAP_CLOSED, () => setSelectedGymId(null)); return; }
        if (vel < -0.8) { snapTo(SNAP_FULL); return; }

        const snaps = [SNAP_FULL, SNAP_HALF, SNAP_PEEK, SNAP_CLOSED];
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
      const now = Date.now();
      if (now - lastMarkerTapAtRef.current < MARKER_TAP_THROTTLE_MS) {
        return;
      }
      lastMarkerTapAtRef.current = now;

      if (selectedGymId === gym.id && currentSnap.current !== SNAP_CLOSED) {
        return;
      }

      suppressRegionUpdatesFor(SUPPRESS_REGION_UPDATES_AFTER_SELECTION_MS);
      setSelectedGymId(gym.id);

      const latitude = Number(gym.latitude);
      const longitude = Number(gym.longitude);

      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        mapRef.current &&
        !isMarkerAnimationInFlightRef.current
      ) {
        isMarkerAnimationInFlightRef.current = true;
        skipNextRegionChangeRef.current = true;

        mapRef.current.animateToRegion(
          {
            latitude: latitude - 0.02,
            longitude,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          },
          MARKER_RECENTER_ANIMATION_MS
        );

        if (markerAnimationTimeoutRef.current) {
          clearTimeout(markerAnimationTimeoutRef.current);
        }

        markerAnimationTimeoutRef.current = setTimeout(() => {
          isMarkerAnimationInFlightRef.current = false;
          markerAnimationTimeoutRef.current = null;
        }, MARKER_RECENTER_ANIMATION_MS + 80);
      }

      openSheet();
    },
    [openSheet, selectedGymId, suppressRegionUpdatesFor]
  );

  // Tap a search result: clear the box, drop the keyboard, then reuse the marker
  // flow to recenter the map and open the gym sheet.
  const handleResultPress = useCallback(
    (gym: GymMarker) => {
      setSearchQuery("");
      Keyboard.dismiss();
      handleMarkerPress(gym);
    },
    [handleMarkerPress]
  );

  const handleRegionChangeComplete = useCallback((region: Region) => {
    if (skipNextRegionChangeRef.current) {
      skipNextRegionChangeRef.current = false;
      pendingRegionRef.current = region;
      return;
    }

    if (Date.now() < suppressRegionUpdatesUntilRef.current) {
      pendingRegionRef.current = region;
      return;
    }

    if (selectedGymId !== null) {
      pendingRegionRef.current = region;
      return;
    }

    if (!hasMeaningfulRegionChange(pendingRegionRef.current, region)) {
      return;
    }

    pendingRegionRef.current = region;

    if (regionUpdateTimeoutRef.current) {
      clearTimeout(regionUpdateTimeoutRef.current);
    }

    regionUpdateTimeoutRef.current = setTimeout(() => {
      void applyMapRegionSafely(pendingRegionRef.current);
      regionUpdateTimeoutRef.current = null;
    }, MAP_REGION_UPDATE_DEBOUNCE_MS);
  }, [selectedGymId, applyMapRegionSafely]);

  const handleClusterPress = useCallback(
    (cluster: GymClusterItem) => {
      suppressRegionUpdatesFor(SUPPRESS_REGION_UPDATES_AFTER_SELECTION_MS);
      closeSheet();

      const coordinates = cluster.gyms
        .map((gym) => ({
          latitude: Number(gym.latitude),
          longitude: Number(gym.longitude),
        }))
        .filter(
          (coordinate) =>
            Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude)
        );

      if (coordinates.length === 0) {
        return;
      }

      if (coordinates.length === 1) {
        mapRef.current?.animateToRegion(
          {
            latitude: coordinates[0].latitude,
            longitude: coordinates[0].longitude,
            latitudeDelta: Math.max(mapRegion.latitudeDelta / 2, MIN_CLUSTER_DELTA),
            longitudeDelta: Math.max(mapRegion.longitudeDelta / 2, MIN_CLUSTER_DELTA),
          },
          350
        );
        return;
      }

      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 80, right: 80, bottom: 220, left: 80 },
        animated: true,
      });
    },
    [closeSheet, mapRegion.latitudeDelta, mapRegion.longitudeDelta, suppressRegionUpdatesFor]
  );

  const handleCenterOnUser = useCallback(async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      userLocationRef.current = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
    } catch {
      // Fall back to the last known position.
    }
    if (!userLocationRef.current || !mapRef.current) return;
    closeSheet();
    mapRef.current.animateToRegion(
      {
        latitude: userLocationRef.current.latitude,
        longitude: userLocationRef.current.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      500
    );
  }, [closeSheet]);

  // ── Helpers ───────────────────────────────────────────────
  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <Ionicons
        key={i}
        name={i < Math.floor(rating) ? "star" : "star-outline"}
        size={14}
        color={i < Math.floor(rating) ? "#F59E0B" : "#E5E7EB"}
        style={{ marginRight: 2 }}
      />
    ));

  const renderTrainerRow = (trainer: GymTrainer, idx: number) => (
    <TouchableOpacity
      key={idx}
      style={styles.trainerRow}
      activeOpacity={0.85}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`View trainer ${trainer.user?.firstName ?? ""} ${trainer.user?.lastName ?? ""}`}
      onPress={() =>
        router.push({
          pathname: "/trainers/[id]",
          params: {
            id: String(trainer.id),
            firstName: trainer.user?.firstName ?? "",
            lastName: trainer.user?.lastName ?? "",
            profileImageUrl: trainer.user?.profileImageUrl ?? "",
            bio: trainer.bio ?? "",
            totalRating: String(Number(trainer.totalRating ?? 0)),
            reviewCount: String(trainer.reviewCount ?? 0),
            experienceYears: String(trainer.experienceYears ?? 0),
            hourlyRate: String(trainer.hourlyRate ?? 0),
            sessionRate: String(trainer.sessionRate ?? 0),
            isAvailableAtGym: trainer.isAvailableAtGym ? "1" : "0",
          },
        })
      }
    >
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
              {trainer.isAvailableAtGym ? t("available") : t("unavailable")}
            </Text>
          </View>
        </View>
        <Text style={styles.trainerBio} numberOfLines={1}>
          {trainer.bio ?? t("fitnessTrainer")}
        </Text>
        <View style={styles.trainerStats}>
          <Text style={styles.trainerStat}>
            <Ionicons name="star" size={10} color="#F59E0B" style={{ marginRight: 2 }} />
            {Number(trainer.totalRating).toFixed(1)}
          </Text>
          {trainer.experienceYears ? (
            <Text style={styles.trainerStat}> · {trainer.experienceYears}yr exp</Text>
          ) : null}
          {trainer.hourlyRate ? (
            <Text style={styles.trainerStatPrice}> · {trainer.hourlyRate} lei/hr</Text>
          ) : null}
          <Text style={styles.trainerViewLink}> · {t("viewDetails")}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Floating search bar + filter button ───────────── */}
      <View style={[styles.topBar, { top: Math.max(insets.top + theme.spacing.sm, theme.spacing.lg) }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={styles.searchPill}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("mapSearchPlaceholder")}
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("clearFilters")}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, hasActiveFilters && styles.iconBtnActive]}
          onPress={() => setFiltersVisible(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t("mapFilters")}
        >
          <Ionicons name="options-outline" size={22} color={hasActiveFilters ? "#fff" : theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* ── Search results dropdown ────────────────────────── */}
      {searchQuery.trim().length > 0 && (
        <View style={[styles.resultsCard, { top: Math.max(insets.top + theme.spacing.sm, theme.spacing.lg) + 56 }]}>
          {searchResults.length === 0 ? (
            <Text style={styles.resultsEmpty}>{t("noGymsFound")}</Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {searchResults.map((gym) => (
                <TouchableOpacity
                  key={gym.id}
                  style={styles.resultRow}
                  onPress={() => handleResultPress(gym)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="business-outline" size={18} color={theme.colors.primary} />
                  <View style={styles.resultMeta}>
                    <Text style={styles.resultName} numberOfLines={1}>{gym.name}</Text>
                    <Text style={styles.resultCity} numberOfLines={1}>
                      {gym.city}{gym.state ? `, ${gym.state}` : ""}
                    </Text>
                  </View>
                  {gym.availableTrainerCount > 0 && (
                    <View style={styles.resultBadge}>
                      <Text style={styles.resultBadgeText}>{gym.availableTrainerCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {locationGranted && searchQuery.trim().length === 0 && (
        <TouchableOpacity
          style={[styles.centerButton, { top: Math.max(insets.top + theme.spacing.sm, theme.spacing.lg) + 56 }]}
          onPress={handleCenterOnUser}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t("centerOnMyLocation")}
        >
          <Ionicons name="navigate" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      )}

      {gymsLoading ? (
        <View style={styles.mapLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.mapLoadingText}>{t("loadingGyms")}</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={DEFAULT_REGION}
          onRegionChangeComplete={handleRegionChangeComplete}
          onPress={closeSheet}
          showsUserLocation={locationGranted}
          showsMyLocationButton={false}
        >
          {deferredMarkers.map((item) =>
            item.type === "cluster" ? (
              <ClusterMarkerView
                key={item.key}
                item={item}
                onPress={() => handleClusterPress(item)}
              />
            ) : (
              <GymMarkerView
                key={item.key}
                item={item}
                onPress={() => handleMarkerPress(item.gym)}
              />
            )
          )}
        </MapView>
      )}

      <TouchableOpacity
        style={styles.requestGymBtn}
        onPress={() =>
          router.push({
            pathname: "/request-gym",
            params: {
              lat: String(mapRegion.latitude),
              lng: String(mapRegion.longitude),
            },
          })
        }
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t("requestGymCta")}
      >
        <Text style={styles.requestGymBtnText}>{t("requestGymCta")}</Text>
      </TouchableOpacity>

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
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={closeSheet}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Close gym details"
              >
                <Ionicons name="close" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetGymName}>{t("loading")}</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={closeSheet}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Close gym details"
              >
                <Ionicons name="close" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          )}

          {/* Pull-up hint pill */}
          <View style={styles.expandHintRow}>
            <Text style={styles.expandHintText}>{t("pullUpFullScreen")}</Text>
          </View>
        </View>

        {/* Scrollable content */}
        {detailFetching || !gymDetail ? (
          <View style={styles.sheetLoading}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.sheetLoadingText}>{t("loadingGymDetails")}</Text>
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
                <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.quickInfoText} numberOfLines={1}>
                  {gymDetail.openingHours ?? t("hoursNA")}
                </Text>
              </View>
              {gymDetail.phone && (
                <View style={styles.quickInfoChip}>
                  <Ionicons name="call-outline" size={16} color={theme.colors.textSecondary} />
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

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="location" size={16} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.gymAddress}>
                {gymDetail.address}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Trainers */}
            <View style={styles.trainersHeader}>
              <Text style={styles.trainersTitle}>{t("trainersHere")}</Text>
              <View style={styles.trainerCountBadge}>
                <Text style={styles.trainerCountText}>
                  {gymTrainers.length}
                </Text>
              </View>
            </View>

            {gymTrainers.length === 0 ? (
              <View style={styles.noTrainers}>
                <Text style={styles.noTrainersText}>
                  {t("noTrainersHere")}
                </Text>
              </View>
            ) : (
              gymTrainers.map(renderTrainerRow)
            )}
          </ScrollView>
        )}
      </Animated.View>

      {/* ── Filter panel ───────────────────────────────────── */}
      <Modal
        visible={filtersVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFiltersVisible(false)}
      >
        <Pressable style={styles.filterBackdrop} onPress={() => setFiltersVisible(false)}>
          <Pressable style={styles.filterCard} onPress={() => {}}>
            <Text style={styles.filterTitle}>{t("mapFilters")}</Text>

            <Text style={styles.filterLabel}>{t("mapMinRating")}</Text>
            <View style={styles.chipRow}>
              {RATING_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, minRating === r && styles.chipActive]}
                  onPress={() => setMinRating(r)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, minRating === r && styles.chipTextActive]}>
                    {r === 0 ? t("mapAnyRating") : `${r}+`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filterSwitchRow}>
              <Text style={styles.filterLabel}>{t("mapOnlyAvailable")}</Text>
              <Switch
                value={onlyAvailable}
                onValueChange={setOnlyAvailable}
                trackColor={{ true: theme.colors.primary, false: "#CBD5E1" }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.filterResetBtn} onPress={resetFilters} activeOpacity={0.8}>
                <Text style={styles.filterResetText}>{t("mapReset")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterApplyBtn} onPress={() => setFiltersVisible(false)} activeOpacity={0.8}>
                <Text style={styles.filterApplyText}>{t("mapApply")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: "absolute",
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.medium,
  },
  iconBtnActive: { backgroundColor: theme.colors.primary },
  searchPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    paddingHorizontal: 14,
    ...theme.shadows.medium,
  },
  searchInput: {
    flex: 1,
    ...typography.body2,
    color: theme.colors.text,
    paddingVertical: 0,
  },
  resultsCard: {
    position: "absolute",
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    maxHeight: 280,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    paddingVertical: 6,
    zIndex: 9,
    ...theme.shadows.large,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  resultMeta: { flex: 1 },
  resultName: { ...typography.body2, fontWeight: "700", color: theme.colors.text },
  resultCity: { ...typography.caption, color: theme.colors.textSecondary },
  resultBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  resultBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  resultsEmpty: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    textAlign: "center",
    paddingVertical: 16,
  },
  filterBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  filterCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: 14,
  },
  filterTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  filterLabel: { ...typography.body2, fontWeight: "600", color: theme.colors.text },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { ...typography.body2, color: theme.colors.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  filterSwitchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterActions: { flexDirection: "row", gap: 12, marginTop: 6 },
  filterResetBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  filterResetText: { ...typography.body2, fontWeight: "700", color: theme.colors.text },
  filterApplyBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
  },
  filterApplyText: { ...typography.body2, fontWeight: "700", color: "#fff" },
  centerButton: {
    position: "absolute",
    right: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.roundness,
    zIndex: 10,
    ...theme.shadows.medium,
  },
  requestGymBtn: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    zIndex: 5,
    ...theme.shadows.medium,
  },
  requestGymBtnText: { color: "#fff", fontWeight: "700" },
  map: { flex: 1 },
  mapLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.background,
  },
  mapLoadingText: { ...typography.body2, color: theme.colors.textSecondary },
  mapWarningPill: {
    position: "absolute",
    top: 90,
    left: 20,
    right: 20,
    alignSelf: "center",
    backgroundColor: "rgba(120,53,15,0.92)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mapWarningText: {
    ...typography.caption,
    color: "#FFF7ED",
    textAlign: "center",
    fontWeight: "600",
  },

  // ── Marker ──────────────────────────────────────────────
  // Transparent padding gives Android's marker→bitmap snapshot room so the
  // bubble (and its shadow) is never clipped at the capture edges. The badge is
  // positioned at top:-7/right:-9 relative to the bubble, so the padding must be
  // >= that to keep the badge inside the captured bitmap.
  markerWrap: { alignItems: "center", padding: 12 },
  markerBubble: {
    backgroundColor: "#fff",
    borderRadius: theme.roundness,
    padding: 8,
    borderWidth: 2.5,
    borderColor: theme.colors.primary,
    // iOS shadow only. On Android, `elevation` installs a rounded-rect
    // ViewOutlineProvider that clips the marker snapshot into a wedge
    // (worse the larger the bubble), so we omit elevation there.
    ...(Platform.OS === "ios" ? theme.shadows.medium : null),
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
  clusterWrap: { alignItems: "center", justifyContent: "center" },
  clusterBubble: {
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    // See markerBubble: Android elevation clips the snapshot, so iOS-only.
    ...(Platform.OS === "ios" ? theme.shadows.medium : null),
  },
  clusterCount: { color: "#fff", fontSize: 13, fontWeight: "800" },
  clusterTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
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
    ...theme.shadows.large,
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
  availBadgeOn: { backgroundColor: "#D1FAE5" },
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
  trainerViewLink: {
    ...typography.caption,
    color: theme.colors.primary,
    fontWeight: "700",
  },
});