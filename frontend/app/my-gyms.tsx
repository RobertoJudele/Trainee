// frontend/app/my-gyms.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import {
  useGetMyGymsQuery,
  useGetAllGymsQuery,
  useJoinGymMutation,
  useSetGymAvailabilityMutation,
  useLeaveGymMutation,
  GymMarker,
  MyGym,
} from "../features/gym/gymApiSlice";
import { theme, typography } from "../src/lib/theme";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "../features/auth/authSlice";
import { useRouter } from "expo-router";

export default function MyGymsScreen() {
  const router = useRouter();
  const user = useSelector(selectCurrentUser);
  const isTrainer = user?.role === "trainer";

  const [showBrowser, setShowBrowser] = useState(false);
  const [gymSearch, setGymSearch] = useState("");

  const { data: myGymsRes, isLoading: myLoading, refetch } = useGetMyGymsQuery(undefined, { skip: !isTrainer });
  const { data: allGymsRes, isLoading: allLoading } = useGetAllGymsQuery();

  const [joinGym, { isLoading: joining }] = useJoinGymMutation();
  const [setAvailability] = useSetGymAvailabilityMutation();
  const [leaveGym, { isLoading: leaving }] = useLeaveGymMutation();

  const myGyms: MyGym[] = myGymsRes?.data ?? [];
  const allGyms: GymMarker[] = allGymsRes?.data ?? [];
  const myGymIds = new Set(myGyms.map((g) => g.id));

  const filteredAllGyms = allGyms.filter(
    (g) =>
      g.name.toLowerCase().includes(gymSearch.toLowerCase()) ||
      g.city.toLowerCase().includes(gymSearch.toLowerCase())
  );

  const handleJoin = useCallback(
    async (gymId: number, gymName: string) => {
      try {
        await joinGym(gymId).unwrap();
        Alert.alert("✅ Joined!", `You are now registered at ${gymName}`);
        setShowBrowser(false);
      } catch (err: any) {
        Alert.alert("Error", err?.data?.message ?? "Failed to join gym");
      }
    },
    [joinGym]
  );

  const handleToggleAvailability = useCallback(
    async (gymId: number, current: boolean) => {
      try {
        await setAvailability({ gymId, isAvailable: !current }).unwrap();
      } catch (err: any) {
        Alert.alert("Error", err?.data?.message ?? "Failed to update availability");
      }
    },
    [setAvailability]
  );

  const handleLeave = useCallback(
    (gymId: number, gymName: string) => {
      Alert.alert(
        "Leave gym",
        `Remove yourself from ${gymName}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Leave",
            style: "destructive",
            onPress: async () => {
              try {
                await leaveGym(gymId).unwrap();
              } catch (err: any) {
                Alert.alert("Error", err?.data?.message ?? "Failed to leave gym");
              }
            },
          },
        ]
      );
    },
    [leaveGym]
  );

  // ── Not a trainer ──────────────────────────────────────────────────────────
  if (!isTrainer) {
    return (
      <View style={styles.centeredBox}>
        <Text style={styles.emptyIcon}>🏋️</Text>
        <Text style={styles.emptyTitle}>Trainers only</Text>
        <Text style={styles.emptyDesc}>
          You need a trainer profile to manage gym availability.
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push("/create-trainer")}
        >
          <Text style={styles.primaryBtnText}>Become a Trainer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── My gym card ────────────────────────────────────────────────────────────
  const renderMyGym = ({ item }: { item: MyGym }) => (
    <View style={styles.gymCard}>
      <View style={styles.gymCardTop}>
        <View style={styles.gymCardLeft}>
          <Text style={styles.gymCardName}>{item.name}</Text>
          <Text style={styles.gymCardAddress}>
            📍 {item.address}, {item.city}
            {item.state ? `, ${item.state}` : ""}
          </Text>
          {item.openingHours && (
            <Text style={styles.gymCardHours}>🕐 {item.openingHours}</Text>
          )}
        </View>

        {/* Availability toggle */}
        <View style={styles.toggleBox}>
          <Text style={styles.toggleLabel}>
            {item.isAvailable ? "Available" : "Unavailable"}
          </Text>
          <Switch
            value={item.isAvailable}
            onValueChange={() => handleToggleAvailability(item.id, item.isAvailable)}
            trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}80` }}
            thumbColor={item.isAvailable ? theme.colors.primary : "#ccc"}
          />
        </View>
      </View>

      {/* Availability description */}
      <View
        style={[
          styles.availRow,
          item.isAvailable ? styles.availRowOn : styles.availRowOff,
        ]}
      >
        <Text style={styles.availText}>
          {item.isAvailable
            ? "✅ Clients can see you as available at this gym"
            : "🔴 You appear unavailable at this gym"}
        </Text>
      </View>

      {/* Leave button */}
      <TouchableOpacity
        style={styles.leaveBtn}
        onPress={() => handleLeave(item.id, item.name)}
        disabled={leaving}
      >
        <Text style={styles.leaveBtnText}>Leave gym</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Browser modal gym row ──────────────────────────────────────────────────
  const renderBrowserGym = (gym: GymMarker) => {
    const alreadyJoined = myGymIds.has(gym.id);
    return (
      <View key={gym.id} style={styles.browserRow}>
        <View style={styles.browserRowLeft}>
          <Text style={styles.browserGymName}>{gym.name}</Text>
          <Text style={styles.browserGymAddr}>
            {gym.address}, {gym.city}
          </Text>
          <Text style={styles.browserGymMeta}>
            ⭐ {Number(gym.rating).toFixed(1)} · {gym.availableTrainerCount} trainer
            {gym.availableTrainerCount !== 1 ? "s" : ""}
          </Text>
        </View>
        {alreadyJoined ? (
          <View style={styles.joinedBadge}>
            <Text style={styles.joinedBadgeText}>Joined</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.joinBtn, joining && styles.joinBtnDisabled]}
            onPress={() => handleJoin(gym.id, gym.name)}
            disabled={joining}
          >
            <Text style={styles.joinBtnText}>{joining ? "..." : "Join"}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Gyms</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowBrowser(true)}
        >
          <Text style={styles.addBtnText}>+ Add Gym</Text>
        </TouchableOpacity>
      </View>

      {myLoading ? (
        <View style={styles.centeredBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : myGyms.length === 0 ? (
        <View style={styles.centeredBox}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyTitle}>No gyms yet</Text>
          <Text style={styles.emptyDesc}>
            Add gyms where you train so clients can find you.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setShowBrowser(true)}
          >
            <Text style={styles.primaryBtnText}>Browse Gyms</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={myGyms}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMyGym}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Gym browser modal ── */}
      <Modal
        visible={showBrowser}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBrowser(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Find a Gym</Text>
            <TouchableOpacity onPress={() => setShowBrowser(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or city..."
              placeholderTextColor={theme.colors.textSecondary}
              value={gymSearch}
              onChangeText={setGymSearch}
            />
          </View>

          {allLoading ? (
            <ActivityIndicator
              style={{ marginTop: 40 }}
              color={theme.colors.primary}
            />
          ) : (
            <ScrollView contentContainerStyle={styles.browserList}>
              {filteredAllGyms.length === 0 ? (
                <Text style={styles.noResults}>No gyms found</Text>
              ) : (
                filteredAllGyms.map(renderBrowserGym)
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: { ...typography.h2, color: theme.colors.text, fontWeight: "700" },
  addBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.roundness,
  },
  addBtnText: { ...typography.body2, color: "#fff", fontWeight: "700" },

  listContent: { padding: theme.spacing.md, gap: theme.spacing.md },

  // Gym card
  gymCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  gymCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  gymCardLeft: { flex: 1, marginRight: 12 },
  gymCardName: { ...typography.body1, fontWeight: "700", color: theme.colors.text, marginBottom: 2 },
  gymCardAddress: { ...typography.caption, color: theme.colors.textSecondary, marginBottom: 2 },
  gymCardHours: { ...typography.caption, color: theme.colors.textSecondary },
  toggleBox: { alignItems: "center", gap: 4 },
  toggleLabel: { ...typography.caption, color: theme.colors.textSecondary, fontWeight: "600" },
  availRow: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  availRowOn: { backgroundColor: "#D1FAE5" },
  availRowOff: { backgroundColor: "#FEE2E2" },
  availText: { ...typography.caption, color: "#374151", fontWeight: "600" },
  leaveBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  leaveBtnText: { ...typography.caption, color: theme.colors.error, fontWeight: "700" },

  // Empty / centered
  centeredBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40, gap: 10 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { ...typography.h3, color: theme.colors.text, fontWeight: "700" },
  emptyDesc: { ...typography.body2, color: theme.colors.textSecondary, textAlign: "center" },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.roundness,
  },
  primaryBtnText: { ...typography.body2, color: "#fff", fontWeight: "700" },

  // Modal
  modal: { flex: 1, backgroundColor: theme.colors.background },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  modalTitle: { ...typography.h2, color: theme.colors.text, fontWeight: "700" },
  modalClose: { fontSize: 20, color: theme.colors.textSecondary },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    margin: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, ...typography.body1, color: theme.colors.text },
  browserList: { paddingHorizontal: theme.spacing.md, paddingBottom: 40 },
  noResults: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 40,
  },
  browserRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  browserRowLeft: { flex: 1 },
  browserGymName: { ...typography.body1, fontWeight: "700", color: theme.colors.text },
  browserGymAddr: { ...typography.caption, color: theme.colors.textSecondary, marginTop: 1 },
  browserGymMeta: { ...typography.caption, color: theme.colors.textSecondary, marginTop: 2 },
  joinBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.roundness,
  },
  joinBtnDisabled: { opacity: 0.5 },
  joinBtnText: { ...typography.body2, color: "#fff", fontWeight: "700" },
  joinedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.roundness,
    backgroundColor: "#D1FAE5",
  },
  joinedBadgeText: { ...typography.caption, color: "#065F46", fontWeight: "700" },
});