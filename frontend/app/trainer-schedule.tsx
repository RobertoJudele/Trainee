import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import {
    PublicClient,
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
import {
    BottomSheet,
    DayPill,
    GradientActionButton,
    OutlineButton,
    ScheduleCard,
    StatusBadge,
    addDays,
    formatWeekLabel,
    scheduleDayLabels,
    scheduleStatusColor,
    shortTime,
    startOfWeek,
    toDateKey,
} from "../src/components/schedule/SchedulePrimitives";

type DragClient = {
    id: number;
    clientId: number;
    name: string;
    code: string;
    email?: string;
    firstName?: string;
    lastName?: string;
};

type StoredDragClient = DragClient;
type StoredSavedClient = PublicClient & { code?: string };

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
};

type ApiErrorShape = {
    data?: {
        message?: string;
    };
};

const dragClientsStorageKey = (userId: number) => `trainer-schedule-drag-clients:${userId}`;
const savedClientsStorageKey = (userId: number) => `trainer-saved-clients:${userId}`;

const splitClientName = (fullName: string) => {
    const trimmed = fullName.trim();
    if (!trimmed) {
        return { firstName: "Client", lastName: "" };
    }

    const parts = trimmed.split(/\s+/);
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(" "),
    };
};

const toPublicClientFromDrag = (client: DragClient): PublicClient => {
    const parsedName = splitClientName(client.name);
    return {
        id: client.clientId,
        email: client.email || "",
        firstName: client.firstName || parsedName.firstName,
        lastName: client.lastName || parsedName.lastName,
    };
};

const parseStoredSavedClients = (raw: string | null): StoredSavedClient[] => {
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter((item): item is StoredSavedClient => {
                if (!item || typeof item !== "object") {
                    return false;
                }
                const maybe = item as Partial<StoredSavedClient>;
                return (
                    typeof maybe.id === "number" &&
                    typeof maybe.email === "string" &&
                    typeof maybe.firstName === "string" &&
                    typeof maybe.lastName === "string"
                );
            })
            .map((client) => ({
                ...client,
                code: typeof client.code === "string" ? client.code : undefined,
            }));
    } catch {
        return [];
    }
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

function DragClientChip({
    client,
    dragging,
    onDragStart,
    onDragMove,
    onDrop,
}: DragClientChipProps) {
    const [chipSize, setChipSize] = useState({ width: 140, height: 44 });

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
            style={[styles.dragChip, dragging && styles.dragChipDragging, dragging && styles.dragChipHidden]}
        >
            <Text style={styles.dragChipName}>{client.name}</Text>
            <Text style={styles.dragChipCode}>Code {client.code}</Text>
        </View>
    );
}

export default function TrainerScheduleScreen() {
    const router = useRouter();
    const user = useSelector(selectCurrentUser);
    const isFocused = useIsFocused();

    const [weekStartDate, setWeekStartDate] = useState<Date>(startOfWeek(new Date()));
    const [selectedDayIndex, setSelectedDayIndex] = useState(new Date().getDay());

    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i)), [weekStartDate]);
    const weekFrom = useMemo(() => toDateKey(weekDays[0]), [weekDays]);
    const weekTo = useMemo(() => toDateKey(weekDays[6]), [weekDays]);

    const selectedDate = weekDays[selectedDayIndex] || weekDays[0];
    const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);

    const { data: whData, refetch: refetchWh } = useGetWorkingHoursQuery();
    const { data: slotData, isLoading: slotsLoading, refetch: refetchSlots } = useGetTrainerSlotsQuery({
        from: weekFrom,
        to: weekTo,
    });

    const [upsertWorkingHour, { isLoading: saveWhLoading }] = useUpsertWorkingHourMutation();
    const [generateSlots, { isLoading: generateLoading }] = useGenerateSlotsMutation();
    const [resolveClientCode, { isLoading: resolvingCode }] = useResolveClientCodeMutation();
    const [assignClientToSlot] = useAssignClientToSlotMutation();
    const [assignSlotByCode, { isLoading: assignByCodeLoading }] = useAssignSlotByClientCodeMutation();

    const [showTemplateSheet, setShowTemplateSheet] = useState(false);
    const [showGenerateSheet, setShowGenerateSheet] = useState(false);
    const [showAssignSheet, setShowAssignSheet] = useState(false);

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
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const dragPosRef = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const touchOffsetRef = useRef<{ x: number; y: number } | null>(null);
    const hoveredSlotIdRef = useRef<number | null>(null);
    const screenRef = useRef<View | null>(null);
    const screenOffsetRef = useRef({ x: 0, y: 0 });
    const scrollRef = useRef<ScrollView | null>(null);

    const slotRefs = useRef<Record<number, View | null>>({});
    const slotRectsRef = useRef<Record<number, SlotRect>>({});

    useEffect(() => {
        if (!isFocused || user?.role !== UserRole.TRAINER) {
            return;
        }

        void refetchSlots();
    }, [isFocused, refetchSlots, user?.role]);

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
                        if (!client || typeof client.id !== "number" || typeof client.name !== "string" || typeof client.code !== "string") {
                            return null;
                        }

                        return {
                            id: client.id,
                            clientId: typeof client.clientId === "number" ? client.clientId : client.id,
                            name: client.name,
                            code: client.code,
                            email: typeof client.email === "string" ? client.email : undefined,
                            firstName: typeof client.firstName === "string" ? client.firstName : undefined,
                            lastName: typeof client.lastName === "string" ? client.lastName : undefined,
                        } as StoredDragClient;
                    })
                    .filter((client): client is StoredDragClient => Boolean(client));

                setDragClients(validClients);
            } catch {
                // Keep drag list optional when local storage is unavailable.
            }
        };

        loadDragClients();
    }, [user?.id, user?.role]);

    useEffect(() => {
        const persistDragClients = async () => {
            if (!user?.id || user.role !== UserRole.TRAINER) return;

            try {
                const dragKey = dragClientsStorageKey(user.id);
                const savedKey = savedClientsStorageKey(user.id);
                const existingSaved = parseStoredSavedClients(await AsyncStorage.getItem(savedKey));

                const savedClientsById = new Map<number, PublicClient>();
                for (const client of existingSaved) {
                    savedClientsById.set(client.id, {
                        id: client.id,
                        email: client.email,
                        firstName: client.firstName,
                        lastName: client.lastName,
                    });
                }
                for (const client of dragClients) {
                    savedClientsById.set(client.clientId, toPublicClientFromDrag(client));
                }

                await AsyncStorage.multiSet([
                    [dragKey, JSON.stringify(dragClients)],
                    [savedKey, JSON.stringify(Array.from(savedClientsById.values()))],
                ]);
            } catch {
                // Ignore storage write errors to avoid breaking scheduling UI.
            }
        };

        persistDragClients();
    }, [dragClients, user?.id, user?.role]);

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

    const workingHours = whData?.data || [];
    const slots = useMemo(
        () => [...(slotData?.data || [])].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
        [slotData?.data]
    );

    const slotsByDay = useMemo(() => {
        const grouped: Record<string, ScheduleSlot[]> = {};
        for (const slot of slots) {
            const key = toDateKey(new Date(slot.startsAt));
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(slot);
        }
        return grouped;
    }, [slots]);

    const selectedDaySlots = useMemo(
        () => [...(slotsByDay[selectedDateKey] || [])].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
        [selectedDateKey, slotsByDay]
    );

    const selectedDayAvailableSlots = useMemo(
        () => selectedDaySlots.filter((slot) => slot.status === "available"),
        [selectedDaySlots]
    );
    const contentBottomPadding = keyboardHeight > 0 ? keyboardHeight + 140 : 24;

    const scrollToClientInput = () => {
        requestAnimationFrame(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        });
    };

    const weekLabel = formatWeekLabel(weekDays);

    useEffect(() => {
        slotRefs.current = {};
        slotRectsRef.current = {};
        setHoveredSlotId(null);
    }, [selectedDateKey]);

    useEffect(() => {
        if (selectedSlotId && !selectedDaySlots.some((slot) => slot.id === selectedSlotId)) {
            setSelectedSlotId(null);
        }
    }, [selectedDaySlots, selectedSlotId]);

    const measureScreenOffset = () => {
        requestAnimationFrame(() => {
            const screenNode = screenRef.current;
            if (!screenNode) return;

            screenNode.measureInWindow((x, y) => {
                screenOffsetRef.current = { x, y };
            });
        });
    };

    const refreshSlotRects = () => {
        for (const slot of selectedDayAvailableSlots) {
            const node = slotRefs.current[slot.id];
            if (!node) continue;
            node.measureInWindow((x, y, width, height) => {
                slotRectsRef.current[slot.id] = { x, y, width, height };
            });
        }
    };

    const hitTestSlot = (pageX: number, pageY: number) => {
        const found = selectedDayAvailableSlots.find((slot) => {
            const rect = slotRectsRef.current[slot.id];
            if (!rect) return false;
            return pageX >= rect.x && pageX <= rect.x + rect.width && pageY >= rect.y && pageY <= rect.y + rect.height;
        });
        return found?.id || null;
    };

    const onDragStart = (client: DragClient, pageX: number, pageY: number, touchX: number, touchY: number) => {
        setDragInProgress(true);
        setDraggingClientId(client.id);
        setActiveDrag({ client });
        touchOffsetRef.current = { x: touchX, y: touchY };
        dragPosRef.setValue({
            x: pageX - screenOffsetRef.current.x - touchX,
            y: pageY - screenOffsetRef.current.y - touchY,
        });
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

    const resetDragState = () => {
        setDraggingClientId(null);
        setHoveredSlotId(null);
        hoveredSlotIdRef.current = null;
        setActiveDrag(null);
        touchOffsetRef.current = null;
        setDragInProgress(false);
    };

    const onDropClient = async (dragClient: DragClient, pageX: number, pageY: number, moved: boolean) => {
        if (!moved) {
            resetDragState();
            return;
        }

        const slotId = hitTestSlot(pageX, pageY) ?? hoveredSlotIdRef.current;
        if (!slotId) {
            resetDragState();
            return;
        }

        setAssigningSlotId(slotId);
        try {
            await assignClientToSlot({
                slotId,
                clientId: dragClient.clientId,
                note: "Assigned via drag and drop",
            }).unwrap();

            await refetchSlots();
        } catch (error: unknown) {
            Alert.alert("Error", getErrorMessage(error, "Could not assign slot to client."));
        } finally {
            setAssigningSlotId(null);
            resetDragState();
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
                email: resolved.email,
                firstName: resolved.firstName,
                lastName: resolved.lastName,
            };

            setDragClients((prev) => {
                const withoutSameClient = prev.filter((client) => client.id !== resolved.id);
                return [nextClient, ...withoutSameClient];
            });

            if (user?.id && user.role === UserRole.TRAINER) {
                try {
                    const key = savedClientsStorageKey(user.id);
                    const existing = parseStoredSavedClients(await AsyncStorage.getItem(key));
                    const merged: StoredSavedClient[] = [
                        {
                            id: resolved.id,
                            email: resolved.email,
                            firstName: resolved.firstName,
                            lastName: resolved.lastName,
                            code,
                        },
                        ...existing.filter((entry) => entry.id !== resolved.id),
                    ];
                    await AsyncStorage.setItem(key, JSON.stringify(merged));
                } catch {
                    // Ignore storage write errors to avoid blocking code resolution.
                }
            }

            setDragClientCode("");
        } catch (error: unknown) {
            Alert.alert("Error", getErrorMessage(error, "Could not resolve client code."));
        }
    };

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
            setShowGenerateSheet(false);
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
            setShowAssignSheet(false);
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
        const now = new Date();
        setWeekStartDate(startOfWeek(now));
        setSelectedDayIndex(now.getDay());
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
            <View ref={screenRef} onLayout={measureScreenOffset} style={styles.screen}>
            <ScrollView
                ref={scrollRef}
                style={styles.container}
                contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={!dragInProgress}
            >
                <View style={styles.heroCard}>
                    <View style={styles.heroTopRow}>
                        <View style={styles.heroTitleWrap}>
                            <Text style={styles.eyebrow}>Weekly Planner</Text>
                            <Text style={styles.title}>Trainer Schedule</Text>
                        </View>
                        <View style={styles.heroActions}>
                            <Pressable style={styles.iconBtn} onPress={() => setShowTemplateSheet(true)}>
                                <Ionicons name="settings-outline" size={18} color={theme.colors.text} />
                            </Pressable>
                            <OutlineButton
                                label="Snapshot"
                                onPress={() =>
                                    router.push({
                                        pathname: "/trainer-schedule/week-snapshot",
                                        params: { from: weekFrom, to: weekTo },
                                    })
                                }
                            />
                            <GradientActionButton label="Generate" onPress={() => setShowGenerateSheet(true)} />
                        </View>
                    </View>

                    <View style={styles.weekRow}>
                        <OutlineButton label="Prev" onPress={() => onPickWeek(-1)} />
                        <View style={styles.weekLabelChip}>
                            <Text style={styles.weekLabelText}>{weekLabel}</Text>
                        </View>
                        <OutlineButton label="Next" onPress={() => onPickWeek(1)} />
                    </View>

                    <View style={styles.todayRow}>
                        <OutlineButton label="Today" onPress={onJumpToday} />
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
                        {weekDays.map((day, index) => {
                            const label = `${scheduleDayLabels[day.getDay()]} ${day.getDate()}`;
                            return <DayPill key={toDateKey(day)} label={label} active={selectedDayIndex === index} onPress={() => setSelectedDayIndex(index)} />;
                        })}
                    </ScrollView>
                </View>

                <ScheduleCard
                    title={`Day View - ${selectedDateKey}`}
                    subtitle="Drag clients from the pool to available slots. Tap a slot to select it for assign-by-code."
                    rightSlot={
                        <Pressable
                            style={styles.openDayBtn}
                            onPress={() =>
                                router.push({
                                    pathname: "/trainer-schedule/[date]",
                                    params: { date: selectedDateKey },
                                })
                            }
                        >
                            <Text style={styles.openDayBtnText}>Open Day</Text>
                        </Pressable>
                    }
                >
                    {slotsLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}

                    {selectedDaySlots.length === 0 ? (
                        <Text style={styles.emptyText}>No slots for this day yet. Generate slots from header actions.</Text>
                    ) : (
                        selectedDaySlots.map((slot) => {
                            const selected = selectedSlotId === slot.id;
                            const hovered = hoveredSlotId === slot.id;
                            const isAvailable = slot.status === "available";
                            const assigning = assigningSlotId === slot.id;

                            return (
                                <View
                                    key={slot.id}
                                    ref={(node) => {
                                        if (isAvailable) {
                                            slotRefs.current[slot.id] = node;
                                        }
                                    }}
                                    collapsable={false}
                                    onLayout={isAvailable ? refreshSlotRects : undefined}
                                >
                                    <Pressable
                                        onPress={() => {
                                            if (!isAvailable) return;
                                            setSelectedSlotId(slot.id);
                                        }}
                                        style={[
                                            styles.slotCard,
                                            { borderColor: scheduleStatusColor(slot.status) },
                                            selected && styles.slotCardSelected,
                                            hovered && styles.slotCardHovered,
                                            assigning && styles.slotCardAssigning,
                                        ]}
                                    >
                                        <View style={styles.slotTopRow}>
                                            <View style={styles.slotTimeWrap}>
                                                <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
                                                <Text style={styles.slotTimeText}>
                                                    {shortTime(slot.startsAt)} - {shortTime(slot.endsAt)}
                                                </Text>
                                            </View>
                                            <StatusBadge status={slot.status} />
                                        </View>
                                        {slot.client ? (
                                            <Text style={styles.slotClientText}>
                                                {slot.client.firstName} {slot.client.lastName}
                                            </Text>
                                        ) : (
                                            <Text style={styles.slotClientPlaceholder}>Drag and drop a client here</Text>
                                        )}
                                        {assigning ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
                                    </Pressable>
                                </View>
                            );
                        })
                    )}

                    <View style={styles.assignByCodeRow}>
                        <Text style={styles.assignByCodeHint}>
                            {selectedSlotId ? `Selected slot #${selectedSlotId}` : "Select an available slot to assign by client code."}
                        </Text>
                        <OutlineButton label="Assign by Code" onPress={() => setShowAssignSheet(true)} disabled={!selectedSlotId} />
                    </View>
                </ScheduleCard>

                <View style={styles.clientPool}>
                    <View style={styles.clientPoolHead}>
                        <Text style={styles.clientPoolTitle}>Unassigned Clients</Text>
                        <Text style={styles.clientPoolHint}>Add by 6-digit code, then drag onto an available slot.</Text>
                    </View>
                    <View style={styles.clientPoolInputRow}>
                        <TextInput
                            style={[styles.input, styles.flexInput]}
                            value={dragClientCode}
                            onChangeText={setDragClientCode}
                            placeholder="Client code"
                            placeholderTextColor={theme.colors.textSecondary}
                            selectionColor={theme.colors.primary}
                            cursorColor={theme.colors.primary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            onFocus={scrollToClientInput}
                            keyboardType="number-pad"
                        />
                        <GradientActionButton label={resolvingCode ? "Adding..." : "Add"} onPress={onAddDragClient} disabled={resolvingCode} />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dragList}>
                        {dragClients.length === 0 ? (
                            <Text style={styles.emptyText}>No clients in pool yet.</Text>
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
                    </ScrollView>
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
                        <Text style={styles.dragChipName}>{activeDrag.client.name}</Text>
                        <Text style={styles.dragChipCode}>Code {activeDrag.client.code}</Text>
                    </Animated.View>
                </View>
            ) : null}

            <BottomSheet
                visible={showTemplateSheet}
                title="Working Day Template"
                subtitle="Define trainer availability templates used for slot generation."
                onClose={() => setShowTemplateSheet(false)}
                footer={
                    <GradientActionButton
                        label={saveWhLoading ? "Saving..." : "Save Working Day"}
                        onPress={onSaveWorkingHour}
                        disabled={saveWhLoading}
                    />
                }
            >
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                    <ScrollView keyboardShouldPersistTaps="handled" style={styles.sheetScroll}>
                        <View style={styles.dayPillRow}>
                            {scheduleDayLabels.map((label, idx) => (
                                <DayPill key={label} label={label} active={dayOfWeek === String(idx)} onPress={() => setDayOfWeek(String(idx))} />
                            ))}
                        </View>
                        <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder="Start HH:mm" />
                        <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} placeholder="End HH:mm" />
                        <TextInput
                            style={styles.input}
                            value={duration}
                            onChangeText={setDuration}
                            placeholder="Duration (min)"
                            keyboardType="number-pad"
                        />

                        <View style={styles.workingList}>
                            {workingHours.length === 0 ? (
                                <Text style={styles.emptyText}>No templates saved yet.</Text>
                            ) : (
                                workingHours.map((item) => (
                                    <View key={item.id} style={styles.workingItem}>
                                        <Text style={styles.workingItemText}>
                                            {scheduleDayLabels[item.dayOfWeek]} {item.startTime} - {item.endTime} ({item.slotDurationMin}m)
                                        </Text>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </BottomSheet>

            <BottomSheet
                visible={showGenerateSheet}
                title="Generate Slots"
                subtitle="Generate slots for a custom range or reuse the displayed week."
                onClose={() => setShowGenerateSheet(false)}
                footer={
                    <GradientActionButton
                        label={generateLoading ? "Generating..." : "Generate Slots"}
                        onPress={onGenerateSlots}
                        disabled={generateLoading}
                    />
                }
            >
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                    <View style={styles.sheetControls}>
                        <OutlineButton
                            label="Use Displayed Week"
                            onPress={() => {
                                setFromDate(weekFrom);
                                setToDate(weekTo);
                            }}
                        />
                        <TextInput style={styles.input} value={fromDate} onChangeText={setFromDate} placeholder="From YYYY-MM-DD" />
                        <TextInput style={styles.input} value={toDate} onChangeText={setToDate} placeholder="To YYYY-MM-DD" />
                    </View>
                </KeyboardAvoidingView>
            </BottomSheet>

            <BottomSheet
                visible={showAssignSheet}
                title="Assign Selected Slot by Code"
                subtitle="Use a client code to assign the currently selected available slot."
                onClose={() => setShowAssignSheet(false)}
                footer={
                    <GradientActionButton
                        label={assignByCodeLoading ? "Assigning..." : "Assign by Code"}
                        onPress={onAssignByCode}
                        disabled={assignByCodeLoading}
                    />
                }
            >
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                    <View style={styles.sheetControls}>
                        <TextInput
                            style={styles.input}
                            value={selectedSlotId ? String(selectedSlotId) : ""}
                            onChangeText={(value) => setSelectedSlotId(Number(value) || null)}
                            placeholder="Slot ID"
                            placeholderTextColor={theme.colors.textSecondary}
                            selectionColor={theme.colors.primary}
                            cursorColor={theme.colors.primary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="number-pad"
                        />
                        <TextInput
                            style={styles.input}
                            value={clientCode}
                            onChangeText={setClientCode}
                            placeholder="Client code (6 digits)"
                            placeholderTextColor={theme.colors.textSecondary}
                            selectionColor={theme.colors.primary}
                            cursorColor={theme.colors.primary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="number-pad"
                        />
                        <TextInput style={styles.input} value={assignNote} onChangeText={setAssignNote} placeholder="Optional note" />
                    </View>
                </KeyboardAvoidingView>
            </BottomSheet>
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
        paddingBottom: 24,
        gap: 12,
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
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
    },
    heroTitleWrap: {
        flex: 1,
        gap: 2,
    },
    eyebrow: {
        ...typography.caption,
        color: theme.colors.textSecondary,
        textTransform: "none",
    },
    title: {
        ...typography.h2,
        color: theme.colors.text,
        fontWeight: "800",
    },
    heroActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    iconBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#CED7E3",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
    },
    weekRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    weekLabelChip: {
        flex: 1,
        borderRadius: 12,
        backgroundColor: "#F5F8FC",
        borderWidth: 1,
        borderColor: "#DCE5F0",
        paddingVertical: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    weekLabelText: {
        ...typography.body2,
        color: theme.colors.text,
        fontWeight: "700",
    },
    todayRow: {
        alignItems: "flex-end",
    },
    dayStrip: {
        gap: 8,
        paddingRight: 8,
    },
    openDayBtn: {
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: `${theme.colors.primary}15`,
    },
    openDayBtnText: {
        ...typography.caption,
        color: theme.colors.primary,
        fontWeight: "700",
        textTransform: "none",
    },
    slotCard: {
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        padding: 10,
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
    slotCardAssigning: {
        opacity: 0.75,
    },
    slotTopRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    slotTimeWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    slotTimeText: {
        ...typography.body2,
        color: theme.colors.text,
        fontWeight: "700",
    },
    slotIdText: {
        ...typography.caption,
        color: theme.colors.textSecondary,
        textTransform: "none",
    },
    slotClientText: {
        ...typography.body2,
        color: theme.colors.text,
    },
    slotClientPlaceholder: {
        ...typography.body2,
        color: theme.colors.textSecondary,
    },
    assignByCodeRow: {
        marginTop: 4,
        gap: 8,
    },
    assignByCodeHint: {
        ...typography.body2,
        color: theme.colors.textSecondary,
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
    clientPoolHead: {
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
    clientPoolInputRow: {
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
    flexInput: {
        flex: 1,
    },
    dragList: {
        gap: 8,
        paddingRight: 6,
    },
    dragChip: {
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: `${theme.colors.primary}15`,
        minWidth: 140,
        gap: 2,
    },
    dragChipDragging: {
        borderColor: "#D97706",
        backgroundColor: "#FFF7ED",
        ...theme.shadows.large,
    },
    dragChipHidden: {
        opacity: 0,
    },
    dragChipFloating: {
        position: "absolute",
        ...theme.shadows.large,
    },
    dragChipName: {
        ...typography.body2,
        color: theme.colors.text,
        fontWeight: "700",
    },
    dragChipCode: {
        ...typography.caption,
        color: theme.colors.textSecondary,
        textTransform: "none",
    },
    dragOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        elevation: 999,
    },
    emptyText: {
        ...typography.body2,
        color: theme.colors.textSecondary,
    },
    sheetScroll: {
        maxHeight: 360,
    },
    dayPillRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 8,
    },
    workingList: {
        marginTop: 10,
        gap: 8,
    },
    workingItem: {
        borderWidth: 1,
        borderColor: "#DEE6EF",
        borderRadius: 12,
        backgroundColor: "#F7FAFE",
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    workingItemText: {
        ...typography.body2,
        color: theme.colors.text,
    },
    sheetControls: {
        gap: 10,
    },
});
