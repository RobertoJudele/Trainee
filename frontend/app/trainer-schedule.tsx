import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSelector } from "react-redux";
import { useRouter } from "expo-router";
import {
    ScheduleSlot,
    useAssignClientToSlotMutation,
    useAssignSlotByClientCodeMutation,
    useGenerateSlotsMutation,
    useGetTrainerSlotsQuery,
    useGetWorkingHoursQuery,
    useResolveClientCodeMutation,
    useUpsertWorkingHourMutation,
} from "../features/schedule/scheduleApiSlice";
import { selectCurrentUser } from "../features/auth/authSlice";
import { UserRole } from "../features/auth/authApiSlice";
import { theme, typography } from "../src/lib/theme";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DragClient = {
    id: number;
    clientId: number;
    name: string;
    code: string;
};

type StoredDragClient = DragClient;

type SlotRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type DragClientChipProps = {
    client: DragClient;
    dragging: boolean;
    onDragStart: (client: DragClient, pageX: number, pageY: number, touchX: number, touchY: number) => void;
    onDragMove: (pageX: number, pageY: number) => void;
    onDrop: (client: DragClient, pageX: number, pageY: number, moved: boolean) => void;
};

type ActiveDrag = {
    client: DragClient;
    pageX: number;
    pageY: number;
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

const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

const startOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
};

const toDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const statusColor = (status: ScheduleSlot["status"]) => {
    if (status === "available") return "#198754";
    if (status === "assigned") return "#0D6EFD";
    if (status === "completed") return "#6F42C1";
    if (status === "canceled") return "#DC3545";
    return "#B54708";
};

const slotShortTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const dragClientsStorageKey = (userId: number) => `trainer-schedule-drag-clients:${userId}`;

function DragClientChip({
    client,
    dragging,
    onDragStart,
    onDragMove,
    onDrop,
}: DragClientChipProps) {
    const [chipSize, setChipSize] = useState({ width: 130, height: 40 });

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onStartShouldSetPanResponderCapture: () => true,
                onMoveShouldSetPanResponderCapture: () => true,
                onPanResponderTerminationRequest: () => false,
                onPanResponderGrant: (event) => {
                    onDragStart(
                        client,
                        event.nativeEvent.pageX,
                        event.nativeEvent.pageY,
                        chipSize.width / 2,
                        chipSize.height / 2
                    );
                },
                onPanResponderMove: (_, gesture) => {
                    onDragMove(gesture.moveX, gesture.moveY);
                },
                onPanResponderRelease: (_, gesture) => {
                    const moved = Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8;
                    onDrop(client, gesture.moveX, gesture.moveY, moved);
                },
                onPanResponderTerminate: () => {
                    onDrop(client, -1, -1, false);
                },
            }),
        [chipSize.height, chipSize.width, client, onDragMove, onDragStart, onDrop]
    );

    return (
        <View
            {...panResponder.panHandlers}
            onLayout={({ nativeEvent }) => {
                setChipSize({
                    width: nativeEvent.layout.width,
                    height: nativeEvent.layout.height,
                });
            }}
            style={[
                styles.dragChip,
                dragging && styles.dragChipDragging,
                dragging && styles.dragChipHidden,
            ]}
        >
            <Text style={styles.dragChipText}>{client.name}</Text>
            <Text style={styles.dragChipCode}>Code: {client.code}</Text>
        </View>
    );
}

export default function TrainerScheduleScreen() {
    const router = useRouter();
    const user = useSelector(selectCurrentUser);

    const [weekStartDate, setWeekStartDate] = useState<Date>(startOfWeek(new Date()));
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i)), [weekStartDate]);
    const weekFrom = useMemo(() => toDateKey(weekDays[0]), [weekDays]);
    const weekTo = useMemo(() => toDateKey(weekDays[6]), [weekDays]);

    const { data: whData, refetch: refetchWh } = useGetWorkingHoursQuery();
    const { data: slotData, isLoading: slotsLoading, refetch: refetchSlots } = useGetTrainerSlotsQuery({
        from: weekFrom,
        to: weekTo,
    });

    const [upsertWorkingHour, { isLoading: saveWhLoading }] = useUpsertWorkingHourMutation();
    const [generateSlots, { isLoading: generateLoading }] = useGenerateSlotsMutation();
    const [resolveClientCode, { isLoading: resolvingCode }] = useResolveClientCodeMutation();
    const [assignClientToSlot, { isLoading: assignByClientLoading }] = useAssignClientToSlotMutation();
    const [assignSlotByCode, { isLoading: assignByCodeLoading }] = useAssignSlotByClientCodeMutation();

    const [dayOfWeek, setDayOfWeek] = useState("1");
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("17:00");
    const [duration, setDuration] = useState("60");

    const [fromDate, setFromDate] = useState(weekFrom);
    const [toDate, setToDate] = useState(toDateKey(addDays(weekStartDate, 13)));

    const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
    const [clientCode, setClientCode] = useState("");
    const [assignNote, setAssignNote] = useState("");

    const [dragClientCode, setDragClientCode] = useState("");
    const [dragClients, setDragClients] = useState<DragClient[]>([]);
    const [draggingClientId, setDraggingClientId] = useState<number | null>(null);
    const [hoveredSlotId, setHoveredSlotId] = useState<number | null>(null);
    const [assigningSlotId, setAssigningSlotId] = useState<number | null>(null);
    const [dragInProgress, setDragInProgress] = useState(false);
    const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
    // const dragTranslate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    // const dragOriginRef = useRef<{ left: number; top: number } | null>(null);
    const dragPosRef = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const touchOffsetRef = useRef<{ x: number; y: number } | null>(null);
    const hoveredSlotIdRef = useRef<number | null>(null);
    const screenRef = useRef<View | null>(null);
    const screenOffsetRef = useRef({ x: 0, y: 0 });

    const slotRefs = useRef<Record<number, View | null>>({});
    const slotRectsRef = useRef<Record<number, SlotRect>>({});

    const measureScreenOffset = () => {
        requestAnimationFrame(() => {
            const screenNode = screenRef.current;
            if (!screenNode) return;

            screenNode.measureInWindow((x, y) => {
                screenOffsetRef.current = { x, y };
            });
        });
    };

    useEffect(() => {
        const loadDragClients = async () => {
            if (!user?.id || user.role !== UserRole.TRAINER) return;

            try {
                const raw = await AsyncStorage.getItem(dragClientsStorageKey(user.id));
                if (!raw) return;

                const parsed = JSON.parse(raw) as StoredDragClient[];
                if (!Array.isArray(parsed)) return;

                const validClients = parsed
                    .map((client) => {
                        if (
                            !client ||
                            typeof client.id !== "number" ||
                            typeof client.name !== "string" ||
                            typeof client.code !== "string"
                        ) {
                            return null;
                        }

                        return {
                            id: client.id,
                            clientId: typeof client.clientId === "number" ? client.clientId : client.id,
                            name: client.name,
                            code: client.code,
                        } as StoredDragClient;
                    })
                    .filter((client): client is StoredDragClient => Boolean(client));

                setDragClients(validClients);
            } catch {
                // Ignore storage read/parse errors and continue with an empty list.
            }
        };

        loadDragClients();
    }, [user?.id, user?.role]);

    useEffect(() => {
        const persistDragClients = async () => {
            if (!user?.id || user.role !== UserRole.TRAINER) return;

            try {
                await AsyncStorage.setItem(dragClientsStorageKey(user.id), JSON.stringify(dragClients));
            } catch {
                // Ignore storage write errors so scheduling stays usable offline.
            }
        };

        persistDragClients();
    }, [dragClients, user?.id, user?.role]);

    const workingHours = whData?.data || [];
    const slots = useMemo(
        () => [...(slotData?.data || [])].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
        [slotData?.data]
    );
    const availableSlots = useMemo(() => slots.filter((s) => s.status === "available"), [slots]);
    const slotsByDay = useMemo(() => {
        const grouped: Record<string, ScheduleSlot[]> = {};
        for (const slot of slots) {
            const key = toDateKey(new Date(slot.startsAt));
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(slot);
        }
        return grouped;
    }, [slots]);

    const weekLabel = `${weekDays[0].toLocaleDateString()} - ${weekDays[6].toLocaleDateString()}`;

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

    const onDragStart = (client: DragClient, pageX: number, pageY: number, touchX: number, touchY: number) => {
        setDragInProgress(true);
        setDraggingClientId(client.id);
        setActiveDrag({ client, pageX, pageY });
        touchOffsetRef.current = { x: touchX, y: touchY };
        dragPosRef.setValue({
            x: pageX - screenOffsetRef.current.x - touchX,
            y: pageY - screenOffsetRef.current.y - touchY,
        });
        console.log("Location of drag start:", pageX, pageY);
        setHoveredSlotId(null);
        refreshSlotRects();
    };

    const onDragMove = (pageX: number, pageY: number) => {
        const overId = hitTestSlot(pageX, pageY);
        hoveredSlotIdRef.current = overId;
        setHoveredSlotId(overId);
        if (touchOffsetRef.current) {
            dragPosRef.setValue({
                x: pageX - screenOffsetRef.current.x - touchOffsetRef.current.x,
                y: pageY - screenOffsetRef.current.y - touchOffsetRef.current.y,
            });
        }
    };



    const onDropClient = async (dragClient: DragClient, pageX: number, pageY: number, moved: boolean) => {
        if (!moved) {
            setDraggingClientId(null);
            setHoveredSlotId(null);
            hoveredSlotIdRef.current = null;
            setActiveDrag(null);
            touchOffsetRef.current = null;
            setDragInProgress(false);
            return;
        }

        const slotId = hitTestSlot(pageX, pageY) ?? hoveredSlotIdRef.current;

        if (!slotId) {
            setDraggingClientId(null);
            setHoveredSlotId(null);
            hoveredSlotIdRef.current = null;
            setActiveDrag(null);
            touchOffsetRef.current = null;
            setDragInProgress(false);
            return;
        }

        setAssigningSlotId(slotId);
        try {
            await assignClientToSlot({
                slotId,
                clientId: dragClient.clientId,
                note: "Assigned via drag and drop",
            }).unwrap();

            Alert.alert("Assigned", `${dragClient.name} was assigned to slot #${slotId}.`);
            await refetchSlots();
        } catch (error: unknown) {
            Alert.alert("Error", getErrorMessage(error, "Could not assign slot to client."));
        } finally {
            setAssigningSlotId(null);
            setDraggingClientId(null);
            setHoveredSlotId(null);
            hoveredSlotIdRef.current = null;
            setActiveDrag(null);
            touchOffsetRef.current = null;
            setDragInProgress(false);
        }
    };

    const onAddDragClient = async () => {
        const code = dragClientCode.trim();
        if (!/^\d{6}$/.test(code)) {
            Alert.alert("Validation", "Client code must be 6 digits.");
            return;
        }

        try {
            const resp = await resolveClientCode({ code }).unwrap();
            const resolved = resp.data.client;
            const nextClient: DragClient = {
                id: resolved.id,
                clientId: resolved.id,
                name: `${resolved.firstName} ${resolved.lastName}`,
                code,
            };

            setDragClients((prev) => {
                const withoutSameClient = prev.filter((client) => client.id !== resolved.id);
                return [nextClient, ...withoutSameClient];
            });
            setDragClientCode("");
        } catch (error: unknown) {
            Alert.alert("Error", getErrorMessage(error, "Could not resolve client code."));
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

    const onSaveWorkingHour = async () => {
        const parsedDay = Number(dayOfWeek);
        const parsedDuration = Number(duration);

        if (!Number.isInteger(parsedDay) || parsedDay < 0 || parsedDay > 6) {
            Alert.alert("Validation", "Day must be between 0 and 6.");
            return;
        }

        if (!Number.isFinite(parsedDuration) || parsedDuration < 15) {
            Alert.alert("Validation", "Duration should be at least 15 minutes.");
            return;
        }

        try {
            await upsertWorkingHour({
                dayOfWeek: parsedDay,
                startTime,
                endTime,
                slotDurationMin: parsedDuration,
                isActive: true,
            }).unwrap();

            Alert.alert("Saved", "Working day updated.");
            await refetchWh();
        } catch (error: unknown) {
            Alert.alert("Error", getErrorMessage(error, "Could not save working day."));
        }
    };

    const onGenerateSlots = async () => {
        try {
            await generateSlots({ fromDate, toDate }).unwrap();
            Alert.alert("Done", "Slots generated successfully.");
            await refetchSlots();
        } catch (error: unknown) {
            Alert.alert("Error", getErrorMessage(error, "Could not generate slots."));
        }
    };

    const onAssignByCode = async () => {
        if (!selectedSlotId) {
            Alert.alert("Validation", "Select an available slot first.");
            return;
        }

        if (!/^\d{6}$/.test(clientCode.trim())) {
            Alert.alert("Validation", "Client code must be 6 digits.");
            return;
        }

        setAssigningSlotId(selectedSlotId);
        try {
            await assignSlotByCode({
                slotId: selectedSlotId,
                code: clientCode.trim(),
                note: assignNote.trim() || undefined,
            }).unwrap();

            Alert.alert("Assigned", "Slot assigned based on client code.");
            setClientCode("");
            setAssignNote("");
            setSelectedSlotId(null);
            await refetchSlots();
        } catch (error: unknown) {
            Alert.alert("Error", getErrorMessage(error, "Could not assign slot by code."));
        } finally {
            setAssigningSlotId(null);
        }
    };

    const onPickWeek = (offset: number) => {
        const nextStart = addDays(weekStartDate, offset * 7);
        setWeekStartDate(startOfWeek(nextStart));
    };

    const onJumpToday = () => {
        setWeekStartDate(startOfWeek(new Date()));
    };

    return (
        <View ref={screenRef} onLayout={measureScreenOffset} style={styles.screen}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                scrollEnabled={!dragInProgress}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Trainer Schedule</Text>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>0) Drag & Drop Assign by Client Code</Text>
                    <Text style={styles.hint}>Add a client by 6-digit code, then drag the chip over an available slot.</Text>

                    <View style={styles.inlineRow}>
                        <TextInput
                            style={[styles.input, styles.flexInput]}
                            value={dragClientCode}
                            onChangeText={setDragClientCode}
                            placeholder="Client code (6 digits)"
                            keyboardType="number-pad"
                        />
                        <Pressable style={styles.secondaryBtn} onPress={onAddDragClient} disabled={resolvingCode}>
                            <Text style={styles.secondaryBtnText}>{resolvingCode ? "Adding..." : "Add Client"}</Text>
                        </Pressable>
                    </View>

                    <View style={styles.dragClientWrap}>
                        {dragClients.length === 0 ? (
                            <Text style={styles.emptyDayText}>No drag clients yet. Add one using a valid code.</Text>
                        ) : (
                            dragClients.map((client) => (
                                <DragClientChip
                                    key={client.id}
                                    client={client}
                                    dragging={draggingClientId === client.id}
                                    onDragStart={onDragStart}
                                    onDragMove={onDragMove}
                                    onDrop={onDropClient}
                                />
                            ))
                        )}
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Week Calendar</Text>
                    <Text style={styles.hint}>{weekLabel}</Text>

                    <View style={styles.weekNavRow}>
                        <Pressable style={styles.secondaryBtn} onPress={() => onPickWeek(-1)}>
                            <Text style={styles.secondaryBtnText}>Previous</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryBtn} onPress={onJumpToday}>
                            <Text style={styles.secondaryBtnText}>Today</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryBtn} onPress={() => onPickWeek(1)}>
                            <Text style={styles.secondaryBtnText}>Next</Text>
                        </Pressable>
                    </View>

                    {slotsLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}

                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.weekGrid}>
                            {weekDays.map((day) => {
                                const dateKey = toDateKey(day);
                                const daySlots = slotsByDay[dateKey] || [];

                                return (
                                    <View key={dateKey} style={styles.dayColumn}>
                                        <Text style={styles.dayColumnTitle}>
                                            {dayLabels[day.getDay()]} {day.getDate()}
                                        </Text>
                                        <Pressable
                                            onPress={() =>
                                                router.push({
                                                    pathname: "/trainer-schedule/[date]",
                                                    params: { date: dateKey },
                                                })
                                            }
                                            style={styles.dayOpenBtn}
                                        >
                                            <Text style={styles.dayOpenBtnText}>Open Day</Text>
                                        </Pressable>

                                        {daySlots.length === 0 ? (
                                            <Text style={styles.emptyDayText}>No slots</Text>
                                        ) : (
                                            daySlots.map((slot) => {
                                                const selected = selectedSlotId === slot.id;
                                                const selectable = slot.status === "available";
                                                const hovered = hoveredSlotId === slot.id;
                                                const assigning = assigningSlotId === slot.id;

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
                                                            onPress={() => {
                                                                if (!selectable) return;
                                                                setSelectedSlotId(slot.id);
                                                            }}
                                                            style={[
                                                                styles.slotPill,
                                                                { borderColor: statusColor(slot.status) },
                                                                selected && styles.slotPillSelected,
                                                                hovered && styles.slotPillHovered,
                                                                assigning && styles.slotPillAssigning,
                                                            ]}
                                                        >
                                                            <Text style={styles.slotPillTime}>
                                                                {slotShortTime(slot.startsAt)}-{slotShortTime(slot.endsAt)}
                                                            </Text>
                                                            <Text style={[styles.slotPillStatus, { color: statusColor(slot.status) }]}>
                                                                {slot.status}
                                                            </Text>
                                                            {slot.client ? (
                                                                <Text style={styles.slotPillClient}>
                                                                    {slot.client.firstName} {slot.client.lastName}
                                                                </Text>
                                                            ) : null}
                                                            {assigning ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
                                                        </Pressable>
                                                    </View>
                                                );
                                            })
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>1) Working Day Template</Text>
                    <Text style={styles.hint}>Choose a day and define your reusable template.</Text>
                    <View style={styles.dayRow}>
                        {dayLabels.map((label, idx) => {
                            const active = dayOfWeek === String(idx);
                            return (
                                <Pressable
                                    key={label}
                                    onPress={() => setDayOfWeek(String(idx))}
                                    style={[styles.dayChip, active && styles.dayChipActive]}
                                >
                                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{label}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder="Start HH:mm" />
                    <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} placeholder="End HH:mm" />
                    <TextInput
                        style={styles.input}
                        value={duration}
                        onChangeText={setDuration}
                        placeholder="Duration min"
                        keyboardType="number-pad"
                    />
                    <Pressable style={styles.primaryBtn} onPress={onSaveWorkingHour} disabled={saveWhLoading}>
                        <Text style={styles.primaryBtnText}>{saveWhLoading ? "Saving..." : "Save Working Day"}</Text>
                    </Pressable>

                    <View style={styles.listWrap}>
                        {workingHours.map((w) => (
                            <Text key={w.id} style={styles.listItem}>
                                {dayLabels[w.dayOfWeek]} {w.startTime}-{w.endTime} ({w.slotDurationMin}m)
                            </Text>
                        ))}
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>2) Generate Slots</Text>
                    <View style={styles.inlineRow}>
                        <Pressable
                            style={styles.secondaryBtn}
                            onPress={() => {
                                setFromDate(weekFrom);
                                setToDate(weekTo);
                            }}
                        >
                            <Text style={styles.secondaryBtnText}>Use displayed week</Text>
                        </Pressable>
                    </View>
                    <TextInput style={styles.input} value={fromDate} onChangeText={setFromDate} placeholder="from YYYY-MM-DD" />
                    <TextInput style={styles.input} value={toDate} onChangeText={setToDate} placeholder="to YYYY-MM-DD" />
                    <Pressable style={styles.primaryBtn} onPress={onGenerateSlots} disabled={generateLoading}>
                        <Text style={styles.primaryBtnText}>{generateLoading ? "Generating..." : "Generate Slots"}</Text>
                    </Pressable>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>3) Assign Slot by Client Code</Text>
                    <Text style={styles.hint}>Client generates a 6-digit code and gives it to trainer. No client search needed.</Text>
                    <TextInput
                        style={styles.input}
                        value={selectedSlotId ? String(selectedSlotId) : ""}
                        onChangeText={(v) => setSelectedSlotId(Number(v) || null)}
                        placeholder="Slot ID"
                        keyboardType="number-pad"
                    />
                    <TextInput
                        style={styles.input}
                        value={clientCode}
                        onChangeText={setClientCode}
                        placeholder="Client code (6 digits)"
                        keyboardType="number-pad"
                    />
                    <TextInput style={styles.input} value={assignNote} onChangeText={setAssignNote} placeholder="Optional note" />

                    <Pressable style={styles.primaryBtn} onPress={onAssignByCode} disabled={assignByCodeLoading}>
                        <Text style={styles.primaryBtnText}>{assignByCodeLoading ? "Assigning..." : "Assign by Code"}</Text>
                    </Pressable>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Available Slots (Week)</Text>
                    <View style={styles.listWrap}>
                        {availableSlots.map((s) => (
                            <View key={s.id} style={styles.slotCard}>
                                <Text style={styles.slotCardTitle}>#{s.id} • {new Date(s.startsAt).toLocaleDateString()}</Text>
                                <Text style={styles.listItem}>
                                    {new Date(s.startsAt).toLocaleTimeString()} - {new Date(s.endsAt).toLocaleTimeString()}
                                </Text>
                                <Text style={styles.slotStatus}>{s.status}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Assigned / Completed Slots</Text>
                    <View style={styles.listWrap}>
                        {slots
                            .filter((s) => s.status !== "available")
                            .map((s) => (
                                <View key={s.id} style={styles.slotCard}>
                                    <Text style={styles.slotCardTitle}>#{s.id} • {new Date(s.startsAt).toLocaleString()}</Text>
                                    <Text style={styles.listItem}>{s.client ? `${s.client.firstName} ${s.client.lastName}` : "No client"}</Text>
                                    <Text style={styles.slotStatus}>{s.status}</Text>
                                </View>
                            ))}
                    </View>
                </View>
            </ScrollView>
            {activeDrag ? (
                <View pointerEvents="none" style={styles.dragOverlay}>
                    <Animated.View
                        style={[
                            styles.dragChip,
                            styles.dragChipFloating,
                            {
                                left: dragPosRef.x,
                                top: dragPosRef.y,
                            },
                        ]}
                    >
                        <Text style={styles.dragChipText}>{activeDrag.client.name}</Text>
                        <Text style={styles.dragChipCode}>Code: {activeDrag.client.code}</Text>
                    </Animated.View>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    container: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: 16, gap: 12, paddingBottom: 32 },
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
    title: { ...typography.h2, color: theme.colors.text },
    card: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.roundness,
        padding: 16,
        gap: 12,
        ...theme.shadows.small,
    },
    sectionTitle: { ...typography.body1, color: theme.colors.text, fontWeight: "700" },
    hint: { ...typography.caption, color: theme.colors.textSecondary },
    input: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 10,
        color: theme.colors.text,
        backgroundColor: "#fff",
    },
    flexInput: { flex: 1 },
    primaryBtn: {
        backgroundColor: theme.colors.primary,
        borderRadius: theme.roundness,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: "center",
        ...theme.shadows.medium,
    },
    primaryBtnText: { ...typography.body2, color: "#fff", fontWeight: "700" },
    secondaryBtn: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.roundness,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: theme.colors.surface,
        ...theme.shadows.small,
    },
    secondaryBtnText: { ...typography.body2, color: theme.colors.text, fontWeight: "700" },
    inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    dragClientWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    dragChip: {
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderRadius: theme.roundness,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: `${theme.colors.primary}15`,
        minWidth: 130,
        ...theme.shadows.small,
    },
    dragChipDragging: {
        borderColor: "#D97706",
        backgroundColor: "#FFF7ED",
        ...theme.shadows.large,
    },
    dragChipHidden: {
        opacity: 0,
    },
    dragOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 99999,
        elevation: 999,
    },
    dragChipFloating: {
        position: "absolute",
    },
    dragChipText: { ...typography.body2, color: theme.colors.text, fontWeight: "700" },
    dragChipCode: { ...typography.caption, color: theme.colors.textSecondary },
    weekNavRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    weekGrid: { flexDirection: "row", gap: 10, marginTop: 10, paddingBottom: 2 },
    dayColumn: {
        width: 170,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.roundness,
        padding: 12,
        backgroundColor: theme.colors.surface,
        gap: 8,
        ...theme.shadows.small,
    },
    dayColumnTitle: { ...typography.body2, color: theme.colors.text, fontWeight: "700" },
    dayOpenBtn: {
        alignSelf: "flex-start",
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: `${theme.colors.primary}10`,
    },
    dayOpenBtnText: { ...typography.caption, color: theme.colors.primary, fontWeight: "700" },
    emptyDayText: { ...typography.caption, color: theme.colors.textSecondary },
    slotPill: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 7,
        backgroundColor: "#fff",
        gap: 2,
    },
    slotPillSelected: {
        backgroundColor: `${theme.colors.primary}15`,
        borderColor: theme.colors.primary,
    },
    slotPillHovered: {
        backgroundColor: `${theme.colors.success}15`,
        borderColor: theme.colors.success,
    },
    slotPillAssigning: {
        opacity: 0.75,
    },
    slotPillTime: { ...typography.caption, color: theme.colors.text, fontWeight: "700" },
    slotPillStatus: { ...typography.caption, fontWeight: "700", textTransform: "capitalize" },
    slotPillClient: { ...typography.caption, color: theme.colors.textSecondary },
    listWrap: { gap: 6, marginTop: 4 },
    listItem: { ...typography.caption, color: theme.colors.textSecondary },
    dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    dayChip: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: "#fff",
    },
    dayChipActive: {
        borderColor: theme.colors.primary,
        backgroundColor: `${theme.colors.primary}15`,
    },
    dayChipText: { ...typography.caption, color: theme.colors.textSecondary, fontWeight: "600" },
    dayChipTextActive: { color: theme.colors.primary },
    slotCard: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.roundness,
        padding: 12,
        backgroundColor: theme.colors.surface,
        gap: 4,
        ...theme.shadows.small,
    },
    slotCardTitle: { ...typography.body2, color: theme.colors.text, fontWeight: "700" },
    slotStatus: { ...typography.caption, color: theme.colors.primary, fontWeight: "700" },
});
