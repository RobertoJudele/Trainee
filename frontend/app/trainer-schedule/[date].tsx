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
import {
  OutlineButton,
  ScheduleCard,
  StatusBadge,
  GradientActionButton,
  scheduleStatusColor,
  shortTime,
  toDateKey,
} from "../../src/components/schedule/SchedulePrimitives";

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

type DraggableClientCardProps = {
  client: PublicClient;
  selected: boolean;
  dragging: boolean;
  onSelect: (clientId: number) => void;
  onDragStart: (clientId: number) => void;
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
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          onDragStart(client.id);
        },
        onPanResponderMove: (_, gesture) => {
          pan.setValue({ x: gesture.dx, y: gesture.dy });
          onDragMove(gesture.moveX, gesture.moveY);
        },
        onPanResponderRelease: (_, gesture) => {
          const moved = Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8;
          if (!moved) {
            onSelect(client.id);
          }
          onDragEnd(client.id, gesture.moveX, gesture.moveY, moved);
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        },
        onPanResponderTerminate: () => {
          onDragEnd(client.id, -1, -1, false);
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        },
      }),
    [client.id, onDragEnd, onDragMove, onDragStart, onSelect, pan]
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.clientCard,
        selected && styles.clientCardSelected,
        dragging && styles.clientCardDragging,
        { transform: pan.getTranslateTransform() },
      ]}
    >
      <Text style={styles.clientName}>
        {client.firstName} {client.lastName}
      </Text>
      <Text numberOfLines={1} style={styles.clientSub}>
        {client.email}
      </Text>
    </Animated.View>
  );
}

export default function TrainerDayScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const user = useSelector(selectCurrentUser);

  const routeDate = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : toDateKey(new Date());

  const slotRefs = useRef<Record<number, View | null>>({});
  const slotRectsRef = useRef<Record<number, SlotRect>>({});
  const scrollRef = useRef<ScrollView | null>(null);

  const [clientCodeInput, setClientCodeInput] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [savedClients, setSavedClients] = useState<PublicClient[]>([]);
  const [draggingClientId, setDraggingClientId] = useState<number | null>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<number | null>(null);
  const [dragInProgress, setDragInProgress] = useState(false);
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
  const [regenStart, setRegenStart] = useState("");
  const [regenEnd, setRegenEnd] = useState("");
  const [regenDuration, setRegenDuration] = useState("");
  const [newSlotStart, setNewSlotStart] = useState("");
  const [newSlotEnd, setNewSlotEnd] = useState("");

  const onRegenerateDay = async () => {
    const hasCustom = regenStart.trim() !== "" || regenEnd.trim() !== "";
    if (hasCustom && !(/^([01]\d|2[0-3]):([0-5]\d)$/.test(regenStart) && /^([01]\d|2[0-3]):([0-5]\d)$/.test(regenEnd))) {
      Alert.alert("Validation", "Provide both start and end as HH:mm, or leave both empty to use your template.");
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
        "Day regenerated",
        `Added ${res.data.created}, removed ${res.data.removed}, kept ${res.data.preserved} assigned.`
      );
    } catch (error: unknown) {
      Alert.alert("Error", getErrorMessage(error, "Could not regenerate this day."));
    }
  };

  const onAddOneOffSlot = async () => {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(newSlotStart) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(newSlotEnd)) {
      Alert.alert("Validation", "Enter start and end as HH:mm.");
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
      Alert.alert("Error", getErrorMessage(error, "Could not add the slot."));
    }
  };

  const onDeleteSlot = (slotId: number) => {
    Alert.alert("Delete slot", "Remove this available slot?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSlot({ slotId }).unwrap();
          } catch (error: unknown) {
            Alert.alert("Error", getErrorMessage(error, "Could not delete the slot."));
          }
        },
      },
    ]);
  };

  const onBlockDay = async () => {
    try {
      await blockDate({ date: routeDate, timeZone: deviceTimeZone }).unwrap();
    } catch (error: unknown) {
      const conflicts = (error as any)?.data?.conflicts as
        | { client?: { firstName: string; lastName: string } | null }[]
        | undefined;
      if (conflicts && conflicts.length > 0) {
        const names = conflicts
          .map((c) => (c.client ? `${c.client.firstName} ${c.client.lastName}` : "a client"))
          .join(", ");
        Alert.alert("Cannot block day", `Unassign these first: ${names}`);
        return;
      }
      Alert.alert("Error", getErrorMessage(error, "Could not block this day."));
    }
  };

  const onUnblockDay = async () => {
    try {
      await unblockDate({ date: routeDate }).unwrap();
    } catch (error: unknown) {
      Alert.alert("Error", getErrorMessage(error, "Could not unblock this day."));
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
    for (const slot of availableSlots) {
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

  const onDragStart = (clientId: number) => {
    setDragInProgress(true);
    setDraggingClientId(clientId);
    setHoveredSlotId(null);
    refreshSlotRects();
  };

  const onDragMove = (pageX: number, pageY: number) => {
    const overId = hitTestSlot(pageX, pageY);
    setHoveredSlotId(overId);
  };

  const onDragEnd = (clientId: number, pageX: number, pageY: number, moved: boolean) => {
    const dropSlotId = moved ? hitTestSlot(pageX, pageY) : null;
    if (moved && dropSlotId) {
      setSelectedSlotId(dropSlotId);
      setSelectedClientId(clientId);
    }
    setDragInProgress(false);
    setDraggingClientId(null);
    setHoveredSlotId(null);
  };

  const onAddClientCode = async () => {
    const code = clientCodeInput.trim();
    if (!/^\d{6}$/.test(code)) {
      Alert.alert("Validation", "Client code must be 6 digits.");
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
      Alert.alert("Error", getErrorMessage(error, "Could not resolve client code."));
    }
  };

  const onAssign = async () => {
    if (!selectedSlotId) {
      Alert.alert("Validation", "Select or drop onto an available slot first.");
      return;
    }

    if (!selectedClientId) {
      Alert.alert("Validation", "Select a client first.");
      return;
    }

    try {
      await assignClientToSlot({
        slotId: selectedSlotId,
        clientId: selectedClientId,
        note: assignNote.trim() || undefined,
      }).unwrap();

      Alert.alert("Assigned", "Client assigned to slot.");
      setSelectedSlotId(null);
      setAssignNote("");
      await Promise.all([refetchSlots(), refetchPending()]);
    } catch (error: unknown) {
      Alert.alert("Error", getErrorMessage(error, "Could not assign client."));
    }
  };

  const onUnassign = async (slotId: number) => {
    try {
      await unassignClientFromSlot({ slotId }).unwrap();
      await refetchSlots();
    } catch (error: unknown) {
      Alert.alert("Error", getErrorMessage(error, "Could not remove assignment."));
    }
  };

  if (user?.role !== UserRole.TRAINER) {
    return (
      <View style={styles.deniedWrap}>
        <Text style={styles.deniedTitle}>Trainer access required</Text>
        <Text style={styles.deniedText}>This page is available only for trainer accounts.</Text>
        <OutlineButton label="Go to Home" onPress={() => router.replace("/")} />
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
            <OutlineButton label="Back" onPress={() => router.back()} />
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroEyebrow}>Daily Planner</Text>
              <Text style={styles.heroTitle}>{routeDate}</Text>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>Available</Text>
              <Text style={styles.statValue}>{availableSlots.length}</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>Assigned+</Text>
              <Text style={styles.statValue}>{assignedSlots.length}</Text>
            </View>
          </View>
        </View>

        <ScheduleCard
          title="Day controls"
          subtitle="Block this day, regenerate it from your template, or add a one-off slot."
        >
          {isBlocked ? (
            <View style={{ gap: 8 }}>
              <View style={styles.blockedBanner}>
                <Text style={styles.blockedBannerText}>
                  This day is blocked. No slots can be generated until you unblock it.
                </Text>
              </View>
              <GradientActionButton
                label={unblocking ? "Unblocking..." : "Unblock this day"}
                onPress={onUnblockDay}
                disabled={unblocking}
              />
              <Text style={styles.controlHint}>
                Unblocking does not recreate slots — regenerate the day afterwards.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={styles.controlLabel}>Regenerate this day</Text>
              <View style={styles.controlRow}>
                <TextInput
                  style={[styles.input, styles.controlField]}
                  value={regenStart}
                  onChangeText={setRegenStart}
                  placeholder="Start"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, styles.controlField]}
                  value={regenEnd}
                  onChangeText={setRegenEnd}
                  placeholder="End"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, styles.controlFieldNarrow]}
                  value={regenDuration}
                  onChangeText={setRegenDuration}
                  placeholder="Min"
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
              <OutlineButton
                label={regenerating ? "Regenerating..." : "Regenerate day"}
                onPress={onRegenerateDay}
                disabled={regenerating}
              />
              <Text style={styles.controlHint}>
                Leave times empty to use your saved template. Assigned slots are always kept.
              </Text>

              <Text style={styles.controlLabel}>Add a one-off slot</Text>
              <View style={styles.controlRow}>
                <TextInput
                  style={[styles.input, styles.controlField]}
                  value={newSlotStart}
                  onChangeText={setNewSlotStart}
                  placeholder="Start 14:00"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, styles.controlField]}
                  value={newSlotEnd}
                  onChangeText={setNewSlotEnd}
                  placeholder="End 15:00"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />
              </View>
              <OutlineButton
                label={creatingSlot ? "Adding..." : "Add slot"}
                onPress={onAddOneOffSlot}
                disabled={creatingSlot}
              />

              <Pressable
                style={styles.blockBtn}
                onPress={onBlockDay}
                disabled={blocking}
                accessibilityRole="button"
                accessibilityLabel="Block this day"
              >
                <Text style={styles.blockBtnText}>{blocking ? "Blocking..." : "Block this day"}</Text>
              </Pressable>
            </View>
          )}
        </ScheduleCard>

        <ScheduleCard
          title="Available Slots"
          subtitle="Drop a client card on a slot, or tap a slot to select it for assignment."
        >
          {slotsLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}

          {availableSlots.length === 0 ? (
            <Text style={styles.emptyText}>No available slots for this day.</Text>
          ) : (
            availableSlots.map((slot) => {
              const selected = selectedSlotId === slot.id;
              const hovered = hoveredSlotId === slot.id;

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
                    onPress={() => setSelectedSlotId(slot.id)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Available slot from ${shortTime(slot.startsAt)} to ${shortTime(slot.endsAt)}`}
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
            })
          )}
        </ScheduleCard>

      

        <ScheduleCard title="Assigned / Completed" subtitle="Manage existing assignments for this day.">
          {assignedSlots.length === 0 ? (
            <Text style={styles.emptyText}>No assigned slots yet.</Text>
          ) : (
            assignedSlots.map((slot) => (
              <View key={slot.id} style={[styles.slotCard, { borderColor: scheduleStatusColor(slot.status) }]}>
                <View style={styles.slotTopRow}>
                  <Text style={styles.slotTimeText}>
                    {shortTime(slot.startsAt)} - {shortTime(slot.endsAt)}
                  </Text>
                  <StatusBadge status={slot.status} />
                </View>
                <Text style={styles.assignedClientText}>
                  {slot.client ? `${slot.client.firstName} ${slot.client.lastName}` : "No client"}
                </Text>
                <Pressable
                style={styles.unassignBtn}
                onPress={() => onUnassign(slot.id)}
                disabled={unassigning}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Unassign client from slot at ${shortTime(slot.startsAt)}`}
              >
                  <Text style={styles.unassignBtnText}>{unassigning ? "Removing..." : "Unassign"}</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScheduleCard>

        <View style={styles.clientPool}>
          <View style={styles.clientPoolHeader}>
            <Text style={styles.clientPoolTitle}>Clients Area</Text>
            <Text style={styles.clientPoolHint}>Add by code once, then drag or tap-select.</Text>
          </View>

          <View style={styles.clientInputRow} onLayout={(event) => setClientInputY(event.nativeEvent.layout.y)}>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={clientCodeInput}
              onChangeText={setClientCodeInput}
              placeholder="Client code (6 digits)"
              placeholderTextColor={theme.colors.textSecondary}
              selectionColor={theme.colors.primary}
              cursorColor={theme.colors.primary}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={scrollToClientInput}
              keyboardType="number-pad"
            />
            <GradientActionButton label={resolvingCode ? "Adding..." : "Add"} onPress={onAddClientCode} disabled={resolvingCode} />
          </View>

          {pendingLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientList}>
            {availableClients.length === 0 ? (
              <Text style={styles.emptyText}>No clients added yet.</Text>
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
