import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { selectCurrentUser } from "../../features/auth/authSlice";
import { UserRole } from "../../features/auth/authApiSlice";
import {
  PublicClient,
  useAssignClientToSlotMutation,
  useGetPendingClientCodesQuery,
  useGetTrainerSlotsQuery,
  useResolveClientCodeMutation,
  useUnassignClientFromSlotMutation,
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

  const [clientCodeInput, setClientCodeInput] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [savedClients, setSavedClients] = useState<PublicClient[]>([]);
  const [draggingClientId, setDraggingClientId] = useState<number | null>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<number | null>(null);
  const [dragInProgress, setDragInProgress] = useState(false);

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
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
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
                      <StatusBadge status={slot.status} />
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
                <Pressable style={styles.unassignBtn} onPress={() => onUnassign(slot.id)} disabled={unassigning}>
                  <Text style={styles.unassignBtnText}>{unassigning ? "Removing..." : "Unassign"}</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScheduleCard>
      </ScrollView>

      <View style={styles.clientPool}>
        <View style={styles.clientPoolHeader}>
          <Text style={styles.clientPoolTitle}>Clients Area</Text>
          <Text style={styles.clientPoolHint}>Add by code once, then drag or tap-select.</Text>
        </View>

        <View style={styles.clientInputRow}>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={clientCodeInput}
            onChangeText={setClientCodeInput}
            placeholder="Client code (6 digits)"
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
    </View>
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
    paddingBottom: 235,
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
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderWidth: 1,
    borderColor: "#CED8E6",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 12,
    gap: 10,
    maxHeight: 220,
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
