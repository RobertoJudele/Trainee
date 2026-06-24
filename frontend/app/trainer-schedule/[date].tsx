import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Keyboard,
  KeyboardEvent,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { selectCurrentUser } from "../../features/auth/authSlice";
import { UserRole } from "../../features/auth/authApiSlice";
import {
  PublicClient,
  deviceTimeZone,
  useAssignClientToSlotMutation,
  useBlockDateMutation,
  useCreateOneOffSlotMutation,
  useDeleteSlotMutation,
  useGetBlockedDatesQuery,
  useGetPendingClientCodesQuery,
  useGetTrainerSlotsQuery,
  useRegenerateDayMutation,
  useResolveClientCodeMutation,
  useUnassignClientFromSlotMutation,
  useUnblockDateMutation,
} from "../../features/schedule/scheduleApiSlice";
import { theme, typography } from "../../src/lib/theme";
import { useLanguage } from "../../src/lib/i18n/LanguageContext";
import {
  BottomSheet,
  OutlineButton,
  ScheduleCard,
  StatusBadge,
  GradientActionButton,
  scheduleStatusColor,
  shortTime,
  toDateKey,
} from "../../src/components/schedule/SchedulePrimitives";
import { useTourTarget } from "../../src/components/onboarding/TourContext";

type SlotRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ApiErrorShape = {
  data?: {
    message?: string;
  };
};

interface SlotConflict {
  client?: { firstName: string; lastName: string } | null;
}

function getConflicts(error: unknown): SlotConflict[] | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof (error as { data?: unknown }).data === "object" &&
    (error as { data?: unknown }).data !== null
  ) {
    const data = (error as { data: { conflicts?: unknown } }).data;
    return Array.isArray(data.conflicts) ? (data.conflicts as SlotConflict[]) : undefined;
  }
  return undefined;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object") {
    const maybeError = error as ApiErrorShape;
    if (maybeError.data?.message) {
      return maybeError.data.message;
    }
  }
  return fallback;
};

const savedClientsStorageKey = (trainerUserId: number) => `trainer-saved-clients:${trainerUserId}`;

const DROP_FEEDBACK_META: Record<
  "success" | "error" | "unassign" | "delete",
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  success: { icon: "checkmark-circle", color: theme.colors.success },
  error: { icon: "close-circle", color: theme.colors.error },
  unassign: { icon: "person-remove", color: theme.colors.warning },
  delete: { icon: "trash", color: theme.colors.error },
};

type DraggableClientCardProps = {
  client: PublicClient;
  selected: boolean;
  dragging: boolean;
  onSelect: (clientId: number) => void;
  onDragStart: (
    client: PublicClient,
    pageX: number,
    pageY: number,
    cardX: number,
    cardY: number,
    width: number,
    height: number
  ) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDragEnd: (clientId: number, pageX: number, pageY: number, moved: boolean) => void;
};

function DraggableClientCard({
  client,
  selected,
  dragging,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: DraggableClientCardProps) {
  const ref = useRef<View | null>(null);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // Claim a vertical drag (to a slot above); leave horizontal swipes to the list scroll.
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        // Claim it before parent ScrollViews get a chance to steal it.
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        // Once dragging vertically, don't let a parent ScrollView take over mid-gesture.
        onPanResponderTerminationRequest: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => {
          const { pageX, pageY } = event.nativeEvent;
          ref.current?.measureInWindow((x, y, width, height) => {
            onDragStart(client, pageX, pageY, x, y, width, height);
          });
        },
        onPanResponderMove: (_, gesture) => {
          onDragMove(gesture.moveX, gesture.moveY);
        },
        onPanResponderRelease: (_, gesture) => {
          const moved = Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8;
          if (!moved) {
            onSelect(client.id);
          }
          onDragEnd(client.id, gesture.moveX, gesture.moveY, moved);
        },
        onPanResponderTerminate: () => {
          onDragEnd(client.id, -1, -1, false);
        },
      }),
    [client, onDragEnd, onDragMove, onDragStart, onSelect]
  );

  return (
    <View
      ref={ref}
      collapsable={false}
      {...panResponder.panHandlers}
      style={[
        styles.clientCard,
        selected && styles.clientCardSelected,
        dragging && styles.clientCardDragging,
        dragging && { opacity: 0.3 },
      ]}
    >
      <Text style={styles.clientName}>
        {client.firstName} {client.lastName}
      </Text>
      <Text numberOfLines={1} style={styles.clientSub}>
        {client.email}
      </Text>
    </View>
  );
}

export default function TrainerDayScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const user = useSelector(selectCurrentUser);
  const { t, language } = useLanguage();

  const routeDate = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : toDateKey(new Date());

  // Onboarding tour target.
  const slotsTourRef = useTourTarget("trainer-day-slots");

  const slotRefs = useRef<Record<number, View | null>>({});
  const slotRectsRef = useRef<Record<number, SlotRect>>({});
  const scrollRef = useRef<ScrollView | null>(null);

  // Floating drag preview rendered at the screen root so it isn't clipped by
  // the scroll containers around the client list.
  const dragLayerRef = useRef<View | null>(null);
  const dragPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragTouchOffset = useRef({ x: 0, y: 0 });
  const dragLayerOffset = useRef({ x: 0, y: 0 });
  const [activeDragClient, setActiveDragClient] = useState<PublicClient | null>(null);
  const [dragCardWidth, setDragCardWidth] = useState(210);

  const [clientCodeInput, setClientCodeInput] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [savedClients, setSavedClients] = useState<PublicClient[]>([]);
  const [draggingClientId, setDraggingClientId] = useState<number | null>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<number | null>(null);
  const [dragInProgress, setDragInProgress] = useState(false);

  // Feedback flash shown over a slot after an action: green pop on
  // assignment, red shake when a slot can't accept a client, amber pop on
  // unassign, and a red pop on delete/block.
  const [dropFeedback, setDropFeedback] = useState<{
    type: "success" | "error" | "unassign" | "delete";
    rect: SlotRect;
  } | null>(null);
  const dropFeedbackAnim = useRef(new Animated.Value(0)).current;
  const dropFeedbackShake = useRef(new Animated.Value(0)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [clientInputY, setClientInputY] = useState(0);

  const {
    data: slotsResp,
    isLoading: slotsLoading,
    refetch: refetchSlots,
  } = useGetTrainerSlotsQuery({
    from: routeDate,
    to: routeDate,
  });

  const {
    data: pendingResp,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useGetPendingClientCodesQuery();

  const [resolveClientCode, { isLoading: resolvingCode }] = useResolveClientCodeMutation();
  const [assignClientToSlot, { isLoading: assigning }] = useAssignClientToSlotMutation();
  const [unassignClientFromSlot, { isLoading: unassigning }] = useUnassignClientFromSlotMutation();

  const { data: blockedResp } = useGetBlockedDatesQuery({ from: routeDate, to: routeDate });
  const [regenerateDay, { isLoading: regenerating }] = useRegenerateDayMutation();
  const [createOneOffSlot, { isLoading: creatingSlot }] = useCreateOneOffSlotMutation();
  const [deleteSlot] = useDeleteSlotMutation();
  const [blockDate, { isLoading: blocking }] = useBlockDateMutation();
  const [unblockDate, { isLoading: unblocking }] = useUnblockDateMutation();

  const isBlocked = (blockedResp?.data?.length ?? 0) > 0;

  // Day-control form state.
  const [showControls, setShowControls] = useState(false);
  const [regenStart, setRegenStart] = useState("");
  const [regenEnd, setRegenEnd] = useState("");
  const [regenDuration, setRegenDuration] = useState("");
  const [newSlotStart, setNewSlotStart] = useState("");
  const [newSlotEnd, setNewSlotEnd] = useState("");

  const onRegenerateDay = async () => {
    const hasCustom = regenStart.trim() !== "" || regenEnd.trim() !== "";
    if (hasCustom && !(/^([01]\d|2[0-3]):([0-5]\d)$/.test(regenStart) && /^([01]\d|2[0-3]):([0-5]\d)$/.test(regenEnd))) {
      Alert.alert(t("validation"), t("dayValidationHHmm"));
      return;
    }
    try {
      const res = await regenerateDay({
        date: routeDate,
        startTime: hasCustom ? regenStart : undefined,
        endTime: hasCustom ? regenEnd : undefined,
        slotDurationMin: regenDuration ? Number(regenDuration) : undefined,
        timeZone: deviceTimeZone,
      }).unwrap();
      setRegenStart("");
      setRegenEnd("");
      setRegenDuration("");
      Alert.alert(
        t("dayRegenerated"),
        t("dayRegeneratedMsg").replace("{added}", String(res.data.created)).replace("{removed}", String(res.data.removed)).replace("{kept}", String(res.data.preserved))
      );
    } catch (error: unknown) {
      Alert.alert(t("error"), getErrorMessage(error, t("dayCouldNotRegenerate")));
    }
  };

  const onAddOneOffSlot = async () => {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(newSlotStart) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(newSlotEnd)) {
      Alert.alert(t("validation"), t("dayValidationHHmm"));
      return;
    }
    try {
      await createOneOffSlot({
        date: routeDate,
        startTime: newSlotStart,
        endTime: newSlotEnd,
        timeZone: deviceTimeZone,
      }).unwrap();
      setNewSlotStart("");
      setNewSlotEnd("");
    } catch (error: unknown) {
      Alert.alert(t("error"), getErrorMessage(error, t("dayCouldNotAddSlot")));
    }
  };

  const onDeleteSlot = (slotId: number) => {
    Alert.alert(t("dayDeleteSlot"), t("dayDeleteSlotMsg"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSlot({ slotId }).unwrap();
            showDropFeedback("delete", slotId);
          } catch (error: unknown) {
            Alert.alert(t("error"), getErrorMessage(error, t("dayCouldNotDeleteSlot")));
          }
        },
      },
    ]);
  };

  const onBlockSlot = (slotId: number, startsAt: string, endsAt: string) => {
    Alert.alert(`${shortTime(startsAt)} - ${shortTime(endsAt)}`, t("dayBlockSlotMsg"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("dayBlockBtn"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSlot({ slotId }).unwrap();
            showDropFeedback("delete", slotId);
          } catch (error: unknown) {
            Alert.alert(t("error"), getErrorMessage(error, t("dayCouldNotBlockSlot")));
          }
        },
      },
    ]);
  };

  const onBlockDay = async () => {
    try {
      await blockDate({ date: routeDate, timeZone: deviceTimeZone }).unwrap();
    } catch (error: unknown) {
      const conflicts = getConflicts(error);
      if (conflicts && conflicts.length > 0) {
        const names = conflicts
          .map((c) => (c.client ? `${c.client.firstName} ${c.client.lastName}` : t("dayAClient")))
          .join(", ");
        Alert.alert(t("dayCannotBlock"), t("dayUnassignFirst").replace("{names}", names));
        return;
      }
      Alert.alert(t("error"), getErrorMessage(error, t("dayCouldNotBlockDay")));
    }
  };

  const onUnblockDay = async () => {
    try {
      await unblockDate({ date: routeDate }).unwrap();
    } catch (error: unknown) {
      Alert.alert(t("error"), getErrorMessage(error, t("dayCouldNotUnblock")));
    }
  };

  useEffect(() => {
    const loadSavedClients = async () => {
      if (!user?.id || user.role !== UserRole.TRAINER) return;
      try {
        const raw = await AsyncStorage.getItem(savedClientsStorageKey(user.id));
        if (!raw) return;
        const parsed = JSON.parse(raw) as PublicClient[];
        if (!Array.isArray(parsed)) return;
        setSavedClients(parsed);
      } catch {
        // Keep local list optional.
      }
    };

    loadSavedClients();
  }, [user?.id, user?.role]);

  useEffect(() => {
    const persistSavedClients = async () => {
      if (!user?.id || user.role !== UserRole.TRAINER) return;
      try {
        await AsyncStorage.setItem(savedClientsStorageKey(user.id), JSON.stringify(savedClients));
      } catch {
        // Ignore persistence errors.
      }
    };

    persistSavedClients();
  }, [savedClients, user?.id, user?.role]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    };

    const onHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const daySlots = useMemo(
    () => [...(slotsResp?.data || [])].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [slotsResp?.data]
  );

  const availableSlots = useMemo(() => daySlots.filter((slot) => slot.status === "available"), [daySlots]);
  const assignedSlots = useMemo(() => daySlots.filter((slot) => slot.status !== "available"), [daySlots]);

  const availableClients = useMemo(() => {
    const byId = new Map<number, PublicClient>();

    for (const item of pendingResp?.data || []) {
      byId.set(item.client.id, item.client);
    }

    for (const client of savedClients) {
      byId.set(client.id, client);
    }

    for (const slot of assignedSlots) {
      if (slot.client) {
        byId.set(slot.client.id, {
          id: slot.client.id,
          email: slot.client.email,
          firstName: slot.client.firstName,
          lastName: slot.client.lastName,
        });
      }
    }

    return Array.from(byId.values()).sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [pendingResp?.data, savedClients, assignedSlots]);

  const selectedClient = availableClients.find((client) => client.id === selectedClientId) || null;
  const contentBottomPadding = keyboardHeight > 0 ? keyboardHeight + 90 : 24;

  const scrollToClientInput = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, clientInputY - 140),
        animated: true,
      });
    });
  };

  const refreshSlotRects = () => {
    for (const slot of daySlots) {
      const node = slotRefs.current[slot.id];
      if (!node) continue;
      node.measureInWindow((x, y, width, height) => {
        slotRectsRef.current[slot.id] = { x, y, width, height };
      });
    }
  };

  const hitTestSlot = (pageX: number, pageY: number) => {
    const found = availableSlots.find((slot) => {
      const rect = slotRectsRef.current[slot.id];
      if (!rect) return false;
      return pageX >= rect.x && pageX <= rect.x + rect.width && pageY >= rect.y && pageY <= rect.y + rect.height;
    });
    return found?.id || null;
  };

  const hitTestAnySlot = (pageX: number, pageY: number) => {
    return daySlots.find((slot) => {
      const rect = slotRectsRef.current[slot.id];
      if (!rect) return false;
      return pageX >= rect.x && pageX <= rect.x + rect.width && pageY >= rect.y && pageY <= rect.y + rect.height;
    });
  };

  const showDropFeedback = (type: "success" | "error" | "unassign" | "delete", slotId: number) => {
    const rect = slotRectsRef.current[slotId];
    if (!rect) return;
    setDropFeedback({ type, rect });
    dropFeedbackAnim.setValue(0);
    dropFeedbackShake.setValue(0);

    if (type === "success") {
      Animated.sequence([
        Animated.spring(dropFeedbackAnim, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
        Animated.delay(350),
        Animated.timing(dropFeedbackAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setDropFeedback(null));
    } else if (type === "error") {
      Animated.timing(dropFeedbackAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
      Animated.sequence([
        Animated.timing(dropFeedbackShake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(dropFeedbackShake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(dropFeedbackShake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(dropFeedbackShake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(dropFeedbackShake, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.delay(550),
        Animated.timing(dropFeedbackAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setDropFeedback(null));
    } else {
      // Unassign / delete — pop the icon in, hold briefly, then fade & shrink away.
      Animated.sequence([
        Animated.spring(dropFeedbackAnim, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
        Animated.delay(300),
        Animated.timing(dropFeedbackAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setDropFeedback(null));
    }
  };

  const onDragStart = (
    client: PublicClient,
    pageX: number,
    pageY: number,
    cardX: number,
    cardY: number,
    width: number,
    height: number
  ) => {
    dragTouchOffset.current = { x: pageX - cardX, y: pageY - cardY };
    setDragCardWidth(width);
    setDraggingClientId(client.id);
    setActiveDragClient(client);
    setDragInProgress(true);
    setHoveredSlotId(null);
    refreshSlotRects();

    // Measure the overlay layer's window offset so page coords map into it.
    dragLayerRef.current?.measureInWindow((lx, ly) => {
      dragLayerOffset.current = { x: lx, y: ly };
      dragPos.setValue({ x: cardX - lx, y: cardY - ly });
    });
  };

  const onDragMove = (pageX: number, pageY: number) => {
    dragPos.setValue({
      x: pageX - dragTouchOffset.current.x - dragLayerOffset.current.x,
      y: pageY - dragTouchOffset.current.y - dragLayerOffset.current.y,
    });
    setHoveredSlotId(hitTestSlot(pageX, pageY));
  };

  const assignClient = async (slotId: number, clientId: number) => {
    try {
      await assignClientToSlot({
        slotId,
        clientId,
        note: assignNote.trim() || undefined,
      }).unwrap();
      setSelectedSlotId(null);
      setSelectedClientId(null);
      setAssignNote("");
      showDropFeedback("success", slotId);
      await Promise.all([refetchSlots(), refetchPending()]);
    } catch (error: unknown) {
      showDropFeedback("error", slotId);
      Alert.alert(t("error"), getErrorMessage(error, t("dayCouldNotAssign")));
    }
  };

  const onDragEnd = (clientId: number, pageX: number, pageY: number, moved: boolean) => {
    const dropSlot = moved ? hitTestAnySlot(pageX, pageY) : undefined;
    setDragInProgress(false);
    setDraggingClientId(null);
    setActiveDragClient(null);
    setHoveredSlotId(null);

    if (!dropSlot) return;

    if (dropSlot.status !== "available") {
      // Dropped onto a slot that's already taken — flash it as not available.
      showDropFeedback("error", dropSlot.id);
      return;
    }

    void assignClient(dropSlot.id, clientId);
  };

  const onAddClientCode = async () => {
    const code = clientCodeInput.trim();
    if (!/^\d{6}$/.test(code)) {
      Alert.alert(t("validation"), t("dayCodeMust6"));
      return;
    }

    try {
      const resp = await resolveClientCode({ code }).unwrap();
      const client = resp.data.client;
      setSavedClients((prev) => {
        if (prev.some((entry) => entry.id === client.id)) return prev;
        return [client, ...prev];
      });
      setSelectedClientId(client.id);
      setClientCodeInput("");
    } catch (error: unknown) {
      Alert.alert(t("error"), getErrorMessage(error, t("dayCouldNotResolveCode")));
    }
  };

  const onAssign = async () => {
    if (!selectedSlotId) {
      Alert.alert(t("validation"), t("daySelectSlotFirst"));
      return;
    }

    if (!selectedClientId) {
      Alert.alert(t("validation"), t("daySelectClientFirst"));
      return;
    }

    await assignClient(selectedSlotId, selectedClientId);
  };

  const onUnassign = async (slotId: number) => {
    try {
      await unassignClientFromSlot({ slotId }).unwrap();
      showDropFeedback("unassign", slotId);
      await refetchSlots();
    } catch (error: unknown) {
      Alert.alert(t("error"), getErrorMessage(error, t("dayCouldNotUnassign")));
    }
  };

  if (user?.role !== UserRole.TRAINER) {
    return (
      <View style={styles.deniedWrap}>
        <Text style={styles.deniedTitle}>{t("scheduleTrainerRequired")}</Text>
        <Text style={styles.deniedText}>{t("dayTrainerOnlyMsg")}</Text>
        <OutlineButton label={t("goHome")} onPress={() => router.replace("/")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!dragInProgress}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Pressable
              style={styles.kebabBtn}
              onPress={() => setShowControls(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("dayControlsTitle")}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={theme.colors.text} />
            </Pressable>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroEyebrow}>{t("dayPlannerEyebrow")}</Text>
              <Text style={styles.heroTitle}>{routeDate}</Text>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>{t("dayStatOpen")}</Text>
              <Text style={styles.statValue}>{availableSlots.length}</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>{t("dayStatAssigned")}</Text>
              <Text style={styles.statValue}>{assignedSlots.length}</Text>
            </View>
          </View>
        </View>

        <BottomSheet
          visible={showControls}
          title={t("dayControlsTitle")}
          subtitle={routeDate}
          onClose={() => setShowControls(false)}
        >
          {isBlocked ? (
            <View style={{ gap: 8 }}>
              <View style={styles.blockedBanner}>
                <Text style={styles.blockedBannerText}>
                  {t("dayBlockedNoSlots")}
                </Text>
              </View>
              <GradientActionButton
                label={unblocking ? t("dayUnblocking") : t("dayUnblockThis")}
                onPress={onUnblockDay}
                disabled={unblocking}
              />
              <Text style={styles.controlHint}>
                {t("dayUnblockHint")}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={styles.controlLabel}>{t("dayRegenerateThis")}</Text>
              <View style={styles.controlRow}>
                <TextInput
                  style={[styles.input, styles.controlField]}
                  value={regenStart}
                  onChangeText={setRegenStart}
                  placeholder={t("scheduleStart")}
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, styles.controlField]}
                  value={regenEnd}
                  onChangeText={setRegenEnd}
                  placeholder={t("scheduleEnd")}
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, styles.controlFieldNarrow]}
                  value={regenDuration}
                  onChangeText={setRegenDuration}
                  placeholder={t("scheduleMins")}
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
              <OutlineButton
                label={regenerating ? t("dayRegenerating") : t("dayRegenerateDay")}
                onPress={onRegenerateDay}
                disabled={regenerating}
              />
              <Text style={styles.controlHint}>
                {t("dayRegenHint")}
              </Text>

              <Text style={styles.controlLabel}>{t("dayAddOneOff")}</Text>
              <View style={styles.controlRow}>
                <TextInput
                  style={[styles.input, styles.controlField]}
                  value={newSlotStart}
                  onChangeText={setNewSlotStart}
                  placeholder={t("dayOneOffStartPh")}
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, styles.controlField]}
                  value={newSlotEnd}
                  onChangeText={setNewSlotEnd}
                  placeholder={t("dayOneOffEndPh")}
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />
              </View>
              <OutlineButton
                label={creatingSlot ? t("dayAdding") : t("dayAddSlot")}
                onPress={onAddOneOffSlot}
                disabled={creatingSlot}
              />

              <Pressable
                style={styles.blockBtn}
                onPress={onBlockDay}
                disabled={blocking}
                accessibilityRole="button"
                accessibilityLabel={t("dayBlockThis")}
              >
                <Text style={styles.blockBtnText}>{blocking ? t("dayBlocking") : t("dayBlockThis")}</Text>
              </Pressable>
            </View>
          )}
        </BottomSheet>

        {isBlocked ? (
          <View style={styles.blockedBanner}>
            <Text style={styles.blockedBannerText}>
              {t("dayBlockedTapDots")}
            </Text>
          </View>
        ) : null}

        <View ref={slotsTourRef} collapsable={false}>
        <ScheduleCard
          title={t("daySlotsTitle")}
          subtitle={t("daySlotsSubtitle")}
        >
          {slotsLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}

          {daySlots.length === 0 ? (
            <Text style={styles.emptyText}>{t("dayNoSlots")}</Text>
          ) : (
            daySlots.map((slot) => {
              const selected = selectedSlotId === slot.id;
              const hovered = hoveredSlotId === slot.id;

              if (slot.status === "available") {
                return (
                  <View
                    key={slot.id}
                    ref={(node) => {
                      slotRefs.current[slot.id] = node;
                    }}
                    collapsable={false}
                    onLayout={refreshSlotRects}
                  >
                    <Pressable
                      onPress={() => onBlockSlot(slot.id, slot.startsAt, slot.endsAt)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Open slot from ${shortTime(slot.startsAt)} to ${shortTime(slot.endsAt)}, tap to block`}
                      style={[
                        styles.slotCard,
                        { borderColor: scheduleStatusColor(slot.status) },
                        selected && styles.slotCardSelected,
                        hovered && styles.slotCardHovered,
                      ]}
                    >
                      <View style={styles.slotTopRow}>
                        <Text style={styles.slotTimeText}>
                          {shortTime(slot.startsAt)} - {shortTime(slot.endsAt)}
                        </Text>
                        <View style={styles.slotActions}>
                          <StatusBadge status={slot.status} />
                          <Pressable
                            onPress={() => onDeleteSlot(slot.id)}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`Delete slot at ${shortTime(slot.startsAt)}`}
                          >
                            <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  </View>
                );
              }

              return (
                <View
                  key={slot.id}
                  ref={(node) => {
                    slotRefs.current[slot.id] = node;
                  }}
                  collapsable={false}
                  onLayout={refreshSlotRects}
                  style={[styles.slotCard, { borderColor: scheduleStatusColor(slot.status) }]}
                >
                  <View style={styles.slotTopRow}>
                    <Text style={styles.slotTimeText}>
                      {shortTime(slot.startsAt)} - {shortTime(slot.endsAt)}
                    </Text>
                    <StatusBadge status={slot.status} />
                  </View>
                  <Text style={styles.assignedClientText}>
                    {slot.client ? `${slot.client.firstName} ${slot.client.lastName}` : t("dayNoClient")}
                  </Text>
                  {slot.status === "assigned" ? (
                    <Pressable
                      style={styles.unassignBtn}
                      onPress={() => onUnassign(slot.id)}
                      disabled={unassigning}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Unassign client from slot at ${shortTime(slot.startsAt)}`}
                    >
                      <Text style={styles.unassignBtnText}>{unassigning ? t("dayRemoving") : t("dayUnassign")}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </ScheduleCard>
        </View>

        <View style={styles.clientPool}>
          <View style={styles.clientPoolHeader}>
            <Text style={styles.clientPoolTitle}>{t("dayClientsArea")}</Text>
            <Text style={styles.clientPoolHint}>{t("dayClientsHint")}</Text>
          </View>

          <View style={styles.clientInputRow} onLayout={(event) => setClientInputY(event.nativeEvent.layout.y)}>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={clientCodeInput}
              onChangeText={setClientCodeInput}
              placeholder={t("dayClientCodePh")}
              placeholderTextColor={theme.colors.textSecondary}
              selectionColor={theme.colors.primary}
              cursorColor={theme.colors.primary}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={scrollToClientInput}
              keyboardType="number-pad"
            />
            <GradientActionButton label={resolvingCode ? t("dayAdding") : t("dayAddBtn")} onPress={onAddClientCode} disabled={resolvingCode} />
          </View>

          {pendingLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientList}>
            {availableClients.length === 0 ? (
              <Text style={styles.emptyText}>{t("dayNoClients")}</Text>
            ) : (
              availableClients.map((client) => {
                const selected = selectedClientId === client.id;
                const dragging = draggingClientId === client.id;

                return (
                  <DraggableClientCard
                    key={client.id}
                    client={client}
                    selected={selected}
                    dragging={dragging}
                    onSelect={(id) => setSelectedClientId(id)}
                    onDragStart={onDragStart}
                    onDragMove={onDragMove}
                    onDragEnd={onDragEnd}
                  />
                );
              })
            )}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Floating drag preview — lives at the screen root so it isn't clipped by the scroll views. */}
      <View
        ref={dragLayerRef}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        collapsable={false}
        onLayout={() => {
          dragLayerRef.current?.measureInWindow((lx, ly) => {
            dragLayerOffset.current = { x: lx, y: ly };
          });
        }}
      >
        {activeDragClient ? (
          <Animated.View
            style={[
              styles.dragOverlayCard,
              { width: dragCardWidth, transform: dragPos.getTranslateTransform() },
            ]}
          >
            <Text style={styles.clientName}>
              {activeDragClient.firstName} {activeDragClient.lastName}
            </Text>
            <Text numberOfLines={1} style={styles.clientSub}>
              {activeDragClient.email}
            </Text>
          </Animated.View>
        ) : null}

        {dropFeedback
          ? (() => {
              const meta = DROP_FEEDBACK_META[dropFeedback.type];
              const isError = dropFeedback.type === "error";
              return (
                <Animated.View
                  style={[
                    styles.dropFeedbackOverlay,
                    {
                      left: dropFeedback.rect.x - dragLayerOffset.current.x,
                      top: dropFeedback.rect.y - dragLayerOffset.current.y,
                      width: dropFeedback.rect.width,
                      height: dropFeedback.rect.height,
                      borderColor: meta.color,
                      backgroundColor: `${meta.color}33`,
                      opacity: dropFeedbackAnim,
                      transform: [
                        {
                          scale: dropFeedbackAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.9, 1],
                          }),
                        },
                        {
                          translateX: isError
                            ? dropFeedbackShake.interpolate({
                                inputRange: [-1, 1],
                                outputRange: [-8, 8],
                              })
                            : 0,
                        },
                      ],
                    },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.dropFeedbackBadge,
                      {
                        backgroundColor: meta.color,
                        opacity: dropFeedbackAnim,
                        transform: [
                          {
                            scale: dropFeedbackAnim.interpolate({
                              inputRange: [0, 0.6, 1],
                              outputRange: [0.4, 1.2, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name={meta.icon} size={20} color="#FFFFFF" />
                  </Animated.View>
                </Animated.View>
              );
            })()
          : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EEF3F8",
  },
  container: {
    flex: 1,
    backgroundColor: "#EEF3F8",
  },
  content: {
    padding: 14,
    gap: 12,
    paddingBottom: 24,
  },
  deniedWrap: {
    flex: 1,
    backgroundColor: "#EEF3F8",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  deniedTitle: {
    ...typography.h3,
    color: theme.colors.text,
  },
  deniedText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D6DEE9",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 10,
    ...theme.shadows.small,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  kebabBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CED7E3",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitleWrap: {
    flex: 1,
    gap: 2,
  },
  heroEyebrow: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  heroTitle: {
    ...typography.h2,
    color: theme.colors.text,
    fontWeight: "800",
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DBE3EF",
    backgroundColor: "#F7FAFE",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  statLabel: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  statValue: {
    ...typography.h3,
    color: theme.colors.text,
    fontWeight: "800",
  },
  slotCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#FFFFFF",
    gap: 6,
  },
  slotCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}10`,
  },
  slotCardHovered: {
    borderColor: theme.colors.success,
    backgroundColor: `${theme.colors.success}12`,
  },
  slotTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  slotActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  controlLabel: {
    ...typography.body2,
    color: theme.colors.text,
    fontWeight: "700",
  },
  controlRow: {
    flexDirection: "row",
    gap: 8,
  },
  controlField: {
    flex: 1,
  },
  controlFieldNarrow: {
    width: 70,
  },
  controlHint: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  blockedBanner: {
    borderRadius: 12,
    backgroundColor: `${theme.colors.warning}18`,
    borderWidth: 1,
    borderColor: `${theme.colors.warning}55`,
    padding: 10,
  },
  blockedBannerText: {
    ...typography.body2,
    color: "#92400E",
  },
  blockBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  blockBtnText: {
    ...typography.caption,
    color: theme.colors.error,
    textTransform: "none",
    fontWeight: "700",
  },
  slotTimeText: {
    ...typography.body2,
    color: theme.colors.text,
    fontWeight: "700",
  },
  selectionText: {
    ...typography.body2,
    color: theme.colors.text,
  },
  assignedClientText: {
    ...typography.body2,
    color: theme.colors.text,
  },
  unassignBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#CFD8E6",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  unassignBtnText: {
    ...typography.caption,
    color: theme.colors.text,
    textTransform: "none",
    fontWeight: "700",
  },
  clientPool: {
    borderWidth: 1,
    borderColor: "#CED8E6",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 12,
    gap: 10,
    ...theme.shadows.medium,
  },
  clientPoolHeader: {
    gap: 2,
  },
  clientPoolTitle: {
    ...typography.body1,
    color: theme.colors.text,
    fontWeight: "700",
  },
  clientPoolHint: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
  clientInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CFD9E7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: "#FFFFFF",
  },
  codeInput: {
    flex: 1,
  },
  clientList: {
    gap: 8,
    paddingRight: 8,
  },
  clientCard: {
    width: 210,
    borderWidth: 1,
    borderColor: "#D5DEEA",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#FFFFFF",
    gap: 3,
  },
  clientCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}10`,
  },
  clientCardDragging: {
    borderColor: "#D97706",
    backgroundColor: "#FFF7ED",
    ...theme.shadows.large,
  },
  dragOverlayCard: {
    position: "absolute",
    top: 0,
    left: 0,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#FFFFFF",
    gap: 3,
    ...theme.shadows.large,
    zIndex: 9999,
    elevation: 12,
  },
  dropFeedbackOverlay: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: 12,
    zIndex: 9998,
    elevation: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  dropFeedbackBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.medium,
  },
  clientName: {
    ...typography.body2,
    color: theme.colors.text,
    fontWeight: "700",
  },
  clientSub: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "none",
  },
  emptyText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
});
