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
  PendingClientCode,
  PublicClient,
  ScheduleSlot,
  useAssignClientToSlotMutation,
  useGetPendingClientCodesQuery,
  useGetTrainerSlotsQuery,
  useResolveClientCodeMutation,
} from "../../features/schedule/scheduleApiSlice";
import { theme, typography } from "../../src/lib/theme";

type SlotRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const shortTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const statusColor = (status: ScheduleSlot["status"]) => {
  if (status === "available") return "#198754";
  if (status === "assigned") return "#0D6EFD";
  if (status === "completed") return "#6F42C1";
  if (status === "canceled") return "#DC3545";
  return "#B54708";
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
      <Text style={styles.clientSub}>{client.email}</Text>
    </Animated.View>
  );
}

export default function TrainerDayScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const user = useSelector(selectCurrentUser);

  const routeDate = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
    ? params.date
    : toDateKey(new Date());

  const slotRefs = useRef<Record<number, View | null>>({});
  const slotRectsRef = useRef<Record<number, SlotRect>>({});

  const [clientCodeInput, setClientCodeInput] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [savedClients, setSavedClients] = useState<PublicClient[]>([]);
  const [draggingClientId, setDraggingClientId] = useState<number | null>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<number | null>(null);

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
        // Ignore local storage parse errors and continue with empty list.
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
        // Ignore local storage write errors.
      }
    };

    persistSavedClients();
  }, [savedClients, user?.id, user?.role]);

  const daySlots = useMemo(
    () => [...(slotsResp?.data || [])].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [slotsResp?.data]
  );

  const availableSlots = useMemo(() => daySlots.filter((s) => s.status === "available"), [daySlots]);
  const assignedSlots = useMemo(() => daySlots.filter((s) => s.status !== "available"), [daySlots]);

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

    return Array.from(byId.values()).sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
  }, [pendingResp?.data, savedClients, assignedSlots]);

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
      return (
        pageX >= rect.x &&
        pageX <= rect.x + rect.width &&
        pageY >= rect.y &&
        pageY <= rect.y + rect.height
      );
    });
    return found?.id || null;
  };

  const onDragStart = (clientId: number) => {
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
        if (prev.some((p) => p.id === client.id)) return prev;
        return [client, ...prev];
      });
      setSelectedClientId(client.id);
      setClientCodeInput("");
    } catch (error: any) {
      Alert.alert("Error", error?.data?.message || "Could not resolve client code.");
    }
  };

  const onAssign = async () => {
    if (!selectedSlotId) {
      Alert.alert("Validation", "Select or drop onto an available slot first.");
      return;
    }

    if (!selectedClientId) {
      Alert.alert("Validation", "Select a client from the clients area first.");
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
    } catch (error: any) {
      Alert.alert("Error", error?.data?.message || "Could not assign client.");
    }
  };

  if (user?.role !== UserRole.TRAINER) {
    return (
      <View style={styles.deniedWrap}>
        <Text style={styles.deniedTitle}>Trainer access required</Text>
        <Text style={styles.deniedText}>This page is available only for trainer accounts.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace("/")}>
          <Text style={styles.primaryBtnText}>Go to Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Day: {routeDate}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Clients Area</Text>
        <Text style={styles.hint}>Insert code once, then reuse the client by drag-drop or tap-select.</Text>

        <View style={styles.inlineRow}>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={clientCodeInput}
            onChangeText={setClientCodeInput}
            placeholder="Client code (6 digits)"
            keyboardType="number-pad"
          />
          <Pressable style={styles.secondaryBtn} onPress={onAddClientCode} disabled={resolvingCode}>
            <Text style={styles.secondaryBtnText}>{resolvingCode ? "Adding..." : "Add"}</Text>
          </Pressable>
        </View>

        {pendingLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}

        <View style={styles.clientList}>
          {availableClients.length === 0 ? (
            <Text style={styles.emptyText}>No clients added yet. Add one with a valid 6-digit code.</Text>
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
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Available Slots</Text>
        <Text style={styles.hint}>Drop a client card on a slot, or tap a slot to select it.</Text>

        {slotsLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}

        <View style={styles.slotList}>
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
                  onLayout={refreshSlotRects}
                  style={[
                    styles.slotCard,
                    { borderColor: statusColor(slot.status) },
                    selected && styles.slotCardSelected,
                    hovered && styles.slotCardHovered,
                  ]}
                >
                  <Pressable onPress={() => setSelectedSlotId(slot.id)}>
                    <Text style={styles.slotCardTitle}>#{slot.id}</Text>
                    <Text style={styles.slotCardText}>
                      {shortTime(slot.startsAt)} - {shortTime(slot.endsAt)}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        <TextInput
          style={styles.input}
          value={assignNote}
          onChangeText={setAssignNote}
          placeholder="Optional note"
        />

        <Pressable style={styles.primaryBtn} onPress={onAssign} disabled={assigning}>
          <Text style={styles.primaryBtnText}>{assigning ? "Assigning..." : "Confirm Assignment"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Assigned / Completed</Text>
        <View style={styles.slotList}>
          {assignedSlots.length === 0 ? (
            <Text style={styles.emptyText}>No assigned slots yet.</Text>
          ) : (
            assignedSlots.map((slot) => (
              <View key={slot.id} style={[styles.slotCard, { borderColor: statusColor(slot.status) }]}>
                <Text style={styles.slotCardTitle}>#{slot.id}</Text>
                <Text style={styles.slotCardText}>
                  {shortTime(slot.startsAt)} - {shortTime(slot.endsAt)}
                </Text>
                <Text style={styles.slotCardText}>
                  {slot.client ? `${slot.client.firstName} ${slot.client.lastName}` : "No client"}
                </Text>
                <Text style={[styles.slotStatus, { color: statusColor(slot.status) }]}>{slot.status}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  deniedWrap: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  deniedTitle: { ...typography.h3, color: theme.colors.text },
  deniedText: { ...typography.body2, color: theme.colors.textSecondary, textAlign: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { ...typography.h3, color: theme.colors.text, fontWeight: "700" },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  sectionTitle: { ...typography.body1, color: theme.colors.text, fontWeight: "700" },
  hint: { ...typography.caption, color: theme.colors.textSecondary },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: "#fff",
  },
  codeInput: { flex: 1 },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  primaryBtnText: { ...typography.body2, color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  secondaryBtnText: { ...typography.caption, color: theme.colors.text, fontWeight: "700" },
  clientList: { gap: 8 },
  clientCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
  },
  clientCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: "#EEF2FF",
  },
  clientCardDragging: {
    borderColor: "#D97706",
    backgroundColor: "#FFF7ED",
  },
  clientName: { ...typography.body2, color: theme.colors.text, fontWeight: "700" },
  clientSub: { ...typography.caption, color: theme.colors.textSecondary },
  slotList: { gap: 8 },
  slotCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
  },
  slotCardSelected: {
    backgroundColor: "#EEF2FF",
    borderColor: theme.colors.primary,
  },
  slotCardHovered: {
    backgroundColor: "#ECFDF3",
    borderColor: "#198754",
  },
  slotCardTitle: { ...typography.body2, color: theme.colors.text, fontWeight: "700" },
  slotCardText: { ...typography.caption, color: theme.colors.textSecondary },
  slotStatus: { ...typography.caption, fontWeight: "700", textTransform: "capitalize" },
  emptyText: { ...typography.caption, color: theme.colors.textSecondary },
});
